/**
 * Soft lead-spam heuristics for /api/leads.
 * Always pair with HTTP 200 so visitors never see a bounce.
 *
 * Dedicated honeypot field names only.
 * Do NOT include "website" — many real lead forms collect an existing-website URL.
 */

const HONEYPOT_KEYS = ['lp_hp', 'hp', 'honeypot', '_gotcha'];

const MIN_MS = Math.max(500, parseInt(process.env.LEADS_MIN_MS || '1200', 10) || 1200);

function filled(v) {
  return v != null && String(v).trim() !== '';
}

/**
 * Soft spam signals for lead ingest.
 * - Dedicated honeypot filled → reject store
 * - Submitted too fast (< MIN_MS) when `_t` present → reject store
 * - Name that is clearly a URL → reject store
 *
 * Missing honeypot / `_t` (old cached pages) is allowed so we do not break legit submits.
 * Never throws; returns { spam: boolean, reason?: string }.
 *
 * @param {object} body
 * @returns {{ spam: boolean, reason?: string }}
 */
function assessLeadSpam(body) {
  const b = body && typeof body === 'object' ? body : {};

  for (let i = 0; i < HONEYPOT_KEYS.length; i++) {
    const k = HONEYPOT_KEYS[i];
    if (filled(b[k])) return { spam: true, reason: 'honeypot' };
  }

  // Nested details may carry honeypot from FormData dumps
  const details = b.details && typeof b.details === 'object' ? b.details : {};
  for (let i = 0; i < HONEYPOT_KEYS.length; i++) {
    const k = HONEYPOT_KEYS[i];
    if (filled(details[k])) return { spam: true, reason: 'honeypot_details' };
  }

  const started = parseInt(b._t || b.formStartedAt || b.ts, 10);
  if (!isNaN(started) && started > 0) {
    const elapsed = Date.now() - started;
    // Ignore obviously broken clocks (far future / ancient)
    if (elapsed >= 0 && elapsed < MIN_MS) {
      return { spam: true, reason: 'too_fast' };
    }
  }

  // Classic bot: name field is a URL
  const name = String(b.name || b.fullName || '').trim();
  if (/^https?:\/\//i.test(name) || /^www\./i.test(name)) {
    return { spam: true, reason: 'name_url' };
  }

  return { spam: false };
}

module.exports = {
  HONEYPOT_KEYS,
  MIN_MS,
  assessLeadSpam
};
