'use strict';

/**
 * POST /api/theme-studio/apply-concept
 * Controlled Website Studio application (Phase 5).
 * Modes: create_site | replacement_draft | private_template
 * Never publishes. Never overwrites live site config.
 */

const {
  requireThemeStudioActor,
  assertDraftAccess,
  json,
  readBody
} = require('../../lib/theme-studio/http-access');
const { getDraft, getVersion } = require('../../lib/theme-studio/store');
const {
  commitApplication,
  planApplication,
  discardReplacementDraft,
  MODES
} = require('../../lib/website-studio-application');

module.exports = async function themeStudioApplyConcept(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });

  const gate = await requireThemeStudioActor(req);
  if (!gate.ok) return json(res, gate.code, { ok: false, error: gate.error, message: gate.message });

  const body = await readBody(req);

  // Discard replacement draft helper
  if (body.action === 'discard_replacement') {
    const id = String(body.replacementDraftId || '').trim();
    if (!id) return json(res, 400, { ok: false, error: 'replacementDraftId required' });
    const discarded = discardReplacementDraft(id);
    if (!discarded.ok) return json(res, 404, { ok: false, error: discarded.error });
    return json(res, 200, {
      ok: true,
      replacementDraft: discarded.replacementDraft,
      liveSiteChanged: false,
      notice: 'Replacement draft discarded. Live site unchanged.'
    });
  }

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

  // Reject forged privileged fields from client
  if (body.siteStatus === 'live' || body.publish === true || body.status === 'live') {
    return json(res, 400, {
      ok: false,
      error: 'publish_forbidden',
      message: 'Website Studio application cannot publish or set sites live.'
    });
  }

  const payload = {
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
    confirmPlan: body.confirmPlan === true,
    idempotencyKey: body.idempotencyKey || body.idempotency_key || null,
    templateName: body.templateName,
    includeTestimonials: body.includeTestimonials === true,
    allowUnapprovedImages: body.allowUnapprovedImages === true,
    approvalState: body.approvalState
  };

  if (body.dryRun === true) {
    const planned = await planApplication(payload);
    return json(res, planned.ok ? 200 : planned.code || 400, planned);
  }

  const result = await commitApplication(payload);
  if (!result.ok) {
    return json(res, result.code || 400, result);
  }

  return json(res, 200, result);
};
