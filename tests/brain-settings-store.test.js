'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  loadBrainSettings,
  saveLandingDraftProvider,
  getCachedLandingDraftProvider,
  resetBrainSettingsCache,
  setBrainSettingsAdminFactory
} = require('../lib/brain/settings-store');
const {
  getPlatformBrain,
  resetPlatformBrain,
  ensureBrainSettings,
  getLandingDraftProvider,
  setLandingDraftProvider
} = require('../lib/brain/platform');

function fakeAdmin(store) {
  return {
    from(table) {
      assert.equal(table, 'brain_settings');
      return {
        select() {
          return {
            eq(_k, key) {
              return {
                async maybeSingle() {
                  const row = store[key] || null;
                  return { data: row, error: null };
                }
              };
            }
          };
        },
        async upsert(row) {
          store[row.key] = {
            key: row.key,
            value: row.value,
            updated_at: row.updated_at,
            updated_by: row.updated_by
          };
          return { error: null };
        }
      };
    }
  };
}

describe('Brain settings store — durable landing provider', () => {
  beforeEach(() => {
    resetPlatformBrain();
    resetBrainSettingsCache();
    setBrainSettingsAdminFactory(null);
    delete process.env.BRAIN_LANDING_PROVIDER;
  });

  afterEach(() => {
    setBrainSettingsAdminFactory(null);
    resetBrainSettingsCache();
    resetPlatformBrain();
    delete process.env.BRAIN_LANDING_PROVIDER;
  });

  it('saves and reloads landing draft provider from durable store', async () => {
    const db = {};
    setBrainSettingsAdminFactory(() => fakeAdmin(db));

    const saved = await saveLandingDraftProvider('openai', { userId: 'u1' });
    assert.equal(saved.ok, true);
    assert.equal(saved.persisted, true);
    assert.equal(getCachedLandingDraftProvider(), 'openai');
    assert.equal(db.landing_draft_provider.value.provider, 'openai');

    resetBrainSettingsCache();
    assert.equal(getCachedLandingDraftProvider(), null);

    await loadBrainSettings({ force: true });
    assert.equal(getCachedLandingDraftProvider(), 'openai');
  });

  it('ensureBrainSettings hydrates platform Brain flags', async () => {
    const db = {
      landing_draft_provider: {
        key: 'landing_draft_provider',
        value: { provider: 'gemini' }
      }
    };
    setBrainSettingsAdminFactory(() => fakeAdmin(db));

    const brain = getPlatformBrain();
    await ensureBrainSettings(brain);
    assert.equal(getLandingDraftProvider(brain), 'gemini');
  });

  it('setLandingDraftProvider persists without BRAIN_LANDING_PROVIDER env', async () => {
    const db = {};
    setBrainSettingsAdminFactory(() => fakeAdmin(db));
    const brain = getPlatformBrain();

    const result = await setLandingDraftProvider('openai', brain, { userId: 'admin' });
    assert.equal(result.provider, 'openai');
    assert.equal(result.persisted, true);
    assert.equal(getLandingDraftProvider(brain), 'openai');
    assert.ok(!process.env.BRAIN_LANDING_PROVIDER);

    resetPlatformBrain();
    resetBrainSettingsCache();
    const brain2 = getPlatformBrain();
    await ensureBrainSettings(brain2);
    assert.equal(getLandingDraftProvider(brain2), 'openai');
  });

  it('falls back to BRAIN_PROVIDER when nothing saved', async () => {
    setBrainSettingsAdminFactory(() => fakeAdmin({}));
    process.env.BRAIN_PROVIDER = 'anthropic';
    const brain = getPlatformBrain();
    await ensureBrainSettings(brain);
    assert.equal(getLandingDraftProvider(brain), 'anthropic');
  });
});
