'use strict';

/**
 * Payments ledger — every payment for a shop as an accounting line.
 *
 *  Date      the day the money was received (meta.received_on → paid_at → created_at),
 *            in the shop's time zone
 *  Method    stripe | eftpos | cash_deposit | direct_deposit | contra | other
 *  Status    received | refund_due | refunded | pending | failed | cancelled
 *  Channel   counter (Cash, EFTPOS) · remote (Stripe, Direct deposit) · contra (no money moves)
 *
 * Totals count "received" lines only. A Stripe payment taken on the platform account
 * (before the shop connected its own Stripe) is flagged `stripe_platform`, so accounts know it
 * is not in the shop's Stripe balance.
 */

const METHODS = {
  stripe: { label: 'Stripe (online card)', channel: 'remote' },
  eftpos: { label: 'EFTPOS', channel: 'counter' },
  cash_deposit: { label: 'Cash', channel: 'counter' },
  direct_deposit: { label: 'Direct deposit', channel: 'remote' },
  contra: { label: 'Contra', channel: 'contra' },
  other: { label: 'Other', channel: 'remote' }
};

const CHANNELS = {
  counter: 'Over the counter',
  remote: 'Remote',
  contra: 'Contra'
};

function methodOf(p) {
  const raw = String((p && (p.provider || (p.meta && p.meta.method))) || '').toLowerCase();
  if (raw === 'cash') return 'cash_deposit';
  return METHODS[raw] ? raw : 'other';
}

/** YYYY-MM-DD of an instant in a time zone. */
function localDate(iso, tz) {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return String(iso);
  const d = new Date(iso);
  if (isNaN(d)) return null;
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } catch (_e) {
    return d.toISOString().slice(0, 10);
  }
}

function statusOf(p) {
  const m = (p && p.meta) || {};
  if (p.status === 'paid') return m.refund_due ? 'refund_due' : 'received';
  if (p.status === 'refunded') return 'refunded';
  if (p.status === 'cancelled') return 'cancelled';
  if (p.status === 'failed') return 'failed';
  return 'pending';
}

const STATUS_LABELS = {
  received: 'Received',
  refund_due: 'Refund due',
  refunded: 'Refunded',
  pending: 'Not finished',
  failed: 'Failed',
  cancelled: 'Voided'
};

/**
 * @param {object} p      order_payments row (with optional `order` embed)
 * @param {string} tz
 */
function ledgerLine(p, tz) {
  const m = (p && p.meta) || {};
  const method = methodOf(p);
  const status = statusOf(p);
  const order = p.order || {};
  const when = m.received_on || p.paid_at || p.created_at;
  return {
    id: p.id,
    date: localDate(when, tz),
    recorded_at: p.created_at,
    order_id: p.order_id,
    order_number: order.order_number || null,
    customer_name: order.customer_name || null,
    amount_cents: Number(p.amount_cents) || 0,
    kind: p.kind,
    method: method,
    method_label: METHODS[method].label,
    channel: METHODS[method].channel,
    status: status,
    status_label: STATUS_LABELS[status],
    stripe_platform: method === 'stripe' && status !== 'pending' && !m.stripe_account,
    payer_name: m.payer_name || null,
    bank_reference: m.bank_reference || null,
    notes: m.notes || m.note || null,
    staff_recorded: !!m.staff_recorded,
    corrected: !!m.corrected
  };
}

function inRange(line, from, to) {
  if (!line.date) return !from && !to;
  if (from && line.date < from) return false;
  if (to && line.date > to) return false;
  return true;
}

/** Totals for received lines: by method, by channel, overall. */
function ledgerTotals(lines) {
  const byMethod = {};
  const byChannel = { counter: 0, remote: 0, contra: 0 };
  let total = 0;
  let count = 0;
  let refundDue = 0;
  let platform = 0;
  lines.forEach(function (l) {
    if (l.status === 'refund_due') refundDue += l.amount_cents;
    if (l.status !== 'received') return;
    count += 1;
    total += l.amount_cents;
    byMethod[l.method] = byMethod[l.method] || { method: l.method, label: l.method_label, count: 0, cents: 0 };
    byMethod[l.method].count += 1;
    byMethod[l.method].cents += l.amount_cents;
    byChannel[l.channel] = (byChannel[l.channel] || 0) + l.amount_cents;
    if (l.stripe_platform) platform += l.amount_cents;
  });
  return {
    count: count,
    total_cents: total,
    money_cents: total - byChannel.contra,
    by_method: Object.keys(METHODS).filter(function (k) { return byMethod[k]; }).map(function (k) { return byMethod[k]; }),
    by_channel: byChannel,
    refund_due_cents: refundDue,
    stripe_platform_cents: platform
  };
}

/** Australian financial year (1 July – 30 June) containing `today` (YYYY-MM-DD). */
function financialYear(today) {
  const y = Number(String(today).slice(0, 4));
  const m = Number(String(today).slice(5, 7));
  const start = m >= 7 ? y : y - 1;
  return { from: start + '-07-01', to: start + 1 + '-06-30' };
}

module.exports = {
  METHODS,
  CHANNELS,
  STATUS_LABELS,
  methodOf,
  localDate,
  statusOf,
  ledgerLine,
  inRange,
  ledgerTotals,
  financialYear
};
