'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildPrintDocument,
  sortOrdersForPrint,
  pickupWindowLabel,
  isAllowedFormat,
  normaliseFormat,
  formatDateLabel
} = require('../lib/order/print-document');

var sampleOrder = {
  id: 'o1',
  order_number: 'ORD-2026-00042',
  customer_name: 'Jane Smith',
  customer_phone: '0412345678',
  fulfilment_type: 'pickup',
  pickup_date: '2026-12-24',
  pickup_window_start: '09:00:00',
  pickup_window_end: '11:00:00',
  status: 'confirmed',
  known_subtotal_cents: 12000,
  deposit_required_cents: 5000,
  deposit_paid_cents: 5000,
  balance_cents: 7000,
  has_unknown_prices: false,
  customer_notes: 'Please call on arrival'
};

var sampleItems = [
  {
    product_name: 'Christmas ham',
    quantity: 1,
    requested_weight_kg: 4.5,
    price_status: 'known',
    line_known_cents: 9000,
    product_snapshot: { selected_options: [{ label: 'Glazed', price_cents: 0 }] }
  },
  {
    product_name: 'Turkey',
    quantity: 1,
    requested_weight_kg: 5,
    price_status: 'tbc',
    pricing_method: 'per_weight',
    line_known_cents: null
  }
];

test('pickupWindowLabel formats window', function () {
  assert.equal(pickupWindowLabel(sampleOrder), '09:00–11:00');
});

test('formatDateLabel renders AU date', function () {
  var s = formatDateLabel('2026-12-24');
  assert.match(s, /24/);
  assert.match(s, /Dec/);
});

test('sortOrdersForPrint sorts by pickup window then name', function () {
  var sorted = sortOrdersForPrint([
    { customer_name: 'Zed', pickup_window_start: '14:00:00', pickup_window_end: '16:00:00' },
    { customer_name: 'Amy', pickup_window_start: '09:00:00', pickup_window_end: '11:00:00' },
    { customer_name: 'Bob', pickup_window_start: '09:00:00', pickup_window_end: '11:00:00' }
  ]);
  assert.equal(sorted[0].customer_name, 'Amy');
  assert.equal(sorted[1].customer_name, 'Bob');
  assert.equal(sorted[2].customer_name, 'Zed');
});

test('isAllowedFormat restricts customer formats', function () {
  assert.equal(isAllowedFormat('receipt', true), true);
  assert.equal(isAllowedFormat('slip', true), false);
  assert.equal(isAllowedFormat('day_run', false), true);
});

test('normaliseFormat falls back safely', function () {
  assert.equal(normaliseFormat('slip', true), 'receipt');
  assert.equal(normaliseFormat('bogus', false), 'slip');
});

test('buildPrintDocument — packing slip includes order and TBC highlight', function () {
  var html = buildPrintDocument({
    format: 'slip',
    business: { business_name: 'Test Butcher' },
    order: sampleOrder,
    items: sampleItems
  });
  assert.match(html, /ORD-2026-00042/);
  assert.match(html, /order-num-big/);
  assert.match(html, /Christmas ham/);
  assert.match(html, /Turkey/);
  assert.match(html, /TBC/);
  assert.match(html, /Glazed/);
  assert.match(html, /Please call on arrival/);
  assert.match(html, /Packing slip/);
});

test('buildPrintDocument — receipt shows totals and GST', function () {
  var itemsWithGst = sampleItems.slice();
  itemsWithGst[0] = Object.assign({}, itemsWithGst[0], {
    line_known_cents: 1100,
    product_snapshot: { includes_gst: true, selected_options: [] }
  });
  var html = buildPrintDocument({
    format: 'receipt',
    business: { business_name: 'Test Butcher' },
    order: sampleOrder,
    items: itemsWithGst
  });
  assert.match(html, /\$120\.00/);
  assert.match(html, /GST included/);
  assert.match(html, /Balance/);
});

test('buildPrintDocument — day run page breaks between orders', function () {
  var html = buildPrintDocument({
    format: 'day_run',
    business: { business_name: 'Test Butcher' },
    pickup_date: '2026-12-24',
    orders: [
      Object.assign({}, sampleOrder, { id: 'a', order_number: 'A-1', items: sampleItems }),
      Object.assign({}, sampleOrder, { id: 'b', order_number: 'B-2', customer_name: 'Other', items: [] })
    ]
  });
  assert.match(html, /A-1/);
  assert.match(html, /B-2/);
  assert.match(html, /page-break/);
});

test('buildPrintDocument — prep summary aggregates lines', function () {
  var html = buildPrintDocument({
    format: 'prep',
    business: { business_name: 'Test Butcher' },
    pickup_date: '2026-12-24',
    supply: {
      order_count: 3,
      lines: [
        { product_name: 'Ham', order_count: 2, quantity: 2, requested_weight_kg: 8, has_weight: true, unit_label: null }
      ]
    },
    meta: { order_count: 3, known_value_label: '$500.00' }
  });
  assert.match(html, /Prep summary/);
  assert.match(html, /Ham/);
  assert.match(html, /\$500\.00/);
});

test('buildPrintDocument — autoprint script when requested', function () {
  var html = buildPrintDocument({
    format: 'slip',
    order: sampleOrder,
    items: sampleItems,
    autoprint: true
  });
  assert.match(html, /window\.print/);
});
