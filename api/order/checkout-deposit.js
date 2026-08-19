'use strict';

const { readBody, json, methodOk } = require('../../lib/order/http');
const { getAdmin } = require('../../lib/order/supabase');
const { resolveAccessToken } = require('../../lib/order/tokens');
const { requireUser, assertSiteAccess } = require('../../lib/order/auth');
const { writeAudit } = require('../../lib/order/audit');

const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://leadpages.com.au').replace(/\/+$/, '');

async function stripe(path, params) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) body.append(k, String(v));
  const r = await fetch('https://api.stripe.com/v1/' + path, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + (process.env.STRIPE_SECRET_KEY || ''),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
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

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['POST'])) return;
    if (!process.env.STRIPE_SECRET_KEY) return json(res, 500, { error: 'payments_not_configured' });

    const body = await readBody(req);
    const admin = getAdmin();
    let order = null;
    let actorSource = 'customer_portal';

    if (body.t || body.token) {
      const tok = await resolveAccessToken(body.t || body.token);
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

    const success =
      PUBLIC_BASE +
      '/order-portal?paid=1&order=' +
      encodeURIComponent(order.order_number);
    const cancel = PUBLIC_BASE + '/order-portal?cancelled=1&order=' + encodeURIComponent(order.order_number);

    const session = await stripe('checkout/sessions', {
      mode: 'payment',
      success_url: success,
      cancel_url: cancel,
      customer_email: order.customer_email || undefined,
      client_reference_id: payment.id,
      'line_items[0][price_data][currency]': 'aud',
      'line_items[0][price_data][product_data][name]': 'Deposit — ' + order.order_number,
      'line_items[0][price_data][unit_amount]': amount,
      'line_items[0][quantity]': 1,
      'metadata[order_id]': order.id,
      'metadata[payment_id]': payment.id,
      'metadata[kind]': 'order_deposit'
    });

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
      payload: { payment_id: payment.id, amount_cents: amount }
    });

    return json(res, 200, { url: session.data.url, payment_id: payment.id });
  } catch (e) {
    console.error('order/checkout-deposit', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
