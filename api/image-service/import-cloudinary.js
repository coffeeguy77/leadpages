'use strict';

/**
 * POST /api/image-service/import-cloudinary
 * Plan and optionally execute a server-side Cloudinary import for an approved selection.
 * Secrets never leave the server. Does not publish sites.
 *
 * Body:
 *   selection — image selection (sourceImageUrl, providerAssetId, …)
 *   siteId, draftId — folder scope under leadpages/
 *   execute — when true, fetch + upload; otherwise return plan only
 */

const { requireThemeStudioActor, json, readBody } = require('../../lib/theme-studio/http-access');
const {
  buildCloudinaryImportPlan,
  importRemoteAssetToCloudinary
} = require('../../lib/image-service');
const { trackStudioEvent } = require('../../lib/website-studio-application/observability');

module.exports = async function imageServiceImportCloudinary(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });

  const gate = await requireThemeStudioActor(req);
  if (!gate.ok) return json(res, gate.code, { ok: false, error: gate.error, message: gate.message });

  const body = await readBody(req);
  const selection = body.selection || body;
  if (!selection || (!selection.sourceImageUrl && !selection.selectedVariantUrl && !selection.url)) {
    return json(res, 400, { ok: false, error: 'selection_required' });
  }

  const siteId = String(body.siteId || 'website-studio-drafts');
  const draftId = String(body.draftId || 'draft');

  // Tenant folder hard-scope
  if (siteId.includes('..') || /[^a-zA-Z0-9_\-]/.test(siteId.replace(/\//g, ''))) {
    return json(res, 400, { ok: false, error: 'invalid_site_id' });
  }

  const plan = buildCloudinaryImportPlan(
    {
      ...selection,
      sourceImageUrl: selection.sourceImageUrl || selection.selectedVariantUrl || selection.url,
      imageBriefId: selection.imageBriefId || selection.briefId || 'img'
    },
    { siteId, draftId }
  );

  if (body.execute !== true) {
    return json(res, 200, {
      ok: true,
      importPlan: plan,
      note: 'Pass execute:true to perform server-side import. Live publish remains gated.'
    });
  }

  const imported = await importRemoteAssetToCloudinary(
    {
      ...selection,
      sourceImageUrl: selection.sourceImageUrl || selection.selectedVariantUrl || selection.url,
      imageBriefId: selection.imageBriefId || selection.briefId || 'img'
    },
    { siteId, draftId, dryRun: body.dryRun === true }
  );

  trackStudioEvent({
    type: imported.ok ? 'image_import_completed' : 'image_import_failed',
    actorUserId: gate.actor.userId,
    draftId,
    siteId,
    success: imported.ok,
    error: imported.ok ? null : imported.error,
    meta: {
      publicId: imported.publicId || null,
      deduped: !!imported.deduped,
      provider: selection.provider || null
    }
  });

  if (!imported.ok) {
    return json(res, 422, {
      ok: false,
      error: imported.error,
      message: imported.message,
      importPlan: plan,
      recovery: 'Approve an alternate image or retry import after checking Cloudinary credentials.'
    });
  }

  return json(res, 200, {
    ok: true,
    importPlan: plan,
    imported: {
      publicId: imported.publicId,
      url: imported.secureUrl || imported.url,
      transformations: imported.transformations,
      attribution: imported.attribution,
      importStatus: imported.importStatus,
      deduped: !!imported.deduped
    },
    notice: 'Image imported to tenant-scoped Cloudinary folder. Site not published.'
  });
};
