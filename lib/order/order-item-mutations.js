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

/** Typed weights for a line's pieces (no stock control): array of kg or null, one per unit. */
function pieceWeights(item) {
  const q = Math.max(1, Math.round(Number(item.quantity) || 1));
  let raw = item.options_snapshot && Array.isArray(item.options_snapshot.piece_weights) ? item.options_snapshot.piece_weights : [];
  // A single piece weighed with "Weigh" counts as that piece's weight.
  if (!raw.length && q === 1 && item.actual_weight_kg != null) raw = [Number(item.actual_weight_kg)];
  const out = [];
  for (let i = 0; i < q; i++) {
    const v = raw[i] != null && raw[i] !== '' ? Number(raw[i]) : null;
    out.push(v != null && Number.isFinite(v) && v > 0 ? Math.round(v * 1000) / 1000 : null);
  }
  return out;
}

/** Pure: patch for a line holding these per-piece weights. All weighed → final price; otherwise the estimate. */
function patchForWeights(item, weights) {
  const { finaliseWeightLine } = require('./pricing');
  const q = weights.length;
  const opts = Object.assign({}, item.options_snapshot || {});
  if (weights.some(function (w) { return w != null; })) opts.piece_weights = weights; else delete opts.piece_weights;
  const filled = weights.filter(function (w) { return w != null; });
  if (q > 0 && filled.length === q && item.unit_price_cents != null) {
    const total = Math.round(filled.reduce(function (a, b) { return a + b; }, 0) * 1000) / 1000;
    const fin = finaliseWeightLine(Object.assign({}, item, { quantity: q }), total, item.unit_price_cents);
    const now = new Date().toISOString();
    return Object.assign({}, fin, { quantity: q, options_snapshot: opts, finalised_at: now, updated_at: now });
  }
  return Object.assign(quantityPatch(item, q), { options_snapshot: opts });
}

async function loadEditableItem(opts) {
  const admin = getAdmin();
  if (!opts.order_item_id) throw Object.assign(new Error('order_item_id_required'), { code: 400 });
  const { data: item, error } = await admin.from('order_items').select('*').eq('id', opts.order_item_id).maybeSingle();
  if (error) throw error;
  if (!item) throw Object.assign(new Error('item_not_found'), { code: 404 });
  const order = await loadOrderForSite(item.order_id, opts.site_id);
  assertOrderItemsEditable(order);
  if (item.product_snapshot && item.product_snapshot.stock_piece) throw Object.assign(new Error('stock_piece_line'), { code: 400 });
  const { data: pcs } = await admin.from('order_stock_pieces').select('id,weight_kg,tag').eq('order_item_id', item.id).eq('status', 'allocated');
  return { item: item, order: order, pieces: pcs || [] };
}

async function saveItemPatch(ctx, patch, opts, change) {
  const admin = getAdmin();
  const { data: updated, error } = await admin.from('order_items').update(patch).eq('id', ctx.item.id).select('*').single();
  if (error) throw error;
  let out;
  if (ctx.pieces.length || change.stock) out = await require('./stock').syncLine(ctx.item.id, opts.actor); // stock pieces decide weight / final price
  else out = await recalculateOrder(ctx.order.id);
  await writeChange({
    order_id: ctx.order.id, site_id: opts.site_id, order_item_id: ctx.item.id, field_path: change.field,
    previous_value: change.before, new_value: change.after,
    source: 'admin', actor_user_id: opts.actor.user_id || null, actor_label: opts.actor.label || null
  });
  await writeAudit({
    order_system_id: opts.system.id, site_id: opts.site_id, order_id: ctx.order.id, event_type: 'order_edited',
    actor_user_id: opts.actor.user_id || null, actor_label: opts.actor.label || null, source: 'admin',
    payload: Object.assign({ order_item_id: ctx.item.id, product_name: ctx.item.product_name }, change.payload)
  });
  return { item: (out && out.item) || updated, order: out && out.order };
}

