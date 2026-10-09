'use strict';

/**
 * AI Composer access: super admins only (for now), feature flag AI_COMPOSER
 * (default on; set AI_COMPOSER=0 to switch the APIs off).
 */

const { admin, requireUser } = require('../layout-composer/http');

function isComposerEnabled(env) {
  env = env || process.env;
  return String(env.AI_COMPOSER == null ? '1' : env.AI_COMPOSER).trim().toLowerCase() !== '0';
}

/**
 * @returns {Promise<{ ok: true, user: object } | { ok: false, code: number, error: string }>}
 */
async function requireSuperAdmin(req) {
  if (!isComposerEnabled()) {
    return { ok: false, code: 503, error: 'AI Composer is switched off (AI_COMPOSER=0).' };
  }
  const user = await requireUser(req);
  if (!user || !user.id) return { ok: false, code: 401, error: 'Sign in to use AI Composer.' };
  const { data, error } = await admin
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (error) return { ok: false, code: 500, error: 'Could not check your account: ' + error.message };
  if (!data || !data.is_super_admin) {
    return { ok: false, code: 403, error: 'AI Composer is limited to platform admins for now.' };
  }
  return { ok: true, user: user };
}

module.exports = { isComposerEnabled, requireSuperAdmin };
