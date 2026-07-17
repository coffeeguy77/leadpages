'use strict';

const {
  requireThemeStudioActor,
  assertDraftAccess,
  json,
  readBody
} = require('../../lib/theme-studio/http-access');
const { getDraft, updateDraft, getVersion, createVersion } = require('../../lib/theme-studio/store');

module.exports = async function themeStudioSelectConcept(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });

  const gate = await requireThemeStudioActor(req);
  if (!gate.ok) return json(res, gate.code, { ok: false, error: gate.error, message: gate.message });

  const body = await readBody(req);
  const draftId = String(body.draftId || '').trim();
  const versionId = String(body.versionId || '').trim();
  if (!draftId || !versionId) {
    return json(res, 400, { ok: false, error: 'draftId and versionId required' });
  }

  const got = await getDraft(draftId);
  if (!got.ok) return json(res, 404, { ok: false, error: got.error });
  const access = assertDraftAccess(got.draft, gate.actor);
  if (!access.ok) return json(res, access.code, { ok: false, error: access.error });

  const ver = await getVersion(versionId);
  if (!ver.ok || ver.version.draft_id !== draftId) {
    return json(res, 404, { ok: false, error: 'version_not_found' });
  }

  const updated = await updateDraft(draftId, {
    selected_concept_id: ver.version.concept_id,
    selected_version_id: versionId
  });
  if (!updated.ok) return json(res, 500, { ok: false, error: updated.error });

  await createVersion({
    draft_id: draftId,
    concept_id: ver.version.concept_id,
    kind: 'select',
    concept_json: ver.version.concept_json,
    draft_config_json: ver.version.draft_config_json,
    adapter_warnings: ver.version.adapter_warnings || [],
    quality_report: ver.version.quality_report || null,
    created_by: gate.actor.userId
  });

  return json(res, 200, {
    ok: true,
    draft: updated.draft,
    selectedVersionId: versionId,
    selectedConceptId: ver.version.concept_id
  });
};
