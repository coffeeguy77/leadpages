'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('orders.html fast new order shows option chips and notes label', function () {
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  assert.match(html, /no-opt-chip/);
  assert.match(html, /Notes:</);
  assert.doesNotMatch(html, /Line notes/);
  assert.match(html, /formatKgDefault/);
  assert.match(html, /width:4\.8rem/);
});
