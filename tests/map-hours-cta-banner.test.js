'use strict';

/**
 * Map & Hours (sections.mapHours) and CTA Banner (sections.ctaBanner) apps:
 * template placeholders, visibility, Position default, editor wiring and marketplace entries.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const so = require('../lib/section-order');
const KEYS = ['mapHours', 'ctaBanner'];

test('trade template has hidden placeholders and loads the current layouts script', () => {
  const html = JSON.parse(read('trade.template.json')).html;
  for (const k of KEYS) {
    assert.match(html, new RegExp('<section data-sec="' + k + '" class="section" id="' + k + '" style="display:none"></section>'));
  }
  assert.match(html, /\/assets\/lp-layouts\.js\?v=7/);
  assert.match(html, /\/assets\/lp-layouts\.css\?v=7/);
});

test('both apps are off by default and only shown when switched on', () => {
  const ds = read('marketplace/demos/demo-shared.js');
  const optv = ds.match(/var __OPTV=\[([^\]]+)\]/)[1];
  for (const k of KEYS) {
    assert.ok(optv.indexOf("'" + k + "'") >= 0, k + ' in visibility list');
    assert.ok(so.OFF_BY_DEFAULT.includes(k));
    assert.ok(so.OPTIONAL_SECTIONS.includes(k));
  }
  assert.ok(!so.resolveSectionOrder({ sections: { mapHours: {}, ctaBanner: { on: false } } }).some((k) => KEYS.includes(k)));
});

test('a newly switched-on app sits just above the footer, never after it', () => {
  const fresh = so.resolveSectionOrder({ sections: { mapHours: { on: true }, ctaBanner: { on: true } } });
  assert.deepEqual(fresh.slice(-3), ['mapHours', 'ctaBanner', 'footer']);
  const saved = so.resolveSectionOrder({
    sectionOrder: ['hero', 'services', 'reviews', 'quote', 'faq', 'footer'],
    sections: { mapHours: { on: true } }
  });
  assert.equal(saved.indexOf('mapHours'), saved.indexOf('footer') - 1);
  const healed = so.resolveSectionOrder({ sectionOrder: ['hero', 'services', 'footer', 'ctaBanner'], sections: { ctaBanner: { on: true } } });
  assert.ok(healed.indexOf('ctaBanner') < healed.indexOf('footer'));
  // A position chosen in Position is kept.
  const moved = so.resolveSectionOrder({ sectionOrder: ['hero', 'mapHours', 'services', 'footer'], sections: { mapHours: { on: true } } });
  assert.ok(moved.indexOf('mapHours') < moved.indexOf('services'));
});

test('page editor: chips, on/off defaults, Position rule, editors and auto-select hooks', () => {
  const m = read('manage.html');
  assert.match(m, /\['mapHours','Map & Hours'\],\['ctaBanner','CTA Banner'\]/);
  assert.match(m, /'specialOffer','ctaBanner','responseCards'\]/);
  assert.match(m, /\['crew','area','why','mapHours','navMenu','footer','lpFooter'\]/);
  assert.match(m, /OFF_BY_DEFAULT_SECTIONS=\[[^\]]*'mapHours','ctaBanner'\]/);
  assert.match(m, /OPTIONAL_COMPONENTS=\[[^\]]*'mapHours','ctaBanner'\]/);
  assert.match(m, /LP_BEFORE_FOOTER_APPS=\['mapHours','ctaBanner'\]/);
  assert.match(m, /sub==='mapHours'\)\{/);
  assert.match(m, /sub==='ctaBanner'\)\{/);
  assert.match(m, /mapHoursRows:\{secId:'mapHours',key:'rows'/);
  assert.match(m, /\{t:'addr',k:'address'/);
  assert.match(m, /function lplWireAddressLookup/);
  assert.match(m, /btn1Action',label:'Main button does',def:'quote'/);
});

test('rendered markup carries the auto-select field hooks', () => {
  const js = read('assets/lp-layouts.js');
  for (const hook of ['data-lpe="heading"', 'data-lpe="address"', 'list:mapHoursRows:', 'data-lpe="ctaLabel"', 'lp-as-shield', "data-lpe=\"btn' + n + 'Label\""]) {
    assert.ok(js.indexOf(hook) >= 0, hook);
  }
  assert.match(js, /mapHours, ctaBanner,/);
});

test('marketplace: sell template, demo page, demo content, demo editor fields, hub tile, category', () => {
  const sell = JSON.parse(read('marketplace/sell-templates.json'));
  const content = JSON.parse(read('marketplace/app-content.json'));
  const defs = JSON.parse(read('marketplace/playground-field-defs.json'));
  const defaults = JSON.parse(read('marketplace/playground-default-configs.json'));
  const hub = read('marketplace.html');
  const cats = require('../lib/marketplace-categories');
  for (const [k, slug] of [['mapHours', 'map-hours'], ['ctaBanner', 'cta-banner']]) {
    assert.ok(sell[k] && sell[k].blocks.some((b) => b.block_type === 'playground' && b.payload.section_key === k), k + ' sell template');
    assert.ok(content[k] && content[k].features.length >= 3, k + ' app content');
    assert.ok(defaults[k] && defaults[k][k] && defaults[k][k].on === true, k + ' demo content');
    assert.ok(Array.isArray(defs[k]) && defs[k].length >= 8, k + ' demo editor fields');
    const demo = read('marketplace/demos/demo-' + k + '.html');
    assert.match(demo, new RegExp('data-sec="' + k + '"'));
    assert.match(demo, /\/assets\/lp-layouts\.js/);
    assert.match(demo, /demo-shared\.js/);
    assert.match(hub, new RegExp('href="/marketplace/' + slug + '" data-app="' + slug + '"'));
    assert.notEqual(cats.SECTION_CATEGORY[k], undefined);
  }
  assert.ok(defaults.mapHours.mapHours.rows.length >= 3);
});

test('the AI composer leaves both apps alone for now', () => {
  const { EXCLUDED_APPS } = require('../lib/ai-composer/catalogue');
  for (const k of KEYS) assert.ok(EXCLUDED_APPS.includes(k));
});
