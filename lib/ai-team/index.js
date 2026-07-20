'use strict';

const specialists = require('./specialists');
const context = require('./context');
const capabilityRegistry = require('./capability-registry');
const guardian = require('./guardian');
const permissions = require('./permissions');
const atlas = require('./atlas');
const siteKnowledgeFields = require('./site-knowledge-fields');

module.exports = {
  ...specialists,
  getRelevantContext: context.getRelevantContext,
  sanitizeEditorContext: context.sanitizeEditorContext,
  summarizeForUi: context.summarizeForUi,
  listCapabilities: capabilityRegistry.listCapabilities,
  getCapability: capabilityRegistry.getCapability,
  listExclusions: capabilityRegistry.listExclusions,
  classifyComposerCandidate: capabilityRegistry.classifyComposerCandidate,
  validateRecommendation: guardian.validateRecommendation,
  attachGuardian: guardian.attachGuardian,
  assertAction: permissions.assertAction,
  canRunAtlas: permissions.canRunAtlas,
  runAtlasReview: atlas.runAtlasReview,
  SITE_KNOWLEDGE_FIELDS: siteKnowledgeFields.SITE_KNOWLEDGE_FIELDS,
  getSiteKnowledgeField: siteKnowledgeFields.getField
};
