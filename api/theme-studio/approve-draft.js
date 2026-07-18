'use strict';

/**
 * POST /api/theme-studio/approve-draft
 * Mark a concept approval state. Does NOT apply to live sites.
 */

const {
  requireThemeStudioActor,
  assertDraftAccess,
  json,
  readBody
} = require('../../lib/theme-studio/http-access');
const { getDraft, getVersion, createVersion, updateDraft } = require('../../lib/theme-studio/store');
const { buildQualityReport } = require('../../lib/theme-studio/quality-report');
const { runQualityGate } = require('../../lib/website-composer/quality-gate');

const STATES = new Set(['draft', 'selected', 'ready-for-review', 'approved-for-application']);

module.exports = async function themeStudioApproveDraft(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });

  const gate = await requireThemeStudioActor(req);
  if (!gate.ok) return json(res, gate.code, { ok: false, error: gate.error, message: gate.message });

  const body = await readBody(req);
  const draftId = String(body.draftId || '').trim();
  const versionId = String(body.versionId || '').trim();
  const approvalState = String(body.approvalState || body.state || '').trim();
  if (!draftId || !versionId) return json(res, 400, { ok: false, error: 'draftId and versionId required' });
  if (!STATES.has(approvalState)) {
    return json(res, 400, {
      ok: false,
      error: 'invalid_state',
      message: 'Use draft|selected|ready-for-review|approved-for-application'
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

  const concept = JSON.parse(JSON.stringify(ver.version.concept_json || {}));
  const draftConfig = JSON.parse(JSON.stringify(ver.version.draft_config_json || {}));
  const qualityGate = runQualityGate(concept, draftConfig);

  if (
    (approvalState === 'ready-for-review' || approvalState === 'approved-for-application') &&
    qualityGate.status === 'blocked'
  ) {
    return json(res, 422, {
      ok: false,
      error: 'quality_blocked',
      message: 'Concept has critical quality issues',
      qualityGate
    });
  }

  concept.approvalState = approvalState;
  draftConfig.__websiteComposer = draftConfig.__websiteComposer || {};
  draftConfig.__websiteComposer.approvalState = approvalState;
  draftConfig.__websiteComposer.approvedAt =
    approvalState === 'approved-for-application' ? new Date().toISOString() : null;
  draftConfig.__websiteComposer.approvedBy =
    approvalState === 'approved-for-application' ? gate.actor.userId || null : null;

  const quality = buildQualityReport(concept, draftConfig);
  const created = await createVersion({
    draft_id: draftId,
    concept_id: concept.conceptId || ver.version.concept_id,
    kind: 'approve',
    concept_json: concept,
    draft_config_json: draftConfig,
    adapter_warnings: [
      {
        code: 'approval_state',
        message: 'Approval state set to ' + approvalState + ' (not published)'
      }
    ],
    quality_report: quality,
    created_by: gate.actor.userId
  });
  if (!created.ok) return json(res, 500, { ok: false, error: created.error });

  await updateDraft(draftId, {
    selected_version_id: created.version.id,
    selected_concept_id: created.version.concept_id,
    meta: {
      ...(got.draft.meta || {}),
      approvalState,
      approvedVersionId:
        approvalState === 'approved-for-application' ? created.version.id : (got.draft.meta || {}).approvedVersionId
    }
  });

  return json(res, 200, {
    ok: true,
    approvalState,
    version: created.version,
    qualityGate,
    notice: 'Draft approval state saved. Live site configuration was not changed.'
  });
};
