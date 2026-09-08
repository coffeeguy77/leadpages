'use strict';

/**
 * Hire pricing — daily rates, modifiers, extras, bond, GST.
 */

const { addCents } = require('../money');
const { quoteBooking } = require('../pricing');
const { zonedParts } = require('../time');
const { listOccupiedDays } = require('./duration');

function clampNonNeg(n) {
  n = Math.round(Number(n) || 0);
  return n < 0 ? 0 : n;
}

function isWeekend(ymd, timeZone) {
  const parts = String(ymd).split('-').map(Number);
  const guess = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 2, 0, 0));
  const p = zonedParts(guess, timeZone || 'Australia/Sydney');
  return p.weekday === 0 || p.weekday === 6;
}

function resolveDailyRateCents(resource, service, system, ymd) {
  const hire = (system && system.settings && system.settings.hire) || {};
  const holidays = hire.public_holidays || [];
  let rate =
    resource && resource.default_daily_rate_cents != null
      ? clampNonNeg(resource.default_daily_rate_cents)
      : clampNonNeg(service && service.price_cents);

  if (holidays.indexOf(ymd) >= 0) {
    const hol =
      resource && resource.public_holiday_rate_cents != null
        ? resource.public_holiday_rate_cents
        : hire.public_holiday_rate_cents;
    if (hol != null) rate = clampNonNeg(hol);
  } else if (isWeekend(ymd, system && system.timezone)) {
    const wk =
      resource && resource.weekend_rate_cents != null
        ? resource.weekend_rate_cents
        : hire.weekend_rate_cents;
    if (wk != null) rate = clampNonNeg(wk);
  }
  return rate;
}

function multiDayDiscountBps(hireDays, system) {
  const bands = ((system && system.settings && system.settings.hire) || {}).multi_day_discounts || [];
  let best = 0;
  (bands || []).forEach(function (b) {
    if (hireDays >= Number(b.min_days || 0)) {
      best = Math.max(best, Number(b.discount_bps) || 0);
    }
  });
  return best;
}

