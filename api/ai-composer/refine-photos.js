'use strict';

/**
 * POST /api/ai-composer/refine-photos
 * Body: { plan, photoIds: ['p1','p2', …] }   (up to 10 per call)
 *
 * Re-checks each photo crop with a little margin around it and returns a
 * tighter box that leaves out text, buttons, overlay panels and card borders.
 * Photos that turn out to be icons/text are dropped. Nothing is saved.
 * Super admin only. Brain task: composer.photo_check (Anthropic vision).
 */

const { sendJson, readBody } = require('../../lib/layout-composer/http');
const { requireSuperAdmin } = require('../../lib/ai-composer/access');
const { getPlatformBrain } = require('../../lib/brain/platform');
const { photoCheckMessages, PHOTO_CHECK_SCHEMA } = require('../../lib/ai-composer/prompts');
const { sanitizeClientPlan, photoCheckItems, applyPhotoCheck } = require('../../lib/ai-composer/plan');

const MAX_PER_CALL = 10;

module.exports = async function aiComposerRefinePhotos(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' });

  const access = await requireSuperAdmin(req);
  if (!access.ok) return sendJson(res, access.code, { ok: false, error: access.error });

  const body = await readBody(req);
  let plan;
  try {
    plan = sanitizeClientPlan(body.plan);
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: e.message });
  }
  const ids = (Array.isArray(body.photoIds) ? body.photoIds.map(String) : []).slice(0, MAX_PER_CALL);
  const items = photoCheckItems(plan, ids);
  if (!items.length) return sendJson(res, 400, { ok: false, error: 'No matching photos to check.' });

  const brain = getPlatformBrain();
  const result = await brain.generateStructured({
    taskId: 'composer.photo_check',
    promptId: 'composer.photo_check',
    actor: { userId: access.user.id, role: 'super' },
    messages: photoCheckMessages({ items: items }),
    temperature: 0,
    responseSchema: PHOTO_CHECK_SCHEMA
  });
  if (!result.ok) {
    return sendJson(res, 502, {
      ok: false,
      error: (result.error && result.error.message) || 'Photo check failed',
      code: result.error && result.error.code,
      correlationId: result.correlationId
    });
  }

  const applied = applyPhotoCheck(plan, items, result.output);
  const checked = {};
  items.forEach(function (i) { checked[i.id] = true; });
  return sendJson(res, 200, {
    ok: true,
    // Only the photos this call checked; the page merges them into its plan.
    photos: applied.photos.filter(function (p) { return checked[p.id]; }),
    removed: applied.removed,
    tightened: applied.tightened,
    usage: result.usage,
    correlationId: result.correlationId
  });
};
