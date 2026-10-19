'use strict';

/**
 * POST /api/ai-composer/new-layout
 * Body: { plan, sectionId, fill?, issues?, slug?, previousErrors? }
 *
 * Full mode (super admins, trusted partners): designs a NEW layout for one section
 * when no existing layout of its app matches the design — a "design block" (HTML
 * template + scoped CSS, checked by lib/ai-composer/blocks.js) that uses the app's
 * own fields, so it stays editable. Saved to composer_layouts: super admins' blocks
 * are approved for everyone at once, trusted partners' stay on their site until a
 * super admin approves them. The page then sets section.block and rebuilds.
 */

const crypto = require('crypto');
const { sendJson, readBody } = require('../../lib/layout-composer/http');
const { requireComposerAccess } = require('../../lib/ai-composer/access');
const { getPlatformBrain } = require('../../lib/brain/platform');
const { sanitizeClientPlan } = require('../../lib/ai-composer/plan');
const { appFieldSheet } = require('../../lib/ai-composer/catalogue');
const { blockMessages, BLOCK_SCHEMA } = require('../../lib/ai-composer/prompts');
const { prepareBlock } = require('../../lib/ai-composer/blocks');
const { saveBlock } = require('../../lib/ai-composer/block-store');
const tiles = require('../../lib/ai-composer/tiles');

module.exports = async function aiComposerNewLayout(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' });
  const access = await requireComposerAccess(req, { full: true });
  if (!access.ok) return sendJson(res, access.code, { ok: false, error: access.error });

  const body = await readBody(req);
  let plan;
  try { plan = sanitizeClientPlan(body.plan); } catch (e) { return sendJson(res, 400, { ok: false, error: e.message }); }
  const s = plan.sections.find(function (x) { return x.id === String(body.sectionId || ''); });
  if (!s || s.appKey === 'footer') return sendJson(res, 400, { ok: false, error: 'Pick a section (not the footer) to design a new layout for.' });
  const sheet = appFieldSheet(s.appKey, s.layout);
  if (!sheet) return sendJson(res, 400, { ok: false, error: 'Unknown app.' });

  const fill = body.fill && typeof body.fill === 'object' ? body.fill : {};
  const values = { fields: fill.scalars || {}, lists: fill.lists || {} };
  const parsed = tiles.parseUploadUrl(plan.design.url);
  const result = await getPlatformBrain().generateStructured({
    taskId: 'composer.block_design',
    promptId: 'composer.block_design',
    actor: access.actor,
    messages: blockMessages({
      appKey: s.appKey,
      label: s.label,
      sheet: sheet,
      values: values,
      issues: (Array.isArray(body.issues) ? body.issues : []).map(String).slice(0, 6),
      previousErrors: (Array.isArray(body.previousErrors) ? body.previousErrors : []).map(String).slice(0, 12),
      designUrls: tiles.sectionImageUrls(parsed, plan.design.width, s.rows).slice(0, 2)
    }),
    temperature: 0.2,
    responseSchema: BLOCK_SCHEMA
  });
  if (!result.ok) {
    return sendJson(res, 502, { ok: false, error: (result.error && result.error.message) || 'Could not design a new layout', correlationId: result.correlationId });
  }
  const id = crypto.randomUUID();
  const prepared = prepareBlock(result.output, s.appKey, sheet, id);
  if (!prepared.ok) return sendJson(res, 422, { ok: false, error: 'The new layout did not pass the safety checks.', errors: prepared.errors });
  // The layout it was made with: its fields come from that layout's sheet, so a plan
  // that reuses the block fills it with the same fields.
  prepared.block.fields.layout = sheet.layout || '';
  try {
    const saved = await saveBlock(access, prepared.block, { slug: String(body.slug || '').slice(0, 64), designUrl: plan.design.url });
    return sendJson(res, 200, { ok: true, block: Object.assign({}, prepared.block, { status: saved.status }) });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: e.message });
  }
};
