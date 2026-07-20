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
const executionPlan = require('./execution-plan');
const askTopics = require('./ask-topics');

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
  validateExecutionPlan: guardian.validateExecutionPlan,
  attachGuardian: guardian.attachGuardian,
  assertAction: permissions.assertAction,
  canRunAtlas: permissions.canRunAtlas,
  canRunForge: permissions.canRunForge,
  runAtlasReview: atlas.runAtlasReview,
  buildDeterministicRecommendations: atlas.buildDeterministicRecommendations,
  discussRecommendation: atlas.discussRecommendation,
  answerStepRecommendation: atlas.answerStepRecommendation,
  SITE_KNOWLEDGE_FIELDS: siteKnowledgeFields.SITE_KNOWLEDGE_FIELDS,
  getSiteKnowledgeField: siteKnowledgeFields.getField,
  buildDraftFromRecommendation: forge.buildDraftFromRecommendation,
  buildExecutionPlan: forge.buildExecutionPlan,
  buildChangePreview: forge.buildChangePreview,
  applyPatchToConfig: forge.applyPatchToConfig,
  applyExecutionPlanToConfig: forge.applyExecutionPlanToConfig,
  createTaskForApprovedRecommendation: execution.createTaskForApprovedRecommendation,
  createExecutionPlanForRecommendations: execution.createExecutionPlanForRecommendations,
  previewExecutionPlan: execution.previewExecutionPlan,
  applyExecutionPlan: execution.applyExecutionPlan,
  cancelExecutionPlan: execution.cancelExecutionPlan,
  rollbackExecutionPlan: execution.rollbackExecutionPlan,
  applyForgeTask: execution.applyForgeTask,
  PLAN_STATUSES: executionPlan.PLAN_STATUSES,
  BUSINESS_OUTCOMES: executionPlan.BUSINESS_OUTCOMES,
  ASK_TOPICS: askTopics.ASK_TOPICS,
  listAskTopics: askTopics.listAskTopics,
  parseTopicAsk: askTopics.parseTopicAsk,
  composeTopicRequest: askTopics.composeTopicRequest
};
