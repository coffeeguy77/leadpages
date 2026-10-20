'use strict';

/**
 * Order Engine ↔ Stripe: shop payment accounts and recording deposit payments.
 *
 * Money rule: online deposits are only taken when the shop has its own connected Stripe
 * account that can accept charges. Without one, checkout is refused — the platform
 * (LeadPages / Web Culture) account is never charged on a shop's behalf.
 *
 * Recording rule: a deposit is recorded from what Stripe itself reports for the Checkout
 * Session (payment_status === 'paid'), via the webhook, when the customer returns from
 * Stripe, when staff open the order, and by a sweep cron. Each payment row is marked paid
 * once (conditional update), so the order's deposit is never counted twice.
 */

const { getAdmin } = require('./supabase');

function stripeKey() {
  return process.env.STRIPE_SECRET_KEY || '';
}

async function stripeApi(method, path, params, account) {
  const headers = { Authorization: 'Bearer ' + stripeKey() };
  if (account) headers['Stripe-Account'] = account;
  let url = 'https://api.stripe.com/v1/' + path;
  const init = { method: method, headers: headers };
  if (params) {
    const body = new URLSearchParams();
    Object.keys(params).forEach(function (k) {
      const v = params[k];
      if (v === undefined || v === null || v === '') return;
      body.append(k, String(v));
    });
    if (method === 'GET') url += (url.indexOf('?') >= 0 ? '&' : '?') + body.toString();
    else {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      init.body = body;
    }
  }
  const r = await fetch(url, init);
  let data = null;
  try { data = await r.json(); } catch (_e) { data = null; }
  return { ok: r.ok, status: r.status, data: data };
}

function paymentSettings(system) {
  const s = (system && system.settings && system.settings.payments) || {};
  return {
    provider: s.provider || 'stripe',
    stripe_connect_account_id: String(s.stripe_connect_account_id || '').trim(),
    stripe_charge_mode: s.stripe_charge_mode === 'direct' ? 'direct' : 'destination',
    paypal_client_id: String(s.paypal_client_id || '').trim(),
    paypal_merchant_email: String(s.paypal_merchant_email || '').trim(),
    statement_suffix: String(s.statement_suffix || '').trim().slice(0, 22)
  };
}

/** Status of a connected account: { connected, account_id, charges_enabled, details_submitted, ... }. */
async function connectStatus(accountId) {
  const id = String(accountId || '').trim();
  if (!id) return { connected: false, account_id: null, charges_enabled: false };
  if (!stripeKey()) return { connected: false, account_id: id, charges_enabled: false, error: 'payments_not_configured' };
  const r = await stripeApi('GET', 'accounts/' + encodeURIComponent(id));
  if (!r.ok || !r.data || !r.data.id) {
    return {
      connected: false,
      account_id: id,
      charges_enabled: false,
      error: (r.data && r.data.error && r.data.error.message) || 'account_not_found'
    };
  }
  const a = r.data;
  const due = (a.requirements && a.requirements.currently_due) || [];
  return {
    connected: true,
    account_id: a.id,
    type: a.type || null,
    email: a.email || null,
    business_name: (a.business_profile && a.business_profile.name) || (a.settings && a.settings.dashboard && a.settings.dashboard.display_name) || null,
    charges_enabled: !!a.charges_enabled,
    payouts_enabled: !!a.payouts_enabled,
    details_submitted: !!a.details_submitted,
    requirements_due: due.length
  };
}

/**
 * Record a Stripe Checkout Session for an order deposit.
 * `session` must come from Stripe (verified webhook or API retrieve). `account` = connected account id or null.
 * @returns {{ recorded: boolean, reason?: string, order_id?: string }}
 */
