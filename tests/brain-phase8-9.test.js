'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createBrain, V1_SLICES, createContextResolver } = require('../lib/brain');
const {
  resetPlatformBrain,
  isIgEnrichEnabled,
  isSuburbIntroEnabled,
  isHelpAssistEnabled,
  isTradePackEnabled,
  isThemeStudioEnabled,
  isMarketingHubEnabled
} = require('../lib/brain/platform');
const {
  THEME_TOKEN_SCHEMA,
  normalizeThemeTokens
} = require('../lib/brain/theme-compose');
const {
  ADS_CAMPAIGN_PLAN_SCHEMA,
  ADS_RSA_COPY_SCHEMA,
  normalizeCampaignPlan,
  normalizeRsaCopy,
  buildAdsSummary
} = require('../lib/brain/ads-compose');
const { IG_ENRICH_SCHEMA, normalizeIgEnrich } = require('../lib/brain/ig-compose');

describe('Phase 8–9 + migration flags', () => {
  beforeEach(() => {
    resetPlatformBrain();
    delete process.env.BRAIN_IG_ENRICH;
    delete process.env.BRAIN_SUBURB_INTRO;
    delete process.env.BRAIN_HELP_ASSIST;
    delete process.env.BRAIN_TRADE_PACK;
    delete process.env.BRAIN_THEME_STUDIO;
    delete process.env.BRAIN_MARKETING_HUB;
  });

  it('migration flags default off', () => {
    assert.equal(isIgEnrichEnabled(), false);
    assert.equal(isSuburbIntroEnabled(), false);
    assert.equal(isHelpAssistEnabled(), false);
    assert.equal(isTradePackEnabled(), false);
  });

  it('migration flags enable with =1', () => {
    process.env.BRAIN_IG_ENRICH = '1';
    process.env.BRAIN_SUBURB_INTRO = '1';
    process.env.BRAIN_HELP_ASSIST = '1';
    process.env.BRAIN_TRADE_PACK = '1';
    resetPlatformBrain();
    assert.equal(isIgEnrichEnabled(), true);
    assert.equal(isSuburbIntroEnabled(), true);
    assert.equal(isHelpAssistEnabled(), true);
    assert.equal(isTradePackEnabled(), true);
  });

  it('Theme Studio + Marketing Hub default on', () => {
    assert.equal(isThemeStudioEnabled(), true);
    assert.equal(isMarketingHubEnabled(), true);
  });

  it('Theme Studio + Marketing Hub disable with =0', () => {
    process.env.BRAIN_THEME_STUDIO = '0';
    process.env.BRAIN_MARKETING_HUB = '0';
    resetPlatformBrain();
    assert.equal(isThemeStudioEnabled(), false);
    assert.equal(isMarketingHubEnabled(), false);
  });

  it('generates theme tokens via Brain', async () => {
    const brain = createBrain();
    const res = await brain.generateStructured({
      taskId: 'theme.generate',
      promptId: 'theme.generate',
      siteId: 's1',
      site: {
        id: 's1',
        business_name: 'Canberra Plumbing',
        owner_user_id: 'u1',
        config: { trade: 'Plumber', theme: { pipe: '#0ea5e9' } }
      },
      actor: { userId: 'u1', role: 'super' },
      contextSlices: ['site.identity', 'site.brand'],
      input: { brief: 'Trust + urgency', mood: 'hi-vis' },
      responseSchema: THEME_TOKEN_SCHEMA
    });
    assert.equal(res.ok, true);
    const { theme } = normalizeThemeTokens(res.output);
    assert.match(theme.pipe, /^#[0-9a-f]{6}$/);
    assert.match(theme.hivis, /^#[0-9a-f]{6}$/);
    assert.match(theme.steel, /^#[0-9a-f]{6}$/);
    assert.match(theme.safety, /^#[0-9a-f]{6}$/);
    assert.match(theme.lightBg, /^#[0-9a-f]{6}$/);
  });

  it('refines theme tokens via Brain', async () => {
    const brain = createBrain();
    const res = await brain.generateStructured({
      taskId: 'theme.refine',
      promptId: 'theme.refine',
      siteId: 's1',
      site: {
        id: 's1',
        business_name: 'Canberra Plumbing',
        owner_user_id: 'u1',
        config: { trade: 'Plumber' }
      },
      actor: { role: 'super' },
      contextSlices: ['site.identity', 'site.brand'],
      input: {
        feedback: 'Darker header',
        currentTheme: JSON.stringify({
          pipe: '#1f7bb8',
          hivis: '#ff6a1f',
          steel: '#1a2230',
          safety: '#ffc400',
          lightBg: '#eef2f6'
        })
      },
      responseSchema: THEME_TOKEN_SCHEMA
    });
    assert.equal(res.ok, true);
    assert.ok(normalizeThemeTokens(res.output).theme.pipe);
  });

  it('generates ads campaign plan + RSA with char limits', async () => {
    const brain = createBrain();
    const planRes = await brain.generateStructured({
      taskId: 'ads.campaign_plan',
      promptId: 'ads.campaign_plan',
      siteId: 's1',
      site: {
        id: 's1',
        business_name: 'Canberra Plumbing',
        owner_user_id: 'u1',
        config: { trade: 'Plumber', services: [{ title: 'Blocked drains' }] }
      },
      actor: { role: 'super' },
      adsSummary: buildAdsSummary(null, { spendAud: 12, clicks: 40, impressions: 900, conversions: 2 }),
      contextSlices: ['site.identity', 'site.services', 'site.areas', 'ads.summary'],
      input: { goal: 'More calls', budgetHints: '$30/day', brief: '' },
      responseSchema: ADS_CAMPAIGN_PLAN_SCHEMA
    });
    assert.equal(planRes.ok, true);
    const plan = normalizeCampaignPlan(planRes.output);
    assert.ok(plan.campaignName);
    assert.ok(plan.keywords.length >= 1);

    const rsaRes = await brain.generateStructured({
      taskId: 'ads.rsa_copy',
      promptId: 'ads.rsa_copy',
      siteId: 's1',
      site: {
        id: 's1',
        business_name: 'Canberra Plumbing',
        owner_user_id: 'u1',
        config: { trade: 'Plumber' }
      },
      actor: { role: 'super' },
      contextSlices: ['site.identity', 'site.areas'],
      input: { offer: 'Blocked drain Canberra', location: 'Canberra', landingUrl: '/', brief: '' },
      responseSchema: ADS_RSA_COPY_SCHEMA
    });
    assert.equal(rsaRes.ok, true);
    const rsa = normalizeRsaCopy(rsaRes.output);
    assert.ok(rsa.headlines.every((h) => h.length <= 30));
    assert.ok(rsa.descriptions.every((d) => d.length <= 90));
    assert.ok(rsa.path1.length <= 15);
  });

  it('ads.summary context slice never includes tokens', () => {
    assert.ok(V1_SLICES.includes('ads.summary'));
    const resolver = createContextResolver();
    const resolved = resolver.resolve({
      site: { id: 's1', business_name: 'X', owner_user_id: 'u1', config: {} },
      actor: { role: 'super' },
      adsSummary: buildAdsSummary(
        { customer_id: '1234567890', refresh_token_enc: 'SECRET', status: 'connected' },
        { spendAud: 1, clicks: 2, impressions: 3, conversions: 0 }
      ),
      slices: ['ads.summary']
    });
    const summary = resolved.context['ads.summary'];
    assert.equal(summary.connected, true);
    assert.ok(!JSON.stringify(summary).includes('SECRET'));
    assert.ok(!JSON.stringify(summary).includes('1234567890'));
  });

  it('normalizes IG enrich output', () => {
    const o = normalizeIgEnrich({ title: '  New bathroom  ', service: 'Reno', location: null });
    assert.equal(o.title, 'New bathroom');
    assert.equal(o.location, '');
    assert.ok(IG_ENRICH_SCHEMA.required.includes('title'));
  });
});
