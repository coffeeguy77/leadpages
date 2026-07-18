'use strict';

const {
  WRITABLE_CONFIG_PATHS,
  PROTECTED_FIELDS,
  KNOWN_SECTION_KEYS,
  LAYOUT_IDS,
  TRADE_ONLY_SECTION_KEYS
} = require('./constants');
const { validateConcept } = require('./validate-concept');
const { getFoundation } = require('./foundations');

/**
 * Map Theme Studio concept section fields onto trade renderer keys
 * (manage.html / trade.template.json applyCfg).
 * @param {string} sectionKey
 * @param {Record<string, unknown>} section
 */
function normalizeSectionForRenderer(sectionKey, section) {
  const next = { ...section };
  if (sectionKey === 'hero') {
    if (next.title == null && next.heading != null) next.title = next.heading;
    if (next.sub == null && next.subheading != null) next.sub = next.subheading;
    if (next.quoteText == null && next.cta != null) next.quoteText = next.cta;
    if (next.callText == null && next.cta != null) next.callText = next.cta;
    delete next.heading;
    delete next.subheading;
  }
  if (sectionKey === 'services' && Array.isArray(next.items)) {
    next.items = next.items.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const row = { ...item };
      if (row.body == null && row.text != null) row.body = row.text;
      return row;
    });
  }
  return next;
}

/**
 * Ensure services[] uses renderer body field.
 * @param {unknown[]} services
 */
function normalizeServices(services) {
  return (services || []).map((item) => {
    if (!item || typeof item !== 'object') return item;
    const row = { ...item, on: item.on !== false };
    if (row.body == null && row.text != null) row.body = row.text;
    return row;
  });
}

/**
 * Deep clone via JSON (concepts/configs are plain data).
 * @template T
 * @param {T} value
 * @returns {T}
 */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {Record<string, unknown>} target
 * @param {string} path
 * @param {unknown} value
 */
function setPath(target, path, value) {
  const parts = path.split('.');
  let cur = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!cur[key] || typeof cur[key] !== 'object' || Array.isArray(cur[key])) {
      cur[key] = {};
    }
    cur = /** @type {Record<string, unknown>} */ (cur[key]);
  }
  cur[parts[parts.length - 1]] = value;
}

/**
 * Strip protected top-level keys from a config object (non-mutating).
 * @param {Record<string, unknown>} config
 */
