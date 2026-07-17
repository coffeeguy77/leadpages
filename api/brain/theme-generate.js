'use strict';

/**
 * Phase 8 — Theme Studio generate.
 * POST /api/brain/theme-generate
 *   { siteId, brief?, mood? }
 */

const { getPlatformBrain, isThemeStudioEnabled } = require('../../lib/brain/platform');
const {
  THEME_TOKEN_SCHEMA,
  normalizeThemeTokens
} = require('../../lib/brain/theme-compose');
const { json, readBody, requireUser, assertSiteAccess } = require('../../lib/brain/http');

module.exports = async function themeGenerate(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });

  const brain = getPlatformBrain();
  if (!isThemeStudioEnabled(brain)) {
    return json(res, 503, {
      ok: false,
      error: 'theme_studio_disabled',
      message: 'Set BRAIN_THEME_STUDIO=1 (default) or remove =0 to enable Theme Studio.'
    });
  }

  const user = await requireUser(req);
  if (!user) return json(res, 401, { ok: false, error: 'unauthorized' });

  const body = await readBody(req);
  const siteId = String(body.siteId || '').trim();
  if (!siteId) return json(res, 400, { ok: false, error: 'siteId required' });

  const access = await assertSiteAccess(user, siteId);
  if (!access.ok) return json(res, access.code, { ok: false, error: access.error });

  const site = access.site;
  const cfg = site.config || {};
  const result = await brain.generateStructured({
    taskId: 'theme.generate',
    promptId: 'theme.generate',
    siteId: site.id,
    site,
    actor: { userId: user.id, role: access.role, partnerId: access.partnerId },
    contextSlices: ['site.identity', 'site.brand'],
    temperature: 0.65,
    input: {
      brief: String(body.brief || '').trim().slice(0, 800),
      mood: String(body.mood || 'professional trade, high contrast').trim().slice(0, 200),
      brandNotes: cfg.brandVoice || ''
    },
    responseSchema: THEME_TOKEN_SCHEMA
  });

  if (!result.ok) {
    return json(res, 502, {
      ok: false,
      error: (result.error && result.error.code) || 'brain_failed',
      message: (result.error && result.error.message) || 'Theme generation failed',
      correlationId: result.correlationId
    });
  }

  const { theme, rationale } = normalizeThemeTokens(result.output);
  return json(res, 200, {
    ok: true,
    theme,
    rationale,
    usage: result.usage,
    model: result.model,
    correlationId: result.correlationId,
    notice: 'AI suggests — preview swatches, then Approve to write sites.config.theme.'
  });
};
