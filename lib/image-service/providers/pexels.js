'use strict';

const { ENV_PEXELS_API_KEY } = require('../constants');

/**
 * Server-side Pexels stock provider.
 * Never expose PEXELS_API_KEY to the browser.
 */

function getApiKey() {
  return String(process.env[ENV_PEXELS_API_KEY] || '').trim();
}

function isConfigured() {
  return !!getApiKey();
}

/**
 * @param {object} opts
 * @param {string} opts.query
 * @param {string} [opts.orientation] landscape|portrait|square
 * @param {number} [opts.perPage]
 * @param {number} [opts.page]
 * @param {typeof fetch} [opts.fetchImpl]
 */
async function searchPexels(opts) {
  const options = opts || {};
  const key = getApiKey();
  if (!key) {
    return {
      ok: false,
      error: 'pexels_not_configured',
      message: 'PEXELS_API_KEY is not set',
      results: []
    };
  }

  const query = String(options.query || '').trim();
  if (!query) {
    return { ok: false, error: 'query_required', results: [] };
  }

  const params = new URLSearchParams();
  params.set('query', query);
  params.set('per_page', String(Math.min(40, Math.max(1, options.perPage || 12))));
  params.set('page', String(Math.max(1, options.page || 1)));
  if (options.orientation) params.set('orientation', options.orientation);

  const fetchImpl = options.fetchImpl || global.fetch;
  if (typeof fetchImpl !== 'function') {
    return { ok: false, error: 'fetch_unavailable', results: [] };
  }

  const timeoutMs = Math.max(
    500,
    Math.min(15000, Number(options.timeoutMs || process.env.PEXELS_TIMEOUT_MS || 4000) || 4000)
  );
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timedOut = false;
  let abortTimer = null;
  let raceTimer = null;
  abortTimer = setTimeout(function () {
    timedOut = true;
    if (controller) {
      try {
        controller.abort();
      } catch (_e) {
        /* ignore */
      }
    }
  }, timeoutMs);

  let res;
  try {
    const fetchPromise = fetchImpl('https://api.pexels.com/v1/search?' + params.toString(), {
      headers: { Authorization: key },
      signal: controller ? controller.signal : undefined
    });
    // Race even if fetchImpl ignores AbortSignal (common in tests / some polyfills)
    res = await Promise.race([
      Promise.resolve(fetchPromise),
      new Promise(function (_resolve, reject) {
        raceTimer = setTimeout(function () {
          const err = new Error('pexels_timeout');
          err.name = 'AbortError';
          reject(err);
        }, timeoutMs + 10);
      })
    ]);
  } catch (e) {
    const aborted = timedOut || (e && e.name === 'AbortError') || (e && e.message === 'pexels_timeout');
    return {
      ok: false,
      error: aborted ? 'pexels_timeout' : 'pexels_network_error',
      message: aborted ? 'Pexels request timed out' : 'Pexels request failed',
      results: []
    };
  } finally {
    if (abortTimer) clearTimeout(abortTimer);
    if (raceTimer) clearTimeout(raceTimer);
  }

  if (res.status === 429) {
    return { ok: false, error: 'pexels_rate_limited', message: 'Pexels rate limit', results: [] };
  }
  if (!res.ok) {
    return {
      ok: false,
      error: 'pexels_http_' + res.status,
      message: 'Pexels search failed',
      results: []
    };
  }

  let body;
  try {
    body = await res.json();
  } catch (_e) {
    return { ok: false, error: 'pexels_invalid_json', message: 'Pexels returned invalid JSON', results: [] };
  }
  const photos = Array.isArray(body.photos) ? body.photos : [];
  const results = photos.map((p) => ({
    provider: 'pexels',
    providerAssetId: String(p.id),
    photographerName: p.photographer || '',
    photographerProfileUrl: p.photographer_url || '',
    sourcePageUrl: p.url || '',
    sourceImageUrl: (p.src && (p.src.large2x || p.src.large || p.src.original)) || '',
    originalWidth: p.width || 0,
    originalHeight: p.height || 0,
    orientation:
      p.width && p.height ? (p.width >= p.height ? 'landscape' : 'portrait') : options.orientation || 'unknown',
    alt: p.alt || query,
    urls: {
      original: p.src && p.src.original,
      large: p.src && p.src.large,
      large2x: p.src && p.src.large2x,
      medium: p.src && p.src.medium,
      small: p.src && p.src.small,
      tiny: p.src && p.src.tiny
    }
  }));

  return {
    ok: true,
    results,
    page: body.page,
    perPage: body.per_page,
    totalResults: body.total_results
  };
}

module.exports = {
  searchPexels,
  isConfigured,
  getApiKey: () => (getApiKey() ? '[set]' : '')
};
