'use strict';

/**
 * Deposit / payment rule resolution.
 * Inheritance: order override → product → category → business.
 */

function resolvePaymentRule(ctx) {
  // ctx: { system, category?, product?, orderOverride? }
  const o = ctx.orderOverride || {};
  const p = ctx.product || {};
  const c = ctx.category || {};
  const s = ctx.system || {};

  const rule =
    o.payment_rule ||
    p.payment_rule ||
    c.payment_rule ||
    s.payment_rule ||
    'none';

  let amountCents =
    o.deposit_amount_cents != null
      ? o.deposit_amount_cents
      : p.deposit_amount_cents != null
        ? p.deposit_amount_cents
        : c.deposit_amount_cents != null
          ? c.deposit_amount_cents
          : s.deposit_amount_cents != null
            ? s.deposit_amount_cents
            : 0;

  let percentBps =
    o.deposit_percent_bps != null
      ? o.deposit_percent_bps
      : p.deposit_percent_bps != null
        ? p.deposit_percent_bps
        : c.deposit_percent_bps != null
          ? c.deposit_percent_bps
          : s.deposit_percent_bps != null
            ? s.deposit_percent_bps
            : 0;

  const scope = o.deposit_scope || s.deposit_scope || 'per_order';

  return {
    payment_rule: rule,
    deposit_amount_cents: Number(amountCents) || 0,
    deposit_percent_bps: Number(percentBps) || 0,
    deposit_scope: scope,
    balance_settlement: s.balance_settlement || 'at_pickup'
  };
}

/**
 * Compute deposit due for an order.
 * For fixed per-order (butcher): always deposit_amount_cents regardless of TBC items.
 * For percentage: use known subtotal only (never invent unknown prices).
 */
function computeDepositRequired(rule, totals) {
  const r = rule.payment_rule || 'none';
  if (r === 'none' || r === 'pay_later' || r === 'quote_first') {
    return { deposit_required_cents: 0, requires_payment_before_confirm: r === 'quote_first' };
  }
  if (r === 'full_payment') {
    if (totals.has_unknown_prices) {
      // Cannot take full payment when prices unknown — fall back to fixed deposit if set
      if (rule.deposit_amount_cents > 0) {
        return { deposit_required_cents: rule.deposit_amount_cents, requires_payment_before_confirm: true };
      }
      return { deposit_required_cents: 0, requires_payment_before_confirm: false, note: 'full_payment_blocked_by_tbc' };
    }
    return {
      deposit_required_cents: Number(totals.known_subtotal_cents) || 0,
      requires_payment_before_confirm: true
    };
  }
  if (r === 'fixed_deposit') {
    return {
      deposit_required_cents: Number(rule.deposit_amount_cents) || 0,
      requires_payment_before_confirm: true
    };
  }
  if (r === 'percentage_deposit') {
    const base = Number(totals.known_subtotal_cents) || 0;
    const bps = Number(rule.deposit_percent_bps) || 0;
    return {
      deposit_required_cents: Math.round((base * bps) / 10000),
      requires_payment_before_confirm: true
    };
  }
  return { deposit_required_cents: 0, requires_payment_before_confirm: false };
}

function balanceRemaining(order) {
  const finalTotal =
    order.final_subtotal_cents != null
      ? Number(order.final_subtotal_cents)
      : order.price_status === 'known'
        ? Number(order.known_subtotal_cents) || 0
        : null;
  const paid = Number(order.deposit_paid_cents) || 0;
  if (finalTotal == null) return null;
  return Math.max(0, finalTotal + (Number(order.delivery_fee_cents) || 0) - paid);
}

module.exports = {
  resolvePaymentRule,
  computeDepositRequired,
  balanceRemaining
};
