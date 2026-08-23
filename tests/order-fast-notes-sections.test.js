'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('orders.html fast new order uses separate Notes and Options toggles', function () {
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  assert.match(html, /data-fast-notes-toggle/);
  assert.match(html, /data-fast-options-toggle/);
  assert.match(html, /no-fast-panel/);
  assert.match(html, /noFastPanelOpen/);
  assert.doesNotMatch(html, /no-fast-notes-row"><span class="lbl">Notes:/);
});

test('orders.html product editor uses attribute sections copy', function () {
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  assert.match(html, /Product attribute sections/);
  assert.match(html, /\+ Add section/);
  assert.match(html, /Section title/);
  assert.match(html, /value="yes_no"/);
});

test('storefront fast row separates notes and options actions', function () {
  const js = fs.readFileSync(path.join(__dirname, '..', 'assets', 'lp-order-storefront.js'), 'utf8');
  assert.match(js, /toggle-options/);
  assert.match(js, /optionsOpen/);
  assert.match(js, /lp-oe-fast-options/);
  assert.match(js, /lp-oe-fast-notes/);
});
