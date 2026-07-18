'use strict';

/**
 * Legacy Theme Studio foundation API — delegates to Website Composer.
 * Alias IDs (e.g. retail-boutique → retail) remain resolvable for older fixtures.
 */

const composer = require('../website-composer/foundations');

function listFoundations() {
  return composer.listFoundations();
}

function getFoundation(id) {
  return composer.getFoundation(id);
}

function scoreFoundation(foundation, profile) {
  return composer.scoreFoundation(foundation, profile).score;
}

function selectFoundationCandidates(profile, opts) {
  return composer.selectFoundationCandidates(profile, opts).map((row) => ({
    foundationId: row.foundationId,
    name: row.foundationName,
    foundationName: row.foundationName,
    category: row.category,
    score: row.score,
    reasons: row.reasons,
    defaultLayoutId: (composer.getFoundation(row.foundationId) || {}).defaultLayoutId,
    conversionStyle: (composer.getFoundation(row.foundationId) || {}).conversionStyle
  }));
}

function checkFoundationCompatibility(foundation, selection) {
  return composer.checkFoundationCompatibility(foundation, selection);
}

function normalizeToken(value) {
  return composer.normalizeToken(value);
}

module.exports = {
  listFoundations,
  getFoundation,
  scoreFoundation,
  selectFoundationCandidates,
  checkFoundationCompatibility,
  normalizeToken
};
