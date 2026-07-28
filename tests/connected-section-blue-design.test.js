/**
 * Homepage "One website. Everything connected." — navy band with Apple-style
 * landscape laptop mock + coloured icon nodes whose dashed lines touch the circles.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const home = fs.readFileSync(path.join(root, 'home.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/marketing-home.css'), 'utf8');
const block = home.split('aria-labelledby="connected-title"')[1].split('id="website-examples"')[0];

test('connected section uses navy design tokens from mockup_b904', function () {
  assert.match(css, /background:\s*#0[Bb]1[Bb]2[Aa]/);
  assert.match(css, /connected-browser/);
  assert.match(css, /aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(home, /syncConnectedWires|rayHitBox|connected-lines/);
});

test('connected section uses landscape Apple-style laptop (not portrait)', function () {
  assert.match(block, /connected-browser/);
  assert.match(block, /macbook/);
  assert.match(block, /connected-site-browser\.jpg/);
  assert.match(css, /\.macbook-lid|\.macbook-base/);
  assert.doesNotMatch(block, /720\s*[x×]\s*1100|portrait/i);
  assert.ok(fs.existsSync(path.join(root, 'assets/marketing-home/connected-site-browser.jpg')));
});

test('connected section has coloured icon nodes with SVG icons and labels', function () {
  ['Quotes', 'Bookings', 'Reviews', 'Forms', 'Galleries', 'CRM', 'Analytics', 'Ads'].forEach(function (label) {
    assert.match(block, new RegExp(label));
  });
  assert.match(block, /cnode-ico/);
  assert.match(block, /n-quotes/);
  assert.match(block, /connected-lines/);
  assert.doesNotMatch(block, /<span class="ico">Q<\/span>/);
});

test('connected wires are synced from icon centres to the laptop', function () {
  assert.match(home, /function syncConnectedWires/);
  assert.match(home, /:scope > a\.cnode \.cnode-ico/);
  assert.match(css, /node-pulse/);
});
