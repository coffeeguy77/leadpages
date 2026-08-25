'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  classifyOrderExceptions,
  filterExceptionOrders,
  orderIsException,
  importantTypeLabel,
  importantColourHex,
  IMPORTANT_TYPES
} = require('../lib/order/exceptions');
const {
  buildPrintDocument,
  isAllowedFormat,
  normaliseFormat,
  showImportantOnLabel
} = require('../lib/order/print-document');

test('procurement and exceptions are staff-only print formats', function () {
  assert.equal(isAllowedFormat('procurement', false), true);
  assert.equal(isAllowedFormat('exceptions', false), true);
  assert.equal(isAllowedFormat('procurement', true), false);
  assert.equal(isAllowedFormat('exceptions', true), false);
  assert.equal(normaliseFormat('procurement', false), 'procurement');
  assert.equal(normaliseFormat('exceptions', false), 'exceptions');
  assert.equal(normaliseFormat('procurement', true), 'receipt');
});

test('classifyOrderExceptions flags important, notes, unpaid, price and weight TBC', function () {
  var c = classifyOrderExceptions({
    status: 'confirmed',
    is_important: true,
    important_meta: { type: 'allergy', reason: 'nuts', colour: 'red' },
    customer_notes: 'Leave at door',
    deposit_required_cents: 5000,
    deposit_paid_cents: 0,
    has_unknown_prices: true,
    items: [
      {
        pricing_method: 'per_weight',
        price_status: 'pending_weight',
        actual_weight_kg: null
      }
    ]
  });
  assert.deepEqual(c.flags.sort(), ['important', 'notes', 'price_tbc', 'unpaid', 'weight_tbc'].sort());
  assert.ok(c.reasons.some(function (r) {
    return /Allergy/.test(r);
  }));
  assert.equal(importantTypeLabel({ important_meta: { type: 'allergy' } }), 'Allergy / dietary');
  assert.equal(importantColourHex({ important_meta: { colour: 'red' } }), '#b42318');
});

test('filterExceptionOrders supports all / exceptions / flag filters', function () {
  var orders = [
    { id: '1', status: 'confirmed', is_important: true, important_meta: { type: 'vip' } },
    { id: '2', status: 'confirmed', customer_notes: 'Extra gravy' },
    { id: '3', status: 'confirmed', deposit_required_cents: 1000, deposit_paid_cents: 1000 },
    { id: '4', status: 'cancelled', is_important: true },
    { id: '5', status: 'awaiting_deposit', deposit_required_cents: 2000, deposit_paid_cents: 0 }
  ];
  assert.equal(filterExceptionOrders(orders, 'all').length, 4);
  assert.equal(filterExceptionOrders(orders, 'exceptions').length, 3);
  assert.equal(filterExceptionOrders(orders, 'important').map(function (o) { return o.id; }).join(','), '1');
  assert.equal(filterExceptionOrders(orders, 'notes').map(function (o) { return o.id; }).join(','), '2');
  assert.equal(filterExceptionOrders(orders, 'unpaid').map(function (o) { return o.id; }).join(','), '5');
  assert.equal(orderIsException(orders[2]), false);
});

test('IMPORTANT_TYPES covers staff-facing categories', function () {
  var ids = IMPORTANT_TYPES.map(function (t) { return t.id; });
  assert.ok(ids.indexOf('vip') >= 0);
  assert.ok(ids.indexOf('allergy') >= 0);
  assert.ok(ids.indexOf('staff_attention') >= 0);
});

test('buildPrintDocument — procurement checklist', function () {
  var html = buildPrintDocument({
    format: 'procurement',
    business: { business_name: 'Test Butcher' },
    pickup_date: '2026-12-24',
    supply: {
      lines: [
        {
          product_name: 'Christmas ham',
          product_sku: 'HAM-1',
          order_count: 3,
          quantity: 3,
          unit_label: 'ea',
          has_weight: true,
          requested_weight_kg: 12.5
        }
      ]
    },
    meta: { order_count: 3 }
  });
  assert.match(html, /Procurement checklist/);
  assert.match(html, /Christmas ham/);
  assert.match(html, /products to source/);
  assert.match(html, /Buy qty/);
  assert.match(html, /chk/);
});

test('buildPrintDocument — exceptions list', function () {
  var html = buildPrintDocument({
    format: 'exceptions',
    business: { business_name: 'Test Butcher' },
    pickup_date: '2026-12-24',
    orders: [
      {
        order_number: 'ORD-1',
        status: 'confirmed',
        customer_name: 'Jane',
        customer_notes: 'Call first',
        pickup_window_start: '09:00:00',
        pickup_window_end: '11:00:00',
        is_important: true,
        important_meta: { type: 'vip', reason: 'Regular' },
        deposit_required_cents: 5000,
        deposit_paid_cents: 0
      },
      {
        order_number: 'ORD-2',
        status: 'confirmed',
        customer_name: 'Plain',
        deposit_required_cents: 0,
        deposit_paid_cents: 0
      }
    ]
  });
  assert.match(html, /Exceptions/);
  assert.match(html, /ORD-1/);
  assert.match(html, /Jane/);
  assert.match(html, /VIP|vip/i);
  assert.doesNotMatch(html, /ORD-2/);
});

test('labels use importance type colour and reason', function () {
  var order = {
    order_number: 'ORD-9',
    customer_name: 'Sam',
    pickup_date: '2026-12-24',
    is_important: true,
    important_meta: { type: 'fragile', colour: 'purple', reason: 'Handle gently', show_on_labels: true },
    items: [{ product_name: 'Cake', quantity: 1 }]
  };
  assert.equal(showImportantOnLabel(order), true);
  var html = buildPrintDocument({
    format: 'label',
    business: { business_name: 'Test' },
    pickup_date: '2026-12-24',
    orders: [order]
  });
  assert.match(html, /Fragile/);
  assert.match(html, /Handle gently/);
  assert.match(html, /#6941c6/);
});

test('orders.html wires Phase 6 filters, prints, and importance editor', function () {
  var html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  assert.match(html, /id="pd-print-exceptions"/);
  assert.match(html, /id="supply-print-buy"/);
  assert.match(html, /data-pd-filter="exceptions"/);
  assert.match(html, /data-pd-filter="price_tbc"/);
  assert.match(html, /format=exceptions/);
  assert.match(html, /supplyPrint\('procurement'\)/);
  assert.match(html, /id="om-imp-type"/);
  assert.match(html, /id="om-save-important"/);
  assert.match(html, /saveOrderImportance/);
  assert.match(html, /function orderDepositPayLabel/);
  assert.match(html, /pdFilter:\s*'all'/);
});
