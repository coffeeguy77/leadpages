'use strict';

/**
 * POST /api/bookings/webhook
 * Stripe webhook for Bookings deposits/payments.
 * Env: STRIPE_BOOKINGS_WEBHOOK_SECRET (fallback: STRIPE_ORDER_WEBHOOK_SECRET / STRIPE_WEBHOOK_SECRET)
 */

const Stripe = require('stripe');
const { getAdmin, json } = require('../../lib/bookings/auth');

function readRaw(req) {
  return new Promise(function (resolve, reject) {
    if (Buffer.isBuffer(req.body)) return resolve(req.body);
    if (typeof req.body === 'string') return resolve(Buffer.from(req.body));
    const chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () { resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
  });
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  const secret =
    process.env.STRIPE_BOOKINGS_WEBHOOK_SECRET ||
    process.env.STRIPE_ORDER_WEBHOOK_SECRET ||
    process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!secret || !key) {
    return json(res, 503, { ok: false, error: 'stripe_not_configured' });
  }

  const stripe = new Stripe(key, { apiVersion: '2023-10-16' });
  let event;
  try {
    const raw = await readRaw(req);
    event = stripe.webhooks.constructEvent(raw, req.headers['stripe-signature'], secret);
  } catch (e) {
    console.error('bookings webhook verify', e && e.message);
    return json(res, 400, { ok: false, error: 'invalid_signature' });
  }

  const admin = getAdmin();

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const meta = session.metadata || {};
      if (meta.kind !== 'booking_deposit' && meta.kind !== 'booking_payment') {
        return json(res, 200, { ok: true, ignored: true });
      }
      const bookingId = meta.booking_id;
      if (!bookingId) return json(res, 200, { ok: true, ignored: true });

      const amount = Number(session.amount_total) || 0;
      const providerRef = session.id;
      const idem = 'stripe:' + event.id;

      const { data: existing } = await admin
        .from('booking_payments')
        .select('id')
        .eq('idempotency_key', idem)
        .maybeSingle();
      if (existing) return json(res, 200, { ok: true, duplicate: true });

      const { data: booking } = await admin.from('bookings').select('*').eq('id', bookingId).maybeSingle();
      if (!booking) return json(res, 200, { ok: true, missing_booking: true });

      await admin.from('booking_payments').insert({
        booking_id: booking.id,
        booking_system_id: booking.booking_system_id,
        site_id: booking.site_id,
        provider: 'stripe',
        kind: meta.kind === 'booking_payment' ? 'full' : 'deposit',
        amount_cents: amount,
        currency: (session.currency || 'aud').toUpperCase(),
        status: 'succeeded',
        provider_ref: providerRef,
        idempotency_key: idem,
        meta: { event_id: event.id }
      });

      const paid = (Number(booking.amount_paid_cents) || 0) + amount;
      const paymentStatus = paid >= (Number(booking.total_cents) || 0) ? 'paid' : 'deposit_paid';
      const nextStatus =
        booking.status === 'awaiting_payment' || booking.status === 'pending'
          ? 'confirmed'
          : booking.status;

      await admin.from('bookings').update({
        amount_paid_cents: paid,
        payment_status: paymentStatus,
        status: nextStatus,
        updated_at: new Date().toISOString()
      }).eq('id', booking.id);

      await admin.from('booking_activity').insert({
        booking_id: booking.id,
        booking_system_id: booking.booking_system_id,
        site_id: booking.site_id,
        event_type: 'payment_received',
        summary: 'Stripe payment ' + amount + ' cents',
        meta: { provider_ref: providerRef, event_id: event.id }
      });
    }
    return json(res, 200, { ok: true });
  } catch (e) {
    console.error('bookings webhook', e && e.message);
    return json(res, 500, { ok: false, error: 'webhook_failed' });
  }
};
