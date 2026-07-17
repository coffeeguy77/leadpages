'use strict';

/**
 * Shared Brain instance for API routes + Control Centre.
 * Wires the in-memory usage store + durable ai_requests persistence.
 * Resets between tests via resetPlatformBrain().
 */

const { createBrain, resetDefaultBrain } = require('./index');
const { getDefaultUsageStore, resetDefaultUsageStore } = require('./usage-store');
const { persistUsageEvent } = require('./usage-persist');
const {
  loadBrainSettings,
  saveLandingDraftProvider,
  getCachedLandingDraftProvider,
  getBrainSettingsStatus,
  resetBrainSettingsCache,
  normalizeProvider
} = require('./settings-store');

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
  resetBrainSettingsCache();
}

/**
 * Hydrate durable Control Centre settings (e.g. landing draft provider) into Brain flags.
 * Call from API routes before reading getLandingDraftProvider().
 * @param {ReturnType<typeof createBrain>} [brain]
 */
async function ensureBrainSettings(brain) {
  await loadBrainSettings();
  const p = getCachedLandingDraftProvider();
  if (!p) return getBrainSettingsStatus();
  const b = brain || getPlatformBrain();
  if (!b.config.flags) b.config.flags = {};
  b.config.flags.landingDraftProvider = p;
  return getBrainSettingsStatus();
}

function envFlagOn(name) {
  return String(process.env[name] || '').toLowerCase() === '1';
}

/**
 * @param {ReturnType<typeof createBrain>|null|undefined} brain
 * @param {string} flagKey — config.flags key
 * @param {string} envName
 * @param {string} [taskId] — if listed in disabledTasks, force off
 */
function isMigrationFlagEnabled(brain, flagKey, envName, taskId) {
  const b = brain || getPlatformBrain();
  const flags = (b.config && b.config.flags) || {};
  if (taskId && Array.isArray(flags.disabledTasks) && flags.disabledTasks.includes(taskId)) {
    return false;
  }
  if (flags[flagKey] === true) return true;
  if (flags[flagKey] === false) return false;
  return envFlagOn(envName);
}

/**
 * Feature flag: Phase 7 landing draft migration.
 * @param {ReturnType<typeof createBrain>} [brain]
 */
function isLandingDraftEnabled(brain) {
  return isMigrationFlagEnabled(brain, 'landingDraft', 'BRAIN_LANDING_DRAFT', 'content.landing_draft');
}

/** @param {ReturnType<typeof createBrain>} [brain] */
function isIgEnrichEnabled(brain) {
  return isMigrationFlagEnabled(brain, 'igEnrich', 'BRAIN_IG_ENRICH', 'ig.caption_enrich');
}

/** @param {ReturnType<typeof createBrain>} [brain] */
function isSuburbIntroEnabled(brain) {
  return isMigrationFlagEnabled(brain, 'suburbIntro', 'BRAIN_SUBURB_INTRO', 'seo.suburb_intro');
}

/** @param {ReturnType<typeof createBrain>} [brain] */
function isHelpAssistEnabled(brain) {
  return isMigrationFlagEnabled(brain, 'helpAssist', 'BRAIN_HELP_ASSIST', 'help.answer');
}

/** @param {ReturnType<typeof createBrain>} [brain] */
function isTradePackEnabled(brain) {
  return isMigrationFlagEnabled(brain, 'tradePack', 'BRAIN_TRADE_PACK', 'pack.trade_generate');
}

/** Theme Studio colour MVP (AI Colour Assistant). Default ON — unset or 0 to disable. */
function isThemeStudioEnabled(brain) {
  const b = brain || getPlatformBrain();
  const flags = (b.config && b.config.flags) || {};
  if (flags.themeStudio === false) return false;
  if (Array.isArray(flags.disabledTasks) && flags.disabledTasks.includes('theme.generate')) {
    return false;
  }
  const env = String(process.env.BRAIN_THEME_STUDIO || '1').toLowerCase();
  return env !== '0' && env !== 'false' && env !== 'off';
}

/** Theme Studio V2 full design product. Default ON — THEME_STUDIO_V2=0 to disable. */
function isThemeStudioV2Enabled(brain) {
  const b = brain || getPlatformBrain();
  const flags = (b.config && b.config.flags) || {};
  if (flags.themeStudioV2 === false) return false;
  const env = String(process.env.THEME_STUDIO_V2 || '1').toLowerCase();
  return env !== '0' && env !== 'false' && env !== 'off';
}

/** Marketing Hub product surface (Phase 9). Default ON — unset or 0 to disable. */
function isMarketingHubEnabled(brain) {
  const b = brain || getPlatformBrain();
  const flags = (b.config && b.config.flags) || {};
  if (flags.marketingHub === false) return false;
  if (Array.isArray(flags.disabledTasks) && flags.disabledTasks.includes('ads.campaign_plan')) {
    return false;
  }
  const env = String(process.env.BRAIN_MARKETING_HUB || '1').toLowerCase();
  return env !== '0' && env !== 'false' && env !== 'off';
}

/**
 * Effective provider for landing drafts:
 * Control Centre / durable DB → optional BRAIN_LANDING_PROVIDER env → BRAIN_PROVIDER.
 * Prefer await ensureBrainSettings() first so cold starts pick up the saved choice.
 * @param {ReturnType<typeof createBrain>} [brain]
 * @returns {string}
 */
function getLandingDraftProvider(brain) {
  const b = brain || getPlatformBrain();
  const flags = (b.config && b.config.flags) || {};
  const fromFlag = normalizeProvider(flags.landingDraftProvider);
  if (fromFlag) return fromFlag;
  const fromCache = getCachedLandingDraftProvider();
  if (fromCache) return fromCache;
  const fromEnv = normalizeProvider(process.env.BRAIN_LANDING_PROVIDER);
  if (fromEnv) return fromEnv;
  return String((b.config && b.config.defaultProvider) || process.env.BRAIN_PROVIDER || 'mock')
    .toLowerCase();
}

/**
 * Set landing draft provider in-memory and persist to brain_settings (no Vercel env needed).
 * @param {string} provider
 * @param {ReturnType<typeof createBrain>} [brain]
 * @param {{ userId?: string|null }} [opts]
 * @returns {Promise<{ provider: string, persisted: boolean, notice: string, error?: string }>}
 */
async function setLandingDraftProvider(provider, brain, opts) {
  const b = brain || getPlatformBrain();
  const p = normalizeProvider(provider);
  if (!p) {
    throw new Error('provider must be anthropic|openai|gemini|mock');
  }
  if (!b.config.flags) b.config.flags = {};
  b.config.flags.landingDraftProvider = p;

  const saved = await saveLandingDraftProvider(p, { userId: opts && opts.userId });
  return {
    provider: p,
    persisted: !!saved.persisted,
    notice: saved.notice || ('Landing drafts now use ' + p),
    error: saved.error
  };
}

module.exports = {
  getPlatformBrain,
  resetPlatformBrain,
  ensureBrainSettings,
  isLandingDraftEnabled,
  isIgEnrichEnabled,
  isSuburbIntroEnabled,
  isHelpAssistEnabled,
  isTradePackEnabled,
  isThemeStudioEnabled,
  isThemeStudioV2Enabled,
  isMarketingHubEnabled,
  getLandingDraftProvider,
  setLandingDraftProvider,
  getBrainSettingsStatus
};
