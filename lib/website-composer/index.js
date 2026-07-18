'use strict';

const foundations = require('./foundations');
const recipes = require('./recipes');
const classify = require('./classify');
const compose = require('./compose');
const { buildDraftConfig } = require('./build-draft');
const { buildDiagnostics } = require('./diagnostics');
const constants = require('./constants');
const catalogue = require('./marketplace/catalogue');
const appMetadata = require('./marketplace/app-metadata');
const adapters = require('./adapters/registry');
const installApps = require('./install-apps');

module.exports = {
  ...constants,
  FOUNDATIONS: foundations.FOUNDATIONS,
  listFoundations: foundations.listFoundations,
  getFoundation: foundations.getFoundation,
  selectFoundationCandidates: foundations.selectFoundationCandidates,
  scoreFoundation: foundations.scoreFoundation,
  checkFoundationCompatibility: foundations.checkFoundationCompatibility,
  RECIPES: recipes.RECIPES,
  listRecipes: recipes.listRecipes,
  getRecipe: recipes.getRecipe,
  selectRecipe: recipes.selectRecipe,
  selectRecipeCandidates: recipes.selectRecipeCandidates,
  classifyBusiness: classify.classifyBusiness,
  normalizeBrief: compose.normalizeBrief,
  composeWebsiteConcepts: compose.composeWebsiteConcepts,
  buildDraftConfig,
  buildDiagnostics,
  listCatalogueApps: catalogue.listCatalogueApps,
  getCatalogueApp: catalogue.getCatalogueApp,
  listSupportedApps: catalogue.listSupportedApps,
  isAppSupported: catalogue.isAppSupported,
  assertSupportedApp: catalogue.assertSupportedApp,
  APP_METADATA: appMetadata.APP_METADATA,
  getAppMetadata: appMetadata.getAppMetadata,
  listAppMetadataIds: appMetadata.listAppMetadataIds,
  scoreAppForContext: appMetadata.scoreAppForContext,
  listAdapterIds: adapters.listAdapterIds,
  hasAdapter: adapters.hasAdapter,
  adaptApp: adapters.adaptApp,
  selectAppsForConcept: installApps.selectAppsForConcept,
  installAppsIntoDraft: installApps.installAppsIntoDraft
};
