'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const PD = require('../lib/order/price-display');

const on = { settings: { price_display: { kg_only: true } } };
const off = { settings: {} };

test('kg-only setting is off unless turned on', function () {
  assert.equal(PD.kgPricesOnly(off), false);
  assert.equal(PD.kgPricesOnly(null), false);
  assert.equal(PD.kgPricesOnly(on), true);
});

test('unweighed per-kg lines lose their estimate; weighed and fixed lines keep prices', function () {
  const items = [
    { id: 'range', pricing_method: 'per_weight', unit_price_cents: 1970, price_status: 'tbc', est_range: { low_cents: 6895, high_cents: 7880 }, cooking_cents: 3325 },
    { id: 'req', pricing_method: 'per_weight', unit_price_cents: 2499, price_status: 'estimated', requested_weight_kg: 3, line_known_cents: 7497 },
    { id: 'tbc', pricing_method: 'per_weight', unit_price_cents: 1500, price_status: 'tbc' },
    { id: 'weighed', pricing_method: 'per_weight', unit_price_cents: 1970, price_status: 'finalised', actual_weight_kg: 3.6, line_final_cents: 7092 },
    { id: 'fixed', pricing_method: 'fixed', unit_price_cents: 500, price_status: 'known', line_known_cents: 500 }
  ];
  assert.deepEqual(PD.applyKgOnly(off, items), items);
  const out = PD.applyKgOnly(on, items);
  const by = Object.fromEntries(out.map((x) => [x.id, x]));
  assert.equal(by.range.kg_only_rate, true);
  assert.equal(by.range.est_range, null);
  assert.equal(by.range.cooking_cents, null);
  assert.equal(by.req.kg_only_rate, true);
  assert.equal(by.tbc.kg_only_rate, true);
  assert.equal(by.weighed.kg_only_rate, undefined);
  assert.equal(by.weighed.line_final_cents, 7092);
  assert.equal(by.fixed.kg_only_rate, undefined);
});
