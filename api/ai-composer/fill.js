'use strict';

/**
 * POST /api/ai-composer/fill
 * Body: { plan, sectionIds: ['s1','s2'] }   (1–3 sections per call)
 *
 * Sends each section's slice of the design to the model with the exact fields
 * of the app chosen for it, and returns validated field values. Nothing is saved.
 * Super admin only. Brain task: composer.app_fill (Anthropic vision).
 */

const { sendJson, readBody } = require('../../lib/layout-composer/http');
const { requireSuperAdmin } = require('../../lib/ai-composer/access');
const { getPlatformBrain } = require('../../lib/brain/platform');
const tiles = require('../../lib/ai-composer/tiles');
const { appFieldSheet } = require('../../lib/ai-composer/catalogue');
const { fillMessages, FILL_SCHEMA, overlappingSections } = require('../../lib/ai-composer/prompts');
const { sanitizeClientPlan } = require('../../lib/ai-composer/plan');
const { normalizeFill } = require('../../lib/ai-composer/build-config');

const MAX_PER_CALL = 3;

module.exports = async function aiComposerFill(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' });

  const access = await requireSuperAdmin(req);
  if (!access.ok) return sendJson(res, access.code, { ok: false, error: access.error });

  const body = await readBody(req);
  let plan;
  let parsed;
  try {
    plan = sanitizeClientPlan(body.plan);
    parsed = tiles.parseUploadUrl(plan.design.url);
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: e.message });
  }

  const ids = Array.isArray(body.sectionIds) ? body.sectionIds.map(String) : [];
  const batch = plan.sections.filter(function (s) { return ids.indexOf(s.id) >= 0; });
  if (!batch.length) return sendJson(res, 400, { ok: false, error: 'No matching sections to fill.' });
  if (batch.length > MAX_PER_CALL) {
    return sendJson(res, 400, { ok: false, error: 'Fill at most ' + MAX_PER_CALL + ' sections per call.' });
  }

  const items = batch.map(function (s) {
    return {
      sectionId: s.id,
      appKey: s.appKey,
      label: s.label,
      sheet: appFieldSheet(s.appKey),
      photos: plan.photos
        .filter(function (p) { return p.sectionId === s.id; })
        .map(function (p) { return { id: p.id, description: p.description }; }),
      imageUrls: tiles.sectionImageUrls(parsed, plan.design.width, s.rows),
      neighbours: overlappingSections(plan, s)
    };
  });

  // Optional: let the AI draft FAQ answers the design does not show, using facts
  // from anywhere in the design (so the faq call also sees the overview tiles).
  const draftFaq = !!(body.options && body.options.draftFaq) && batch.some(function (s) { return s.appKey === 'faq'; });
  const overviewUrls = draftFaq
    ? tiles.planTiles(plan.design.width, plan.design.height).map(function (t) { return tiles.tileUrl(parsed, plan.design.width, t); })
    : [];

  const brain = getPlatformBrain();
  const result = await brain.generateStructured({
    taskId: 'composer.app_fill',
    promptId: 'composer.app_fill',
    actor: { userId: access.user.id, role: 'super' },
    messages: fillMessages({ businessName: plan.businessName, items: items, draftFaq: draftFaq, overviewUrls: overviewUrls }),
    temperature: 0.1,
    responseSchema: FILL_SCHEMA
  });

  if (!result.ok) {
    return sendJson(res, 502, {
      ok: false,
      error: (result.error && result.error.message) || 'Filling the apps failed',
      code: result.error && result.error.code,
      sectionIds: batch.map(function (s) { return s.id; }),
      correlationId: result.correlationId
    });
  }

  return sendJson(res, 200, {
    ok: true,
    fills: normalizeFill(result.output, batch, plan),
    usage: result.usage,
    correlationId: result.correlationId
  });
};
