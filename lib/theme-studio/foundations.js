'use strict';

const { FOUNDATIONS } = require('./foundations-data');
const {
  LAYOUT_IDS,
  KNOWN_SECTION_KEYS,
  HERO_VARIANTS
} = require('./constants');

const BY_ID = new Map(FOUNDATIONS.map((f) => [f.id, Object.freeze({ ...f })]));

/**
 * @returns {ReadonlyArray<object>}
 */
function listFoundations() {
  return FOUNDATIONS;
}

/**
 * @param {string} id
 * @returns {object|null}
 */
function getFoundation(id) {
  if (!id || typeof id !== 'string') return null;
  return BY_ID.get(id) || null;
}

/**
 * Normalize industry / style tokens for matching.
 * @param {string} value
 */
function normalizeToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Score how well a foundation matches a business profile brief.
 * Higher is better. Negative scores are hard exclusions.
 *
 * @param {object} foundation
 * @param {{ industry?: string, specialisation?: string, desiredStyle?: string|string[], location?: string }} profile
 */
function scoreFoundation(foundation, profile) {
  if (!foundation || foundation.status !== 'active') return -1000;
  const industry = normalizeToken(profile && profile.industry);
  const specialisation = normalizeToken(profile && profile.specialisation);
  const styles = Array.isArray(profile && profile.desiredStyle)
    ? profile.desiredStyle.map(normalizeToken)
    : String((profile && profile.desiredStyle) || '')
        .split(/[,/&]| and /i)
        .map(normalizeToken)
        .filter(Boolean);

  const supported = (foundation.supportedIndustries || []).map(normalizeToken);
  const excluded = (foundation.excludedIndustries || []).map(normalizeToken);

  if (industry && excluded.includes(industry)) return -100;
  if (specialisation && excluded.some((ex) => specialisation.includes(ex) || ex.includes(specialisation))) {
    return -80;
  }

  let score = 0;
  if (industry && supported.includes(industry)) score += 50;
  else if (industry) {
    const partial = supported.some(
      (s) => industry.includes(s) || s.includes(industry)
    );
    score += partial ? 30 : -10;
  }

  if (specialisation) {
    const hit = supported.some(
      (s) => specialisation.includes(s) || s.includes(specialisation)
    );
    if (hit) score += 15;
  }

  const visual = (foundation.visualStyles || []).map(normalizeToken);
  for (const style of styles) {
    if (visual.includes(style)) score += 8;
    else if (visual.some((v) => v.includes(style) || style.includes(v))) score += 4;
  }

  return score;
}

/**
 * Rank foundations for a business profile (best first).
 * @param {object} profile
 * @param {{ limit?: number, minScore?: number }} [opts]
 */
function selectFoundationCandidates(profile, opts) {
  const limit = (opts && opts.limit) || 5;
  const minScore = opts && typeof opts.minScore === 'number' ? opts.minScore : 0;
  return FOUNDATIONS.map((foundation) => ({
    foundationId: foundation.id,
    name: foundation.name,
    category: foundation.category,
    score: scoreFoundation(foundation, profile || {}),
    defaultLayoutId: foundation.defaultLayoutId,
    conversionStyle: foundation.conversionStyle
  }))
    .filter((row) => row.score >= minScore)
    .sort((a, b) => b.score - a.score || a.foundationId.localeCompare(b.foundationId))
    .slice(0, limit);
}

/**
 * Compatibility checks for foundation + concept choices.
 * @param {object} foundation
 * @param {{ layoutId?: string, sectionKeys?: string[], heroVariant?: string }} selection
 * @returns {{ ok: boolean, errors: Array<{ code: string, message: string, path?: string }> }}
 */
function checkFoundationCompatibility(foundation, selection) {
  const errors = [];
  if (!foundation) {
    return {
      ok: false,
      errors: [{ code: 'foundation_missing', message: 'Foundation not found' }]
    };
  }

  const layoutId = selection && selection.layoutId;
  if (layoutId) {
    if (!LAYOUT_IDS.includes(layoutId)) {
      errors.push({
        code: 'layout_unknown',
        message: 'Layout id is not a verified LAYOUTS id',
        path: 'layoutId'
      });
    } else if (
      Array.isArray(foundation.compatibleLayoutIds) &&
      !foundation.compatibleLayoutIds.includes(layoutId)
    ) {
      errors.push({
        code: 'layout_incompatible',
        message: 'Layout is not compatible with foundation ' + foundation.id,
        path: 'layoutId'
      });
    }
    if (
      foundation.incompatibilities &&
      Array.isArray(foundation.incompatibilities.layoutIds) &&
      foundation.incompatibilities.layoutIds.includes(layoutId)
    ) {
      errors.push({
        code: 'layout_incompatible',
        message: 'Layout is explicitly incompatible with foundation ' + foundation.id,
        path: 'layoutId'
      });
    }
  }

  const sectionKeys = (selection && selection.sectionKeys) || [];
  const supported = new Set(foundation.supportedSectionKeys || []);
  const incompatible = new Set(
    (foundation.incompatibilities && foundation.incompatibilities.sectionKeys) || []
  );
  const known = new Set(KNOWN_SECTION_KEYS);

  for (const key of sectionKeys) {
    if (!known.has(key)) {
      errors.push({
        code: 'section_unknown',
        message: 'Unknown section key: ' + key,
        path: 'sections.' + key
      });
      continue;
    }
    if (!supported.has(key)) {
      errors.push({
        code: 'section_unsupported',
        message: 'Section key not supported by foundation: ' + key,
        path: 'sections.' + key
      });
    }
    if (incompatible.has(key)) {
      errors.push({
        code: 'section_incompatible',
        message: 'Section key incompatible with foundation: ' + key,
        path: 'sections.' + key
      });
    }
  }

  const required = foundation.requiredSectionKeys || [];
  for (const key of required) {
    if (!sectionKeys.includes(key)) {
      errors.push({
        code: 'section_required_missing',
        message: 'Required section missing: ' + key,
        path: 'sectionOrder'
      });
    }
  }

  const heroVariant = selection && selection.heroVariant;
  if (heroVariant) {
    if (!HERO_VARIANTS.includes(heroVariant)) {
      errors.push({
        code: 'hero_variant_unknown',
        message: 'Unknown hero variant: ' + heroVariant,
        path: 'sections.hero.variant'
      });
    } else if (
      foundation.incompatibilities &&
      Array.isArray(foundation.incompatibilities.heroVariants) &&
      foundation.incompatibilities.heroVariants.includes(heroVariant)
    ) {
      errors.push({
        code: 'hero_variant_incompatible',
        message: 'Hero variant incompatible with foundation: ' + heroVariant,
        path: 'sections.hero.variant'
      });
    } else if (
      Array.isArray(foundation.supportedHeroVariants) &&
      !foundation.supportedHeroVariants.includes(heroVariant)
    ) {
      errors.push({
        code: 'hero_variant_unsupported',
        message: 'Hero variant not supported by foundation: ' + heroVariant,
        path: 'sections.hero.variant'
      });
    }
  }

  const heroes = sectionKeys.filter((k) => HERO_VARIANTS.includes(k));
  if (heroes.length > 1) {
    errors.push({
      code: 'hero_exclusive_conflict',
      message: 'Multiple hero variants present: ' + heroes.join(', '),
      path: 'sectionOrder'
    });
  }

  return { ok: errors.length === 0, errors };
}

module.exports = {
  listFoundations,
  getFoundation,
  scoreFoundation,
  selectFoundationCandidates,
  checkFoundationCompatibility,
  normalizeToken
};
