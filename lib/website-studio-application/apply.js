'use strict';

/**
 * Website Studio Phase 5 application orchestrator.
 * Modes: create_site | replacement_draft | private_template
 * Never publishes. Never overwrites live site config.
 */

const { assertApplicationPermission, MODES, canManageTargetSite } = require('./permissions');
const { validateForApplication } = require('./validate');
const { buildApplicationPlan } = require('./plan');
const { finaliseImagesForApplication } = require('./images');
const { assemblePrivateTemplate } = require('./assemble');
const {
  recordApplicationAudit,
  getIdempotentResult,
  setIdempotentResult,
  makeDiagnosticId
} = require('./audit');
const { trackStudioEvent } = require('./observability');
const { assertNoProviderPreviewUrls } = require('./images');
const {
  createDraftSite,
  getSite,
  ensureUniqueSlug,
  snapshotSite,
  createReplacementDraftRecord,
  discardReplacementDraft
} = require('./site-store');
const { updateDraft, createVersion, saveTemplate, memoryEnabled } = require('../theme-studio/store');

/**
 * Build plan only (no writes).
 */
async function planApplication(input) {
  const prepared = await prepareContext(input);
  if (!prepared.ok) return prepared;

  const useMockImages = memoryEnabled() || input.mockImages === true;
  const imageFinalisation = await finaliseImagesForApplication(prepared.version.draft_config_json, {
    siteId: 'pending',
    draftId: prepared.draft.id,
    mockImport: useMockImages,
    executeImport: !useMockImages && input.executeImageImport !== false,
    importedMap: input.importedMap || null,
    acceptImportPlanAsFinal: input.acceptImportPlanAsFinal === true,
    fetchImpl: input.fetchImpl,
    dryRun: input.imageImportDryRun === true
  });

  const validation = validateForApplication({
    actor: prepared.actor,
    draft: prepared.draft,
    version: prepared.version,
    mode: prepared.mode,
    contactConfirmation: input.contactConfirmation,
    acknowledgeWarnings: input.acknowledgeWarnings === true,
    overrideReason: input.overrideReason,
    targetSite: prepared.targetSite,
    imagePolicy: {
      allowTempUrls: memoryEnabled() || input.mockImages === true,
      allowUnapproved: input.allowUnapprovedImages === true
    }
  });

  // Merge image failures into validation view for plan
  if (!imageFinalisation.ok && prepared.mode !== MODES.PRIVATE_TEMPLATE) {
    for (const f of imageFinalisation.failures) {
      validation.critical.push({
        severity: 'critical',
        code: 'image_' + f.error,
        message: 'Image finalisation failed: ' + f.briefId + ' (' + f.error + ')'
      });
      validation.ok = false;
      validation.blocked = true;
    }
  }

  const plan = buildApplicationPlan({
    mode: prepared.mode,
    draft: prepared.draft,
    version: prepared.version,
    actor: prepared.actor,
    contactConfirmation: input.contactConfirmation,
    siteIdentity: input.siteIdentity,
    targetSite: prepared.targetSite,
    validation,
    imageFinalisation
  });

  if (input.includeRawDiagnostic && prepared.actor.isSuperuser) {
    plan.rawDiagnostic = {
      draftConfigKeys: Object.keys(prepared.version.draft_config_json || {}),
      imageFinalisation,
      validation
    };
  }

  return {
    ok: true,
    plan,
    validation,
    imageFinalisation,
    canCommit: validation.ok && (prepared.mode === MODES.PRIVATE_TEMPLATE || imageFinalisation.ok || memoryEnabled() || input.mockImages === true)
  };
}

/**
 * Execute application after plan confirmation.
 */
