'use strict';

/**
 * Explicit draft composition — NO shallow merge from trade / source content.
 *
 * Starts from an empty config skeleton, writes every active section fully,
 * and disables every other known section so renderer defaults cannot bleed
 * plumber/landscaping copy into non-trade sites.
 */

const {
  KNOWN_SECTION_KEYS,
  LAYOUT_IDS,
  PROTECTED_FIELDS,
  RENDERER_SHELL_NEUTRAL_V1,
  RENDERER_SHELL_ASSETS
} = require('./constants');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {object} input
 * @param {object} input.concept
 * @param {object} input.foundation
 * @param {object} input.recipe
 * @param {Record<string, string>} input.provenanceMap
 * @param {Record<string, string>} input.imageBriefs
 * @param {object[]} [input.installedApps]
 * @param {object[]} [input.imageSelections]
 * @param {object} [input.imageDirection]
 * @param {object} [input.imageDiagnostics]
 */
function buildDraftConfig(input) {
  const concept = input.concept || {};
  const foundation = input.foundation || {};
  const recipe = input.recipe || {};
  const provenanceMap = input.provenanceMap || {};
  const imageBriefs = input.imageBriefs || {};
  const installedApps = input.installedApps || concept.installedApps || [];
  const imageSelections = input.imageSelections || concept.imagery || [];
  const imageDirection = input.imageDirection || concept.imageDirection || null;
  const imageDiagnostics = input.imageDiagnostics || null;
  /** @type {Array<{ code: string, message: string, path?: string }>} */
  const warnings = [];
  /** @type {Array<{ code: string, message: string, path?: string }>} */
  const errors = [];
  /** @type {string[]} */
  const writtenPaths = [];
  /** @type {string[]} */
  const sectionsSkipped = [];

  const draft = {
    name: '',
    trade: '',
    region: '',
    layout: '',
    sectionOrder: [],
    sections: {},
    services: [],
    pages: [],
    theme: {},
    seoTitle: '',
    seoDescription: '',
    logo: {},
    // Composer metadata (preview/diagnostics; not a live operational field)
    __websiteComposer: {
      foundationId: foundation.id || null,
      recipeId: recipe.id || null,
      rendererShellId: RENDERER_SHELL_NEUTRAL_V1,
      rendererShellAsset: RENDERER_SHELL_ASSETS[RENDERER_SHELL_NEUTRAL_V1],
      // Explicit: shell asset is technical only — content was composed, not cloned.
      contentInheritance: 'none',
      provenance: provenanceMap,
      imageBriefs,
      installedApps,
      imageSelections,
      imageDirection,
      imageDiagnostics,
      neutralizeShellDefaults: true,
      approvalState: (concept && concept.approvalState) || 'draft'
    }
  };

  const bp = concept.businessProfile || {};
  if (bp.businessName) {
    draft.name = String(bp.businessName);
    draft.business = String(bp.businessName);
    draft.trade = String(bp.industry || bp.businessName);
    writtenPaths.push('name', 'business', 'trade');
  }
  if (bp.location) {
    draft.region = String(bp.location);
    writtenPaths.push('region');
  }
  // Prefer a real phone; never invent "Call us" (it becomes "Call Call us" in the shell).
  const phone =
    String((concept.callsToAction && concept.callsToAction.phone) || bp.phone || bp.phoneCta || '').trim();
  if (phone) {
    draft.phone = phone;
    draft.phoneText = phone;
    writtenPaths.push('phone', 'phoneText');
  } else {
    draft.phone = '';
    draft.phoneText = '';
  }

  if (concept.theme && typeof concept.theme === 'object') {
    draft.theme = {};
    for (const key of ['pipe', 'hivis', 'steel', 'safety', 'lightBg', 'accent', 'presetName', 'presetKey']) {
      if (concept.theme[key] != null) {
        draft.theme[key] = concept.theme[key];
        writtenPaths.push('theme.' + key);
      }
    }
    draft.theme.fonts = {};
    if (concept.typography) {
      if (concept.typography.fontDisplay) {
        draft.theme.fonts.fontDisplay = concept.typography.fontDisplay;
        writtenPaths.push('theme.fonts.fontDisplay');
      }
      if (concept.typography.fontUi) {
        draft.theme.fonts.fontUi = concept.typography.fontUi;
        writtenPaths.push('theme.fonts.fontUi');
      }
    }
  }

  if (typeof concept.layoutId === 'string') {
    if (!LAYOUT_IDS.includes(concept.layoutId)) {
      errors.push({ code: 'layout_unknown', message: 'Rejected layoutId', path: 'layoutId' });
    } else {
      draft.layout = concept.layoutId;
      writtenPaths.push('layout');
    }
  }

  const order = (Array.isArray(concept.sectionOrder) ? concept.sectionOrder : [])
    .map(String)
    .filter((key) => KNOWN_SECTION_KEYS.includes(key));
  draft.sectionOrder = order;
  writtenPaths.push('sectionOrder');

  const active = new Set(order);

  // Explicitly disable every known section not in the composition.
  for (const key of KNOWN_SECTION_KEYS) {
    if (active.has(key)) continue;
    draft.sections[key] = {
      on: false,
      provenance: 'Foundation',
      disabledReason: 'not_in_composition'
    };
    sectionsSkipped.push(key);
    writtenPaths.push('sections.' + key);
  }

  // Compose active sections from concept — replace wholesale, never merge source.
  if (concept.sections && typeof concept.sections === 'object') {
    for (const key of order) {
      const incoming = concept.sections[key];
      if (!incoming || typeof incoming !== 'object') {
        errors.push({
          code: 'section_incomplete',
          message: 'Active section missing composed content: ' + key,
          path: 'sections.' + key
        });
        continue;
      }
      const content =
        incoming.content && typeof incoming.content === 'object' ? { ...incoming.content } : {};
      // Flatten content + top-level adapter fields for renderer/manage expectations
      const next = {
        on: incoming.on != null ? incoming.on : true,
        provenance: incoming.provenance || provenanceMap[key] || 'AI Generated'
      };
      for (const [ck, cv] of Object.entries(content)) {
        if (PROTECTED_FIELDS.includes(ck)) continue;
        next[ck] = cv;
      }
      for (const [ck, cv] of Object.entries(incoming)) {
        if (ck === 'content' || ck === 'on' || ck === 'provenance') continue;
        if (PROTECTED_FIELDS.includes(ck)) continue;
        if (next[ck] == null) next[ck] = clone(cv);
      }
      // Preserve list payloads
      if (Array.isArray(incoming.items)) next.items = clone(incoming.items);
      if (incoming.variant) next.variant = incoming.variant;

      // Hero dual-field mapping for trade HTML shell
      if (key === 'hero') {
        if (next.heading && !next.title) next.title = next.heading;
        if (next.subheading && !next.sub) next.sub = next.subheading;
      }

      draft.sections[key] = next;
      writtenPaths.push('sections.' + key);
    }
  }

  if (Array.isArray(concept.services)) {
    draft.services = clone(concept.services);
    writtenPaths.push('services');
  } else if (draft.sections.services && Array.isArray(draft.sections.services.items)) {
    draft.services = clone(draft.sections.services.items);
    writtenPaths.push('services');
  }

  if (concept.header && concept.header.headerStyle) {
    draft.logo.headerStyle = concept.header.headerStyle;
    writtenPaths.push('logo.headerStyle');
  }

  if (bp.businessName) {
    draft.seoTitle = String(bp.businessName) + (bp.location ? ' · ' + bp.location : '');
    writtenPaths.push('seoTitle');
    if (concept.rationale) {
      draft.seoDescription = String(concept.rationale).slice(0, 160);
      writtenPaths.push('seoDescription');
    }
  }

  if (concept.callsToAction?.primary?.label) {
    const label = concept.callsToAction.primary.label;
    if (draft.sections.hero) {
      draft.sections.hero = { ...draft.sections.hero, cta: label };
      writtenPaths.push('sections.hero.cta');
    }
    if (draft.sections.quote) {
      draft.sections.quote = { ...draft.sections.quote, buttonText: label };
      writtenPaths.push('sections.quote.buttonText');
    }
  }

  // Guard: never allow protected fields
  for (const key of PROTECTED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(draft, key)) {
      delete draft[key];
      warnings.push({
        code: 'protected_field_stripped',
        message: 'Stripped protected field: ' + key,
        path: key
      });
    }
  }

  // Completeness: every active section must be on + populated
  for (const key of order) {
    const sec = draft.sections[key];
    if (!sec || sec.on === false) {
      errors.push({
        code: 'section_not_active',
        message: 'Active section not enabled: ' + key,
        path: 'sections.' + key
      });
      continue;
    }
    const hasText =
      sec.title ||
      sec.heading ||
      sec.sub ||
      sec.subheading ||
      sec.text ||
      sec.intro ||
      sec.blurb ||
      sec.cta ||
      sec.buttonText ||
      (Array.isArray(sec.items) && sec.items.length);
    if (!hasText) {
      warnings.push({
        code: 'section_thin_content',
        message: 'Section has limited content: ' + key,
        path: 'sections.' + key
      });
    }
  }

  if (!draft.__websiteComposer.contentInheritance || draft.__websiteComposer.contentInheritance !== 'none') {
    errors.push({
      code: 'inheritance_violation',
      message: 'Draft must not inherit trade template content'
    });
  }

  return {
    ok: errors.length === 0,
    draftConfig: errors.length === 0 ? draft : null,
    errors,
    warnings,
    writtenPaths: [...new Set(writtenPaths)],
    sectionsSkipped,
    published: false,
    mutatedSource: false
  };
}

module.exports = {
  buildDraftConfig,
  clone
};
