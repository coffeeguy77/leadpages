'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  aggregateSupply,
  aggregateAllocation,
  variationLabelFromItem
} = require('../lib/order/supply');
const {
  buildPrintDocument,
  isAllowedFormat,
  normaliseFormat
} = require('../lib/order/print-document');

function sampleOrders() {
  return [
    {
      id: 'o1',
      order_number: 'ORD-1',
      customer_name: 'Amy Adams',
      customer_phone: '0400000001',
      status: 'confirmed',
      is_important: true,
      customer_notes: 'Call on arrival',
      items: [
        {
          id: 'i1',
          product_id: 'p-ham',
          product_name: 'Christmas ham',
          product_sku: 'HAM',
          quantity: 1,
          requested_weight_kg: 4.5,
          notes: 'Glazed',
          packed: false,
          product_snapshot: {
            selected_options: [{ question: 'Finish', label: 'Glazed', value: 'glazed' }]
          }
        },
        {
          id: 'i2',
          product_id: 'p-turkey',
          product_name: 'Turkey',
          quantity: 1,
          requested_weight_kg: 5,
          packed: true,
          product_snapshot: { selected_options: [] }
        }
      ]
    },
    {
      id: 'o2',
      order_number: 'ORD-2',
      customer_name: 'Bob Brown',
      status: 'confirmed',
      items: [
        {
          id: 'i3',
          product_id: 'p-ham',
          product_name: 'Christmas ham',
          quantity: 2,
          requested_weight_kg: 8,
          packed: false,
          product_snapshot: {
            selected_options: [{ question: 'Finish', label: 'Plain', value: 'plain' }]
          }
        },
        {
          id: 'i4',
          product_id: 'p-ham',
          product_name: 'Christmas ham',
          quantity: 1,
          requested_weight_kg: 4,
          packed: true,
          product_snapshot: {
            selected_options: [{ question: 'Finish', label: 'Glazed', value: 'glazed' }]
          }
        }
      ]
    },
    {
      id: 'o3',
      order_number: 'ORD-X',
      customer_name: 'Cancelled',
      status: 'cancelled',
      items: [
        {
          id: 'i5',
          product_id: 'p-ham',
          product_name: 'Christmas ham',
          quantity: 99,
          packed: false,
          product_snapshot: { selected_options: [] }
        }
      ]
    }
  ];
}

test('variationLabelFromItem joins selected options', function () {
  assert.equal(
    variationLabelFromItem({
      product_snapshot: {
        selected_options: [{ question: 'Finish', label: 'Glazed' }]
      }
    }),
    'Finish: Glazed'
  );
  assert.equal(variationLabelFromItem({ product_snapshot: {} }), '');
});

test('aggregateSupply still totals by product only', function () {
  var lines = aggregateSupply(sampleOrders());
  var ham = lines.find(function (L) {
    return L.product_id === 'p-ham';
  });
  assert.ok(ham);
  assert.equal(ham.quantity, 4);
  assert.equal(ham.order_count, 3);
});

test('aggregateAllocation groups by product + variation with packing progress', function () {
  var out = aggregateAllocation(sampleOrders());
  assert.equal(out.totals.lines, 4);
  assert.equal(out.totals.packed, 2);
  assert.equal(out.groups.length, 3);

  var glazed = out.groups.find(function (g) {
    return g.product_id === 'p-ham' && /Glazed/.test(g.variation_label);
  });
  assert.ok(glazed);
  assert.equal(glazed.quantity, 2);
  assert.equal(glazed.line_count, 2);
  assert.equal(glazed.packed_count, 1);
  assert.equal(glazed.lines[0].customer_name, 'Amy Adams');
  assert.equal(glazed.lines[1].customer_name, 'Bob Brown');

  var plain = out.groups.find(function (g) {
    return /Plain/.test(g.variation_label);
  });
  assert.ok(plain);
  assert.equal(plain.line_count, 1);
});

test('allocation print format is allowed and renders checklist', function () {
  assert.equal(isAllowedFormat('allocation', false), true);
  assert.equal(normaliseFormat('allocation', false), 'allocation');
  var alloc = aggregateAllocation(sampleOrders());
  var html = buildPrintDocument({
    format: 'allocation',
    business: { business_name: 'Test Butcher' },
    pickup_date: '2026-12-24',
    supply: {
      allocations: alloc.groups,
      allocation_totals: alloc.totals
    },
    meta: { order_count: 2 }
  });
  assert.match(html, /Product allocation/);
  assert.match(html, /Christmas ham/);
  assert.match(html, /Glazed/);
  assert.match(html, /Amy Adams/);
  assert.match(html, /☑/);
});

test('nav and UI include Product Allocation', function () {
  const nav = fs.readFileSync(path.join(__dirname, '..', 'assets/lp-order-admin-nav.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  const ordersApi = fs.readFileSync(path.join(__dirname, '..', 'api/order/orders.js'), 'utf8');
  const migration = fs.readFileSync(
    path.join(__dirname, '..', 'db/migrations/20260825_order_item_packed.sql'),
    'utf8'
  );
  assert.match(nav, /Product Allocation/);
  assert.match(nav, /route: 'allocation'/);
  assert.match(html, /view-allocation/);
  assert.match(html, /loadAllocation/);
  assert.match(html, /set_item_packed/);
  assert.match(ordersApi, /set_item_packed/);
  assert.match(migration, /packed boolean/);
});
