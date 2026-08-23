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
  assert.match(html, /data-remove-item/);
  assert.match(html, /om-add-item-btn/);
});
