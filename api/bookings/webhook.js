'use strict';

/**
 * POST /api/bookings/webhook
 * Stripe webhook for Bookings deposits/payments.
 * Env: STRIPE_BOOKINGS_WEBHOOK_SECRET (fallback: STRIPE_ORDER_WEBHOOK_SECRET / STRIPE_WEBHOOK_SECRET)
 * Uses HMAC verify (no stripe npm package) — same pattern as Order Engine.
 */

const { getAdmin, json } = require('../../lib/bookings/auth');
const { verifyStripeSig } = require('../../lib/bookings/stripe');
const { enqueueNotification } = require('../../lib/bookings/notify');

function readRaw(req) {
  return new Promise(function (resolve, reject) {
    if (Buffer.isBuffer(req.body)) return resolve(req.body.toString('utf8'));
    if (typeof req.body === 'string') return resolve(req.body);
    if (req.body && typeof req.body === 'object' && req.body.type) {
      return resolve(JSON.stringify(req.body));
    }
    const chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () { resolve(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', reject);
  });
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  const secret =
    process.env.STRIPE_BOOKINGS_WEBHOOK_SECRET ||
    process.env.STRIPE_ORDER_WEBHOOK_SECRET ||
    process.env.STRIPE_WEBHOOK_SECRET ||
    '';

  let raw;
  try {
    raw = await readRaw(req);
  } catch (e) {
    return json(res, 400, { ok: false, error: 'bad_body' });
  }

  const sig = req.headers['stripe-signature'];
  if (secret && !verifyStripeSig(raw, sig, secret)) {
    return json(res, 400, { ok: false, error: 'invalid_signature' });
  }

  let event;
  try {
    event = typeof req.body === 'object' && req.body && req.body.type ? req.body : JSON.parse(raw);
  } catch (_e) {
    return json(res, 400, { ok: false, error: 'bad_json' });
  }

  const admin = getAdmin();

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data && event.data.object ? event.data.object : {};
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

      // Prefer updating pending payment row from checkout
      if (meta.payment_id) {
        await admin
          .from('booking_payments')
          .update({
            status: 'succeeded',
            provider_ref: providerRef,
            idempotency_key: idem,
            amount_cents: amount,
            updated_at: new Date().toISOString(),
            meta: { event_id: event.id }
          })
          .eq('id', meta.payment_id)
          .eq('booking_id', booking.id);
      } else {
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
      }

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

      if (booking.customer_email) {
        await enqueueNotification({
          booking_system_id: booking.booking_system_id,
          site_id: booking.site_id,
          booking_id: booking.id,
          channel: 'email',
          template_key: 'booking_payment_received',
          to_address: booking.customer_email,
          subject: 'Payment received — ' + booking.reference,
          body_text: 'We received your payment for booking ' + booking.reference + '.',
          payload: { amount_cents: amount }
        });
      }
    }
    return json(res, 200, { ok: true });
  } catch (e) {
    console.error('bookings webhook', e && e.message);
    return json(res, 500, { ok: false, error: 'webhook_failed' });
  }
};
