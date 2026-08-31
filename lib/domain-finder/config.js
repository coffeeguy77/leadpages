'use strict';

/**
 * Domain Finder — configurable limits and AU TLD policy.
 * User product rule: only .com.au / .au / .net.au
 */

function envInt(name, fallback) {
  const n = parseInt(process.env[name], 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const FINDER_TLDS = ['com.au', 'au', 'net.au'];

const DEFAULTS = {
  tlds: FINDER_TLDS.slice(),
  targetAvailable: envInt('DOMAIN_FINDER_TARGET', 18),
  maxGenerationRounds: envInt('DOMAIN_FINDER_MAX_ROUNDS', 3),
  candidatesPerRound: envInt('DOMAIN_FINDER_CANDIDATES_PER_ROUND', 24),
  maxDomainsChecked: envInt('DOMAIN_FINDER_MAX_CHECKS', 120),
  availabilityBatchSize: envInt('DOMAIN_FINDER_BATCH', 40),
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
  DEFAULTS,
  getConfig
};
