/**
 * Soft Vercel project domain-quota helpers.
 * Never used to block publish — awareness for ops before plan limits bite.
 *
 * Env:
 *   VERCEL_DOMAIN_SOFT_LIMIT  (default 80; 0 disables warn)
 *   VERCEL_DOMAIN_HARD_LIMIT  (default 100; 0 disables critical)
 */

function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === '') return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function quotaLimits() {
  return {
    softLimit: envInt('VERCEL_DOMAIN_SOFT_LIMIT', 80),
    hardLimit: envInt('VERCEL_DOMAIN_HARD_LIMIT', 100)
  };
}

/**
 * @param {number} count
 * @param {{ softLimit?: number, hardLimit?: number }} [opts]
 * @returns {{ decision: 'ok'|'warn'|'critical', count: number, softLimit: number|null, hardLimit: number|null, message?: string }}
 */
function evaluateDomainQuota(count, opts) {
  const limits = opts || {};
  const soft = Number(limits.softLimit);
  const hard = Number(limits.hardLimit);
  const softOn = Number.isFinite(soft) && soft > 0;
  const hardOn = Number.isFinite(hard) && hard > 0;
  const c = Math.max(0, Number(count) || 0);

  const softLimit = softOn ? soft : null;
  const hardLimit = hardOn ? hard : null;

  if (hardOn && c >= hard) {
    return {
      decision: 'critical',
      count: c,
      softLimit,
      hardLimit,
      message:
        'Vercel project has ' +
        c +
        ' domains (hard awareness at ' +
        hard +
        '). Raise the Vercel plan limit or prune unused domains before attaching more. Saving custom_domain is still allowed.'
    };
  }
  if (softOn && c >= soft) {
    return {
      decision: 'warn',
      count: c,
      softLimit,
      hardLimit,
      message:
        'Approaching Vercel domain capacity: ' +
        c +
        ' / soft ' +
        soft +
        '. Plan headroom before client onboarding accelerates.'
    };
  }
  return { decision: 'ok', count: c, softLimit, hardLimit };
}

module.exports = {
  quotaLimits,
  evaluateDomainQuota
};