async function commitApplication(input) {
  const idempotencyKey = input.idempotencyKey ? String(input.idempotencyKey) : null;
  if (idempotencyKey) {
    const prior = await getIdempotentResult(idempotencyKey);
    if (prior && prior.result) {
      return Object.assign({ ok: true, idempotentReplay: true }, prior.result);
    }
  }

  const startedAt = Date.now();
  trackStudioEvent({
    type: 'application_started',
    actorUserId: input.actor && input.actor.userId,
    draftId: input.draft && input.draft.id,
    conceptId: input.version && input.version.concept_id,
    meta: { mode: input.mode }
  });

  const planned = await planApplication(input);
  if (!planned.ok) return planned;

  const { plan, validation, imageFinalisation } = planned;
  const mode = plan.applicationMode;
  const actor = input.actor;

  if (!input.confirmPlan) {
    return {
      ok: false,
      code: 400,
      error: 'confirm_plan_required',
      message: 'Set confirmPlan:true after reviewing the application plan.',
      plan,
      validation
    };
  }

  if (!validation.ok) {
    const audit = await recordApplicationAudit({
      actorUserId: actor.userId,
      role: actor.isSuperuser ? 'superuser' : actor.isPartner ? 'partner' : 'client',
      sourceConceptId: plan.sourceConceptId,
      sourceVersionId: plan.sourceVersionId,
      sourceDraftId: plan.sourceDraftId,
      applicationMode: mode,
      validationResult: 'blocked',
      warningsAcknowledged: !!input.acknowledgeWarnings,
      overrideReason: input.overrideReason || null,
      success: false,
      failureStage: 'validation',
      idempotencyKey
    });
    const firstCritical =
      validation.critical && validation.critical[0]
        ? validation.critical[0].message || validation.critical[0].code
        : '';
    return {
      ok: false,
      code: 422,
      error: 'validation_blocked',
      message: firstCritical
        ? 'Pre-application validation failed — ' + firstCritical
        : 'Pre-application validation failed',
      plan,
      validation,
      audit: audit.audit
    };
  }

  let result;
  try {
    if (mode === MODES.CREATE_SITE) {
      result = await commitCreateSite({ input, plan, imageFinalisation, actor });
    } else if (mode === MODES.REPLACEMENT_DRAFT) {
      result = await commitReplacementDraft({ input, plan, imageFinalisation, actor });
    } else if (mode === MODES.PRIVATE_TEMPLATE) {
      result = await commitPrivateTemplate({ input, plan, actor });
    } else {
      return { ok: false, code: 400, error: 'invalid_mode' };
    }
  } catch (err) {
    const audit = await recordApplicationAudit({
      actorUserId: actor.userId,
      role: actor.isSuperuser ? 'superuser' : actor.isPartner ? 'partner' : 'client',
      sourceConceptId: plan.sourceConceptId,
      sourceVersionId: plan.sourceVersionId,
      applicationMode: mode,
      validationResult: 'error',
      success: false,
      failureStage: 'commit',
      notice: err && err.message ? err.message : String(err),
      idempotencyKey
    });
    return {
      ok: false,
      code: 500,
      error: 'application_failed',
      message: err && err.message ? err.message : String(err),
      failureStage: 'commit',
      audit: audit.audit,
      published: false,
      liveSiteChanged: false
    };
  }

  const payload = Object.assign(
    {
      published: false,
      liveSiteChanged: false,
      liveWrite: false
    },
    result
  );

  if (idempotencyKey) await setIdempotentResult(idempotencyKey, payload, { actorUserId: actor && actor.userId });
  trackStudioEvent({
    type: payload.ok ? 'application_completed' : 'application_failed',
    actorUserId: actor && actor.userId,
    draftId: input.draft && input.draft.id,
    conceptId: plan.sourceConceptId,
    siteId: (payload.site && payload.site.id) || null,
    durationMs: Date.now() - startedAt,
    success: !!payload.ok,
    diagnosticId: payload.audit && payload.audit.diagnosticId,
    meta: {
      mode,
      resultType: payload.mode || mode,
      published: false,
      editorHandoff: !!(payload.site && payload.nextActions && payload.nextActions.includes('open_editor'))
    }
  });
  return payload;
}

