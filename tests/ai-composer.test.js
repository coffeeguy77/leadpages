'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createBrain, createAnthropicAdapter, createOpenAIAdapter } = require('../lib/brain');
const catalogue = require('../lib/ai-composer/catalogue');
const tiles = require('../lib/ai-composer/tiles');
const { normalizePlan, sanitizeClientPlan, photoCheckItems, applyPhotoCheck } = require('../lib/ai-composer/plan');
const { normalizeFill, buildSiteConfig } = require('../lib/ai-composer/build-config');
const { planMessages, fillMessages, PLAN_SCHEMA, overlappingSections } = require('../lib/ai-composer/prompts');

const DESIGN_URL = 'https://res.cloudinary.com/dzx6x1hou/image/upload/v1790000000/leadpages/ai-composer/202610/design-abc.png';
const DESIGN = { url: DESIGN_URL, width: 1440, height: 3000 };

function okResponse(json) {
  return {
    ok: true,
    status: 200,
    json: async () => json
  };
}

test.describe('Brain vision support', () => {
  test('Anthropic adapter sends image blocks as URL images and leaves strings alone', async () => {
    let sent = null;
    const adapter = createAnthropicAdapter({
      apiKey: 'test',
      fetchImpl: async (_url, init) => {
        sent = JSON.parse(init.body);
        return okResponse({ id: 'm1', content: [{ type: 'text', text: '{"ok":true}' }], usage: { input_tokens: 10, output_tokens: 5 } });
      }
    });
    await adapter.generate({
      model: { provider: 'anthropic', model: 'claude-test' },
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: [{ type: 'text', text: 'look' }, { type: 'image', url: 'https://res.cloudinary.com/x.png' }] }
      ],
      responseSchema: { type: 'object' }
    });
    assert.equal(sent.messages[0].content[0].type, 'text');
    assert.deepEqual(sent.messages[0].content[1], { type: 'image', source: { type: 'url', url: 'https://res.cloudinary.com/x.png' } });

    await adapter.generate({
      model: { provider: 'anthropic', model: 'claude-test' },
      messages: [{ role: 'user', content: 'plain text' }]
    });
    assert.equal(sent.messages[0].content, 'plain text');
  });

  test('Anthropic adapter refuses non-https image URLs', async () => {
    const adapter = createAnthropicAdapter({ apiKey: 'test', fetchImpl: async () => okResponse({}) });
    await assert.rejects(
      adapter.generate({
        model: { provider: 'anthropic', model: 'claude-test' },
        messages: [{ role: 'user', content: [{ type: 'image', url: 'http://insecure/x.png' }] }]
      }),
      /https URL/
    );
  });

  test('OpenAI adapter refuses image input loudly instead of dropping it', async () => {
    const adapter = createOpenAIAdapter({ apiKey: 'test', fetchImpl: async () => okResponse({}) });
    await assert.rejects(
      adapter.generate({
        model: { provider: 'openai', model: 'gpt-test' },
        messages: [{ role: 'user', content: [{ type: 'image', url: 'https://x/y.png' }] }]
      }),
      /does not accept image input/
    );
  });

  test('composer route is Anthropic-only with no fallback and no retries', async () => {
    let calls = 0;
    let body = null;
    const brain = createBrain({
      anthropic: {
        apiKey: 'test',
        fetchImpl: async (_url, init) => {
          calls += 1;
          body = JSON.parse(init.body);
          return { ok: false, status: 500, json: async () => ({ error: { message: 'boom' } }) };
        }
      }
    });
    const decision = brain.getRoutingDecision('composer.design_plan');
    assert.equal(decision.primary.provider, 'anthropic');
    assert.deepEqual(decision.fallback, []);
    assert.equal(decision.maxRetries, 0);

    const res = await brain.generateStructured({
      taskId: 'composer.design_plan',
      messages: planMessages({ tiles: [{ index: 0, y: 0, h: 900 }], tileUrls: ['https://res.cloudinary.com/a.jpg'], width: 1440, height: 900 }),
      responseSchema: PLAN_SCHEMA
    });
    assert.equal(res.ok, false);
    assert.equal(calls, 1, 'a retryable 500 must not be retried on composer routes');
    const userBlocks = body.messages[0].content;
    assert.ok(userBlocks.some((b) => b.type === 'image'), 'image block reached the provider');
  });

  test('existing string-message callers are unchanged through the gateway', async () => {
    let body = null;
    const brain = createBrain({
      config: Object.assign(require('../lib/brain/config').defaultBrainConfig(), {}),
      anthropic: {
        apiKey: 'test',
        fetchImpl: async (_url, init) => {
          body = JSON.parse(init.body);
          return okResponse({ id: 'm', content: [{ type: 'text', text: '{"apps":[]}' }], usage: {} });
        }
      }
    });
    const res = await brain.generateStructured({
      taskId: 'composer.app_fill',
      messages: [{ role: 'user', content: 'hello' }],
      responseSchema: { type: 'object' }
    });
    assert.equal(res.ok, true);
    assert.equal(body.messages[0].content, 'hello');
  });
});

