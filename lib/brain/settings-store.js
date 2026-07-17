'use strict';

/**
 * Durable Brain settings (Supabase brain_settings).
 * Backs AI Control Centre choices so they survive Vercel cold starts
 * without requiring extra env vars (e.g. BRAIN_LANDING_PROVIDER).
 */

const KEY_LANDING_PROVIDER = 'landing_draft_provider';
const PROVIDERS = new Set(['anthropic', 'openai', 'gemini', 'mock']);

/** @type {{ loaded: boolean, landingDraftProvider: string|null, source: string|null, lastError: string|null, loadedAt: string|null }} */
let cache = {
  loaded: false,
  landingDraftProvider: null,
  source: null,
  lastError: null,
  loadedAt: null
};

let _admin = null;
let _adminFailed = false;
/** @type {null|(() => object|null)} */
let _adminFactory = null;

function normalizeProvider(value) {
  const p = String(value || '').toLowerCase().trim();
  return PROVIDERS.has(p) ? p : null;
}

function getAdmin() {
  if (typeof _adminFactory === 'function') {
    try {
      return _adminFactory();
    } catch (_e) {
      return null;
    }
  }
  if (_admin) return _admin;
  if (_adminFailed) return null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  let createClient;
  try {
    createClient = require('@supabase/supabase-js').createClient;
  } catch (_e) {
    _adminFailed = true;
    return null;
  }
  try {
    _admin = createClient(url, key, { auth: { persistSession: false } });
    return _admin;
  } catch (_e2) {
    _adminFailed = true;
    _admin = null;
    return null;
  }
}

/**
 * Test hook — inject a fake admin client (or null).
 * @param {null|(() => object|null)} factory
 */
function setBrainSettingsAdminFactory(factory) {
  _adminFactory = factory;
  _admin = null;
  _adminFailed = false;
}

function getCachedLandingDraftProvider() {
  return cache.landingDraftProvider;
}

function getBrainSettingsStatus() {
  return {
    loaded: cache.loaded,
    landingDraftProvider: cache.landingDraftProvider,
    source: cache.source,
    lastError: cache.lastError,
    loadedAt: cache.loadedAt
  };
}

function resetBrainSettingsCache() {
  cache = {
    loaded: false,
    landingDraftProvider: null,
    source: null,
    lastError: null,
    loadedAt: null
  };
}

/**
 * Load durable settings into the process cache (idempotent within an isolate).
 * @param {{ force?: boolean }} [opts]
 */
async function loadBrainSettings(opts) {
  const force = !!(opts && opts.force);
  if (cache.loaded && !force) return getBrainSettingsStatus();

  const admin = getAdmin();
  if (!admin) {
    cache.loaded = true;
    cache.source = 'unavailable';
    cache.lastError = 'supabase_not_configured';
    cache.loadedAt = new Date().toISOString();
    return getBrainSettingsStatus();
  }

  try {
    const { data, error } = await admin
      .from('brain_settings')
      .select('key,value')
      .eq('key', KEY_LANDING_PROVIDER)
      .maybeSingle();

    if (error) {
      // Table missing until SQL is applied — treat as empty, not fatal.
      cache.loaded = true;
      cache.landingDraftProvider = null;
      cache.source = 'error';
      cache.lastError = error.message || 'load_failed';
      cache.loadedAt = new Date().toISOString();
      return getBrainSettingsStatus();
    }

    const raw =
      data && data.value && typeof data.value === 'object'
        ? data.value.provider
        : null;
    cache.landingDraftProvider = normalizeProvider(raw);
    cache.loaded = true;
    cache.source = 'durable';
    cache.lastError = null;
    cache.loadedAt = new Date().toISOString();
    return getBrainSettingsStatus();
  } catch (err) {
    cache.loaded = true;
    cache.source = 'error';
    cache.lastError = (err && err.message) || 'load_failed';
    cache.loadedAt = new Date().toISOString();
    return getBrainSettingsStatus();
  }
}

/**
 * Persist landing draft provider and update cache.
 * @param {string} provider
 * @param {{ userId?: string|null }} [opts]
 */
async function saveLandingDraftProvider(provider, opts) {
  const p = normalizeProvider(provider);
  if (!p) {
    return { ok: false, error: 'provider must be anthropic|openai|gemini|mock' };
  }

  cache.landingDraftProvider = p;
  cache.loaded = true;
  cache.source = 'memory';
  cache.lastError = null;
  cache.loadedAt = new Date().toISOString();

  const admin = getAdmin();
  if (!admin) {
    return {
      ok: true,
      provider: p,
      persisted: false,
      error: 'supabase_not_configured',
      notice: 'Saved in this isolate only — Supabase is not configured for durable settings.'
    };
  }

  const row = {
    key: KEY_LANDING_PROVIDER,
    value: { provider: p },
    updated_at: new Date().toISOString(),
    updated_by: (opts && opts.userId) || null
  };

  try {
    const { error } = await admin.from('brain_settings').upsert(row, { onConflict: 'key' });
    if (error) {
      cache.source = 'memory';
      cache.lastError = error.message || 'save_failed';
      return {
        ok: true,
        provider: p,
        persisted: false,
        error: error.message || 'save_failed',
        notice:
          'Saved in this isolate only. Apply db/brain_settings.sql in Supabase so the choice survives deploys.'
      };
    }
    cache.source = 'durable';
    cache.lastError = null;
    return {
      ok: true,
      provider: p,
      persisted: true,
      notice: 'Landing drafts will use ' + p + ' across deploys and cold starts.'
    };
  } catch (err) {
    cache.source = 'memory';
    cache.lastError = (err && err.message) || 'save_failed';
    return {
      ok: true,
      provider: p,
      persisted: false,
      error: (err && err.message) || 'save_failed',
      notice:
        'Saved in this isolate only. Apply db/brain_settings.sql in Supabase so the choice survives deploys.'
    };
  }
}

module.exports = {
  KEY_LANDING_PROVIDER,
  normalizeProvider,
  loadBrainSettings,
  saveLandingDraftProvider,
  getCachedLandingDraftProvider,
  getBrainSettingsStatus,
  resetBrainSettingsCache,
  setBrainSettingsAdminFactory
};
