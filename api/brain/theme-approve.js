'use strict';

/**
 * Phase 8 — Approve theme tokens → sites.config.theme
 * POST /api/brain/theme-approve
 *   { siteId, theme }
 */

const {
  normalizeThemeTokens,
  currentThemeFromSite
} = require('../../lib/brain/theme-compose');
const {
  admin,
  json,
  readBody,
  requireUser,
  assertSiteAccess
} = require('../../lib/brain/http');
const { isThemeStudioEnabled, getPlatformBrain } = require('../../lib/brain/platform');

module.exports = async function themeApprove(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });
  if (!isThemeStudioEnabled(getPlatformBrain())) {
    return json(res, 503, { ok: false, error: 'theme_studio_disabled' });
  }

  const user = await requireUser(req);
  if (!user) return json(res, 401, { ok: false, error: 'unauthorized' });

  const body = await readBody(req);
  const siteId = String(body.siteId || '').trim();
  if (!siteId) return json(res, 400, { ok: false, error: 'siteId required' });
  if (!body.theme || typeof body.theme !== 'object') {
    return json(res, 400, { ok: false, error: 'theme object required' });
  }

  const access = await assertSiteAccess(user, siteId);
  if (!access.ok) return json(res, access.code, { ok: false, error: access.error });

  const { theme } = normalizeThemeTokens(body.theme);
  const site = access.site;
  const prev = currentThemeFromSite(site);
  const config = Object.assign({}, site.config || {});
  const existingTheme =
    config.theme && typeof config.theme === 'object' ? Object.assign({}, config.theme) : {};
  config.theme = Object.assign({}, existingTheme, theme, {
    approvedAt: new Date().toISOString(),
    approvedBy: user.id,
    source: 'theme_studio'
  });

  const { error } = await admin
    .from('sites')
    .update({ config, updated_at: new Date().toISOString() })
    .eq('id', siteId);
  if (error) {
    return json(res, 500, { ok: false, error: 'save_failed', message: error.message });
  }

  return json(res, 200, {
    ok: true,
    theme: config.theme,
    previous: prev,
    notice: 'Theme saved to site config. Open the editor Appearance panel to fine-tune.'
  });
};
