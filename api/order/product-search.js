'use strict';

const { json, methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, ensureOrderSystem } = require('../../lib/order/auth');
const { getAdmin } = require('../../lib/order/supabase');
const {
  collectProductSheetRows,
  sortProductSheetRows,
  serializeProductSheetRows,
  summariseProductSearch,
  normaliseQuery,
  todayYmd
} = require('../../lib/order/product-search');

async function loadOrdersForDateRange(admin, systemId, siteId, fromDate, toDate) {
  var q = admin
    .from('order_orders')
    .select('*')
    .eq('order_system_id', systemId)
    .eq('site_id', siteId)
    .gte('pickup_date', fromDate)
    .not('status', 'in', '("draft","cancelled","refunded")')
    .order('pickup_date')
    .order('order_number');
  if (toDate) q = q.lte('pickup_date', toDate);
  const { data: orders, error } = await q;
  if (error) throw error;
  const ids = (orders || []).map(function (o) {
    return o.id;
  });
  if (!ids.length) return [];
  const { data: items } = await admin.from('order_items').select('*').in('order_id', ids).order('sort_order');
  const byOrder = {};
  (orders || []).forEach(function (o) {
    byOrder[o.id] = Object.assign({}, o, { items: [] });
  });
  (items || []).forEach(function (it) {
    if (byOrder[it.order_id]) byOrder[it.order_id].items.push(it);
  });
  return Object.keys(byOrder).map(function (k) {
    return byOrder[k];
  });
}

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET'])) return;
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'auth' });
    const siteId = req.query && req.query.site_id;
    const access = await assertSiteAccess(user, siteId);
    if (!access.ok) return json(res, access.code, { error: access.error });
    const system = await ensureOrderSystem(siteId);
    const admin = getAdmin();

    const productQ = req.query && req.query.product_q;
    const productRefine = (req.query && req.query.product_refine) || '';
    const productMode = (req.query && req.query.product_mode) === 'exact' ? 'exact' : 'partial';
    const sortKey = (req.query && req.query.sort) || 'date';
    const sortDir = (req.query && req.query.sort_dir) === 'desc' ? 'desc' : 'asc';
    const q = normaliseQuery(productQ);
    if (!q) return json(res, 400, { error: 'product_q required' });

    const pickupDate = req.query && req.query.pickup_date;
    const pickupFrom = req.query && req.query.pickup_from;
    const pickupTo = req.query && req.query.pickup_to;
    const openEnded =
      String((req.query && req.query.open_ended) || '') === '1' ||
      String((req.query && req.query.date_mode) || '') === 'from_today' ||
      String((req.query && req.query.date_mode) || '') === 'all';

    let fromDate = pickupFrom || pickupDate || (openEnded ? todayYmd() : null);
    let toDate = pickupTo || null;
    if (!openEnded && !toDate) toDate = pickupDate || pickupFrom || fromDate;
    if (!fromDate) fromDate = todayYmd();
    if (toDate && toDate < fromDate) {
      const swap = fromDate;
      fromDate = toDate;
      toDate = swap;
    }
    if (openEnded) toDate = null;

    const orders = await loadOrdersForDateRange(admin, system.id, siteId, fromDate, toDate);
    let rows = collectProductSheetRows(orders, q, productMode, productRefine);
    rows = sortProductSheetRows(rows, sortKey, sortDir);
    const summary = summariseProductSearch(rows);

    return json(res, 200, {
      product_q: productQ,
      product_refine: productRefine || '',
      product_mode: productMode,
      sort: sortKey,
      sort_dir: sortDir,
      pickup_from: fromDate,
      pickup_to: toDate,
      open_ended: !toDate,
      match_count: summary.match_count,
      order_count: summary.order_count,
      dates: summary.dates,
      rows: serializeProductSheetRows(rows)
    });
  } catch (e) {
    console.error('order/product-search', e);
    return json(res, 500, { error: 'server_error' });
  }
};
