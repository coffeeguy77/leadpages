'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  buildPrintDocument,
  isAllowedFormat,
  normaliseFormat,
  showImportantOnLabel
} = require('../lib/order/print-document');
const { qrSvg } = require('../lib/order/qr');

var sampleOrder = {
  id: 'o1',
  order_number: 'ORD-2026-00042',
  customer_name: 'Jane Smith',
  customer_phone: '0412345678',
  pickup_date: '2026-12-24',
  pickup_window_start: '09:00:00',
  pickup_window_end: '11:00:00',
  status: 'confirmed',
  is_important: true,
  important_meta: { show_on_labels: true, reason: 'VIP' },
  portal_url: 'https://leadpages.com.au/order-portal?t=test-token',
  portal_qr_svg: '<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88"><rect width="88" height="88"/></svg>',
  items: [
    {
      product_name: 'Christmas ham',
      quantity: 1,
      requested_weight_kg: 4.5,
      product_snapshot: { selected_options: [{ label: 'Glazed' }] }
    }
  ]
};

test('label formats are staff-only', function () {
  assert.equal(isAllowedFormat('label', false), true);
  assert.equal(isAllowedFormat('item_labels', false), true);
  assert.equal(isAllowedFormat('label', true), false);
  assert.equal(normaliseFormat('label', false), 'label');
  assert.equal(normaliseFormat('item_labels', true), 'receipt');
});

test('showImportantOnLabel respects show_on_labels flag', function () {
  assert.equal(showImportantOnLabel({ is_important: true }), true);
  assert.equal(showImportantOnLabel({ is_important: true, important_meta: {} }), true);
  assert.equal(
    showImportantOnLabel({ is_important: true, important_meta: { show_on_labels: false } }),
    false
  );
  assert.equal(showImportantOnLabel({ is_important: false }), false);
});

test('buildPrintDocument — order labels include QR sheet and Important', function () {
  var html = buildPrintDocument({
    format: 'label',
    business: { business_name: 'Test Butcher' },
    pickup_date: '2026-12-24',
    orders: [sampleOrder]
  });
  assert.match(html, /label-sheet/);
  assert.match(html, /label-sticker/);
  assert.match(html, /ORD-2026-00042/);
  assert.match(html, /Jane Smith/);
  assert.match(html, /Important/);
  assert.match(html, /VIP/);
  assert.match(html, /label-qr/);
  assert.match(html, /<svg/);
  assert.match(html, /Christmas ham/);
});

test('buildPrintDocument — item stickers one per line', function () {
  var ord = Object.assign({}, sampleOrder, {
    is_important: false,
    items: [
      { product_name: 'Ham', quantity: 1, requested_weight_kg: 4 },
      { product_name: 'Turkey', quantity: 1, requested_weight_kg: 5, notes: 'No stuffing' }
    ]
  });
  var html = buildPrintDocument({
    format: 'item_labels',
    business: { business_name: 'Test Butcher' },
    pickup_date: '2026-12-24',
    orders: [ord]
  });
  assert.match(html, /Item stickers/);
  assert.match(html, /Ham/);
  assert.match(html, /Turkey/);
  assert.match(html, /No stuffing/);
  var stickers = html.match(/class="label-sticker/g) || [];
  assert.equal(stickers.length, 2);
});

test('qrSvg returns SVG markup', async function () {
  var svg = await qrSvg('https://leadpages.com.au/order-portal?t=abc', { width: 64, margin: 0 });
  assert.match(svg, /^<svg/);
  assert.match(svg, /<\/svg>\s*$/);
});

test('nav and UI include Labels & Stickers', function () {
  const nav = fs.readFileSync(path.join(__dirname, '..', 'assets/lp-order-admin-nav.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  const printApi = fs.readFileSync(path.join(__dirname, '..', 'api/order/print.js'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.match(nav, /Labels & Stickers/);
  assert.match(nav, /route: 'labels'/);
  assert.match(html, /view-labels/);
  assert.match(html, /data-print="label"/);
  assert.match(html, /show_on_labels/);
  assert.match(printApi, /attachPortalQrToOrders/);
  assert.ok(pkg.dependencies && pkg.dependencies.qrcode);
});
