'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

test('manage exposes promotions colour pickers with theme defaults', function () {
  const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
  assert.match(manage, /function _prThemeColors/);
  assert.match(manage, /function _prColorBlock/);
  assert.match(manage, /Button background/);
  assert.match(manage, /Time cell background/);
  assert.match(manage, /btnBg/);
  assert.match(manage, /timeBg/);
});

test('demo-shared applies promotion colour overrides on render', function () {
  const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
  assert.match(demo, /function _prDefCols/);
  assert.match(demo, /function _prCol/);
  assert.match(demo, /p\.colors/);
  assert.match(demo, /btnBg/);
  assert.match(demo, /timeBg/);
});

test('LeadPages footer adapts ink on light backgrounds', function () {
  const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
  const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
  assert.match(manage, /function _lpfLightBg/);
  assert.match(manage, /function _lpfDefInk/);
  assert.match(manage, /lpf-prev-mode/);
  assert.match(manage, /lp-prev-body iframe\{[^}]*box-shadow/);
  assert.match(demo, /_lpfLightBg/);
  assert.match(demo, /txt\.style\.color=ink/);
});
