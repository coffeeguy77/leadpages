'use strict';

/**
 * POST /api/theme-studio/direct-edit
 * Manual draft edits via adapters — persists as a new version with Manual Edit provenance.
 */

const {
  requireThemeStudioActor,
  assertDraftAccess,
  json,
  readBody
} = require('../../lib/theme-studio/http-access');
const { getDraft, getVersion, createVersion, updateDraft } = require('../../lib/theme-studio/store');
const { buildQualityReport } = require('../../lib/theme-studio/quality-report');
const { adaptApp, hasAdapter } = require('../../lib/website-composer/adapters/registry');
const { PROVENANCE, KNOWN_SECTION_KEYS } = require('../../lib/website-composer/constants');

module.exports = async function themeStudioDirectEdit(req, res) {
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
  const changes = [];

  if (Array.isArray(body.sectionOrder)) {
    concept.sectionOrder = body.sectionOrder.slice();
    draftConfig.sectionOrder = body.sectionOrder.slice();
    changes.push('sectionOrder');
  }

  if (body.sectionKey && body.section) {
    const key = String(body.sectionKey);
    if (!hasAdapter(key) && key !== 'footer') {
      return json(res, 422, { ok: false, error: 'adapter_missing', message: 'Unsupported section ' + key });
    }
    const adapted = adaptApp(key, {
      ...body.section,
      provenance: PROVENANCE.MANUAL_EDIT
    });
    if (!adapted.ok) {
      return json(res, 422, { ok: false, error: 'adapter_validation', details: adapted.errors });
    }
    concept.sections = concept.sections || {};
    draftConfig.sections = draftConfig.sections || {};
    concept.sections[key] = adapted.config;
    draftConfig.sections[key] = adapted.config;
    if (!concept.sectionOrder.includes(key)) concept.sectionOrder.push(key);
    if (!draftConfig.sectionOrder.includes(key)) draftConfig.sectionOrder.push(key);
    changes.push('sections.' + key);
  }

  if (body.disableSection) {
    const key = String(body.disableSection);
    if (draftConfig.sections && draftConfig.sections[key]) {
      draftConfig.sections[key] = {
        on: false,
        provenance: PROVENANCE.MANUAL_EDIT,
        disabledReason: 'manual_off'
      };
      concept.sectionOrder = (concept.sectionOrder || []).filter((k) => k !== key);
      draftConfig.sectionOrder = (draftConfig.sectionOrder || []).filter((k) => k !== key);
      changes.push('disable.' + key);
    }
  }

  if (body.theme && typeof body.theme === 'object') {
    concept.theme = { ...(concept.theme || {}), ...body.theme };
    draftConfig.theme = { ...(draftConfig.theme || {}), ...body.theme };
    changes.push('theme');
  }

  if (body.seoTitle != null) {
    draftConfig.seoTitle = String(body.seoTitle);
    changes.push('seoTitle');
  }
  if (body.seoDescription != null) {
    draftConfig.seoDescription = String(body.seoDescription);
    changes.push('seoDescription');
  }

  if (body.navigation && Array.isArray(body.navigation.items)) {
    concept.navigation = { items: body.navigation.items };
    changes.push('navigation');
  }

  // Keep unused known sections disabled
  for (const key of KNOWN_SECTION_KEYS) {
    if ((draftConfig.sectionOrder || []).includes(key)) continue;
    if (!draftConfig.sections) draftConfig.sections = {};
    if (!draftConfig.sections[key] || draftConfig.sections[key].on !== false) {
      draftConfig.sections[key] = {
        on: false,
        provenance: PROVENANCE.FOUNDATION,
        disabledReason: 'not_in_composition'
      };
    }
  }

  if (!changes.length) {
    return json(res, 400, { ok: false, error: 'no_changes' });
  }

  concept.provenance = {
    ...(concept.provenance || {}),
    lastManualEditAt: new Date().toISOString(),
    generatedBy: 'manual_edit'
  };

  const quality = buildQualityReport(concept, draftConfig);
  const created = await createVersion({
    draft_id: draftId,
    concept_id: concept.conceptId || ver.version.concept_id,
    kind: 'manual_edit',
    concept_json: concept,
    draft_config_json: draftConfig,
    adapter_warnings: changes.map((c) => ({ code: 'manual_edit', message: c })),
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
    changes,
    notice: 'Manual edit saved as a new draft version.'
  });
};
