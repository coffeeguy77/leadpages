'use strict';

/**
 * Server-side pricing for Bookings. Never trust client totals.
 */

const { addCents } = require('./money');

function clampNonNeg(n) {
  n = Math.round(Number(n) || 0);
  return n < 0 ? 0 : n;
}

/**
 * @param {object} input
 * @param {object} input.system
 * @param {object} input.service
 * @param {object[]} [input.addons] — selected { price_cents, quantity }
 * @param {number} [input.attendeeCount]
 * @param {number} [input.durationMinutes] — override for per_hour
 * @param {number} [input.travelFeeCents]
 * @param {number} [input.discountCents]
 */
function quoteBooking(input) {
  const system = input.system || {};
  const service = input.service || {};
  const attendees = Math.max(1, Number(input.attendeeCount) || 1);
  const model = service.price_model || 'fixed';
  const base = clampNonNeg(service.price_cents);

  let subtotal = 0;
  if (model === 'free' || model === 'quote_required') {
    subtotal = 0;
  } else if (model === 'per_person') {
    subtotal = base * attendees;
  } else if (model === 'per_hour') {
    const mins = Number(input.durationMinutes != null ? input.durationMinutes : service.duration_minutes) || 60;
    subtotal = Math.round(base * (mins / 60));
  } else if (model === 'per_day') {
    subtotal = base;
  } else {
    // fixed | from | variable
    subtotal = base;
  }

  let addons = 0;
  (input.addons || []).forEach(function (a) {
    const q = Math.max(1, Number(a.quantity) || 1);
    addons = addCents(addons, clampNonNeg(a.price_cents) * q);
  });

  const travel = clampNonNeg(input.travelFeeCents);
  const discount = clampNonNeg(input.discountCents);
  const preTax = Math.max(0, addCents(subtotal, addons, travel) - discount);

  const gstMode = service.gst_treatment && service.gst_treatment !== 'inherit'
    ? service.gst_treatment
    : (system.gst_mode || 'inclusive');
  const rateBps = Number(system.gst_rate_bps) || 1000;
  let gst = 0;
  let total = preTax;
  if (gstMode === 'exclusive') {
    gst = Math.round(preTax * rateBps / 10000);
    total = addCents(preTax, gst);
  } else if (gstMode === 'inclusive') {
    gst = Math.round(preTax - preTax * 10000 / (10000 + rateBps));
    total = preTax;
  } else {
    gst = 0;
    total = preTax;
  }

  // Deposit
  let depositRule = service.deposit_rule || system.payment_rule || 'none';
  let deposit = 0;
  if (model === 'quote_required' || depositRule === 'none' || depositRule === 'pay_later' || depositRule === 'quote_required') {
    deposit = 0;
  } else if (depositRule === 'full_payment') {
    deposit = total;
  } else if (depositRule === 'fixed_deposit') {
    const fixed = service.deposit_amount_cents != null
      ? service.deposit_amount_cents
      : system.deposit_amount_cents;
    deposit = Math.min(total, clampNonNeg(fixed));
  } else if (depositRule === 'percentage_deposit') {
    const bps = service.deposit_percent_bps != null
      ? service.deposit_percent_bps
      : system.deposit_percent_bps;
    deposit = Math.min(total, Math.round(total * (Number(bps) || 0) / 10000));
  } else if (depositRule === 'card_guarantee') {
    deposit = 0;
  }

  return {
    price_model: model,
    quote_required: model === 'quote_required',
    subtotal_cents: subtotal,
    addons_cents: addons,
    travel_fee_cents: travel,
    discount_cents: discount,
    gst_cents: gst,
    gst_mode: gstMode,
    total_cents: total,
    deposit_cents: deposit,
    deposit_rule: depositRule,
    balance_cents: Math.max(0, total - deposit),
    currency: system.currency || 'AUD'
  };
}

module.exports = { quoteBooking };
