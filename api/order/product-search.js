'use strict';

const { json, methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, ensureOrderSystem } = require('../../lib/order/auth');
const { getAdmin } = require('../../lib/order/supabase');
const {
  collectProductSheetRows,
  summariseProductSearch,
  normaliseQuery
} = require('../../lib/order/product-search');

async function loadOrdersForDateRange(admin, systemId, siteId, fromDate, toDate) {
  const { data: orders, error } = await admin
    .from('order_orders')
    .select('*')
    .eq('order_system_id', systemId)
    .eq('site_id', siteId)
    .gte('pickup_date', fromDate)
    .lte('pickup_date', toDate)
    .not('status', 'in', '("draft","cancelled","refunded")')
    .order('pickup_date')
    .order('order_number');
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
    const productMode = (req.query && req.query.product_mode) === 'exact' ? 'exact' : 'partial';
    const q = normaliseQuery(productQ);
    if (!q) return json(res, 400, { error: 'product_q required' });

    const pickupDate = req.query && req.query.pickup_date;
    const pickupFrom = req.query && req.query.pickup_from;
    const pickupTo = req.query && req.query.pickup_to;
    let fromDate = pickupFrom || pickupDate;
    let toDate = pickupTo || pickupDate || pickupFrom;
    if (!fromDate) return json(res, 400, { error: 'pickup_date or pickup_from required' });
    if (!toDate) toDate = fromDate;
    if (toDate < fromDate) {
      const swap = fromDate;
      fromDate = toDate;
      toDate = swap;
    }

    const orders = await loadOrdersForDateRange(admin, system.id, siteId, fromDate, toDate);
    const rows = collectProductSheetRows(orders, q, productMode);
    const summary = summariseProductSearch(rows);

    return json(res, 200, {
      product_q: productQ,
      product_mode: productMode,
      pickup_from: fromDate,
      pickup_to: toDate,
      match_count: summary.match_count,
      order_count: summary.order_count,
      dates: summary.dates
    });
  } catch (e) {
    console.error('order/product-search', e);
    return json(res, 500, { error: 'server_error' });
  }
};
