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
  const trace = traceFields(opts);

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
      paid_at: trace.received_on ? receivedAtIso(trace.received_on) : now,
      meta: Object.assign({ method: method, notes: notes, staff_recorded: true }, trace),
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
    payload: Object.assign({
      method: method,
      amount_cents: amountCents,
      notes: notes,
      payment_id: payment.id
    }, trace)
  });

  return { payment: payment, order: updated };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Optional tracing details: date received, payer name on the bank statement, bank reference. */
function traceFields(opts) {
  const out = {};
  if (opts.received_on != null && opts.received_on !== '') {
    if (!DATE.test(String(opts.received_on))) throw Object.assign(new Error('invalid_received_on'), { code: 400 });
    out.received_on = String(opts.received_on);
  }
  if (opts.payer_name) out.payer_name = String(opts.payer_name).trim().slice(0, 120);
  if (opts.bank_reference) out.bank_reference = String(opts.bank_reference).trim().slice(0, 120);
  return out;
}

/** Midday that day in Sydney, so the date never shifts across time zones. */
function receivedAtIso(day) {
  return day + 'T02:00:00.000Z';
}

async function loadStaffPayment(admin, paymentId, siteId) {
  const { data: payment } = await admin.from('order_payments').select('*').eq('id', paymentId).eq('site_id', siteId).maybeSingle();
  if (!payment) throw Object.assign(new Error('payment_not_found'), { code: 404 });
  if (!(payment.meta && payment.meta.staff_recorded)) {
    // Stripe payments are corrected in Stripe (refunds), not here.
    throw Object.assign(new Error('only_manual_payments'), { code: 400 });
  }
  const { data: order } = await admin.from('order_orders').select('*').eq('id', payment.order_id).maybeSingle();
  if (!order) throw Object.assign(new Error('order_required'), { code: 400 });
  return { payment, order };
}

/**
 * Correct a staff-recorded payment (amount, method, date received, payer, reference, notes).
 * The order's deposit paid moves by the difference. Every change is logged.
 */
async function correctInhousePayment(opts) {
  const admin = getAdmin();
  const actor = opts.actor || {};
  const { payment, order } = await loadStaffPayment(admin, opts.payment_id, opts.site_id);
  if (payment.status !== 'paid') throw Object.assign(new Error('payment_voided'), { code: 400 });
  const patch = { updated_at: new Date().toISOString() };
  const meta = Object.assign({}, payment.meta || {});
  const before = { amount_cents: payment.amount_cents, provider: payment.provider, meta: payment.meta, paid_at: payment.paid_at };
  if (opts.amount_cents != null && opts.amount_cents !== '') {
    const amt = Math.round(Number(opts.amount_cents));
    if (!Number.isFinite(amt) || amt <= 0) throw Object.assign(new Error('amount_required'), { code: 400 });
    patch.amount_cents = amt;
  }
  if (opts.method) {
    const m = normaliseInhouseMethod(opts.method);
    if (!m) throw Object.assign(new Error('invalid_payment_method'), { code: 400 });
    patch.provider = INHOUSE_METHODS[m].provider;
    meta.method = m;
  }
  const trace = traceFields(opts);
  if (opts.received_on !== undefined) {
    if (trace.received_on) { meta.received_on = trace.received_on; patch.paid_at = receivedAtIso(trace.received_on); }
  }
  if (opts.payer_name !== undefined) { if (trace.payer_name) meta.payer_name = trace.payer_name; else delete meta.payer_name; }
  if (opts.bank_reference !== undefined) { if (trace.bank_reference) meta.bank_reference = trace.bank_reference; else delete meta.bank_reference; }
  if (opts.notes !== undefined) meta.notes = opts.notes ? String(opts.notes).trim().slice(0, 2000) : '';
  meta.corrected = { at: patch.updated_at, by: actor.label || null, reason: opts.reason ? String(opts.reason).slice(0, 300) : null };
  patch.meta = meta;

  const { data: updatedPayment, error } = await admin.from('order_payments').update(patch).eq('id', payment.id).select('*').single();
  if (error) throw error;
  const delta = (patch.amount_cents != null ? patch.amount_cents : payment.amount_cents) - payment.amount_cents;
  let updatedOrder = order;
  if (delta) {
    const { data } = await admin
      .from('order_orders')
      .update({ deposit_paid_cents: Math.max(0, (Number(order.deposit_paid_cents) || 0) + delta), updated_at: patch.updated_at })
      .eq('id', order.id)
      .select('*')
      .single();
    await recalculateOrder(order.id);
    updatedOrder = data || order;
  }
  await writeAudit({
    order_system_id: order.order_system_id,
    site_id: order.site_id,
    order_id: order.id,
    event_type: 'payment_corrected',
    actor_user_id: actor.user_id || null,
    actor_label: actor.label || null,
    source: 'admin',
    payload: { payment_id: payment.id, before: before, after: { amount_cents: updatedPayment.amount_cents, provider: updatedPayment.provider, meta: updatedPayment.meta } }
  });
  return { payment: updatedPayment, order: updatedOrder };
}

/** Void a staff-recorded payment entered by mistake: it stops counting, the record stays. */
async function voidInhousePayment(opts) {
  const admin = getAdmin();
  const actor = opts.actor || {};
  const { payment, order } = await loadStaffPayment(admin, opts.payment_id, opts.site_id);
  if (payment.status !== 'paid') return { payment: payment, order: order, already: true };
  const now = new Date().toISOString();
  const meta = Object.assign({}, payment.meta || {}, { voided: { at: now, by: actor.label || null, reason: opts.reason ? String(opts.reason).slice(0, 300) : null } });
  const { data: updatedPayment, error } = await admin
    .from('order_payments')
    .update({ status: 'cancelled', meta: meta, updated_at: now })
    .eq('id', payment.id)
    .eq('status', 'paid')
    .select('*')
    .single();
  if (error) throw error;
  const { data: updatedOrder } = await admin
    .from('order_orders')
    .update({ deposit_paid_cents: Math.max(0, (Number(order.deposit_paid_cents) || 0) - (Number(payment.amount_cents) || 0)), updated_at: now })
    .eq('id', order.id)
    .select('*')
    .single();
  await recalculateOrder(order.id);
  await writeAudit({
    order_system_id: order.order_system_id,
    site_id: order.site_id,
    order_id: order.id,
    event_type: 'payment_voided',
    actor_user_id: actor.user_id || null,
    actor_label: actor.label || null,
    source: 'admin',
    payload: { payment_id: payment.id, amount_cents: payment.amount_cents, method: payment.provider, reason: opts.reason || null }
  });
  return { payment: updatedPayment, order: updatedOrder || order };
}

module.exports = {
  INHOUSE_METHODS,
  normaliseInhouseMethod,
  inhouseMethodLabel,
  recordInhousePayment,
  correctInhousePayment,
  voidInhousePayment,
  traceFields
};
