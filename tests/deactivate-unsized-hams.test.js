'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  textHasSizeOrWeight,
  isUnsizedHamCandidate,
  isHamProduct
} = require('../lib/order/deactivate-unsized-hams');

test('textHasSizeOrWeight detects ham size bands and kg', function () {
  assert.equal(textHasSizeOrWeight('HAM - HALF 3.5-4'), true);
  assert.equal(textHasSizeOrWeight('2 - 3 kg'), true);
  assert.equal(textHasSizeOrWeight('Ham Whole'), false);
});

test('isUnsizedHamCandidate flags generic hams only', function () {
  assert.equal(isHamProduct({ name: 'HAM (no charge)', active: true }), true);
  assert.equal(isUnsizedHamCandidate({ name: 'HAM (no charge)', active: true }), true);
  assert.equal(isUnsizedHamCandidate({ name: 'Ham Whole', active: true }), true);
  assert.equal(isUnsizedHamCandidate({ name: 'Ham Half', active: true }), true);
  assert.equal(isUnsizedHamCandidate({ name: 'HAM - HALF 3.5-4', active: true }), false);
  assert.equal(
    isUnsizedHamCandidate({ name: 'HAM - Half', short_description: '2 kg', active: true }),
    false
  );
  assert.equal(isUnsizedHamCandidate({ name: 'BEEF - Brisket', active: true }), false);
  assert.equal(isUnsizedHamCandidate({ name: 'Ham Whole', active: false }), false);
});

test('orders UI has deactivate unsized hams action', function () {
  const fs = require('fs');
  const path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  const api = fs.readFileSync(path.join(__dirname, '..', 'api/order/products.js'), 'utf8');
  assert.match(html, /prod-deactivate-unsized-hams/);
  assert.match(html, /deactivate_unsized_hams/);
  assert.match(api, /deactivate_unsized_hams/);
});
