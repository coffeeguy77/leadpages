'use strict';

/**
 * POST /api/theme-studio/persist-images
 * Persist image selection / approval onto a new draft version.
 */

const {
  requireThemeStudioActor,
  assertDraftAccess,
  json,
  readBody
} = require('../../lib/theme-studio/http-access');
const { getDraft, getVersion, createVersion, updateDraft } = require('../../lib/theme-studio/store');
const { buildQualityReport } = require('../../lib/theme-studio/quality-report');

const ALLOWED = new Set([
  'proposed',
  'selected',
  'approved',
  'rejected',
  'replacement-requested',
  'import-planned',
  'imported',
  'failed',
  'placeholder'
]);

module.exports = async function themeStudioPersistImages(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });

  const gate = await requireThemeStudioActor(req);
  if (!gate.ok) return json(res, gate.code, { ok: false, error: gate.error, message: gate.message });

  const body = await readBody(req);
  const draftId = String(body.draftId || '').trim();
  const versionId = String(body.versionId || '').trim();
  if (!draftId || !versionId) return json(res, 400, { ok: false, error: 'draftId and versionId required' });

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
  draftConfig.__websiteComposer = draftConfig.__websiteComposer || {};

  const selections = Array.isArray(body.imageSelections)
    ? body.imageSelections
    : draftConfig.__websiteComposer.imageSelections || [];

  const nextSelections = selections.map((s) => {
    const status = ALLOWED.has(s.approvalStatus) ? s.approvalStatus : 'selected';
    return {
      ...s,
      approvalStatus: status,
      selectedBy: s.selectedBy || gate.actor.userId || 'user',
      selectedAt: s.selectedAt || new Date().toISOString(),
      approvedBy: status === 'approved' ? gate.actor.userId || 'user' : s.approvedBy || null,
      approvedAt: status === 'approved' ? new Date().toISOString() : s.approvedAt || null
    };
  });

  draftConfig.__websiteComposer.imageSelections = nextSelections;
  concept.imagery = nextSelections;

  if (body.importPlan) {
    draftConfig.__websiteComposer.lastImportPlan = body.importPlan;
  }

  const quality = buildQualityReport(concept, draftConfig);
  const created = await createVersion({
    draft_id: draftId,
    concept_id: concept.conceptId || ver.version.concept_id,
    kind: 'images',
    concept_json: concept,
    draft_config_json: draftConfig,
    adapter_warnings: [{ code: 'image_persist', message: body.summary || 'Image selections updated' }],
    quality_report: quality,
    created_by: gate.actor.userId
  });
  if (!created.ok) {
    return json(res, 500, {
      ok: false,
      error: created.error,
      code: created.code || null,
      migration: created.migration || null
    });
  }

  await updateDraft(draftId, {
    selected_version_id: created.version.id,
    selected_concept_id: created.version.concept_id,
    meta: {
      ...(got.draft.meta || {}),
      lastImagePersistAt: new Date().toISOString()
    }
  });

  return json(res, 200, {
    ok: true,
    version: created.version,
    notice:
      created.notice === 'kind_constraint_legacy_fallback'
        ? `Image decisions saved (legacy kind fallback). Apply ${created.migration} in Supabase when convenient.`
        : 'Image decisions saved as a new draft version. Not published.',
    intendedKind: created.intendedKind || null,
    migration: created.migration || null
  });
};
