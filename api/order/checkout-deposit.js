'use strict';

const { readBody, json, methodOk } = require('../../lib/order/http');
const { getAdmin } = require('../../lib/order/supabase');
const { resolveAccessToken } = require('../../lib/order/tokens');
const { requireUser, assertSiteAccess, getOrderSystemForSite } = require('../../lib/order/auth');
const { writeAudit } = require('../../lib/order/audit');

const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://leadpages.com.au').replace(/\/+$/, '');

async function stripe(path, params, opts) {
  opts = opts || {};
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    body.append(k, String(v));
  }
  const headers = {
    Authorization: 'Bearer ' + (process.env.STRIPE_SECRET_KEY || ''),
    'Content-Type': 'application/x-www-form-urlencoded'
  };
  // Direct charges on a connected account (optional Stripe Connect).
  if (opts.stripeAccount) headers['Stripe-Account'] = opts.stripeAccount;
  const r = await fetch('https://api.stripe.com/v1/' + path, {
    method: 'POST',
    headers: headers,
    body: body
  });
  let j = null;
  try {
    j = await r.json();
  } catch (_e) {
    j = null;
  }
  return { ok: r.ok, status: r.status, data: j };
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

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['POST'])) return;
    if (!process.env.STRIPE_SECRET_KEY) return json(res, 500, { error: 'payments_not_configured' });

    const body = await readBody(req);
    const admin = getAdmin();
    let order = null;
    let actorSource = 'customer_portal';
    let accessToken = body.t || body.token || '';

    if (accessToken) {
      const tok = await resolveAccessToken(accessToken);
      if (!tok) return json(res, 401, { error: 'invalid_or_expired_token' });
      const r = await admin.from('order_orders').select('*').eq('id', tok.order_id).single();
      order = r.data;
    } else {
      const user = await requireUser(req);
      if (!user) return json(res, 401, { error: 'auth' });
      const access = await assertSiteAccess(user, body.site_id);
      if (!access.ok) return json(res, access.code, { error: access.error });
      const r = await admin
        .from('order_orders')
        .select('*')
        .eq('id', body.order_id)
        .eq('site_id', body.site_id)
        .maybeSingle();
      order = r.data;
      actorSource = 'admin';
    }

    if (!order) return json(res, 404, { error: 'order_not_found' });
    const amount = Number(order.deposit_required_cents) || 0;
    if (amount <= 0) return json(res, 400, { error: 'no_deposit_required' });
    if ((Number(order.deposit_paid_cents) || 0) >= amount) {
      return json(res, 400, { error: 'deposit_already_paid' });
    }

    const system = await getOrderSystemForSite(order.site_id);
    const pay = paymentSettings(system);
    if (pay.provider === 'paypal') {
      return json(res, 501, {
        error: 'paypal_not_enabled',
        message: 'PayPal checkout is not enabled yet. Connect Stripe or switch provider to Stripe in Order Settings.'
      });
    }

    const { data: site } = await admin
      .from('sites')
      .select('id,slug,business_name')
      .eq('id', order.site_id)
      .maybeSingle();
    const businessName = (site && site.business_name) || 'Order deposit';
    const slug = (site && site.slug) || '';

    const { data: payment, error: pErr } = await admin
      .from('order_payments')
      .insert({
        order_id: order.id,
        site_id: order.site_id,
        kind: 'deposit',
        status: 'pending',
        amount_cents: amount,
        currency: 'AUD',
        provider: 'stripe'
      })
      .select('*')
      .single();
    if (pErr) throw pErr;

    const q = [];
    if (accessToken) q.push('t=' + encodeURIComponent(accessToken));
    if (slug) q.push('slug=' + encodeURIComponent(slug));
    q.push('order=' + encodeURIComponent(order.order_number));
    const baseQ = q.join('&');
    const success = PUBLIC_BASE + '/order-portal?paid=1&' + baseQ;
    const cancel = PUBLIC_BASE + '/order-portal?cancelled=1&' + baseQ;

    const productName = businessName + ' — Deposit — ' + order.order_number;
    const productDesc =
      'Deposit for order ' +
      order.order_number +
      (order.pickup_date ? ' · pickup ' + order.pickup_date : '');

    const sessionParams = {
      mode: 'payment',
      success_url: success,
      cancel_url: cancel,
      customer_email: order.customer_email || undefined,
      client_reference_id: payment.id,
      'line_items[0][price_data][currency]': 'aud',
      'line_items[0][price_data][product_data][name]': productName,
      'line_items[0][price_data][product_data][description]': productDesc,
      'line_items[0][price_data][unit_amount]': amount,
      'line_items[0][quantity]': 1,
      'metadata[order_id]': order.id,
      'metadata[payment_id]': payment.id,
      'metadata[kind]': 'order_deposit',
      'metadata[site_id]': order.site_id,
      'metadata[business_name]': businessName
    };

    if (pay.statement_suffix) {
      sessionParams['payment_intent_data[statement_descriptor_suffix]'] = pay.statement_suffix;
    }

    let stripeOpts = {};
    const connectId = pay.stripe_connect_account_id;
    if (connectId) {
      sessionParams['metadata[stripe_connect_account_id]'] = connectId;
      if (pay.stripe_charge_mode === 'direct') {
        // Charge the connected account directly (shows their branding on Checkout).
        stripeOpts = { stripeAccount: connectId };
      } else {
        // Destination charge on the platform → funds transfer to the connected account.
        sessionParams['payment_intent_data[transfer_data][destination]'] = connectId;
        sessionParams['payment_intent_data[on_behalf_of]'] = connectId;
      }
    }

    const session = await stripe('checkout/sessions', sessionParams, stripeOpts);

    if (!session.ok || !session.data || !session.data.url) {
      await admin.from('order_payments').update({ status: 'failed' }).eq('id', payment.id);
      return json(res, 502, { error: 'stripe_session_failed', detail: session.data });
    }

    await admin
      .from('order_payments')
      .update({
        stripe_session_id: session.data.id,
        payment_link_url: session.data.url,
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    await writeAudit({
      order_system_id: order.order_system_id,
      site_id: order.site_id,
      order_id: order.id,
      event_type: 'deposit_checkout_created',
      source: actorSource,
      payload: {
        payment_id: payment.id,
        amount_cents: amount,
        stripe_connect_account_id: connectId || null,
        charge_mode: connectId ? pay.stripe_charge_mode : 'platform'
      }
    });

    return json(res, 200, {
      url: session.data.url,
      payment_id: payment.id,
      business_name: businessName,
      connected: !!connectId
    });
  } catch (e) {
    console.error('order/checkout-deposit', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
