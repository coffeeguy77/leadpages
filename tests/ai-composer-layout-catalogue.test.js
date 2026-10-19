'use strict';

/**
 * AI Composer — layout choice (lib/ai-composer/layouts.js).
 * The design plan picks each app's layout, tone and photo side; build-config writes
 * them. The drift test keeps the composer's layout list in step with the editor.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const layouts = require('../lib/ai-composer/layouts');
const catalogue = require('../lib/ai-composer/catalogue');
const { normalizePlan, sanitizeClientPlan } = require('../lib/ai-composer/plan');
const { normalizeFill, buildSiteConfig } = require('../lib/ai-composer/build-config');
const { planSystemPrompt, planMessages, PLAN_SCHEMA } = require('../lib/ai-composer/prompts');

const ROOT = path.join(__dirname, '..');
const DESIGN_URL = 'https://res.cloudinary.com/dzx6x1hou/image/upload/v1790000000/leadpages/ai-composer/202610/design-abc.png';
const DESIGN = { url: DESIGN_URL, width: 1440, height: 3000 };

/** Layout values the editor offers, per app. */
function editorLayoutValues() {
  const html = fs.readFileSync(path.join(ROOT, 'manage.html'), 'utf8');
  const out = {};
  const add = (app, v) => { (out[app] = out[app] || new Set()).add(String(v)); };
  // Plain <select> pickers.
  [['svc-mode', 'services'], ['tb-mode', 'trustBar'], ['pg-layout', 'premiumGallery']].forEach(([id, app]) => {
    const m = html.match(new RegExp('<select id="' + id + '"[^>]*>([\\s\\S]*?)</select>'));
    assert.ok(m, 'editor still has #' + id);
    const opts = m[1].match(/value="([^"]*)"/g) || [];
    opts.forEach((o) => add(app, o.slice(7, -1)));
  });
  // Services picker is built in JS too (value="x"'+…).
  const svcJs = html.match(/value="(grid|split|cards|tick|iconrow|story|feature|numbered|photo)"'\+\(mode===/g) || [];
  svcJs.forEach((o) => add('services', o.match(/value="([^"]+)"/)[1]));
  // LPL_LAYOUT_SPECS: layout / mode / style selects.
  const at = html.indexOf('var LPL_LAYOUT_SPECS={');
  assert.ok(at > 0, 'editor still has LPL_LAYOUT_SPECS');
  let i = html.indexOf('{', at), depth = 0, end = -1;
  for (; i < html.length; i++) {
    const c = html[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) { end = i; break; } }
  }
  const sandbox = new Proxy({}, { has: () => true, get: (_t, k) => (k === Symbol.unscopables ? undefined : (k in globalThis ? globalThis[k] : [])) });
  const specs = vm.runInNewContext('(' + html.slice(html.indexOf('{', at), end + 1) + ')', sandbox);
  Object.keys(specs).forEach((app) => {
    (Array.isArray(specs[app]) ? specs[app] : [specs[app]]).forEach((g) => {
      (g.rows || []).forEach((r) => {
        if (r && r.t === 'sel' && ['layout', 'mode', 'style'].indexOf(r.k) >= 0 && Array.isArray(r.opts)) {
          r.opts.forEach((o) => add(app, o[0]));
        }
      });
    });
  });
  return out;
}

