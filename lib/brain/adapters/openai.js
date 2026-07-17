'use strict';

const { BrainError, CODES } = require('../errors');
const {
  mapProviderHttpError,
  extractJson,
  toChatMessages,
  fetchWithTimeout,
  mapNetworkError
} = require('./shared');

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * OpenAI Chat Completions adapter (raw fetch — no SDK).
 * @param {object} [opts]
 * @param {string} [opts.apiKey]
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {string} [opts.baseUrl]
 */
function createOpenAIAdapter(opts) {
  const options = opts || {};
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const baseUrl = options.baseUrl || OPENAI_URL;

  function apiKey() {
    return options.apiKey != null ? options.apiKey : process.env.OPENAI_API_KEY;
  }

  return {
    id: 'openai',
    capabilities() {
      return new Set(['text', 'structured_json']);
    },
    async healthCheck() {
      if (!apiKey()) return { ok: false, detail: 'OPENAI_API_KEY missing' };
      if (typeof fetchImpl !== 'function') return { ok: false, detail: 'fetch unavailable' };
      return { ok: true, detail: 'configured' };
    },
    /**
     * @param {import('../types').GenerateRequest} req
     */
    async generate(req) {
      const key = apiKey();
      if (!key) {
        throw new BrainError(CODES.provider_auth, 'OPENAI_API_KEY is not configured');
      }
      if (typeof fetchImpl !== 'function') {
        throw new BrainError(CODES.provider_unavailable, 'fetch is not available in this runtime');
      }
      if (!req || !req.model || req.model.provider !== 'openai') {
        throw new BrainError(CODES.bad_request, 'OpenAI adapter requires model.provider=openai');
      }

      const messages = toChatMessages(req.messages || []);
      if (req.responseSchema) {
        messages.unshift({
          role: 'system',
          content:
            'Respond with valid JSON only that matches the required schema. No markdown fences.\n' +
            'Schema:\n' + JSON.stringify(req.responseSchema)
        });
      }

      const body = {
        model: req.model.model,
        messages,
        max_tokens: req.maxTokens != null ? req.maxTokens : 1024
      };
      if (typeof req.temperature === 'number') body.temperature = req.temperature;
      if (req.responseSchema) body.response_format = { type: 'json_object' };

      const started = Date.now();
      let response;
      try {
        response = await fetchWithTimeout(
          fetchImpl,
          baseUrl,
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: 'Bearer ' + key
            },
            body: JSON.stringify(body)
          },
          req.timeoutMs != null ? req.timeoutMs : 60000
        );
      } catch (err) {
        throw mapNetworkError(err, 'OpenAI');
      }

      const latencyMs = Date.now() - started;
      let data = null;
      try {
        data = await response.json();
      } catch (err) {
        throw new BrainError(CODES.invalid_output, 'OpenAI returned non-JSON body', {
          retryable: true,
          cause: err
        });
      }

      if (!response.ok) {
        throw mapProviderHttpError(response.status, data, 'OpenAI');
      }

      const choice = data.choices && data.choices[0];
      const text = String(
        (choice && choice.message && choice.message.content) || ''
      ).trim();

      let json;
      if (req.responseSchema) {
        json = extractJson(text, 'OpenAI');
      }

      const usage = {
        inputTokens: data.usage && data.usage.prompt_tokens,
        outputTokens: data.usage && data.usage.completion_tokens,
        cachedTokens: data.usage && data.usage.prompt_tokens_details
          ? data.usage.prompt_tokens_details.cached_tokens || 0
          : 0
      };

      return {
        text,
        json,
        usage,
        providerRequestId: data.id || undefined,
        latencyMs,
        model: { provider: 'openai', model: req.model.model }
      };
    }
  };
}

module.exports = { createOpenAIAdapter };
