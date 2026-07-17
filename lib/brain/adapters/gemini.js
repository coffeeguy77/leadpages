'use strict';

const { BrainError, CODES } = require('../errors');
const {
  mapProviderHttpError,
  extractJson,
  splitSystem,
  fetchWithTimeout,
  mapNetworkError
} = require('./shared');

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Google Gemini generateContent adapter (raw fetch — no SDK).
 * @param {object} [opts]
 * @param {string} [opts.apiKey]
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {string} [opts.baseUrl]
 */
function createGeminiAdapter(opts) {
  const options = opts || {};
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const baseUrl = options.baseUrl || GEMINI_BASE;

  function apiKey() {
    return options.apiKey != null
      ? options.apiKey
      : (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY);
  }

  return {
    id: 'gemini',
    capabilities() {
      return new Set(['text', 'structured_json']);
    },
    async healthCheck() {
      if (!apiKey()) return { ok: false, detail: 'GEMINI_API_KEY missing' };
      if (typeof fetchImpl !== 'function') return { ok: false, detail: 'fetch unavailable' };
      return { ok: true, detail: 'configured' };
    },
    /**
     * @param {import('../types').GenerateRequest} req
     */
    async generate(req) {
      const key = apiKey();
      if (!key) {
        throw new BrainError(CODES.provider_auth, 'GEMINI_API_KEY is not configured');
      }
      if (typeof fetchImpl !== 'function') {
        throw new BrainError(CODES.provider_unavailable, 'fetch is not available in this runtime');
      }
      if (!req || !req.model || req.model.provider !== 'gemini') {
        throw new BrainError(CODES.bad_request, 'Gemini adapter requires model.provider=gemini');
      }

      const { system, messages } = splitSystem(req.messages || []);
      let systemText = system || '';
      if (req.responseSchema) {
        systemText = (systemText ? systemText + '\n\n' : '') +
          'Respond with valid JSON only that matches the required schema. No markdown fences.\n' +
          'Schema:\n' + JSON.stringify(req.responseSchema);
      }

      const contents = (messages.length ? messages : [{ role: 'user', content: '' }]).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content || '') }]
      }));
      // Gemini requires alternating user/model and typically starts with user.
      if (contents[0].role !== 'user') {
        contents.unshift({ role: 'user', parts: [{ text: '(continue)' }] });
      }

      const body = {
        contents,
        generationConfig: {
          maxOutputTokens: req.maxTokens != null ? req.maxTokens : 1024
        }
      };
      if (typeof req.temperature === 'number') body.generationConfig.temperature = req.temperature;
      if (systemText) {
        body.systemInstruction = { parts: [{ text: systemText }] };
      }
      if (req.responseSchema) {
        body.generationConfig.responseMimeType = 'application/json';
      }

      const url =
        String(baseUrl).replace(/\/$/, '') +
        '/' +
        encodeURIComponent(req.model.model) +
        ':generateContent?key=' +
        encodeURIComponent(key);

      const started = Date.now();
      let response;
      try {
        response = await fetchWithTimeout(
          fetchImpl,
          url,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body)
          },
          req.timeoutMs != null ? req.timeoutMs : 60000
        );
      } catch (err) {
        throw mapNetworkError(err, 'Gemini');
      }

      const latencyMs = Date.now() - started;
      let data = null;
      try {
        data = await response.json();
      } catch (err) {
        throw new BrainError(CODES.invalid_output, 'Gemini returned non-JSON body', {
          retryable: true,
          cause: err
        });
      }

      if (!response.ok) {
        throw mapProviderHttpError(response.status, data, 'Gemini');
      }

      const blockReason =
        data.promptFeedback && data.promptFeedback.blockReason;
      if (blockReason) {
        throw new BrainError(
          CODES.provider_content_filter,
          'Gemini blocked prompt: ' + blockReason,
          { details: { blockReason } }
        );
      }

      const candidate = data.candidates && data.candidates[0];
      const parts = candidate && candidate.content && candidate.content.parts;
      const text = (Array.isArray(parts) ? parts : [])
        .map((p) => (p && p.text) || '')
        .join('\n')
        .trim();

      let json;
      if (req.responseSchema) {
        json = extractJson(text, 'Gemini');
      }

      const usageMeta = data.usageMetadata || {};
      const usage = {
        inputTokens: usageMeta.promptTokenCount,
        outputTokens: usageMeta.candidatesTokenCount,
        cachedTokens: usageMeta.cachedContentTokenCount || 0
      };

      return {
        text,
        json,
        usage,
        providerRequestId: undefined,
        latencyMs,
        model: { provider: 'gemini', model: req.model.model }
      };
    }
  };
}

module.exports = { createGeminiAdapter };
