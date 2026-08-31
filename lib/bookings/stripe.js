'use strict';

/**
 * Stripe helpers for Bookings — fetch-based (same pattern as Order Engine).
 * No stripe npm dependency required.
 */

const crypto = require('crypto');

const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://leadpages.com.au').replace(/\/+$/, '');

async function stripePost(path, params, opts) {
  opts = opts || {};
  const body = new URLSearchParams();
  Object.keys(params).forEach(function (k) {
    const v = params[k];
    if (v === undefined || v === null || v === '') return;
    body.append(k, String(v));
  });
  const headers = {
    Authorization: 'Bearer ' + (process.env.STRIPE_SECRET_KEY || ''),
    'Content-Type': 'application/x-www-form-urlencoded'
  };
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

function amountDueCents(booking) {
  const deposit = Number(booking.deposit_cents) || 0;
  const paid = Number(booking.amount_paid_cents) || 0;
  const total = Number(booking.total_cents) || 0;
  if (deposit > paid) return Math.max(0, deposit - paid);
  if (total > paid) return Math.max(0, total - paid);
  return 0;
}

function paymentKind(booking, amount) {
  const total = Number(booking.total_cents) || 0;
  const paid = Number(booking.amount_paid_cents) || 0;
  if (amount >= total - paid && total > 0) return 'full';
  if ((Number(booking.deposit_cents) || 0) > paid) return 'deposit';
  return 'balance';
}

function connectOpts(system) {
  const accountId = String(
    (system && system.stripe_connect_account_id) ||
      (system && system.settings && system.settings.stripe_connect_account_id) ||
      ''
  ).trim();
  const mode =
    system && system.settings && system.settings.stripe_charge_mode === 'direct'
      ? 'direct'
      : 'destination';
  return { accountId: accountId, mode: mode };
}

module.exports = {
  PUBLIC_BASE,
  stripePost,
  verifyStripeSig,
  amountDueCents,
  paymentKind,
  connectOpts
};
