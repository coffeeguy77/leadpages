'use strict';

const { getAdmin } = require('./supabase');
const { priceLineAtOrder, computeOrderTotals, finaliseWeightLine } = require('./pricing');
const { effectiveOrderCutoff, editingStateFor } = require('./cutoff');
const { resolvePaymentRule, computeDepositRequired, balanceRemaining } = require('./deposit');
const { allocateOrderNumber, createAccessToken } = require('./tokens');
const { writeAudit, writeChange } = require('./audit');
const { aggregateSupply, aggregateAllocation } = require('./supply');
const { parseGstSettings, productHasGst } = require('./gst');
const { assertRequiredAnswers } = require('./required-answers');

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'item';
}

async function recalculateOrder(orderId) {
  const admin = getAdmin();
  const { data: items, error } = await admin.from('order_items').select('*').eq('order_id', orderId);
  if (error) throw error;
  const totals = computeOrderTotals(items || []);
  const { data: order } = await admin.from('order_orders').select('*').eq('id', orderId).single();
  const balance = balanceRemaining(
    Object.assign({}, order, {
      final_subtotal_cents: totals.final_subtotal_cents,
      known_subtotal_cents: totals.known_subtotal_cents,
      price_status: totals.price_status
    })
  );
  const patch = {
    known_subtotal_cents: totals.known_subtotal_cents,
    estimated_subtotal_cents: totals.estimated_subtotal_cents,
    final_subtotal_cents: totals.final_subtotal_cents,
    has_unknown_prices: totals.has_unknown_prices,
    price_status: totals.price_status === 'finalised' ? 'finalised' : totals.price_status,
    balance_cents: balance,
    updated_at: new Date().toISOString()
  };
  const { data: updated, error: uErr } = await admin
    .from('order_orders')
    .update(patch)
    .eq('id', orderId)
    .select('*')
    .single();
  if (uErr) throw uErr;
  return { order: updated, items: items || [] };
}

