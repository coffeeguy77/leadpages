'use strict';

/** Cooking rate: per-kg option charge, range before weighing, exact when weighed, GST inside. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const PO = require('../lib/order/product-options');
const P = require('../lib/order/pricing');
const G = require('../lib/order/gst');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const SYS = { settings: { cooking: { rate_cents_per_kg: 950 } } };
const COOK_Q = [{ key: 'cooking', label: 'Cooking', field_type: 'radio', options: [{ label: 'Cooked', value: 'Cooked', cooking: true, price_cents: 500 }] }];
const GLAZE_Q = [{ key: 'glazing', label: 'Glazing', field_type: 'radio', options: [{ label: 'Glazed', value: 'Glazed', price_cents: 975 }] }];

test('a cooking choice is charged per kg at the shop rate (flat price ignored)', () => {
  assert.equal(PO.cookingRateCents(SYS), 950);
  assert.equal(PO.cookingRateCents({ settings: {} }), null);
  assert.deepEqual(PO.normaliseChoice({ label: 'Cooked', cooking: true, price_cents: 500 }), { label: 'Cooked', value: 'Cooked', price_cents: 0, cooking: true });
  const ex = PO.optionExtrasPerUnitCents(COOK_Q.concat(GLAZE_Q), { cooking: 'Cooked', glazing: 'Glazed' }, { cooking_rate_cents: 950 });
  assert.equal(ex.per_kg_cents, 950);
  assert.equal(ex.extra_cents, 975);
  const cook = ex.selected.find((s) => s.cooking);
  assert.equal(cook.per_kg_cents, 950);
  assert.equal(cook.gst_inclusive, true);
  // not chosen → nothing
  assert.equal(PO.optionExtrasPerUnitCents(COOK_Q, {}, { cooking_rate_cents: 950 }).per_kg_cents, 0);
  // display: choices show the live rate
  assert.equal(PO.withCookingRate(COOK_Q, SYS)[0].options[0].per_kg_cents, 950);
});

test('3–4 kg ham: cooking est. $28.50–$38.00; weighed at 3.6 kg = $34.20', () => {
  const r = P.estimateRange({ name: 'HAM - Half 3-4KG', pricing_method: 'per_weight', rate_cents: 3080, quantity: 1, extras: { flat: 0, per_kg: 950 } });
  assert.equal(r.per_kg_extra_low_cents, 2850);
  assert.equal(r.per_kg_extra_high_cents, 3800);
  assert.equal(r.low_cents, 3 * 3080 + 2850);
  assert.equal(r.high_cents, 4 * 3080 + 3800);
  const item = {
    quantity: 1, pricing_method: 'per_weight', unit_price_cents: 3080, price_status: 'tbc',
    options_snapshot: { selected: [{ label: 'Cooked', per_kg_cents: 950, cooking: true, gst_inclusive: true }, { label: 'Glazed', price_cents: 975 }] }
  };
  const fin = P.finaliseWeightLine(item, 3.6, 3080);
  assert.equal(fin.line_final_cents, 11088 + 3420 + 975); // meat + cooking $34.20 + glaze kept
  assert.equal(P.lineCookingCents(Object.assign({}, item, { actual_weight_kg: 3.6 })), 3420);
  // a weighed line has no range
  assert.equal(P.lineEstimateRange(Object.assign({}, item, { product_name: 'HAM - Half 3-4KG', actual_weight_kg: 3.6 })), null);
  assert.ok(P.lineEstimateRange(Object.assign({}, item, { product_name: 'HAM - Half 3-4KG' })));
});

test('price at order time includes cooking on a known weight', () => {
  const priced = P.priceLineAtOrder({ pricing_method: 'per_weight', price_per_kg_cents: 3080 }, 1, 3.6, { flat: 975, per_kg: 950 });
  assert.equal(priced.lineKnownCents, 11088 + 3420 + 975);
  // old callers passing a number still work
  assert.equal(P.priceLineAtOrder({ pricing_method: 'per_weight', price_per_kg_cents: 3080 }, 1, 1, 100).lineKnownCents, 3180);
  const { buildOrderItemRow } = require('../lib/order/order-item-build');
  const prod = { id: 'h', name: 'HAM - Half 3.5-4', pricing_method: 'per_weight', price_per_kg_cents: 3080, options: { size_mode: 'each' } };
  const row = buildOrderItemRow({ product_id: 'h', quantity: 1, answers: { cooking: 'Cooked' } }, prod, { id: 's' }, { enabled: false, category_ids: [] }, { h: COOK_Q }, 0, { cooking_rate_cents: 950 });
  assert.equal(row.price_status, 'tbc'); // count-only ham: priced when weighed
  assert.equal(row.options_snapshot.selected[0].per_kg_cents, 950); // rate locked on the line
});

test('GST: the cooking part carries GST even when the meat is GST-free', () => {
  const it = { product_snapshot: { includes_gst: false }, actual_weight_kg: 3.6, line_final_cents: 14508,
    options_snapshot: { selected: [{ per_kg_cents: 950, gst_inclusive: true }] } };
  assert.equal(G.lineGstCents(it), Math.round(3420 / 11));
  assert.equal(G.lineGstCents(Object.assign({}, it, { options_snapshot: {} })), 0);
});

test('stock pieces and screens pick up cooking', () => {
  const stock = require('../lib/order/stock');
  const p = stock.linePatchForPieces({ quantity: 1, pricing_method: 'per_weight', unit_price_cents: 3080, options_snapshot: { selected: [{ per_kg_cents: 950 }] } }, [{ weight_kg: 3.6 }]);
  assert.equal(p.line_final_cents, 11088 + 3420);
  const html = read('orders.html');
  assert.match(html, /id="set-cook-rate"/);
  assert.match(html, /data-oc="cooking"/);
  assert.match(html, /rate_cents_per_kg: \$\('set-cook-rate'\)/);
  assert.match(read('assets/lp-order-storefront.js'), /OrderStorefront\.prototype\.rangeHtml = function/);
  assert.match(read('order-portal.html'), /Includes cooking /);
});
