'use strict';

/**
 * Story Rows app (sections.storyRows): alternating photo / drawing + text rows.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const html = JSON.parse(read('trade.template.json')).html;
const m = read('manage.html');
const js = read('assets/lp-layouts.js');
const css = read('assets/lp-layouts.css');

test('template has a hidden placeholder and visibility lists include it', () => {
  assert.match(html, /<section data-sec="storyRows" class="section" id="storyRows" style="display:none"><\/section>/);
  assert.equal((html.match(/'storyTimeline','storyRows','mapHours','ctaBanner'\]/g) || []).length, 2);
  assert.match(html, /storyRows:'Story Rows'\}/);
  assert.match(html, /lp-layouts\.css\?v=(2[89]|[3-9]\d)/);
  assert.match(css, /\.srw-row:not\(\.srw-tone-dark\)\.srw-drawing \.srw-media img\{mix-blend-mode:multiply\}/);
  const shell = JSON.parse(read('landing-shell-neutral-v1.template.json')).html;
  assert.equal((shell.match(/'storyTimeline','storyRows','mapHours','ctaBanner'\]/g) || []).length, 2);
});

test('section order: optional and off by default', () => {
  const so = require('../lib/section-order.js');
  assert.ok(so.OFF_BY_DEFAULT.includes('storyRows'));
  assert.ok(so.OPTIONAL_SECTIONS.includes('storyRows'));
  assert.ok(!so.resolveSectionOrder({ sections: { storyRows: { on: false } } }).includes('storyRows'));
});

test('editor: defaults, list, layout card, sub editor, catalog', () => {
  assert.match(m, /storyRows:\{on:false,eyebrow:''/);
  assert.match(m, /'storyRows\.items':\[/);
  assert.match(m, /storyRowsItems:\{secId:'storyRows',key:'items',addLabel:'Add row'/);
  for (const k of ['imageKind', 'imageSide', 'tone', 'fade', 'btnLabel', 'btnLink', 'note']) assert.ok(m.indexOf("{k:'" + k + "'") >= 0, k);
  assert.match(m, /storyRows:\{title:'Story rows layout'/);
  assert.match(m, /\{t:'color',k:'darkColor',label:'Dark row colour'/);
  assert.match(m, /sub==='storyRows'\)\{/);
  assert.match(m, /section_key:'storyRows',/);
  assert.match(m, /\['storyRows','Story Rows'\]/);
});

test('renderer: rows, photo vs drawing, sides, tones, fade, phones', () => {
  assert.match(js, /function storyRows\(C\)/);
  assert.match(js, /storyTimeline, storyRows, bookingWeek/);
  assert.match(js, /'srw-row srw-' \+ kind \+ ' srw-img-' \+ side/);
  assert.match(js, /list:storyRowsItems:/);
  assert.match(js, /if \(M\.on !== true\) return;/);
  for (const c of ['.srw-photo .srw-media img', '.srw-drawing .srw-media img', '.srw-img-right .srw-media{order:2}', '.srw-row.srw-tone-tint', '.srw-row.srw-tone-dark', '.srw-fade.srw-img-right .srw-media img', '.srw-row.srw-noimg .srw-text{justify-content:center}']) {
    assert.ok(css.indexOf(c) >= 0, c);
  }
  assert.match(css, /@media \(max-width:760px\)\{\n  section\[data-sec="storyRows"\] \.srw-row/);
});

test('marketplace: listing, content and demo', () => {
  const content = JSON.parse(read('marketplace/app-content.json'));
  const sell = JSON.parse(read('marketplace/sell-templates.json'));
  const defaults = JSON.parse(read('marketplace/playground-default-configs.json'));
  assert.ok(content.storyRows.features.length >= 3);
  assert.equal(sell.storyRows.name, 'Story Rows');
  assert.equal(defaults.storyRows.storyRows.on, true);
  assert.match(read('marketplace.html'), /href="\/marketplace\/story-rows" data-app="story-rows"/);
  assert.match(read('marketplace/demos/demo-storyRows.html'), /data-sec="storyRows"/);
  assert.match(read('api/api-apps.js'), /await ensureNewApp\(STORY_ROWS_APP\);/);
});
