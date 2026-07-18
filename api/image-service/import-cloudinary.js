'use strict';

/**
 * POST /api/image-service/import-cloudinary
 * Builds a Cloudinary import plan for an approved Pexels (or other) selection.
 * Does not publish. Does not expose secrets. Actual upload uses /api/cloudinary/sign.
 */

const { requireThemeStudioActor, json, readBody } = require('../../lib/theme-studio/http-access');
const { buildCloudinaryImportPlan } = require('../../lib/image-service');

module.exports = async function imageServiceImportCloudinary(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });

  const gate = await requireThemeStudioActor(req);
  if (!gate.ok) return json(res, gate.code, { ok: false, error: gate.error, message: gate.message });

  const body = await readBody(req);
  const selection = body.selection || body;
  if (!selection || !selection.sourceImageUrl && !selection.selectedVariantUrl) {
    return json(res, 400, { ok: false, error: 'selection_required' });
  }

  const plan = buildCloudinaryImportPlan(selection, {
    siteId: body.siteId || 'website-studio-drafts',
    draftId: body.draftId || 'draft'
  });

  return json(res, 200, {
    ok: true,
    importPlan: plan,
    note: 'Call /api/cloudinary/sign with publicId/assetFolder, then upload bytes. Live publish remains gated.'
  });
};
