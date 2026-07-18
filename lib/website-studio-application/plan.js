'use strict';

/**
 * Application plan + human-readable diff for Website Studio Phase 5.
 */

const { assembleDestinationConfig, assemblePrivateTemplate } = require('./assemble');
const { MODES } = require('./permissions');

function buildApplicationPlan(input) {
  const {
    mode,
    draft,
    version,
    actor,
    contactConfirmation,
    siteIdentity,
    targetSite,
    validation,
    imageFinalisation
  } = input;

  const concept = (version && version.concept_json) || {};
  const draftConfig = (version && version.draft_config_json) || {};
  const assembled =
    mode === MODES.PRIVATE_TEMPLATE
      ? null
      : assembleDestinationConfig({
          concept,
          draftConfig,
          contactConfirmation,
          imageFinalisation,
          preserveFromSite: targetSite || null,
          provenance: {
            draftId: draft && draft.id,
            versionId: version && version.id,
            conceptId: concept.conceptId,
            applicationMode: mode,
            actorUserId: actor && actor.userId
          }
        });

  const apps = (draftConfig.sectionOrder || concept.sectionOrder || []).slice();
  const installed = ((draftConfig.__websiteComposer && draftConfig.__websiteComposer.installedApps) || []).map(
    (a) => (typeof a === 'string' ? a : a.appId || a.sectionKey)
  );

  const plan = {
    sourceConceptId: concept.conceptId || null,
    sourceVersionId: version && version.id,
    sourceDraftId: draft && draft.id,
    destinationAccount: {
      ownerUserId: (siteIdentity && siteIdentity.ownerUserId) || (actor && actor.userId) || null,
      partnerId: (siteIdentity && siteIdentity.partnerId) || (actor && actor.partnerId) || null
    },
    applicationMode: mode,
    siteToCreate:
      mode === MODES.CREATE_SITE
        ? {
            name: (siteIdentity && siteIdentity.siteName) || (concept.businessProfile && concept.businessProfile.businessName),
            slug: (siteIdentity && siteIdentity.slug) || null,
            status: 'draft',
            published: false
          }
        : null,
    replacementTarget:
      mode === MODES.REPLACEMENT_DRAFT && targetSite
        ? {
            siteId: targetSite.id,
            slug: targetSite.slug,
            liveStatus: targetSite.status,
            liveUnchanged: true
          }
        : null,
    foundation: concept.foundationId || null,
    recipe: concept.recipeId || null,
    marketplaceAppsInstalling: installed.length ? installed : apps,
    existingAppsPreserved: [],
    existingAppsDisabled: [],
    sectionOrder: apps,
    themeChanges: summariseTheme(draftConfig.theme, targetSite && targetSite.config && targetSite.config.theme),
    typographyChanges: draftConfig.typography || concept.typography || null,
    navigationChanges: draftConfig.navigation || concept.navigation || null,
    contentChanges: { sections: apps.length, note: 'Full Website Studio concept content' },
    imageImports: (imageFinalisation && imageFinalisation.imports) || [],
    formConfiguration: {
      leadRecipientEmail: contactConfirmation && contactConfirmation.leadRecipientEmail,
      businessEmail: contactConfirmation && contactConfirmation.businessEmail,
      confirmed: !!(contactConfirmation && contactConfirmation.confirmed)
    },
    seoChanges: {
      title: (assembled && assembled.config && assembled.config.seo && assembled.config.seo.title) || draftConfig.seoTitle,
      noindex: true
    },
    dataIntentionallyNotTransferred: [
      'lead history',
      'CRM records',
      'analytics IDs',
      'domain associations',
      'billing',
      'partner commission fields',
      'Website Studio diagnostics',
      'temporary image provider URLs (replaced or blocked)'
    ],
    warnings: (validation && validation.warnings) || [],
    blockingIssues: (validation && validation.critical) || [],
    humanSummary: [],
    diff: null,
    rawDiagnostic: null
  };

  plan.humanSummary = buildHumanSummary(plan);

  if (mode === MODES.REPLACEMENT_DRAFT && targetSite) {
    plan.diff = buildHumanDiff(targetSite.config || {}, assembled && assembled.config);
    plan.existingAppsPreserved = listActiveSections(targetSite.config).filter((k) => apps.includes(k));
    plan.existingAppsDisabled = listActiveSections(targetSite.config).filter((k) => !apps.includes(k));
  }

  if (mode === MODES.PRIVATE_TEMPLATE) {
    const tmpl = assemblePrivateTemplate(concept, draftConfig, {
      visibility: (siteIdentity && siteIdentity.templateVisibility) || 'private'
    });
    plan.templatePreview = {
      strippedPrivateData: true,
      foundationId: tmpl.meta.foundationId,
      recipeId: tmpl.meta.recipeId
    };
  }

  plan.assembledConfig = assembled ? assembled.config : null;
  return plan;
}

