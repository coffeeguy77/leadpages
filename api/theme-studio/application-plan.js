'use strict';

/**
 * POST /api/theme-studio/application-plan
 * Build a pre-application plan + validation. No writes.
 */

const {
  requireThemeStudioActor,
  assertDraftAccess,
  json,
  readBody
} = require('../../lib/theme-studio/http-access');
const { getDraft, getVersion } = require('../../lib/theme-studio/store');
const { planApplication, MODES } = require('../../lib/website-studio-application');

module.exports = async function themeStudioApplicationPlan(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });

  const gate = await requireThemeStudioActor(req);
  if (!gate.ok) return json(res, gate.code, { ok: false, error: gate.error, message: gate.message });

  const body = await readBody(req);
  const draftId = String(body.draftId || '').trim();
  const versionId = String(body.versionId || '').trim();
  const mode = String(body.mode || '').trim();

  if (!draftId || !versionId) {
    return json(res, 400, { ok: false, error: 'draftId and versionId required' });
  }
  if (!Object.values(MODES).includes(mode)) {
    return json(res, 400, {
      ok: false,
      error: 'invalid_mode',
      modes: Object.values(MODES)
    });
  }

  const got = await getDraft(draftId);
  if (!got.ok) return json(res, 404, { ok: false, error: got.error });
  const access = assertDraftAccess(got.draft, gate.actor);
  if (!access.ok) return json(res, access.code, { ok: false, error: access.error });

  const ver = await getVersion(versionId);
  if (!ver.ok || ver.version.draft_id !== draftId) {
    return json(res, 404, { ok: false, error: 'version_not_found' });
  }

  const result = await planApplication({
    actor: gate.actor,
    draft: got.draft,
    version: ver.version,
    mode,
    contactConfirmation: body.contactConfirmation || body.contact,
    siteIdentity: body.siteIdentity || body.site,
    targetSiteId: body.targetSiteId,
    acknowledgeWarnings: body.acknowledgeWarnings === true,
    overrideReason: body.overrideReason,
    mockImages: body.mockImages === true,
    importedMap: body.importedMap || null,
    includeRawDiagnostic: body.includeRawDiagnostic === true,
    allowUnapprovedImages: body.allowUnapprovedImages === true
  });

  if (!result.ok) {
    return json(res, result.code || 400, {
      ok: false,
      error: result.error,
      message: result.message,
      plan: result.plan,
      validation: result.validation
    });
  }

  return json(res, 200, {
    ok: true,
    plan: result.plan,
    validation: result.validation,
    imageFinalisation: result.imageFinalisation,
    canCommit: result.canCommit,
    notice: 'Review the application plan. This did not create a site or publish anything.'
  });
};
