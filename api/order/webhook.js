'use strict';

/**
 * Stripe webhook for Order Engine deposits (platform + Connect events).
 *
 * The signature is checked against the raw body when we have it. Vercel may hand us an
 * already-parsed body, and re-serialising it never matches Stripe's signature — so when the
 * signature can't be verified, the event is fetched back from Stripe by id (with the
 * connected account header for Connect events) and only that copy is trusted.
 * Recording is idempotent (lib/order/stripe-pay.recordStripeSession).
 */

const crypto = require('crypto');
const { stripeApi, recordStripeSession } = require('../../lib/order/stripe-pay');

function verifyStripeSig(rawBody, sigHeader, secret) {
  if (!secret || !sigHeader || !rawBody) return false;
  const parts = {};
  String(sigHeader).split(',').forEach(function (kv) {
    const i = kv.indexOf('=');
    if (i > 0) {
      const k = kv.slice(0, i);
      if (!parts[k]) parts[k] = [];
      parts[k].push(kv.slice(i + 1));
    }
  });
  const t = parts.t && parts.t[0];
  if (!t || !parts.v1) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - parseInt(t, 10)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(t + '.' + rawBody, 'utf8').digest('hex');
  return parts.v1.some(function (v1) {
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(v1);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch (_e) {
      return false;
    }
  });
}

function secrets() {
  return [
    process.env.STRIPE_ORDER_WEBHOOK_SECRET,
    process.env.STRIPE_ORDER_CONNECT_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_SECRET
  ].filter(Boolean);
}

module.exports = async function (req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).end('Method not allowed');
    let raw = null;
    if (typeof req.body === 'string') raw = req.body;
    else if (Buffer.isBuffer(req.body)) raw = req.body.toString('utf8');

    let evt;
    try {
      evt = req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body) && req.body.type ? req.body : JSON.parse(raw || '{}');
    } catch (_e) {
      return res.status(400).json({ error: 'bad_json' });
    }
    if (!evt || !evt.id || !evt.type) return res.status(400).json({ error: 'bad_event' });

    const sig = req.headers['stripe-signature'];
    const verified = raw != null && secrets().some(function (s) { return verifyStripeSig(raw, sig, s); });
    if (!verified) {
      // Trust only Stripe's own copy of the event.
      const r = await stripeApi('GET', 'events/' + encodeURIComponent(evt.id), null, evt.account || null);
      if (!r.ok || !r.data || r.data.id !== evt.id) {
        console.error('order/webhook unverifiable event', evt.id, r.status);
        return res.status(400).json({ error: 'unverified_event' });
      }
      evt = Object.assign({}, r.data, { account: evt.account || r.data.account || null });
    }

    if (evt.type === 'checkout.session.completed' || evt.type === 'checkout.session.async_payment_succeeded') {
      const session = evt.data && evt.data.object;
      const out = await recordStripeSession(session, evt.account || null);
      if (out.recorded) console.log('order/webhook recorded', session && session.id, out.order_id);
      return res.status(200).json({ ok: true, recorded: !!out.recorded, reason: out.reason || null });
    }
    return res.status(200).json({ ok: true, ignored: true });
  } catch (e) {
    console.error('order/webhook', e);
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};
