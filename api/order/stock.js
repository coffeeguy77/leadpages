'use strict';

/**
 * Stock screen (staff only) — received hams / turkeys allocated to orders.
 *
 *   GET  ?site_id=…[&category_id=…]       → overview (one category, or all switched-on ones): categories, tracked products + counts,
 *                                           pieces, open-order lines waiting for stock
 *   POST { site_id, action, … }
 *     set_categories { category_ids }     → which categories are stock-controlled
 *     receive        { product_id, weights, tag_start?, notes? }
 *     update_piece   { piece_id, weight_kg?, tag?, notes?, write_off? }
 *     allocate       { piece_id, order_item_id, allow_other_product? }
 *     release        { piece_id }
 *     suggest        { product_id? }      → proposed pairs (nothing saved)
 *     allocate_many  { pairs: [{piece_id, order_item_id}] }
 *
 * See lib/order/stock.js for the rules.
 */

const { readBody, json, methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, ensureOrderSystem } = require('../../lib/order/auth');
const { getAdmin } = require('../../lib/order/supabase');
const stock = require('../../lib/order/stock');

const MESSAGES = {
  piece_taken: 'That piece has just been allocated elsewhere — refresh and pick another.',
  different_product: 'That piece is a different size from the order line.',
  different_category: 'That piece is from a different category.',
  line_full: 'That order line already has all its pieces.',
  order_not_open: 'That order is closed (cancelled or collected).',
  release_first: 'Release the piece from its order before writing it off.',
  invalid_weight: 'Weights must be numbers in kg, e.g. 3.82',
  weights_required: 'Enter at least one weight.'
};

function fail(res, e) {
  const code = typeof e.code === 'number' ? e.code : 500;
  const key = e.message;
  return json(res, code, {
    error: key,
    message: MESSAGES[key] ? MESSAGES[key] + (e.value ? ' ("' + e.value + '")' : '') : undefined
  });
}

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET', 'POST'])) return;
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'auth' });
    const body = req.method === 'GET' ? {} : await readBody(req);
    const siteId = (req.query && req.query.site_id) || body.site_id;
    const access = await assertSiteAccess(user, siteId);
    if (!access.ok) return json(res, access.code, { error: access.error });
    const system = await ensureOrderSystem(siteId);
    const actor = { user_id: user.id, label: user.email || null };

    if (req.method === 'GET') {
      const { data: categories } = await getAdmin()
        .from('order_categories')
        .select('id,name,sort_order,active')
        .eq('order_system_id', system.id)
        .order('sort_order', { ascending: true });
      const catId = req.query && req.query.category_id;
      const valid = (categories || []).some(function (c) { return c.id === catId; });
      const overview = await stock.stockOverview(system, valid ? [catId] : null);
      return json(res, 200, Object.assign({ categories: categories || [] }, overview));
    }

    try {
      switch (body.action) {
        case 'set_categories': {
          const updated = await stock.setTrackedCategories(system, body.category_ids, actor);
          return json(res, 200, { ok: true, category_ids: stock.trackedCategoryIds(updated) });
        }
        case 'receive': {
          const rows = await stock.receivePieces(system, {
            product_id: body.product_id,
            weights: body.weights,
            tag_start: body.tag_start,
            notes: body.notes,
            actor: actor
          });
          return json(res, 200, { ok: true, received: rows.length, pieces: rows });
        }
        case 'update_piece': {
          const piece = await stock.updatePiece(system, Object.assign({}, body, { actor: actor }));
          return json(res, 200, { ok: true, piece: piece });
        }
        case 'allocate': {
          const out = await stock.allocatePiece(system, {
            piece_id: body.piece_id,
            order_item_id: body.order_item_id,
            allow_other_product: !!body.allow_other_product,
            actor: actor
          });
          return json(res, 200, { ok: true, piece_id: out.piece_id, item: out.item, order: out.order });
        }
        case 'release': {
          await stock.releasePiece(system, { piece_id: body.piece_id, actor: actor });
          return json(res, 200, { ok: true });
        }
        case 'suggest': {
          const products = await stock.loadTrackedProducts(system, body.category_id ? [String(body.category_id)] : null);
          const list = body.product_id ? products.filter(function (p) { return p.id === body.product_id; }) : products;
          const ids = list.map(function (p) { return p.id; });
          const byId = {};
          list.forEach(function (p) { byId[p.id] = p; });
          const [pieces, lines] = await Promise.all([stock.loadPieces(system, ids), stock.loadOpenLines(system, ids)]);
          const pairs = stock.suggestPairs(lines, pieces, byId);
          const lineById = {};
          lines.forEach(function (l) { lineById[l.id] = l; });
          return json(res, 200, {
            ok: true,
            pairs: pairs.map(function (p) {
              const l = lineById[p.order_item_id] || {};
              return Object.assign({}, p, {
                order_number: l.order_number,
                customer_name: l.customer_name,
                pickup_date: l.pickup_date,
                product_name: l.product_name
              });
            })
          });
        }
        case 'allocate_many': {
          const pairs = Array.isArray(body.pairs) ? body.pairs.slice(0, 500) : [];
          const done = [];
          const failed = [];
          for (const p of pairs) {
            try {
              await stock.allocatePiece(system, { piece_id: p.piece_id, order_item_id: p.order_item_id, actor: actor });
              done.push(p);
            } catch (e) {
              failed.push(Object.assign({}, p, { error: e.message, message: MESSAGES[e.message] || null }));
            }
          }
          return json(res, 200, { ok: true, allocated: done.length, failed: failed });
        }
        default:
          return json(res, 400, { error: 'unknown_action' });
      }
    } catch (e) {
      if (typeof e.code === 'number') return fail(res, e);
      throw e;
    }
  } catch (e) {
    console.error('order/stock', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
