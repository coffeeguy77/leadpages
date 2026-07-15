// api/_rate-limit.js — tiny in-memory sliding-window IP limiter (shared module, not a route).
// Same pattern as domains/availability.js. Best-effort on serverless (per-instance).

const BUCKETS = new Map();

function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  if (xf) return xf.slice(0, 64);
  const real = String(req.headers['x-real-ip'] || '').trim();
  if (real) return real.slice(0, 64);
  return 'unknown';
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {{ max?: number, windowMs?: number, key?: string }} opts
 * @returns {boolean} true if the request should be rejected
 */
function limited(req, opts) {
  opts = opts || {};
  const max = opts.max == null ? 60 : opts.max;
  const windowMs = opts.windowMs == null ? 60000 : opts.windowMs;
  const prefix = opts.key || 'default';
  const ip = clientIp(req);
  const bucketKey = prefix + ':' + ip;
  const now = Date.now();
  const hits = (BUCKETS.get(bucketKey) || []).filter(function (t) { return now - t < windowMs; });
  hits.push(now);
  BUCKETS.set(bucketKey, hits);
  // Opportunistic cleanup so Maps do not grow forever on warm lambdas
  if (BUCKETS.size > 5000) {
    for (const [k, arr] of BUCKETS) {
      const keep = (arr || []).filter(function (t) { return now - t < windowMs; });
      if (!keep.length) BUCKETS.delete(k);
      else BUCKETS.set(k, keep);
    }
  }
  return hits.length > max;
}

module.exports = { limited, clientIp };
