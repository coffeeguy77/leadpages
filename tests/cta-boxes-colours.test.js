'use strict';

/** CTA banner "Title + boxes": icon/image size presets, image colour (dark drawings show on
 *  dark banners), and own banner / text / outline colours. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const js = fs.readFileSync(path.join(__dirname, '..', 'assets/lp-layouts.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'assets/lp-layouts.css'), 'utf8');
const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');

function tintFn() {
  const start = js.indexOf('  var CBX_IC =');
  const end = js.indexOf('  function ctaBoxes(');
  const src = 'function hexOk(v){ v=String(v==null?"":v).trim(); return /^#[0-9a-fA-F]{6}$/.test(v)?v:""; }\n' + js.slice(start, end) + '\nreturn cbBoxTint;';
  return new Function(src)();
}

test('auto: dark banners paint box images the text colour; light keeps originals', () => {
  const t = tintFn();
  assert.equal(t({ layout: 'boxes', tone: 'brand' }), '#ffffff');
  assert.equal(t({ layout: 'boxes', tone: 'dark', cardText: '#eeeeee' }), '#eeeeee');
  assert.equal(t({ layout: 'boxes', tone: 'light' }), '');
  assert.equal(t({ layout: 'boxes', tone: 'brand', cardBg: '#f4efe6' }), '');
  assert.equal(t({ layout: 'boxes', tone: 'light', cardBg: '#1f3a2e' }), '#ffffff');
  assert.equal(t({ layout: 'boxes', boxImgMode: 'original' }), '');
  assert.equal(t({ layout: 'boxes', boxImgMode: 'tint', boxImgTint: '#d9a441' }), '#d9a441');
  assert.equal(t({ tone: 'brand' }), '', 'only the boxes layout');
});

test('renderer + CSS wire the size presets and colours', () => {
  assert.match(js, /var CBX_IC = \{ sm: 26, lg: 60, xl: 88, xxl: 128 \};/);
  assert.match(js, /f\('lpl-tint-cb', cbx\)/);
  assert.match(css, /img\.lpl-tint-cb\{filter:url\(#lpl-tint-cb\)!important\}/);
  assert.match(css, /\.cb-has-bg:not\(\.cb-full\) \.cb\{background:var\(--cb-card\)!important\}/);
  assert.match(css, /\.cbx-ic-set \.cbx-ic img\{width:var\(--cbx-ic\);height:var\(--cbx-ic\)\}/);
});

test('editor offers the new settings', () => {
  for (const k of ['boxIconSize', 'boxImgMode', 'boxImgTint', 'boxBorder', 'cardBg', 'cardText']) {
    assert.match(manage, new RegExp("k:'" + k + "'"));
  }
});
