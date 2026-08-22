'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  poultrySizeCodeToKg,
  extractPoultrySizeRange,
  isPoultryWholeBirdProduct,
  buildPoultryWholeBirdCopy,
  parseMinimumKgFromText,
  defaultWeightKg,
  isWeightOnlyText
} = require('../lib/order/product-weight');
const { buildProductOptionsPatch } = require('../lib/order/product-options');

test('poultry size code maps to kg (AU shorthand)', function () {
  assert.equal(poultrySizeCodeToKg(60), 6);
  assert.equal(poultrySizeCodeToKg(68), 6.8);
  assert.equal(poultrySizeCodeToKg(16), 1.6);
});

test('extractPoultrySizeRange reads 60-68 from turkey name', function () {
  var r = extractPoultrySizeRange('TURKEY - Whole 60-68', '');
  assert.ok(r);
  assert.equal(r.sizeLow, 60);
  assert.equal(r.sizeHigh, 68);
  assert.equal(r.kgLow, 6);
  assert.equal(r.kgHigh, 6.8);
});

test('whole turkey is qty-based with plain size copy', function () {
  var p = { name: 'TURKEY - Whole Size 60-68', short_description: '' };
  assert.equal(isPoultryWholeBirdProduct(p), true);
  var copy = buildPoultryWholeBirdCopy(p);
  assert.match(copy.short_description, /Size 60–68/);
  assert.match(copy.short_description, /6–7 kg/);
  assert.equal(copy.quantity_prompt, null);
  assert.doesNotMatch(copy.short_description, /choose quantity/i);
});

test('turkey breast is not whole bird qty mode', function () {
  assert.equal(isPoultryWholeBirdProduct({ name: 'TURKEY - Breast Rolled', short_description: '' }), false);
});

test('parseMinimumKgFromText reads lamb leg short description', function () {
  assert.equal(parseMinimumKgFromText('1.3 kg'), 1.3);
  assert.equal(parseMinimumKgFromText('LAMB - Leg Seasoned 1.3 kg'), 1.3);
});

test('defaultWeightKg uses minimum or 1', function () {
  assert.equal(defaultWeightKg({ options: { minimum_kg: 1.3 } }), 1.3);
  assert.equal(defaultWeightKg({ options: {} }), 1);
});

test('isWeightOnlyText detects bare kg notes', function () {
  assert.equal(isWeightOnlyText('1.3 kg'), true);
  assert.equal(isWeightOnlyText('Seasoned — great for roasting'), false);
});

test('buildProductOptionsPatch stores minimum_kg', function () {
  var patched = buildProductOptionsPatch({
    size_mode: 'variable',
    minimum_kg: 1.3,
    options: { size_mode: 'variable' }
  });
  assert.equal(patched.minimum_kg, 1.3);
});

test('orders UI has migrate weight button and minimum kg field', function () {
  const fs = require('fs');
  const path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  const api = fs.readFileSync(path.join(__dirname, '..', 'api/order/products.js'), 'utf8');
  const shop = fs.readFileSync(path.join(__dirname, '..', 'assets/lp-order-storefront.js'), 'utf8');
  assert.match(html, /prod-min-kg/);
  assert.match(html, /prod-migrate-weight/);
  assert.match(html, /migrate_weight_settings/);
  assert.match(api, /migrate_weight_settings/);
  assert.match(shop, /minimumWeightKg/);
  assert.match(shop, /kgFieldLabel/);
  assert.match(shop, /KG \(MIN/);
});
