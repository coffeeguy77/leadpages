'use strict';

/** Stock pieces: allocation = weighing, protect existing pre-orders, suggestions, parsing. */
const test = require('node:test');
const assert = require('node:assert/strict');
const stock = require('../lib/order/stock');

const HALF = { id: 'p-half', name: 'HAM - Half 3.5-4', category_id: 'c-ham', options: { minimum_kg: 3.75 } };

test('only switched-on categories are stock-controlled', () => {
  const sys = { settings: { stock_control: { category_ids: ['c-ham'] } } };
  assert.equal(stock.isStockProduct(sys, HALF), true);
  assert.equal(stock.isStockProduct(sys, { category_id: 'c-beef' }), false);
  assert.equal(stock.isStockProduct({ settings: {} }, HALF), false);
  assert.equal(stock.isStockProduct(sys, { category_id: null }), false);
});

test('allocating all pieces finalises weight and price (with option extras)', () => {
  const item = {
    quantity: 1,
    pricing_method: 'per_weight',
    unit_price_cents: 3080,
    requested_weight_kg: 3.75,
    price_status: 'estimated',
    line_known_cents: 11550,
    options_snapshot: { selected: [{ price_cents: 500 }] }
  };
  const p = stock.linePatchForPieces(item, [{ weight_kg: '3.8' }]);
  assert.equal(p.actual_weight_kg, 3.8);
  assert.equal(p.line_final_cents, 11704 + 500); // 3.8 × $30.80 + glaze
  assert.equal(p.price_status, 'finalised');
  assert.equal(p.options_snapshot.stock.finalised, true);
});

test('a line for 2 hams is final only once both are allocated', () => {
  const item = { quantity: 2, pricing_method: 'per_weight', unit_price_cents: 3080, requested_weight_kg: 7.5, options_snapshot: {} };
  const one = stock.linePatchForPieces(item, [{ weight_kg: 3.8 }]);
  assert.equal(one.price_status, undefined); // untouched — still the estimate
  assert.equal(one.options_snapshot.stock.pieces, 1);
  const two = stock.linePatchForPieces(item, [{ weight_kg: 3.8 }, { weight_kg: 3.65 }]);
  assert.equal(two.actual_weight_kg, 7.45);
  assert.equal(two.line_final_cents, Math.round(7.45 * 3080));
});

test('releasing goes back to the estimate, or TBC for count-only lines', () => {
  const finalStock = { stock: { pieces: 1, weight_kg: 3.8, finalised: true } };
  const est = stock.linePatchForPieces(
    { quantity: 1, pricing_method: 'per_weight', unit_price_cents: 3080, requested_weight_kg: 3.75, options_snapshot: finalStock },
    []
  );
  assert.equal(est.actual_weight_kg, null);
  assert.equal(est.price_status, 'estimated');
  assert.equal(est.line_known_cents, Math.round(3.75 * 3080));
  assert.equal(est.options_snapshot.stock, undefined);
  const tbc = stock.linePatchForPieces(
    { quantity: 1, pricing_method: 'per_weight', unit_price_cents: 2155, requested_weight_kg: null, options_snapshot: finalStock },
    []
  );
  assert.equal(tbc.price_status, 'tbc');
  assert.equal(tbc.line_final_cents, null);
});

test('a line weighed by hand (not by stock) is left alone when nothing is allocated', () => {
  const p = stock.linePatchForPieces({ quantity: 1, pricing_method: 'per_weight', unit_price_cents: 3080, price_status: 'finalised', options_snapshot: {} }, []);
  assert.deepEqual(Object.keys(p).sort(), ['options_snapshot', 'updated_at']);
});

test('protect pre-orders: shop opens only when every open order has its pieces', () => {
  const products = [HALF];
  const pieces = [
    { id: 'a', product_id: 'p-half', status: 'available', weight_kg: 3.6 },
    { id: 'b', product_id: 'p-half', status: 'available', weight_kg: 3.9 },
    { id: 'c', product_id: 'p-half', status: 'allocated', weight_kg: 3.8, order_item_id: 'L1' },
    { id: 'd', product_id: 'p-half', status: 'written_off', weight_kg: 3.7 }
  ];
  let s = stock.summarise(products, pieces, [{ id: 'L1', product_id: 'p-half', quantity: 1 }, { id: 'L2', product_id: 'p-half', quantity: 2 }])['p-half'];
  assert.equal(s.received, 3);
  assert.equal(s.allocated, 1);
  assert.equal(s.available, 2);
  assert.equal(s.written_off, 1);
  assert.equal(s.waiting_orders, 1);
  assert.equal(s.waiting_pieces, 2);
  assert.equal(s.shop_open, false);
  assert.equal(s.free_to_sell, 0);
  s = stock.summarise(products, pieces, [{ id: 'L1', product_id: 'p-half', quantity: 1 }])['p-half'];
  assert.equal(s.shop_open, true);
  assert.equal(s.free_to_sell, 2);
  // nothing left → sold out
  s = stock.summarise(products, pieces.filter((p) => p.status !== 'available'), [])['p-half'];
  assert.equal(s.shop_open, false);
});

