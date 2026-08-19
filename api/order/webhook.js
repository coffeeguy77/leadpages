'use strict';

/**
 * Stripe webhook for Order Engine deposits.
 * Prefer dedicating STRIPE_ORDER_WEBHOOK_SECRET; falls back to verifying metadata kind.
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function verifyStripeSig(rawBody, sigHeader, secret) {
  if (!secret || !sigHeader) return false;
  const parts = String(sigHeader).split(',').reduce(function (a, p) {
    const kv = p.split('=');
    a[kv[0]] = kv[1];
    return a;
  }, {});
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const payload = t + '.' + rawBody;
  const expected = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch (_e) {
    return false;
  }
}

module.exports = async function (req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).end('Method not allowed');
    let raw = '';
    if (typeof req.body === 'string') raw = req.body;
    else if (Buffer.isBuffer(req.body)) raw = req.body.toString('utf8');
    else raw = JSON.stringify(req.body || {});

    const secret = process.env.STRIPE_ORDER_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || '';
    const sig = req.headers['stripe-signature'];
    if (secret && !verifyStripeSig(raw, sig, secret)) {
      return res.status(400).json({ error: 'invalid_signature' });
    }

    let evt;
    try {
      evt = typeof req.body === 'object' && req.body && req.body.type ? req.body : JSON.parse(raw);
    } catch (_e) {
      return res.status(400).json({ error: 'bad_json' });
    }

    if (evt.type === 'checkout.session.completed') {
      const session = evt.data && evt.data.object;
      if (!session) return res.status(200).json({ ok: true });
      const meta = session.metadata || {};
      if (meta.kind !== 'order_deposit') return res.status(200).json({ ok: true, ignored: true });

      const paymentId = meta.payment_id || session.client_reference_id;
      const orderId = meta.order_id;
      if (!paymentId || !orderId) return res.status(200).json({ ok: true });

      const { data: payment } = await sb.from('order_payments').select('*').eq('id', paymentId).maybeSingle();
      if (!payment || payment.status === 'paid') return res.status(200).json({ ok: true });

      const amount = Number(session.amount_total) || payment.amount_cents;
      await sb
        .from('order_payments')
        .update({
          status: 'paid',
          amount_cents: amount,
          stripe_payment_intent_id: session.payment_intent || null,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentId);

      const { data: order } = await sb.from('order_orders').select('*').eq('id', orderId).single();
      if (order) {
        const paid = (Number(order.deposit_paid_cents) || 0) + amount;
        const patch = {
          deposit_paid_cents: paid,
          updated_at: new Date().toISOString()
        };
        if (order.status === 'awaiting_deposit') {
          patch.status = 'confirmed';
          patch.confirmed_at = patch.updated_at;
        }
        await sb.from('order_orders').update(patch).eq('id', orderId);
        await sb.from('order_audit_events').insert({
          order_system_id: order.order_system_id,
          site_id: order.site_id,
          order_id: order.id,
          event_type: 'deposit_paid',
          source: 'system',
          payload: { payment_id: paymentId, amount_cents: amount }
        });
      }
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('order/webhook', e);
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};
