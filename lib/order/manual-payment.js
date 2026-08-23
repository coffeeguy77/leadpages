'use strict';

const { getAdmin } = require('./supabase');
const { writeAudit } = require('./audit');
const { recalculateOrder } = require('./service');
const {
  INHOUSE_METHODS,
  normaliseInhouseMethod,
  inhouseMethodLabel
} = require('./inhouse-methods');

/**
 * Record an in-house deposit payment and update order totals/status.
 */
async function recordInhousePayment(opts) {
  const admin = getAdmin();
  const order = opts.order;
  const system = opts.system;
  const site = opts.site;
  const actor = opts.actor || {};
  const method = normaliseInhouseMethod(opts.method);
  if (!method) throw Object.assign(new Error('invalid_payment_method'), { code: 400 });
  if (!order || !order.id) throw Object.assign(new Error('order_required'), { code: 400 });

  var amountCents = opts.amount_cents;
  if (amountCents == null || amountCents === '') {
    amountCents = order.deposit_required_cents || 0;
  }
  amountCents = Math.max(0, Math.round(Number(amountCents) || 0));
  if (!amountCents) throw Object.assign(new Error('amount_required'), { code: 400 });

  const now = new Date().toISOString();
  const provider = INHOUSE_METHODS[method].provider;
  const notes = opts.notes ? String(opts.notes).trim().slice(0, 2000) : '';

  const { data: payment, error: pErr } = await admin
    .from('order_payments')
    .insert({
      order_id: order.id,
      site_id: order.site_id,
      kind: 'deposit',
      status: 'paid',
      amount_cents: amountCents,
      currency: order.currency || system.currency || 'AUD',
      provider: provider,
      paid_at: now,
      meta: { method: method, notes: notes, staff_recorded: true },
      created_by: actor.user_id || null
    })
    .select('*')
    .single();
  if (pErr) throw pErr;

  const newPaid = (order.deposit_paid_cents || 0) + amountCents;
  const patch = {
    deposit_paid_cents: newPaid,
    updated_at: now
  };
  if (
    order.status === 'awaiting_deposit' &&
    newPaid >= (order.deposit_required_cents || 0)
  ) {
    patch.status = 'confirmed';
    patch.confirmed_at = order.confirmed_at || now;
  }

  const { data: updated, error: uErr } = await admin
    .from('order_orders')
    .update(patch)
    .eq('id', order.id)
    .select('*')
    .single();
  if (uErr) throw uErr;

  await recalculateOrder(order.id);

  await writeAudit({
    order_system_id: system.id,
    site_id: site.id,
    order_id: order.id,
    event_type: 'inhouse_payment_recorded',
    actor_user_id: actor.user_id || null,
    actor_label: actor.label || null,
    source: 'admin',
    payload: {
      method: method,
      amount_cents: amountCents,
      notes: notes,
      payment_id: payment.id
    }
  });

  return { payment: payment, order: updated };
}

module.exports = {
  INHOUSE_METHODS,
  normaliseInhouseMethod,
  inhouseMethodLabel,
  recordInhousePayment
};
