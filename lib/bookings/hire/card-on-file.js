'use strict';

/**
 * Secure card-on-file via Stripe SetupIntent (no raw PAN storage).
 */

const { stripePost } = require('../stripe');

async function stripeRequest(method, path, params, connectOpts) {
  connectOpts = connectOpts || {};
  const opts = {};
  if (connectOpts.stripeAccount) opts.stripeAccount = connectOpts.stripeAccount;
  // stripePost is form-urlencoded POST only; emulate GET via Stripe API quirk with empty POST to retrieve is wrong.
  // For GET we use fetch directly.
  const clean = String(path || '').replace(/^\//, '');
  if (String(method).toUpperCase() === 'GET') {
    const headers = { Authorization: 'Bearer ' + (process.env.STRIPE_SECRET_KEY || '') };
    if (opts.stripeAccount) headers['Stripe-Account'] = opts.stripeAccount;
    const r = await fetch('https://api.stripe.com/v1/' + clean, { headers: headers });
    let j = null;
    try { j = await r.json(); } catch (_e) { j = null; }
    return { ok: r.ok, status: r.status, data: j };
  }
  return stripePost(clean, params || {}, opts);
}

const DEFAULT_CONSENT_VERSION = 'hire-card-authority-v1';
const DEFAULT_CONSENT_TEXT =
  'I authorise this business to securely store my card with the payment provider and charge it for agreed hire fees, cancellation fees, no-show charges, approved extensions, and other amounts I have authorised under the rental agreement. I understand the card may be charged later without being present, and that some charges may still require my authentication.';

function fundingLabel(funding) {
  const f = String(funding || 'unknown').toLowerCase();
  if (f === 'credit' || f === 'debit' || f === 'prepaid') return f;
  return 'unknown';
}

async function createSetupIntent(opts) {
  const system = opts.system;
  const customer = opts.customer;
  const connect = system.stripe_connect_account_id
    ? { stripeAccount: system.stripe_connect_account_id }
    : {};

  let stripeCustomerId = customer.stripe_customer_id || null;
  if (!stripeCustomerId) {
    const created = await stripeRequest('POST', '/customers', {
      name: customer.name || '',
      email: customer.email || undefined,
      phone: customer.phone || undefined,
      metadata: {
        booking_customer_id: customer.id,
        site_id: system.site_id
      }
    }, connect);
    if (!created.ok) return { ok: false, error: 'stripe_customer_failed', details: created.data };
    stripeCustomerId = created.data.id;
    if (opts.admin) {
      await opts.admin
        .from('booking_customers')
        .update({ stripe_customer_id: stripeCustomerId, updated_at: new Date().toISOString() })
        .eq('id', customer.id);
    }
  }

  const setup = await stripeRequest(
    'POST',
    '/setup_intents',
    {
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      usage: 'off_session',
      metadata: {
        booking_id: opts.bookingId || '',
        booking_customer_id: customer.id,
        site_id: system.site_id,
        purpose: 'hire_card_on_file'
      }
    },
    connect
  );
  if (!setup.ok) return { ok: false, error: 'setup_intent_failed', details: setup.data };

  return {
    ok: true,
    setup_intent_id: setup.data.id,
    client_secret: setup.data.client_secret,
    stripe_customer_id: stripeCustomerId,
    publishable_key: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY || '',
    connect_account_id: system.stripe_connect_account_id || null,
    consent_version: DEFAULT_CONSENT_VERSION,
    consent_text: (system.settings && system.settings.hire && system.settings.hire.card_consent_text) || DEFAULT_CONSENT_TEXT
  };
}

async function persistPaymentMethod(admin, opts) {
  const system = opts.system;
  const customer = opts.customer;
  const bookingId = opts.bookingId || null;
  const paymentMethodId = opts.paymentMethodId;
  if (!paymentMethodId) return { ok: false, error: 'payment_method_required' };
  if (!opts.consentAccepted) return { ok: false, error: 'consent_required' };

  const connect = system.stripe_connect_account_id
    ? { stripeAccount: system.stripe_connect_account_id }
    : {};
  const pm = await stripeRequest('GET', '/payment_methods/' + paymentMethodId, null, connect);
  if (!pm.ok) return { ok: false, error: 'payment_method_fetch_failed', details: pm.data };

  const card = pm.data.card || {};
  const row = {
    booking_system_id: system.id,
    site_id: system.site_id,
    customer_id: customer.id,
    booking_id: bookingId,
    provider: 'stripe',
    provider_customer_id: pm.data.customer || customer.stripe_customer_id || '',
    provider_payment_method_id: pm.data.id,
    brand: card.brand || '',
    last4: card.last4 || '',
    exp_month: card.exp_month || null,
    exp_year: card.exp_year || null,
    funding: fundingLabel(card.funding),
    country: card.country || '',
    fingerprint: card.fingerprint || '',
    is_default: true,
    provider_status: pm.data.customer ? 'attached' : 'detached',
    consent_at: new Date().toISOString(),
    consent_text_version: opts.consentVersion || DEFAULT_CONSENT_VERSION,
    consent_text: opts.consentText || DEFAULT_CONSENT_TEXT,
    consent_ip: opts.ip || '',
    consent_user_agent: opts.userAgent || '',
    meta: {
      setup_intent_id: opts.setupIntentId || null
    },
    updated_at: new Date().toISOString()
  };

  // Clear previous defaults
  await admin
    .from('booking_payment_methods')
    .update({ is_default: false })
    .eq('customer_id', customer.id)
    .eq('is_default', true);

  const { data: saved, error } = await admin
    .from('booking_payment_methods')
    .upsert(row, { onConflict: 'booking_system_id,provider,provider_payment_method_id' })
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };

  if (bookingId) {
    await admin
      .from('booking_hire_details')
      .update({
        card_on_file_status: 'secured',
        payment_authority_accepted: true,
        updated_at: new Date().toISOString()
      })
      .eq('booking_id', bookingId);
  }

  return {
    ok: true,
    payment_method: publicPaymentMethod(saved),
    display: displayCard(saved)
  };
}