async function prepareContext(input) {
  const actor = input.actor;
  const mode = String(input.mode || '').trim();
  if (!Object.values(MODES).includes(mode)) {
    return { ok: false, code: 400, error: 'invalid_mode', message: 'Use create_site|replacement_draft|private_template' };
  }

  let targetSite = null;
  if (mode === MODES.REPLACEMENT_DRAFT) {
    const siteId = String((input.siteIdentity && input.siteIdentity.targetSiteId) || input.targetSiteId || '').trim();
    if (!siteId) return { ok: false, code: 400, error: 'target_site_required' };
    if (input.targetSite) {
      targetSite = input.targetSite;
    } else {
      const got = await getSite(siteId);
      if (!got.ok) return { ok: false, code: 404, error: 'target_site_not_found' };
      targetSite = got.site;
    }
  }

  const perm = assertApplicationPermission(actor, mode, {
    targetSite,
    templateVisibility: (input.siteIdentity && input.siteIdentity.templateVisibility) || input.templateVisibility
  });
  if (!perm.ok) return perm;

  const draft = input.draft;
  const version = input.version;
  if (!draft || !version) {
    return { ok: false, code: 400, error: 'draft_and_version_required' };
  }

  // Reject client-supplied forged approval on the request body — only draft/version state counts
  if (input.approvalState && input.approvalState !== (draft.meta && draft.meta.approvalState)) {
    return {
      ok: false,
      code: 400,
      error: 'forged_approval_rejected',
      message: 'Client-supplied approvalState is ignored; server draft meta must be approved-for-application'
    };
  }

  return { ok: true, actor, mode, draft, version, targetSite };
}

async function commitCreateSite({ input, plan, imageFinalisation, actor }) {
  const identity = input.siteIdentity || {};
  const concept = input.version.concept_json || {};
  const businessName =
    identity.siteName ||
    (concept.businessProfile && concept.businessProfile.businessName) ||
    'Website Studio Site';
  const slug = identity.slug
    ? await ensureUniqueSlug(identity.slug)
    : await ensureUniqueSlug(businessName);

  // Re-finalise images with real pending site folder once slug known
  const useMockImages = memoryEnabled() || input.mockImages === true;
  const images = await finaliseImagesForApplication(input.version.draft_config_json, {
    siteId: slug,
    draftId: input.draft.id,
    mockImport: useMockImages,
    executeImport: !useMockImages && input.executeImageImport !== false,
    importedMap: input.importedMap || null,
    acceptImportPlanAsFinal: input.acceptImportPlanAsFinal === true,
    fetchImpl: input.fetchImpl,
    dryRun: input.imageImportDryRun === true
  });

  const assembled = plan.assembledConfig;
  if (images.replacements.length) {
    const { assembleDestinationConfig } = require('./assemble');
    const rebuild = assembleDestinationConfig({
      concept,
      draftConfig: input.version.draft_config_json,
      contactConfirmation: input.contactConfirmation,
      imageFinalisation: images,
      provenance: {
        draftId: input.draft.id,
        versionId: input.version.id,
        conceptId: concept.conceptId,
        applicationMode: MODES.CREATE_SITE,
        actorUserId: actor.userId
      }
    });
    Object.assign(assembled, rebuild.config);
  }

  const urlCheck = assertNoProviderPreviewUrls(assembled);
  if (!urlCheck.ok) {
    throw new Error('provider_preview_urls_in_config:' + urlCheck.issues.join(','));
  }

  // Never overwrite a known live Bean Culture site — create always inserts a new draft row
  if (identity.targetSiteId || identity.replaceSiteId) {
    throw new Error('create_site_must_not_target_existing');
  }

  const created = await createDraftSite({
    slug,
    business_name: businessName,
    owner_user_id: identity.ownerUserId || actor.userId,
    owner_email: (input.contactConfirmation && input.contactConfirmation.businessEmail) || null,
    servicing_partner_id: identity.partnerId || actor.partnerId || null,
    referring_partner_id: identity.referringPartnerId || null,
    is_mockup: identity.isMockup === true,
    is_demo: false,
    config: assembled
  });
  if (!created.ok) {
    throw new Error(created.error || 'site_create_failed');
  }

  await updateDraft(input.draft.id, {
    target_site_id: created.site.id,
    status: 'applied',
    applied_config: assembled,
    meta: {
      ...(input.draft.meta || {}),
      lastApplication: {
        mode: MODES.CREATE_SITE,
        siteId: created.site.id,
        at: new Date().toISOString()
      }
    }
  });

  const ver = await createVersion({
    draft_id: input.draft.id,
    concept_id: concept.conceptId || input.version.concept_id,
    kind: 'apply',
    concept_json: concept,
    draft_config_json: assembled,
    adapter_warnings: [{ code: 'application_create_site', message: 'Created draft site ' + created.site.slug }],
    created_by: actor.userId
  });

  const audit = await recordApplicationAudit({
    actorUserId: actor.userId,
    role: actor.isSuperuser ? 'superuser' : actor.isPartner ? 'partner' : 'client',
    sourceConceptId: plan.sourceConceptId,
    sourceVersionId: plan.sourceVersionId,
    sourceDraftId: plan.sourceDraftId,
    destinationSiteId: created.site.id,
    applicationMode: MODES.CREATE_SITE,
    validationResult: 'passed',
    warningsAcknowledged: !!input.acknowledgeWarnings,
    appsInstalled: plan.marketplaceAppsInstalling,
    imagesImported: images.imports,
    resultType: 'new_site',
    success: true,
    resultingSiteId: created.site.id,
    resultingDraftVersionId: ver.ok ? ver.version.id : null,
    idempotencyKey: input.idempotencyKey || null,
    notice: 'Draft site created — not published'
  });

  return {
    ok: true,
    mode: MODES.CREATE_SITE,
    site: created.site,
    plan,
    audit: audit.audit,
    nextActions: ['open_editor', 'view_draft', 'return_to_website_studio'],
    notice: 'Site created as draft. Publishing remains a separate action.'
  };
}

