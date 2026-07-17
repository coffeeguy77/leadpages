'use strict';

const {
  requireThemeStudioActor,
  assertDraftAccess,
  json,
  readBody
} = require('../../lib/theme-studio/http-access');
const { getDraft, getVersion, saveTemplate, createVersion } = require('../../lib/theme-studio/store');

module.exports = async function themeStudioSaveTemplate(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });

  const gate = await requireThemeStudioActor(req);
  if (!gate.ok) return json(res, gate.code, { ok: false, error: gate.error, message: gate.message });

  const body = await readBody(req);
  const draftId = String(body.draftId || '').trim();
  const versionId = String(body.versionId || '').trim();
  const name = String(body.name || '').trim();
  if (!draftId || !versionId || !name) {
    return json(res, 400, { ok: false, error: 'draftId, versionId and name required' });
  }

  const got = await getDraft(draftId);
  if (!got.ok) return json(res, 404, { ok: false, error: got.error });
  const access = assertDraftAccess(got.draft, gate.actor);
  if (!access.ok) return json(res, access.code, { ok: false, error: access.error });

  const ver = await getVersion(versionId);
  if (!ver.ok || ver.version.draft_id !== draftId) {
    return json(res, 404, { ok: false, error: 'version_not_found' });
  }

  const submit = body.submitToMarketplace === true;
  if (submit && !gate.actor.isSuperuser) {
    return json(res, 403, {
      ok: false,
      error: 'superuser_required',
      message: 'Only superusers can submit templates to the marketplace review queue.'
    });
  }

  const saved = await saveTemplate({
    owner_user_id: gate.actor.userId,
    partner_id: gate.actor.partnerId || null,
    name,
    foundation_id: (ver.version.concept_json && ver.version.concept_json.foundationId) || got.draft.foundation_id,
    concept_json: ver.version.concept_json,
    draft_config_json: ver.version.draft_config_json,
    visibility: submit ? 'submitted' : 'private',
    status: submit ? 'in_review' : 'active'
  });
  if (!saved.ok) return json(res, 500, { ok: false, error: saved.error });

  await createVersion({
    draft_id: draftId,
    concept_id: ver.version.concept_id,
    kind: 'template',
    concept_json: ver.version.concept_json,
    draft_config_json: ver.version.draft_config_json,
    adapter_warnings: [{ code: 'template_saved', message: name }],
    created_by: gate.actor.userId
  });

  return json(res, 200, {
    ok: true,
    template: saved.template,
    notice: submit
      ? 'Template submitted for marketplace review.'
      : 'Saved as private My Template.'
  });
};
