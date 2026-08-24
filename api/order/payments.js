'use strict';

const { json, methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, ensureOrderSystem } = require('../../lib/order/auth');
const { getAdmin } = require('../../lib/order/supabase');
const { formatAud } = require('../../lib/order/money');

const PAID_STATUSES = ['paid'];
const UNPAID_STATUSES = ['pending', 'requires_action', 'failed'];

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET'])) return;
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'auth' });
    const siteId = req.query && req.query.site_id;
    const access = await assertSiteAccess(user, siteId);
    if (!access.ok) return json(res, access.code, { error: access.error });
    await ensureOrderSystem(siteId);
    const admin = getAdmin();

    let q = admin
      .from('order_payments')
      .select(
        'id, order_id, site_id, kind, status, amount_cents, currency, provider, paid_at, created_at, updated_at, payment_link_url, order:order_orders(id, order_number, customer_name, status, deposit_required_cents, deposit_paid_cents)'
      )
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(300);
    if (req.query.status) q = q.eq('status', req.query.status);
    if (req.query.order_id) q = q.eq('order_id', req.query.order_id);
    if (req.query.kind) q = q.in('kind', String(req.query.kind).split(','));
    const { data, error } = await q;
    if (error) throw error;

    const payments = (data || []).map(function (p) {
      const order = p.order || null;
      return {
        id: p.id,
        order_id: p.order_id,
        order_number: order && order.order_number ? order.order_number : null,
        customer_name: order && order.customer_name ? order.customer_name : null,
        order_status: order && order.status ? order.status : null,
        kind: p.kind,
        status: p.status,
        amount_cents: p.amount_cents,
        currency: p.currency,
        provider: p.provider,
        paid_at: p.paid_at,
        created_at: p.created_at,
        updated_at: p.updated_at,
        payment_link_url: p.payment_link_url
      };
    });

    const depositPayments = payments.filter(function (p) {
      return p.kind === 'deposit';
    });

    const { data: awaitingOrders, error: awaitingErr } = await admin
      .from('order_orders')
      .select('id, order_number, customer_name, status, deposit_required_cents, deposit_paid_cents, created_at')
      .eq('site_id', siteId)
      .eq('status', 'awaiting_deposit')
      .order('created_at', { ascending: false })
      .limit(200);
    if (awaitingErr) throw awaitingErr;

    const paidDepositIds = {};
    depositPayments.forEach(function (p) {
      if (PAID_STATUSES.indexOf(p.status) >= 0 && p.order_id) paidDepositIds[p.order_id] = true;
    });

    const unpaidDeposits = [];
    (awaitingOrders || []).forEach(function (o) {
      if (paidDepositIds[o.id]) return;
      unpaidDeposits.push({
        id: 'order-' + o.id,
        order_id: o.id,
        order_number: o.order_number,
        customer_name: o.customer_name,
        order_status: o.status,
        kind: 'deposit',
        status: 'awaiting',
        amount_cents: Math.max(0, (Number(o.deposit_required_cents) || 0) - (Number(o.deposit_paid_cents) || 0)),
        currency: 'AUD',
        provider: null,
        paid_at: null,
        created_at: o.created_at,
        updated_at: null,
        payment_link_url: null,
        source: 'order'
      });
    });

    depositPayments.forEach(function (p) {
      if (PAID_STATUSES.indexOf(p.status) >= 0) return;
      if (UNPAID_STATUSES.indexOf(p.status) < 0 && p.status !== 'cancelled') return;
      var dup = unpaidDeposits.some(function (u) { return u.order_id === p.order_id; });
      if (!dup) unpaidDeposits.push(Object.assign({ source: 'payment' }, p));
    });

    unpaidDeposits.sort(function (a, b) {
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });

    const paidDeposits = depositPayments
      .filter(function (p) {
        return PAID_STATUSES.indexOf(p.status) >= 0;
      })
      .map(function (p) {
        return Object.assign({ source: 'payment' }, p);
      });

    const paid = payments.filter(function (p) {
      return PAID_STATUSES.indexOf(p.status) >= 0;
    });
    const totalPaid = paid.reduce(function (s, p) {
      return s + (Number(p.amount_cents) || 0);
    }, 0);

    return json(res, 200, {
      payments: payments,
      deposits: {
        unpaid: unpaidDeposits,
        paid: paidDeposits
      },
      summary: {
        count: payments.length,
        paid_count: paid.length,
        paid_total_cents: totalPaid,
        paid_total: formatAud(totalPaid),
        unpaid_deposit_count: unpaidDeposits.length,
        paid_deposit_count: paidDeposits.length
      }
    });
  } catch (e) {
    console.error('order/payments', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
