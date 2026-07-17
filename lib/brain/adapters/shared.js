'use strict';

const { BrainError, CODES } = require('../errors');

/**
 * @param {number} status
 * @param {any} data
 * @param {string} [providerLabel]
 */
function mapProviderHttpError(status, data, providerLabel) {
  const label = providerLabel || 'Provider';
  const detail =
    (data && data.error && (data.error.message || data.error.status)) ||
    (data && data.message) ||
    ('HTTP ' + status);
  if (status === 401 || status === 403) {
    return new BrainError(CODES.provider_auth, label + ': ' + detail, { details: { status } });
  }
  if (status === 429) {
    return new BrainError(CODES.provider_rate_limit, label + ': ' + detail, {
      retryable: true,
      details: { status }
    });
  }
  if (status === 400 && /content|safety|filter|blocked/i.test(String(detail))) {
    return new BrainError(CODES.provider_content_filter, label + ': ' + detail, {
      details: { status }
    });
  }
  if (status >= 500) {
    return new BrainError(CODES.provider_unavailable, label + ': ' + detail, {
      retryable: true,
      details: { status }
    });
  }
  return new BrainError(CODES.provider_unavailable, label + ': ' + detail, { details: { status } });
}

/**
 * @param {string} text
 * @param {string} [providerLabel]
 */
function extractJson(text, providerLabel) {
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
  throw new BrainError(
    CODES.invalid_output,
    (providerLabel || 'Provider') + ' structured response was not valid JSON',
    { retryable: true }
  );
}

/**
 * Split system messages for chat-style APIs that keep system as a role.
 * @param {import('../types').BrainMessage[]} messages
 */
function toChatMessages(messages) {
  return (messages || []).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
    content: String(m.content || '')
  }));
}

/**
 * @param {import('../types').BrainMessage[]} messages
 */
function splitSystem(messages) {
  const systemParts = [];
  const rest = [];
  for (const m of messages || []) {
    if (m.role === 'system') systemParts.push(String(m.content || ''));
    else rest.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') });
  }
  return {
    system: systemParts.filter(Boolean).join('\n\n') || undefined,
    messages: rest
  };
}

/**
 * @param {typeof fetch} fetchImpl
 * @param {string} url
 * @param {object} init
 * @param {number} timeoutMs
 */
async function fetchWithTimeout(fetchImpl, url, init, timeoutMs) {
  const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ac ? setTimeout(() => ac.abort(), timeoutMs) : null;
  try {
    return await fetchImpl(url, Object.assign({}, init, { signal: ac ? ac.signal : undefined }));
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * @param {unknown} err
 * @param {string} providerLabel
 */
function mapNetworkError(err, providerLabel) {
  if (err && (err.name === 'AbortError' || /aborted/i.test(String(err.message || '')))) {
    return new BrainError(CODES.provider_timeout, providerLabel + ' request timed out', {
      retryable: true,
      cause: err
    });
  }
  return new BrainError(CODES.provider_unavailable, providerLabel + ' network error', {
    retryable: true,
    cause: err
  });
}

module.exports = {
  mapProviderHttpError,
  extractJson,
  toChatMessages,
  splitSystem,
  fetchWithTimeout,
  mapNetworkError
};
