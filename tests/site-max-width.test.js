'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  normalizeMaxSiteWidth,
  resolveMaxSiteWidth,
  siteMaxWidthRootCss
} = require('../lib/site-max-width');

test('normalizeMaxSiteWidth defaults to 1920', function () {
  assert.equal(normalizeMaxSiteWidth(null), '1920');
  assert.equal(normalizeMaxSiteWidth(''), '1920');
  assert.equal(normalizeMaxSiteWidth('full'), 'full');
});

test('resolveMaxSiteWidth capped vs full', function () {
  var capped = resolveMaxSiteWidth({ maxSiteWidth: '1920' });
  assert.equal(capped.mode, 'capped');
  assert.equal(capped.px, 1920);
  assert.match(capped.cssClass, /site-width-capped/);

  var full = resolveMaxSiteWidth({ maxSiteWidth: 'full' });
  assert.equal(full.mode, 'full');
  assert.equal(full.cssClass, 'site-width-full');
});

test('siteMaxWidthRootCss emits CSS vars', function () {
  assert.equal(
    siteMaxWidthRootCss({ maxSiteWidth: '1920' }),
    ':root{--site-maxw:1920px;--maxw:1920px}'
  );
  assert.equal(siteMaxWidthRootCss({ maxSiteWidth: 'full' }), '');
});

test('demo-shared.css includes hero slider cap rules', function () {
  var css = fs.readFileSync(path.join(__dirname, '..', 'marketplace/demos/demo-shared.css'), 'utf8');
  assert.match(css, /html\.site-width-capped section\[data-sec="heroSlider"\] \.hsl\{[^}]*aspect-ratio:16\/9/);
  assert.match(css, /html\.site-width-capped \[data-sec="trustBar"\]\.tb-images \.tb-band/);
});

test('demo-shared.js applies site max width in applyCfg', function () {
  var js = fs.readFileSync(path.join(__dirname, '..', 'marketplace/demos/demo-shared.js'), 'utf8');
  assert.match(js, /function applySiteMaxWidth\(/);
  assert.match(js, /applySiteMaxWidth\(C\)/);
});

test('render.js injects site width class and vars', function () {
  var render = fs.readFileSync(path.join(__dirname, '..', 'api/render.js'), 'utf8');
  assert.match(render, /function injectSiteWidthClass/);
  assert.match(render, /resolveMaxSiteWidth/);
});

test('manage.html exposes site width setting in Settings', function () {
  var manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
  assert.match(manage, /id="d-max-site-width"/);
  assert.match(manage, /c\.maxSiteWidth/);
});
