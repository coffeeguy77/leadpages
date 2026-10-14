'use strict';

/** Multi-line headings, text selection inside draggable rows, CTA "No background",
 *  and the hero / trust bar width option. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'assets/lp-layouts.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'assets/lp-layouts.css'), 'utf8');

test('heading / title fields are growing text boxes (Enter = new line)', () => {
  const src = manage.slice(manage.indexOf('function lpIsHeadKey(k){'), manage.indexOf('function lpHeadTa('));
  const isHead = new Function(src + '\nreturn lpIsHeadKey;')();
  for (const k of ['heading', 'title', 'h1', 'bookTitle', 'calloutTitle', 'formTitle', 'pageBannerTitle']) assert.equal(isHead(k), true, k);
  for (const k of ['seoTitle', 'metaTitle', 'pageTitle', 'btn1Label', 'text', 'eyebrow', 'linkTitle']) assert.equal(isHead(k), false, k);
  assert.match(manage, /else if\(lpIsHeadKey\(key\)\) h\+=/);
  assert.match(manage, /else if\(lpIsHeadKey\(r\.k\)\) h\+=/);
  assert.match(manage, /if\(lpIsHeadKey\(f\.k\)\) return/);
});

test('site shows a typed line break in a heading as a line break', () => {
  assert.match(js, /function headingBreaks\(\)/);
  assert.match(js, /appWidths, headingBreaks\];/);
});

test('pressing the mouse in a text box inside a draggable row selects text', () => {
  assert.match(manage, /\(function lpFieldDragGuard\(\)\{/);
  assert.match(manage, /el\.setAttribute\('draggable','false'\)/);
});

test('CTA banner: No background style uses the section colour', () => {
  assert.match(manage, /\['clear','No background/);
  assert.match(js, /photo: 1, clear: 1 \}\)\[M\.tone\]/);
  assert.match(css, /cb-tone-clear \.cb\{background:transparent!important/);
});

test('hero slider / hero banners / trust bar: width option', () => {
  assert.match(manage, /var LPL_WIDTH_ROW=\{t:'sel',k:'widthMode'/);
  assert.match(js, /var WIDTH_SECS = \['heroSlider', 'hero', 'splitHero', 'trustBar'\];/);
  assert.match(css, /section\[data-sec\]\.lpw-site\{width:100%;max-width:var\(--site-maxw,1920px\)/);
  assert.match(css, /section\[data-sec="trustBar"\]\.lpw-full \.tb-band\{max-width:none!important\}/);
});

test('header Order button is pushed clear of the logo (logo offsets use transforms)', () => {
  assert.match(js, /function ctaClearLogo\(\)/);
  assert.match(js, /if \(overlap && c\.top > l\.top\) push = /);
  assert.match(js, /bindCtaClear\(\); ctaClearSoon\(\);/);
});