async function recordStripeSession(session, account) {
  if (!session || !session.id) return { recorded: false, reason: 'no_session' };
  const meta = session.metadata || {};
  if (meta.kind !== 'order_deposit') return { recorded: false, reason: 'not_order_deposit' };
  if (session.payment_status !== 'paid') return { recorded: false, reason: 'not_paid' };
  const admin = getAdmin();
  const paymentId = meta.payment_id || session.client_reference_id;
  let payment = null;
  if (paymentId) {
    payment = (await admin.from('order_payments').select('*').eq('id', paymentId).maybeSingle()).data;
  }
  if (!payment) {
    payment = (await admin.from('order_payments').select('*').eq('stripe_session_id', session.id).maybeSingle()).data;
  }
  if (!payment) return { recorded: false, reason: 'payment_not_found' };
  if (payment.status === 'paid') return { recorded: false, reason: 'already_paid', order_id: payment.order_id };
  if (payment.stripe_session_id && payment.stripe_session_id !== session.id) {
    return { recorded: false, reason: 'session_mismatch' };
  }

  const now = new Date().toISOString();
  const amount = Number(session.amount_total) || Number(payment.amount_cents) || 0;
  const prevMeta = payment.meta && typeof payment.meta === 'object' ? payment.meta : {};
  // A charge flagged as a duplicate (refund_due) or already counted on the order (no_count) is
  // recorded as taken — the money moved — but not added to the deposit again.
  const countIt = !prevMeta.refund_due && !prevMeta.no_count;
  const newMeta = Object.assign({}, prevMeta, {
    stripe_account: account || prevMeta.stripe_account || null,
    stripe_customer_email: (session.customer_details && session.customer_details.email) || session.customer_email || null,
    recorded_via: prevMeta.recorded_via || 'stripe_session'
  });

  // Only the first writer flips pending → paid; everyone else sees no row and stops.
  const { data: flipped, error: fErr } = await admin
    .from('order_payments')
    .update({
      status: 'paid',
      amount_cents: amount,
      stripe_session_id: session.id,
      stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent && session.payment_intent.id) || null,
      paid_at: now,
      updated_at: now,
      meta: newMeta
    })
    .eq('id', payment.id)
    .neq('status', 'paid')
    .select('id');
  if (fErr) throw fErr;
  if (!flipped || !flipped.length) return { recorded: false, reason: 'already_paid', order_id: payment.order_id };

  const { data: order } = await admin.from('order_orders').select('*').eq('id', payment.order_id).maybeSingle();
  if (order && countIt) {
    const paid = (Number(order.deposit_paid_cents) || 0) + amount;
    const patch = { deposit_paid_cents: paid, updated_at: now };
    if (order.status === 'awaiting_deposit' && paid >= (Number(order.deposit_required_cents) || 0)) {
      patch.status = 'confirmed';
      patch.confirmed_at = order.confirmed_at || now;
    }
    await admin.from('order_orders').update(patch).eq('id', order.id);
  }
  if (order) {
    await admin.from('order_audit_events').insert({
      order_system_id: order.order_system_id,
      site_id: order.site_id,
      order_id: order.id,
      event_type: countIt ? 'deposit_paid' : 'duplicate_payment_recorded',
      source: 'system',
      payload: {
        payment_id: payment.id,
        amount_cents: amount,
        stripe_session_id: session.id,
        stripe_account: account || null,
        counted: countIt
      }
    });
  }
  return { recorded: true, order_id: payment.order_id, counted: countIt };
}

/** Ask Stripe about one pending payment row and record it when paid. */
async function syncPayment(payment) {
  if (!payment || payment.status !== 'pending' || !payment.stripe_session_id || !stripeKey()) {
    return { recorded: false, reason: 'skip' };
  }
  const account = (payment.meta && payment.meta.stripe_account) || null;
  const r = await stripeApi('GET', 'checkout/sessions/' + encodeURIComponent(payment.stripe_session_id), null, account);
  if (!r.ok || !r.data) return { recorded: false, reason: 'stripe_lookup_failed', status: r.status };
  return recordStripeSession(r.data, account);
}

/**
 * Sync pending Stripe deposit payments. Filter by { orderId } or { siteId }, else all recent.
 * @returns {{ checked: number, recorded: number, results: Array }}
 */
async function syncPendingPayments(filter) {
  filter = filter || {};
  if (!stripeKey()) return { checked: 0, recorded: 0, results: [] };
  const admin = getAdmin();
  let q = admin
    .from('order_payments')
    .select('*')
    .eq('status', 'pending')
    .eq('provider', 'stripe')
    .not('stripe_session_id', 'is', null);
  if (filter.orderId) q = q.eq('order_id', filter.orderId);
  else if (filter.siteId) q = q.eq('site_id', filter.siteId);
  const since = new Date(Date.now() - (filter.days || 35) * 86400000).toISOString();
  q = q.gte('created_at', since).order('created_at', { ascending: true }).limit(filter.limit || 100);
  const { data: rows, error } = await q;
  if (error) throw error;
  const results = [];
  let recorded = 0;
  for (const p of rows || []) {
    try {
      const out = await syncPayment(p);
      if (out.recorded) recorded += 1;
      results.push(Object.assign({ payment_id: p.id, order_id: p.order_id }, out));
    } catch (e) {
      results.push({ payment_id: p.id, order_id: p.order_id, recorded: false, reason: String((e && e.message) || e) });
    }
  }
  return { checked: (rows || []).length, recorded: recorded, results: results };
}

module.exports = {
  stripeApi,
  paymentSettings,
  connectStatus,
  recordStripeSession,
  syncPayment,
  syncPendingPayments
};
