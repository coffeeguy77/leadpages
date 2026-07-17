'use strict';

/**
 * Published API list prices for Brain cost estimates (USD per 1M tokens).
 * Ops forecast only — not a substitute for provider invoices.
 * Update when model IDs or vendor rates change.
 *
 * As-of: 2026-07 (Anthropic Sonnet/Haiku, OpenAI GPT-4o family, Gemini Flash).
 */

/** @typedef {{ inputPerMTok: number, outputPerMTok: number, cachedInputPerMTok?: number, label: string }} ModelRate */

/** @type {Array<{ match: RegExp, rate: ModelRate }>} */
const MODEL_RATES = [
  {
    match: /^claude-opus/i,
    rate: { inputPerMTok: 15, outputPerMTok: 75, cachedInputPerMTok: 1.5, label: 'Claude Opus' }
  },
  {
    match: /^claude-sonnet/i,
    rate: { inputPerMTok: 3, outputPerMTok: 15, cachedInputPerMTok: 0.3, label: 'Claude Sonnet' }
  },
  {
    match: /^claude-haiku-4/i,
    rate: { inputPerMTok: 1, outputPerMTok: 5, cachedInputPerMTok: 0.1, label: 'Claude Haiku 4.x' }
  },
  {
    match: /^claude-haiku/i,
    rate: { inputPerMTok: 0.8, outputPerMTok: 4, cachedInputPerMTok: 0.08, label: 'Claude Haiku 3.x' }
  },
  {
    match: /^gpt-4o-mini/i,
    rate: { inputPerMTok: 0.15, outputPerMTok: 0.6, cachedInputPerMTok: 0.075, label: 'GPT-4o mini' }
  },
  {
    match: /^gpt-4o/i,
    rate: { inputPerMTok: 2.5, outputPerMTok: 10, cachedInputPerMTok: 1.25, label: 'GPT-4o' }
  },
  {
    match: /^gpt-4\.1-mini/i,
    rate: { inputPerMTok: 0.4, outputPerMTok: 1.6, label: 'GPT-4.1 mini' }
  },
  {
    match: /^gpt-4\.1/i,
    rate: { inputPerMTok: 2, outputPerMTok: 8, label: 'GPT-4.1' }
  },
  {
    match: /^gemini-2\.5-flash/i,
    rate: { inputPerMTok: 0.075, outputPerMTok: 0.3, label: 'Gemini 2.5 Flash' }
  },
  {
    match: /^gemini-2\.0-flash/i,
    rate: { inputPerMTok: 0.1, outputPerMTok: 0.4, label: 'Gemini 2.0 Flash' }
  },
  {
    match: /^gemini-.*flash/i,
    rate: { inputPerMTok: 0.1, outputPerMTok: 0.4, label: 'Gemini Flash' }
  },
  {
    match: /^gemini/i,
    rate: { inputPerMTok: 1.25, outputPerMTok: 5, label: 'Gemini (default Pro-tier)' }
  },
  {
    match: /^mock/i,
    rate: { inputPerMTok: 0, outputPerMTok: 0, label: 'Mock (free)' }
  }
];

const FALLBACK_RATE = {
  inputPerMTok: 3,
  outputPerMTok: 15,
  label: 'Unknown model (Sonnet-like fallback)'
};

/**
 * @param {string} [provider]
 * @param {string} [model]
 * @returns {ModelRate}
 */
function resolveModelRate(provider, model) {
  const p = String(provider || '').toLowerCase();
  const m = String(model || '');
  if (p === 'mock' || /^mock/i.test(m)) {
    return { inputPerMTok: 0, outputPerMTok: 0, label: 'Mock (free)' };
  }
  for (const row of MODEL_RATES) {
    if (row.match.test(m)) return row.rate;
  }
  return FALLBACK_RATE;
}

/**
 * @param {object} args
 * @param {string} [args.provider]
 * @param {string} [args.model]
 * @param {number} [args.inputTokens]
 * @param {number} [args.outputTokens]
 * @param {number} [args.cachedTokens]
 * @returns {{ usd: number, rate: ModelRate, inputTokens: number, outputTokens: number, cachedTokens: number }}
 */
function costFromUsage(args) {
  const a = args || {};
  const inputTokens = Math.max(0, Number(a.inputTokens) || 0);
  const outputTokens = Math.max(0, Number(a.outputTokens) || 0);
  const cachedTokens = Math.max(0, Number(a.cachedTokens) || 0);
  const rate = resolveModelRate(a.provider, a.model);

  // Bill non-cached input at full rate; treat cachedTokens as cache-read when provided.
  const billableInput = Math.max(0, inputTokens - cachedTokens);
  const cachedRate =
    typeof rate.cachedInputPerMTok === 'number' ? rate.cachedInputPerMTok : rate.inputPerMTok;

  const usd =
    (billableInput / 1e6) * rate.inputPerMTok +
    (cachedTokens / 1e6) * cachedRate +
    (outputTokens / 1e6) * rate.outputPerMTok;

  return {
    usd: Math.round(usd * 1e6) / 1e6,
    rate,
    inputTokens,
    outputTokens,
    cachedTokens
  };
}

module.exports = {
  MODEL_RATES,
  resolveModelRate,
  costFromUsage
};
