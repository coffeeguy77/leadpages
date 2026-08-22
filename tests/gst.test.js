'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseGstSettings,
  productHasGst,
  gstFromInclusiveCents,
  orderGstSummary,
  gstPriceSuffix
} = require('../lib/order/gst');

test('parseGstSettings reads category ids', function () {
  var s = parseGstSettings({
    settings: { gst: { category_ids: ['a', 'b'], enabled: true } }
  });
  assert.deepEqual(s.category_ids, ['a', 'b']);
  assert.equal(s.enabled, true);
});

test('productHasGst — primary category', function () {
  var gst = { enabled: true, category_ids: ['pies'] };
  assert.equal(productHasGst({ category_id: 'pies' }, gst), true);
  assert.equal(productHasGst({ category_id: 'beef' }, gst), false);
});

test('productHasGst — additional category', function () {
  var gst = { enabled: true, category_ids: ['pies'] };
  assert.equal(
    productHasGst({ category_id: 'lamb', options: { additional_category_ids: ['pies'] } }, gst),
    true
  );
});

test('gstFromInclusiveCents extracts 10% component', function () {
  assert.equal(gstFromInclusiveCents(1100), 100);
  assert.equal(gstFromInclusiveCents(0), 0);
});

test('orderGstSummary sums GST lines only', function () {
  var sum = orderGstSummary([
    { line_known_cents: 1100, product_snapshot: { includes_gst: true } },
    { line_known_cents: 5000, product_snapshot: { includes_gst: false } }
  ]);
  assert.equal(sum.gst_included_cents, 100);
  assert.equal(sum.gst_line_count, 1);
});

test('gstPriceSuffix', function () {
  assert.equal(gstPriceSuffix(true), ' inc. GST');
  assert.equal(gstPriceSuffix(false), '');
});
