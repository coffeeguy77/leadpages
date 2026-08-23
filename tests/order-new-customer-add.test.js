'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('new order form has customer mode and required phone', function () {
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  assert.match(html, /name="no-cust-mode"/);
  assert.match(html, /Existing customer/);
  assert.match(html, /no-cust-search/);
  assert.match(html, /id="no-phone"[^>]*required/);
  assert.match(html, /customer_id/);
});

test('fast order rows have explicit Add button', function () {
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  assert.match(html, /data-fast-add/);
  assert.match(html, /noFastAdded/);
  assert.match(html, /fastRowIsAdded/);
});

test('pickup dates use long AU format helper', function () {
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  assert.match(html, /formatPickupDateLong/);
  assert.match(html, /ordinalDaySuffix/);
});
