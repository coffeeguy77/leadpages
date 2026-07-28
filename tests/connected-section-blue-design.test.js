/**
 * Homepage "One website. Everything connected." must match the navy blue design:
 * landscape browser mock (not iMac / not portrait), coloured icon nodes + dashed connectors.
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

test('connected section uses navy blue design tokens', function () {
  assert.match(css, /background:\s*#0e1b26/);
  assert.match(css, /connected-browser/);
  assert.match(css, /aspect-ratio:\s*907\s*\/\s*481/);
});

test('connected section is landscape browser — not iMac / portrait laptop', function () {
  assert.match(block, /connected-browser/);
  assert.match(block, /connected-site-browser\.jpg/);
  assert.doesNotMatch(block, /connected-laptop|imac|orbit o1|class="center"/i);
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
