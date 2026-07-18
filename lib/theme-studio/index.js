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
const generate = require('./generate');
const applyPatch = require('./apply-patch');
const quality = require('./quality-report');
const previewToken = require('./preview-token');
const renderPreview = require('./render-preview');
const flag = require('./flag');
const store = require('./store');
const websiteComposer = require('../website-composer');

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
  ROLE_POLICY: access.ROLE_POLICY,
  isPilotSuperuserOnly: access.isPilotSuperuserOnly,
  effectiveRolePolicy: access.effectiveRolePolicy,
  normalizeBrief: generate.normalizeBrief,
  buildDeterministicConcepts: generate.buildDeterministicConcepts,
  generateConceptsWithBrain: generate.generateConceptsWithBrain,
  // Website Composer (Phase 2)
  composeWebsiteConcepts: websiteComposer.composeWebsiteConcepts,
  listRecipes: websiteComposer.listRecipes,
  getRecipe: websiteComposer.getRecipe,
  selectRecipe: websiteComposer.selectRecipe,
  classifyBusiness: websiteComposer.classifyBusiness,
  buildDraftConfig: websiteComposer.buildDraftConfig,
  applyConceptPatch: applyPatch.applyConceptPatch,
  buildDeterministicRefinePatch: applyPatch.buildDeterministicRefinePatch,
  buildQualityReport: quality.buildQualityReport,
  signPreviewToken: previewToken.signPreviewToken,
  verifyPreviewToken: previewToken.verifyPreviewToken,
  renderDraftPreviewHtml: renderPreview.renderDraftPreviewHtml,
  sandboxConfig: renderPreview.sandboxConfig,
  isThemeStudioV2Enabled: flag.isThemeStudioV2Enabled,
  isThemeStudioLiveApplyEnabled: flag.isThemeStudioLiveApplyEnabled,
  isWebsiteStudioApplicationEnabled: flag.isWebsiteStudioApplicationEnabled,
  isWebsiteStudioCreateSiteEnabled: flag.isWebsiteStudioCreateSiteEnabled,
  isWebsiteStudioReplacementDraftEnabled: flag.isWebsiteStudioReplacementDraftEnabled,
  isWebsiteStudioPrivateTemplateEnabled: flag.isWebsiteStudioPrivateTemplateEnabled,
  useMemoryStore: store.useMemoryStore,
  resetMemoryStore: store.resetMemoryStore,
  createDraft: store.createDraft,
  getDraft: store.getDraft,
  updateDraft: store.updateDraft,
  createVersion: store.createVersion,
  getVersion: store.getVersion,
  listVersions: store.listVersions,
  saveTemplate: store.saveTemplate
};
