'use strict';

const { getPlatformBrain } = require('../../lib/brain/platform');
const {
  requireThemeStudioActor,
  assertDraftAccess,
  json,
  readBody
} = require('../../lib/theme-studio/http-access');
const { getDraft, updateDraft, createVersion } = require('../../lib/theme-studio/store');
const { generateConceptsWithBrain, normalizeBrief } = require('../../lib/theme-studio/generate');
const { buildQualityReport } = require('../../lib/theme-studio/quality-report');

module.exports = async function themeStudioGenerateConcepts(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });

  const gate = await requireThemeStudioActor(req);
  if (!gate.ok) return json(res, gate.code, { ok: false, error: gate.error, message: gate.message });

  const body = await readBody(req);
  const draftId = String(body.draftId || '').trim();
  if (!draftId) return json(res, 400, { ok: false, error: 'draftId required' });

  const got = await getDraft(draftId);
  if (!got.ok) return json(res, 404, { ok: false, error: got.error });
  const access = assertDraftAccess(got.draft, gate.actor);
  if (!access.ok) return json(res, access.code, { ok: false, error: access.error });
  if (got.draft.status !== 'open') {
    return json(res, 409, { ok: false, error: 'draft_not_open' });
  }

  const brief = normalizeBrief(body.brief || got.draft.brief || {});
  const foundationId = body.foundationId || got.draft.foundation_id || null;
  const sourceConfig =
    (got.draft.meta && got.draft.meta.sourceSnapshot) || null;

  const brain = getPlatformBrain();
  const generated = await generateConceptsWithBrain(brain, brief, {
    foundationId,
    sourceConfig,
    count: 3,
    actor: gate.actor,
    allowMockImages: true
  });

  if (!generated.ok) {
    return json(res, 422, {
      ok: false,
      error: 'generation_failed',
      details: generated.errors
    });
  }

  const versions = [];
  for (const item of generated.concepts) {
    const quality = buildQualityReport(item.concept, item.draftConfig);
    const created = await createVersion({
      draft_id: draftId,
      concept_id: item.concept.conceptId,
      kind: 'generate',
      concept_json: item.concept,
      draft_config_json: item.draftConfig,
      adapter_warnings: item.adapterWarnings || [],
      quality_report: quality,
      created_by: gate.actor.userId
    });
    if (!created.ok) {
      return json(res, 500, { ok: false, error: created.error });
    }
    versions.push(created.version);
  }

  await updateDraft(draftId, {
    brief,
    foundation_id: generated.foundationId,
    meta: {
      ...(got.draft.meta || {}),
      lastGenerateSource: generated.source,
      candidates: generated.candidates
    }
  });

  return json(res, 200, {
    ok: true,
    draftId,
    foundationId: generated.foundationId,
    foundationName: generated.foundationName,
    source: generated.source,
    candidates: generated.candidates,
    versions: versions.map((v) => ({
      id: v.id,
      conceptId: v.concept_id,
      versionNumber: v.version_number,
      conceptName: v.concept_json && v.concept_json.conceptName,
      layoutId: v.concept_json && v.concept_json.layoutId,
      rationale: v.concept_json && v.concept_json.rationale,
      theme: v.concept_json && v.concept_json.theme,
      quality: v.quality_report,
      // Draft image selections for Website Studio image panel (no secrets)
      draftConfig: v.draft_config_json
        ? {
            sectionOrder: v.draft_config_json.sectionOrder || [],
            __websiteComposer: {
              imageSelections:
                (v.draft_config_json.__websiteComposer &&
                  v.draft_config_json.__websiteComposer.imageSelections) ||
                [],
              imageDirection:
                (v.draft_config_json.__websiteComposer &&
                  v.draft_config_json.__websiteComposer.imageDirection) ||
                null,
              contentInheritance:
                (v.draft_config_json.__websiteComposer &&
                  v.draft_config_json.__websiteComposer.contentInheritance) ||
                null,
              rendererShellId:
                (v.draft_config_json.__websiteComposer &&
                  v.draft_config_json.__websiteComposer.rendererShellId) ||
                null,
              installedApps:
                (v.draft_config_json.__websiteComposer &&
                  v.draft_config_json.__websiteComposer.installedApps) ||
                [],
              approvalState:
                (v.draft_config_json.__websiteComposer &&
                  v.draft_config_json.__websiteComposer.approvalState) ||
                'draft'
            }
          }
        : null
    })),
    notice: 'Draft-only. Nothing written to live sites.'
  });
};
