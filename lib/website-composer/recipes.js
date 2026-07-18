'use strict';

const { RECIPES } = require('./recipes-data');
const { normalizeToken } = require('./foundations');

function listRecipes() {
  return RECIPES.map((r) => ({ ...r }));
}

function getRecipe(id) {
  if (!id) return null;
  const found = RECIPES.find((r) => r.id === id);
  return found ? { ...found } : null;
}

function recipeCompatibleWithFoundation(recipe, foundationId) {
  const ids = recipe.compatibleFoundationIds || [];
  return ids.includes('*') || ids.includes(foundationId);
}

/**
 * Score recipes for a foundation + industry profile.
 * @param {{ foundationId: string, industry?: string, specialisation?: string, notes?: string, profileId?: string }} input
 */
function scoreRecipe(recipe, input) {
  const foundationId = input.foundationId;
  if (!recipeCompatibleWithFoundation(recipe, foundationId)) {
    return { recipeId: recipe.id, score: -1000, reasons: ['foundation_incompatible'] };
  }

  let score = 10;
  const reasons = ['foundation_ok'];
  const hay = [input.industry, input.specialisation, input.notes, input.profileId]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const industry = normalizeToken(input.industry);

  for (const hint of recipe.industryHints || []) {
    const h = normalizeToken(hint);
    if (!h) continue;
    if (industry === h || industry.includes(h) || h.includes(industry)) {
      score += 80;
      reasons.push('hint_exact:' + h);
    } else if (hay.includes(hint.toLowerCase()) || hay.includes(h.replace(/-/g, ' '))) {
      score += 45;
      reasons.push('hint_brief:' + h);
    }
  }

  // Prefer specific recipes over generic when scores tie later
  if (recipe.id === 'recipe-generic-local') score -= 5;

  return { recipeId: recipe.id, score, reasons };
}

function selectRecipeCandidates(input, opts) {
  const options = opts || {};
  const limit = options.limit == null ? 5 : options.limit;
  const minScore = options.minScore == null ? 0 : options.minScore;
  return RECIPES.map((r) => {
    const scored = scoreRecipe(r, input);
    return {
      recipeId: r.id,
      recipeName: r.name,
      score: scored.score,
      reasons: scored.reasons,
      conversionStyle: r.conversionStyle
    };
  })
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score || a.recipeId.localeCompare(b.recipeId))
    .slice(0, limit);
}

function selectRecipe(input, opts) {
  if (opts && opts.recipeId) {
    const forced = getRecipe(opts.recipeId);
    if (forced && recipeCompatibleWithFoundation(forced, input.foundationId)) return forced;
  }
  const candidates = selectRecipeCandidates(input, { limit: 1, minScore: -50 });
  if (!candidates.length) return getRecipe('recipe-generic-local');
  return getRecipe(candidates[0].recipeId);
}

module.exports = {
  listRecipes,
  getRecipe,
  selectRecipe,
  selectRecipeCandidates,
  scoreRecipe,
  recipeCompatibleWithFoundation,
  RECIPES
};
