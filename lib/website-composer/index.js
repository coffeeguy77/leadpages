'use strict';

const foundations = require('./foundations');
const recipes = require('./recipes');
const classify = require('./classify');
const compose = require('./compose');
const { buildDraftConfig } = require('./build-draft');
const { buildDiagnostics } = require('./diagnostics');
const constants = require('./constants');

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
  buildDiagnostics
};