async function createStaffOrder(opts) {
  const admin = getAdmin();
  const system = opts.system;
  const site = opts.site;
  const actor = opts.actor || {};
  const body = opts.body || {};

  const name = String(body.customer_name || '').trim();
  if (!name) throw Object.assign(new Error('customer_name_required'), { code: 400 });

  let customerId = body.customer_id || null;
  if (!customerId) {
    const { normaliseAuPhone } = require('./phone');
    const e164 = normaliseAuPhone(body.customer_phone || '');
    if (e164) {
      const { data: existingCust } = await admin
        .from('order_customers')
        .select('id')
        .eq('order_system_id', system.id)
        .eq('phone_e164', e164)
        .maybeSingle();
      if (existingCust) customerId = existingCust.id;
    }
    if (!customerId) {
      const { data: cust, error: cErr } = await admin
        .from('order_customers')
        .insert({
          order_system_id: system.id,
          site_id: site.id,
          name: name,
          phone: body.customer_phone || null,
          phone_e164: e164 || null,
          email: body.customer_email || null
        })
        .select('id')
        .single();
      if (cErr) throw cErr;
      customerId = cust.id;
    }
  }

  const linesIn = Array.isArray(body.items) ? body.items : [];
  if (!linesIn.length) throw Object.assign(new Error('items_required'), { code: 400 });

  // Load products
  const productIds = linesIn.map(function (l) {
    return l.product_id;
  }).filter(Boolean);
  const { data: products } = await admin
    .from('order_products')
    .select('*')
    .in('id', productIds.length ? productIds : ['00000000-0000-0000-0000-000000000000']);
  const byId = {};
  (products || []).forEach(function (p) {
    byId[p.id] = p;
  });
  const questionsByProduct = {};
  if (productIds.length) {
    const { data: allQuestions } = await admin
      .from('order_product_questions')
      .select('*')
      .in('product_id', productIds)
      .order('sort_order');
    (allQuestions || []).forEach(function (q) {
      if (!questionsByProduct[q.product_id]) questionsByProduct[q.product_id] = [];
      questionsByProduct[q.product_id].push(q);
    });
  }
  const { optionExtrasPerUnitCents, resolveRequestedWeightKg } = require('./product-options');
  const { minimumKg, defaultWeightKg } = require('./product-weight');

  const pickupDate = body.pickup_date || null;
  const cutoff = effectiveOrderCutoff(
    (products || []).length ? products : linesIn.map(function () {
      return { cutoff_mode: 'store_default', name: 'Store default' };
    }),
    system,
    pickupDate
  );
  const editState = editingStateFor(cutoff.effective_cutoff_at);

  const orderNumber = await allocateOrderNumber(system);
  const payRule = resolvePaymentRule({ system: system, orderOverride: body.payment_override });

  const gstSettings = parseGstSettings(system);

  // Build item rows first for totals
  const itemRows = linesIn.map(function (line, idx) {
    const product = line.product_id ? byId[line.product_id] : null;
    const snapProduct = product || {
      name: line.product_name || 'Custom item',
      pricing_method: line.pricing_method || 'fixed',
      price_cents: line.unit_price_cents,
      price_per_kg_cents: line.unit_price_cents,
      sku: line.sku || null,
      unit_label: line.unit_label || null
    };
    const qty = line.quantity != null ? line.quantity : 1;
    let reqWeight = line.requested_weight_kg;
    if (product && (reqWeight == null || reqWeight === '')) {
      const minK = minimumKg(product) || defaultWeightKg(product);
      if (minK != null) reqWeight = minK;
    }
    if (product) {
      reqWeight = resolveRequestedWeightKg(product, qty, reqWeight);
    }
    const lineQuestions = product ? questionsByProduct[product.id] || [] : [];
    assertRequiredAnswers(lineQuestions, line.answers || {}, { includeStaff: true });
    const extras = optionExtrasPerUnitCents(lineQuestions, line.answers || {});
    const priced = priceLineAtOrder(snapProduct, qty, reqWeight, extras.extra_cents);
    const includesGst = product ? productHasGst(product, gstSettings) : false;
    return {
      site_id: site.id,
      product_id: product ? product.id : null,
      product_name: snapProduct.name || product.name,
      product_sku: snapProduct.sku || (product && product.sku) || null,
      pricing_method: snapProduct.pricing_method || (product && product.pricing_method) || 'fixed',
      unit_label: snapProduct.unit_label || (product && product.unit_label) || null,
      quantity: qty,
      requested_weight_kg: reqWeight != null ? reqWeight : null,
      unit_price_cents: priced.unitPriceCents,
      line_known_cents: priced.lineKnownCents,
      price_status: priced.priceStatus,
      notes: line.notes || null,
      options_snapshot: line.options || { selected: extras.selected },
      product_snapshot: product
        ? {
            id: product.id,
            name: product.name,
            sku: product.sku,
            pricing_method: product.pricing_method,
            price_cents: product.price_cents,
            price_per_kg_cents: product.price_per_kg_cents,
            cutoff_mode: product.cutoff_mode,
            lead_time_mode: product.lead_time_mode,
            lead_time_value: product.lead_time_value,
            category_id: product.category_id,
            options: product.options || {},
            selected_options: extras.selected,
            includes_gst: includesGst
          }
        : { custom: true, name: snapProduct.name, includes_gst: false },
      sort_order: idx
    };
  });

  const totals = computeOrderTotals(itemRows);
  const deposit = computeDepositRequired(payRule, totals);
  const initialStatus =
    deposit.deposit_required_cents > 0 && deposit.requires_payment_before_confirm
      ? 'awaiting_deposit'
      : 'confirmed';

  const orderInsert = {
    order_system_id: system.id,
    site_id: site.id,
    customer_id: customerId,
    order_number: orderNumber,
    status: initialStatus,
    source: body.source || 'staff',
    customer_name: name,
    customer_phone: body.customer_phone || null,
    customer_email: body.customer_email || null,
    fulfilment_type: body.fulfilment_type === 'delivery' ? 'delivery' : 'pickup',
    pickup_date: pickupDate,
    pickup_time: body.pickup_time || null,
    pickup_window_start: body.pickup_window_start || null,
    pickup_window_end: body.pickup_window_end || null,
    pickup_location: body.pickup_location || null,
    delivery_address: body.delivery_address || null,
    delivery_fee_cents: body.delivery_fee_cents || 0,
    known_subtotal_cents: totals.known_subtotal_cents,
    estimated_subtotal_cents: totals.estimated_subtotal_cents,
    final_subtotal_cents: totals.final_subtotal_cents,
    deposit_required_cents: deposit.deposit_required_cents,
    deposit_paid_cents: 0,
    balance_cents: null,
    has_unknown_prices: totals.has_unknown_prices,
    price_status: totals.price_status,
    effective_cutoff_at: cutoff.effective_cutoff_at,
    cutoff_reason: cutoff.cutoff_reason,
    editing_state: editState,
    customer_notes: body.customer_notes || null,
    internal_notes: body.internal_notes || null,
    payment_rule_snapshot: payRule,
    created_by: actor.user_id || null,
    confirmed_at: initialStatus === 'confirmed' ? new Date().toISOString() : null
  };

  const { data: insertedOrder, error: oErr } = await admin
    .from('order_orders')
    .insert(orderInsert)
    .select('*')
    .single();
  if (oErr) throw oErr;
  let order = insertedOrder;

  const itemsPayload = itemRows.map(function (r) {
    return Object.assign({}, r, { order_id: order.id });
  });
  const { data: items, error: iErr } = await admin.from('order_items').insert(itemsPayload).select('*');
  if (iErr) throw iErr;

  // Answers
  for (var i = 0; i < linesIn.length; i++) {
    const answers = linesIn[i].answers;
    if (!answers || !items[i]) continue;
    const rows = Object.keys(answers).map(function (k) {
      const a = answers[k] || {};
      return {
        order_item_id: items[i].id,
        question_key: k,
        question_label: a.label || k,
        field_type: a.field_type || 'short_text',
        value: a.value != null ? a.value : a
      };
    });
    if (rows.length) await admin.from('order_item_answers').insert(rows);
  }

  await writeAudit({
    order_system_id: system.id,
    site_id: site.id,
    order_id: order.id,
    event_type: 'order_created',
    actor_user_id: actor.user_id || null,
    actor_label: actor.label || null,
    source: 'staff',
    payload: { order_number: order.order_number, status: order.status }
  });
  if (order.status === 'awaiting_deposit') {
    await writeAudit({
      order_system_id: system.id,
      site_id: site.id,
      order_id: order.id,
      event_type: 'invoice_created',
      actor_user_id: actor.user_id || null,
      actor_label: actor.label || null,
      source: 'staff',
      payload: { deposit_required_cents: order.deposit_required_cents }
    });
  }

  const portal = await createAccessToken(order.id, site.id, 'portal', 24 * 30);
  let depositToken = null;
  if (order.status === 'awaiting_deposit') {
    depositToken = await createAccessToken(order.id, site.id, 'deposit', 72);
  }

  let afterCreate = {};
  if (body.after_create_action) {
    const { afterStaffOrderCreate } = require('./staff-order-actions');
    afterCreate = await afterStaffOrderCreate({
      order: order,
      items: items,
      system: system,
      site: site,
      actor: actor,
      body: body
    });
    const { data: refreshed } = await admin.from('order_orders').select('*').eq('id', order.id).single();
    if (refreshed) order = refreshed;
  }

  return {
    order: order,
    items: items,
    portal_token: portal.token,
    deposit_token: depositToken && depositToken.token,
    after_create: afterCreate
  };
}

