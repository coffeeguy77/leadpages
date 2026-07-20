'use strict';

const specialists = require('./specialists');
const context = require('./context');
const capabilityRegistry = require('./capability-registry');
const guardian = require('./guardian');
const permissions = require('./permissions');
const atlas = require('./atlas');
const siteKnowledgeFields = require('./site-knowledge-fields');
const forge = require('./forge');
const execution = require('./execution');

module.exports = {
  ...specialists,
  getRelevantContext: context.getRelevantContext,
  sanitizeEditorContext: context.sanitizeEditorContext,
  summarizeForUi: context.summarizeForUi,
  listCapabilities: capabilityRegistry.listCapabilities,
  getCapability: capabilityRegistry.getCapability,
  listExclusions: capabilityRegistry.listExclusions,
  classifyComposerCandidate: capabilityRegistry.classifyComposerCandidate,
  isExecutableCapability: capabilityRegistry.isExecutableCapability,
  validateRecommendation: guardian.validateRecommendation,
  attachGuardian: guardian.attachGuardian,
  assertAction: permissions.assertAction,
  canRunAtlas: permissions.canRunAtlas,
  canRunForge: permissions.canRunForge,
  runAtlasReview: atlas.runAtlasReview,
  SITE_KNOWLEDGE_FIELDS: siteKnowledgeFields.SITE_KNOWLEDGE_FIELDS,
  getSiteKnowledgeField: siteKnowledgeFields.getField,
  buildDraftFromRecommendation: forge.buildDraftFromRecommendation,
  applyPatchToConfig: forge.applyPatchToConfig,
  createTaskForApprovedRecommendation: execution.createTaskForApprovedRecommendation,
  applyForgeTask: execution.applyForgeTask
};
