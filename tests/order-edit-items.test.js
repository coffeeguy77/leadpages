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

test('pieceWeights pads to quantity and treats a single weighed piece as piece 1', function () {
  const { pieceWeights } = require('../lib/order/order-item-mutations');
  assert.deepEqual(pieceWeights({ quantity: 3, options_snapshot: { piece_weights: [4.1, null] } }), [4.1, null, null]);
  assert.deepEqual(pieceWeights({ quantity: 2, options_snapshot: { piece_weights: [4.1234, '', -1, 9] } }), [4.123, null]);
  assert.deepEqual(pieceWeights({ quantity: 1, actual_weight_kg: 4.4, options_snapshot: {} }), [4.4]);
  assert.deepEqual(pieceWeights({ quantity: 2, actual_weight_kg: 8.4, options_snapshot: {} }), [null, null]);
});

test('patchForWeights keeps the estimate until every piece is weighed, then finalises', function () {
  const { patchForWeights } = require('../lib/order/order-item-mutations');
  const ham = { quantity: 3, pricing_method: 'per_weight', unit_price_cents: 3080, requested_weight_kg: 12, options_snapshot: { selected: [] } };
  const part = patchForWeights(ham, [4.1, null, 4.2]);
  assert.equal(part.quantity, 3);
  assert.notEqual(part.price_status, 'finalised');
  assert.equal(part.actual_weight_kg, null);
  assert.deepEqual(part.options_snapshot.piece_weights, [4.1, null, 4.2]);
  assert.deepEqual(part.options_snapshot.selected, []);
  const full = patchForWeights(ham, [4.1, 4.3, 4.2]);
  assert.equal(full.price_status, 'finalised');
  assert.equal(full.actual_weight_kg, 12.6);
  assert.equal(full.line_final_cents, 38808);
  const none = patchForWeights(Object.assign({}, ham, { options_snapshot: { piece_weights: [4.1] } }), [null, null]);
  assert.equal('piece_weights' in none.options_snapshot, false);
  assert.equal(none.quantity, 2);
});

test('reducing below the weighed pieces asks staff to choose which to remove', function () {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../lib/order/order-item-mutations.js'), 'utf8');
  assert.match(src, /if \(q < filled\.length\) throw Object\.assign\(new Error\('choose_pieces_to_remove'\), \{ code: 409 \}\)/);
  assert.match(src, /if \(q < ctx\.pieces\.length\) throw Object\.assign\(new Error\('choose_pieces_to_remove'\), \{ code: 409 \}\)/);
  const api = require('fs').readFileSync(require('path').join(__dirname, '../api/order/orders.js'), 'utf8');
  assert.match(api, /action === 'set_piece_weight' \|\| action === 'remove_piece'/);
  const html = require('fs').readFileSync(require('path').join(__dirname, '../orders.html'), 'utf8');
  assert.match(html, /if \(code === 'choose_pieces_to_remove'\) \{ odSetExpanded/);
  assert.match(html, /data-pc-pick/);
  assert.match(html, /data-pieces-toggle/);
});