async function lockOrdersForDate(system, site, pickupDate, actor) {
  const admin = getAdmin();
  const now = new Date().toISOString();
  await admin.from('order_date_locks').upsert(
    {
      order_system_id: system.id,
      site_id: site.id,
      pickup_date: pickupDate,
      locked_at: now,
      locked_by: actor.user_id || null
    },
    { onConflict: 'order_system_id,pickup_date' }
  );
  const { data: updated, error } = await admin
    .from('order_orders')
    .update({
      editing_state: 'locked',
      status: 'locked',
      locked_at: now,
      locked_by: actor.user_id || null,
      lock_source: 'date_lock',
      updated_at: now
    })
    .eq('order_system_id', system.id)
    .eq('pickup_date', pickupDate)
    .in('status', ['confirmed', 'changes_open', 'awaiting_deposit'])
    .select('id, order_number');
  if (error) throw error;
  await writeAudit({
    order_system_id: system.id,
    site_id: site.id,
    event_type: 'date_locked',
    actor_user_id: actor.user_id || null,
    actor_label: actor.label || null,
    source: 'admin',
    payload: { pickup_date: pickupDate, order_ids: (updated || []).map(function (o) { return o.id; }) }
  });
  return { locked_count: (updated || []).length, orders: updated || [] };
}

