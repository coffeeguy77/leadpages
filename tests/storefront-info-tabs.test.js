'use strict';

/** Order storefront info tabs: extra tabs beside Browse menu / My orders whose items link to products. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const js = read('assets/lp-order-storefront.js');
const render = read('api/render.js');
const layouts = read('assets/lp-layouts.js');
const m = read('manage.html');

test('render passes sections.orderStorefront.infoTabs as an escaped data attribute', () => {
  assert.match(render, /function infoTabsAttr\(\)/);
  assert.match(render, /' data-info-tabs="' \+ esc\(JSON\.stringify\(tabs\)\) \+ '"'/);
  assert.match(render, /t\.on !== false && String\(t\.label \|\| ''\)\.trim\(\)/);
});

test('storefront draws info tabs next to Browse menu and My orders', () => {
  assert.match(js, /data-act="info-tab" data-tab="/);
  assert.match(js, /if \(!this\.slug \|\| \(!this\.showPortal && !tabs\.length && !specials\)\) return '';/);
  assert.match(js, /this\.state\.view === 'info' && this\.activeInfoTab\(\)/);
  assert.match(js, /OrderStorefront\.prototype\.renderInfoTab = function/);
  // My orders stays exactly where it was when the portal is on
  assert.match(js, /if \(this\.showPortal\) \{\s*html \+=\s*'<button type="button" class="lp-oe-client-tab' \+\s*\(onOrders \? ' on' : ''\) \+\s*'" data-act="view-orders">My orders<\/button>';/);
});

test('linked items jump to the product in the order form', () => {
  assert.match(js, /data-act="goto-product" data-product="/);
  assert.match(js, /OrderStorefront\.prototype\.gotoProduct = function \(id\)/);
  assert.match(js, /self\.productInCategory\(p, c\.id\)/);
  assert.match(js, /el\.classList\.add\('lp-oe-linked'\)/);
  assert.match(js, /'info-tab': 1,\s*'specials-tab': 1,\s*'goto-product': 1,/);
});

test('item text is escaped and products resolve by slug, id or name', () => {
  assert.match(js, /OrderStorefront\.prototype\.productFor = function \(want\)/);
  assert.match(js, /'<span class="lp-oe-info-il">' \+ esc\(it\.label\) \+ '<\/span>'/);
  assert.match(js, /return '<p>' \+ esc\(para\)\.replace\(\/\\n\/g, '<br>'\) \+ '<\/p>';/);
});

test('editor preview keeps the attribute in sync and the editor has an Info tabs card', () => {
  assert.match(layouts, /mount\.setAttribute\('data-info-tabs', tabsJson\)/);
  assert.match(m, /function orderInfoTabsCard\(\)/);
  assert.match(m, /\+orderInfoTabsCard\(\)/);
  assert.match(m, /wireOrderInfoTabs\(c\);/);
  assert.match(m, /function lpInfoTextToItems\(text\)/);
});
