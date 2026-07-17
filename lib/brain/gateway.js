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
 * @param {ReturnType<import('./prompts').createPromptRegistry>} [deps.prompts]
 * @param {ReturnType<import('./context').createContextResolver>} [deps.contextResolver]
 */
function createGateway(deps) {
  const { config, router, adapters, onUsage, prompts, contextResolver } = deps;

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
        throw new BrainError(CODES.not_implemented, 'Streaming is not implemented yet');
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

      let resolvedContext = null;
      if (Array.isArray(input.contextSlices) && input.contextSlices.length) {
        if (!contextResolver) {
          throw new BrainError(CODES.not_implemented, 'Context resolver is not configured');
        }
        resolvedContext = contextResolver.resolve({
          siteId: input.siteId,
          site: input.site,
          actor: input.actor,
          partner: input.partner,
          slices: input.contextSlices
        });
      }

      const built = buildMessages(input, { prompts, resolvedContext });
      const messages = built.messages;
      const promptMeta = built.prompt;

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
        promptId: (promptMeta && promptMeta.promptId) || input.promptId || null,
        promptVersion: (promptMeta && promptMeta.version) || null,
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
        prompt: {
          promptId: (promptMeta && promptMeta.promptId) || input.promptId || null,
          version: (promptMeta && promptMeta.version) || null
        },
        context: resolvedContext
          ? { siteId: resolvedContext.siteId, slices: resolvedContext.slices, meta: resolvedContext.meta }
          : null,
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
 * @param {{ prompts?: object, resolvedContext?: object|null }} [opts]
 * @returns {{ messages: import('./types').BrainMessage[], prompt: { promptId: string|null, version: number|null } }}
 */
function buildMessages(input, opts) {
  const options = opts || {};
  if (Array.isArray(input.messages) && input.messages.length) {
    return {
      messages: input.messages.map((m) => ({
        role: m.role,
        content: String(m.content || '')
      })),
      prompt: { promptId: input.promptId || null, version: null }
    };
  }

  const promptId = input.promptId || null;
  if (promptId && options.prompts) {
    const vars = buildPromptVariables(input, options.resolvedContext);
    const rendered = options.prompts.render(promptId, vars, {
      version: input.promptVersion
    });
    return {
      messages: [
        { role: 'system', content: rendered.system },
        { role: 'user', content: rendered.user }
      ],
      prompt: { promptId: rendered.promptId, version: rendered.version }
    };
  }

  const payload = input.input;
  const userContent = typeof payload === 'string'
    ? payload
    : JSON.stringify(payload == null ? {} : payload);
  return {
    messages: [
      { role: 'system', content: 'LeadPages Brain. Task: ' + input.taskId },
      { role: 'user', content: userContent }
    ],
    prompt: { promptId: promptId, version: null }
  };
}

/**
 * Merge caller input + resolved context slices into prompt variables.
 * Missing declared keys are filled with empty strings by the registry caller.
 *
 * @param {import('./types').BrainGenerateInput} input
 * @param {object|null|undefined} resolvedContext
 */
function buildPromptVariables(input, resolvedContext) {
  /** @type {Record<string, unknown>} */
  const vars = {};
  const payload = input.input;
  if (typeof payload === 'string') {
    vars.question = payload;
    vars.brief = payload;
    vars.caption = payload;
  } else if (payload && typeof payload === 'object') {
    Object.assign(vars, payload);
  }

  const ctx = resolvedContext && resolvedContext.context;
  if (ctx) {
    const identity = /** @type {Record<string, unknown>} */ (ctx['site.identity'] || {});
    const brand = /** @type {Record<string, unknown>} */ (ctx['site.brand'] || {});
    const services = /** @type {Record<string, unknown>} */ (ctx['site.services'] || {});
    const areas = /** @type {Record<string, unknown>} */ (ctx['site.areas'] || {});
    if (vars.businessName == null && identity.businessName != null) {
      vars.businessName = identity.businessName;
    }
    if (vars.trade == null && identity.trade != null) vars.trade = identity.trade;
    if (vars.brandNotes == null) vars.brandNotes = brand.voiceHints || '';
    if (vars.servicesSummary == null) {
      const list = Array.isArray(services.services) ? services.services : [];
      vars.servicesSummary = list.map((s) => s && s.title).filter(Boolean).join(', ');
    }
    if (vars.region == null && Array.isArray(areas.areas)) {
      vars.region = areas.areas.slice(0, 8).join(', ');
    }
  }

  // Optional prompt fields default to empty so templates stay fail-closed only for true misses.
  const optionalDefaults = [
    'brandNotes',
    'servicesSummary',
    'helpContext',
    'region',
    'brief',
    'role',
    'suburb',
    'trade',
    'businessName',
    'question',
    'caption'
  ];
  for (const key of optionalDefaults) {
    if (vars[key] == null) vars[key] = '';
  }
  if (vars.role === '' && input.actor && input.actor.role) vars.role = input.actor.role;

  return vars;
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
