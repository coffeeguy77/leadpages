'use strict';

/**
 * Payments ledger (staff): GET ?site_id=…&from=YYYY-MM-DD&to=YYYY-MM-DD&all=1
 *   → { lines, totals, range, channels, methods }
 * `all=1` also returns unfinished / voided lines (default: received, refund due, refunded).
 * Rules: lib/order/payment-ledger.js
 */

const { json, methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, ensureOrderSystem } = require('../../lib/order/auth');
const { getAdmin } = require('../../lib/order/supabase');
const { syncPendingPayments } = require('../../lib/order/stripe-pay');
const L = require('../../lib/order/payment-ledger');

const DATE = /^\d{4}-\d{2}-\d{2}$/;

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET'])) return;
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'auth' });
    const q = req.query || {};
    const access = await assertSiteAccess(user, q.site_id);
    if (!access.ok) return json(res, access.code, { error: access.error });
    const system = await ensureOrderSystem(q.site_id);
    const tz = system.timezone || 'Australia/Sydney';
    try { await syncPendingPayments({ siteId: q.site_id }); } catch (e) { console.error('payments-ledger sync', e); }

    const { data, error } = await getAdmin()
      .from('order_payments')
      .select('id, order_id, kind, status, amount_cents, provider, paid_at, created_at, meta, order:order_orders(order_number, customer_name)')
      .eq('site_id', q.site_id)
      .order('created_at', { ascending: false })
      .limit(5000);
    if (error) throw error;

    const from = DATE.test(q.from || '') ? q.from : null;
    const to = DATE.test(q.to || '') ? q.to : null;
    const showAll = q.all === '1' || q.all === 'true';
    const lines = (data || [])
      .map(function (p) { return L.ledgerLine(p, tz); })
      .filter(function (l) { return L.inRange(l, from, to); })
      .filter(function (l) { return showAll || ['received', 'refund_due', 'refunded'].indexOf(l.status) >= 0; });

    return json(res, 200, {
      range: { from: from, to: to, today: L.localDate(new Date().toISOString(), tz), financial_year: L.financialYear(L.localDate(new Date().toISOString(), tz)) },
      lines: lines,
      totals: L.ledgerTotals(lines),
      channels: L.CHANNELS,
      methods: Object.keys(L.METHODS).map(function (k) { return { key: k, label: L.METHODS[k].label, channel: L.METHODS[k].channel }; })
    });
  } catch (e) {
    console.error('order/payments-ledger', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
