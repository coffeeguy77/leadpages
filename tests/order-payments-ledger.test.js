'use strict';

/** Payments ledger, recording/correcting/voiding payments, pickup lock time, order screen, wiki. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const L = require('../lib/order/payment-ledger');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const pay = (o) => Object.assign({ id: 'p', order_id: 'o', kind: 'deposit', status: 'paid', amount_cents: 5000, created_at: '2026-10-20T01:00:00Z', meta: {} }, o);

test('ledger lines: method, channel, status, received date in Sydney time', () => {
  const eft = L.ledgerLine(pay({ provider: 'eftpos', paid_at: '2026-10-19T14:30:00Z' }), 'Australia/Sydney');
  assert.equal(eft.date, '2026-10-20'); // 1:30am Sydney next day
  assert.equal(eft.channel, 'counter');
  assert.equal(eft.method_label, 'EFTPOS');
  assert.equal(eft.status, 'received');
  const dd = L.ledgerLine(pay({ provider: 'direct_deposit', meta: { received_on: '2026-10-14', payer_name: 'F ANTONIO', bank_reference: 'HAMS' } }), 'Australia/Sydney');
  assert.equal(dd.date, '2026-10-14');
  assert.equal(dd.channel, 'remote');
  assert.equal(dd.payer_name, 'F ANTONIO');
  assert.equal(L.ledgerLine(pay({ provider: 'contra' })).channel, 'contra');
  assert.equal(L.ledgerLine(pay({ provider: 'cash_deposit' })).channel, 'counter');
  const plat = L.ledgerLine(pay({ provider: 'stripe', meta: { stripe_account: null } }));
  assert.equal(plat.stripe_platform, true);
  assert.equal(L.ledgerLine(pay({ provider: 'stripe', meta: { stripe_account: 'acct_1' } })).stripe_platform, false);
  assert.equal(L.ledgerLine(pay({ provider: 'stripe', meta: { refund_due: true } })).status, 'refund_due');
  assert.equal(L.ledgerLine(pay({ provider: 'stripe', status: 'pending' })).status, 'pending');
  assert.equal(L.ledgerLine(pay({ provider: 'direct_deposit', status: 'cancelled' })).status_label, 'Voided');
});

test('totals: counter vs remote, contra separate, refund due not counted', () => {
  const lines = [
    pay({ provider: 'eftpos', amount_cents: 5000 }),
    pay({ provider: 'cash_deposit', amount_cents: 2000 }),
    pay({ provider: 'stripe', amount_cents: 5000, meta: { stripe_account: 'acct' } }),
    pay({ provider: 'stripe', amount_cents: 5000, meta: { stripe_account: null } }),
    pay({ provider: 'direct_deposit', amount_cents: 15000 }),
    pay({ provider: 'contra', amount_cents: 5000 }),
    pay({ provider: 'stripe', amount_cents: 5000, meta: { refund_due: true } }),
    pay({ provider: 'stripe', amount_cents: 5000, status: 'pending' })
  ].map((p) => L.ledgerLine(p));
  const t = L.ledgerTotals(lines);
  assert.equal(t.by_channel.counter, 7000);
  assert.equal(t.by_channel.remote, 25000);
  assert.equal(t.by_channel.contra, 5000);
  assert.equal(t.money_cents, 32000);
  assert.equal(t.refund_due_cents, 5000);
  assert.equal(t.stripe_platform_cents, 5000);
  assert.equal(t.count, 6);
  assert.deepEqual(L.financialYear('2026-10-28'), { from: '2026-07-01', to: '2027-06-30' });
  assert.deepEqual(L.financialYear('2026-03-01'), { from: '2025-07-01', to: '2026-06-30' });
  assert.equal(L.inRange({ date: '2026-10-14' }, '2026-10-01', '2026-10-31'), true);
  assert.equal(L.inRange({ date: '2026-09-30' }, '2026-10-01', '2026-10-31'), false);
});

/* ---------- correct / void against an in-memory DB ---------- */
function makeDb(tables) {
  function from(table) {
    const rows = tables[table] || (tables[table] = []);
    const filters = []; let op = 'select'; let patch = null; let ins = null;
    const b = {
      select() { return b; }, order() { return b; }, limit() { return b; },
      eq(c, v) { filters.push((r) => String(r[c]) === String(v)); return b; },
      in(c, vs) { filters.push((r) => vs.map(String).includes(String(r[c]))); return b; },
      update(p) { op = 'update'; patch = p; return b; },
      insert(r) { op = 'insert'; ins = Array.isArray(r) ? r : [r]; return b; },
      async maybeSingle() { const r = await run(); return { data: r.data[0] || null, error: null }; },
      async single() { const r = await run(); return { data: r.data[0] || null, error: null }; },
      then(a, c) { return run().then(a, c); }
    };
    async function run() {
      if (op === 'insert') { const made = ins.map((r) => { const row = Object.assign({ id: table + rows.length }, r); rows.push(row); return row; }); return { data: made, error: null }; }
      const hit = rows.filter((r) => filters.every((f) => f(r)));
      if (op === 'update') hit.forEach((r) => Object.assign(r, patch));
      return { data: hit.map((r) => Object.assign({}, r)), error: null };
    }
    return b;
  }
  return { from, tables };
}

