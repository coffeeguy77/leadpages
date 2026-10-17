'use strict';

/**
 * Hero Slider "Split" layout, Services "Numbered cards" and in-page links to app
 * sections (assets/lp-layouts.js + .css, manage.html). Both layouts are opt-in.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const js = read('assets/lp-layouts.js');
const css = read('assets/lp-layouts.css');
const manage = read('manage.html');

test('Hero Slider Split: drawn only when chosen, H1 handled, buttons reuse slide 1', () => {
  assert.match(js, /var on = HS\.layout === 'split';/);
  assert.match(js, /node\.classList\.toggle\('hsp-on', on\)/);
  // Optional SEO H1 line: when set it is the H1 and the headline becomes an H2.
  assert.match(js, /var headTag = h1 \? 'h2' : 'h1';/);
  assert.match(js, /<h1 class="hsp-h1" data-lpe="splitH1">/);
  // Buttons are copies of slide 1's own buttons; a click is passed to the original.
  assert.match(js, /orig\.cloneNode\(true\)/);
  assert.match(js, /orig\.click\(\)/);
  assert.match(js, /fontSet, mobileBarSpace, heroSplit,/);
  assert.match(css, /section\[data-sec="heroSlider"\]\.hsp-on > \.hsl\{display:none!important\}/);
  assert.match(css, /@media\(max-width:860px\)\{\s*\.hsp-grid\{grid-template-columns:1fr/);
});

test('Services Numbered: own cards, header split on by default, optional link', () => {
  assert.match(js, /var num = SV\.mode === 'numbered';/);
  assert.match(js, /node\.classList\.toggle\('svn-headsplit', num && SV\.numHeadSplit !== false\)/);
  assert.match(js, /function servicesNumbered\(node, C, SV\)/);
  assert.match(js, /var lab = txt\(SV\.numLinkLabel\);/);
  // The eyebrow/heading wrapper is unwrapped before clearing, so the heading is never lost.
  assert.match(js, /var oldLead = node\.querySelector\('\.section-head > \.svn-lead'\);/);
  assert.match(css, /\.svn-n\{/);
  assert.match(css, /section\[data-sec="services"\]\.svcs-num \.svcs\{/);
});

test('the editor offers both layouts', () => {
  assert.match(manage, /\['split','Split \\u2014 text left, photo right'\]/);
  assert.match(manage, /k:'splitH1',label:'SEO H1 line above the headline \(optional\)'/);
  assert.match(manage, /k:'splitTone'[^}]*when:'layout=split'/);
  assert.match(manage, /<option value="numbered"/);
  assert.match(manage, /\{title:'Numbered cards',when:'mode=numbered'/);
  assert.match(manage, /k:'numLinkLabel'/);
  // The style read-back keeps "numbered" (it used to fall back to grid for unknown modes).
  assert.match(manage, /\(SV\.mode==='numbered'\?'numbered':'grid'\)/);
  assert.match(manage, /\(m==='numbered'\?'numbered':'grid'\)/);
});

test('"#app" links scroll to the app section when no element has that id', () => {
  assert.match(js, /function bindSectionLinks\(\)/);
  assert.match(js, /document\.getElementById\(name\)\) return;/);
  assert.match(js, /function init\(\) \{ bind\(\); bindSectionLinks\(\); run\(\); \}/);
});

test('template loads the new asset versions', () => {
  const tpl = read('trade.template.json');
  assert.match(tpl, /lp-layouts\.css\?v=30/);
  assert.match(tpl, /lp-layouts\.js\?v=32/);
});
