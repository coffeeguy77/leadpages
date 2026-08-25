'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  buildPrintFingerprint,
  isSnapshotFormat,
  SNAPSHOT_FORMATS
} = require('../lib/order/print-fingerprint');

function sampleOrders() {
  return [
    {
      id: 'o1',
      order_number: 'ORD-1',
      status: 'confirmed',
      customer_name: 'Amy',
      customer_phone: '0400000001',
      pickup_window_start: '09:00:00',
      pickup_window_end: '11:00:00',
      customer_notes: '',
      internal_notes: 'staff only',
      is_important: false,
      items: [
        {
          id: 'i1',
          product_id: 'p1',
          product_name: 'Ham',
          quantity: 1,
          requested_weight_kg: 4,
          notes: '',
          packed: false,
          product_snapshot: { selected_options: [{ label: 'Glazed' }] }
        }
      ]
    },
    {
      id: 'o2',
      order_number: 'ORD-2',
      status: 'confirmed',
      customer_name: 'Bob',
      pickup_window_start: '14:00:00',
      pickup_window_end: '16:00:00',
      items: [
        {
          id: 'i2',
          product_id: 'p1',
          product_name: 'Ham',
          quantity: 2,
          requested_weight_kg: 8,
          packed: true,
          product_snapshot: { selected_options: [{ label: 'Plain' }] }
        }
      ]
    }
  ];
}

test('SNAPSHOT_FORMATS lists staff date reports', function () {
  assert.ok(isSnapshotFormat('day_run'));
  assert.ok(isSnapshotFormat('allocation'));
  assert.equal(isSnapshotFormat('slip'), false);
  assert.ok(SNAPSHOT_FORMATS.indexOf('prep') >= 0);
});

test('day_run fingerprint is stable and changes when qty changes', function () {
  var a = buildPrintFingerprint('day_run', { orders: sampleOrders() });
  var b = buildPrintFingerprint('day_run', { orders: sampleOrders() });
  assert.equal(a.fingerprint, b.fingerprint);
  assert.equal(a.order_count, 2);

  var changed = sampleOrders();
  changed[0].items[0].quantity = 9;
  var c = buildPrintFingerprint('day_run', { orders: changed });
  assert.notEqual(a.fingerprint, c.fingerprint);
});

test('allocation fingerprint ignores packed flags', function () {
  var supply = {
    allocations: [
      {
        product_id: 'p1',
        product_name: 'Ham',
        variation_label: 'Glazed',
        quantity: 1,
        lines: [
          {
            order_item_id: 'i1',
            order_number: 'ORD-1',
            customer_name: 'Amy',
            quantity: 1,
            packed: false,
            notes: '',
            is_important: false
          }
        ]
      }
    ]
  };
  var a = buildPrintFingerprint('allocation', { orders: sampleOrders(), supply: supply });
  supply.allocations[0].lines[0].packed = true;
  var b = buildPrintFingerprint('allocation', { orders: sampleOrders(), supply: supply });
  assert.equal(a.fingerprint, b.fingerprint);

  supply.allocations[0].lines[0].quantity = 3;
  var c = buildPrintFingerprint('allocation', { orders: sampleOrders(), supply: supply });
  assert.notEqual(a.fingerprint, c.fingerprint);
});

test('prep fingerprint uses supply lines', function () {
  var supply = {
    lines: [
      { product_id: 'p1', product_name: 'Ham', quantity: 3, requested_weight_kg: 12, order_count: 2 }
    ]
  };
  var a = buildPrintFingerprint('prep', { orders: sampleOrders(), supply: supply });
  assert.equal(a.line_count, 1);
  supply.lines[0].quantity = 99;
  var b = buildPrintFingerprint('prep', { orders: sampleOrders(), supply: supply });
  assert.notEqual(a.fingerprint, b.fingerprint);
});

test('UI and API wire print snapshots', function () {
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  const api = fs.readFileSync(path.join(__dirname, '..', 'api/order/print-snapshots.js'), 'utf8');
  const migration = fs.readFileSync(
    path.join(__dirname, '..', 'db/migrations/20260825_order_print_snapshots.sql'),
    'utf8'
  );
  assert.match(html, /pd-print-status/);
  assert.match(html, /supply-print-status/);
  assert.match(html, /alloc-print-status/);
  assert.match(html, /recordPrintSnapshot/);
  assert.match(html, /loadPrintSnapshotStatus/);
  assert.match(api, /action === 'record'/);
  assert.match(migration, /order_print_snapshots/);
});
