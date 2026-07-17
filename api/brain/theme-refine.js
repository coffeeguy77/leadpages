'use strict';

/**
 * Phase 8 — Theme Studio refine.
 * POST /api/brain/theme-refine
 *   { siteId, feedback, currentTheme? }
 */

const { getPlatformBrain, isThemeStudioEnabled } = require('../../lib/brain/platform');
const {
  THEME_REFINE_SCHEMA,
  normalizeThemeTokens,
  currentThemeFromSite
} = require('../../lib/brain/theme-compose');
const { json, readBody, requireUser, assertSiteAccess } = require('../../lib/brain/http');

module.exports = async function themeRefine(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });

  const brain = getPlatformBrain();
  if (!isThemeStudioEnabled(brain)) {
    return json(res, 503, {
      ok: false,
      error: 'theme_studio_disabled',
      message: 'Theme Studio is disabled.'
    });
  }

  const user = await requireUser(req);
  if (!user) return json(res, 401, { ok: false, error: 'unauthorized' });

  const body = await readBody(req);
  const siteId = String(body.siteId || '').trim();
  const feedback = String(body.feedback || '').trim();
  if (!siteId) return json(res, 400, { ok: false, error: 'siteId required' });
  if (!feedback) return json(res, 400, { ok: false, error: 'feedback required' });

  const access = await assertSiteAccess(user, siteId);
  if (!access.ok) return json(res, access.code, { ok: false, error: access.error });

  const site = access.site;
  const current =
    body.currentTheme && typeof body.currentTheme === 'object'
      ? normalizeThemeTokens(body.currentTheme).theme
      : currentThemeFromSite(site);

  const result = await brain.generateStructured({
    taskId: 'theme.refine',
    promptId: 'theme.refine',
    siteId: site.id,
    site,
    actor: { userId: user.id, role: access.role, partnerId: access.partnerId },
    contextSlices: ['site.identity', 'site.brand'],
    temperature: 0.55,
    input: {
      feedback: feedback.slice(0, 800),
      currentTheme: JSON.stringify(current)
    },
    responseSchema: THEME_REFINE_SCHEMA
  });

  if (!result.ok) {
    return json(res, 502, {
      ok: false,
      error: (result.error && result.error.code) || 'brain_failed',
      message: (result.error && result.error.message) || 'Theme refine failed',
      correlationId: result.correlationId
    });
  }

  const { theme, rationale } = normalizeThemeTokens(result.output);
  return json(res, 200, {
    ok: true,
    theme,
    rationale,
    previous: current,
    usage: result.usage,
    model: result.model,
    correlationId: result.correlationId,
    notice: 'Refined suggestion — Approve to save to the site theme.'
  });
};