test.describe('AI Composer catalogue', () => {
  test('lists placeable apps, excludes connection/paid apps, keeps footer', () => {
    const keys = catalogue.listAppKeys();
    assert.ok(keys.includes('services'));
    assert.ok(keys.includes('heroSlider'));
    assert.ok(keys.includes('footer'));
    catalogue.EXCLUDED_APPS.forEach((k) => assert.ok(!keys.includes(k), k + ' should be excluded'));
  });

  test('no app has a scalar and a list on the same path, and no duplicate scalars', () => {
    const cat = catalogue.getCatalogue();
    Object.values(cat).forEach((a) => {
      const lists = new Set(a.lists.map((l) => l.path));
      const seen = new Set();
      a.scalars.forEach((s) => {
        assert.ok(!lists.has(s.path), a.key + ' conflict at ' + s.path);
        assert.ok(!seen.has(s.path), a.key + ' duplicate ' + s.path);
        seen.add(s.path);
        assert.ok(!s.path.startsWith('theme.'), 'theme fields handled globally');
      });
    });
  });

  test('uses live config paths (legacy playground paths normalised)', () => {
    const crew = catalogue.getApp('crew');
    assert.ok(crew.lists.some((l) => l.path === 'sections.crew.members'));
    const services = catalogue.getApp('services');
    assert.ok(services.lists.some((l) => l.path === 'services'));
  });
});

test.describe('AI Composer tiles', () => {
  test('tiles cover the whole page with overlap and never exceed the cap', () => {
    [[1440, 900], [1440, 3000], [1440, 12000], [390, 6000]].forEach(([w, h]) => {
      const t = tiles.planTiles(w, h);
      assert.ok(t.length <= tiles.MAX_TILES);
      assert.equal(t[0].y, 0);
      assert.equal(t[t.length - 1].y + t[t.length - 1].h, h);
      for (let i = 1; i < t.length; i++) assert.ok(t[i].y < t[i - 1].y + t[i - 1].h, 'tiles overlap');
    });
  });

  test('only accepts our own Cloudinary uploads under leadpages/', () => {
    assert.doesNotThrow(() => tiles.parseUploadUrl(DESIGN_URL));
    assert.throws(() => tiles.parseUploadUrl('https://res.cloudinary.com/someoneelse/image/upload/v1/leadpages/x.png'));
    assert.throws(() => tiles.parseUploadUrl('https://res.cloudinary.com/dzx6x1hou/image/upload/v1/other/x.png'));
    assert.throws(() => tiles.parseUploadUrl('https://evil.example/x.png'));
  });
});

function rawPlan() {
  return {
    businessName: 'Harbour Coffee',
    tagline: 'Specialty coffee',
    phone: '(02) 6123 4567',
    email: 'hello@harbour.test',
    seoTitle: 'Harbour Coffee',
    seoDescription: 'Coffee',
    theme: { pipe: '#123456', hivis: 'abc', steel: 'not-a-colour', safety: '', lightBg: '#ffffff' },
    sections: [
      { id: 's1', appKey: 'services', label: 'Menu cards', reason: 'cards', startTile: 2, startPct: 10, endTile: 2, endPct: 60 },
      { id: 's2', appKey: 'heroSlider', label: 'Big photo hero', reason: 'photo hero', startTile: 1, startPct: 0, endTile: 1, endPct: 70 },
      { id: 's3', appKey: 'hero', label: 'Second hero', startTile: 2, startPct: 70, endTile: 2, endPct: 90 },
      { id: 's4', appKey: 'services', label: 'More cards', startTile: 3, startPct: 0, endTile: 3, endPct: 30 },
      { id: 's5', appKey: 'madeUpApp', label: 'Spinning globe', startTile: 3, startPct: 30, endTile: 3, endPct: 50 }
    ],
    photos: [
      { id: 'a', sectionId: 's2', tile: 1, x: 0, y: 0, w: 100, h: 60, description: 'barista', role: 'hero' },
      { id: 'b', sectionId: 's1', tile: 2, x: 10, y: 20, w: 20, h: 20, description: 'latte', role: 'card' },
      { id: 'c', sectionId: 's1', tile: 2, x: 10, y: 20, w: 1, h: 1, description: 'icon', role: 'card' },
      { id: 'd', tile: 1, x: 2, y: 2, w: 5, h: 3, description: 'logo', role: 'logo' }
    ],
    gaps: [{ what: 'Cookie banner', suggestion: 'ignore' }]
  };
}

