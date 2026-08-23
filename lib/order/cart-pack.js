'use strict';

/**
 * Pack a cart for storefront / portal client responses.
 */

const { resolvePaymentRule, computeDepositRequired } = require('./deposit');
const { earliestPickupForCart } = require('./cart');
const { computeOrderTotals } = require('./pricing');
const { formatAud } = require('./money');
const { listWindows, buildPickupSlots, parsePickupSchedule } = require('./fulfilment-windows');

async function packCartResponse(system, packed, opts) {
  opts = opts || {};
  const payRule = resolvePaymentRule({ system: system });
  const deposit = computeDepositRequired(payRule, {
    known_subtotal_cents: packed.cart.known_subtotal_cents,
    has_unknown_prices: packed.cart.has_unknown_prices
  });
  const agg = computeOrderTotals(packed.items || []);
  const out = {
    cart: packed.cart,
    items: packed.items,
    deposit: deposit,
    display: {
      known_subtotal: formatAud(agg.known_subtotal_cents),
      estimated_subtotal:
        agg.estimated_subtotal_cents != null ? formatAud(agg.estimated_subtotal_cents) : null,
      deposit: formatAud(deposit.deposit_required_cents),
      cta: deposit.deposit_required_cents > 0 ? 'Review order' : 'CONFIRM ORDER'
    }
  };
  if (opts.lite) return out;
  const windows = await listWindows(system.id);
  const earliest = earliestPickupForCart(system, packed.items);
  const schedule = parsePickupSchedule(system);
  out.earliest_pickup_date = earliest;
  out.pickup_slots = buildPickupSlots(windows, earliest, 28, schedule);
  return out;
}

module.exports = { packCartResponse };
