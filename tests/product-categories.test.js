'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  productCategoryIds,
  productInCategory,
  additionalCategoryIds,
  applyAdditionalCategoriesToOptions,
  nameMatchesNeedle
} = require('../lib/order/product-categories');
const { buildProductOptionsPatch } = require('../lib/order/product-options');

test('productCategoryIds merges primary and additional', function () {
  const p = {
    category_id: 'lamb',
    options: { additional_category_ids: ['pies', 'lamb', 'party'] }
  };
  assert.deepEqual(productCategoryIds(p), ['lamb', 'pies', 'party']);
  assert.deepEqual(additionalCategoryIds(p), ['pies', 'party']);
  assert.equal(productInCategory(p, 'pies'), true);
  assert.equal(productInCategory(p, 'beef'), false);
});

test('nameMatchesNeedle finds pie in title', function () {
  assert.equal(nameMatchesNeedle('PIES - Lamb Veg Lrg', 'pie'), true);
  assert.equal(nameMatchesNeedle('Beef Pie Family', 'pie'), true);
  assert.equal(nameMatchesNeedle('LAMB - Leg', 'pie'), false);
});

test('buildProductOptionsPatch stores additional categories', function () {
  const patched = buildProductOptionsPatch({
    size_mode: 'variable',
    category_id: 'lamb',
    additional_category_ids: ['pies', 'lamb'],
    options: { size_mode: 'variable' }
  });
  assert.deepEqual(patched.additional_category_ids, ['pies']);
  assert.equal(patched.size_mode, 'variable');
});

test('applyAdditionalCategoriesToOptions clears when empty', function () {
  const next = applyAdditionalCategoriesToOptions(
    { additional_category_ids: ['pies'] },
    { category_id: 'lamb', additional_category_ids: [] }
  );
  assert.equal(next.additional_category_ids, undefined);
});

test('orders UI exposes additional categories and pies bulk action', function () {
  const fs = require('fs');
  const path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  const api = fs.readFileSync(path.join(__dirname, '..', 'api/order/products.js'), 'utf8');
  const shop = fs.readFileSync(path.join(__dirname, '..', 'assets/lp-order-storefront.js'), 'utf8');
  assert.match(html, /prod-extra-cats/);
  assert.match(html, /Additional categories/);
  assert.match(html, /lpe-cat-tile/);
  assert.doesNotMatch(html, /id="prod-cat-search"/);
  assert.doesNotMatch(html, /Also show in/);
  assert.match(html, /prod-pies-extra/);
  assert.match(html, /assign_additional_by_match/);
  assert.match(api, /assign_additional_by_match/);
  assert.match(shop, /productInCategory/);
  assert.match(shop, /category_ids/);
});
