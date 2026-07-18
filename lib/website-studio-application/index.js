'use strict';

const flags = require('./flags');
const permissions = require('./permissions');
const validate = require('./validate');
const assemble = require('./assemble');
const plan = require('./plan');
const images = require('./images');
const audit = require('./audit');
const siteStore = require('./site-store');
const apply = require('./apply');

function resetAllApplicationMemory() {
  audit.resetApplicationMemory();
  siteStore.resetSiteMemory();
}

module.exports = {
  ...flags,
  MODES: permissions.MODES,
  assertApplicationPermission: permissions.assertApplicationPermission,
  canManageTargetSite: permissions.canManageTargetSite,
  validateForApplication: validate.validateForApplication,
  assembleDestinationConfig: assemble.assembleDestinationConfig,
  assemblePrivateTemplate: assemble.assemblePrivateTemplate,
  buildApplicationPlan: plan.buildApplicationPlan,
  buildHumanDiff: plan.buildHumanDiff,
  finaliseImagesForApplication: images.finaliseImagesForApplication,
  recordApplicationAudit: audit.recordApplicationAudit,
  listApplicationAudits: audit.listApplicationAudits,
  getIdempotentResult: audit.getIdempotentResult,
  setIdempotentResult: audit.setIdempotentResult,
  createDraftSite: siteStore.createDraftSite,
  getSite: siteStore.getSite,
  putMemorySite: siteStore.putMemorySite,
  snapshotSite: siteStore.snapshotSite,
  createReplacementDraftRecord: siteStore.createReplacementDraftRecord,
  getReplacementDraft: siteStore.getReplacementDraft,
  discardReplacementDraft: siteStore.discardReplacementDraft,
  ensureUniqueSlug: siteStore.ensureUniqueSlug,
  planApplication: apply.planApplication,
  commitApplication: apply.commitApplication,
  resetAllApplicationMemory
};
