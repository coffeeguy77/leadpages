'use strict';

/** Timeline app (sections.storyTimeline): template, visibility, Position, editor, renderer, marketplace. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const so = require('../lib/section-order');
const K = 'storyTimeline';

test('trade template has a hidden placeholder; visibility lists include it', () => {
  const html = JSON.parse(read('trade.template.json')).html;
  assert.match(html, /<section data-sec="storyTimeline" class="section" id="storyTimeline" style="display:none"><\/section>/);
  const ds = read('marketplace/demos/demo-shared.js');
  assert.ok(ds.match(/var __OPTV=\[([^\]]+)\]/)[1].indexOf("'storyTimeline'") >= 0);
  assert.equal((html.match(/'customHtml','storyTimeline','mapHours','ctaBanner'\]/g) || []).length, 2);
});

test('off by default, and a switched-on timeline lands just above the footer', () => {
  assert.ok(so.OFF_BY_DEFAULT.includes(K));
  assert.ok(so.OPTIONAL_SECTIONS.includes(K));
  assert.ok(!so.resolveSectionOrder({ sections: { storyTimeline: { on: false } } }).includes(K));
  const o = so.resolveSectionOrder({ sectionOrder: ['hero', 'services', 'footer'], sections: { storyTimeline: { on: true } } });
  assert.equal(o.indexOf(K), o.indexOf('footer') - 1);
});

test('editor: chip, defaults, list, layout options, landing-page app', () => {
  const m = read('manage.html');
  assert.match(m, /\['storyTimeline','Timeline'\],\['mapHours','Map & Hours'\]/);
  assert.match(m, /storyTimeline:\{on:false,eyebrow:'Our story'/);
  assert.match(m, /'storyTimeline\.items':\[/);
  assert.match(m, /storyTimelineItems:\{secId:'storyTimeline',key:'items'/);
  assert.match(m, /sub==='storyTimeline'\)\{/);
  assert.match(m, /storyTimeline:\{title:'Timeline layout'/);
  assert.match(m, /section_key:'storyTimeline',/);
  assert.match(m, /LP_BEFORE_FOOTER_APPS=\['storyTimeline','mapHours','ctaBanner'\]/);
});

test('renderer: four layouts, four markers, auto-select hooks, phone rail', () => {
  const js = read('assets/lp-layouts.js');
  const css = read('assets/lp-layouts.css');
  assert.match(js, /function storyTimeline\(C\)/);
  assert.match(js, /mapHours, ctaBanner, storyTimeline,/);
  assert.match(js, /var STL_LAYOUTS = \{ line: 1, alternate: 1, rail: 1, cards: 1 \};/);
  assert.match(js, /list:storyTimelineItems:/);
  for (const l of ['line', 'alternate', 'rail', 'cards']) assert.ok(css.indexOf('.stl-' + l + ' ') >= 0, l);
  for (const mk of ['ring', 'dot', 'icon', 'year']) assert.ok(css.indexOf('.stl-mk-' + mk + '{') >= 0, mk);
  // The list's marker class must not reuse the marker's own class (it would shrink the list).
  assert.match(js, /'<ol class="stl-list stl-m-' \+ marker/);
  assert.match(css, /@media \(max-width:700px\)\{\n  section\[data-sec="storyTimeline"\]:not\(\.stl-cards\) \.stl-list\{display:block/);
});

test('marketplace: sell page, content, demo, demo fields, hub tile, category, registry', () => {
  const sell = JSON.parse(read('marketplace/sell-templates.json'));
  const content = JSON.parse(read('marketplace/app-content.json'));
  const defs = JSON.parse(read('marketplace/playground-field-defs.json'));
  const defaults = JSON.parse(read('marketplace/playground-default-configs.json'));
  assert.ok(sell[K].blocks.some((b) => b.block_type === 'playground' && b.payload.section_key === K));
  assert.ok(content[K].features.length >= 3);
  assert.equal(defaults[K][K].on, true);
  assert.ok(defs[K].length >= 8);
  const demo = read('marketplace/demos/demo-storyTimeline.html');
  assert.match(demo, /data-sec="storyTimeline"/);
  assert.match(demo, /demo-shared\.js/);
  assert.match(read('marketplace.html'), /href="\/marketplace\/story-timeline" data-app="story-timeline"/);
  assert.equal(require('../lib/marketplace-categories').SECTION_CATEGORY[K], 'core-content');
  assert.match(read('api/api-apps.js'), /ensureNewApp\(STORY_TIMELINE_APP\)/);
  assert.ok(require('../lib/ai-composer/catalogue').EXCLUDED_APPS.includes(K));
});
