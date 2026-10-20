'use strict';

/**
 * Order deposits & Stripe:
 *  - a shop's deposit is never charged on the platform account (must be connected)
 *  - payments are recorded from Stripe's own session status, once
 *  - webhook trusts only verified or Stripe-fetched events
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');

// ---------- in-memory Supabase ----------
function makeDb(tables) {
  function from(table) {
    const rows = tables[table] || (tables[table] = []);
    let filters = [];
    let op = 'select';
    let patch = null;
    let insertRows = null;
    const match = (r) => filters.every((f) => f(r));
    const b = {
      select() { return b; },
      order() { return b; },
      limit() { return b; },
      eq(c, v) { filters.push((r) => String(r[c]) === String(v)); return b; },
      neq(c, v) { filters.push((r) => String(r[c]) !== String(v)); return b; },
      in(c, vs) { filters.push((r) => vs.map(String).includes(String(r[c]))); return b; },
      not(c, o, v) { if (o === 'is' && v === null) filters.push((r) => r[c] != null); return b; },
      gte(c, v) { filters.push((r) => String(r[c]) >= String(v)); return b; },
      update(p) { op = 'update'; patch = p; return b; },
      insert(r) { op = 'insert'; insertRows = Array.isArray(r) ? r : [r]; return b; },
      async maybeSingle() { const r = await run(); return { data: (r.data || [])[0] || null, error: null }; },
      async single() { const r = await run(); return { data: (r.data || [])[0] || null, error: null }; },
      then(res, rej) { return run().then(res, rej); }
    };
    async function run() {
      if (op === 'insert') { const made = insertRows.map((r) => { const row = Object.assign({ id: 'id' + rows.length }, r); rows.push(row); return Object.assign({}, row); }); return { data: made, error: null }; }
      const hit = rows.filter(match);
      if (op === 'update') hit.forEach((r) => Object.assign(r, patch));
      return { data: hit.map((r) => Object.assign({}, r)), error: null };
    }
    return b;
  }
  return { from };
}

let db;
const supaPath = path.join(ROOT, 'lib/order/supabase.js');
require(supaPath);
require.cache[supaPath].exports = Object.assign({}, require.cache[supaPath].exports, { getAdmin: () => db });

// ---------- fake Stripe ----------
let stripeCalls = [];
let stripeRoutes = {};
global.fetch = async (url, init) => {
  const u = String(url).replace('https://api.stripe.com/v1/', '');
  const acct = init && init.headers && init.headers['Stripe-Account'];
  stripeCalls.push({ path: u, method: (init && init.method) || 'GET', account: acct || null, body: init && init.body ? String(init.body) : '' });
  const key = Object.keys(stripeRoutes).find((k) => u.startsWith(k));
  const out = key ? stripeRoutes[key](u, acct, init) : { status: 404, body: { error: { message: 'nf' } } };
  return { ok: out.status < 400, status: out.status, json: async () => out.body };
};
process.env.STRIPE_SECRET_KEY = 'sk_test_x';

const pay = require('../lib/order/stripe-pay');

function seed() {
  stripeCalls = [];
  db = makeDb({
    order_orders: [{ id: 'o1', order_system_id: 's1', site_id: 'site1', status: 'awaiting_deposit', deposit_required_cents: 5000, deposit_paid_cents: 0 }],
    order_payments: [
      { id: 'p1', order_id: 'o1', site_id: 'site1', status: 'pending', provider: 'stripe', amount_cents: 5000, stripe_session_id: 'cs_1', meta: null, created_at: new Date().toISOString() }
    ],
    order_audit_events: []
  });
}
const paidSession = (id, extra) => Object.assign({ id: id || 'cs_1', payment_status: 'paid', amount_total: 5000, payment_intent: 'pi_1', client_reference_id: 'p1', metadata: { kind: 'order_deposit', payment_id: 'p1', order_id: 'o1' } }, extra || {});

test('a paid Stripe session records the deposit and confirms the order', async () => {
  seed();
  const out = await pay.recordStripeSession(paidSession(), null);
  assert.equal(out.recorded, true);
  const o = (await db.from('order_orders').select().eq('id', 'o1').single()).data;
  assert.equal(o.deposit_paid_cents, 5000);
  assert.equal(o.status, 'confirmed');
  const p = (await db.from('order_payments').select().eq('id', 'p1').single()).data;
  assert.equal(p.status, 'paid');
  assert.equal(p.stripe_payment_intent_id, 'pi_1');
});

test('the same session is never counted twice (webhook + return + cron)', async () => {
  seed();
  await pay.recordStripeSession(paidSession(), null);
  const again = await pay.recordStripeSession(paidSession(), null);
  assert.equal(again.recorded, false);
  const o = (await db.from('order_orders').select().eq('id', 'o1').single()).data;
  assert.equal(o.deposit_paid_cents, 5000);
});

test('unpaid or foreign sessions are ignored', async () => {
  seed();
  assert.equal((await pay.recordStripeSession(paidSession('cs_1', { payment_status: 'unpaid' }), null)).recorded, false);
  assert.equal((await pay.recordStripeSession(paidSession('cs_1', { metadata: { kind: 'booking_deposit' } }), null)).recorded, false);
  assert.equal((await pay.recordStripeSession(paidSession('cs_other'), null)).recorded, false); // session id mismatch
  const o = (await db.from('order_orders').select().eq('id', 'o1').single()).data;
  assert.equal(o.deposit_paid_cents, 0);
});

test('duplicate / already-counted charges are recorded but not added again', async () => {
  seed();
  await db.from('order_payments').update({ meta: { refund_due: true } }).eq('id', 'p1');
  const out = await pay.recordStripeSession(paidSession(), null);
  assert.equal(out.recorded, true);
  assert.equal(out.counted, false);
  const o = (await db.from('order_orders').select().eq('id', 'o1').single()).data;
  assert.equal(o.deposit_paid_cents, 0);
});

test('sync asks Stripe for pending sessions on the right account', async () => {
  seed();
  await db.from('order_payments').update({ meta: { stripe_account: 'acct_shop' } }).eq('id', 'p1');
  stripeRoutes = { 'checkout/sessions/cs_1': (_u, acct) => ({ status: 200, body: acct === 'acct_shop' ? paidSession() : { error: {} } }) };
  const out = await pay.syncPendingPayments({ orderId: 'o1' });
  assert.equal(out.recorded, 1);
  assert.equal(stripeCalls[0].account, 'acct_shop');
  const again = await pay.syncPendingPayments({ orderId: 'o1' });
  assert.equal(again.checked, 0); // nothing pending any more
});

test('connect status reports charges_enabled from Stripe', async () => {
  stripeRoutes = { 'accounts/acct_ok': () => ({ status: 200, body: { id: 'acct_ok', type: 'standard', charges_enabled: true, payouts_enabled: true, details_submitted: true, requirements: { currently_due: [] } } }) };
  const st = await pay.connectStatus('acct_ok');
  assert.equal(st.connected, true);
  assert.equal(st.charges_enabled, true);
  assert.equal((await pay.connectStatus('')).connected, false);
  assert.equal((await pay.connectStatus('acct_missing')).connected, false);
});

// ---------- checkout: never charge the platform for a shop ----------
function mockRes() {
  const res = { statusCode: 200, headers: {}, body: null };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.end = (b) => { res.body = b ? JSON.parse(b) : null; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.body = o; return res; };
  return res;
}
function stubModule(rel, exportsObj) {
  const p = path.join(ROOT, rel);
  require(p);
  require.cache[p].exports = Object.assign({}, require.cache[p].exports, exportsObj);
}

test('checkout refuses when the shop has no connected Stripe account (no platform charge)', async () => {
  seed();
  await db.from('sites').insert({ id: 'site1', slug: 'shop', business_name: 'Shop' });
  stubModule('lib/order/tokens.js', { resolveAccessToken: async () => ({ order_id: 'o1' }) });
  stubModule('lib/order/auth.js', { getOrderSystemForSite: async () => ({ id: 's1', settings: { payments: {} } }) });
  stubModule('lib/order/http.js', { readBody: async (req) => req.body });
  delete require.cache[path.join(ROOT, 'api/order/checkout-deposit.js')];
  const handler = require('../api/order/checkout-deposit.js');
  stripeRoutes = { 'checkout/sessions': () => ({ status: 200, body: { id: 'cs_x', url: 'https://x' } }) };
  stripeCalls = [];
  const res = mockRes();
  await handler({ method: 'POST', headers: {}, body: { t: 'tok' } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, 'payments_not_connected');
  assert.ok(!stripeCalls.some((c) => c.path === 'checkout/sessions'), 'no checkout session created');
});

test('checkout with a connected Standard account charges the shop account directly', async () => {
  seed();
  await db.from('sites').insert({ id: 'site1', slug: 'shop', business_name: 'Shop' });
  stubModule('lib/order/auth.js', { getOrderSystemForSite: async () => ({ id: 's1', settings: { payments: { stripe_connect_account_id: 'acct_shop', stripe_charge_mode: 'direct' } } }) });
  delete require.cache[path.join(ROOT, 'api/order/checkout-deposit.js')];
  const handler = require('../api/order/checkout-deposit.js');
  // the existing pending session is unpaid → a new one is created
  stripeRoutes = {
    'checkout/sessions/cs_1': () => ({ status: 200, body: paidSession('cs_1', { payment_status: 'unpaid' }) }),
    'accounts/acct_shop': () => ({ status: 200, body: { id: 'acct_shop', type: 'standard', charges_enabled: true } }),
    'checkout/sessions': () => ({ status: 200, body: { id: 'cs_new', url: 'https://checkout' } })
  };
  stripeCalls = [];
  const res = mockRes();
  await handler({ method: 'POST', headers: {}, body: { t: 'tok' } }, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  const create = stripeCalls.find((c) => c.path === 'checkout/sessions' && c.method === 'POST');
  assert.equal(create.account, 'acct_shop');
  const row = (await db.from('order_payments').select().eq('stripe_session_id', 'cs_new').single()).data;
  assert.equal(row.meta.stripe_account, 'acct_shop');
});

test('checkout records an earlier paid session instead of charging again', async () => {
  seed();
  stubModule('lib/order/auth.js', { getOrderSystemForSite: async () => ({ id: 's1', settings: { payments: { stripe_connect_account_id: 'acct_shop' } } }) });
  delete require.cache[path.join(ROOT, 'api/order/checkout-deposit.js')];
  const handler = require('../api/order/checkout-deposit.js');
  stripeRoutes = { 'checkout/sessions/cs_1': () => ({ status: 200, body: paidSession() }) };
  stripeCalls = [];
  const res = mockRes();
  await handler({ method: 'POST', headers: {}, body: { t: 'tok' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'deposit_already_paid');
});

// ---------- webhook ----------
test('webhook: signed raw body is trusted; parsed/unsigned events are re-fetched from Stripe', async () => {
  delete require.cache[path.join(ROOT, 'api/order/webhook.js')];
  process.env.STRIPE_ORDER_WEBHOOK_SECRET = 'whsec_test';
  const handler = require('../api/order/webhook.js');
  const evt = { id: 'evt_1', type: 'checkout.session.completed', data: { object: paidSession() } };

  // 1) genuine signed raw body
  seed();
  stripeCalls = [];
  const raw = JSON.stringify(evt, null, 2);
  const t = Math.floor(Date.now() / 1000);
  const sig = 't=' + t + ',v1=' + crypto.createHmac('sha256', 'whsec_test').update(t + '.' + raw).digest('hex');
  let res = mockRes();
  await handler({ method: 'POST', headers: { 'stripe-signature': sig }, body: raw }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.recorded, true);
  assert.equal(stripeCalls.length, 0);

  // 2) body already parsed (Vercel) → fetched back from Stripe and recorded
  seed();
  stripeRoutes = { 'events/evt_1': () => ({ status: 200, body: evt }) };
  stripeCalls = [];
  res = mockRes();
  await handler({ method: 'POST', headers: { 'stripe-signature': sig }, body: JSON.parse(raw) }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.recorded, true);
  assert.equal(stripeCalls[0].path, 'events/evt_1');

  // 3) forged event Stripe doesn't know → rejected, nothing recorded
  seed();
  stripeRoutes = {};
  res = mockRes();
  await handler({ method: 'POST', headers: {}, body: { id: 'evt_fake', type: 'checkout.session.completed', data: { object: paidSession() } } }, res);
  assert.equal(res.statusCode, 400);
  const o = (await db.from('order_orders').select().eq('id', 'o1').single()).data;
  assert.equal(o.deposit_paid_cents, 0);
});
