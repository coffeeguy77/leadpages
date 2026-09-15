'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  countProductsUsingCategory,
  scrubSettingsCategoryRefs
} = require('../lib/order/category-delete');

test('countProductsUsingCategory counts primary and additional', function () {
  var products = [
    { id: '1', category_id: 'beef', options: {} },
    { id: '2', category_id: 'chicken', options: { additional_category_ids: ['beef', 'pies'] } },
    { id: '3', category_id: 'beef', options: { additional_category_ids: ['beef'] } },
    { id: '4', category_id: null, options: { additional_category_ids: ['pies'] } }
  ];
  var beef = countProductsUsingCategory(products, 'beef');
  assert.equal(beef.primary, 2);
  assert.equal(beef.additional, 1);
  assert.equal(beef.total, 3);
  var pies = countProductsUsingCategory(products, 'pies');
  assert.equal(pies.primary, 0);
  assert.equal(pies.additional, 2);
  assert.equal(pies.total, 2);
  var none = countProductsUsingCategory(products, 'missing');
  assert.equal(none.total, 0);
});

test('scrubSettingsCategoryRefs clears storefront default and GST ids', function () {
  var settings = {
    storefront: { default_category_id: 'cat-a', default_category_slug: 'beef', show_all_categories: true },
    gst: { category_ids: ['cat-a', 'cat-b'], included: true },
    other: 1
  };
  var out = scrubSettingsCategoryRefs(settings, 'cat-a');
  assert.equal(out.changed, true);
  assert.equal(out.settings.storefront.default_category_id, null);
  assert.equal(out.settings.storefront.default_category_slug, null);
  assert.equal(out.settings.storefront.show_all_categories, true);
  assert.deepEqual(out.settings.gst.category_ids, ['cat-b']);
  assert.equal(out.settings.other, 1);
  var noop = scrubSettingsCategoryRefs(settings, 'cat-z');
  assert.equal(noop.changed, false);
});

test('products API and orders UI expose category delete/restore', function () {
  const api = fs.readFileSync(path.join(__dirname, '..', 'api/order/products.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  const lib = fs.readFileSync(path.join(__dirname, '..', 'lib/order/category-delete.js'), 'utf8');
  assert.match(api, /delete_category/);
  assert.match(api, /restore_category/);
  assert.match(api, /deactivateCategory/);
  assert.match(api, /hardDeleteCategory/);
  assert.match(lib, /function deactivateCategory/);
  assert.match(lib, /function hardDeleteCategory/);
  assert.match(html, /prod-manage-cats/);
  assert.match(html, /Manage categories/);
  assert.match(html, /delete_category/);
  assert.match(html, /restore_category/);
  assert.match(html, /cat-manage-modal/);
});
