'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  createBrain,
  createPromptRegistry,
  createContextResolver,
  renderTemplate,
  DEFAULT_PROMPTS,
  V1_SLICES,
  BrainError,
  CODES,
} = require('../lib/brain');

describe('LeadPages Brain Phase 3 — prompts', () => {
  it('ships default active prompts for known tasks', () => {
    const registry = createPromptRegistry();
    const ids = new Set(DEFAULT_PROMPTS.map((p) => p.promptId));
    assert.ok(ids.has('seo.suburb_intro'));
    assert.ok(ids.has('content.landing_draft'));
    assert.ok(ids.has('help.answer'));
    const active = registry.get('seo.suburb_intro');
    assert.equal(active.status, 'active');
    assert.equal(active.version, 1);
  });

  it('renders templates with snapshot-stable output', () => {
    const registry = createPromptRegistry();
    const rendered = registry.render('seo.suburb_intro', {
      businessName: 'RTT Plumbing',
      trade: 'plumber',
      suburb: 'Belconnen',
    });
    assert.equal(rendered.promptId, 'seo.suburb_intro');
    assert.equal(rendered.version, 1);
    assert.match(rendered.system, /Australian trade/i);
    assert.equal(
      rendered.user,
      'Business: RTT Plumbing. Trade: plumber. Suburb: Belconnen. ' +
        'Write one unique introductory paragraph for this suburb page.'
    );
  });

  it('fails closed on missing variables', () => {
    assert.throws(
      () => renderTemplate('Hello {{name}}', {}, ['name']),
      (err) => err instanceof BrainError && err.code === CODES.bad_request
    );
  });

  it('fails closed on undeclared template variables', () => {
    assert.throws(
      () => renderTemplate('Hello {{other}}', { other: 'x' }, ['name']),
      (err) => err instanceof BrainError && err.code === CODES.bad_request
    );
  });

  it('pins prompt versions and prefers latest active', () => {
    const registry = createPromptRegistry([
      {
        promptId: 'demo.ping',
        version: 1,
        taskId: 'generic.fast',
        status: 'deprecated',
        system: 'v1',
        user: '{{msg}}',
        variables: ['msg'],
      },
      {
        promptId: 'demo.ping',
        version: 2,
        taskId: 'generic.fast',
        status: 'active',
        system: 'v2',
        user: '{{msg}}',
        variables: ['msg'],
      },
    ]);
    assert.equal(registry.get('demo.ping').version, 2);
    assert.equal(registry.get('demo.ping', 1).status, 'deprecated');
    assert.equal(registry.render('demo.ping', { msg: 'hi' }).system, 'v2');
  });
});

