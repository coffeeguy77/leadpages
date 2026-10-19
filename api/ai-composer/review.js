'use strict';

/**
 * POST /api/ai-composer/review
 * Body: { plan, snapshot: { imageUrl, width, height, sections }, sectionIds }
 *
 * Compares up to 3 built sections with the same sections of the design (Brain task
 * composer.visual_check) and returns a verdict per section plus the fixes AI Composer
 * may make: another layout of the same app, a background tone, the photo side, or a
 * re-fill. Nothing is saved — the page applies fixes and rebuilds (update-site).
 */

const { sendJson, readBody } = require('../../lib/layout-composer/http');
const { requireComposerAccess } = require('../../lib/ai-composer/access');
const { getPlatformBrain } = require('../../lib/brain/platform');
const { sanitizeClientPlan } = require('../../lib/ai-composer/plan');
const { visualMessages, VISUAL_SCHEMA } = require('../../lib/ai-composer/prompts');
const { reviewItems, normalizeVerdicts } = require('../../lib/ai-composer/visual');
const tiles = require('../../lib/ai-composer/tiles');

const MAX_PER_CALL = 3;

module.exports = async function aiComposerReview(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' });
  const access = await requireComposerAccess(req);
  if (!access.ok) return sendJson(res, access.code, { ok: false, error: access.error });

  const body = await readBody(req);
  let plan;
  const snap = body.snapshot || {};
  try {
    plan = sanitizeClientPlan(body.plan);
    tiles.parseUploadUrl(snap.imageUrl); // our own Cloudinary screenshots only
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: e.message });
  }
  const ids = (Array.isArray(body.sectionIds) ? body.sectionIds.map(String) : []).slice(0, MAX_PER_CALL);
  const items = reviewItems(plan, {
    imageUrl: snap.imageUrl,
    width: snap.width,
    height: snap.height,
    sections: Array.isArray(snap.sections) ? snap.sections.slice(0, 80) : []
  }, ids);
  if (!items.length) return sendJson(res, 200, { ok: true, verdicts: [] });

  const result = await getPlatformBrain().generateStructured({
    taskId: 'composer.visual_check',
    promptId: 'composer.visual_check',
    actor: access.actor,
    messages: visualMessages({ items: items }),
    temperature: 0,
    responseSchema: VISUAL_SCHEMA
  });
  if (!result.ok) {
    return sendJson(res, 502, { ok: false, error: (result.error && result.error.message) || 'Visual check failed', correlationId: result.correlationId });
  }
  return sendJson(res, 200, { ok: true, verdicts: normalizeVerdicts(result.output, plan), usage: result.usage });
};