function summariseTheme(nextTheme, prevTheme) {
  if (!nextTheme) return { changed: false };
  if (!prevTheme) return { changed: true, next: nextTheme };
  const keys = ['pipe', 'hivis', 'steel', 'safety', 'lightBg', 'presetName'];
  const changes = {};
  for (const k of keys) {
    if (nextTheme[k] !== prevTheme[k]) changes[k] = { from: prevTheme[k], to: nextTheme[k] };
  }
  return { changed: Object.keys(changes).length > 0, changes };
}

function listActiveSections(config) {
  if (!config || !config.sections) return [];
  return Object.keys(config.sections).filter((k) => config.sections[k] && config.sections[k].on !== false);
}

function buildHumanSummary(plan) {
  const lines = [];
  lines.push('Mode: ' + plan.applicationMode);
  lines.push('Foundation: ' + (plan.foundation || '—'));
  lines.push('Recipe: ' + (plan.recipe || '—'));
  lines.push('Apps: ' + (plan.marketplaceAppsInstalling || []).join(', '));
  if (plan.siteToCreate) {
    lines.push('Will create draft site: ' + plan.siteToCreate.name + ' (not published)');
  }
  if (plan.replacementTarget) {
    lines.push(
      'Will create replacement draft for ' +
        plan.replacementTarget.slug +
        ' — live site remains ' +
        plan.replacementTarget.liveStatus
    );
  }
  if (plan.blockingIssues && plan.blockingIssues.length) {
    lines.push('Blocked by ' + plan.blockingIssues.length + ' critical issue(s)');
  } else {
    lines.push('No critical blockers in plan');
  }
  return lines;
}

function buildHumanDiff(before, after) {
  const groups = {
    global: [],
    navigation: [],
    sections: [],
    apps: [],
    content: [],
    images: [],
    forms: [],
    seo: [],
    tracking: [],
    integrations: []
  };

  if (!before) before = {};
  if (!after) after = {};

  if (before.name !== after.name) {
    groups.global.push({ field: 'name', from: before.name, to: after.name });
  }
  if (JSON.stringify(before.theme || {}) !== JSON.stringify(after.theme || {})) {
    groups.global.push({ field: 'theme', change: 'updated' });
  }
  if (JSON.stringify(before.navigation || {}) !== JSON.stringify(after.navigation || {})) {
    groups.navigation.push({ field: 'navigation', change: 'updated' });
  }

  const beforeOrder = before.sectionOrder || [];
  const afterOrder = after.sectionOrder || [];
  if (beforeOrder.join('|') !== afterOrder.join('|')) {
    groups.sections.push({
      field: 'sectionOrder',
      from: beforeOrder,
      to: afterOrder
    });
  }

  const beforeApps = listActiveSections(before);
  const afterApps = listActiveSections(after);
  for (const a of afterApps.filter((x) => !beforeApps.includes(x))) {
    groups.apps.push({ field: a, change: 'installed' });
  }
  for (const a of beforeApps.filter((x) => !afterApps.includes(x))) {
    groups.apps.push({ field: a, change: 'disabled' });
  }

  if (JSON.stringify((before.sections && before.sections.quote) || {}) !== JSON.stringify((after.sections && after.sections.quote) || {})) {
    groups.forms.push({ field: 'quote', change: 'updated', note: 'Recipient must be confirmed' });
  }

  const beforeSeo = before.seo || {};
  const afterSeo = after.seo || {};
  if (JSON.stringify(beforeSeo) !== JSON.stringify(afterSeo)) {
    groups.seo.push({ field: 'seo', change: 'updated', noindex: afterSeo.noindex === true });
  }

  groups.tracking.push({
    field: 'analytics',
    change: 'preserved_on_live_site',
    note: 'Analytics/tracking not copied into replacement draft design config'
  });
  groups.integrations.push({
    field: 'crm_billing_domains',
    change: 'not_transferred',
    note: 'Operational integrations remain on the live site record'
  });

  return groups;
}

module.exports = {
  buildApplicationPlan,
  buildHumanDiff
};
