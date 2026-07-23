'use strict';

/**
 * Opportunity Value = Demand × Commercial Intent × Lead Value × Attainability × Conversion Fit
 * Each factor is normalised to ~0..1 then combined. Result is modelled.
 * See docs/search-intelligence/07-SCORING.md
 */

const DEFAULT_WEIGHTS = Object.freeze({
  demand: 1,
  commercialIntent: 1,
  leadValue: 1,
  attainability: 1,
  conversionFit: 1
});

function clamp01(n) {
  if (n == null || Number.isNaN(Number(n))) return 0;
  const x = Number(n);
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/**
 * Heuristic normalisers from common provider fields.
 * @param {object} input
 * @param {object} [weights]
 */
function computeOpportunityValue(input, weights) {
  const i = input || {};
  const w = Object.assign({}, DEFAULT_WEIGHTS, weights || {});

  const volume = Number(i.volume || 0);
  const demand = clamp01(i.demand != null ? i.demand : Math.log10(1 + volume) / 4);

  const cpc = Number(i.cpc || 0);
  const commercialIntent = clamp01(
    i.commercialIntent != null
      ? i.commercialIntent
      : Math.min(1, (cpc / 40) * 0.7 + (Number(i.competition || 0) * 0.3))
  );

  const leadValue = clamp01(
    i.leadValue != null
      ? i.leadValue
      : Math.min(1, Number(i.avgJobValue || 0) / 5000)
  );

  let attainability;
  if (i.attainability != null) {
    attainability = clamp01(i.attainability);
  } else if (i.difficulty != null) {
    attainability = clamp01(1 - Number(i.difficulty) / 100);
  } else if (i.position != null && Number(i.position) > 0) {
    attainability = clamp01(1 - (Number(i.position) - 1) / 50);
  } else {
    attainability = 0.5;
  }

  const conversionFit = clamp01(
    i.conversionFit != null
      ? i.conversionFit
      : (i.offersService === false ? 0 : (i.hasRecipe ? 0.85 : 0.55))
  );

  const factors = {
    demand: demand,
    commercialIntent: commercialIntent,
    leadValue: leadValue,
    attainability: attainability,
    conversionFit: conversionFit
  };

  let product = 1;
  let weightSum = 0;
  Object.keys(factors).forEach(function (k) {
    const wk = Number(w[k] == null ? 1 : w[k]);
    weightSum += wk;
    product *= Math.pow(Math.max(factors[k], 0.01), wk);
  });
  const score = weightSum > 0 ? Math.pow(product, 1 / weightSum) : 0;

  return {
    score: Math.round(score * 1000) / 1000,
    factors: factors,
    weights: w,
    labelClass: 'modelled',
    explanation: 'Opportunity Value combines demand, commercial intent, lead value, attainability and conversion fit (0–1 each).'
  };
}

module.exports = {
  DEFAULT_WEIGHTS: DEFAULT_WEIGHTS,
  clamp01: clamp01,
  computeOpportunityValue: computeOpportunityValue
};
