'use strict';

/** Product specials: rules, pricing at order time, saving, and the shop/editor wiring. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { normaliseSpecial, specialInfo, applySpecial } = require('../lib/order/specials');
const { priceLineAtOrder } = require('../lib/order/pricing');
const { buildProductOptionsPatch } = require('../lib/order/product-options');
const { buildPortalCatalog } = require('../lib/order/portal-catalog');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const perKg = (special) => ({ pricing_method: 'per_weight', price_per_kg_cents: 5000, options: { special } });
const fixed = (special) => ({ pricing_method: 'fixed', price_cents: 2000, options: { special } });
// 10:00am Canberra time on these dates
const at = (ymd) => new Date(ymd + 'T10:00:00+11:00');

test('percent off: 10% of $50/kg saves $5/kg → $45/kg', () => {
  const info = specialInfo(perKg({ on: true, mode: 'percent', percent: 10 }));
  assert.equal(info.price_cents, 4500);
  assert.equal(info.was_cents, 5000);
  assert.equal(info.saving_cents, 500);
  assert.equal(info.percent, 10);
  assert.equal(info.per_kg, true);
});

test('set price: $15 instead of $20 is 25% off', () => {
  const info = specialInfo(fixed({ on: true, mode: 'price', price_cents: 1500 }));
  assert.equal(info.price_cents, 1500);
  assert.equal(info.saving_cents, 500);
  assert.equal(info.percent, 25);
  assert.equal(info.per_kg, false);
});

test('no special when off, not lower than the normal price, or no price', () => {
  assert.equal(specialInfo(fixed({ on: false, mode: 'price', price_cents: 1500 })), null);
  assert.equal(specialInfo(fixed({ on: true, mode: 'price', price_cents: 2000 })), null);
  assert.equal(specialInfo(fixed({ on: true, mode: 'price', price_cents: 2500 })), null);
  assert.equal(specialInfo(fixed({ on: true, mode: 'percent', percent: 0 })), null);
  assert.equal(specialInfo({ pricing_method: 'price_tbc', price_cents: null, options: { special: { on: true, mode: 'percent', percent: 10 } } }), null);
  assert.equal(specialInfo({ pricing_method: 'per_weight', price_per_kg_cents: null, options: { special: { on: true, mode: 'percent', percent: 10 } } }), null);
  assert.equal(specialInfo({ pricing_method: 'fixed', price_cents: 2000 }), null);
});

test('dates are whole days in Canberra time, end day included', () => {
  const sp = { on: true, mode: 'percent', percent: 10, timing: 'scheduled', start: '2026-11-01', end: '2026-11-15' };
  assert.equal(specialInfo(fixed(sp), { now: at('2026-10-31') }), null);
  assert.ok(specialInfo(fixed(sp), { now: at('2026-11-01') }));
  assert.ok(specialInfo(fixed(sp), { now: at('2026-11-15') }));
  assert.equal(specialInfo(fixed(sp), { now: at('2026-11-16') }), null);
  // 11:30pm on 15 Nov in Canberra is still 15 Nov there (12:30pm UTC)
  assert.ok(specialInfo(fixed(sp), { now: new Date('2026-11-15T12:30:00Z') }));
  // 12:30am on 16 Nov in Canberra (still 15 Nov in UTC) has ended
  assert.equal(specialInfo(fixed(sp), { now: new Date('2026-11-15T13:30:00Z') }), null);
  const until = { on: true, mode: 'price', price_cents: 1500, timing: 'until', end: '2026-10-31' };
  assert.ok(specialInfo(fixed(until), { now: at('2026-10-31') }));
  assert.equal(specialInfo(fixed(until), { now: at('2026-11-01') }), null);
});

test('order pricing uses the special and records it on the line', () => {
  const p = perKg({ on: true, mode: 'percent', percent: 10, timing: 'ongoing' });
  const line = priceLineAtOrder(p, 1, 2);
  assert.equal(line.unitPriceCents, 4500);
  assert.equal(line.lineKnownCents, 9000);
  assert.equal(line.special.saving_cents, 500);
  const f = priceLineAtOrder(fixed({ on: true, mode: 'price', price_cents: 1500 }), 3, null, 200);
  assert.equal(f.unitPriceCents, 1700); // special + option extras
  assert.equal(f.lineKnownCents, 5100);
});

test('ended special charges the normal price; imports never use specials', () => {
  const p = fixed({ on: true, mode: 'price', price_cents: 1500, timing: 'until', end: '2026-10-01' });
  assert.equal(priceLineAtOrder(p, 1, null, 0, { now: at('2026-10-20') }).lineKnownCents, 2000);
  const live = fixed({ on: true, mode: 'price', price_cents: 1500 });
  assert.equal(priceLineAtOrder(live, 1, null, 0, { ignoreSpecial: true }).lineKnownCents, 2000);
});

test('existing lines repriced from their stored price are not discounted again', () => {
  // portal-edit / service reprice with { pricing_method, price_cents: item.unit_price_cents } — no options
  const line = priceLineAtOrder({ pricing_method: 'fixed', price_cents: 1500, price_per_kg_cents: 1500 }, 2);
  assert.equal(line.lineKnownCents, 3000);
  assert.equal(line.special, undefined);
});

test('applySpecial does not change the stored product', () => {
  const p = perKg({ on: true, mode: 'percent', percent: 10 });
  const out = applySpecial(p);
  assert.equal(out.product.price_per_kg_cents, 4500);
  assert.equal(p.price_per_kg_cents, 5000);
});

test('saving: special stored on options, turning off keeps settings, invalid clears it', () => {
  const on = buildProductOptionsPatch({ options: { size_mode: 'variable', pack_label: null }, special: { on: true, mode: 'percent', percent: '10', timing: 'until', end: '2026-12-24' } });
  assert.deepEqual(on.special, { on: true, mode: 'percent', percent: 10, timing: 'until', start: null, end: '2026-12-24' });
  const off = buildProductOptionsPatch({ options: { special: on.special }, special: Object.assign({}, on.special, { on: false }) });
  assert.equal(off.special.on, false);
  assert.equal(off.special.percent, 10);
  const bad = buildProductOptionsPatch({ options: { special: on.special }, special: { on: true, mode: 'price', price_cents: null } });
  assert.equal(bad.special, undefined);
  const untouched = buildProductOptionsPatch({ options: { special: on.special } });
  assert.deepEqual(untouched.special, on.special);
  assert.equal(normaliseSpecial({ on: true, mode: 'price', price: '12.50' }).price_cents, 1250);
});

test('customer portal catalogue shows the special price and hides the settings', () => {
  const cat = buildPortalCatalog([{ id: 'c1', name: 'Beef' }], [Object.assign({ id: 'p1', name: 'Brisket', category_id: 'c1' }, perKg({ on: true, mode: 'percent', percent: 10 }))], {});
  const p = cat.products[0];
  assert.equal(p.price_per_kg_cents, 4500);
  assert.equal(p.special.was_cents, 5000);
  assert.equal(p.options.special, undefined);
});

test('shop API, storefront and editor are wired up', () => {
  const api = read('api/order/storefront.js');
  assert.match(api, /specialInfo\(raw, \{ tz: shopTz \}\)/);
  assert.match(api, /delete p\.options\.special;/);
  const js = read('assets/lp-order-storefront.js');
  assert.match(js, /data-act="specials-tab">Specials<\/button>/);
  assert.match(js, /OrderStorefront\.prototype\.renderSpecials = function/);
  assert.match(js, /<span class="lp-oe-special-badge">Special<\/span>/);
  const html = read('orders.html');
  assert.match(html, /id="prod-sp-on"/);
  assert.match(html, /special: readSpecialForm\(\),/);
  assert.match(html, /fillSpecialForm\(p\);/);
  assert.match(read('api/order/products.js'), /body\.special !== undefined \|\|/);
});
