'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assertOrderItemsEditable, buildOrderItemRow } = require('../lib/order/order-item-build');

test('assertOrderItemsEditable allows active orders', function () {
  assert.doesNotThrow(function () {
    assertOrderItemsEditable({ status: 'confirmed' });
    assertOrderItemsEditable({ status: 'awaiting_deposit' });
    assertOrderItemsEditable({ status: 'locked' });
  });
});

test('assertOrderItemsEditable blocks closed orders', function () {
  ['cancelled', 'archived', 'completed', 'refunded'].forEach(function (status) {
    assert.throws(
      function () {
        assertOrderItemsEditable({ status: status });
      },
      function (err) {
        return err && err.message === 'order_not_editable';
      }
    );
  });
});

test('buildOrderItemRow prices fixed product', function () {
  const product = {
    id: 'p1',
    name: 'Pork sausages',
    pricing_method: 'fixed',
    price_cents: 1200,
    options: {}
  };
  const row = buildOrderItemRow(
    { product_id: 'p1', quantity: 2 },
    product,
    { id: 'site1' },
    { enabled: false },
    { p1: [] },
    0
  );
  assert.equal(row.product_name, 'Pork sausages');
  assert.equal(row.quantity, 2);
  assert.equal(row.line_known_cents, 2400);
});

test('orders.html includes edit-order item hooks', function () {
  const fs = require('fs');
  const path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  assert.match(html, /action: 'add_order_item'/);
  assert.match(html, /action: 'remove_order_item'/);
  assert.match(html, /data-om-product-search/);
  assert.match(html, /type="hidden" data-om-product-id/);
  assert.match(html, /resolveOmProduct/);
  assert.match(html, /data-remove-item/);
  // New picker (same rows as New order): per-row Add and stock piece chips
  assert.match(html, /data-om-add>Add<\/button>/);
  assert.match(html, /data-om-piece=/);
});

test('set_item_quantity: reprices from the stored price and scales the estimated weight', () => {
  const { quantityPatch } = require('../lib/order/order-item-mutations');
  const ham = { quantity: 1, pricing_method: 'per_weight', unit_price_cents: 3080, requested_weight_kg: 4, options_snapshot: { selected: [] } };
  const p = quantityPatch(ham, 3);
  assert.equal(p.quantity, 3);
  assert.equal(p.requested_weight_kg, 12);
  assert.equal(p.line_known_cents, 36960);
  assert.equal(p.actual_weight_kg, null);
  const fixed = { quantity: 2, pricing_method: 'fixed', unit_price_cents: 1250, options_snapshot: { selected: [{ price_cents: 250 }] } };
  assert.equal(quantityPatch(fixed, 5).line_known_cents, 6250);
  assert.throws(() => quantityPatch(fixed, 0), /bad_quantity/);
  const src = require('fs').readFileSync(require('path').join(__dirname, '../orders.html'), 'utf8');
  assert.match(src, /action: 'set_item_quantity'/);
  assert.match(src, /data-fast-wqty/);
  assert.match(src, /body\.requested_weight_kg = Math\.round\(kg \* wq \* 1000\) \/ 1000;/);
});