test('suggestions: oldest pickup first, closest weight to the size', () => {
  const pieces = [
    { id: 'x1', product_id: 'p-half', status: 'available', weight_kg: 3.52 },
    { id: 'x2', product_id: 'p-half', status: 'available', weight_kg: 3.76 },
    { id: 'x3', product_id: 'p-half', status: 'available', weight_kg: 3.98 }
  ];
  const lines = [
    { id: 'late', product_id: 'p-half', quantity: 1, pickup_date: '2026-12-24', order_created_at: '2026-10-01' },
    { id: 'early', product_id: 'p-half', quantity: 1, pickup_date: '2026-12-22', order_created_at: '2026-10-05' },
    { id: 'pair', product_id: 'p-half', quantity: 2, requested_weight_kg: 8, pickup_date: '2026-12-23' }
  ];
  const pairs = stock.suggestPairs(lines, pieces, { 'p-half': HALF });
  assert.deepEqual(pairs.map((p) => [p.order_item_id, p.piece_id]), [
    ['early', 'x2'], // 3.75 target → 3.76
    ['pair', 'x3'], // 4 kg each → 3.98
    ['pair', 'x1'],
    // no pieces left for "late"
  ]);
  assert.equal(stock.targetWeightKg({ quantity: 1 }, { name: 'TURKEY - Whole 4-4.8 kg' }), 4.4);
});

test('weights parse from a pasted list; junk is rejected', () => {
  assert.deepEqual(stock.parseWeights('3.82, 3.65 3.91\n4.1kg'), [3.82, 3.65, 3.91, 4.1]);
  assert.throws(() => stock.parseWeights('3.8, abc'), /invalid_weight/);
  assert.throws(() => stock.parseWeights('0'), /invalid_weight/);
  assert.equal(stock.piecesNeeded({ quantity: '2.0000' }), 2);
});

/* ---------- give / release against an in-memory database ---------- */
const path = require('path');
function makeDb(tables) {
  function from(table) {
    const rows = tables[table] || (tables[table] = []);
    const filters = [];
    let op = 'select';
    let patch = null;
    let insertRows = null;
    let countMode = false;
    const match = (r) => filters.every((f) => f(r));
    const b = {
      select(_c, o) { if (o && o.count) countMode = true; return b; },
      order() { return b; },
      limit() { return b; },
      eq(c, v) { filters.push((r) => String(r[c]) === String(v)); return b; },
      in(c, vs) { filters.push((r) => vs.map(String).includes(String(r[c]))); return b; },
      update(p) { op = 'update'; patch = p; return b; },
      insert(r) { op = 'insert'; insertRows = Array.isArray(r) ? r : [r]; return b; },
      async maybeSingle() { const r = await run(); return { data: (r.data || [])[0] || null, error: null }; },
      async single() { const r = await run(); return { data: (r.data || [])[0] || null, error: null }; },
      then(res, rej) { return run().then(res, rej); }
    };
    async function run() {
      if (op === 'insert') {
        const made = insertRows.map((r) => { const row = Object.assign({ id: table + rows.length }, r); rows.push(row); return Object.assign({}, row); });
        return { data: made, error: null };
      }
      const hit = rows.filter(match);
      if (op === 'update') hit.forEach((r) => Object.assign(r, patch));
      if (countMode) return { count: hit.length, data: null, error: null };
      return { data: hit.map((r) => Object.assign({}, r)), error: null };
    }
    return b;
  }
  return { from };
}

function seedDb() {
  return makeDb({
    order_orders: [{ id: 'o1', order_system_id: 'sys', site_id: 's', status: 'confirmed', deposit_paid_cents: 5000, deposit_required_cents: 5000 }],
    order_items: [{
      id: 'L1', order_id: 'o1', site_id: 's', product_id: 'p-half', quantity: 1, pricing_method: 'per_weight',
      unit_price_cents: 3080, requested_weight_kg: 3.75, price_status: 'estimated', line_known_cents: 11550, options_snapshot: {}
    }],
    order_stock_pieces: [
      { id: 'k1', order_system_id: 'sys', site_id: 's', product_id: 'p-half', weight_kg: 3.8, status: 'available', order_item_id: null },
      { id: 'k2', order_system_id: 'sys', site_id: 's', product_id: 'p-half', weight_kg: 3.6, status: 'available', order_item_id: null }
    ],
    order_changes: [],
    order_audit_events: []
  });
}

