'use strict';

/**
 * Footer + links fixes: page links keep the /:site prefix, minimal footer LeadPages logo
 * follows the LeadPages footer settings (with pulse), step images follow the number size,
 * the phone call bar never hides the footer, and the link-columns editor uses theme colours.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const tpl = JSON.parse(read('trade.template.json')).html;
const js = read('assets/lp-layouts.js');
const css = read('assets/lp-layouts.css');
const manage = read('manage.html');

test('header CTA, hero buttons and footer links use the site base for landing pages', () => {
  assert.doesNotMatch(tpl, /_slug\?\('\/'\+_slug\)/);
  assert.doesNotMatch(tpl, /return slug\?\('\/'\+slug\):null;/);
  const n = tpl.split("(typeof _siteBase==='function'?_siteBase():'')+'/'+").length - 1;
  assert.ok(n >= 3, 'site base used in page links');
});

test('minimal footer LeadPages logo pulses and follows LeadPages footer colours', () => {
  const f = js.slice(js.indexOf('function ftmLeadPagesLogo('), js.indexOf('/* ---------- Order Storefront'));
  assert.match(f, /pulse: true/);
  assert.match(f, /L\.accent/);
  assert.match(f, /L\.ink/);
  assert.doesNotMatch(js, /upgradeAll\(\{ pulse: false \}\)/);
});

test('step images scale with Number & icon size', () => {
  assert.match(css, /--sp-img-size,calc\(var\(--sp-num-size,42px\) \* var\(--sp-img-k,2\.2\)\)/);
  assert.match(js, /px \* sc \/ 100/);
});

test('phones: spacer under the footer for the fixed call bar', () => {
  assert.match(js, /fontSet, mobileBarSpace(, [a-zA-Z]+)*\]/);
  assert.match(css, /\.lpl-mbar-space\{/);
});

test('link-columns editor cards use theme colours (dark themes)', () => {
  const cols = manage.slice(manage.indexOf('function drawCols('), manage.indexOf('drawCols();'));
  assert.doesNotMatch(cols, /background:#fff;/);
  assert.match(cols, /background:var\(--panel,#fff\)/);
});