test.describe('AI Composer plan normalisation', () => {
  test('enforces known apps, one of each, one hero first, footer last', () => {
    const plan = normalizePlan(rawPlan(), DESIGN);
    const keys = plan.sections.map((s) => s.appKey);
    assert.deepEqual(keys, ['heroSlider', 'services', 'footer']);
    assert.ok(plan.sections[2].synthetic, 'footer added');
    const gapText = plan.gaps.map((g) => g.what + ' ' + g.suggestion).join(' | ');
    assert.match(gapText, /Second hero/);
    assert.match(gapText, /More cards/);
    assert.match(gapText, /madeUpApp/);
  });

  test('cleans colours and converts photos to crops of the original', () => {
    const plan = normalizePlan(rawPlan(), DESIGN);
    assert.deepEqual(plan.theme, { pipe: '#123456', hivis: '#aabbcc', lightBg: '#ffffff' });
    assert.equal(plan.photos.length, 2, 'tiny icon box dropped, logo kept separately');
    assert.ok(plan.logo && /c_crop/.test(plan.logo.url));
    const hero = plan.photos.find((p) => p.description === 'barista');
    assert.ok(hero.px.y > 0 && hero.px.y < 40, 'box trimmed inward a little');
    assert.ok(hero.px.w < 1440, 'width trimmed too');
    assert.ok(hero.url.startsWith('https://res.cloudinary.com/dzx6x1hou/image/upload/c_crop'));
    assert.equal(hero.sectionId, plan.sections.find((s) => s.appKey === 'heroSlider').id);
  });

  test('sanitizeClientPlan rebuilds image URLs and drops unknown or repeated apps', () => {
    const plan = normalizePlan(rawPlan(), DESIGN);
    const tampered = JSON.parse(JSON.stringify(plan));
    tampered.photos[0].url = 'https://evil.example/steal.png';
    tampered.sections.push({ id: 'x', appKey: 'services', rows: { y0: 0, y1: 10 } });
    tampered.sections.push({ id: 'y', appKey: 'customHtml', rows: { y0: 0, y1: 10 } });
    const clean = sanitizeClientPlan(tampered);
    assert.ok(clean.photos.every((p) => p.url.startsWith('https://res.cloudinary.com/dzx6x1hou/')));
    assert.equal(clean.sections.filter((s) => s.appKey === 'services').length, 1);
    assert.ok(!clean.sections.some((s) => s.appKey === 'customHtml'));
  });
});

