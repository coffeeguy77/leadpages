'use strict';

/**
 * Safe destination config assembler for Website Studio application.
 * Does not copy the entire draft object; strips Studio diagnostics.
 */

const { PROTECTED_FIELDS } = require('../theme-studio/constants');
const { PHASE4_SECTION_KEYS, RENDERER_SHELL_NEUTRAL_V1 } = require('../website-composer/constants');

const STUDIO_ONLY_KEYS = Object.freeze([
  '__themeStudioPreview',
  '__websiteStudioPreview',
  '__wsShellNeutralize'
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value == null ? null : value));
}

/**
 * Strip temporary Website Studio fields from a draft config.
 * Retains a namespaced provenance blob under __websiteStudioSource (internal).
 */
function stripStudioDiagnostics(draftConfig, provenance) {
  const cfg = clone(draftConfig || {}) || {};
  for (const key of STUDIO_ONLY_KEYS) delete cfg[key];
  for (const key of PROTECTED_FIELDS) delete cfg[key];

  const composer = cfg.__websiteComposer && typeof cfg.__websiteComposer === 'object'
    ? { ...cfg.__websiteComposer }
    : {};
  // Drop ephemeral generation noise from public site config
  delete composer.diagnostics;
  delete composer.qualityGate;
  delete composer.imageCache;
  delete composer.providerErrors;
  delete composer.discarded;
  delete composer.candidates;
  delete composer.recipeCandidates;
  // Keep installedApps / approval / shell for provenance but store cleanly
  cfg.__websiteComposer = {
    contentInheritance: 'none',
    sourceTemplateId: null,
    rendererShellId: composer.rendererShellId || RENDERER_SHELL_NEUTRAL_V1,
    installedApps: composer.installedApps || [],
    approvalState: composer.approvalState || null,
    appliedFromWebsiteStudio: true
  };

  cfg.__websiteStudioSource = {
    conceptId: provenance.conceptId || null,
    versionId: provenance.versionId || null,
    draftId: provenance.draftId || null,
    foundationId: provenance.foundationId || null,
    recipeId: provenance.recipeId || null,
    appliedAt: provenance.appliedAt || new Date().toISOString(),
    applicationMode: provenance.applicationMode || null,
    actorUserId: provenance.actorUserId || null
  };

  return cfg;
}

/**
 * Build destination site config from approved concept + draft version.
 * @param {object} input
 */
function assembleDestinationConfig(input) {
  const {
    concept,
    draftConfig,
    contactConfirmation,
    imageFinalisation,
    preserveFromSite,
    provenance
  } = input;

  const assembled = stripStudioDiagnostics(draftConfig, {
    ...(provenance || {}),
    foundationId: (concept && concept.foundationId) || null,
    recipeId: (concept && concept.recipeId) || null,
    conceptId: (concept && concept.conceptId) || (provenance && provenance.conceptId) || null
  });

  // Identity from concept / confirmation
  const bp = (concept && concept.businessProfile) || {};
  const contact = contactConfirmation || {};
  if (contact.businessName || bp.businessName) {
    assembled.name = String(contact.businessName || bp.businessName);
  }
  if (contact.phone) assembled.phone = String(contact.phone);
  if (contact.email) assembled.email = String(contact.email);
  if (contact.address) assembled.address = String(contact.address);

  // Forms — require explicit confirmation; never inherit fixture recipients
  assembled.sections = assembled.sections || {};
  if (assembled.sections.quote && typeof assembled.sections.quote === 'object') {
    const quote = { ...assembled.sections.quote };
    if (contact.leadRecipientEmail) {
      quote.notifyMode = 'custom';
      quote.notifyEmail = String(contact.leadRecipientEmail);
    } else {
      delete quote.notifyEmail;
      delete quote.notifyMode;
    }
    if (contact.formSuccessMessage) quote.successMessage = String(contact.formSuccessMessage);
    if (contact.consentText) quote.consentText = String(contact.consentText);
    assembled.sections.quote = quote;
  }

  // Finalised images replace temporary URLs
  if (imageFinalisation && Array.isArray(imageFinalisation.replacements)) {
    applyImageReplacements(assembled, imageFinalisation.replacements);
  }

  // Preserve destination-specific operational settings when replacing
  if (preserveFromSite && preserveFromSite.config) {
    const src = preserveFromSite.config;
    for (const key of PROTECTED_FIELDS) {
      if (src[key] !== undefined) {
        // Never put protected operational keys into assembled design config
        // except we keep them off the design config entirely.
      }
    }
    // Preserve analytics/tracking only as metadata note — not copied into design config
  }

  // Ensure Phase 4 apps stay as section objects if present
  for (const key of PHASE4_SECTION_KEYS) {
    if (assembled.sections[key] && assembled.sections[key].on !== false) {
      assembled.sections[key].provenance =
        assembled.sections[key].provenance || 'Website Studio Application';
    }
  }

  // Draft sites must remain noindex until normal publish
  assembled.seo = assembled.seo && typeof assembled.seo === 'object' ? { ...assembled.seo } : {};
  assembled.seo.noindex = true;
  assembled.seo.robots = 'noindex,nofollow';
  if (!assembled.seo.title && assembled.name) {
    assembled.seo.title = assembled.name;
  }

  return {
    ok: true,
    config: assembled,
    excludedFields: [...PROTECTED_FIELDS, ...STUDIO_ONLY_KEYS, 'diagnostics', 'imageCache']
  };
}

