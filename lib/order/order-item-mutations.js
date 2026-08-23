'use strict';

const { getAdmin } = require('./supabase');
const { recalculateOrder } = require('./service');
const { writeAudit, writeChange } = require('./audit');
const { parseGstSettings } = require('./gst');
const { assertOrderItemsEditable, buildOrderItemRow } = require('./order-item-build');

async function loadOrderForSite(orderId, siteId) {
  const admin = getAdmin();
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

async function addOrderItem(opts) {
  const admin = getAdmin();
  const order = await loadOrderForSite(opts.order_id, opts.site_id);
  assertOrderItemsEditable(order);

  const line = opts.line || {};
  if (!line.product_id) throw Object.assign(new Error('product_id_required'), { code: 400 });

  const { data: product, error: pErr } = await admin
    .from('order_products')
    .select('*')
    .eq('id', line.product_id)
    .eq('order_system_id', opts.system.id)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!product || product.active === false) {
    throw Object.assign(new Error('product_not_found'), { code: 404 });
  }

  const { data: questions } = await admin
    .from('order_product_questions')
    .select('*')
    .eq('product_id', product.id)
    .order('sort_order');
  const questionsByProduct = {};
  questionsByProduct[product.id] = questions || [];

  const { data: existingItems } = await admin
    .from('order_items')
    .select('sort_order')
    .eq('order_id', order.id)
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextSort =
    existingItems && existingItems.length && existingItems[0].sort_order != null
      ? Number(existingItems[0].sort_order) + 1
      : 0;

  const gstSettings = parseGstSettings(opts.system);
  const row = buildOrderItemRow(line, product, opts.site, gstSettings, questionsByProduct, nextSort);

  const { data: inserted, error: iErr } = await admin
    .from('order_items')
    .insert(Object.assign({}, row, { order_id: order.id }))
    .select('*')
    .single();
  if (iErr) throw iErr;

  const answers = line.answers;
  if (answers && typeof answers === 'object') {
    const answerRows = Object.keys(answers).map(function (k) {
      const a = answers[k] || {};
      return {
        order_item_id: inserted.id,
        question_key: k,
        question_label: a.label || k,
        field_type: a.field_type || 'short_text',
        value: a.value != null ? a.value : a
      };
    });
    if (answerRows.length) await admin.from('order_item_answers').insert(answerRows);
  }

  const recalc = await recalculateOrder(order.id);

  await writeChange({
    order_id: order.id,
    site_id: opts.site_id,
    order_item_id: inserted.id,
    field_path: 'item.added',
    previous_value: null,
    new_value: {
      product_id: product.id,
      product_name: inserted.product_name,
      quantity: inserted.quantity,
      requested_weight_kg: inserted.requested_weight_kg
    },
    source: 'admin',
    actor_user_id: opts.actor.user_id || null,
    actor_label: opts.actor.label || null
  });

  await writeAudit({
    order_system_id: opts.system.id,
    site_id: opts.site_id,
    order_id: order.id,
    event_type: 'order_edited',
    actor_user_id: opts.actor.user_id || null,
    actor_label: opts.actor.label || null,
    source: 'admin',
    payload: {
      action: 'item_added',
      order_item_id: inserted.id,
      product_name: inserted.product_name
    }
  });

  return { item: inserted, order: recalc.order, items: recalc.items };
}

async function removeOrderItem(opts) {
  const admin = getAdmin();
  const orderItemId = opts.order_item_id;
  if (!orderItemId) throw Object.assign(new Error('order_item_id_required'), { code: 400 });

  const { data: item, error: iErr } = await admin
    .from('order_items')
    .select('*')
    .eq('id', orderItemId)
    .maybeSingle();
  if (iErr) throw iErr;
  if (!item) throw Object.assign(new Error('item_not_found'), { code: 404 });

  const order = await loadOrderForSite(item.order_id, opts.site_id);
  assertOrderItemsEditable(order);

  const { error: dErr } = await admin.from('order_items').delete().eq('id', item.id);
  if (dErr) throw dErr;

  const recalc = await recalculateOrder(order.id);

  await writeChange({
    order_id: order.id,
    site_id: opts.site_id,
    order_item_id: item.id,
    field_path: 'item.removed',
    previous_value: {
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      requested_weight_kg: item.requested_weight_kg
    },
    new_value: null,
    source: 'admin',
    actor_user_id: opts.actor.user_id || null,
    actor_label: opts.actor.label || null
  });

  await writeAudit({
    order_system_id: opts.system.id,
    site_id: opts.site_id,
    order_id: order.id,
    event_type: 'order_edited',
    actor_user_id: opts.actor.user_id || null,
    actor_label: opts.actor.label || null,
    source: 'admin',
    payload: {
      action: 'item_removed',
      order_item_id: item.id,
      product_name: item.product_name
    }
  });

  return { removed_item_id: item.id, order: recalc.order, items: recalc.items };
}

module.exports = {
  addOrderItem,
  removeOrderItem
};
