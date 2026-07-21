/**
 * Access my portal — Quote Builder colour controls + live CSS vars.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const online = fs.readFileSync(path.join(root, 'assets/lp-online-quote.js'), 'utf8');
const display = fs.readFileSync(path.join(root, 'assets/lp-quote-display.js'), 'utf8');
const builder = fs.readFileSync(path.join(root, 'assets/lp-quote-builder.js'), 'utf8');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const render = fs.readFileSync(path.join(root, 'api/render.js'), 'utf8');

test('builder exposes Access my portal colour pickers', function() {
  assert.match(builder, /Access my portal/);
  assert.match(builder, /accessBtnBg/);
  assert.match(builder, /accessPopBg/);
  assert.match(builder, /accessPopTitle/);
  assert.match(builder, /accessPopText/);
  assert.match(builder, /accessPopBorder/);
  assert.match(builder, /accessPopBtnBg/);
  assert.match(builder, /accessPopCancelBorder/);
  assert.match(builder, /Already quoted/);
});

test('wizardUiVars maps portal access colours', function() {
  assert.match(display, /accessBtnBg.*--lp-oq-access-btn-bg/);
  assert.match(display, /accessPopBg.*--lp-oq-access-pop-bg/);
  assert.match(display, /accessPopTitle.*--lp-oq-access-pop-title/);
  assert.match(display, /accessPopText.*--lp-oq-access-pop-text/);
  assert.match(display, /accessPopBtnBg.*--lp-oq-access-pop-btn-bg/);
});

test('live popup uses portal style classes and CSS vars', function() {
  assert.match(online, /lp-oq-access-send/);
  assert.match(online, /lp-oq-access-cancel/);
  assert.match(online, /lp-oq-access-lead/);
  assert.match(online, /--lp-oq-access-pop-bg/);
  assert.match(online, /--lp-oq-access-pop-title/);
  assert.match(online, /--lp-oq-access-pop-text/);
  assert.match(online, /--lp-oq-access-btn-bg/);
  assert.match(online, /renderPortalAccessPopup\(uiStyle\)/);
});

test('cache-bust for portal styling', function() {
  assert.match(manage, /oq-portal-style-1/);
  assert.match(render, /lp-online-quote\.js\?v=oq-portal-style-1/);
});
