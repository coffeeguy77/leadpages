'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  createBrain,
  createUsageStore,
  getDefaultUsageStore,
} = require('../lib/brain');
const {
  getPlatformBrain,
  resetPlatformBrain,
  isLandingDraftEnabled,
} = require('../lib/brain/platform');

describe('Phase 6 — usage store', () => {
  it('records and summarises events', () => {
    const store = createUsageStore({ capacity: 3 });
    store.record({ taskId: 'help.answer', success: true, inputTokens: 10, outputTokens: 5 });
    store.record({ taskId: 'help.answer', success: false, errorCode: 'provider_unavailable' });
    store.record({ taskId: 'seo.suburb_intro', success: true, estimateUsd: 0.01 });
    store.record({ taskId: 'extra', success: true }); // drops oldest

    assert.equal(store.summary().totalEvents, 3);
    assert.equal(store.recent().length, 3);
    assert.equal(store.recentFailures().length, 1);
    assert.equal(store.summary().byTask['help.answer'].failures, 1);
  });

  it('platform brain records usage via onUsage', async () => {
    resetPlatformBrain();
    const brain = getPlatformBrain({
      config: {
        models: {
          'mock:default': { provider: 'mock', model: 'mock-default', maxTokens: 100 },
        },
        routes: {
          'generic.fast': {
            taskId: 'generic.fast',
            primary: { provider: 'mock', model: 'mock-default' },
          },
        },
      },
    });
    const res = await brain.generate({
      taskId: 'generic.fast',
      input: 'probe',
    });
    assert.equal(res.ok, true);
    const store = getDefaultUsageStore();
    assert.ok(store.summary().totalEvents >= 1);
    assert.ok(store.recent().some((e) => e.taskId === 'generic.fast'));
    resetPlatformBrain();
  });
});

describe('Phase 7 — landing draft flag', () => {
  beforeEach(() => {
    resetPlatformBrain();
    delete process.env.BRAIN_LANDING_DRAFT;
  });

  it('defaults to disabled', () => {
    assert.equal(isLandingDraftEnabled(), false);
  });

  it('enables when BRAIN_LANDING_DRAFT=1', () => {
    process.env.BRAIN_LANDING_DRAFT = '1';
    resetPlatformBrain();
    assert.equal(isLandingDraftEnabled(), true);
    delete process.env.BRAIN_LANDING_DRAFT;
  });

  it('generates structured landing draft via prompt registry', async () => {
    const brain = createBrain({
      mock: {
        structuredFixture: {
          title: 'Roofing Canberra',
          bodyMarkdown: '## Local roofers\n\nCall today.',
        },
      },
    });
    const res = await brain.generateStructured({
      taskId: 'content.landing_draft',
      promptId: 'content.landing_draft',
      siteId: 'site-1',
      site: {
        id: 'site-1',
        business_name: 'Canberra Roofs',
        owner_user_id: 'u1',
        config: {
          trade: 'roofer',
          brandVoice: 'Straight talk',
          services: [{ title: 'Re-roofing' }],
        },
      },
      actor: { userId: 'u1', role: 'client' },
      contextSlices: ['site.identity', 'site.brand', 'site.services'],
      input: { brief: 'Family roofing business' },
      responseSchema: {
        type: 'object',
        required: ['title', 'bodyMarkdown'],
        properties: {
          title: { type: 'string' },
          bodyMarkdown: { type: 'string' },
        },
      },
    });
    assert.equal(res.ok, true);
    assert.equal(res.output.title, 'Roofing Canberra');
    assert.match(res.output.bodyMarkdown, /Local roofers/);
    assert.equal(res.prompt.promptId, 'content.landing_draft');
  });
});
