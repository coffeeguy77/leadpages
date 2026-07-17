'use strict';

/**
 * Shared Brain instance for API routes + Control Centre.
 * Wires the in-memory usage store. Resets between tests via resetPlatformBrain().
 */

const { createBrain, resetDefaultBrain } = require('./index');
const { getDefaultUsageStore, resetDefaultUsageStore } = require('./usage-store');

let _platform = null;

/**
 * @param {object} [opts] — forwarded to createBrain (tests)
 */
function getPlatformBrain(opts) {
  if (opts) {
    const store = getDefaultUsageStore();
    return createBrain(
      Object.assign({}, opts, {
        onUsage: function(event) {
          store.record(event);
          if (typeof opts.onUsage === 'function') opts.onUsage(event);
        }
      })
    );
  }
  if (!_platform) {
    const store = getDefaultUsageStore();
    _platform = createBrain({
      onUsage: function(event) {
        store.record(event);
      }
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

module.exports = {
  getPlatformBrain,
  resetPlatformBrain,
  isLandingDraftEnabled
};
