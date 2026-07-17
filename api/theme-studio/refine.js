'use strict';

const { getPlatformBrain } = require('../../lib/brain/platform');
const {
  requireThemeStudioActor,
  assertDraftAccess,
  json,
  readBody
} = require('../../lib/theme-studio/http-access');
const { getDraft, getVersion, createVersion, updateDraft } = require('../../lib/theme-studio/store');
const {
  applyConceptPatch,
  buildDeterministicRefinePatch
} = require('../../lib/theme-studio/apply-patch');
const { buildQualityReport } = require('../../lib/theme-studio/quality-report');

module.exports = async function themeStudioRefine(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });

  const gate = await requireThemeStudioActor(req);
  if (!gate.ok) return json(res, gate.code, { ok: false, error: gate.error, message: gate.message });

  const body = await readBody(req);
  const draftId = String(body.draftId || '').trim();
  const versionId = String(body.versionId || body.baseVersionId || '').trim();
  const feedback = String(body.feedback || body.message || '').trim();
  if (!draftId || !versionId || !feedback) {
    return json(res, 400, { ok: false, error: 'draftId, versionId and feedback required' });
  }

  const got = await getDraft(draftId);
  if (!got.ok) return json(res, 404, { ok: false, error: got.error });
  const access = assertDraftAccess(got.draft, gate.actor);
  if (!access.ok) return json(res, access.code, { ok: false, error: access.error });

  const ver = await getVersion(versionId);
  if (!ver.ok || ver.version.draft_id !== draftId) {
    return json(res, 404, { ok: false, error: 'version_not_found' });
  }

  let patch = body.patch && typeof body.patch === 'object' ? body.patch : null;
  if (!patch) {
    // Optional Brain refine — fall back to deterministic patch builder
    try {
      const brain = getPlatformBrain();
      const result = await brain.generateStructured({
        taskId: 'theme_studio.refinement',
        promptId: 'theme_studio.refinement',
        temperature: 0.4,
        input: {
          feedback,
          conceptJson: JSON.stringify(ver.version.concept_json || {}).slice(0, 12000)
        },
        responseSchema: {
          type: 'object',
          required: ['patch'],
          properties: {
            patch: { type: 'object' },
            rationale: { type: 'string' }
          }
        }
      });
      if (result.ok && result.output && result.output.patch) {
        patch = {
          ...result.output.patch,
          rationale: result.output.rationale || feedback
        };
      }
    } catch (_e) {
      patch = null;
    }
  }
  if (!patch) patch = buildDeterministicRefinePatch(ver.version.concept_json, feedback);

  const sourceConfig = (got.draft.meta && got.draft.meta.sourceSnapshot) || null;
  const applied = applyConceptPatch(ver.version.concept_json, patch, sourceConfig);
  if (!applied.ok) {
    return json(res, 422, {
      ok: false,
      error: 'refine_invalid',
      details: applied.errors
    });
  }

  const quality = buildQualityReport(applied.concept, applied.draftConfig);
  const created = await createVersion({
    draft_id: draftId,
    concept_id: applied.concept.conceptId,
    kind: 'refine',
    concept_json: applied.concept,
    draft_config_json: applied.draftConfig,
    adapter_warnings: applied.adapterWarnings || [],
    quality_report: quality,
    created_by: gate.actor.userId
  });
  if (!created.ok) return json(res, 500, { ok: false, error: created.error });

  await updateDraft(draftId, {
    selected_concept_id: applied.concept.conceptId,
    selected_version_id: created.version.id
  });

  return json(res, 200, {
    ok: true,
    version: {
      id: created.version.id,
      conceptId: created.version.concept_id,
      versionNumber: created.version.version_number,
      conceptName: applied.concept.conceptName,
      theme: applied.concept.theme,
      quality
    },
    appliedPaths: applied.applied,
    rationale: applied.rationale,
    notice: 'Refinement stored as a new draft version. Live sites unchanged.'
  });
};
