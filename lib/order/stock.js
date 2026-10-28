'use strict';

/**
 * Stock pieces — received hams / turkeys, one row per piece (order_stock_pieces).
 *
 * Only categories listed in order_systems.settings.stock_control.category_ids are
 * stock-controlled. For those:
 *   - staff receive pieces with their actual weight (Stock screen);
 *   - a piece is allocated to an order line; allocating = weighing: once a line has as many
 *     pieces as its quantity, its actual weight is the pieces' total and its price is final;
 *   - releasing a piece puts it back in stock and the line back to its estimate / TBC;
 *   - the shop and New order offer the real pieces left. A product only opens for sale once
 *     every open order for it has its pieces ("protect existing pre-orders").
 *
 * One piece can never go to two lines: allocation is a conditional update on status.
 */

const { getAdmin } = require('./supabase');
const { mulWeightRate } = require('./money');
const { priceLineAtOrder } = require('./pricing');
const { minimumKg } = require('./product-weight');
const { writeAudit, writeChange } = require('./audit');

/** Orders that still need their stock (not drafts, history, cancelled or collected). */
const OPEN_ORDER_STATUSES = ['awaiting_deposit', 'confirmed', 'changes_open', 'locked', 'in_preparation', 'ready'];

function err(code, status, extra) {
  return Object.assign(new Error(code), { code: status || 400 }, extra || {});
}

function roundKg(n) {
  return Math.round(Number(n) * 1000) / 1000;
}

/* ------------------------------------------------------------------ settings */

function stockSettings(system) {
  const s = (system && system.settings && system.settings.stock_control) || {};
  const ids = Array.isArray(s.category_ids) ? s.category_ids.filter(Boolean).map(String) : [];
  return { category_ids: ids };
}

function trackedCategoryIds(system) {
  return stockSettings(system).category_ids;
}

function isStockProduct(system, product) {
  if (!product || !product.category_id) return false;
  return trackedCategoryIds(system).indexOf(String(product.category_id)) >= 0;
}

/** Pieces a line needs: one per unit (a line for 2 hams needs 2 hams). */
function piecesNeeded(item) {
  const q = Math.round(Number(item && item.quantity));
  return Number.isFinite(q) && q > 0 ? q : 1;
}

/** Weight to aim for when suggesting a piece: requested per unit → "3.5-4" in the name → minimum. */
function targetWeightKg(item, product) {
  const qty = piecesNeeded(item);
  const req = Number(item && item.requested_weight_kg);
  if (Number.isFinite(req) && req > 0) return req / qty;
  const name = String((product && product.name) || (item && item.product_name) || '');
  const m = /(\d+(?:\.\d+)?)\s*(?:kg)?\s*[-–]\s*(\d+(?:\.\d+)?)/i.exec(name);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 0 && b > a && b < 40) return (a + b) / 2;
  }
  const min = product ? minimumKg(product) : null;
  return min != null ? min : null;
}

/** Option extras per unit stored on the line (glaze, stuffing…). */
function lineExtrasPerUnit(item) {
  const sel = (item && item.options_snapshot && item.options_snapshot.selected) || [];
  return (Array.isArray(sel) ? sel : []).reduce(function (s, o) {
    return s + (Number(o && o.price_cents) || 0);
  }, 0);
}

/* ------------------------------------------------------------- pure helpers */

/**
 * Line patch for the pieces it now holds.
 * Full (pieces ≥ needed): actual weight = total, final price = total × $/kg (+ extras).
 * Not full: back to the estimate/TBC — only if the stock had finalised it.
 * @returns {object|null} patch for order_items, or null when nothing changes
 */
