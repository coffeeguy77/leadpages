'use strict';

const schema = require('./schema');
const storage = require('./storage');
const service = require('./service');
const sync = require('./sync');

module.exports = {
  SCHEMA_VERSION: schema.SCHEMA_VERSION,
  FACT_STATUSES: schema.FACT_STATUSES,
  FACT_SOURCES: schema.FACT_SOURCES,
  AGENT_KEYS: schema.AGENT_KEYS,
  makeFact: schema.makeFact,
  emptySnapshot: schema.emptySnapshot,
  emptySearchIntelligence: schema.emptySearchIntelligence,
  validateSnapshot: schema.validateSnapshot,
  approveFact: schema.approveFact,
  isProtectedPath: schema.isProtectedPath,
  resolveStorageMode: storage.resolveStorageMode,
  useMemoryForTests: storage.useMemoryForTests,
  setAdminClientForTests: storage.setAdminClientForTests,
  resetMemoryStore: storage.resetMemoryStore,
  adapter: storage.adapter,
  createSiteBrain: service.createSiteBrain,
  getSiteBrain: service.getSiteBrain,
  saveSnapshot: service.saveSnapshot,
  proposeKnowledgeUpdate: service.proposeKnowledgeUpdate,
  approveKnowledgeUpdate: service.approveKnowledgeUpdate,
  rejectKnowledgeUpdate: service.rejectKnowledgeUpdate,
  recordAgentObservation: service.recordAgentObservation,
  recordRecommendation: service.recordRecommendation,
  patchRecommendation: service.patchRecommendation,
  approveRecommendation: service.approveRecommendation,
  rejectRecommendation: service.rejectRecommendation,
  recordDecision: service.recordDecision,
  addEvidence: service.addEvidence,
  createTask: service.createTask,
  completeTask: service.completeTask,
  invalidateKnowledge: service.invalidateKnowledge,
  restoreVersion: service.restoreVersion,
  listHistory: service.listHistory,
  listRecommendations: service.listRecommendations,
  setBootstrapStatus: service.setBootstrapStatus,
  buildSnapshotFromSite: sync.buildSnapshotFromSite,
  bootstrapReviewFields: sync.bootstrapReviewFields,
  syncSiteBrainFromSite: sync.syncSiteBrainFromSite,
  applyBootstrapReview: sync.applyBootstrapReview
};
