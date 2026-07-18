'use strict';

const { validateAgainstSchema } = require('../brain/schema');
const {
  CONCEPT_SCHEMA_ID,
  CONCEPT_SCHEMA_VERSION,
  CONCEPT_SCHEMA_V1
} = require('./concept-schema');
const {
  LAYOUT_IDS,
  KNOWN_SECTION_KEYS,
  HEADER_VARIANTS,
  FONT_NAMES,
  HERO_VARIANTS,
  PROTECTED_FIELDS,
  SITE_TEMPLATES,
  MARKETPLACE_SECTION_KEYS
} = require('./constants');
const { getFoundation, checkFoundationCompatibility, normalizeToken } = require('./foundations');
const { detectIndustryLeakage } = require('./leakage');

const MARKETPLACE_VALUES = new Set(Object.values(MARKETPLACE_SECTION_KEYS));
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * @typedef {{ code: string, message: string, path?: string, details?: unknown }} ValidationIssue
 */

/**
 * @param {unknown} concept
 * @param {{ checkLeakage?: boolean }} [opts]
 * @returns {{
 *   ok: boolean,
 *   schemaId: string,
 *   errors: ValidationIssue[],
 *   warnings: ValidationIssue[]
 * }}
 */
function validateConcept(concept, opts) {
  const options = opts || {};
  /** @type {ValidationIssue[]} */
  const errors = [];
  /** @type {ValidationIssue[]} */
  const warnings = [];

  if (!concept || typeof concept !== 'object' || Array.isArray(concept)) {
    return {
      ok: false,
      schemaId: CONCEPT_SCHEMA_ID,
      errors: [{ code: 'concept_not_object', message: 'Concept must be an object', path: '$' }],
      warnings
    };
  }

  const c = /** @type {Record<string, unknown>} */ (concept);

  const schemaResult = validateAgainstSchema(CONCEPT_SCHEMA_V1, c);
  if (!schemaResult.ok) {
    for (const msg of schemaResult.errors || []) {
      errors.push({
        code: 'schema_mismatch',
        message: msg,
        path: extractPath(msg)
      });
    }
  }

  if (c.schemaVersion !== CONCEPT_SCHEMA_VERSION) {
    errors.push({
      code: 'schema_version_invalid',
      message: 'schemaVersion must be ' + CONCEPT_SCHEMA_VERSION,
      path: 'schemaVersion'
    });
  }

  const foundation = getFoundation(/** @type {string} */ (c.foundationId));
  if (!foundation) {
    errors.push({
      code: 'foundation_missing',
      message: 'foundationId does not exist in the curated registry',
      path: 'foundationId'
    });
  }

  if (c.sourceTemplateId != null) {
    if (typeof c.sourceTemplateId !== 'string' || !SITE_TEMPLATES.includes(c.sourceTemplateId)) {
      errors.push({
        code: 'template_unsupported',
        message: 'sourceTemplateId must be a verified site template',
        path: 'sourceTemplateId'
      });
    }
  }

  if (Array.isArray(c.sourceAppIds)) {
    for (let i = 0; i < c.sourceAppIds.length; i++) {
      const appId = c.sourceAppIds[i];
      if (typeof appId !== 'string' || (!KNOWN_SECTION_KEYS.includes(appId) && !MARKETPLACE_VALUES.has(appId))) {
        errors.push({
          code: 'marketplace_ref_unsupported',
          message: 'Unsupported marketplace/app reference: ' + String(appId),
          path: 'sourceAppIds[' + i + ']'
        });
      }
    }
  }

  if (typeof c.layoutId === 'string' && !LAYOUT_IDS.includes(c.layoutId)) {
    errors.push({
      code: 'layout_unknown',
      message: 'layoutId is not a verified LAYOUTS id',
      path: 'layoutId'
    });
  }

  const sectionOrder = Array.isArray(c.sectionOrder) ? c.sectionOrder.map(String) : [];
  const sections =
    c.sections && typeof c.sections === 'object' && !Array.isArray(c.sections)
      ? /** @type {Record<string, unknown>} */ (c.sections)
      : {};

  const seen = new Set();
  for (let i = 0; i < sectionOrder.length; i++) {
    const key = sectionOrder[i];
    if (seen.has(key)) {
      errors.push({
        code: 'section_duplicate',
        message: 'Duplicate section in sectionOrder: ' + key,
        path: 'sectionOrder[' + i + ']'
      });
    }
    seen.add(key);
    if (!KNOWN_SECTION_KEYS.includes(key)) {
      errors.push({
        code: 'section_unknown',
        message: 'Unknown section key in sectionOrder: ' + key,
        path: 'sectionOrder[' + i + ']'
      });
    }
  }

  for (const key of Object.keys(sections)) {
    if (!KNOWN_SECTION_KEYS.includes(key)) {
      errors.push({
        code: 'section_unknown',
        message: 'Unknown section key in sections: ' + key,
        path: 'sections.' + key
      });
    }
    if (!sectionOrder.includes(key)) {
      warnings.push({
        code: 'section_order_missing_key',
        message: 'sections.' + key + ' is not listed in sectionOrder',
        path: 'sections.' + key
      });
    }
  }

  const theme = c.theme && typeof c.theme === 'object' ? /** @type {Record<string, unknown>} */ (c.theme) : null;
  if (theme) {
    for (const token of ['pipe', 'hivis', 'steel', 'safety', 'lightBg']) {
      const val = theme[token];
      if (typeof val !== 'string' || !HEX.test(val)) {
        errors.push({
          code: 'theme_token_invalid',
          message: 'theme.' + token + ' must be a hex colour',
          path: 'theme.' + token
        });
      }
    }
  }

  if (c.typography && typeof c.typography === 'object') {
    const typo = /** @type {Record<string, unknown>} */ (c.typography);
    for (const fontKey of ['fontDisplay', 'fontUi']) {
      if (typo[fontKey] != null && !FONT_NAMES.includes(/** @type {string} */ (typo[fontKey]))) {
        errors.push({
          code: 'typography_font_unsupported',
          message: fontKey + ' is not a verified font name',
          path: 'typography.' + fontKey
        });
      }
    }
  }

  if (c.header && typeof c.header === 'object') {
    const header = /** @type {Record<string, unknown>} */ (c.header);
    if (
      header.headerStyle != null &&
      !HEADER_VARIANTS.includes(/** @type {string} */ (header.headerStyle))
    ) {
      errors.push({
        code: 'header_variant_unknown',
        message: 'Unsupported headerStyle',
        path: 'header.headerStyle'
      });
    }
  }

  // CTA consistency: primary CTA should align with quote / hero content when present
  const ctas = c.callsToAction && typeof c.callsToAction === 'object'
    ? /** @type {Record<string, unknown>} */ (c.callsToAction)
    : null;
  if (ctas && ctas.primary && typeof ctas.primary === 'object') {
    const primary = /** @type {Record<string, unknown>} */ (ctas.primary);
    if (!primary.label && !primary.href && !primary.action) {
      errors.push({
        code: 'cta_incomplete',
        message: 'callsToAction.primary needs label, href, or action',
        path: 'callsToAction.primary'
      });
    }
  } else if (sectionOrder.includes('quote') || sectionOrder.includes('hero')) {
    warnings.push({
      code: 'cta_missing',
      message: 'No primary CTA defined for a conversion-oriented concept',
      path: 'callsToAction'
    });
  }

  // Required content heuristics
  const profile =
    c.businessProfile && typeof c.businessProfile === 'object'
      ? /** @type {Record<string, unknown>} */ (c.businessProfile)
      : {};
  if (!String(profile.businessName || '').trim()) {
    errors.push({
      code: 'content_required',
      message: 'businessProfile.businessName is required',
      path: 'businessProfile.businessName'
    });
  }

  const hero = sections.hero && typeof sections.hero === 'object'
    ? /** @type {Record<string, unknown>} */ (sections.hero)
    : null;
  if (hero) {
    // Adapters write title/heading at the section root; legacy patches may use content.*
    const nested =
      hero.content && typeof hero.content === 'object'
        ? /** @type {Record<string, unknown>} */ (hero.content)
        : {};
    const heading = String(hero.heading || hero.title || nested.heading || nested.title || '').trim();
    if (!heading) {
      errors.push({
        code: 'content_required',
        message: 'Hero heading/title is required',
        path: 'sections.hero'
      });
    }
    const variant = hero.variant || (HERO_VARIANTS.includes(String(hero.type || '')) ? hero.type : 'hero');
    if (variant && !HERO_VARIANTS.includes(String(variant))) {
      errors.push({
        code: 'hero_variant_unknown',
        message: 'Unknown hero variant',
        path: 'sections.hero.variant'
      });
    }
  }

  // Protected field attempts on concept
  const preserved = Array.isArray(c.preservedFields) ? c.preservedFields.map(String) : [];
  const generated = Array.isArray(c.generatedFields) ? c.generatedFields.map(String) : [];
  for (const field of generated) {
    if (PROTECTED_FIELDS.includes(field) || field.startsWith('analytics') || field.startsWith('billing')) {
      errors.push({
        code: 'protected_field_attempt',
        message: 'generatedFields must not include protected field: ' + field,
        path: 'generatedFields'
      });
    }
  }
  if (c.content && typeof c.content === 'object') {
    for (const key of Object.keys(/** @type {object} */ (c.content))) {
      if (PROTECTED_FIELDS.includes(key)) {
        errors.push({
          code: 'protected_field_attempt',
          message: 'content must not set protected field: ' + key,
          path: 'content.' + key
        });
      }
    }
  }

  // Placeholder identification
  const placeholders = Array.isArray(c.placeholderFields) ? c.placeholderFields : [];
  const flat = JSON.stringify(c);
  if (/\bTODO\b|lorem ipsum|\[insert|placeholder text/i.test(flat) && placeholders.length === 0) {
    warnings.push({
      code: 'placeholder_untracked',
      message: 'Possible placeholder copy detected without placeholderFields entries',
      path: 'placeholderFields'
    });
  }

  // Mobile rules
  if (c.mobileRules && typeof c.mobileRules === 'object') {
    const mobile = /** @type {Record<string, unknown>} */ (c.mobileRules);
    if (mobile.stackOrder != null && typeof mobile.stackOrder !== 'string') {
      errors.push({
        code: 'mobile_rules_invalid',
        message: 'mobileRules.stackOrder must be a string',
        path: 'mobileRules.stackOrder'
      });
    }
  } else {
    warnings.push({
      code: 'mobile_rules_missing',
      message: 'mobileRules not provided; foundation mobileProfile should be applied later',
      path: 'mobileRules'
    });
  }

  if (foundation) {
    const heroVariant =
      (hero && (hero.variant || hero.type)) ||
      sectionOrder.find((k) => HERO_VARIANTS.includes(k)) ||
      'hero';
    const compat = checkFoundationCompatibility(foundation, {
      layoutId: /** @type {string} */ (c.layoutId),
      sectionKeys: sectionOrder,
      heroVariant: String(heroVariant)
    });
    for (const err of compat.errors) {
      errors.push(err);
    }

    // Industry mismatch vs foundation
    const industry = normalizeToken(/** @type {string} */ (profile.industry || ''));
    if (industry) {
      const excluded = (foundation.excludedIndustries || []).map(normalizeToken);
      const supported = (foundation.supportedIndustries || []).map(normalizeToken);
      if (excluded.includes(industry)) {
        errors.push({
          code: 'industry_mismatch',
          message: 'Industry is excluded by foundation ' + foundation.id,
          path: 'businessProfile.industry'
        });
      } else if (
        supported.length &&
        !supported.includes(industry) &&
        !supported.some((s) => industry.includes(s) || s.includes(industry))
      ) {
        warnings.push({
          code: 'industry_weak_match',
          message: 'Industry is not in foundation supportedIndustries',
          path: 'businessProfile.industry'
        });
      }
    }
  }

  if (options.checkLeakage !== false) {
    const leakage = detectIndustryLeakage(c, {
      industry: String(profile.industry || '')
    });
    for (const err of leakage.errors) {
      errors.push(err);
    }
  }

  // Unknown top-level config path attempts via content.configPatches (future)
  if (c.configPatches && typeof c.configPatches === 'object') {
    errors.push({
      code: 'unknown_config_path',
      message: 'configPatches are not allowed on concepts; use the adapter allowlist only',
      path: 'configPatches'
    });
  }

  // Preserve list should mention operational fields for redesign readiness
  if (preserved.length === 0) {
    warnings.push({
      code: 'preserved_fields_empty',
      message: 'preservedFields is empty; redesign merges should declare protected operational fields',
      path: 'preservedFields'
    });
  }

  return {
    ok: errors.length === 0,
    schemaId: CONCEPT_SCHEMA_ID,
    errors,
    warnings
  };
}

/**
 * @param {string} msg
 */
function extractPath(msg) {
  const m = String(msg).match(/^(\$[.\w\[\]-]+)/);
  return m ? m[1].replace(/^\$\.?/, '') || '$' : undefined;
}

module.exports = {
  validateConcept
};