function omitProtected(config) {
  const out = {};
  for (const [key, value] of Object.entries(config)) {
    if (PROTECTED_FIELDS.includes(key)) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Deterministic adapter: validated Theme Studio concept → draft sites.config snapshot.
 *
 * - Never mutates sourceConfig
 * - Never publishes
 * - Never writes protected operational fields
 * - Only maps allowlisted concept fields onto verified config paths
 *
 * @param {object} concept
 * @param {object|null|undefined} sourceConfig
 * @param {{ skipValidation?: boolean }} [opts]
 */
function adaptConceptToSiteConfig(concept, sourceConfig, opts) {
  const options = opts || {};
  /** @type {Array<{ code: string, message: string, path?: string }>} */
  const warnings = [];
  /** @type {Array<{ code: string, message: string, path?: string }>} */
  const ignoredFields = [];
  /** @type {Array<{ code: string, message: string, path?: string }>} */
  const errors = [];

  if (!options.skipValidation) {
    const validated = validateConcept(concept, { checkLeakage: true });
    if (!validated.ok) {
      return {
        ok: false,
        draftConfig: null,
        errors: validated.errors,
        warnings: validated.warnings,
        ignoredFields: [],
        writtenPaths: [],
        published: false,
        mutatedSource: false
      };
    }
    warnings.push(...validated.warnings);
  }

  const c = /** @type {Record<string, any>} */ (concept);
  const sourceSnapshot = sourceConfig && typeof sourceConfig === 'object' ? clone(sourceConfig) : {};
  const sourceFrozen = clone(sourceSnapshot);

  // Start from source (minus protected), then overlay allowlisted writes
  const draft = omitProtected(sourceSnapshot);
  /** @type {string[]} */
  const writtenPaths = [];

  const foundation = getFoundation(c.foundationId);

  // Identity / marketing fields (writable)
  if (c.businessProfile) {
    const bp = c.businessProfile;
    if (bp.businessName) {
      draft.name = String(bp.businessName);
      writtenPaths.push('name');
      draft.trade = String(bp.businessName);
      writtenPaths.push('trade');
    }
    if (bp.location) {
      draft.region = String(bp.location);
      writtenPaths.push('region');
    }
  }

  if (c.theme && typeof c.theme === 'object') {
    draft.theme = draft.theme && typeof draft.theme === 'object' ? { ...draft.theme } : {};
    for (const key of ['pipe', 'hivis', 'steel', 'safety', 'lightBg', 'accent', 'presetName', 'presetKey']) {
      if (c.theme[key] != null) {
        draft.theme[key] = c.theme[key];
        writtenPaths.push('theme.' + key);
      }
    }
    if (c.typography && typeof c.typography === 'object') {
      draft.theme.fonts = draft.theme.fonts && typeof draft.theme.fonts === 'object'
        ? { ...draft.theme.fonts }
        : {};
      if (c.typography.fontDisplay) {
        draft.theme.fonts.fontDisplay = c.typography.fontDisplay;
        writtenPaths.push('theme.fonts.fontDisplay');
      }
      if (c.typography.fontUi) {
        draft.theme.fonts.fontUi = c.typography.fontUi;
        writtenPaths.push('theme.fonts.fontUi');
      }
    }
  }

  if (typeof c.layoutId === 'string') {
    if (!LAYOUT_IDS.includes(c.layoutId)) {
      errors.push({
        code: 'layout_unknown',
        message: 'Rejected layoutId',
        path: 'layoutId'
      });
    } else {
      draft.layout = c.layoutId;
      writtenPaths.push('layout');
    }
  }

  if (Array.isArray(c.sectionOrder)) {
    const order = c.sectionOrder.filter((key) => KNOWN_SECTION_KEYS.includes(String(key)));
    const rejected = c.sectionOrder.filter((key) => !KNOWN_SECTION_KEYS.includes(String(key)));
    for (const key of rejected) {
      ignoredFields.push({
        code: 'section_unknown_ignored',
        message: 'Ignored unknown section key: ' + key,
        path: 'sectionOrder'
      });
    }
    draft.sectionOrder = order.map(String);
    writtenPaths.push('sectionOrder');
  }

  draft.sections = draft.sections && typeof draft.sections === 'object' ? { ...draft.sections } : {};

  if (c.sections && typeof c.sections === 'object') {
    for (const [key, sectionValue] of Object.entries(c.sections)) {
      if (!KNOWN_SECTION_KEYS.includes(key)) {
        ignoredFields.push({
          code: 'section_unknown_ignored',
          message: 'Rejected unsupported section key: ' + key,
          path: 'sections.' + key
        });
        continue;
      }
      if (
        foundation &&
        foundation.incompatibilities &&
        Array.isArray(foundation.incompatibilities.sectionKeys) &&
        foundation.incompatibilities.sectionKeys.includes(key)
      ) {
        errors.push({
          code: 'section_incompatible',
          message: 'Rejected incompatible section: ' + key,
          path: 'sections.' + key
        });
        continue;
      }

      const incoming =
        sectionValue && typeof sectionValue === 'object' ? /** @type {Record<string, any>} */ (sectionValue) : {};
      const content =
        incoming.content && typeof incoming.content === 'object' ? incoming.content : incoming;
      const prev =
        draft.sections[key] && typeof draft.sections[key] === 'object'
          ? { ...draft.sections[key] }
          : {};

      const next = { ...prev };
      if (incoming.on != null) next.on = incoming.on;
      else if (next.on == null) next.on = true;

      // Merge content fields shallowly (deterministic)
      for (const [ck, cv] of Object.entries(content)) {
        if (['variant', 'type', 'content', 'on'].includes(ck)) continue;
        if (PROTECTED_FIELDS.includes(ck)) {
          ignoredFields.push({
            code: 'protected_field_ignored',
            message: 'Ignored protected field inside section: ' + ck,
            path: 'sections.' + key + '.' + ck
          });
          continue;
        }
        next[ck] = cv;
      }

      draft.sections[key] = normalizeSectionForRenderer(key, next);
      writtenPaths.push('sections.' + key);
    }
  }

  // Explicitly disable known sections not in this concept's order so the
  // trade template does not keep plumber/default HTML (e.g. emerg strip).
  const activeOrder = Array.isArray(draft.sectionOrder) ? draft.sectionOrder : [];
  const incompatible = new Set(
    (foundation &&
      foundation.incompatibilities &&
      foundation.incompatibilities.sectionKeys) ||
      []
  );
  for (const key of KNOWN_SECTION_KEYS) {
    if (activeOrder.includes(key)) continue;
    if (key === 'header' || key === 'footer' || key === 'seoTokens') continue;
    const forceOff =
      incompatible.has(key) ||
      TRADE_ONLY_SECTION_KEYS.includes(key) ||
      !activeOrder.includes(key);
    if (!forceOff) continue;
    const prev =
      draft.sections[key] && typeof draft.sections[key] === 'object'
        ? { ...draft.sections[key] }
        : {};
    draft.sections[key] = { ...prev, on: false };
    writtenPaths.push('sections.' + key);
  }

  // Services array (top-level writable)
  if (Array.isArray(c.services)) {
    draft.services = normalizeServices(clone(c.services));
    writtenPaths.push('services');
  } else if (
    c.sections &&
    c.sections.services &&
    Array.isArray(c.sections.services.items)
  ) {
    draft.services = normalizeServices(clone(c.sections.services.items));
    writtenPaths.push('services');
  }

  if (Array.isArray(c.pages)) {
    draft.pages = clone(c.pages);
    writtenPaths.push('pages');
  }

  if (c.header && typeof c.header === 'object' && c.header.headerStyle) {
    draft.logo = draft.logo && typeof draft.logo === 'object' ? { ...draft.logo } : {};
    draft.logo.headerStyle = c.header.headerStyle;
    writtenPaths.push('logo.headerStyle');
  }

  // SEO from business profile (allowlisted)
  if (c.businessProfile && c.businessProfile.businessName) {
    const loc = c.businessProfile.location ? ' · ' + c.businessProfile.location : '';
    draft.seoTitle = String(c.businessProfile.businessName) + loc;
    writtenPaths.push('seoTitle');
    if (c.rationale) {
      draft.seoDescription = String(c.rationale).slice(0, 160);
      writtenPaths.push('seoDescription');
    }
  }

  // CTA labels into hero/quote when present
  if (c.callsToAction && c.callsToAction.primary && c.callsToAction.primary.label) {
    if (draft.sections.hero) {
      draft.sections.hero = { ...draft.sections.hero, cta: c.callsToAction.primary.label };
      writtenPaths.push('sections.hero.cta');
    }
    if (draft.sections.quote) {
      draft.sections.quote = {
        ...draft.sections.quote,
        buttonText: c.callsToAction.primary.label
      };
      writtenPaths.push('sections.quote.buttonText');
    }
  }

  // Footer content
  if (c.footer && typeof c.footer === 'object') {
    draft.sections.footer = {
      ...(draft.sections.footer && typeof draft.sections.footer === 'object'
        ? draft.sections.footer
        : {}),
      ...clone(c.footer),
      on: true
    };
    writtenPaths.push('sections.footer');
  }

  // Ignore non-allowlisted concept bags with warnings
  for (const bag of ['globalStyles', 'imagery', 'navigation', 'accessibilityNotes', 'mobileRules']) {
    if (c[bag] != null) {
      ignoredFields.push({
        code: 'concept_field_not_mapped',
        message:
          bag +
          ' retained on concept only; not written to sites.config in Phases 1–2 (preview/apply later)',
        path: bag
      });
    }
  }

  // Ensure we never copied protected fields back
  for (const key of PROTECTED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(draft, key)) {
      delete draft[key];
      warnings.push({
        code: 'protected_field_stripped',
        message: 'Stripped protected field from draft: ' + key,
        path: key
      });
    }
  }

  // Source immutability check
  const mutatedSource = JSON.stringify(sourceConfig || null) !== JSON.stringify(sourceFrozen) &&
    sourceConfig != null;
  // Re-check: we cloned at start; sourceConfig reference must be unchanged
  const sourceUnchanged =
    sourceConfig == null ||
    JSON.stringify(sourceConfig) === JSON.stringify(sourceFrozen);

  if (!sourceUnchanged) {
    errors.push({
      code: 'source_mutated',
      message: 'Adapter unexpectedly mutated sourceConfig',
      path: '$'
    });
  }

  // Validate written paths ⊆ allowlist (sections.* and theme.* wildcards)
  for (const path of writtenPaths) {
    if (!isAllowlistedPath(path)) {
      errors.push({
        code: 'unknown_config_path',
        message: 'Attempted write outside allowlist: ' + path,
        path
      });
    }
  }

  return {
    ok: errors.length === 0,
    draftConfig: errors.length === 0 ? draft : null,
    errors,
    warnings,
    ignoredFields,
    writtenPaths: unique(writtenPaths),
    published: false,
    mutatedSource: false,
    allowlist: WRITABLE_CONFIG_PATHS,
    protectedFields: PROTECTED_FIELDS
  };
}

/**
 * @param {string} path
 */
function isAllowlistedPath(path) {
  if (WRITABLE_CONFIG_PATHS.includes(path)) return true;
  if (path === 'sections' || path.startsWith('sections.')) {
    const key = path.slice('sections.'.length).split('.')[0];
    return !key || KNOWN_SECTION_KEYS.includes(key);
  }
  if (path.startsWith('theme.')) {
    return WRITABLE_CONFIG_PATHS.some((p) => p === path || path.startsWith(p + '.'));
  }
  if (path === 'logo.headerStyle') return true;
  return false;
}

/**
 * @param {string[]} list
 */
function unique(list) {
  return [...new Set(list)];
}

module.exports = {
  adaptConceptToSiteConfig,
  omitProtected,
  clone,
  isAllowlistedPath,
  setPath,
  normalizeSectionForRenderer,
  normalizeServices
};
