'use strict';

const assert = require('assert');
const {
  defaultSearchCanvasConfig,
  normalizeSearchCanvas,
  applyAiDraftToSearchCanvas,
  ensureSearchCanvasInOrder,
  deriveAccentTokens,
  convertSeoTextToSearchCanvas,
  renderSearchCanvasHtml
} = require('../lib/search-canvas');
const {
  normalizeSearchCanvasDraft,
  mockSearchCanvasDraft,
  SEARCH_CANVAS_DRAFT_SCHEMA
} = require('../lib/brain/search-canvas-compose');
const { adaptApp, hasAdapter } = require('../lib/website-composer/adapters/registry');
const { categoryForSection } = require('../lib/marketplace-categories');

function test(name, fn) {
  try {
    fn();
    console.log('ok -', name);
  } catch (e) {
    console.error('fail -', name);
    throw e;
  }
}

test('default config is neutral professional (not landscaping-specific)', () => {
  const d = defaultSearchCanvasConfig();
  assert.strictEqual(d.on, false);
  assert.ok(d.tabs.length >= 4);
  const blob = JSON.stringify(d).toLowerCase();
  assert.ok(!blob.includes('yass'));
  assert.ok(!blob.includes('landscap'));
});

test('normalize clamps tabs and theme-default colours stay null', () => {
  const n = normalizeSearchCanvas({
    on: true,
    header: { eyebrow: 'A', heading: 'B', intro: 'C', colours: { eyebrow: '', heading: null } },
    tabs: new Array(12).fill(0).map((_, i) => ({ label: 'T' + i, heading: 'H' + i, intro: 'Intro ' + i })),
    style: { masterColour: '1f7bb8' }
  });
  assert.strictEqual(n.tabs.length, 8);
  assert.strictEqual(n.header.colours.eyebrow, null);
  assert.strictEqual(n.style.masterColour, '#1f7bb8');
});

test('deriveAccentTokens produces soft/hover/contrast', () => {
  const t = deriveAccentTokens('#1f7bb8');
  assert.ok(t.accent);
  assert.ok(t.accentSoft);
  assert.ok(t.accentContrast);
});

test('ensureSearchCanvasInOrder prefers after serviceProcess', () => {
  const ord = ensureSearchCanvasInOrder(['emerg', 'hero', 'services', 'serviceProcess', 'faq']);
  assert.strictEqual(ord[ord.indexOf('serviceProcess') + 1], 'searchCanvas');
  const again = ensureSearchCanvasInOrder(ord);
  assert.strictEqual(again.filter((x) => x === 'searchCanvas').length, 1);
});

test('applyAiDraft preserve keeps manual heading and images', () => {
  const base = defaultSearchCanvasConfig();
  base.on = true;
  base.header.heading = 'Manual heading kept';
  base.tabs[0].image.url = 'https://example.com/manual.jpg';
  base.tabs[0].intro = 'Manual intro that should stay';
  const draft = mockSearchCanvasDraft({
    primaryKeyword: 'Canberra Accountant',
    location: 'Canberra',
    businessName: 'Demo Co',
    services: ['Tax', 'BAS', 'Payroll', 'Advice']
  });
  const out = applyAiDraftToSearchCanvas(base, draft, { mode: 'preserve' });
  assert.strictEqual(out.header.heading, 'Manual heading kept');
  assert.strictEqual(out.tabs[0].intro, 'Manual intro that should stay');
  assert.strictEqual(out.tabs[0].image.url, 'https://example.com/manual.jpg');
});

