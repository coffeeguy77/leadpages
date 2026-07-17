'use strict';

const { BrainError, CODES } = require('../errors');

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

/**
 * Anthropic Messages API adapter (raw fetch — no SDK).
 * Matches existing LeadPages call shape in assist / trade-pack-utils / suburbIntro.
 *
 * @param {object} [opts]
 * @param {string} [opts.apiKey]
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {string} [opts.baseUrl]
 */
function createAnthropicAdapter(opts) {
  const options = opts || {};
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const baseUrl = options.baseUrl || ANTHROPIC_URL;

  function apiKey() {
    return options.apiKey != null ? options.apiKey : process.env.ANTHROPIC_API_KEY;
  }

  return {
    id: 'anthropic',
    capabilities() {
      return new Set(['text', 'structured_json']);
    },
    async healthCheck() {
      if (!apiKey()) return { ok: false, detail: 'ANTHROPIC_API_KEY missing' };
      if (typeof fetchImpl !== 'function') return { ok: false, detail: 'fetch unavailable' };
      return { ok: true, detail: 'configured' };
    },
    /**
     * @param {import('../types').GenerateRequest} req
     * @returns {Promise<import('../types').GenerateResult>}
     */
    async generate(req) {
      const key = apiKey();
      if (!key) {
        throw new BrainError(CODES.provider_auth, 'ANTHROPIC_API_KEY is not configured');
      }
      if (typeof fetchImpl !== 'function') {
        throw new BrainError(CODES.provider_unavailable, 'fetch is not available in this runtime');
      }
      if (!req || !req.model || req.model.provider !== 'anthropic') {
        throw new BrainError(CODES.bad_request, 'Anthropic adapter requires model.provider=anthropic');
      }

      const { system, messages } = splitSystem(req.messages || []);
      const maxTokens = req.maxTokens != null ? req.maxTokens : 1024;
      const body = {
        model: req.model.model,
        max_tokens: maxTokens,
        messages
      };
      if (system) body.system = system;
      if (typeof req.temperature === 'number') body.temperature = req.temperature;
      if (req.responseSchema) {
        // Prompt-enforced JSON (same approach as existing pack/enrich callers).
        body.system = (body.system ? body.system + '\n\n' : '') +
          'Respond with valid JSON only that matches the required schema. No markdown fences.\n' +
          'Schema:\n' + JSON.stringify(req.responseSchema);
      }

      const started = Date.now();
      let response;
      try {
        const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutMs = req.timeoutMs != null ? req.timeoutMs : 60000;
        const timer = ac ? setTimeout(() => ac.abort(), timeoutMs) : null;
        try {
          response = await fetchImpl(baseUrl, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-api-key': key,
              'anthropic-version': ANTHROPIC_VERSION
            },
            body: JSON.stringify(body),
            signal: ac ? ac.signal : undefined
          });
        } finally {
          if (timer) clearTimeout(timer);
        }
      } catch (err) {
        if (err && (err.name === 'AbortError' || /aborted/i.test(String(err.message || '')))) {
          throw new BrainError(CODES.provider_timeout, 'Anthropic request timed out', {
            retryable: true,
            cause: err
          });
        }
        throw new BrainError(CODES.provider_unavailable, 'Anthropic network error', {
          retryable: true,
          cause: err
        });
      }

      const latencyMs = Date.now() - started;
      let data = null;
      try {
        data = await response.json();
      } catch (err) {
        throw new BrainError(CODES.invalid_output, 'Anthropic returned non-JSON body', {
          retryable: true,
          cause: err
        });
      }

      if (!response.ok) {
        throw mapAnthropicHttpError(response.status, data);
      }

      const text = (data.content || [])
        .filter((b) => b && b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();

      let json;
      if (req.responseSchema) {
        json = extractJson(text);
      }

      const usage = {
        inputTokens: data.usage && data.usage.input_tokens,
        outputTokens: data.usage && data.usage.output_tokens,
        cachedTokens: data.usage && (data.usage.cache_read_input_tokens || 0)
      };

      return {
        text,
        json,
        usage,
        providerRequestId: data.id || undefined,
        latencyMs,
        model: { provider: 'anthropic', model: req.model.model }
      };
    }
  };
}

/**
 * @param {import('../types').BrainMessage[]} messages
 */
function splitSystem(messages) {
  const systemParts = [];
  const rest = [];
  for (const m of messages) {
    if (m.role === 'system') systemParts.push(String(m.content || ''));
    else rest.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') });
  }
  // Anthropic requires alternating user/assistant and starting with user.
  if (!rest.length) rest.push({ role: 'user', content: '' });
  if (rest[0].role !== 'user') rest.unshift({ role: 'user', content: '(continue)' });
  return { system: systemParts.filter(Boolean).join('\n\n') || undefined, messages: rest };
}

/**
 * @param {number} status
 * @param {any} data
 */
function mapAnthropicHttpError(status, data) {
  const detail = (data && data.error && data.error.message) || ('HTTP ' + status);
  if (status === 401 || status === 403) {
    return new BrainError(CODES.provider_auth, detail, { details: { status } });
  }
  if (status === 429) {
    return new BrainError(CODES.provider_rate_limit, detail, { retryable: true, details: { status } });
  }
  if (status >= 500) {
    return new BrainError(CODES.provider_unavailable, detail, { retryable: true, details: { status } });
  }
  return new BrainError(CODES.provider_unavailable, detail, { details: { status } });
}

/**
 * @param {string} text
 */
function extractJson(text) {
  const raw = String(text || '').trim();
  try {
    return JSON.parse(raw);
  } catch (_) {
    /* continue */
  }
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch (_) {
      /* continue */
    }
  }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch (_) {
      /* continue */
    }
  }
  throw new BrainError(CODES.invalid_output, 'Anthropic structured response was not valid JSON', {
    retryable: true
  });
}

module.exports = { createAnthropicAdapter, extractJson, mapAnthropicHttpError };