async function finaliseItemPrice(orderItemId, actualWeightKg, rateCents, actor) {
  const admin = getAdmin();
  const { data: item, error } = await admin.from('order_items').select('*').eq('id', orderItemId).single();
  if (error || !item) throw Object.assign(new Error('item_not_found'), { code: 404 });
  const fin = finaliseWeightLine(item, actualWeightKg, rateCents != null ? rateCents : item.unit_price_cents);
  const { data: updated, error: uErr } = await admin
    .from('order_items')
    .update({
      actual_weight_kg: fin.actual_weight_kg,
      unit_price_cents: fin.unit_price_cents,
      line_final_cents: fin.line_final_cents,
      price_status: fin.price_status,
      finalised_at: new Date().toISOString(),
      finalised_by: actor.user_id || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', orderItemId)
    .select('*')
    .single();
  if (uErr) throw uErr;

  await writeChange({
    order_id: item.order_id,
    site_id: item.site_id,
    order_item_id: item.id,
    field_path: 'item.final_price',
    previous_value: { price_status: item.price_status, line_final_cents: item.line_final_cents },
    new_value: {
      actual_weight_kg: fin.actual_weight_kg,
      unit_price_cents: fin.unit_price_cents,
      line_final_cents: fin.line_final_cents
    },
    source: 'admin',
    actor_user_id: actor.user_id || null,
    actor_label: actor.label || null
  });

  const recalc = await recalculateOrder(item.order_id);
  await writeAudit({
    site_id: item.site_id,
    order_id: item.order_id,
    event_type: 'price_finalised',
    actor_user_id: actor.user_id || null,
    source: 'admin',
    payload: { order_item_id: item.id, line_final_cents: fin.line_final_cents }
  });
  return { item: updated, order: recalc.order };
}

async function supplyForDate(systemId, siteId, pickupDate) {
  const admin = getAdmin();
  const { data: orders, error } = await admin
    .from('order_orders')
    .select(
      'id, status, order_number, pickup_date, customer_name, customer_phone, customer_notes, pickup_window_start, pickup_window_end, is_important'
    )
    .eq('order_system_id', systemId)
    .eq('pickup_date', pickupDate)
    .not('status', 'in', '("draft","cancelled","refunded")');
  if (error) throw error;
  const ids = (orders || []).map(function (o) {
    return o.id;
  });
  if (!ids.length) {
    return {
      order_count: 0,
      lines: [],
      allocations: [],
      allocation_totals: { lines: 0, packed: 0, quantity: 0 }
    };
  }
  const { data: items } = await admin.from('order_items').select('*').in('order_id', ids);
  const byOrder = {};
  (orders || []).forEach(function (o) {
    byOrder[o.id] = Object.assign({}, o, { items: [] });
  });
  (items || []).forEach(function (it) {
    if (byOrder[it.order_id]) byOrder[it.order_id].items.push(it);
  });
  const list = Object.keys(byOrder).map(function (k) {
    return byOrder[k];
  });
  const allocation = aggregateAllocation(list);
  return {
    order_count: list.length,
    lines: aggregateSupply(list),
    allocations: allocation.groups,
    allocation_totals: allocation.totals
  };
}

async function setItemPacked(opts) {
  const admin = getAdmin();
  const orderItemId = opts.order_item_id;
  const siteId = opts.site_id;
  const packed = !!opts.packed;
  const actor = opts.actor || {};
  if (!orderItemId) throw Object.assign(new Error('order_item_id_required'), { code: 400 });

  const { data: item, error } = await admin.from('order_items').select('*').eq('id', orderItemId).maybeSingle();
  if (error) throw error;
  if (!item) throw Object.assign(new Error('not_found'), { code: 404 });
  if (item.site_id !== siteId) throw Object.assign(new Error('forbidden'), { code: 403 });

  const now = new Date().toISOString();
  const patch = {
    packed: packed,
    packed_at: packed ? now : null,
    packed_by: packed ? actor.user_id || null : null,
    updated_at: now
  };
  const { data: updated, error: uErr } = await admin
    .from('order_items')
    .update(patch)
    .eq('id', item.id)
    .select('*')
    .single();
  if (uErr) throw uErr;

  await writeAudit({
    order_system_id: opts.system.id,
    site_id: siteId,
    order_id: item.order_id,
    event_type: packed ? 'item_packed' : 'item_unpacked',
    actor_user_id: actor.user_id || null,
    actor_label: actor.label || null,
    source: 'admin',
    payload: {
      order_item_id: item.id,
      product_name: item.product_name,
      packed: packed
    }
  });

  return { item: updated };
}

module.exports = {
  slugify,
  recalculateOrder,
  createStaffOrder,
  lockOrdersForDate,
  finaliseItemPrice,
  supplyForDate,
  setItemPacked
};
