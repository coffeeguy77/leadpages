'use strict';

const { FOUNDATIONS } = require('./foundations-data');

function normalizeToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function listFoundations() {
  return FOUNDATIONS.map((f) => ({ ...f }));
}

function getFoundation(id) {
  if (!id) return null;
  const needle = String(id);
  const found = FOUNDATIONS.find(
    (f) => f.id === needle || (Array.isArray(f.aliases) && f.aliases.includes(needle))
  );
  return found ? { ...found } : null;
}

/**
 * Score a foundation against a brief / industry profile.
 * @param {object} foundation
 * @param {{ industry?: string, specialisation?: string, desiredStyle?: string, conversionGoal?: string, notes?: string }} brief
 */
function scoreFoundation(foundation, brief) {
  const b = brief || {};
  const industry = normalizeToken(b.industry);
  const hay = [
    b.industry,
    b.specialisation,
    b.desiredStyle,
    b.conversionGoal,
    b.notes,
    b.audience
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  let score = 0;
  const reasons = [];

  const supported = (foundation.supportedIndustries || []).map(normalizeToken);
  if (supported.includes(industry)) {
    score += 100;
    reasons.push('industry_exact');
  } else if (supported.some((s) => industry.includes(s) || s.includes(industry))) {
    score += 70;
    reasons.push('industry_partial');
  } else if (supported.some((s) => hay.includes(s.replace(/-/g, ' ')) || hay.includes(s))) {
    score += 40;
    reasons.push('industry_in_brief');
  }

  const excluded = (foundation.excludedIndustries || []).map(normalizeToken);
  if (excluded.includes(industry) || excluded.some((e) => hay.includes(e.replace(/-/g, ' ')))) {
    score -= 200;
    reasons.push('industry_excluded');
  }

  const styles = (foundation.visualStyles || []).map((s) => s.toLowerCase());
  for (const style of styles) {
    if (hay.includes(style)) {
      score += 8;
      reasons.push('style:' + style);
    }
  }

  const conv = String(foundation.conversionStyle || '').toLowerCase();
  const goal = String(b.conversionGoal || '').toLowerCase();
  if (goal && conv && (goal.includes(conv.split('-')[0]) || conv.includes(goal.split('-')[0]))) {
    score += 12;
    reasons.push('conversion_align');
  }

  return { foundationId: foundation.id, score, reasons };
}

function selectFoundationCandidates(brief, opts) {
  const options = opts || {};
  const minScore = options.minScore == null ? 0 : options.minScore;
  const limit = options.limit == null ? 5 : options.limit;
  const ranked = FOUNDATIONS.map((f) => {
    const scored = scoreFoundation(f, brief);
    return {
      foundationId: f.id,
      foundationName: f.name,
      category: f.category,
      score: scored.score,
      reasons: scored.reasons
    };
  })
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score || a.foundationId.localeCompare(b.foundationId));
  return ranked.slice(0, limit);
}

function checkFoundationCompatibility(foundation, selection) {
  const sel = selection || {};
  /** @type {Array<{ code: string, message: string, path?: string }>} */
  const errors = [];
  if (!foundation) {
    return { ok: false, errors: [{ code: 'foundation_missing', message: 'Foundation required' }] };
  }

  const layoutId = sel.layoutId;
  if (layoutId) {
    if (!(foundation.compatibleLayoutIds || []).includes(layoutId)) {
      errors.push({
        code: 'layout_incompatible',
        message: 'Layout not compatible with foundation',
        path: 'layoutId'
      });
    }
    if ((foundation.incompatibilities?.layoutIds || []).includes(layoutId)) {
      errors.push({
        code: 'layout_incompatible',
        message: 'Layout explicitly incompatible',
        path: 'layoutId'
      });
    }
  }

  const sectionKeys = sel.sectionKeys || [];
  for (const key of sectionKeys) {
    if (!(foundation.supportedSectionKeys || []).includes(key)) {
      errors.push({
        code: 'section_unsupported',
        message: 'Section not supported: ' + key,
        path: 'sections.' + key
      });
    }
    if ((foundation.incompatibilities?.sectionKeys || []).includes(key)) {
      errors.push({
        code: 'section_incompatible',
        message: 'Section incompatible: ' + key,
        path: 'sections.' + key
      });
    }
  }

  const heroVariant = sel.heroVariant;
  if (heroVariant && (foundation.incompatibilities?.heroVariants || []).includes(heroVariant)) {
    errors.push({
      code: 'hero_incompatible',
      message: 'Hero variant incompatible',
      path: 'heroVariant'
    });
  }

  const heroKeys = new Set(['hero', 'heroSlider', 'heroBeforeAfter', 'splitHero']);
  for (const req of foundation.requiredSectionKeys || []) {
    if (!sectionKeys.length) continue;
    if (req === 'hero') {
      if (![...sectionKeys].some((k) => heroKeys.has(k))) {
        errors.push({
          code: 'required_section_missing',
          message: 'Required section missing: hero (or hero variant)',
          path: 'sectionOrder'
        });
      }
      continue;
    }
    if (!sectionKeys.includes(req)) {
      errors.push({
        code: 'required_section_missing',
        message: 'Required section missing: ' + req,
        path: 'sectionOrder'
      });
    }
  }

  return { ok: errors.length === 0, errors };
}

module.exports = {
  listFoundations,
  getFoundation,
  scoreFoundation,
  selectFoundationCandidates,
  checkFoundationCompatibility,
  normalizeToken,
  FOUNDATIONS
};
