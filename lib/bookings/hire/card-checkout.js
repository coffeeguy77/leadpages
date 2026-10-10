'use strict';

/**
 * Save a card for a hire booking with Stripe Checkout in "setup" mode — the
 * customer enters their card on Stripe's own page, nothing is charged, and staff
 * can charge it later. Runs on the business's connected Stripe account
 * (booking_systems.stripe_connect_account_id); without one this is not offered,
 * so money never lands in the platform account.
 */

const { stripePost } = require('../stripe');
const { persistPaymentMethod, DEFAULT_CONSENT_TEXT, DEFAULT_CONSENT_VERSION } = require('./card-on-file');

function connectId(system) {
  const id = String((system && system.stripe_connect_account_id) || '').trim();
  return /^acct_[A-Za-z0-9]+$/.test(id) ? id : '';
}

function cardSavingAvailable(system) {
  return !!(process.env.STRIPE_SECRET_KEY && connectId(system));
}

async function stripeGet(path, acct) {
  const headers = { Authorization: 'Bearer ' + (process.env.STRIPE_SECRET_KEY || '') };
  if (acct) headers['Stripe-Account'] = acct;
  const r = await fetch('https://api.stripe.com/v1/' + path, { headers: headers });
  let j = null;
  try { j = await r.json(); } catch (_e) { j = null; }
  return { ok: r.ok, status: r.status, data: j };
}

/** Add a query param to a URL string. */
function withParams(url, params) {
  const u = new URL(url);
  Object.keys(params).forEach(function (k) { u.searchParams.set(k, params[k]); });
  return u.toString();
}

/**
 * @returns {Promise<{ok:boolean, url?:string, error?:string}>}
 */
async function startCardCheckout(opts) {
  const admin = opts.admin;
  const system = opts.system;
  const booking = opts.booking;
  const acct = connectId(system);
  if (!acct) return { ok: false, error: 'card_saving_not_configured' };

  const { data: customer } = await admin.from('booking_customers').select('*').eq('id', booking.customer_id).maybeSingle();
  if (!customer) return { ok: false, error: 'customer_not_found' };

  let cus = customer.stripe_customer_id || '';
  if (!cus) {
    const made = await stripePost('customers', {
      name: customer.name || booking.customer_name || '',
      email: customer.email || booking.customer_email || '',
      phone: customer.phone || booking.customer_phone || '',
      'metadata[booking_customer_id]': customer.id,
      'metadata[site_id]': system.site_id
    }, { stripeAccount: acct });
    if (!made.ok) return { ok: false, error: 'stripe_customer_failed' };
    cus = made.data.id;
    await admin.from('booking_customers').update({ stripe_customer_id: cus, updated_at: new Date().toISOString() }).eq('id', customer.id);
  }

  const back = opts.returnUrl;
  const session = await stripePost('checkout/sessions', {
    mode: 'setup',
    customer: cus,
    'payment_method_types[0]': 'card',
    success_url: withParams(back, { bkh_ref: booking.reference, bkh_t: opts.portalToken }) + '&bkh_cs={CHECKOUT_SESSION_ID}',
    cancel_url: withParams(back, { bkh_ref: booking.reference, bkh_t: opts.portalToken, bkh_cancel: '1' }),
    'metadata[booking_id]': booking.id,
    'metadata[purpose]': 'hire_card_on_file',
    'setup_intent_data[metadata][booking_id]': booking.id,
    'setup_intent_data[metadata][site_id]': system.site_id,
    'custom_text[submit][message]': 'Your card is saved securely for this hire. Nothing is charged now.'
  }, { stripeAccount: acct });
  if (!session.ok || !session.data || !session.data.url) return { ok: false, error: 'stripe_checkout_failed' };

  await admin.from('booking_hire_details').update({ card_on_file_status: 'setup_required', updated_at: new Date().toISOString() }).eq('booking_id', booking.id);
  return { ok: true, url: session.data.url, session_id: session.data.id };
}

/** After Stripe sends the customer back: record the saved card on the booking. */
async function finishCardCheckout(opts) {
  const admin = opts.admin;
  const system = opts.system;
  const booking = opts.booking;
  const acct = connectId(system);
  if (!acct) return { ok: false, error: 'card_saving_not_configured' };
  const sid = String(opts.sessionId || '');
  if (!/^cs_[A-Za-z0-9_]+$/.test(sid)) return { ok: false, error: 'bad_session' };

  const s = await stripeGet('checkout/sessions/' + encodeURIComponent(sid) + '?expand[]=setup_intent', acct);
  if (!s.ok || !s.data) return { ok: false, error: 'session_lookup_failed' };
  const meta = s.data.metadata || {};
  if (meta.booking_id !== booking.id) return { ok: false, error: 'session_mismatch' };
  const si = s.data.setup_intent || {};
  if (si.status !== 'succeeded' || !si.payment_method) return { ok: false, error: 'card_not_saved', status: si.status || s.data.status };

  const { data: customer } = await admin.from('booking_customers').select('*').eq('id', booking.customer_id).maybeSingle();
  if (!customer) return { ok: false, error: 'customer_not_found' };
  const pmId = typeof si.payment_method === 'string' ? si.payment_method : si.payment_method.id;
  const saved = await persistPaymentMethod(admin, {
    system: system,
    customer: customer,
    bookingId: booking.id,
    paymentMethodId: pmId,
    consentAccepted: true,
    consentVersion: DEFAULT_CONSENT_VERSION,
    consentText: (system.settings && system.settings.hire && system.settings.hire.card_consent_text) || DEFAULT_CONSENT_TEXT,
    setupIntentId: si.id,
    ip: opts.ip || '',
    userAgent: opts.userAgent || ''
  });
  return saved && saved.ok !== false ? { ok: true, card: saved.card || saved.payment_method || null } : saved;
}

module.exports = { cardSavingAvailable, startCardCheckout, finishCardCheckout, connectId };
