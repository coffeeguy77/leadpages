'use strict';

const { BrainError, CODES, isBrainError } = require('./errors');
const { ensureCorrelationId } = require('./ids');
const { assertSchema } = require('./schema');

/**
 * @param {object} deps
 * @param {import('./config').BrainConfig} deps.config
 * @param {ReturnType<import('./router').createTaskRouter>} deps.router
 * @param {Record<string, import('./types').ProviderAdapter>} deps.adapters
 * @param {(event: object) => void} [deps.onUsage]
 */
function createGateway(deps) {
  const { config, router, adapters, onUsage } = deps;

  /**
   * @param {string} provider
   */
  function getAdapter(provider) {
    const adapter = adapters[provider];
    if (!adapter) {
      throw new BrainError(CODES.not_implemented, 'No adapter registered for provider: ' + provider);
    }
    return adapter;
  }

  /**
   * @param {import('./types').BrainGenerateInput} input
   * @param {{ structured?: boolean, responseSchema?: object }} [opts]
   */
  async function run(input, opts) {
    const started = Date.now();
    const correlationId = ensureCorrelationId(input && input.correlationId);
    try {
      if (!input || typeof input !== 'object') {
        throw new BrainError(CODES.bad_request, 'Brain input is required');
      }
      if (!input.taskId || typeof input.taskId !== 'string') {
        throw new BrainError(CODES.bad_request, 'taskId is required');
      }
      if (input.stream) {
        throw new BrainError(CODES.not_implemented, 'Streaming is not implemented in Phase 1');
      }

      const decision = router.resolve(input.taskId);
      const wantStructured = !!(opts && opts.structured) || decision.structured;
      const responseSchema = (opts && opts.responseSchema) || input.responseSchema || null;

      if (wantStructured && !responseSchema) {
        throw new BrainError(
          CODES.bad_request,
          'responseSchema is required for structured generation'
        );
      }

      const messages = buildMessages(input);
      const adapter = getAdapter(decision.primary.provider);
      const genReq = {
        correlationId,
        messages,
        model: decision.primary,
        maxTokens: decision.maxTokens,
        timeoutMs: decision.timeoutMs,
        responseSchema: wantStructured ? responseSchema : undefined
      };

      let result;
      try {
        result = await adapter.generate(genReq);
      } catch (err) {
        if (decision.fallback && decision.fallback.length) {
          const fb = decision.fallback[0];
          const fbAdapter = getAdapter(fb.provider);
          result = await fbAdapter.generate({ ...genReq, model: fb });
          result = Object.assign({}, result, { fallbackUsed: true });
        } else {
          throw err;
        }
      }

      let output;
      if (wantStructured) {
        const json = result.json !== undefined ? result.json : safeParseJson(result.text);
        assertSchema(responseSchema, json);
        output = json;
      } else {
        output = { text: result.text != null ? String(result.text) : '' };
      }

      const usageEvent = {
        correlationId,
        taskId: input.taskId,
        promptId: input.promptId || null,
        siteId: input.siteId || null,
        actor: input.actor || null,
        provider: result.model.provider,
        model: result.model.model,
        success: true,
        inputTokens: result.usage && result.usage.inputTokens,
        outputTokens: result.usage && result.usage.outputTokens,
        latencyMs: Date.now() - started,
        fallbackUsed: !!result.fallbackUsed,
        reasonCodes: decision.reasonCodes
      };
      if (typeof onUsage === 'function') onUsage(usageEvent);

      return {
        ok: true,
        correlationId,
        taskId: input.taskId,
        output,
        model: result.model,
        usage: {
          inputTokens: result.usage && result.usage.inputTokens,
          outputTokens: result.usage && result.usage.outputTokens,
          cachedTokens: result.usage && result.usage.cachedTokens,
          costUsdEstimate: 0
        },
        prompt: { promptId: input.promptId || null, version: null },
        routing: {
          primary: decision.primary,
          fallbackUsed: !!result.fallbackUsed,
          reasonCodes: decision.reasonCodes
        }
      };
    } catch (err) {
      const brainErr = isBrainError(err)
        ? err
        : new BrainError(CODES.internal, (err && err.message) || 'Brain internal error', {
          cause: err
        });
      if (typeof onUsage === 'function') {
        onUsage({
          correlationId,
          taskId: input && input.taskId,
          success: false,
          errorCode: brainErr.code,
          latencyMs: Date.now() - started
        });
      }
      return Object.assign({ correlationId }, brainErr.toJSON());
    }
  }

  /**
   * @param {import('./types').BrainGenerateInput} input
   */
  function generate(input) {
    return run(input, { structured: false });
  }

  /**
   * @param {import('./types').BrainGenerateInput} input
   */
  function generateStructured(input) {
    return run(input, { structured: true, responseSchema: input.responseSchema });
  }

  function listModels() {
    return Object.entries(config.models).map(([id, m]) => ({
      id,
      provider: m.provider,
      model: m.model,
      capabilities: m.capabilities || []
    }));
  }

  /**
   * @param {string} taskId
   */
  function getRoutingDecision(taskId) {
    return router.resolve(taskId);
  }

  /**
   * @param {string} provider
   */
  async function testProviderConnection(provider) {
    const adapter = getAdapter(provider);
    return adapter.healthCheck();
  }

  return {
    generate,
    generateStructured,
    listModels,
    getRoutingDecision,
    testProviderConnection,
    config
  };
}

/**
 * @param {import('./types').BrainGenerateInput} input
 * @returns {import('./types').BrainMessage[]}
 */
function buildMessages(input) {
  if (Array.isArray(input.messages) && input.messages.length) {
    return input.messages.map((m) => ({
      role: m.role,
      content: String(m.content || '')
    }));
  }
  const payload = input.input;
  const userContent = typeof payload === 'string'
    ? payload
    : JSON.stringify(payload == null ? {} : payload);
  return [
    { role: 'system', content: 'LeadPages Brain Phase 1. Task: ' + input.taskId },
    { role: 'user', content: userContent }
  ];
}

/**
 * @param {string|undefined} text
 */
function safeParseJson(text) {
  try {
    return JSON.parse(String(text || ''));
  } catch (err) {
    throw new BrainError(CODES.invalid_output, 'Provider returned non-JSON text', {
      retryable: true,
      cause: err
    });
  }
}

module.exports = { createGateway };