test.describe('AI Composer — layout catalogue', () => {
  test('every layout the editor offers is known to the composer (or deliberately not offered)', () => {
    const editor = editorLayoutValues();
    const missing = [];
    Object.keys(editor).forEach((app) => {
      const L = layouts.getLayouts(app);
      const known = new Set((L ? L.variants.map((v) => v.value) : []).concat(layouts.NOT_OFFERED[app] || []));
      editor[app].forEach((v) => { if (!known.has(v)) missing.push(app + ' = "' + v + '"'); });
    });
    assert.deepEqual(missing, [], 'Add these to lib/ai-composer/layouts.js (LAYOUTS or NOT_OFFERED): ' + missing.join(', '));
  });

  test('every layout value and layout field is read by the site code', () => {
    const code = fs.readFileSync(path.join(ROOT, 'assets', 'lp-layouts.js'), 'utf8') +
      fs.readFileSync(path.join(ROOT, 'trade.template.json'), 'utf8');
    Object.keys(layouts.LAYOUTS).forEach((app) => {
      const L = layouts.LAYOUTS[app];
      L.variants.forEach((v) => {
        if (v.value) assert.ok(code.includes("'" + v.value + "'") || code.includes('\\"' + v.value + '\\"') || code.includes(v.value), app + ' layout value ' + v.value);
        (v.fields || []).concat(v.lists || []).forEach((f) => {
          const name = f.key.split('.').filter((p) => !/^\d+$/.test(p)).slice(-1)[0];
          assert.ok(code.includes(name), app + '/' + v.id + ' field ' + f.key + ' is not read by lp-layouts.js or the template');
        });
        if (v.tone) assert.ok(code.includes(v.tone.path.split('.').pop()), app + ' tone field');
      });
    });
  });

  test('every app with layouts is in the composer catalogue, and lists its layouts', () => {
    Object.keys(layouts.LAYOUTS).forEach((app) => {
      const a = catalogue.getApp(app);
      assert.ok(a, app + ' is placeable');
      assert.deepEqual(a.layouts.map((l) => l.id), layouts.LAYOUTS[app].variants.map((v) => v.id));
    });
  });

  test('the plan prompt shows layouts and asks for look, layout, tone and photo side', () => {
    const sys = planSystemPrompt();
    assert.match(sys, /describe how the section LOOKS/);
    assert.match(sys, /heroSlider layout "split"/);
    const msgs = planMessages({ tiles: [{ index: 0, y: 0, h: 1000 }], tileUrls: ['https://res.cloudinary.com/x.png'], width: 1440, height: 1000 });
    const cat = msgs[1].content.find((b) => b.type === 'text' && /APP CATALOGUE/.test(b.text)).text;
    assert.match(cat, /· split — looks: headline, text and buttons on one side/);
    assert.match(cat, /· numbered — looks: cards with a big number/);
    ['look', 'layout', 'tone', 'photoSide'].forEach((k) => assert.ok(PLAN_SCHEMA.properties.sections.items.properties[k], k));
  });

  test('every app in the catalogue gives a field sheet (with or without layouts)', () => {
    catalogue.listAppKeys().forEach((k) => {
      const sheet = catalogue.appFieldSheet(k, '');
      assert.ok(sheet && Array.isArray(sheet.fields), k);
      assert.ok(Array.isArray(catalogue.getApp(k).layouts), k + ' has a layouts array');
    });
  });

  test('field sheets only offer the fields of the chosen layout', () => {
    const feature = catalogue.appFieldSheet('services', 'feature');
    assert.equal(feature.layout, 'feature');
    assert.ok(feature.fields.some((f) => f.path === 'sections.services.featureImage'));
    assert.ok(feature.lists.some((l) => l.path === 'sections.services.featureItems'));
    const grid = catalogue.appFieldSheet('services', 'grid');
    assert.ok(!grid.fields.some((f) => f.path === 'sections.services.featureImage'));
    assert.ok(!grid.lists.some((l) => l.path === 'sections.services.featureItems'));
    assert.equal(catalogue.appFieldSheet('services', 'nonsense').layout, 'grid', 'unknown layout → default');
    const split = catalogue.appFieldSheet('heroSlider', 'split');
    assert.ok(split.fields.some((f) => f.path === 'sections.heroSlider.splitH1'));
    assert.ok(!catalogue.appFieldSheet('heroSlider').fields.some((f) => f.path === 'sections.heroSlider.splitH1'));
  });
});

