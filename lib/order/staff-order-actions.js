'use strict';

const { getAdmin } = require('./supabase');
const { writeAudit, writeChange } = require('./audit');
const { createAccessToken } = require('./tokens');
const { formatAud } = require('./money');
const { notifyEvent, PUBLIC_BASE } = require('./notify');
const { recordInhousePayment } = require('./manual-payment');

async function loadOrder(admin, orderId, siteId) {
  const { data: order, error } = await admin
    .from('order_orders')
    .select('*')
    .eq('id', orderId)
    .eq('site_id', siteId)
    .maybeSingle();
  if (error) throw error;
  if (!order) throw Object.assign(new Error('not_found'), { code: 404 });
  return order;
}

async function voidOrder(opts) {
  const admin = getAdmin();
  const order = await loadOrder(admin, opts.order_id, opts.site_id);
  if (order.status === 'cancelled') {
    return { order: order, already_voided: true };
  }
  const reason = String(opts.reason || '').trim().slice(0, 4000);
  const now = new Date().toISOString();
  const prevStatus = order.status;
  const noteLine = reason ? '[Voided ' + now.slice(0, 10) + '] ' + reason : '[Voided ' + now.slice(0, 10) + ']';
  const internal = [order.internal_notes, noteLine].filter(Boolean).join('\n');

  const { data: updated, error } = await admin
    .from('order_orders')
    .update({
      status: 'cancelled',
      cancelled_at: now,
      internal_notes: internal,
      updated_at: now
    })
    .eq('id', order.id)
    .select('*')
    .single();
  if (error) throw error;

  await writeAudit({
    order_system_id: opts.system.id,
    site_id: opts.site_id,
    order_id: order.id,
    event_type: 'order_voided',
    actor_user_id: opts.actor.user_id || null,
    actor_label: opts.actor.label || null,
    source: 'admin',
    payload: { reason: reason, status_before: prevStatus }
  });

  return { order: updated };
}

async function restoreOrder(opts) {
  const admin = getAdmin();
  const order = await loadOrder(admin, opts.order_id, opts.site_id);
  if (order.status !== 'cancelled') {
    throw Object.assign(new Error('not_voided'), { code: 400 });
  }

  const { data: voidEvt } = await admin
    .from('order_audit_events')
    .select('payload')
    .eq('order_id', order.id)
    .eq('event_type', 'order_voided')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const restoreStatus =
    (voidEvt && voidEvt.payload && voidEvt.payload.status_before) || 'confirmed';
  const now = new Date().toISOString();
  const patch = {
    status: restoreStatus,
    cancelled_at: null,
    updated_at: now
  };
  if (restoreStatus === 'confirmed' && !order.confirmed_at) patch.confirmed_at = now;

  const { data: updated, error } = await admin
    .from('order_orders')
    .update(patch)
    .eq('id', order.id)
    .select('*')
    .single();
  if (error) throw error;

  await writeAudit({
    order_system_id: opts.system.id,
    site_id: opts.site_id,
    order_id: order.id,
    event_type: 'order_restored',
    actor_user_id: opts.actor.user_id || null,
    actor_label: opts.actor.label || null,
    source: 'admin',
    payload: { restored_to: restoreStatus }
  });

  return { order: updated };
}

