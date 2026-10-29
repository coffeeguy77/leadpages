'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCustomerCopy } = require('../lib/order/customer-copy');

const order = {
  id: 'o1', order_number: 'ORD-2026-00058', status: 'confirmed', created_at: '2026-10-29T02:40:00Z',
  pickup_date: '2026-12-23', customer_name: 'Jo Citizen', customer_phone: '0400 000 000',
  deposit_required_cents: 5000, deposit_paid_cents: 5000, known_subtotal_cents: 0, has_unknown_prices: true
};
const items = [
  { id: 'i1', product_name: 'HAM - Half 4-4.5', pricing_method: 'per_weight', unit_price_cents: 1970, quantity: 1, price_status: 'tbc', options_snapshot: { selected: [{ key: 'glazing', question: 'Glazing', label: 'Glazed', price_cents: 975 }] } },
  { id: 'i2', product_name: 'PORK - Loin Roast B/R', pricing_method: 'per_weight', unit_price_cents: 2499, quantity: 1, requested_weight_kg: 3, price_status: 'estimated', line_known_cents: 7497,
    options_snapshot: { selected: [{ key: 'seasoned', question: 'seasoned', label: 'porchetta seasoning', value: 'porchetta seasoning' }] } }
];
const answers = [{ order_item_id: 'i2', question_key: 'seasoned', question_label: 'seasoned', value: 'porchetta seasoning' }];
const payments = [{ id: 'p1', order_id: 'o1', status: 'paid', amount_cents: 5000, provider: 'eftpos', paid_at: '2026-10-29T02:41:00Z', created_at: '2026-10-29T02:41:00Z', meta: { method: 'eftpos' } }];

test('customer copy has the docket content, options once, payments and pickup', function () {
  const html = buildCustomerCopy({ system: { settings: {} }, order, items, answer_rows: answers, payments, business: { business_name: 'Test Butcher', phone: '02 0000 0000' } });
  assert.match(html, /ORD-2026-00058/);
  assert.match(html, /PICK UP DATE:/);
  assert.match(html, /Wednesday/);
  assert.match(html, /Citizen/);
  assert.match(html, /Glazing: Glazed/);
  assert.equal((html.match(/porchetta seasoning/g) || []).length, 1);
  assert.match(html, /EFTPOS/);
  assert.match(html, /\$50\.00/);
  assert.match(html, /est\.<\/span> \$/); // range for the sized ham
  assert.match(html, /size:A4/);
});

test('80mm docket and kg-only display', function () {
  const html = buildCustomerCopy({ system: { settings: { price_display: { kg_only: true } } }, order, items, answer_rows: answers, payments, size: '80mm' });
  assert.match(html, /size:80mm/);
  assert.doesNotMatch(html, /est\./);
  assert.match(html, /\$19\.70\/kg/);
  assert.match(html, /when weighed/);
});

test('an option named like its question still shows, once', function () {
  const it = [{ id: 'c1', product_name: 'Whole Chicken', pricing_method: 'per_weight', unit_price_cents: 1970, quantity: 1, price_status: 'tbc',
    options_snapshot: { selected: [
      { key: 'stuffings', question: 'Stuffings', label: 'Apricot' },
      { key: 'boned_and_rolled', question: 'Boned and Rolled', label: 'Boned and Rolled' }
    ] } }];
  const ans = [{ order_item_id: 'c1', question_key: 'boned_and_rolled', question_label: 'Boned and Rolled', value: 'Boned and Rolled' }];
  const html = buildCustomerCopy({ system: { settings: {} }, order, items: it, answer_rows: ans, payments: [] });
  assert.match(html, /Stuffings: Apricot · Boned and Rolled</);
});