test.describe('AI Composer — layout choice in the plan and the site', () => {
  test('normalizePlan keeps valid layouts, tones and sides; unknown ones fall back safely', () => {
    const plan = normalizePlan({
      businessName: 'Joinery Co', theme: {}, photos: [], gaps: [],
      sections: [
        { id: 's1', appKey: 'heroSlider', layout: 'split', tone: 'soft', photoSide: 'left', look: 'Text left, photo right', startTile: 1, startPct: 0, endTile: 1, endPct: 30 },
        { id: 's2', appKey: 'services', layout: 'zigzag', tone: 'dark', photoSide: 'left', startTile: 1, startPct: 30, endTile: 1, endPct: 60 },
        { id: 's3', appKey: 'textBox', layout: 'bleed', tone: 'brand', photoSide: 'up', startTile: 1, startPct: 60, endTile: 1, endPct: 80 },
        { id: 's4', appKey: 'quote', layout: 'split', tone: 'dark', startTile: 1, startPct: 80, endTile: 1, endPct: 95 }
      ]
    }, DESIGN);
    const [hero, svc, tb, q] = plan.sections;
    assert.deepEqual([hero.layout, hero.tone, hero.photoSide, hero.look], ['split', 'soft', 'left', 'Text left, photo right']);
    assert.deepEqual([svc.layout, svc.tone, svc.photoSide], ['grid', '', ''], 'unknown layout → default, no tone/side');
    assert.deepEqual([tb.layout, tb.tone, tb.photoSide], ['bleed', '', ''], 'brand is not a bleed tone; "up" is not a side');
    assert.deepEqual([q.layout, q.tone, q.photoSide], ['', '', ''], 'apps without layouts carry none');
    // The browser round-trip re-checks the same way.
    const again = sanitizeClientPlan(Object.assign({}, plan, { sections: plan.sections.map((s) => Object.assign({}, s, s.appKey === 'heroSlider' ? { layout: 'booking', tone: 'soft' } : {})) }));
    assert.deepEqual([again.sections[0].layout, again.sections[0].tone], ['booking', ''], 'booking has no tones');
  });

  test('buildSiteConfig writes the chosen layouts, tones and photo sides', () => {
    const plan = sanitizeClientPlan({
      design: DESIGN, businessName: 'Joinery Co',
      photos: [{ id: 'p1', sectionId: 's1', px: { x: 700, y: 0, w: 700, h: 600 } }, { id: 'p2', sectionId: 's3', px: { x: 0, y: 1300, w: 700, h: 500 } }],
      sections: [
        { id: 's1', appKey: 'heroSlider', layout: 'split', tone: 'soft', photoSide: 'right', rows: { y0: 0, y1: 700 } },
        { id: 's2', appKey: 'services', layout: 'numbered', rows: { y0: 700, y1: 1300 } },
        { id: 's3', appKey: 'textBox', layout: 'bleed', tone: 'dark', photoSide: 'left', background: '#f4f4f2', rows: { y0: 1300, y1: 1900 } },
        { id: 's4', appKey: 'faq', layout: 'split', rows: { y0: 1900, y1: 2400 } }
      ]
    });
    const fills = normalizeFill({ apps: [
      { appKey: 'heroSlider', fields: { 'sections.heroSlider.splitH1': 'Kitchens Canberra' }, lists: { 'sections.heroSlider.slides': [{ heading: 'Designed around you', imageUrl: 'p1' }] } },
      { appKey: 'services', fields: { 'sections.services.heading': 'What we make', 'sections.services.numLinkLabel': 'Let’s talk' }, lists: { services: [{ title: 'Kitchens', body: 'Made to measure.' }, { title: 'Joinery', body: 'Built in.' }] } },
      { appKey: 'textBox', fields: { 'sections.textBox.heading': 'Meet Beat', 'sections.textBox.image': 'p2', 'sections.textBox.imageSide': 'right' }, lists: {} },
      { appKey: 'faq', fields: { 'sections.faq.heading': 'Questions' }, lists: { 'sections.faq.items': [{ q: 'How long?', a: 'About six weeks.' }] } }
    ] }, plan.sections, plan);
    const cfg = buildSiteConfig(plan, fills, { businessName: 'Joinery Co' });
    const S = cfg.sections;
    assert.equal(S.heroSlider.layout, 'split');
    assert.equal(S.heroSlider.splitTone, 'soft');
    assert.equal(S.heroSlider.splitSide, '', 'photo on the right is the split default');
    assert.equal(S.heroSlider.splitH1, 'Kitchens Canberra');
    assert.equal(S.services.mode, 'numbered');
    assert.equal(S.services.numLinkLabel, 'Let’s talk');
    assert.equal(S.textBox.layout, 'bleed');
    assert.equal(S.textBox.bleedTone, 'dark');
    assert.equal(S.textBox.imageSide, 'left', 'the plan’s photo side wins over the fill');
    assert.ok(!S.textBox.bg, 'a toned band does not also get the design background colour');
    assert.equal(S.faq.layout, 'split');
    assert.deepEqual(cfg._aiComposer.sections.map((s) => s.layout || ''), ['split', 'numbered', 'bleed', 'split']);
    assert.equal(cfg._aiComposer.version, 2);
  });

  test('a dark Trust Bar band keeps its colour and gets white text; other dark backgrounds are still dropped', () => {
    const plan = sanitizeClientPlan({
      design: DESIGN, businessName: 'Co',
      sections: [
        { id: 's1', appKey: 'trustBar', background: '#7a7a7a', rows: { y0: 0, y1: 100 } },
        { id: 's2', appKey: 'faq', background: '#111111', rows: { y0: 100, y1: 600 } }
      ]
    });
    const fills = normalizeFill({ apps: [
      { appKey: 'trustBar', fields: {}, lists: { 'sections.trustBar.badges': [{ label: 'Swiss heritage', icon: 'plus' }, { label: 'Canberra made', icon: 'map-pin' }] } },
      { appKey: 'faq', fields: {}, lists: { 'sections.faq.items': [{ q: 'Q?', a: 'A.' }] } }
    ] }, plan.sections, plan);
    const cfg = buildSiteConfig(plan, fills, {});
    assert.equal(cfg.sections.trustBar.bg, '#7a7a7a');
    assert.equal(cfg.sections.trustBar.fg, '#ffffff');
    assert.equal(cfg.sections.trustBar.badges[0].icon, 'plus', 'stroke icon names are kept');
    assert.ok(!cfg.sections.faq.bg, 'apps without a text colour still drop dark backgrounds');
  });

  test('a text block beside one photo is steered to textBox, not aboutUs', () => {
    assert.match(planSystemPrompt(), /a block of text beside ONE photo[^']*textBox \(layout "bleed"/);
  });

  test('a section with no layout gets its app default; footer is untouched', () => {
    const plan = sanitizeClientPlan({
      design: DESIGN, businessName: 'Co',
      sections: [{ id: 's1', appKey: 'faq', rows: { y0: 0, y1: 500 } }, { id: 's2', appKey: 'footer', rows: { y0: 2800, y1: 3000 } }]
    });
    const fills = normalizeFill({ apps: [{ appKey: 'faq', fields: {}, lists: { 'sections.faq.items': [{ q: 'Q?', a: 'A.' }] } }] }, plan.sections, plan);
    const cfg = buildSiteConfig(plan, fills, {});
    assert.equal(cfg.sections.faq.layout, '');
    assert.ok(!('layout' in cfg.sections.footer));
  });
});
