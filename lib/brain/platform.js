'use strict';

/**
 * Shared Brain instance for API routes + Control Centre.
 * Wires the in-memory usage store + durable ai_requests persistence.
 * Resets between tests via resetPlatformBrain().
 */

const { createBrain, resetDefaultBrain } = require('./index');
const { getDefaultUsageStore, resetDefaultUsageStore } = require('./usage-store');
const { persistUsageEvent } = require('./usage-persist');

let _platform = null;

/**
 * Record to the process buffer, then await durable ledger write.
 * Must return a Promise so gateway can await before the serverless isolate freezes.
 */
function wireUsage(store, extraOnUsage) {
  return async function onUsage(event) {
    try {
      store.record(event);
    } catch (_e) {
      /* ignore buffer errors */
    }
    try {
      await persistUsageEvent(event);
    } catch (_e) {
      /* persistUsageEvent already records lastPersistError */
    }
    if (typeof extraOnUsage === 'function') {
      try {
        const extra = extraOnUsage(event);
        if (extra && typeof extra.then === 'function') await extra;
      } catch (_e2) {
        /* ignore */
      }
    }
  };
}

/**
 * @param {object} [opts] — forwarded to createBrain (tests)
 */
function getPlatformBrain(opts) {
  if (opts) {
    const store = getDefaultUsageStore();
    return createBrain(
      Object.assign({}, opts, {
        onUsage: wireUsage(store, opts.onUsage)
      })
    );
  }
  if (!_platform) {
    const store = getDefaultUsageStore();
    _platform = createBrain({
      onUsage: wireUsage(store, null)
    });
  }
  return _platform;
}

function resetPlatformBrain() {
  _platform = null;
  resetDefaultBrain();
  resetDefaultUsageStore();
}

/**
 * Feature flag: Phase 7 landing draft migration.
 * @param {ReturnType<typeof createBrain>} [brain]
 */
function isLandingDraftEnabled(brain) {
  const b = brain || getPlatformBrain();
  const flags = (b.config && b.config.flags) || {};
  if (flags.landingDraft === true) return true;
  if (Array.isArray(flags.disabledTasks) && flags.disabledTasks.includes('content.landing_draft')) {
    return false;
  }
  return String(process.env.BRAIN_LANDING_DRAFT || '').toLowerCase() === '1';
}

/**
 * Effective provider for landing drafts: runtime flag → BRAIN_LANDING_PROVIDER → BRAIN_PROVIDER.
 * @param {ReturnType<typeof createBrain>} [brain]
 * @returns {string}
 */
function getLandingDraftProvider(brain) {
  const b = brain || getPlatformBrain();
  const flags = (b.config && b.config.flags) || {};
  const fromFlag = String(flags.landingDraftProvider || '').toLowerCase().trim();
  if (['anthropic', 'openai', 'gemini', 'mock'].includes(fromFlag)) return fromFlag;
  const fromEnv = String(process.env.BRAIN_LANDING_PROVIDER || '').toLowerCase().trim();
  if (['anthropic', 'openai', 'gemini', 'mock'].includes(fromEnv)) return fromEnv;
  return String((b.config && b.config.defaultProvider) || process.env.BRAIN_PROVIDER || 'mock')
    .toLowerCase();
}

/**
 * Runtime overlay (this isolate). Persist via BRAIN_LANDING_PROVIDER for durability.
 * @param {string} provider
 * @param {ReturnType<typeof createBrain>} [brain]
 */
function setLandingDraftProvider(provider, brain) {
  const b = brain || getPlatformBrain();
  const p = String(provider || '').toLowerCase().trim();
  if (!['anthropic', 'openai', 'gemini', 'mock'].includes(p)) {
    throw new Error('provider must be anthropic|openai|gemini|mock');
  }
  if (!b.config.flags) b.config.flags = {};
  b.config.flags.landingDraftProvider = p;
  return p;
}

module.exports = {
  getPlatformBrain,
  resetPlatformBrain,
  isLandingDraftEnabled,
  getLandingDraftProvider,
  setLandingDraftProvider
};
