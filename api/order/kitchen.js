'use strict';

/**
 * Kitchen (cooking) list for the order engine.
 *
 * GET  ?site_id&from=YYYY-MM-DD&to=YYYY-MM-DD   → { board:{days, check, totals, settings}, today }
 * POST { site_id, action, ... }
 *   set_done       { order_item_id, done }          tick a cooked line off (or back on)
 *   add_cooking    { order_item_id }                a note asked for cooking: add charged cooking to the line
 *   dismiss_check  { order_item_id }                the note isn't a cooking request
 *   remove         { order_item_id }                take a line off the kitchen list (price unchanged)
 *   apply_charges  { dry_run }                      charge cooking (rate per kg + minimum) on every upcoming
 *                                                   line whose options say cooked/glazed but aren't charged yet
 *
 * Staff only (site owner, partner, super admin — same as the rest of /api/order).
 */

const { readBody, json, methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, ensureOrderSystem } = require('../../lib/order/auth');
const { getAdmin } = require('../../lib/order/supabase');
const { writeAudit } = require('../../lib/order/audit');
const { todayYmd } = require('../../lib/order/product-search');
const C = require('../../lib/order/cooking');

const ACTIVE_EXCLUDE = '("draft","cancelled","refunded","archived")';
const YMD = /^\d{4}-\d{2}-\d{2}$/;