function applyImageReplacements(config, replacements) {
  for (const rep of replacements) {
    if (!rep || !rep.path || !rep.url) continue;
    setPath(config, rep.path, rep.url);
    if (rep.attributionPath && rep.attribution) {
      setPath(config, rep.attributionPath, rep.attribution);
    }
  }
}

function setPath(target, path, value) {
  const parts = String(path).split('.');
  let cur = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!cur[key] || typeof cur[key] !== 'object') cur[key] = {};
    cur = cur[key];
  }
  cur[parts[parts.length - 1]] = value;
}

/**
 * Build a reusable private template payload (strips private customer data).
 */
function assemblePrivateTemplate(concept, draftConfig, meta) {
  const cfg = stripStudioDiagnostics(draftConfig, {
    applicationMode: 'private_template',
    conceptId: concept && concept.conceptId,
    foundationId: concept && concept.foundationId,
    recipeId: concept && concept.recipeId
  });

  // Remove customer-specific fields
  delete cfg.email;
  delete cfg.phone;
  delete cfg.address;
  delete cfg.owner_email;
  if (cfg.sections && cfg.sections.quote) {
    const q = { ...cfg.sections.quote };
    delete q.notifyEmail;
    delete q.notifyMode;
    q.heading = q.heading || 'Get in touch';
    cfg.sections.quote = q;
  }

  // Parameterise business name in common fields
  const businessName = (concept && concept.businessProfile && concept.businessProfile.businessName) || '';
  if (businessName) {
    const placeholder = '{{businessName}}';
    cfg.name = placeholder;
    walkReplaceString(cfg, businessName, placeholder);
  }

  // Strip customer testimonials unless explicitly kept
  if (cfg.sections && cfg.sections.reviews && meta && meta.includeTestimonials !== true) {
    cfg.sections.reviews = {
      on: true,
      heading: 'What clients say',
      items: [],
      provenance: 'Template placeholder'
    };
  }

  const templateConcept = clone(concept || {});
  if (templateConcept.businessProfile) {
    templateConcept.businessProfile = {
      ...templateConcept.businessProfile,
      businessName: '{{businessName}}',
      phone: null,
      email: null
    };
  }

  return {
    ok: true,
    concept_json: templateConcept,
    draft_config_json: cfg,
    meta: {
      foundationId: concept && concept.foundationId,
      recipeId: concept && concept.recipeId,
      imageDirection: (draftConfig && draftConfig.__websiteComposer && draftConfig.__websiteComposer.imageDirection) || null,
      adapterVersions: { websiteComposer: 1 },
      strippedPrivateData: true,
      visibility: (meta && meta.visibility) || 'private'
    }
  };
}

function walkReplaceString(node, from, to) {
  if (!node || !from) return;
  if (typeof node === 'string') return;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      if (typeof node[i] === 'string' && node[i].includes(from)) {
        node[i] = node[i].split(from).join(to);
      } else if (node[i] && typeof node[i] === 'object') {
        walkReplaceString(node[i], from, to);
      }
    }
    return;
  }
  if (typeof node === 'object') {
    for (const key of Object.keys(node)) {
      if (typeof node[key] === 'string' && node[key].includes(from)) {
        node[key] = node[key].split(from).join(to);
      } else if (node[key] && typeof node[key] === 'object') {
        walkReplaceString(node[key], from, to);
      }
    }
  }
}

module.exports = {
  assembleDestinationConfig,
  assemblePrivateTemplate,
  stripStudioDiagnostics,
  STUDIO_ONLY_KEYS
};