test.describe('AI Composer site config', () => {
  function filledPlan() {
    const plan = sanitizeClientPlan(normalizePlan(rawPlan(), DESIGN));
    const hero = plan.sections.find((s) => s.appKey === 'heroSlider');
    const svc = plan.sections.find((s) => s.appKey === 'services');
    const heroPhoto = plan.photos.find((p) => p.sectionId === hero.id).id;
    const svcPhoto = plan.photos.find((p) => p.sectionId === svc.id).id;
    const fills = normalizeFill({
      apps: [
        {
          appKey: 'heroSlider',
          fields: { 'sections.heroSlider.notAField': 'x' },
          lists: { 'sections.heroSlider.slides': [{ imageUrl: heroPhoto, heading: 'Good coffee', subText: 'Daily', bogus: 'no' }] }
        },
        {
          appKey: 'services',
          fields: { 'sections.services.heading': 'Our menu', 'sections.services.eyebrow': 'MENU' },
          lists: { services: [{ title: 'Latte', body: 'Smooth', image: svcPhoto }, { title: '', body: '' }, { title: 'Mocha', image: 'https://evil/x.png' }] }
        }
      ]
    }, [hero, svc], plan);
    return { plan, fills };
  }

  test('normalizeFill maps photo ids, drops unknown paths, empty items and foreign URLs', () => {
    const { fills } = filledPlan();
    const h = fills.find((f) => f.appKey === 'heroSlider');
    assert.ok(!('sections.heroSlider.notAField' in h.scalars));
    const slide = h.lists['sections.heroSlider.slides'][0];
    assert.ok(slide.imageUrl.includes('c_crop'));
    assert.ok(!('bogus' in slide));
    const s = fills.find((f) => f.appKey === 'services');
    assert.equal(s.lists.services.length, 2, 'empty card dropped');
    assert.equal(s.lists.services[1].image, '', 'foreign URL rejected');
  });

  test('buildSiteConfig switches off every unchosen section and avoids trade defaults', () => {
    const { plan, fills } = filledPlan();
    const cfg = buildSiteConfig(plan, fills, { businessName: 'Harbour Coffee', now: '2026-10-10T00:00:00Z' });
    assert.equal(cfg.trade, '');
    assert.equal(cfg.sections.heroSlider.on, true);
    assert.equal(cfg.sections.services.on, true);
    assert.equal(cfg.sections.footer.on, true);
    assert.equal(cfg.sections.hero.on, false, 'photo hero replaces the standard hero');
    ['why', 'reviews', 'quote', 'faq', 'area', 'crew', 'emerg', 'trustBar', 'serviceProcess'].forEach((k) => {
      assert.equal(cfg.sections[k].on, false, k + ' must be off');
    });
    assert.equal(cfg.services[0].title, 'Latte');
    assert.equal(cfg.sections.services.heading, 'Our menu');
    assert.equal(cfg.sections.services.intro, '', 'unfilled copy field blanked, not left to defaults');
    assert.equal(cfg.sections.footer.services, undefined, 'no footer links → no empty links column');
    assert.equal(cfg.phone, '0261234567');
    assert.equal(cfg.phoneText, '(02) 6123 4567');
    assert.equal(cfg.logo.mode, 'image');
    assert.equal(cfg.theme.pipe, '#123456');
    assert.deepEqual(cfg.sectionOrder.slice(0, 2), ['heroSlider', 'services']);
    assert.equal(cfg.sectionOrder[cfg.sectionOrder.length - 1], 'footer');
    assert.equal(cfg._aiComposer.designUrl, DESIGN_URL);
  });

  test('buildSiteConfig ignores image URLs that are not crops of this design', () => {
    const { plan, fills } = filledPlan();
    const svc = fills.find((f) => f.appKey === 'services');
    svc.lists.services[0].image = 'https://res.cloudinary.com/dzx6x1hou/image/upload/v1/leadpages/someone-else.png';
    const cfg = buildSiteConfig(plan, fills, { businessName: 'Harbour Coffee' });
    assert.equal(cfg.services[0].image, '');
  });

  test('apps the design gave no content to are switched off and reported', () => {
    const plan = sanitizeClientPlan({
      design: DESIGN,
      businessName: 'Blank Co',
      sections: [
        { id: 's1', appKey: 'hero', rows: { y0: 0, y1: 500 } },
        { id: 's2', appKey: 'crew', label: 'Team photos', rows: { y0: 500, y1: 900 } },
        { id: 's3', appKey: 'trustBar', rows: { y0: 900, y1: 1000 } },
        { id: 's4', appKey: 'quote', rows: { y0: 1000, y1: 1500 } },
        { id: 's5', appKey: 'footer', rows: { y0: 2800, y1: 3000 } }
      ],
      photos: []
    });
    const fills = [
      { sectionId: 's1', appKey: 'hero', scalars: { 'sections.hero.title': 'Hello' }, lists: {} },
      // crew: heading only, no members → would show sample team members
      { sectionId: 's2', appKey: 'crew', scalars: { 'sections.crew.heading': 'Our people' }, lists: {} },
      { sectionId: 's4', appKey: 'quote', scalars: { 'sections.quote.heading': 'Ask us' }, lists: {} }
    ];
    const cfg = buildSiteConfig(plan, fills, { businessName: 'Blank Co' });
    assert.equal(cfg.sections.crew.on, false);
    assert.equal(cfg.sections.trustBar.on, false);
    assert.equal(cfg.sections.quote.on, true, 'quote works without list items');
    assert.ok(!cfg.sectionOrder.includes('crew'));
    assert.ok(cfg._aiComposer.gaps.some((g) => /Team photos/.test(g.what)));
    // neutral wording instead of trade / platform defaults
    assert.equal(cfg.sections.quote.suburbPh, 'Your suburb');
    assert.equal(cfg.sections.quote.fineText, '');
    assert.equal(cfg.sections.footer.taglineLead, '');
    assert.equal(cfg.sections.footer.supportTitle, 'Get in touch');
  });

  test('list-of-text fields (area suburbs) are stored as arrays', () => {
    const plan = sanitizeClientPlan({
      design: DESIGN,
      businessName: 'Area Co',
      sections: [{ id: 's1', appKey: 'area', rows: { y0: 0, y1: 500 } }],
      photos: []
    });
    const [fill] = normalizeFill({ apps: [{ appKey: 'area', fields: { 'sections.area.heading': 'Where we work', 'sections.area.suburbs': 'Braddon, Kingston\nDickson' }, lists: {} }] }, plan.sections, plan);
    assert.deepEqual(fill.scalars['sections.area.suburbs'], ['Braddon', 'Kingston', 'Dickson']);
    const cfg = buildSiteConfig(plan, [fill], { businessName: 'Area Co' });
    assert.deepEqual(cfg.sections.area.suburbs, ['Braddon', 'Kingston', 'Dickson']);
    assert.equal(cfg.sections.area.ctaTitle, '', 'call-out card title blanked, not trade default');
  });

  test('fill prompt lists exact field paths and photo ids', () => {
    const { plan } = filledPlan();
    const svc = plan.sections.find((s) => s.appKey === 'services');
    const msgs = fillMessages({
      businessName: 'Harbour Coffee',
      items: [{ sectionId: svc.id, appKey: 'services', label: svc.label, sheet: catalogue.appFieldSheet('services'), photos: [{ id: 'p2', description: 'latte' }], imageUrls: ['https://res.cloudinary.com/a.jpg'] }]
    });
    const text = msgs[1].content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    assert.match(text, /sections\.services\.heading/);
    assert.match(text, /p2 = latte/);
    assert.ok(msgs[1].content.some((b) => b.type === 'image'));
  });
});

