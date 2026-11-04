'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const PO = require('../lib/order/price-override');

const ham = (extra) => Object.assign({
  id: 'i1', product_name: 'HAM - Half 4-4.5', pricing_method: 'per_weight', quantity: 1,
  unit_price_cents: 3080, price_status: 'tbc', line_known_cents: null, line_final_cents: null,
  options_snapshot: { selected: [{ key: 'glazing', question: 'Glazing', label: 'Glazed', price_cents: 975 }] }
}, extra || {});

test('sanitize: modes, values, optional reason', function () {
  assert.deepEqual(PO.sanitizeOverride({ mode: 'rate', rate_cents: '2700', reason: ' bulk ' }), { mode: 'rate', rate_cents: 2700, reason: 'bulk' });
  assert.deepEqual(PO.sanitizeOverride({ mode: 'fixed', line_cents: 90000 }), { mode: 'fixed', line_cents: 90000 });
  assert.deepEqual(PO.sanitizeOverride({ mode: 'percent', percent: 10 }), { mode: 'percent', percent: 10 });
  assert.throws(() => PO.sanitizeOverride({ mode: 'percent', percent: 0 }));
  assert.throws(() => PO.sanitizeOverride({ mode: 'percent', percent: 120 }));
  assert.throws(() => PO.sanitizeOverride({ mode: 'free' }));
  assert.throws(() => PO.sanitizeOverride({ mode: 'rate' }));
});

test('rate: new $/kg used before and after weighing, glaze kept', function () {
  const ov = { mode: 'rate', rate_cents: 2700, normal_unit_cents: 3080 };
  const unweighed = PO.overrideFields(ham({ price_override: ov }));
  assert.equal(unweighed.unit_price_cents, 2700);
  assert.equal(unweighed.price_status, 'tbc');
  // Weighed at 4.2 kg (finaliseWeightLine would have used the line's rate)
  const weighed = PO.overrideFields(ham({ price_override: ov, actual_weight_kg: 4.2, line_final_cents: 13911, price_status: 'finalised' }));
  assert.equal(weighed.line_final_cents, 11340 + 975);
  assert.equal(weighed.price_status, 'finalised');
});

test('rate is re-applied if something reset the line to the normal price', function () {
  const item = ham({ price_override: { mode: 'rate', rate_cents: 2700, normal_unit_cents: 3080 }, unit_price_cents: 3080, actual_weight_kg: 4, line_final_cents: 13295, price_status: 'finalised' });
  const p = PO.enforcePatch(item);
  assert.equal(p.unit_price_cents, 2700);
  assert.equal(p.line_final_cents, 10800 + 975);
  const fixedUp = Object.assign({}, item, p);
  assert.equal(PO.enforcePatch(fixedUp), null); // stable once applied
});

test('fixed: price for the line before and after weighing', function () {
  const ov = { mode: 'fixed', line_cents: 90000, normal_unit_cents: 3080 };
  const before = PO.overrideFields(ham({ price_override: ov, quantity: 6 }));
  assert.equal(before.line_known_cents, 90000);
  assert.equal(before.price_status, 'known');
  const after = PO.overrideFields(ham({ price_override: ov, quantity: 6, actual_weight_kg: 26.1, line_final_cents: 86238, price_status: 'finalised' }));
  assert.equal(after.line_final_cents, 90000);
  assert.equal(after.unit_price_cents, 3080);
});

test('percent: off the whole line incl. options, and idempotent', function () {
  const item = ham({ price_override: { mode: 'percent', percent: 10, normal_unit_cents: 3080 }, actual_weight_kg: 4, line_final_cents: 13295, price_status: 'finalised' });
  const p = PO.enforcePatch(item);
  assert.equal(p.line_final_cents, Math.round((12320 + 975) * 0.9));
  assert.equal(PO.enforcePatch(Object.assign({}, item, p)), null);
});

test('each items: rate × qty', function () {
  const pie = { id: 'p', product_name: 'Pie', pricing_method: 'per_unit', quantity: 12, unit_price_cents: 750, line_known_cents: 9000, price_status: 'known',
    price_override: { mode: 'rate', rate_cents: 600, normal_unit_cents: 750 } };
  const f = PO.overrideFields(pie);
  assert.equal(f.line_known_cents, 7200);
  assert.equal(PO.describe(pie).label, '$6.00 each');
  assert.equal(PO.describe(pie).normal_label, '$7.50 each');
});

test('no override: nothing changes', function () {
  assert.deepEqual(PO.overrideFields(ham()), {});
  assert.equal(PO.enforcePatch(ham()), null);
  assert.equal(PO.describe(ham()), null);
});

test('customer view: was price by setting, hidden per order', function () {
  const item = ham({ price_override: { mode: 'rate', rate_cents: 2700, normal_unit_cents: 3080 }, unit_price_cents: 2700, actual_weight_kg: 4, line_final_cents: 11775, price_status: 'finalised' });
  const shown = PO.customerView(item, PO.showWasPrice({ settings: {} }, {}));
  assert.equal(shown.price_label, '$27.00/kg');
  assert.equal(shown.was_rate_label, '$30.80/kg');
  assert.equal(shown.was_line_label, '$132.95');
  assert.equal(PO.showWasPrice({ settings: { price_display: { special_show_was: false } } }, {}), false);
  assert.equal(PO.showWasPrice({ settings: {} }, { hide_normal_price: true }), false);
  const hidden = PO.customerView(item, false);
  assert.equal(hidden.was_rate_label, null);
  assert.equal(hidden.was_line_label, null);
});

test('no normal line amount before weighing when no weight was asked for', function () {
  const ch = { id: 'c', product_name: 'Whole Chicken', pricing_method: 'per_weight', quantity: 2, unit_price_cents: 1970, price_status: 'known', line_known_cents: 4000,
    price_override: { mode: 'fixed', line_cents: 4000, normal_unit_cents: 1970 } };
  assert.equal(PO.normalLineCents(ch), null);
  assert.equal(PO.customerView(ch, true).was_line_label, null);
});
