'use strict';

/** Order Storefront editorial layout, button corners, half-height hero, minimal footer. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const oe = read('assets/lp-order-storefront.js');
const js = read('assets/lp-layouts.js');
const css = read('assets/lp-layouts.css');
const render = read('api/render.js');
const manage = read('manage.html');

test('editorial shop: opt-in, no inner scroll panel, search, category heading, order card', () => {
  assert.match(oe, /prototype\.isEditorial = function/);
  assert.match(oe, /\(this\.isEditorial\(\) \? ' lp-oe-ed' : ''\)/);
  assert.match(oe, /\.lp-oe-ed \.lp-oe-aside\{position:static;max-height:none;overflow:visible/);
  assert.match(oe, /data-oe-search/);
  assert.match(oe, /lp-oe-cat-head/);
  assert.match(oe, /lp-oe-order-card/);
  assert.match(render, /sec\.layout === 'editorial' \? ' data-layout="editorial"'/);
  assert.match(js, /function orderLayout\(C\)/);
  assert.match(manage, /\['editorial','Editorial \\u2014 clean list \+ order summary'\]/);
  // Classic stays the default: the scrolling cart rule is untouched.
  assert.match(oe, /\.lp-oe-aside\{position:sticky;top:16px;[^}]*overflow:auto\}/);
});

test('editorial shop drops a "Category - " prefix only when it matches a category', () => {
  const vm = require('vm');
  const win = { addEventListener() {}, LP_ORDER_TEST: true };
  const ctx = { window: win, document: { readyState: 'loading', addEventListener() {}, querySelectorAll() { return []; }, getElementById() { return null; } }, localStorage: { getItem() { return null; } }, setTimeout() {}, console };
  const src = oe.replace(/function OrderStorefront\(root\) \{/, 'window.__OS = OrderStorefront; function OrderStorefront(root) {');
  try { vm.runInNewContext(src, ctx); } catch (_e) { /* boot code may need a fuller DOM */ }
  const OS = win.__OS; assert.ok(OS);
  const self = { root: { getAttribute: (k) => (k === 'data-layout' ? 'editorial' : null) }, state: { catalogue: { categories: [{ name: 'Sausages' }, { name: 'Beef' }] } } };
  self.isEditorial = OS.prototype.isEditorial;
  const name = (n) => OS.prototype.displayName.call(self, { name: n });
  assert.equal(name('SAUSAGES - Spicy Beef'), 'Spicy Beef');
  assert.equal(name('SAUSAGE - thin English style pork'), 'thin English style pork');
  assert.equal(name('Rib Eye - Grain fed'), 'Rib Eye - Grain fed');
});

test('button corners: Branding default + per-app override + header', () => {
  assert.match(js, /var BTN_RADIUS = \{ square: '0px', rounded: '10px', pill: '999px' \}/);
  assert.match(js, /root\.classList\.toggle\('lpl-btn-shape', !!g\)/);
  assert.match(css, /html\.lpl-btn-shape :is\(\.btn,\.lpl-btn/);
  assert.match(css, /\.lpl-btn-own :is\(\.btn,\.lpl-btn/);
  assert.match(manage, /function lpMountButtonShapeCard\(body,c\)/);
  assert.match(manage, /var LPL_BTN_ROW=\{t:'sel',k:'btnShape'/);
  assert.match(manage, /<option value="pill"'\+\(H\.btnShape==='pill'/);
});

test('half-height hero and minimal footer are drawn and styled', () => {
  assert.match(js, /node\.classList\.toggle\('hsl-half', HS\.layout === 'half'\)/);
  assert.match(css, /hsl-half \.hsl\{--hsl-half-h:max\(220px,calc\(var\(--hsl-mh-d,680px\) \/ 2\)\)/);
  assert.match(manage, /\['half','Half-height banner/);
  assert.match(js, /function minimalFooter\(C\)/);
  assert.match(js, /document\.documentElement\.classList\.add\('lpl-ftm-lp'\)/);
  assert.match(css, /html\.lpl-ftm-lp #lpFooter\{display:none!important\}/);
  assert.match(manage, /\['minimal','Minimal \\u2014 logo \| text'\]/);
});
