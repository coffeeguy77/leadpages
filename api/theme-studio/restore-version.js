'use strict';

/**
 * POST /api/theme-studio/restore-version
 * Restore a prior version by creating a NEW version (history preserved).
 */

const {
  requireThemeStudioActor,
  assertDraftAccess,
  json,
  readBody
} = require('../../lib/theme-studio/http-access');
const { getDraft, getVersion, createVersion, updateDraft } = require('../../lib/theme-studio/store');
const { buildQualityReport } = require('../../lib/theme-studio/quality-report');

module.exports = async function themeStudioRestoreVersion(req, res) {
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
  concept.rationale = (concept.rationale || '') + ' Restored from version ' + ver.version.version_number + '.';

  const quality = buildQualityReport(concept, draftConfig);
  const created = await createVersion({
    draft_id: draftId,
    concept_id: concept.conceptId || ver.version.concept_id,
    kind: 'restore',
    concept_json: concept,
    draft_config_json: draftConfig,
    adapter_warnings: [
      {
        code: 'restore',
        message: 'Restored snapshot of version ' + ver.version.version_number + ' as a new version'
      }
    ],
    quality_report: quality,
    created_by: gate.actor.userId
  });
  if (!created.ok) return json(res, 500, { ok: false, error: created.error });

  await updateDraft(draftId, {
    selected_version_id: created.version.id,
    selected_concept_id: created.version.concept_id
  });

  return json(res, 200, {
    ok: true,
    version: created.version,
    restoredFrom: ver.version.version_number,
    notice: 'History preserved — restore created a new version.'
  });
};
