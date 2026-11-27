// Cooking / Kitchen: minimum fee, words that mean cooked, kitchen board, charging existing lines.
const test = require('node:test');
const assert = require('node:assert');
const C = require('../lib/order/cooking');
const PO = require('../lib/order/product-options');
const P = require('../lib/order/pricing');

const SYS = { settings: { cooking: { rate_cents_per_kg: 950, min_on: true, min_cents: 2000, words: ['cooked', 'cook', 'glazed', 'glaze'] } } };
const SYS_NOMIN = { settings: { cooking: { rate_cents_per_kg: 950, min_on: false, min_cents: 2000 } } };

test('charge is the greater of kg × rate and the minimum (per unit)', () => {
  assert.strictEqual(C.cookingChargeCents(1.5, 950, 2000, 1), 2000);
  assert.strictEqual(C.cookingChargeCents(4, 950, 2000, 1), 3800);
  assert.strictEqual(C.cookingChargeCents(3, 950, 2000, 2), 4000);
  assert.strictEqual(C.cookingChargeCents(2, 950, 0, 1), 1900);
  assert.strictEqual(C.cookingChargeCents(null, 950, 2000, 1), 2000);
  assert.strictEqual(C.cookingChargeCents(null, 950, 0, 1), null);
  assert.strictEqual(C.cookingChargeCents(2, 0, 2000, 1), 0);
});

test('minimum can be switched off', () => {
  assert.strictEqual(C.cookingSettings(SYS).min_cents, 2000);
  assert.strictEqual(C.cookingSettings(SYS_NOMIN).min_cents, null);
});

test('cooked and glazed options are charged as cooking; seasoning is not', () => {
  const qs = [
    { key: 'cooking', label: 'cooking', options: [{ label: 'cooked', value: 'cooked', price_cents: 0 }] },
    { key: 'g', label: 'Glazing', options: [{ label: 'Glazed', value: 'Glazed', price_cents: 975 }] },
    { key: 's', label: 'seasoned/cooked', options: [{ label: 'porchetta seasoned', value: 'porchetta seasoned', price_cents: 0 }] }
  ];
  const ex = PO.optionExtrasPerUnitCents(qs, { cooking: 'cooked', g: 'Glazed', s: 'porchetta seasoned' }, C.cookingOpts(SYS));
  assert.strictEqual(ex.per_kg_cents, 950, 'one cooking charge per line');
  assert.strictEqual(ex.extra_cents, 0, 'the glaze flat price is replaced by cooking');
  assert.strictEqual(ex.cook_min_cents, 2000);
  assert.strictEqual(ex.selected[2].cooking, undefined, 'porchetta seasoned is not cooking');
});

test('weighed line: rate + cooking with the minimum', () => {
  const ex = { flat: 0, per_kg: 950, cook_min: 2000 };
  assert.strictEqual(P.priceLineAtOrder({ pricing_method: 'per_weight', price_per_kg_cents: 3000 }, 1, 1.5, ex, { ignoreSpecial: true }).lineKnownCents, 4500 + 2000);
  assert.strictEqual(P.priceLineAtOrder({ pricing_method: 'per_weight', price_per_kg_cents: 3000 }, 1, 4, ex, { ignoreSpecial: true }).lineKnownCents, 12000 + 3800);
  const item = { quantity: 1, unit_price_cents: 3000, options_snapshot: { selected: [{ cooking: true, per_kg_cents: 950, cook_min_cents: 2000 }] } };
  assert.strictEqual(P.finaliseWeightLine(item, 1.2, 3000).line_final_cents, 3600 + 2000);
});

test('existing "cooked" line gets charged; glaze flat price replaced', () => {
  const item = {
    id: 'a', quantity: 1, pricing_method: 'per_weight', price_status: 'tbc', unit_price_cents: 2999,
    requested_weight_kg: null, line_known_cents: 975, product_name: 'HAM - Half 3.5-4',
    options_snapshot: { selected: [{ key: 'glazing', question: 'Glazing', label: 'glazed', value: 'glazed', price_cents: 975 }] }
  };
  const p = C.chargeCookingPatch(item, SYS);
  const sel = p.options_snapshot.selected[0];
  assert.strictEqual(sel.cooking, true);
  assert.strictEqual(sel.per_kg_cents, 950);
  assert.strictEqual(sel.price_cents, 0);
  assert.strictEqual(sel.replaced_price_cents, 975);
  assert.strictEqual(p.line_known_cents, null);
  assert.strictEqual(C.chargeCookingPatch(Object.assign({}, item, p), SYS), null, 'second run changes nothing');
});

test('estimated line is repriced with cooking', () => {
  const item = {
    id: 'b', quantity: 1, pricing_method: 'per_weight', price_status: 'estimated', unit_price_cents: 4999,
    requested_weight_kg: 1.2, line_known_cents: 5999, product_name: 'BEEF - Girello Roast',
    options_snapshot: { selected: [{ key: 'cooking', question: 'cooking', label: 'cooked', value: 'cooked', price_cents: 0 }] }
  };
  const p = C.chargeCookingPatch(item, SYS);
  assert.strictEqual(p.line_known_cents, 5999 + 2000);
});

test('notes: "cooked turkey pls" flags the turkey line to check; "I don\'t need to cook" does not', () => {
  const s = C.cookingSettings(SYS);
  const order = { customer_notes: 'cooked turkey pls' };
  assert.strictEqual(C.itemCookInfo({ product_name: 'TURKEY - small roll', options_snapshot: { selected: [] } }, order, s).check, true);
  assert.strictEqual(C.itemCookInfo({ product_name: 'HAM - boned and rolled', options_snapshot: { selected: [] } }, order, s).check, false);
  const order2 = { customer_notes: 'Hi, I don’t need to cook and eat the turkey and ham until 28th Dec.' };
  assert.strictEqual(C.itemCookInfo({ product_name: 'TURKEY - Whole 9kg plus', options_snapshot: { selected: [] } }, order2, s).check, false);
  assert.strictEqual(C.itemCookInfo({ product_name: 'TURKEY - roll', notes: 'cooked', options_snapshot: { selected: [] } }, {}, s).check, true);
});

