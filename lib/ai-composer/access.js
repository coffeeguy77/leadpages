'use strict';

/**
 * AI Composer access.
 *
 *   super admin        → full mode (every feature, sites created live or as drafts)
 *   trusted partner    → full mode (partners.composer_access = 'trusted')
 *   active partner     → standard mode (partners.composer_access = 'standard', the default)
 *   composer_access 'off', inactive partners, everyone else → no access
 *
 * Partners' sites are always created as partner demo sites (draft, behind the
 * "Get this website" buy bar) — never live without payment.
 *
 * Flags: AI_COMPOSER=0 switches the APIs off for everyone; AI_COMPOSER_PARTNERS=0
 * limits it to super admins. Monthly analysis limits per partner:
 * partners.composer_monthly_limit, else AI_COMPOSER_PARTNER_MONTHLY (default 15) for
 * standard and AI_COMPOSER_TRUSTED_MONTHLY (default 60) for trusted partners.
 */

const { admin, requireUser } = require('../layout-composer/http');

const DEFAULT_PARTNER_MONTHLY = 15;
const DEFAULT_TRUSTED_MONTHLY = 60;

function flagOn(v, dflt) {
  return String(v == null ? (dflt ? '1' : '0') : v).trim().toLowerCase() !== '0';
}
function isComposerEnabled(env) {
  env = env || process.env;
  return flagOn(env.AI_COMPOSER, true);
}
function partnersEnabled(env) {
  env = env || process.env;
  return flagOn(env.AI_COMPOSER_PARTNERS, true);
}

/**
 * @typedef {{ ok: true, user: object, role: 'super'|'partner', full: boolean, partner: object|null,
 *   actor: { userId: string, role: string, partnerId?: string } }} ComposerAccess
 * @param {object} req
 * @param {{ full?: boolean }} [opts] full: require full mode (super admin or trusted partner)
 * @returns {Promise<ComposerAccess | { ok: false, code: number, error: string }>}
 */
async function requireComposerAccess(req, opts) {
  opts = opts || {};
  if (!isComposerEnabled()) {
    return { ok: false, code: 503, error: 'AI Composer is switched off (AI_COMPOSER=0).' };
  }
  const user = await requireUser(req);
  if (!user || !user.id) return { ok: false, code: 401, error: 'Sign in to use AI Composer.' };

  const prof = await admin.from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle();
  if (prof.error) return { ok: false, code: 500, error: 'Could not check your account: ' + prof.error.message };
  if (prof.data && prof.data.is_super_admin) {
    return { ok: true, user: user, role: 'super', full: true, partner: null, actor: { userId: user.id, role: 'super' } };
  }

  if (!partnersEnabled()) {
    return { ok: false, code: 403, error: 'AI Composer is limited to platform admins for now.' };
  }
  const pr = await admin.from('partners').select('*').eq('user_id', user.id).maybeSingle();
  if (pr.error) return { ok: false, code: 500, error: 'Could not check your partner account: ' + pr.error.message };
  const partner = pr.data;
  if (!partner) return { ok: false, code: 403, error: 'AI Composer is available to LeadPages partners.' };
  if (partner.status !== 'active') return { ok: false, code: 403, error: 'Your partner account is ' + partner.status + '.' };
  const level = String(partner.composer_access || 'standard').toLowerCase();
  if (level === 'off') return { ok: false, code: 403, error: 'AI Composer is not switched on for your partner account.' };
  const full = level === 'trusted';
  if (opts.full && !full) {
    return { ok: false, code: 403, error: 'This part of AI Composer is for trusted partners. Ask LeadPages to switch it on.' };
  }
  return {
    ok: true, user: user, role: 'partner', full: full, partner: partner,
    actor: { userId: user.id, role: 'partner', partnerId: partner.id }
  };
}

/** Super admins only (kept for callers that need it). */
async function requireSuperAdmin(req) {
  const a = await requireComposerAccess(req);
  if (!a.ok) return a;
  if (a.role !== 'super') return { ok: false, code: 403, error: 'AI Composer is limited to platform admins for now.' };
  return a;
}

/** This partner's monthly design-analysis limit. */
function monthlyLimit(access, env) {
  env = env || process.env;
  const p = access.partner || {};
  const own = Number(p.composer_monthly_limit);
  if (Number.isFinite(own) && own >= 0) return Math.floor(own);
  const n = Number(access.full ? env.AI_COMPOSER_TRUSTED_MONTHLY : env.AI_COMPOSER_PARTNER_MONTHLY);
  if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  return access.full ? DEFAULT_TRUSTED_MONTHLY : DEFAULT_PARTNER_MONTHLY;
}

/**
 * Partners: has this month's analysis limit been reached? (Counts composer.design_plan
 * Brain calls logged against the partner since the 1st of the month, UTC.)
 * Super admins are never limited.
 * @returns {Promise<{ ok: true, used: number, limit: number|null } | { ok: false, code: number, error: string, used: number, limit: number }>}
 */
async function checkMonthlyLimit(access, now) {
  if (access.role !== 'partner') return { ok: true, used: 0, limit: null };
  const limit = monthlyLimit(access);
  const d = now ? new Date(now) : new Date();
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
  const r = await admin
    .from('ai_requests')
    .select('id', { count: 'exact', head: true })
    .eq('partner_id', access.partner.id)
    .in('task_id', ['composer.design_plan', 'composer.url_plan'])
    .gte('created_at', start);
  if (r.error) return { ok: false, code: 500, error: 'Could not check your AI Composer usage: ' + r.error.message, used: 0, limit: limit };
  const used = r.count || 0;
  if (used >= limit) {
    return { ok: false, code: 429, error: 'You have used all ' + limit + ' AI Composer designs for this month. It resets on the 1st — or ask LeadPages for a higher limit.', used: used, limit: limit };
  }
  return { ok: true, used: used, limit: limit };
}

/**
 * May this account change this site through AI Composer? Super admins: any site.
 * Partners: their own demo/client sites (referring or servicing partner).
 * Either way the site must have been built by AI Composer.
 */
function canComposeSite(access, site) {
  if (!site || !site.config || !site.config._aiComposer) return false;
  if (access.role === 'super') return true;
  const pid = access.partner && access.partner.id;
  return !!pid && (site.referring_partner_id === pid || site.servicing_partner_id === pid);
}

module.exports = {
  canComposeSite,
  isComposerEnabled,
  partnersEnabled,
  requireComposerAccess,
  requireSuperAdmin,
  monthlyLimit,
  checkMonthlyLimit,
  DEFAULT_PARTNER_MONTHLY,
  DEFAULT_TRUSTED_MONTHLY
};