function addDays(ymd, n) {
  const d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function loadOrders(admin, system, siteId, from, to) {
  let q = admin.from('order_orders').select('*')
    .eq('order_system_id', system.id).eq('site_id', siteId)
    .not('status', 'in', ACTIVE_EXCLUDE)
    .gte('pickup_date', from)
    .order('pickup_date').order('order_number')
    .limit(3000);
  if (to) q = q.lte('pickup_date', to);
  const { data: orders, error } = await q;
  if (error) throw error;
  const list = orders || [];
  if (!list.length) return [];
  const byId = {};
  list.forEach(function (o) { byId[o.id] = Object.assign({}, o, { items: [] }); });
  const ids = Object.keys(byId);
  for (let i = 0; i < ids.length; i += 200) {
    const { data: items, error: iErr } = await admin.from('order_items').select('*').in('order_id', ids.slice(i, i + 200)).order('sort_order');
    if (iErr) throw iErr;
    (items || []).forEach(function (it) { if (byId[it.order_id]) byId[it.order_id].items.push(it); });
  }
  return list.map(function (o) { return byId[o.id]; });
}

async function loadItem(admin, id, siteId) {
  const { data: item, error } = await admin.from('order_items').select('*').eq('id', String(id || '')).maybeSingle();
  if (error) throw error;
  if (!item || item.site_id !== siteId) return null;
  return item;
}

async function saveKitchen(admin, item, patchKitchen, extra) {
  const kitchen = Object.assign({}, item.kitchen || {}, patchKitchen);
  const patch = Object.assign({ kitchen: kitchen, updated_at: new Date().toISOString() }, extra || {});
  const { data, error } = await admin.from('order_items').update(patch).eq('id', item.id).select('*').single();
  if (error) throw error;
  return data;
}

/** Charge cooking on one line and recalculate its order. Returns { item, order } or null when unchanged. */
async function chargeLine(admin, system, item, actor, opts) {
  const patch = C.chargeCookingPatch(item, system, opts);
  if (!patch) return null;
  patch.updated_at = new Date().toISOString();
  const { data: updated, error } = await admin.from('order_items').update(patch).eq('id', item.id).select('*').single();
  if (error) throw error;
  const { recalculateOrderPreservingDeposit } = require('../../lib/order/service');
  const out = await recalculateOrderPreservingDeposit(item.order_id);
  await writeAudit({
    order_system_id: system.id, site_id: item.site_id, order_id: item.order_id,
    event_type: 'cooking_charged', actor_user_id: actor.user_id || null, actor_label: actor.label || null, source: 'admin',
    payload: {
      order_item_id: item.id, product_name: item.product_name,
      before: { line_known_cents: item.line_known_cents, line_final_cents: item.line_final_cents },
      after: { line_known_cents: updated.line_known_cents, line_final_cents: updated.line_final_cents }
    }
  });
  return { item: updated, order: out && out.order };
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
    const admin = getAdmin();
    const actor = { user_id: user.id, label: user.email };
    const today = todayYmd(system.timezone || 'Australia/Sydney');

    if (req.method === 'GET') {
      const qf = req.query && req.query.from;
      const qt = req.query && req.query.to;
      const from = YMD.test(String(qf || '')) ? qf : addDays(today, -1);
      const to = YMD.test(String(qt || '')) ? qt : null;
      const orders = await loadOrders(admin, system, siteId, from, to);
      const board = C.buildKitchenBoard(orders, system, { today: today });
      // Upcoming lines whose options say cooked/glazed but aren't charged at the shop rate yet.
      let uncharged = 0;
      if (C.cookingSettings(system).rate_cents_per_kg != null) {
        orders.forEach(function (o) {
          if (o.pickup_date && o.pickup_date < today) return;
          (o.items || []).forEach(function (it) { if (C.chargeCookingPatch(it, system)) uncharged++; });
        });
      }
      res.setHeader('Cache-Control', 'no-store');
      return json(res, 200, { board: board, today: today, from: from, to: to, uncharged: uncharged });
    }

    const action = String(body.action || '');

    if (action === 'set_done') {
      const item = await loadItem(admin, body.order_item_id, siteId);
      if (!item) return json(res, 404, { error: 'not_found' });
      const done = !!body.done;
      const now = new Date().toISOString();
      const updated = await saveKitchen(admin, item, {
        done: done, done_at: done ? now : null, done_by: done ? user.id : null, done_by_label: done ? (user.email || null) : null
      });
      await writeAudit({
        order_system_id: system.id, site_id: siteId, order_id: item.order_id,
        event_type: done ? 'kitchen_done' : 'kitchen_undone', actor_user_id: user.id, actor_label: user.email, source: 'admin',
        payload: { order_item_id: item.id, product_name: item.product_name }
      });
      return json(res, 200, { item: updated });
    }

    if (action === 'add_cooking') {
      const item = await loadItem(admin, body.order_item_id, siteId);
      if (!item) return json(res, 404, { error: 'not_found' });
      const label = String(body.label || 'Cooked').slice(0, 40);
      const charged = await chargeLine(admin, system, item, actor, { force: true, label: label });
      const fresh = charged ? charged.item : item;
      const updated = await saveKitchen(admin, fresh, { added: true, label: label, excluded: false });
      return json(res, 200, { item: updated, order: charged && charged.order, charged: !!charged });
    }

    if (action === 'dismiss_check') {
      const item = await loadItem(admin, body.order_item_id, siteId);
      if (!item) return json(res, 404, { error: 'not_found' });
      const updated = await saveKitchen(admin, item, { check_dismissed: true });
      return json(res, 200, { item: updated });
    }

    if (action === 'remove') {
      const item = await loadItem(admin, body.order_item_id, siteId);
      if (!item) return json(res, 404, { error: 'not_found' });
      const updated = await saveKitchen(admin, item, { excluded: body.restore ? false : true, added: body.restore ? !!(item.kitchen && item.kitchen.added) : false });
      return json(res, 200, { item: updated });
    }

    if (action === 'apply_charges') {
      if (C.cookingSettings(system).rate_cents_per_kg == null) return json(res, 400, { error: 'no_cooking_rate' });
      const orders = await loadOrders(admin, system, siteId, today, null);
      const todo = [];
      orders.forEach(function (o) {
        (o.items || []).forEach(function (it) {
          const p = C.chargeCookingPatch(it, system);
          if (p) todo.push({ order: o, item: it, patch: p });
        });
      });
      const preview = todo.map(function (t) {
        return {
          order_number: t.order.order_number, customer_name: t.order.customer_name, pickup_date: t.order.pickup_date,
          product_name: t.item.product_name,
          before_cents: t.item.line_final_cents != null ? t.item.line_final_cents : t.item.line_known_cents,
          after_cents: t.patch.line_final_cents != null ? t.patch.line_final_cents : (t.patch.line_known_cents !== undefined ? t.patch.line_known_cents : t.item.line_known_cents)
        };
      });
      if (body.dry_run) return json(res, 200, { count: todo.length, lines: preview });
      let done = 0;
      const failed = [];
      for (const t of todo) {
        try { if (await chargeLine(admin, system, t.item, actor)) done++; } catch (e) { failed.push({ order_number: t.order.order_number, error: e.message }); }
      }
      return json(res, 200, { count: todo.length, charged: done, failed: failed, lines: preview });
    }

    return json(res, 400, { error: 'unknown_action' });
  } catch (e) {
    console.error('order/kitchen', e);
    return json(res, e.code && e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.message || 'server' });
  }
};

module.exports._test = { addDays };