function publicPaymentMethod(row) {
  if (!row) return null;
  return {
    id: row.id,
    provider: row.provider,
    brand: row.brand,
    last4: row.last4,
    exp_month: row.exp_month,
    exp_year: row.exp_year,
    funding: row.funding,
    country: row.country,
    is_default: row.is_default,
    provider_status: row.provider_status,
    consent_at: row.consent_at,
    consent_text_version: row.consent_text_version,
    // Never expose provider_payment_method_id to public clients in portal — staff only
    provider_payment_method_id: row.provider_payment_method_id,
    provider_customer_id: row.provider_customer_id
  };
}

function displayCard(row) {
  if (!row) return null;
  const brand = row.brand ? row.brand.charAt(0).toUpperCase() + row.brand.slice(1) : 'Card';
  const funding =
    row.funding === 'unknown' ? 'Card type unavailable' : row.funding.charAt(0).toUpperCase() + row.funding.slice(1);
  return {
    label: brand + ' ending ' + row.last4,
    expiry:
      row.exp_month && row.exp_year
        ? String(row.exp_month).padStart(2, '0') + '/' + String(row.exp_year).slice(-2)
        : '',
    funding_label: funding,
    status_label: 'Card secured — no payment taken'
  };
}

async function createOffSessionCharge(opts) {
  const system = opts.system;
  const pm = opts.paymentMethod;
  const connect = system.stripe_connect_account_id
    ? { stripeAccount: system.stripe_connect_account_id }
    : {};
  const intent = await stripeRequest(
    'POST',
    '/payment_intents',
    {
      amount: Math.round(Number(opts.amountCents) || 0),
      currency: (system.currency || 'aud').toLowerCase(),
      customer: pm.provider_customer_id,
      payment_method: pm.provider_payment_method_id,
      off_session: 'true',
      confirm: 'true',
      metadata: {
        booking_id: opts.bookingId || '',
        purpose: opts.purpose || 'hire_charge'
      }
    },
    connect
  );
  if (!intent.ok) {
    const errCode = intent.data && intent.data.error && intent.data.error.code;
    if (errCode === 'authentication_required') {
      return {
        ok: false,
        error: 'authentication_required',
        payment_intent: intent.data.error.payment_intent || null,
        requires_action: true
      };
    }
    return { ok: false, error: 'charge_failed', details: intent.data };
  }
  if (intent.data.status === 'requires_action') {
    return { ok: false, error: 'authentication_required', payment_intent: intent.data, requires_action: true };
  }
  if (intent.data.status !== 'succeeded') {
    return { ok: false, error: 'charge_incomplete', payment_intent: intent.data };
  }
  return { ok: true, payment_intent: intent.data };
}

module.exports = {
  DEFAULT_CONSENT_VERSION,
  DEFAULT_CONSENT_TEXT,
  fundingLabel,
  createSetupIntent,
  persistPaymentMethod,
  publicPaymentMethod,
  displayCard,
  createOffSessionCharge
};
