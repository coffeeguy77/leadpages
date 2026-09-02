'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  productMatchesItem,
  collectProductSheetRows,
  groupProductSheetRowsByDate,
  summariseProductSearch
} = require('../lib/order/product-search');
const { buildPrintDocument } = require('../lib/order/print-document');

var orders = [
  {
    id: 'o1',
    order_number: 'ORD-100',
    customer_name: 'Alice',
    customer_phone: '0400111222',
    pickup_date: '2026-12-24',
    items: [
      {
        product_name: 'Turkey — bird size',
        quantity: 1,
        product_snapshot: { selected_options: [{ label: 'Buff basting' }] }
      },
      { product_name: 'Ham', quantity: 1 }
    ]
  },
  {
    id: 'o2',
    order_number: 'ORD-101',
    customer_name: 'Bob',
    customer_phone: '0400333444',
    pickup_date: '2026-12-25',
    items: [
      {
        product_name: 'Stuffed turkey roll',
        quantity: 2,
        options_snapshot: { selected: [{ question: 'Size', label: 'Large' }] }
      }
    ]
  }
];

test('productMatchesItem — partial matches turkey variants', function () {
  assert.equal(productMatchesItem(orders[0].items[0], 'turkey', 'partial'), true);
  assert.equal(productMatchesItem(orders[0].items[1], 'turkey', 'partial'), false);
  assert.equal(productMatchesItem(orders[1].items[0], 'turkey', 'partial'), true);
});

test('productMatchesItem — exact matches full product name only', function () {
  assert.equal(productMatchesItem(orders[1].items[0], 'stuffed turkey roll', 'exact'), true);
  assert.equal(productMatchesItem(orders[0].items[0], 'turkey', 'exact'), false);
});

test('collectProductSheetRows groups and sorts by date then order', function () {
  var rows = collectProductSheetRows(orders, 'turkey', 'partial');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].order.order_number, 'ORD-100');
  assert.equal(rows[1].order.order_number, 'ORD-101');
});

test('groupProductSheetRowsByDate splits range days', function () {
  var rows = collectProductSheetRows(orders, 'turkey', 'partial');
  var groups = groupProductSheetRowsByDate(rows);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].date, '2026-12-24');
  assert.equal(groups[1].date, '2026-12-25');
});

test('summariseProductSearch counts lines and orders', function () {
  var rows = collectProductSheetRows(orders, 'turkey', 'partial');
  var s = summariseProductSearch(rows);
  assert.equal(s.match_count, 2);
  assert.equal(s.order_count, 2);
  assert.deepEqual(s.dates, ['2026-12-24', '2026-12-25']);
});

test('buildPrintDocument — product_sheet includes options and day headings', function () {
  var rows = collectProductSheetRows(orders, 'turkey', 'partial');
  var groups = groupProductSheetRowsByDate(rows);
  var html = buildPrintDocument({
    format: 'product_sheet',
    business: { business_name: 'Griffith Butcher' },
    product_groups: groups,
    meta: {
      product_query: 'Turkey',
      product_mode: 'partial',
      match_count: 2,
      order_count: 2,
      show_date_heading: true
    }
  });
  assert.match(html, /Product sheet — Turkey/);
  assert.match(html, /ORD-100/);
  assert.match(html, /ORD-101/);
  assert.match(html, /Alice/);
  assert.match(html, /0400111222/);
  assert.match(html, /Buff basting/);
  assert.match(html, /Large/);
  assert.match(html, /day-head/);
  assert.match(html, /Stuffed turkey roll/);
});