async function commitReplacementDraft({ input, plan, imageFinalisation, actor }) {
  const targetSite = input.targetSite || (await getSite(input.siteIdentity.targetSiteId)).site;
  if (!canManageTargetSite(actor, targetSite)) {
    return { ok: false, code: 403, error: 'cross_tenant_denied' };
  }

  // Immutable snapshot of current live/current config — live row untouched
  const snap = await snapshotSite(targetSite);
  const liveConfigBefore = JSON.parse(JSON.stringify(targetSite.config || {}));

  const useMockImages = memoryEnabled() || input.mockImages === true;
  const images = await finaliseImagesForApplication(input.version.draft_config_json, {
    siteId: targetSite.id,
    draftId: input.draft.id,
    mockImport: useMockImages,
    executeImport: !useMockImages && input.executeImageImport !== false,
    importedMap: input.importedMap || null,
    acceptImportPlanAsFinal: input.acceptImportPlanAsFinal === true,
    fetchImpl: input.fetchImpl,
    dryRun: input.imageImportDryRun === true
  });

  const { assembleDestinationConfig } = require('./assemble');
  const concept = input.version.concept_json || {};
  const rebuild = assembleDestinationConfig({
    concept,
    draftConfig: input.version.draft_config_json,
    contactConfirmation: input.contactConfirmation,
    imageFinalisation: images,
    preserveFromSite: targetSite,
    provenance: {
      draftId: input.draft.id,
      versionId: input.version.id,
      conceptId: concept.conceptId,
      applicationMode: MODES.REPLACEMENT_DRAFT,
      actorUserId: actor.userId
    }
  });

  const replacement = createReplacementDraftRecord({
    source_site_id: targetSite.id,
    snapshot_id: snap.snapshot.id,
    config: rebuild.config,
    meta: {
      conceptId: concept.conceptId,
      versionId: input.version.id,
      liveStatus: targetSite.status,
      liveUnchanged: true
    }
  });

  await updateDraft(input.draft.id, {
    source_site_id: targetSite.id,
    applied_config: rebuild.config,
    meta: {
      ...(input.draft.meta || {}),
      replacementDraftId: replacement.replacementDraft.id,
      replacementSnapshotId: snap.snapshot.id,
      lastApplication: {
        mode: MODES.REPLACEMENT_DRAFT,
        siteId: targetSite.id,
        at: new Date().toISOString()
      }
    }
  });

  const ver = await createVersion({
    draft_id: input.draft.id,
    concept_id: concept.conceptId || input.version.concept_id,
    kind: 'apply',
    concept_json: concept,
    draft_config_json: rebuild.config,
    adapter_warnings: [
      {
        code: 'application_replacement_draft',
        message: 'Replacement draft created; live site unchanged'
      }
    ],
    created_by: actor.userId
  });

  // Verify live config object equality for in-memory sites
  const liveAfter = targetSite.config;
  const liveUnchanged = JSON.stringify(liveConfigBefore) === JSON.stringify(liveAfter);

  const audit = await recordApplicationAudit({
    actorUserId: actor.userId,
    role: actor.isSuperuser ? 'superuser' : actor.isPartner ? 'partner' : 'client',
    sourceConceptId: plan.sourceConceptId,
    sourceVersionId: plan.sourceVersionId,
    destinationSiteId: targetSite.id,
    applicationMode: MODES.REPLACEMENT_DRAFT,
    validationResult: 'passed',
    warningsAcknowledged: !!input.acknowledgeWarnings,
    appsInstalled: plan.marketplaceAppsInstalling,
    imagesImported: images.imports,
    resultType: 'replacement_draft',
    success: true,
    resultingDraftVersionId: ver.ok ? ver.version.id : null,
    idempotencyKey: input.idempotencyKey || null,
    notice: 'Replacement draft created — live site unchanged'
  });

  return {
    ok: true,
    mode: MODES.REPLACEMENT_DRAFT,
    replacementDraft: replacement.replacementDraft,
    snapshot: snap.snapshot,
    targetSite: { id: targetSite.id, slug: targetSite.slug, status: targetSite.status },
    liveSiteUnchanged: liveUnchanged,
    plan,
    audit: audit.audit,
    nextActions: ['compare_replacement', 'view_draft', 'discard_replacement', 'return_to_website_studio'],
    notice: 'Replacement draft created. Live website was not modified. Publishing remains a separate action.'
  };
}