/** Change a line's quantity. Weighed pieces are kept; removing them needs remove_piece (choose which). */
async function setOrderItemQuantity(opts) {
  const ctx = await loadEditableItem(opts);
  const item = ctx.item;
  const q = Math.round(Number(opts.quantity));
  if (!Number.isFinite(q) || q < 1 || q > 999) throw Object.assign(new Error('bad_quantity'), { code: 400 });
  if (q === Number(item.quantity)) return { item: item, unchanged: true };
  let patch;
  if (ctx.pieces.length) {
    if (q < ctx.pieces.length) throw Object.assign(new Error('choose_pieces_to_remove'), { code: 409 });
    patch = quantityPatch(item, q);
  } else {
    const w = pieceWeights(item);
    const filled = w.filter(function (x) { return x != null; });
    if (q < filled.length) throw Object.assign(new Error('choose_pieces_to_remove'), { code: 409 });
    let next = w.slice();
    while (next.length > q) {                       // drop empty slots, last first
      const i = next.lastIndexOf(null);
      next.splice(i, 1);
    }
    while (next.length < q) next.push(null);
    patch = filled.length ? patchForWeights(item, next) : quantityPatch(item, q);
  }
  return saveItemPatch(ctx, patch, opts, {
    field: 'item.quantity', before: { quantity: item.quantity }, after: { quantity: q },
    payload: { action: 'item_quantity', from: item.quantity, to: q }
  });
}

/** Weight of one piece on a line (no stock control). weight_kg null clears it. */
async function setPieceWeight(opts) {
  const ctx = await loadEditableItem(opts);
  if (ctx.pieces.length) throw Object.assign(new Error('line_uses_stock'), { code: 400 });
  const w = pieceWeights(ctx.item);
  const i = Math.round(Number(opts.index));
  if (!(i >= 0 && i < w.length)) throw Object.assign(new Error('bad_piece'), { code: 400 });
  let kg = opts.weight_kg == null || opts.weight_kg === '' ? null : Number(opts.weight_kg);
  if (kg != null && !(Number.isFinite(kg) && kg > 0 && kg < 100)) throw Object.assign(new Error('invalid_weight'), { code: 400 });
  const before = w[i];
  w[i] = kg != null ? Math.round(kg * 1000) / 1000 : null;
  return saveItemPatch(ctx, patchForWeights(ctx.item, w), opts, {
    field: 'item.piece_weight', before: { index: i, weight_kg: before }, after: { index: i, weight_kg: w[i] },
    payload: { action: 'piece_weight', index: i, weight_kg: w[i] }
  });
}

/** Remove one piece from a line (quantity − 1): a typed weight by index, or a stock piece (back to stock). */
async function removePiece(opts) {
  const ctx = await loadEditableItem(opts);
  const item = ctx.item;
  const qty = Math.max(1, Math.round(Number(item.quantity) || 1));
  if (qty <= 1) throw Object.assign(new Error('last_piece_remove_line'), { code: 400 });
  if (opts.piece_id) {
    const pc = ctx.pieces.find(function (x) { return x.id === opts.piece_id; });
    if (!pc) throw Object.assign(new Error('piece_not_on_line'), { code: 404 });
    await require('./stock').releasePiece(opts.system, { piece_id: pc.id, actor: opts.actor });
    ctx.pieces = ctx.pieces.filter(function (x) { return x.id !== pc.id; });
    return saveItemPatch(ctx, quantityPatch(item, qty - 1), opts, {
      stock: true, field: 'item.piece_removed', before: { quantity: qty, piece_id: pc.id, weight_kg: Number(pc.weight_kg) }, after: { quantity: qty - 1 },
      payload: { action: 'piece_removed', piece_id: pc.id }
    });
  }
  const w = pieceWeights(item);
  const i = Math.round(Number(opts.index));
  if (!(i >= 0 && i < w.length)) throw Object.assign(new Error('bad_piece'), { code: 400 });
  const removed = w.splice(i, 1)[0];
  const patch = ctx.pieces.length ? quantityPatch(item, qty - 1) : patchForWeights(item, w);
  return saveItemPatch(ctx, patch, opts, {
    stock: !!ctx.pieces.length, field: 'item.piece_removed', before: { quantity: qty, index: i, weight_kg: removed }, after: { quantity: qty - 1 },
    payload: { action: 'piece_removed', index: i }
  });
}

module.exports = {
  addOrderItem,
  removeOrderItem,
  setOrderItemQuantity,
  setPieceWeight,
  removePiece,
  quantityPatch,
  patchForWeights,
  pieceWeights
};
