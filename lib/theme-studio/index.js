'use strict';

const constants = require('./constants');
const foundations = require('./foundations');
const { FOUNDATIONS } = require('./foundations-data');
const conceptSchema = require('./concept-schema');
const { validateConcept } = require('./validate-concept');
const { adaptConceptToSiteConfig } = require('./adapt-to-site-config');
const leakage = require('./leakage');
const brainContracts = require('./brain-contracts');
const access = require('./access');

module.exports = {
  ...constants,
  FOUNDATIONS,
  listFoundations: foundations.listFoundations,
  getFoundation: foundations.getFoundation,
  selectFoundationCandidates: foundations.selectFoundationCandidates,
  scoreFoundation: foundations.scoreFoundation,
  checkFoundationCompatibility: foundations.checkFoundationCompatibility,
  CONCEPT_SCHEMA_V1: conceptSchema.CONCEPT_SCHEMA_V1,
  validateConcept,
  adaptConceptToSiteConfig,
  detectIndustryLeakage: leakage.detectIndustryLeakage,
  THEME_STUDIO_BRAIN_TASKS: brainContracts.THEME_STUDIO_BRAIN_TASKS,
  getBrainTaskContract: brainContracts.getBrainTaskContract,
  canAccessThemeStudio: access.canAccessThemeStudio,
  ROLE_POLICY: access.ROLE_POLICY
};