test('record with amount/date/payer/reference; correct moves the deposit; void stops it counting', async () => {
  const supa = path.join(__dirname, '..', 'lib/order/supabase.js');
  require(supa);
  const db = makeDb({
    order_orders: [{ id: 'o1', site_id: 's', order_system_id: 'sys', status: 'confirmed', deposit_required_cents: 5000, deposit_paid_cents: 0 }],
    order_items: [], order_payments: [], order_audit_events: []
  });
  require.cache[supa].exports = Object.assign({}, require.cache[supa].exports, { getAdmin: () => db });
  for (const m of ['lib/order/manual-payment.js', 'lib/order/service.js', 'lib/order/audit.js']) delete require.cache[path.join(__dirname, '..', m)];
  const mp = require('../lib/order/manual-payment');
  const order = db.tables.order_orders[0];
  const rec = await mp.recordInhousePayment({
    order: Object.assign({}, order), system: { id: 'sys' }, site: { id: 's' }, actor: { label: 't' },
    method: 'direct_deposit', amount_cents: 15000, received_on: '2026-10-14', payer_name: 'F ANTONIO', bank_reference: 'XMAS HAMS'
  });
  assert.equal(rec.payment.amount_cents, 15000);
  assert.equal(rec.payment.meta.received_on, '2026-10-14');
  assert.equal(rec.payment.meta.bank_reference, 'XMAS HAMS');
  assert.equal(rec.payment.paid_at.slice(0, 10), '2026-10-14');
  assert.equal(db.tables.order_orders[0].deposit_paid_cents, 15000);
  await assert.rejects(mp.recordInhousePayment({ order, system: { id: 'sys' }, site: { id: 's' }, method: 'eftpos', amount_cents: 100, received_on: '14/10/2026' }), /invalid_received_on/);

  const cor = await mp.correctInhousePayment({ site_id: 's', payment_id: rec.payment.id, amount_cents: 12000, reason: 'typo', actor: { label: 't' } });
  assert.equal(cor.payment.amount_cents, 12000);
  assert.equal(cor.payment.meta.corrected.reason, 'typo');
  assert.equal(cor.payment.meta.payer_name, 'F ANTONIO'); // untouched fields kept
  assert.equal(db.tables.order_orders[0].deposit_paid_cents, 12000);
  assert.ok(db.tables.order_audit_events.some((e) => e.event_type === 'payment_corrected'));

  await mp.voidInhousePayment({ site_id: 's', payment_id: rec.payment.id, reason: 'wrong order', actor: { label: 't' } });
  assert.equal(db.tables.order_payments[0].status, 'cancelled');
  assert.equal(db.tables.order_orders[0].deposit_paid_cents, 0);
  // Stripe payments are corrected in Stripe, not here
  db.tables.order_payments.push({ id: 'st', site_id: 's', order_id: 'o1', provider: 'stripe', status: 'paid', amount_cents: 5000, meta: {} });
  await assert.rejects(mp.correctInhousePayment({ site_id: 's', payment_id: 'st', amount_cents: 1 }), /only_manual_payments/);
});

