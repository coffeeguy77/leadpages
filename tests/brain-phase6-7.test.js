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
    const { LANDING_DRAFT_SCHEMA } = require('../lib/brain/landing-compose');
    const brain = createBrain({
      mock: {
        structuredFixture: {
          primaryKeyword: 'Roofing Canberra',
          secondaryKeywords: ['Roof repairs Canberra'],
          title: 'Roofing Canberra | Canberra Roofs',
          slug: 'roofing-canberra',
          meta: 'Canberra Roofs provides roofing and repairs across Canberra.',
          h1: 'Roofing Canberra',
          bodyMarkdown: '## Local roofers\n\nCall today for a free quote.',
          faqs: [{ question: 'Do you re-roof?', answer: 'Yes, full re-roofing.' }],
          ctaHeadline: 'Get in touch',
          ctaBody: 'Request a free quote today.',
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
      responseSchema: LANDING_DRAFT_SCHEMA,
    });
    assert.equal(res.ok, true);
    assert.equal(res.output.title, 'Roofing Canberra | Canberra Roofs');
    assert.equal(res.output.slug, 'roofing-canberra');
    assert.equal(res.output.h1, 'Roofing Canberra');
    assert.match(res.output.bodyMarkdown, /Local roofers/);
    assert.equal(res.prompt.promptId, 'content.landing_draft');
    assert.equal(res.prompt.version, 3);
  });

  it('active landing draft prompt is full-page SEO v3', () => {
    const { createPromptRegistry } = require('../lib/brain');
    const registry = createPromptRegistry();
    const def = registry.get('content.landing_draft');
    assert.equal(def.version, 3);
    assert.equal(def.status, 'active');
    assert.match(def.system, /primaryKeyword/i);
    assert.match(def.system, /900–1100 words|900-1100 words/i);
    assert.match(def.system, /faqs/i);
    assert.match(def.system, /no emoji/i);
    assert.match(def.system, /1–2% density|1-2% density/i);
  });
});