function quoteHire(input) {
  const system = input.system || {};
  const service = input.service || {};
  const resource = input.resource || {};
  const win = input.window || {};
  const tz = win.timezone || system.timezone || 'Australia/Sydney';
  const days =
    win.occupied_days ||
    listOccupiedDays(new Date(win.pickup_at), new Date(win.return_at), tz);
  const chargeableDays = Math.max(1, Number(win.chargeable_days) || days.length || 1);

  const lineItems = [];
  let hireSubtotal = 0;
  const dayRates = [];

  const billDays = days.slice(0, chargeableDays);
  while (billDays.length < chargeableDays && billDays.length > 0) {
    billDays.push(billDays[billDays.length - 1]);
  }
  if (!billDays.length) billDays.push(String(win.pickup_at || '').slice(0, 10));

  billDays.forEach(function (ymd, idx) {
    const rate = resolveDailyRateCents(resource, service, system, ymd);
    dayRates.push({ day: ymd, rate_cents: rate });
    hireSubtotal = addCents(hireSubtotal, rate);
    lineItems.push({
      code: 'hire_day',
      description:
        (resource.public_name || resource.name || service.name || 'Hire') +
        ' — day ' +
        (idx + 1) +
        ' (' +
        ymd +
        ')',
      quantity: 1,
      unit_price_cents: rate,
      line_total_cents: rate
    });
  });

  const discountBps = multiDayDiscountBps(chargeableDays, system);
  let multiDayDiscount = 0;
  if (discountBps > 0) {
    multiDayDiscount = Math.round((hireSubtotal * discountBps) / 10000);
    lineItems.push({
      code: 'multi_day_discount',
      description: 'Multi-day discount (' + (discountBps / 100).toFixed(1) + '%)',
      quantity: 1,
      unit_price_cents: -multiDayDiscount,
      line_total_cents: -multiDayDiscount
    });
  }

  let extrasTotal = 0;
  (input.extras || []).forEach(function (x) {
    const q = Math.max(1, Number(x.quantity) || 1);
    const line = clampNonNeg(x.price_cents) * q;
    extrasTotal = addCents(extrasTotal, line);
    lineItems.push({
      code: 'extra',
      description: x.name || 'Extra',
      quantity: q,
      unit_price_cents: clampNonNeg(x.price_cents),
      line_total_cents: line
    });
  });

  const delivery = clampNonNeg(input.deliveryFeeCents);
  const pickupFee = clampNonNeg(input.pickupFeeCents);
  const cleaning =
    input.cleaningFeeCents != null
      ? clampNonNeg(input.cleaningFeeCents)
      : clampNonNeg(resource.cleaning_fee_cents);

  [
    [delivery, 'delivery', 'Delivery'],
    [pickupFee, 'pickup_fee', 'Pickup fee'],
    [cleaning, 'cleaning', 'Cleaning fee']
  ].forEach(function (row) {
    if (!row[0]) return;
    lineItems.push({
      code: row[1],
      description: row[2],
      quantity: 1,
      unit_price_cents: row[0],
      line_total_cents: row[0]
    });
  });

  const manualAdj = Math.round(Number(input.manualAdjustmentCents) || 0);
  if (manualAdj) {
    lineItems.push({
      code: 'adjustment',
      description: input.manualAdjustmentReason || 'Manual adjustment',
      quantity: 1,
      unit_price_cents: manualAdj,
      line_total_cents: manualAdj
    });
  }

  const discount = clampNonNeg(input.discountCents);
  if (discount) {
    lineItems.push({
      code: 'discount',
      description: 'Discount',
      quantity: 1,
      unit_price_cents: -discount,
      line_total_cents: -discount
    });
  }

  const rentalPreTax = Math.max(
    0,
    hireSubtotal - multiDayDiscount + extrasTotal + delivery + pickupFee + cleaning + manualAdj - discount
  );

  const gstQuote = quoteBooking({
    system: system,
    service: Object.assign({}, service, {
      price_model: 'fixed',
      price_cents: rentalPreTax,
      deposit_rule: service.deposit_rule || system.payment_rule || 'card_guarantee'
    }),
    addons: [],
    attendeeCount: 1,
    travelFeeCents: 0,
    discountCents: 0
  });

  const bond =
    input.includeBond === false
      ? 0
      : clampNonNeg(
          resource.bond_cents != null
            ? resource.bond_cents
            : (system.settings && system.settings.hire && system.settings.hire.default_bond_cents) || 0
        );

  if (bond) {
    lineItems.push({
      code: 'bond',
      description: 'Security bond (held separately)',
      quantity: 1,
      unit_price_cents: bond,
      line_total_cents: bond,
      is_bond: true
    });
  }

  return {
    ok: true,
    price_model: 'hire_daily',
    chargeable_days: chargeableDays,
    occupied_days: days,
    day_rates: dayRates,
    hire_subtotal_cents: hireSubtotal,
    multi_day_discount_cents: multiDayDiscount,
    multi_day_discount_bps: discountBps,
    extras_cents: extrasTotal,
    delivery_fee_cents: delivery,
    pickup_fee_cents: pickupFee,
    cleaning_fee_cents: cleaning,
    discount_cents: discount,
    manual_adjustment_cents: manualAdj,
    rental_cents: gstQuote.subtotal_cents,
    gst_cents: gstQuote.gst_cents,
    gst_mode: gstQuote.gst_mode,
    total_cents: gstQuote.total_cents,
    bond_cents: bond,
    amount_payable_cents: addCents(gstQuote.total_cents, bond),
    deposit_cents: gstQuote.deposit_cents,
    deposit_rule: gstQuote.deposit_rule,
    balance_cents: gstQuote.balance_cents,
    currency: gstQuote.currency || system.currency || 'AUD',
    line_items: lineItems,
    snapshot: {
      computed_at: new Date().toISOString(),
      resource_id: resource.id || null,
      service_id: service.id || null,
      chargeable_days: chargeableDays,
      day_rates: dayRates,
      line_items: lineItems,
      total_cents: gstQuote.total_cents,
      bond_cents: bond
    }
  };
}

function priceChangeDiff(previousQuote, nextQuote) {
  const prevTotal = clampNonNeg(previousQuote && previousQuote.total_cents);
  const nextTotal = clampNonNeg(nextQuote && nextQuote.total_cents);
  const prevBond = clampNonNeg(previousQuote && previousQuote.bond_cents);
  const nextBond = clampNonNeg(nextQuote && nextQuote.bond_cents);
  return {
    previous_total_cents: prevTotal,
    new_total_cents: nextTotal,
    delta_cents: nextTotal - prevTotal,
    previous_bond_cents: prevBond,
    new_bond_cents: nextBond,
    bond_delta_cents: nextBond - prevBond,
    additional_due_cents: Math.max(0, nextTotal - prevTotal),
    credit_cents: Math.max(0, prevTotal - nextTotal)
  };
}

module.exports = {
  quoteHire,
  priceChangeDiff,
  resolveDailyRateCents,
  multiDayDiscountBps,
  isWeekend
};