test('mock draft validates through normalize + schema shape', () => {
  const draft = mockSearchCanvasDraft({
    primaryKeyword: 'Local Plumber',
    location: 'Belconnen',
    services: ['Blocked drains', 'Hot water', 'Leaks', 'Gas'],
    includeFaq: true
  });
  assert.ok(draft.tabs.length >= 3 && draft.tabs.length <= 6);
  draft.tabs.forEach((t) => {
    assert.ok(t.label);
    assert.ok(t.intro);
    assert.ok(t.bullets.length >= 3);
    assert.ok(t.iconSuggestion);
    assert.ok(t.imageSearchQuery);
  });
  assert.ok(SEARCH_CANVAS_DRAFT_SCHEMA.required.includes('tabs'));
  const n = normalizeSearchCanvasDraft(draft);
  assert.strictEqual(typeof n.heading, 'string');
});

test('render includes all tab text and ARIA roles', () => {
  const cfg = defaultSearchCanvasConfig();
  cfg.on = true;
  const html = renderSearchCanvasHtml(cfg, { force: true, icons: { check: '<path/>', calendar: '<path/>' } });
  assert.ok(html.includes('role="tablist"'));
  assert.ok(html.includes('role="tab"'));
  assert.ok(html.includes('role="tabpanel"'));
  cfg.tabs.forEach((t) => {
    assert.ok(html.includes(t.heading) || html.includes(t.label));
    assert.ok(html.includes(t.intro));
  });
  assert.ok(html.includes('sc-mobile'));
});

test('convert SEO Text headings into tabs and keeps recovery', () => {
  const conv = convertSeoTextToSearchCanvas({
    eyebrow: 'On this page',
    h1: 'Local services overview',
    intro: 'Short intro.',
    content: '## Planning\nWe help you plan.\n\n- Scope\n- Timeline\n\n## Delivery\nWe deliver carefully.\n\n- Schedule\n- Care'
  });
  assert.ok(conv.searchCanvas.tabs.length >= 2);
  assert.ok(conv.recovery.seoText.h1);
  assert.ok(conv.searchCanvas.tabs.some((t) => /Planning/i.test(t.label)));
});

test('marketplace category maps searchCanvas', () => {
  assert.strictEqual(categoryForSection('searchCanvas'), 'core-content');
});

test('section-order treats searchCanvas as off-by-default and places after How It Works', () => {
  const so = require('../lib/section-order');
  assert.strictEqual(so.sectionIsOn({ sections: { searchCanvas: {} } }, 'searchCanvas'), false);
  assert.strictEqual(so.sectionIsOn({ sections: { searchCanvas: { on: true } } }, 'searchCanvas'), true);
  const ord = so.resolveSectionOrder({
    sections: {
      searchCanvas: { on: true },
      serviceProcess: {},
      services: {},
      hero: {}
    }
  });
  assert.ok(ord.indexOf('searchCanvas') > ord.indexOf('serviceProcess'));
});

test('website composer adapter accepts meaningful tabs', () => {
  assert.ok(hasAdapter('searchCanvas'));
  const ok = adaptApp('searchCanvas', {
    eyebrow: 'Our expertise',
    heading: 'Practical support for local businesses',
    intro: 'Explore the topics below for clear next steps.',
    tabs: [
      { label: 'Planning', heading: 'Planning advice', intro: 'We outline scope, timing and practical options so you can decide with confidence before work starts.' },
      { label: 'Delivery', heading: 'Reliable delivery', intro: 'Work is scheduled carefully with tidy finish standards and clear updates throughout the job for your site.' },
      { label: 'Support', heading: 'Ongoing support', intro: 'After delivery we remain available for questions, follow-ups and practical guidance when something needs attention.' }
    ]
  });
  assert.ok(ok.ok, JSON.stringify(ok.errors || ok));
  assert.strictEqual(ok.sectionKey, 'searchCanvas');
  assert.ok(ok.config.on);
  assert.ok(ok.config.tabs.length >= 3);

  const thin = adaptApp('searchCanvas', {
    heading: 'Hi',
    tabs: [
      { label: 'A', intro: 'Too short' },
      { label: 'B', intro: 'Still short' },
      { label: 'C', intro: 'Nope' }
    ]
  });
  assert.strictEqual(thin.ok, false);
});

console.log('\nAll SearchCanvas tests passed.');
