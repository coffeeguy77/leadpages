'use strict';

/**
 * Domain Finder — configurable limits and AU TLD policy.
 * User product rule: only .com.au / .au / .net.au
 *
 * Defaults are tuned for Vercel serverless (~60s maxDuration): finish in ~45–50s
 * or return partial results instead of a gateway 504.
 */

function envInt(name, fallback) {
  const n = parseInt(process.env[name], 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const FINDER_TLDS = ['com.au', 'au', 'net.au'];

/** Prefer checking this TLD first — fastest path to “is this name ownable?” */
const PRIMARY_TLD = 'com.au';

const DEFAULTS = {
  tlds: FINDER_TLDS.slice(),
  primaryTld: PRIMARY_TLD,
  // Aim for a solid shortlist without burning the whole serverless window.
  targetAvailable: envInt('DOMAIN_FINDER_TARGET', 10),
  maxGenerationRounds: envInt('DOMAIN_FINDER_MAX_ROUNDS', 2),
  candidatesPerRound: envInt('DOMAIN_FINDER_CANDIDATES_PER_ROUND', 12),
  maxDomainsChecked: envInt('DOMAIN_FINDER_MAX_CHECKS', 40),
  availabilityBatchSize: envInt('DOMAIN_FINDER_BATCH', 16),
  // Leave headroom under Vercel 60s (and Brain timeouts).
  deadlineMs: envInt('DOMAIN_FINDER_DEADLINE_MS', 28000),
  aiGenerateTimeoutMs: envInt('DOMAIN_FINDER_AI_GENERATE_MS', 12000),
  aiRankTimeoutMs: envInt('DOMAIN_FINDER_AI_RANK_MS', 10000),
  minResultsToSkipExtraRound: envInt('DOMAIN_FINDER_MIN_OK', 5),
  cacheAvailableMs: envInt('DOMAIN_FINDER_CACHE_AVAILABLE_MS', 10 * 60 * 1000),
  cacheUnavailableMs: envInt('DOMAIN_FINDER_CACHE_UNAVAILABLE_MS', 18 * 60 * 60 * 1000),
  minRootLen: 3,
  maxRootLen: 32,
  preferRootLenMin: 5,
  preferRootLenMax: 16
};

function getConfig(overrides) {
  return Object.assign({}, DEFAULTS, overrides || {});
}

module.exports = {
  FINDER_TLDS,
  PRIMARY_TLD,
  DEFAULTS,
  getConfig
};