test('give a piece: line weighed + priced, order total updated; the same piece cannot be given twice', async () => {
  const ROOT = path.join(__dirname, '..');
  const supa = path.join(ROOT, 'lib/order/supabase.js');
  require(supa);
  let db = seedDb();
  require.cache[supa].exports = Object.assign({}, require.cache[supa].exports, { getAdmin: () => db });
  for (const m of ['lib/order/stock.js', 'lib/order/service.js', 'lib/order/audit.js']) delete require.cache[path.join(ROOT, m)];
  const live = require('../lib/order/stock');
  const sys = { id: 'sys', settings: {} };

  const out = await live.allocatePiece(sys, { piece_id: 'k1', order_item_id: 'L1', actor: { user_id: null, label: 't' } });
  assert.equal(out.item.actual_weight_kg, 3.8);
  assert.equal(out.item.price_status, 'finalised');
  assert.equal(out.item.line_final_cents, 11704);
  assert.equal(out.order.final_subtotal_cents != null || out.order.known_subtotal_cents != null, true);
  const k1 = (await db.from('order_stock_pieces').select('*').eq('id', 'k1').single()).data;
  assert.equal(k1.status, 'allocated');
  assert.equal(k1.order_item_id, 'L1');

  await assert.rejects(live.allocatePiece(sys, { piece_id: 'k1', order_item_id: 'L1' }), /piece_taken/);
  await assert.rejects(live.allocatePiece(sys, { piece_id: 'k2', order_item_id: 'L1' }), /line_full/);
  await assert.rejects(live.allocatePiece({ id: 'other' }, { piece_id: 'k2', order_item_id: 'L1' }), /item_not_found/);

  await live.releasePiece(sys, { piece_id: 'k1' });
  const item = (await db.from('order_items').select('*').eq('id', 'L1').single()).data;
  assert.equal(item.actual_weight_kg, null);
  assert.equal(item.price_status, 'estimated');
  assert.equal(item.line_known_cents, 11550);
  const back = (await db.from('order_stock_pieces').select('*').eq('id', 'k1').single()).data;
  assert.equal(back.status, 'available');
  assert.equal(back.order_item_id, null);

  // cancelled orders can't take stock
  db = seedDb();
  (await db.from('order_orders').update({ status: 'cancelled' }).eq('id', 'o1'));
  await assert.rejects(live.allocatePiece(sys, { piece_id: 'k1', order_item_id: 'L1' }), /order_not_open/);
});

/* ---------- wiring ---------- */
const fs = require('fs');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('every way of ordering goes through stock: shop, checkout, staff, Make changes, cancel', () => {
  assert.match(read('lib/order/cart.js'), /const stockLine = await addStockPieceItem\(cart, product, opts\);/);
  assert.match(read('lib/order/cart.js'), /stock_piece_id: \(it\.product_snapshot && it\.product_snapshot\.stock_piece/);
  assert.match(read('lib/order/service.js'), /const pieceForLine = await resolveStockPieces\(system, linesIn, byId, body\);/);
  assert.match(read('lib/order/service.js'), /await admin\.from\('order_orders'\)\.delete\(\)\.eq\('id', order\.id\);/);
  assert.match(read('lib/order/portal-edit.js'), /if \(stock\.isStockProduct\(system, bundle\.product\)\)/);
  assert.match(read('lib/order/staff-order-actions.js'), /releaseForOrder\(opts\.system, order\.id/);
  assert.match(read('api/order/orders.js'), /body\.status === 'cancelled' \|\| body\.status === 'refunded'/);
  assert.match(read('api/order/portal-auth.js'), /reason: 'choose_piece'/);
  assert.match(read('api/order/storefront.js'), /shopAvailability\(system, products \|\| \[\]\)/);
  assert.match(read('api/order/portal.js'), /stock_held: !!\(it\.options_snapshot/);
});

test('screens: shop piece picker, staff Stock + New order, order page', () => {
  const sf = read('assets/lp-order-storefront.js');
  assert.match(sf, /data-act="add-piece"/);
  assert.match(sf, /if \(act === 'add-piece'\)/);
  assert.match(sf, /\(exact weight\)/);
  const staff = read('orders.html');
  assert.match(staff, /<section class="view" id="view-stock" data-view="stock">/);
  assert.match(staff, /else if \(v === 'stock'\) await loadStock\(\);/);
  assert.match(staff, /data-fast-piece=/);
  assert.match(read('order-portal.html'), /name="add-piece"/);
  const nav = require('../assets/lp-order-admin-nav.js');
  assert.equal(nav.routeMeta('stock').view, 'stock');
  assert.match(read('db/migrations/20261028_order_stock_pieces.sql'), /create trigger order_items_release_stock/);
});