async function sendDepositLink(opts) {
  const admin = getAdmin();
  const order = await loadOrder(admin, opts.order_id, opts.site_id);
  const phone = opts.phone != null ? String(opts.phone).trim() : order.customer_phone;
  const email = opts.email != null ? String(opts.email).trim() : order.customer_email;

  if (phone && phone !== order.customer_phone) {
    await admin
      .from('order_orders')
      .update({ customer_phone: phone, updated_at: new Date().toISOString() })
      .eq('id', order.id);
    order.customer_phone = phone;
    if (order.customer_id) {
      const { normaliseAuPhone } = require('./phone');
      await admin
        .from('order_customers')
        .update({
          phone: phone,
          phone_e164: normaliseAuPhone(phone) || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.customer_id);
    }
  }

  const tok = await createAccessToken(order.id, opts.site_id, 'deposit', 72);
  const url = PUBLIC_BASE + '/order-portal?t=' + encodeURIComponent(tok.token) + '&pay=1';

  await notifyEvent({
    event_type: 'deposit_required',
    system: opts.system,
    site: opts.site,
    order: order,
    portal_link: url,
    phone: phone,
    email: email,
    channel: opts.channel || 'both',
    source: 'admin',
    fallback_body:
      'Hi ' +
      order.customer_name +
      ', pay your deposit of ' +
      formatAud(order.deposit_required_cents) +
      ' for order ' +
      order.order_number +
      ': ' +
      url
  });

  await writeAudit({
    order_system_id: opts.system.id,
    site_id: opts.site_id,
    order_id: order.id,
    event_type: 'deposit_link_sent',
    actor_user_id: opts.actor.user_id || null,
    actor_label: opts.actor.label || null,
    source: 'admin',
    payload: { url: url, phone: phone || null, email: email || null }
  });

  return { deposit_url: url, phone: phone };
}

async function sendOrderReceipt(opts) {
  const admin = getAdmin();
  const order = await loadOrder(admin, opts.order_id, opts.site_id);
  const portal = await createAccessToken(order.id, opts.site_id, 'portal', 24 * 30);
  const url = PUBLIC_BASE + '/order-portal?t=' + encodeURIComponent(portal.token);

  await notifyEvent({
    event_type: 'order_confirmed',
    system: opts.system,
    site: opts.site,
    order: order,
    portal_link: url,
    channel: opts.channel || 'both',
    source: 'admin',
    template_category: 'order_confirmed',
    fallback_body:
      'Hi ' +
      order.customer_name +
      ', thanks for your order ' +
      order.order_number +
      ' with ' +
      (opts.site.business_name || 'us') +
      '. View your receipt: ' +
      url
  });

  await writeAudit({
    order_system_id: opts.system.id,
    site_id: opts.site_id,
    order_id: order.id,
    event_type: 'receipt_sent',
    actor_user_id: opts.actor.user_id || null,
    actor_label: opts.actor.label || null,
    source: 'admin',
    payload: { portal_url: url }
  });

  return { portal_url: url };
}

async function afterStaffOrderCreate(opts) {
  const body = opts.body || {};
  const action = body.after_create_action;
  if (!action) return {};

  const order = opts.order;
  const out = {};

  if (action === 'send_invoice_link') {
    out.deposit = await sendDepositLink({
      order_id: order.id,
      site_id: opts.site.id,
      system: opts.system,
      site: opts.site,
      actor: opts.actor,
      phone: body.send_phone || order.customer_phone,
      email: order.customer_email,
      channel: 'both'
    });
    await writeAudit({
      order_system_id: opts.system.id,
      site_id: opts.site.id,
      order_id: order.id,
      event_type: 'invoice_sent',
      actor_user_id: opts.actor.user_id || null,
      actor_label: opts.actor.label || null,
      source: 'admin',
      payload: {
        phone: out.deposit.phone || null,
        url: out.deposit.deposit_url
      }
    });
  }

  if (action === 'inhouse_payment') {
    const pay = await recordInhousePayment({
      order: order,
      system: opts.system,
      site: opts.site,
      actor: opts.actor,
      method: body.inhouse_payment_method,
      amount_cents: body.inhouse_payment_amount_cents,
      notes: body.inhouse_payment_notes
    });
    out.payment = pay;
    out.receipt = await sendOrderReceipt({
      order_id: order.id,
      site_id: opts.site.id,
      system: opts.system,
      site: opts.site,
      actor: opts.actor
    });
  }

  return out;
}

async function patchOrderWithAudit(opts) {
  const admin = getAdmin();
  const order = await loadOrder(admin, opts.order_id, opts.site_id);
  const allowed = [
    'customer_name', 'customer_phone', 'customer_email', 'fulfilment_type',
    'pickup_date', 'pickup_time', 'pickup_window_start', 'pickup_window_end', 'pickup_location',
    'delivery_address', 'delivery_fee_cents', 'customer_notes', 'internal_notes'
  ];
  const patch = { updated_at: new Date().toISOString() };
  const changes = [];
  allowed.forEach(function (k) {
    if (opts.body[k] === undefined) return;
    if (opts.body[k] !== order[k]) {
      changes.push({ field: k, from: order[k], to: opts.body[k] });
    }
    patch[k] = opts.body[k];
  });
  if (!changes.length) return { order: order };

  const { data: updated, error } = await admin
    .from('order_orders')
    .update(patch)
    .eq('id', order.id)
    .select('*')
    .single();
  if (error) throw error;

  for (const ch of changes) {
    await writeChange({
      order_id: order.id,
      site_id: opts.site_id,
      field_path: ch.field,
      previous_value: ch.from,
      new_value: ch.to,
      source: 'admin',
      actor_user_id: opts.actor.user_id || null,
      actor_label: opts.actor.label || null
    });
  }

  await writeAudit({
    order_system_id: opts.system.id,
    site_id: opts.site_id,
    order_id: order.id,
    event_type: 'order_edited',
    actor_user_id: opts.actor.user_id || null,
    actor_label: opts.actor.label || null,
    source: 'admin',
    payload: { fields: changes.map(function (c) { return c.field; }) }
  });

  if (order.customer_id && (opts.body.customer_phone || opts.body.customer_email || opts.body.customer_name)) {
    const cp = { updated_at: new Date().toISOString() };
    if (opts.body.customer_name) cp.name = opts.body.customer_name;
    if (opts.body.customer_phone) {
      cp.phone = opts.body.customer_phone;
      const { normaliseAuPhone } = require('./phone');
      cp.phone_e164 = normaliseAuPhone(opts.body.customer_phone) || null;
    }
    if (opts.body.customer_email !== undefined) cp.email = opts.body.customer_email;
    await admin.from('order_customers').update(cp).eq('id', order.customer_id);
  }

  return { order: updated };
}

module.exports = {
  voidOrder,
  restoreOrder,
  sendDepositLink,
  sendOrderReceipt,
  afterStaffOrderCreate,
  patchOrderWithAudit
};