test.describe('AI Composer fixes (round 2)', () => {
  function onePlan(sections, photos) {
    return sanitizeClientPlan({ design: DESIGN, businessName: 'Fix Co', sections, photos: photos || [] });
  }

  test('quote form field labels and job options are locked from the AI', () => {
    const sheet = catalogue.appFieldSheet('quote');
    const paths = sheet.fields.map((f) => f.path);
    ['lblName', 'lblPhone', 'lblJob', 'lblSuburb', 'lblDetail', 'suburbPh', 'detailPh'].forEach((k) => {
      assert.ok(!paths.includes('sections.quote.' + k), k + ' must not be writable');
    });
    assert.ok(!sheet.lists.some((l) => l.path === 'sections.quote.jobOptions'));
    const plan = onePlan([{ id: 's1', appKey: 'quote', rows: { y0: 0, y1: 500 } }]);
    const fills = [{ sectionId: 's1', appKey: 'quote', scalars: { 'sections.quote.lblName': 'Pick up date', 'sections.quote.formTitle': 'Check Truck Availability' }, lists: { 'sections.quote.jobOptions': [{ text: '1 Day' }] } }];
    const cfg = buildSiteConfig(plan, fills, { businessName: 'Fix Co' });
    assert.equal(cfg.sections.quote.lblName, undefined, 'label from design ignored');
    assert.deepEqual(cfg.sections.quote.jobOptions.map((o) => o.text), ['General enquiry', 'Quote request', 'Booking', 'Something else']);
    assert.equal(cfg.sections.quote.heading, 'Check Truck Availability', 'card title reused as heading');
  });

  test('layout choices only accept listed option values; text box with photo uses wrap', () => {
    const plan = onePlan([{ id: 's1', appKey: 'textBox', rows: { y0: 0, y1: 800 } }], [{ id: 'p1', sectionId: 's1', px: { x: 0, y: 0, w: 400, h: 300 } }]);
    const [fill] = normalizeFill({ apps: [{ appKey: 'textBox', fields: {
      'sections.textBox.heading': 'Hello', 'sections.textBox.image': 'p1',
      'sections.textBox.imageSide': 'left', 'sections.textBox.textAlign': 'diagonal' }, lists: {} }] }, plan.sections, plan);
    assert.equal(fill.scalars['sections.textBox.imageSide'], 'left');
    assert.ok(!('sections.textBox.textAlign' in fill.scalars), 'invalid option dropped');
    const cfg = buildSiteConfig(plan, [fill], { businessName: 'Fix Co' });
    assert.equal(cfg.sections.textBox.imageLayout, 'wrap');
  });

  test('text colours are not exposed; dark backgrounds and unreadable buttons are dropped', () => {
    const svc = catalogue.appFieldSheet('services');
    assert.ok(!svc.fields.some((f) => /titleColor|introColor|eyebrowColor/.test(f.path)));
    const plan = onePlan([
      { id: 's1', appKey: 'aboutUs', rows: { y0: 0, y1: 500 } },
      { id: 's2', appKey: 'quote', rows: { y0: 500, y1: 900 } }]);
    const fills = [
      { sectionId: 's1', appKey: 'aboutUs', scalars: { 'sections.aboutUs.heading': 'Hi', 'sections.aboutUs.bg': '#101010' }, lists: {} },
      { sectionId: 's2', appKey: 'quote', scalars: { 'sections.quote.heading': 'Ask', 'sections.quote.btnBg': '#fafafa' }, lists: {} }];
    const cfg = buildSiteConfig(plan, fills, { businessName: 'Fix Co' });
    assert.ok(!cfg.sections.aboutUs.bg, 'dark background dropped');
    assert.ok(!cfg.sections.quote.btnBg, 'white button with white text dropped');
  });

  test('photo check tightens boxes inside the context crop and drops rejected photos', () => {
    const plan = onePlan([{ id: 's1', appKey: 'services', rows: { y0: 0, y1: 1000 } }], [
      { id: 'p1', sectionId: 's1', px: { x: 100, y: 100, w: 400, h: 300 } },
      { id: 'p2', sectionId: 's1', px: { x: 600, y: 100, w: 200, h: 200 } }]);
    const items = photoCheckItems(plan, ['p1', 'p2']);
    assert.ok(items[0].ctx.w > 400, 'context crop has a margin');
    const r = applyPhotoCheck(plan, items, { photos: [{ id: 'p1', keep: true, x: 10, y: 10, w: 50, h: 50 }, { id: 'p2', keep: false }] });
    assert.deepEqual(r.removed, ['p2']);
    const p1 = r.photos.find((p) => p.id === 'p1');
    assert.ok(p1.px.x > items[0].ctx.x && p1.px.w < items[0].ctx.w);
    assert.ok(p1.url.includes('c_crop,x_' + p1.px.x));
  });

  test('fill prompt names overlapping sections handled by other apps', () => {
    const plan = onePlan([
      { id: 's1', appKey: 'quote', label: 'Form', rows: { y0: 0, y1: 500 } },
      { id: 's2', appKey: 'projectStats', label: 'Prices', rows: { y0: 0, y1: 500 } },
      { id: 's3', appKey: 'faq', label: 'FAQ', rows: { y0: 900, y1: 1200 } }]);
    assert.deepEqual(overlappingSections(plan, plan.sections[0]), ['Prices (projectStats app)']);
    assert.deepEqual(overlappingSections(plan, plan.sections[2]), []);
  });

  test('excluded and dead fields: finance and serviceAreaMap not offered; specialOffer uses cta', () => {
    const keys = catalogue.listAppKeys();
    assert.ok(!keys.includes('finance') && !keys.includes('serviceAreaMap'));
    const so = catalogue.appFieldSheet('specialOffer').fields.map((f) => f.path);
    assert.ok(so.includes('sections.specialOffer.cta') && !so.includes('sections.specialOffer.ctaText'));
  });

  test('FAQ drafting adds the overview images and the drafting rule only when asked', () => {
    const base = { businessName: 'X', items: [], overviewUrls: ['https://res.cloudinary.com/t.jpg'] };
    const off = fillMessages(base);
    const on = fillMessages(Object.assign({}, base, { draftFaq: true }));
    assert.ok(!/FAQ ANSWERS/.test(off[0].content) && !off[1].content.some((b) => b.type === 'image'));
    assert.ok(/FAQ ANSWERS/.test(on[0].content) && on[1].content.some((b) => b.type === 'image'));
  });
});