describe('LeadPages Brain Phase 3 — context', () => {
  const sampleSite = {
    id: 'site-1',
    slug: 'rtt',
    business_name: 'RTT Plumbing',
    owner_user_id: 'user-1',
    servicing_partner_id: 'partner-9',
    custom_domain: 'example.com.au',
    config: {
      trade: 'plumber',
      phone: '0400 000 000',
      email: 'hi@example.com',
      logo: 'https://cdn.example/logo.png',
      theme: { colours: { primary: '#123456' } },
      brandVoice: 'Friendly local experts',
      services: [
        { title: 'Blocked drains', summary: 'Same-day' },
        { title: 'Hot water', summary: 'Install & repair' },
      ],
      sections: {
        serviceAreas: { areas: ['Belconnen', 'Gungahlin'] },
        seoTokens: { city: 'Canberra' },
      },
      pages: [{ title: 'Home', slug: 'home', published: true }],
      preview_password: 'should-not-leak',
      google: { refresh_token: 'secret-token', account: 'ads-1' },
    },
  };

  it('exposes V1 slices', () => {
    assert.ok(V1_SLICES.includes('site.identity'));
    assert.ok(V1_SLICES.includes('site.services'));
  });

  it('resolves only requested slices and redacts secrets', () => {
    const resolver = createContextResolver();
    const result = resolver.resolve({
      siteId: 'site-1',
      site: sampleSite,
      actor: { userId: 'user-1', role: 'client' },
      slices: ['site.identity', 'site.services', 'site.brand'],
    });

    assert.deepEqual(result.slices, ['site.identity', 'site.services', 'site.brand']);
    assert.equal(result.context['site.identity'].businessName, 'RTT Plumbing');
    assert.equal(result.context['site.services'].services.length, 2);
    assert.equal(result.context['site.brand'].voiceHints, 'Friendly local experts');
    const blob = JSON.stringify(result.context);
    assert.equal(blob.includes('should-not-leak'), false);
    assert.equal(blob.includes('secret-token'), false);
    assert.equal(blob.includes('preview_password'), false);
  });

  it('denies cross-tenant access', () => {
    const resolver = createContextResolver();
    assert.throws(
      () =>
        resolver.resolve({
          site: sampleSite,
          actor: { userId: 'other-user', role: 'client' },
          slices: ['site.identity'],
        }),
      (err) => err instanceof BrainError && err.code === CODES.forbidden
    );
  });

  it('allows super admin and linked partner', () => {
    const resolver = createContextResolver();
    const asSuper = resolver.resolve({
      site: sampleSite,
      actor: { role: 'super' },
      slices: ['site.identity'],
    });
    assert.equal(asSuper.context['site.identity'].slug, 'rtt');

    const asPartner = resolver.resolve({
      site: sampleSite,
      actor: { partnerId: 'partner-9', role: 'partner' },
      slices: ['partner.identity'],
      partner: { id: 'partner-9', display_name: 'Web Culture', tier: 'pro' },
    });
    assert.equal(asPartner.context['partner.identity'].name, 'Web Culture');
  });

  it('rejects unknown slices', () => {
    const resolver = createContextResolver();
    assert.throws(
      () =>
        resolver.resolve({
          site: sampleSite,
          actor: { role: 'super' },
          slices: ['ads.summary'],
        }),
      (err) => err instanceof BrainError && err.code === CODES.bad_request
    );
  });
});

describe('LeadPages Brain Phase 3 — gateway integration', () => {
  it('uses prompt registry when promptId is set', async () => {
    const brain = createBrain();
    const res = await brain.generate({
      taskId: 'seo.suburb_intro',
      promptId: 'seo.suburb_intro',
      input: {
        businessName: 'RTT Plumbing',
        trade: 'plumber',
        suburb: 'Belconnen',
      },
    });
    assert.equal(res.ok, true);
    assert.equal(res.prompt.promptId, 'seo.suburb_intro');
    assert.equal(res.prompt.version, 1);
    assert.match(res.output.text, /MOCK:/);
  });

  it('injects context slices into prompt variables', async () => {
    const brain = createBrain();
    const res = await brain.generate({
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
          services: [{ title: 'Re-roofing' }, { title: 'Leak repairs' }],
        },
      },
      actor: { userId: 'u1', role: 'client' },
      contextSlices: ['site.identity', 'site.brand', 'site.services'],
      input: { brief: 'Family roofing business' },
      // structured route would need schema; use plain generate override path:
    });

    // content.landing_draft route is structured:true — without schema this fails.
    // Call again via messages-free path with a non-structured task that still uses the prompt.
    assert.equal(res.ok, false);
    assert.equal(res.error.code, CODES.bad_request);

    const textRes = await brain.generate({
      taskId: 'generic.reason',
      promptId: 'content.landing_draft',
      siteId: 'site-1',
      site: {
        id: 'site-1',
        business_name: 'Canberra Roofs',
        owner_user_id: 'u1',
        config: {
          trade: 'roofer',
          brandVoice: 'Straight talk',
          services: [{ title: 'Re-roofing' }, { title: 'Leak repairs' }],
        },
      },
      actor: { userId: 'u1', role: 'client' },
      contextSlices: ['site.identity', 'site.brand', 'site.services'],
      input: { brief: 'Family roofing business' },
    });

    assert.equal(textRes.ok, true);
    assert.equal(textRes.prompt.version, 4);
    assert.ok(textRes.context);
    assert.deepEqual(textRes.context.slices, [
      'site.identity',
      'site.brand',
      'site.services',
    ]);
    assert.match(textRes.output.text, /Family roofing business|Canberra Roofs|MOCK:/);
  });

  it('keeps explicit messages path backwards compatible', async () => {
    const brain = createBrain();
    const res = await brain.generate({
      taskId: 'help.answer',
      messages: [{ role: 'user', content: 'How do I publish?' }],
    });
    assert.equal(res.ok, true);
    assert.match(res.output.text, /publish/);
  });
});
