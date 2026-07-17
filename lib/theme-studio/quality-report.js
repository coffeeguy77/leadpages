'use strict';

const { validateConcept } = require('./validate-concept');
const { detectIndustryLeakage } = require('./leakage');
const { HERO_VARIANTS, LAYOUT_IDS } = require('./constants');
const { getFoundation } = require('./foundations');

/**
 * Deterministic quality report (advisory). Not a WCAG certification.
 *
 * @param {object} concept
 * @param {object|null} [draftConfig]
 */
function buildQualityReport(concept, draftConfig) {
  /** @type {Array<{ code: string, severity: string, message: string, path?: string }>} */
  const notes = [];
  let score = 100;

  const validated = validateConcept(concept || {});
  for (const err of validated.errors) {
    notes.push({
      code: err.code,
      severity: 'error',
      message: err.message,
      path: err.path
    });
    score -= 8;
  }
  for (const warn of validated.warnings) {
    notes.push({
      code: warn.code,
      severity: 'warn',
      message: warn.message,
      path: warn.path
    });
    score -= 2;
  }

  const theme = (concept && concept.theme) || {};
  if (theme.hivis && theme.lightBg && String(theme.hivis).toLowerCase() === String(theme.lightBg).toLowerCase()) {
    notes.push({
      code: 'contrast_cta_bg',
      severity: 'error',
      message: 'CTA colour matches page background — likely unreadable',
      path: 'theme.hivis'
    });
    score -= 15;
  }

  const order = (concept && concept.sectionOrder) || [];
  const heroes = order.filter((k) => HERO_VARIANTS.includes(k));
  if (heroes.length > 1) {
    notes.push({
      code: 'hero_conflict',
      severity: 'error',
      message: 'Multiple hero variants in sectionOrder',
      path: 'sectionOrder'
    });
    score -= 10;
  }

  if (concept && concept.layoutId && !LAYOUT_IDS.includes(concept.layoutId)) {
    notes.push({
      code: 'layout_unknown',
      severity: 'error',
      message: 'Unknown layoutId',
      path: 'layoutId'
    });
    score -= 10;
  }

  const foundation = concept && getFoundation(concept.foundationId);
  if (foundation && Array.isArray(foundation.requiredSectionKeys)) {
    for (const key of foundation.requiredSectionKeys) {
      if (!order.includes(key)) {
        notes.push({
          code: 'required_section_missing',
          severity: 'error',
          message: 'Missing required section ' + key,
          path: 'sectionOrder'
        });
        score -= 6;
      }
    }
  }

  const industry =
    (concept && concept.businessProfile && concept.businessProfile.industry) || '';
  const leakage = detectIndustryLeakage(concept, { industry });
  for (const err of leakage.errors) {
    notes.push({
      code: err.code,
      severity: 'error',
      message: err.message,
      path: err.path
    });
    score -= 12;
  }

  if (draftConfig && draftConfig.analytics) {
    notes.push({
      code: 'analytics_in_draft',
      severity: 'warn',
      message: 'Draft config unexpectedly contains analytics — strip before preview/apply',
      path: 'draftConfig.analytics'
    });
    score -= 5;
  }

  if (!(concept && concept.mobileRules)) {
    notes.push({
      code: 'mobile_rules_missing',
      severity: 'warn',
      message: 'No mobileRules on concept',
      path: 'mobileRules'
    });
    score -= 3;
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    ok: notes.every((n) => n.severity !== 'error'),
    notes,
    disclaimer:
      'Advisory quality report only. Not a WCAG certification or accessibility audit.',
    checkedAt: new Date().toISOString()
  };
}

module.exports = {
  buildQualityReport
};
