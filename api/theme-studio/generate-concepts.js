'use strict';

const { randomUUID } = require('crypto');
const { getPlatformBrain } = require('../../lib/brain/platform');
const httpAccess = require('../../lib/theme-studio/http-access');
const store = require('../../lib/theme-studio/store');
const { generateConceptsWithBrain, normalizeBrief } = require('../../lib/theme-studio/generate');
const { buildQualityReport } = require('../../lib/theme-studio/quality-report');

function fail(res, status, payload) {
  const body = Object.assign(
    {
      ok: false,
      diagnosticId: randomUUID()
    },
    payload || {}
  );
  if (!body.message && body.error) body.message = String(body.error);
  return httpAccess.json(res, status, body);
}

function summarizeVersion(v) {
  return {
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
  };
}

module.exports = async function themeStudioGenerateConcepts(req, res) {
  if (req.method !== 'POST') return fail(res, 405, { error: 'POST only' });

  try {
    const gate = await httpAccess.requireThemeStudioActor(req);
    if (!gate.ok) {
      return fail(res, gate.code, {
        error: gate.error,
        message: gate.message || gate.error,
        reason: gate.reason
      });
    }

    const body = await httpAccess.readBody(req);
    const draftId = String(body.draftId || '').trim();
    if (!draftId) {
      return fail(res, 400, {
        error: 'draftId_required',
        message: 'Create a draft from the brief step before generating concepts.'
      });
    }

    const got = await store.getDraft(draftId);
    if (!got.ok) return fail(res, 404, { error: got.error, message: got.error });
    const access = httpAccess.assertDraftAccess(got.draft, gate.actor);
    if (!access.ok) return fail(res, access.code, { error: access.error });
    if (got.draft.status !== 'open') {
      return fail(res, 409, { error: 'draft_not_open', message: 'This draft is no longer open.' });
    }

    const brief = normalizeBrief(body.brief || got.draft.brief || {});
    if (!brief.businessName || !brief.industry) {
      return fail(res, 400, {
        error: 'brief_incomplete',
        message: 'businessName and industry are required on the draft brief.'
      });
    }

    const foundationId = body.foundationId || got.draft.foundation_id || null;
    const sourceConfig = (got.draft.meta && got.draft.meta.sourceSnapshot) || null;

    const brain = getPlatformBrain();
    const generated = await generateConceptsWithBrain(brain, brief, {
      foundationId,
      sourceConfig,
      count: 3,
      actor: gate.actor,
      allowMockImages: true,
      // Composer is source of truth — keep Brain advisory off the critical path
      useBrain: false
    });

    if (!generated.ok) {
      return fail(res, 422, {
        error: 'generation_failed',
        message: 'Concept generation failed',
        details: generated.errors
      });
    }

    const versions = [];
    for (const item of generated.concepts) {
      let quality;
      try {
        quality = buildQualityReport(item.concept, item.draftConfig);
      } catch (qe) {
        quality = {
          score: 0,
          notes: [
            {
              code: 'quality_report_failed',
              severity: 'warn',
              message: (qe && qe.message) || 'quality report failed'
            }
          ]
        };
      }

      const created = await store.createVersion({
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
        return fail(res, 500, {
          error: created.error || 'version_create_failed',
          message: created.error || 'Failed to store a generated concept version'
        });
      }
      versions.push(created.version);
    }

    await store.updateDraft(draftId, {
      brief,
      foundation_id: generated.foundationId,
      meta: {
        ...(got.draft.meta || {}),
        lastGenerateSource: generated.source,
        candidates: generated.candidates
      }
    });

    return httpAccess.json(res, 200, {
      ok: true,
      draftId,
      foundationId: generated.foundationId,
      foundationName: generated.foundationName,
      source: generated.source,
      candidates: generated.candidates,
      versions: versions.map(summarizeVersion),
      notice: 'Draft-only. Nothing written to live sites.'
    });
  } catch (err) {
    const diagnosticId = randomUUID();
    console.error('[theme-studio/generate-concepts]', diagnosticId, err && err.stack ? err.stack : err);
    return httpAccess.json(res, 500, {
      ok: false,
      diagnosticId,
      error: 'generate_concepts_exception',
      message: (err && err.message) || 'Concept generation failed unexpectedly'
    });
  }
};

// Vercel / serverless duration headroom for image search during generate
module.exports.config = { maxDuration: 60 };
