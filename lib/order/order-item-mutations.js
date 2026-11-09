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
  // A chosen stock piece (ham / turkey): one piece per line at its exact weight.
  const stock = require('./stock');
  let piece = null;
  if (line.stock_piece_id) {
    if (!stock.isStockProduct(opts.system, product)) throw Object.assign(new Error('not_stock_product'), { code: 400 });
    const { data: pc } = await admin.from('order_stock_pieces').select('*').eq('id', String(line.stock_piece_id)).maybeSingle();
    if (!pc || pc.order_system_id !== opts.system.id || pc.product_id !== product.id || pc.status !== 'available') {
      throw Object.assign(new Error('piece_taken'), { code: 409, product_name: product.name });
    }
    piece = pc;
  }
  const row = buildOrderItemRow(
    piece ? Object.assign({}, line, { quantity: 1, requested_weight_kg: Number(piece.weight_kg) }) : line,
    product, opts.site, gstSettings, questionsByProduct, nextSort,
    { cooking_rate_cents: require('./product-options').cookingRateCents(opts.system) }
  );

  const { data: inserted, error: iErr } = await admin
    .from('order_items')
    .insert(Object.assign({}, row, { order_id: order.id }))
    .select('*')
    .single();
  if (iErr) throw iErr;

  if (piece) {
    try {
      await stock.allocatePiece(opts.system, { piece_id: piece.id, order_item_id: inserted.id, actor: opts.actor, source: 'staff' });
    } catch (e) {
      await admin.from('order_items').delete().eq('id', inserted.id);
      if (e && e.message === 'piece_taken') throw Object.assign(new Error('piece_taken'), { code: 409, product_name: product.name });
      throw e;
    }
  }

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

/** Pure: the patch for a line when its quantity changes (repriced from its stored price;
 *  the estimated weight scales with the count; a weighed line goes back to estimated). */
function quantityPatch(item, newQty) {
  const { priceLineAtOrder } = require('./pricing');
  const { lineOptionExtras } = require('./product-options');
  const q = Math.round(Number(newQty));
  if (!Number.isFinite(q) || q < 1 || q > 999) throw Object.assign(new Error('bad_quantity'), { code: 400 });
  const oldQ = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
  const method = item.pricing_method || 'fixed';
  let weight = item.requested_weight_kg != null ? Number(item.requested_weight_kg) : null;
  if (weight != null && Number.isFinite(weight)) weight = Math.round((weight / oldQ) * q * 1000) / 1000;
  const sel = (item.options_snapshot && item.options_snapshot.selected) || [];
  const flat = (Array.isArray(sel) ? sel : []).reduce(function (t, o) { return t + (Number(o && o.price_cents) || 0); }, 0);
  const perWeight = method === 'per_weight' || method === 'price_tbc' || method === 'quote_required';
  const priced = priceLineAtOrder(
    { pricing_method: method, price_per_kg_cents: item.unit_price_cents, price_cents: perWeight ? item.unit_price_cents : (item.unit_price_cents != null ? item.unit_price_cents - flat : null) },
    q,
    weight,
    perWeight ? { flat: flat, per_kg: lineOptionExtras(item).per_kg } : flat,
    { ignoreSpecial: true }
  );
  return {
    quantity: q,
    requested_weight_kg: weight,
    unit_price_cents: item.unit_price_cents,
    line_known_cents: priced.lineKnownCents,
    price_status: priced.priceStatus,
    actual_weight_kg: null,
    line_final_cents: null,
    finalised_at: null,
    finalised_by: null,
    updated_at: new Date().toISOString()
  };
}

async function setOrderItemQuantity(opts) {
  const admin = getAdmin();
  if (!opts.order_item_id) throw Object.assign(new Error('order_item_id_required'), { code: 400 });
  const { data: item, error: iErr } = await admin.from('order_items').select('*').eq('id', opts.order_item_id).maybeSingle();
  if (iErr) throw iErr;
  if (!item) throw Object.assign(new Error('item_not_found'), { code: 404 });
  const order = await loadOrderForSite(item.order_id, opts.site_id);
  assertOrderItemsEditable(order);
  const snap = item.product_snapshot || {};
  // A chosen stock piece is one piece per line: add another piece instead.
  if (snap.stock_piece) throw Object.assign(new Error('stock_piece_line'), { code: 400 });
  const given = item.options_snapshot && item.options_snapshot.stock ? Number(item.options_snapshot.stock.pieces) || 0 : 0;
  if (given && Number(opts.quantity) < given) throw Object.assign(new Error('fewer_than_pieces_given'), { code: 400 });
  if (Number(opts.quantity) === Number(item.quantity)) return { item: item, unchanged: true };

  const patch = quantityPatch(item, opts.quantity);
  const { data: updated, error: uErr } = await admin.from('order_items').update(patch).eq('id', item.id).select('*').single();
  if (uErr) throw uErr;
  const recalc = await recalculateOrder(order.id);

  await writeChange({
    order_id: order.id, site_id: opts.site_id, order_item_id: item.id, field_path: 'item.quantity',
    previous_value: { quantity: item.quantity, requested_weight_kg: item.requested_weight_kg },
    new_value: { quantity: updated.quantity, requested_weight_kg: updated.requested_weight_kg },
    source: 'admin', actor_user_id: opts.actor.user_id || null, actor_label: opts.actor.label || null
  });
  await writeAudit({
    order_system_id: opts.system.id, site_id: opts.site_id, order_id: order.id, event_type: 'order_edited',
    actor_user_id: opts.actor.user_id || null, actor_label: opts.actor.label || null, source: 'admin',
    payload: { action: 'item_quantity', order_item_id: item.id, product_name: item.product_name, from: item.quantity, to: updated.quantity }
  });
  return { item: updated, order: recalc.order, items: recalc.items };
}

module.exports = {
  addOrderItem,
  removeOrderItem,
  setOrderItemQuantity,
  quantityPatch
};