function linePatchForPieces(item, pieces) {
  const list = pieces || [];
  const need = piecesNeeded(item);
  const total = roundKg(list.reduce(function (s, p) { return s + Number(p.weight_kg); }, 0));
  const opts = Object.assign({}, item.options_snapshot || {});
  const now = new Date().toISOString();
  if (list.length >= need && list.length > 0) {
    opts.stock = { pieces: list.length, weight_kg: total, finalised: true };
    const patch = { actual_weight_kg: total, options_snapshot: opts, updated_at: now };
    const rate = item.unit_price_cents;
    if (item.pricing_method === 'per_weight' && rate != null) {
      patch.line_final_cents = mulWeightRate(total, rate) + Math.round(lineExtrasPerUnit(item) * need);
      patch.price_status = 'finalised';
      patch.finalised_at = now;
    }
    return patch;
  }
  const wasStockFinal = !!(item.options_snapshot && item.options_snapshot.stock && item.options_snapshot.stock.finalised);
  opts.stock = list.length ? { pieces: list.length, weight_kg: total, finalised: false } : undefined;
  if (!opts.stock) delete opts.stock;
  if (!wasStockFinal) {
    return { options_snapshot: opts, updated_at: now };
  }
  const priced = priceLineAtOrder(
    {
      pricing_method: item.pricing_method || 'per_weight',
      price_per_kg_cents: item.unit_price_cents,
      price_cents: item.unit_price_cents
    },
    item.quantity,
    item.requested_weight_kg,
    item.pricing_method === 'per_weight' ? lineExtrasPerUnit(item) : 0,
    { ignoreSpecial: true }
  );
  return {
    actual_weight_kg: null,
    line_final_cents: null,
    finalised_at: null,
    finalised_by: null,
    price_status: priced.priceStatus,
    line_known_cents: priced.lineKnownCents,
    options_snapshot: opts,
    updated_at: now
  };
}

/**
 * Per product: received / allocated / available, orders still waiting, and what the shop may sell.
 * @param {Array} products  tracked products
 * @param {Array} pieces    all their pieces (any status)
 * @param {Array} lines     open-order lines for those products ({id, product_id, quantity})
 */
function summarise(products, pieces, lines) {
  const byItem = {};
  pieces.forEach(function (p) {
    if (p.status === 'allocated' && p.order_item_id) byItem[p.order_item_id] = (byItem[p.order_item_id] || 0) + 1;
  });
  const out = {};
  products.forEach(function (prod) {
    out[prod.id] = {
      product_id: prod.id,
      received: 0,
      allocated: 0,
      available: 0,
      written_off: 0,
      waiting_orders: 0,
      waiting_pieces: 0,
      free_to_sell: 0,
      shop_open: false
    };
  });
  pieces.forEach(function (p) {
    const s = out[p.product_id];
    if (!s) return;
    if (p.status === 'written_off') { s.written_off += 1; return; }
    s.received += 1;
    if (p.status === 'allocated') s.allocated += 1;
    else s.available += 1;
  });
  lines.forEach(function (l) {
    const s = out[l.product_id];
    if (!s) return;
    const short = piecesNeeded(l) - (byItem[l.id] || 0);
    if (short > 0) {
      s.waiting_orders += 1;
      s.waiting_pieces += short;
    }
  });
  Object.keys(out).forEach(function (k) {
    const s = out[k];
    // Protect existing pre-orders: sell only once every open order has its pieces.
    s.shop_open = s.waiting_pieces === 0 && s.available > 0;
    s.free_to_sell = s.waiting_pieces === 0 ? s.available : 0;
  });
  return out;
}

/**
 * Pair waiting lines with available pieces of the same product: oldest pickup / order first,
 * each gets the available piece closest to its target weight.
 * @returns {Array<{order_item_id, piece_id, weight_kg}>}
 */
function suggestPairs(lines, pieces, productsById) {
  const pool = {};
  pieces.forEach(function (p) {
    if (p.status !== 'available') return;
    (pool[p.product_id] = pool[p.product_id] || []).push(p);
  });
  const allocatedByItem = {};
  pieces.forEach(function (p) {
    if (p.status === 'allocated' && p.order_item_id) allocatedByItem[p.order_item_id] = (allocatedByItem[p.order_item_id] || 0) + 1;
  });
  const sorted = lines.slice().sort(function (a, b) {
    const da = a.pickup_date || '9999-12-31';
    const db = b.pickup_date || '9999-12-31';
    if (da !== db) return da < db ? -1 : 1;
    return String(a.order_created_at || '') < String(b.order_created_at || '') ? -1 : 1;
  });
  const pairs = [];
  sorted.forEach(function (l) {
    let short = piecesNeeded(l) - (allocatedByItem[l.id] || 0);
    const avail = pool[l.product_id] || [];
    const target = targetWeightKg(l, productsById[l.product_id]);
    while (short > 0 && avail.length) {
      let best = 0;
      if (target != null) {
        avail.forEach(function (p, i) {
          if (Math.abs(Number(p.weight_kg) - target) < Math.abs(Number(avail[best].weight_kg) - target)) best = i;
        });
      }
      const piece = avail.splice(best, 1)[0];
      pairs.push({ order_item_id: l.id, piece_id: piece.id, weight_kg: Number(piece.weight_kg), product_id: l.product_id });
      short -= 1;
    }
  });
  return pairs;
}