test('kitchen board groups a day by kind and size with kg, value and earliest pickup', () => {
  const orders = [
    { id: 'o1', order_number: 'ORD-1', pickup_date: '2026-12-24', pickup_time: '09:00:00', customer_name: 'A', items: [
      { id: 'i1', product_name: 'TURKEY - Small Roll (Stuffed) 1.5-2.5 kg', quantity: 1, options_snapshot: { selected: [{ label: 'Apricot', question: 'Stuffing' }, { label: 'Cooked', cooking: true, per_kg_cents: 950, cook_min_cents: 2000 }] } },
      { id: 'i2', product_name: 'HAM - Half 3.5-4', quantity: 1, options_snapshot: { selected: [{ label: 'Glazed', question: 'Glazing', price_cents: 975 }] } }
    ] },
    { id: 'o2', order_number: 'ORD-2', pickup_date: '2026-12-24', pickup_time: '07:30:00', customer_name: 'B', items: [
      { id: 'i3', product_name: 'TURKEY - Small Roll (Stuffed) 1.5-2.5 kg', quantity: 1, kitchen: { done: true }, options_snapshot: { selected: [{ label: 'Cooked', cooking: true, per_kg_cents: 950, cook_min_cents: 2000 }] } }
    ] }
  ];
  const sys = { settings: { cooking: { rate_cents_per_kg: 950, min_on: true, min_cents: 2000, minutes_per_kg: { turkey: 40 } } } };
  const b = C.buildKitchenBoard(orders, sys, { today: '2026-12-20' });
  assert.strictEqual(b.days.length, 1);
  const d = b.days[0];
  assert.strictEqual(d.summary.units, 3);
  assert.strictEqual(d.summary.done, 1);
  assert.strictEqual(d.summary.earliest_pickup, '07:30');
  const turkey = d.summary.kinds.find((k) => k.kind === 'Turkey');
  assert.strictEqual(turkey.units, 2);
  assert.strictEqual(turkey.variants[0].options[0].label, 'Apricot');
  assert.strictEqual(d.items[0].order_number, 'ORD-2', 'sorted by pickup time');
  assert.strictEqual(d.items[0].weight_kg, 2, 'middle of 1.5–2.5 kg');
  assert.strictEqual(d.items[0].oven_by, '05:40', '07:30 − (2 kg × 40 min + 30 min)');
  assert.strictEqual(d.items[0].cooking_value_cents, 2000);
});

test('Kitchen is wired into Order Operations', () => {
  const fs = require('fs');
  const path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  assert.match(html, /id="view-kitchen" data-view="kitchen"/);
  assert.match(html, /<script src="\/assets\/lp-order-kitchen\.js\?v=\d+" defer><\/script>/);
  assert.match(html, /window\.LpKitchenHost = \{/);
  assert.match(html, /v === 'kitchen'/);
  assert.match(html, /id="set-cook-min-on"/);
  assert.match(html, /id="orders-cooked"/);
  const nav = require('../assets/lp-order-admin-nav.js');
  assert.strictEqual(nav.routeMeta('kitchen').view, 'kitchen');
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'api/order/kitchen.js'), 'utf8'), /action === 'apply_charges'/);
});

test('without a saved word list only flagged options are charged (other shops unchanged)', () => {
  const sys = { settings: { cooking: { rate_cents_per_kg: 950 } } };
  const qs = [{ key: 'g', label: 'Glazing', options: [{ label: 'Glazed', value: 'Glazed', price_cents: 975 }] }];
  const ex = PO.optionExtrasPerUnitCents(qs, { g: 'Glazed' }, C.cookingOpts(sys));
  assert.strictEqual(ex.per_kg_cents, 0);
  assert.strictEqual(ex.extra_cents, 975);
});

test('weighing charges cooking on lines ordered before the cooking rules', () => {
  const item = {
    id: 'w', quantity: 1, pricing_method: 'per_weight', price_status: 'tbc', unit_price_cents: 2999,
    product_name: 'HAM - Half 4-4.5', line_known_cents: 975,
    options_snapshot: { selected: [{ key: 'glazing', question: 'Glazing', label: 'Glazed', value: 'Glazed', price_cents: 975 }] }
  };
  const flagged = C.withCookingFlags(item, SYS);
  const fin = P.finaliseWeightLine(flagged, 4.2, 2999);
  // 4.2 kg × $29.99 = $125.96; cooking 4.2 × $9.50 = $39.90 (over the $20 minimum); no flat glaze price.
  assert.strictEqual(fin.line_final_cents, Math.round(4.2 * 2999) + Math.round(4.2 * 950));
});

test('collected / completed needs every weighed line weighed; fixed-price lines don\'t', () => {
  const lines = [
    { product_name: 'HAM - Half', pricing_method: 'per_weight', price_status: 'tbc' },
    { product_name: 'Pie', pricing_method: 'fixed', price_status: 'fixed' },
    { product_name: 'TURKEY', pricing_method: 'per_weight', price_status: 'finalised' },
    { product_name: 'PORK', pricing_method: 'price_tbc', price_status: 'estimated' }
  ];
  assert.deepStrictEqual(C.linesMissingWeight(lines).map((l) => l.product_name), ['HAM - Half', 'PORK']);
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'api/order/orders.js'), 'utf8');
  assert.match(src, /body\.status === 'collected' \|\| body\.status === 'completed'/);
});