test('changing the pickup date recalculates the lock time (staff, any date)', () => {
  const src = read('lib/order/staff-order-actions.js');
  assert.match(src, /changes\.some\(function \(c\) \{ return c\.field === 'pickup_date'; \}\) && order\.editing_state !== 'locked'/);
  assert.match(src, /async function lockTimeForPickup\(admin, order, system, pickupDate\)/);
  const html = read('orders.html');
  assert.match(html, /<option value="__other"' \+ \(cur && !listed \? ' selected' : ''\) \+ '>Other date…<\/option>/);
});

test('order screen: docket + sidebar, Send order, payments card, all old actions kept', () => {
  const html = read('orders.html');
  assert.match(html, /<section class="od-docket">/);
  assert.match(html, /<aside class="od-side">/);
  assert.match(html, /data-act="send-order">Send order<\/button>/);
  assert.match(html, /action: 'send_receipt', order_id: o\.id, channel: ch/);
  assert.match(html, /data-pay-edit=/);
  assert.match(html, /action: 'void_payment'/);
  for (const act of ['lock', 'ready', 'collected', 'completed', 'void', 'restore', 'deposit-link', 'checkout', 'inhouse-pay', 'copy-new', 'toggle-important']) {
    assert.match(html, new RegExp('data-act="' + act + '"'), act);
  }
  for (const pr of ['receipt', 'slip', 'label', 'item_labels']) assert.match(html, new RegExp('data-print="' + pr + '"'));
  assert.match(html, /id="om-internal-notes"/);
  assert.match(html, /id="ihp-payer"/);
  assert.match(html, /id="ihp-ref"/);
  assert.match(html, /id="ihp-amount"/);
  assert.match(html, /id="ihp-date"/);
});

test('payments screen: ledger tab with range, method filter, search, sortable columns, CSV', () => {
  const html = read('orders.html');
  assert.match(html, /data-pay-tab="ledger">Ledger<\/button>/);
  assert.match(html, /data-pay-tab="unpaid">Unpaid deposits<\/button>/);
  for (const k of ['date', 'customer_name', 'order_number', 'amount_cents', 'method_label', 'status_label']) {
    assert.match(html, new RegExp('data-led-sort="' + k + '"'));
  }
  assert.match(html, /<option value="this_fy">This financial year<\/option>/);
  assert.match(html, /function exportLedgerCsv\(\)/);
  assert.match(html, /\/api\/order\/payments-ledger\?/);
});

test('wiki: pages parse, cover every section, and are bundled with the function', () => {
  const W = require('../lib/order/wiki');
  W._reset();
  const pages = W.loadPages();
  assert.ok(pages.length >= 25);
  const secs = new Set(pages.map((p) => p.section));
  W.SECTIONS.forEach((s) => assert.ok(secs.has(s), s));
  const stock = pages.find((p) => p.slug === 'stock');
  assert.ok(stock && /Suggest matches/.test(stock.body));
  assert.ok(pages.some((p) => p.section === 'Build history' && /#873/.test(p.body)));
  pages.forEach((p) => assert.doesNotMatch(p.body, /<script|<iframe/i));
  assert.match(read('vercel.json'), /"api\/order\/wiki\.js": \{\s*"includeFiles": "docs\/order-wiki\/\*\*"/);
  assert.equal(require('../assets/lp-order-admin-nav.js').routeMeta('wiki').view, 'wiki');
  assert.match(read('orders.html'), /function wikiMd\(md\)/);
});