/** Parse "3.82, 3.65 3.91\n4.1kg" → [3.82, 3.65, 3.91, 4.1]. */
function parseWeights(raw) {
  const list = Array.isArray(raw) ? raw : String(raw || '').split(/[\s,;]+/);
  const out = [];
  list.forEach(function (v) {
    const n = Number(String(v).replace(/kg$/i, '').trim());
    if (String(v).trim() === '') return;
    if (!Number.isFinite(n) || n <= 0 || n > 60) throw err('invalid_weight', 400, { value: String(v) });
    out.push(roundKg(n));
  });
  return out;
}

/* ------------------------------------------------------------------ loaders */

async function loadTrackedProducts(system, categoryIds) {
  const ids = categoryIds && categoryIds.length ? categoryIds.map(String) : trackedCategoryIds(system);
  if (!ids.length) return [];
  const { data, error } = await getAdmin()
    .from('order_products')
    .select('id,name,category_id,pricing_method,price_per_kg_cents,price_cents,options,active,sort_order')
    .eq('order_system_id', system.id)
    .in('category_id', ids);
  if (error) throw error;
  return data || [];
}

async function loadPieces(system, productIds, statuses) {
  if (!productIds.length) return [];
  let q = getAdmin()
    .from('order_stock_pieces')
    .select('*')
    .eq('order_system_id', system.id)
    .in('product_id', productIds)
    .order('weight_kg', { ascending: true });
  if (statuses) q = q.in('status', statuses);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** Open-order lines for these products, with order details. */
async function loadOpenLines(system, productIds) {
  if (!productIds.length) return [];
  const { data, error } = await getAdmin()
    .from('order_items')
    .select(
      'id,order_id,product_id,product_name,quantity,requested_weight_kg,actual_weight_kg,unit_price_cents,price_status,notes,' +
        'order_orders!inner(order_number,customer_name,pickup_date,status,created_at,order_system_id)'
    )
    .in('product_id', productIds)
    .eq('order_orders.order_system_id', system.id)
    .in('order_orders.status', OPEN_ORDER_STATUSES);
  if (error) throw error;
  return (data || []).map(function (r) {
    const o = r.order_orders || {};
    return Object.assign({}, r, {
      order_orders: undefined,
      order_number: o.order_number,
      customer_name: o.customer_name,
      pickup_date: o.pickup_date,
      order_status: o.status,
      order_created_at: o.created_at
    });
  });
}

/* ------------------------------------------------------------- stock state */

/**
 * Everything the Stock screen needs — for the given categories (default: the switched-on ones).
 * Stock can be received into a category before it is switched on.
 */
async function stockOverview(system, categoryIds) {
  const products = await loadTrackedProducts(system, categoryIds);
  const ids = products.map(function (p) { return p.id; });
  const [pieces, lines] = await Promise.all([loadPieces(system, ids), loadOpenLines(system, ids)]);
  const summary = summarise(products, pieces, lines);
  const piecesByItem = {};
  pieces.forEach(function (p) {
    if (p.order_item_id) (piecesByItem[p.order_item_id] = piecesByItem[p.order_item_id] || []).push(p);
  });
  const orderNoByItem = {};
  lines.forEach(function (l) { orderNoByItem[l.id] = { order_number: l.order_number, customer_name: l.customer_name, order_id: l.order_id }; });
  return {
    category_ids: trackedCategoryIds(system),
    products: products.map(function (p) {
      return Object.assign({}, p, { stock: summary[p.id] });
    }),
    pieces: pieces.map(function (p) {
      return Object.assign({}, p, p.order_item_id ? orderNoByItem[p.order_item_id] || {} : {});
    }),
    lines: lines.map(function (l) {
      const got = piecesByItem[l.id] || [];
      return Object.assign({}, l, {
        pieces_needed: piecesNeeded(l),
        pieces: got.map(function (p) { return { id: p.id, weight_kg: Number(p.weight_kg), tag: p.tag }; })
      });
    })
  };
}

/**
 * What the shop / New order / Make changes may offer for these products.
 * @returns {Object<string,{tracked:true, shop_open:boolean, pieces:Array<{id,weight_kg,tag}>}>}
 */
async function shopAvailability(system, products) {
  const tracked = (products || []).filter(function (p) { return isStockProduct(system, p); });
  if (!tracked.length) return {};
  const ids = tracked.map(function (p) { return p.id; });
  const [pieces, lines] = await Promise.all([loadPieces(system, ids, ['available', 'allocated']), loadOpenLines(system, ids)]);
  const summary = summarise(tracked, pieces, lines);
  const out = {};
  tracked.forEach(function (p) {
    const s = summary[p.id];
    out[p.id] = {
      tracked: true,
      shop_open: s.shop_open,
      waiting_pieces: s.waiting_pieces,
      pieces: s.shop_open
        ? pieces
            .filter(function (x) { return x.product_id === p.id && x.status === 'available'; })
            .map(function (x) { return { id: x.id, weight_kg: Number(x.weight_kg), tag: x.tag || null }; })
        : []
    };
  });
  return out;
}

/* --------------------------------------------------------------- mutations */

async function loadItemWithOrder(itemId, system) {
  const admin = getAdmin();
  const { data: item } = await admin.from('order_items').select('*').eq('id', itemId).maybeSingle();
  if (!item) throw err('item_not_found', 404);
  const { data: order } = await admin.from('order_orders').select('*').eq('id', item.order_id).maybeSingle();
  if (!order || (system && order.order_system_id !== system.id)) throw err('item_not_found', 404);
  return { item, order };
}

/** Re-apply a line's weight/price from the pieces it holds, then recalc the order. */
async function syncLine(itemId, actor) {
  const admin = getAdmin();
  const { data: item } = await admin.from('order_items').select('*').eq('id', itemId).maybeSingle();
  if (!item) return null;
  const { data: pieces } = await admin
    .from('order_stock_pieces')
    .select('id,weight_kg')
    .eq('order_item_id', itemId)
    .eq('status', 'allocated');
  const patch = linePatchForPieces(item, pieces || []);
  if (patch.price_status === 'finalised') patch.finalised_by = (actor && actor.user_id) || null;
  const { error } = await admin.from('order_items').update(patch).eq('id', itemId);
  if (error) throw error;
  const { recalculateOrder } = require('./service');
  const recalc = await recalculateOrder(item.order_id);
  return { item: Object.assign({}, item, patch), order: recalc.order, pieces: pieces || [] };
}

async function receivePieces(system, opts) {
  const admin = getAdmin();
  const { data: product } = await admin
    .from('order_products')
    .select('id,name,order_system_id,site_id,category_id')
    .eq('id', opts.product_id)
    .maybeSingle();
  if (!product || product.order_system_id !== system.id) throw err('product_not_found', 404);
  const weights = parseWeights(opts.weights);
  if (!weights.length) throw err('weights_required', 400);
  if (weights.length > 500) throw err('too_many_weights', 400);
  const actor = opts.actor || {};
  const rows = weights.map(function (w, i) {
    const tagBase = opts.tag_start != null && opts.tag_start !== '' ? Number(opts.tag_start) : null;
    return {
      order_system_id: system.id,
      site_id: product.site_id,
      product_id: product.id,
      weight_kg: w,
      tag: tagBase != null && Number.isFinite(tagBase) ? String(tagBase + i) : null,
      received_by: actor.user_id || null,
      notes: opts.notes ? String(opts.notes).slice(0, 300) : null
    };
  });
  const { data, error } = await admin.from('order_stock_pieces').insert(rows).select('*');
  if (error) throw error;
  await writeAudit({
    order_system_id: system.id,
    site_id: product.site_id,
    event_type: 'stock_received',
    actor_user_id: actor.user_id || null,
    actor_label: actor.label || null,
    source: 'admin',
    payload: { product_id: product.id, product_name: product.name, count: rows.length, weights: weights }
  });
  return data || [];
}

/**
 * Give an available piece to an order line.
 * @param {{piece_id, order_item_id, allow_other_product?, actor?, source?}} opts
 */
async function allocatePiece(system, opts) {
  const admin = getAdmin();
  const actor = opts.actor || {};
  const { item, order } = await loadItemWithOrder(opts.order_item_id, system);
  if (OPEN_ORDER_STATUSES.indexOf(order.status) < 0 && order.status !== 'draft') throw err('order_not_open', 400);
  const { data: piece } = await admin.from('order_stock_pieces').select('*').eq('id', opts.piece_id).maybeSingle();
  if (!piece || piece.order_system_id !== system.id) throw err('piece_not_found', 404);
  if (piece.status !== 'available') throw err('piece_taken', 409);
  if (piece.product_id !== item.product_id) {
    if (!opts.allow_other_product) throw err('different_product', 409);
    const { data: prods } = await admin.from('order_products').select('id,category_id').in('id', [piece.product_id, item.product_id]);
    const cats = (prods || []).map(function (p) { return p.category_id; });
    if (cats.length !== 2 || cats[0] !== cats[1]) throw err('different_category', 409);
  }
  const { count } = await admin
    .from('order_stock_pieces')
    .select('id', { count: 'exact', head: true })
    .eq('order_item_id', item.id)
    .eq('status', 'allocated');
  if ((count || 0) >= piecesNeeded(item)) throw err('line_full', 409);

  const now = new Date().toISOString();
  const { data: taken, error } = await admin
    .from('order_stock_pieces')
    .update({
      status: 'allocated',
      order_id: order.id,
      order_item_id: item.id,
      allocated_at: now,
      allocated_by: actor.user_id || null,
      updated_at: now
    })
    .eq('id', piece.id)
    .eq('status', 'available')
    .select('id');
  if (error) throw error;
  if (!taken || !taken.length) throw err('piece_taken', 409);

  const synced = await syncLine(item.id, actor);
  await writeChange({
    order_id: order.id,
    site_id: order.site_id,
    order_item_id: item.id,
    field_path: 'item.stock_allocated',
    previous_value: null,
    new_value: { piece_id: piece.id, weight_kg: Number(piece.weight_kg), tag: piece.tag || null },
    source: opts.source || 'admin',
    actor_user_id: actor.user_id || null,
    actor_label: actor.label || null
  });
  return Object.assign({ piece_id: piece.id, weight_kg: Number(piece.weight_kg) }, synced);
}

/** Put an allocated piece back in stock (its line returns to estimate / TBC). */
async function releasePiece(system, opts) {
  const admin = getAdmin();
  const actor = opts.actor || {};
  const { data: piece } = await admin.from('order_stock_pieces').select('*').eq('id', opts.piece_id).maybeSingle();
  if (!piece || piece.order_system_id !== system.id) throw err('piece_not_found', 404);
  if (piece.status !== 'allocated') throw err('piece_not_allocated', 409);
  const itemId = piece.order_item_id;
  const orderId = piece.order_id;
  const { data: freed, error } = await admin
    .from('order_stock_pieces')
    .update({ status: 'available', order_id: null, order_item_id: null, allocated_at: null, allocated_by: null, updated_at: new Date().toISOString() })
    .eq('id', piece.id)
    .eq('status', 'allocated')
    .select('id');
  if (error) throw error;
  if (!freed || !freed.length) throw err('piece_not_allocated', 409);
  const synced = itemId ? await syncLine(itemId, actor) : null;
  if (orderId) {
    await writeChange({
      order_id: orderId,
      site_id: piece.site_id,
      order_item_id: itemId,
      field_path: 'item.stock_released',
      previous_value: { piece_id: piece.id, weight_kg: Number(piece.weight_kg), tag: piece.tag || null },
      new_value: null,
      source: opts.source || 'admin',
      actor_user_id: actor.user_id || null,
      actor_label: actor.label || null
    });
  }
  return Object.assign({ piece_id: piece.id }, synced || {});
}

/** Release every piece on these lines (line removed, order cancelled). Never throws. */
async function releaseForItems(system, itemIds, actor, source) {
  const ids = (itemIds || []).filter(Boolean);
  if (!ids.length) return 0;
  const admin = getAdmin();
  const { data: pieces } = await admin
    .from('order_stock_pieces')
    .select('id')
    .in('order_item_id', ids)
    .eq('status', 'allocated');
  let n = 0;
  for (const p of pieces || []) {
    try {
      await releasePiece(system, { piece_id: p.id, actor: actor, source: source });
      n += 1;
    } catch (e) {
      console.error('stock release', p.id, e && e.message);
    }
  }
  return n;
}

/** Release every piece on an order (cancel / void). */
async function releaseForOrder(system, orderId, actor, source) {
  const { data: items } = await getAdmin().from('order_items').select('id').eq('order_id', orderId);
  return releaseForItems(system, (items || []).map(function (i) { return i.id; }), actor, source);
}

async function updatePiece(system, opts) {
  const admin = getAdmin();
  const { data: piece } = await admin.from('order_stock_pieces').select('*').eq('id', opts.piece_id).maybeSingle();
  if (!piece || piece.order_system_id !== system.id) throw err('piece_not_found', 404);
  const patch = { updated_at: new Date().toISOString() };
  if (opts.weight_kg !== undefined) patch.weight_kg = parseWeights([opts.weight_kg])[0];
  if (opts.tag !== undefined) patch.tag = opts.tag ? String(opts.tag).slice(0, 40) : null;
  if (opts.notes !== undefined) patch.notes = opts.notes ? String(opts.notes).slice(0, 300) : null;
  if (opts.write_off === true) {
    if (piece.status === 'allocated') throw err('release_first', 409);
    patch.status = 'written_off';
  } else if (opts.write_off === false && piece.status === 'written_off') {
    patch.status = 'available';
  }
  const { data, error } = await admin.from('order_stock_pieces').update(patch).eq('id', piece.id).select('*').single();
  if (error) throw error;
  // A re-weighed allocated piece re-prices its line.
  if (piece.status === 'allocated' && piece.order_item_id && patch.weight_kg != null) {
    await syncLine(piece.order_item_id, opts.actor);
  }
  return data;
}

async function setTrackedCategories(system, categoryIds, actor) {
  const admin = getAdmin();
  const { data: cats } = await admin.from('order_categories').select('id').eq('order_system_id', system.id);
  const valid = {};
  (cats || []).forEach(function (c) { valid[c.id] = true; });
  const ids = (Array.isArray(categoryIds) ? categoryIds : []).map(String).filter(function (id) { return valid[id]; });
  const { data: fresh } = await admin.from('order_systems').select('settings').eq('id', system.id).single();
  const settings = Object.assign({}, (fresh && fresh.settings) || {});
  settings.stock_control = Object.assign({}, settings.stock_control || {}, { category_ids: ids });
  const { data, error } = await admin
    .from('order_systems')
    .update({ settings: settings, updated_at: new Date().toISOString() })
    .eq('id', system.id)
    .select('*')
    .single();
  if (error) throw error;
  await writeAudit({
    order_system_id: system.id,
    site_id: system.site_id,
    event_type: 'stock_categories_changed',
    actor_user_id: (actor && actor.user_id) || null,
    actor_label: (actor && actor.label) || null,
    source: 'admin',
    payload: { category_ids: ids }
  });
  return data;
}

module.exports = {
  OPEN_ORDER_STATUSES,
  stockSettings,
  trackedCategoryIds,
  isStockProduct,
  piecesNeeded,
  targetWeightKg,
  linePatchForPieces,
  summarise,
  suggestPairs,
  parseWeights,
  loadTrackedProducts,
  loadPieces,
  loadOpenLines,
  stockOverview,
  shopAvailability,
  syncLine,
  receivePieces,
  allocatePiece,
  releasePiece,
  releaseForItems,
  releaseForOrder,
  updatePiece,
  setTrackedCategories
};
