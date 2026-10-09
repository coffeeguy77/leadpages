'use strict';

/**
 * POST /api/ai-composer/analyse
 * Body: { imageUrl, width, height, notes? }
 *
 * Reads a design image (already uploaded to Cloudinary under leadpages/) and
 * returns a plan: which LeadPages apps recreate each section, colours, business
 * details, photo crops and gaps. Nothing is saved.
 * Super admin only. Brain task: composer.design_plan (Anthropic vision).
 */

const { sendJson, readBody } = require('../../lib/layout-composer/http');
const { requireSuperAdmin } = require('../../lib/ai-composer/access');
const { getPlatformBrain } = require('../../lib/brain/platform');
const tiles = require('../../lib/ai-composer/tiles');
const { planMessages, PLAN_SCHEMA } = require('../../lib/ai-composer/prompts');
const { normalizePlan } = require('../../lib/ai-composer/plan');
const { getCatalogue } = require('../../lib/ai-composer/catalogue');

function appChoices() {
  const cat = getCatalogue();
  return Object.keys(cat).map(function (k) {
    return { key: k, label: cat[k].label, hero: cat[k].hero, purpose: cat[k].purpose };
  });
}

module.exports = async function aiComposerAnalyse(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' });

  const access = await requireSuperAdmin(req);
  if (!access.ok) return sendJson(res, access.code, { ok: false, error: access.error });

  const body = await readBody(req);
  const width = Math.round(Number(body.width));
  const height = Math.round(Number(body.height));
  if (!(width >= 200 && width <= 10000 && height >= 200 && height <= 60000)) {
    return sendJson(res, 400, { ok: false, error: 'Image width/height missing or out of range (200–10000px wide).' });
  }

  let parsed;
  try {
    parsed = tiles.parseUploadUrl(body.imageUrl);
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: e.message });
  }

  const tileList = tiles.planTiles(width, height);
  const tileUrls = tileList.map(function (t) { return tiles.tileUrl(parsed, width, t); });

  const brain = getPlatformBrain();
  const result = await brain.generateStructured({
    taskId: 'composer.design_plan',
    promptId: 'composer.design_plan',
    actor: { userId: access.user.id, role: 'super' },
    messages: planMessages({
      tiles: tileList,
      tileUrls: tileUrls,
      width: width,
      height: height,
      notes: body.notes
    }),
    temperature: 0.2,
    responseSchema: PLAN_SCHEMA
  });

  if (!result.ok) {
    return sendJson(res, 502, {
      ok: false,
      error: (result.error && result.error.message) || 'Design analysis failed',
      code: result.error && result.error.code,
      correlationId: result.correlationId
    });
  }

  let plan;
  try {
    plan = normalizePlan(result.output, { url: body.imageUrl, width: width, height: height });
  } catch (e) {
    return sendJson(res, 502, { ok: false, error: 'Could not use the analysis: ' + e.message, correlationId: result.correlationId });
  }

  return sendJson(res, 200, {
    ok: true,
    plan: plan,
    apps: appChoices(),
    tiles: tileUrls,
    model: result.model,
    usage: result.usage,
    correlationId: result.correlationId
  });
};