async function commitPrivateTemplate({ input, plan, actor }) {
  const concept = input.version.concept_json || {};
  const visibility = (input.siteIdentity && input.siteIdentity.templateVisibility) || 'private';
  const tmpl = assemblePrivateTemplate(concept, input.version.draft_config_json, {
    visibility,
    includeTestimonials: input.includeTestimonials === true
  });

  const name =
    (input.siteIdentity && input.siteIdentity.templateName) ||
    input.templateName ||
    ((concept.businessProfile && concept.businessProfile.businessName) || 'Website') + ' template';

  const saved = await saveTemplate({
    owner_user_id: actor.userId,
    partner_id: actor.partnerId || null,
    name,
    foundation_id: tmpl.meta.foundationId,
    concept_json: tmpl.concept_json,
    draft_config_json: tmpl.draft_config_json,
    visibility: visibility === 'platform' && actor.isSuperuser ? 'private' : 'private',
    status: 'active',
    meta: tmpl.meta
  });
  if (!saved.ok) throw new Error(saved.error || 'template_save_failed');

  // Never public Marketplace publish in Phase 5
  if (saved.template.visibility === 'public') {
    throw new Error('public_marketplace_publish_forbidden');
  }

  await createVersion({
    draft_id: input.draft.id,
    concept_id: concept.conceptId || input.version.concept_id,
    kind: 'template',
    concept_json: tmpl.concept_json,
    draft_config_json: tmpl.draft_config_json,
    adapter_warnings: [{ code: 'private_template_saved', message: name }],
    created_by: actor.userId
  });

  const audit = await recordApplicationAudit({
    actorUserId: actor.userId,
    role: actor.isSuperuser ? 'superuser' : actor.isPartner ? 'partner' : 'client',
    sourceConceptId: plan.sourceConceptId,
    sourceVersionId: plan.sourceVersionId,
    applicationMode: MODES.PRIVATE_TEMPLATE,
    validationResult: 'passed',
    resultType: 'private_template',
    success: true,
    resultingTemplateId: saved.template.id,
    idempotencyKey: input.idempotencyKey || null,
    notice: 'Private template saved — not published to Marketplace'
  });

  return {
    ok: true,
    mode: MODES.PRIVATE_TEMPLATE,
    template: saved.template,
    plan,
    audit: audit.audit,
    nextActions: ['return_to_website_studio'],
    notice: 'Private template saved. Public Marketplace publishing is not enabled.'
  };
}

module.exports = {
  planApplication,
  commitApplication,
  discardReplacementDraft,
  MODES
};
