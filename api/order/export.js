'use strict';

const { json, methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, ensureOrderSystem } = require('../../lib/order/auth');
const { getAdmin } = require('../../lib/order/supabase');
const { aggregateSupply } = require('../../lib/order/supply');

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCsv(rows, columns) {
  const head = columns.map(function (c) {
    return csvEscape(c.label);
  }).join(',');
  const lines = (rows || []).map(function (r) {
    return columns
      .map(function (c) {
        return csvEscape(typeof c.value === 'function' ? c.value(r) : r[c.key]);
      })
      .join(',');
  });
  return [head].concat(lines).join('\n');
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
    const kind = (req.query && req.query.kind) || 'orders';

    let csv = '';
    let filename = 'export.csv';

    if (kind === 'orders') {
      let q = admin.from('order_orders').select('*').eq('site_id', siteId).order('created_at', { ascending: false }).limit(2000);
      if (req.query.status) q = q.eq('status', req.query.status);
      if (req.query.pickup_date) q = q.eq('pickup_date', req.query.pickup_date);
      if (req.query.from) q = q.gte('pickup_date', req.query.from);
      if (req.query.to) q = q.lte('pickup_date', req.query.to);
      const { data } = await q;
      csv = toCsv(data || [], [
        { key: 'order_number', label: 'Order #' },
        { key: 'customer_name', label: 'Customer' },
        { key: 'customer_phone', label: 'Phone' },
        { key: 'customer_email', label: 'Email' },
        { key: 'fulfilment_type', label: 'Fulfilment' },
        { key: 'pickup_date', label: 'Pickup date' },
        { key: 'status', label: 'Status' },
        { key: 'price_status', label: 'Price status' },
        { key: 'known_subtotal_cents', label: 'Known cents' },
        { key: 'deposit_paid_cents', label: 'Deposit paid cents' },
        { key: 'balance_cents', label: 'Balance cents' },
        { key: 'created_at', label: 'Created' }
      ]);
      filename = 'orders.csv';
    } else if (kind === 'order_items') {
      const { data: orders } = await admin
        .from('order_orders')
        .select('id,order_number,pickup_date,status')
        .eq('site_id', siteId)
        .limit(2000);
      const ids = (orders || []).map(function (o) {
        return o.id;
      });
      const byId = {};
      (orders || []).forEach(function (o) {
        byId[o.id] = o;
      });
      const { data: items } = ids.length
        ? await admin.from('order_items').select('*').in('order_id', ids)
        : { data: [] };
      const rows = (items || []).map(function (it) {
        const o = byId[it.order_id] || {};
        return Object.assign({}, it, {
          order_number: o.order_number,
          pickup_date: o.pickup_date,
          order_status: o.status
        });
      });
      csv = toCsv(rows, [
        { key: 'order_number', label: 'Order #' },
        { key: 'pickup_date', label: 'Pickup date' },
        { key: 'order_status', label: 'Order status' },
        { key: 'product_name', label: 'Product' },
        { key: 'quantity', label: 'Qty' },
        { key: 'requested_weight_kg', label: 'Requested kg' },
        { key: 'actual_weight_kg', label: 'Actual kg' },
        { key: 'price_status', label: 'Price status' },
        { key: 'line_known_cents', label: 'Known cents' },
        { key: 'line_final_cents', label: 'Final cents' }
      ]);
      filename = 'order-items.csv';
    } else if (kind === 'customers') {
      const { data } = await admin.from('order_customers').select('*').eq('site_id', siteId).limit(5000);
      csv = toCsv(data || [], [
        { key: 'name', label: 'Name' },
        { key: 'phone', label: 'Phone' },
        { key: 'email', label: 'Email' },
        { key: 'order_count', label: 'Orders' },
        { key: 'lifetime_spend_cents', label: 'Lifetime spend cents' },
        { key: 'last_order_at', label: 'Last order' }
      ]);
      filename = 'customers.csv';
    } else if (kind === 'payments') {
      const { data } = await admin.from('order_payments').select('*').eq('site_id', siteId).limit(5000);
      csv = toCsv(data || [], [
        { key: 'id', label: 'Payment id' },
        { key: 'order_id', label: 'Order id' },
        { key: 'kind', label: 'Kind' },
        { key: 'status', label: 'Status' },
        { key: 'amount_cents', label: 'Amount cents' },
        { key: 'paid_at', label: 'Paid at' },
        { key: 'created_at', label: 'Created' }
      ]);
      filename = 'payments.csv';
    } else if (kind === 'supply') {
      const pickup = req.query.pickup_date;
      if (!pickup) return json(res, 400, { error: 'pickup_date_required' });
      const { data: orders } = await admin
        .from('order_orders')
        .select('id,status')
        .eq('site_id', siteId)
        .eq('pickup_date', pickup);
      const ids = (orders || []).map(function (o) {
        return o.id;
      });
      const { data: items } = ids.length
        ? await admin.from('order_items').select('*').in('order_id', ids)
        : { data: [] };
      const packed = (orders || []).map(function (o) {
        return {
          status: o.status,
          items: (items || []).filter(function (it) {
            return it.order_id === o.id;
          })
        };
      });
      const lines = aggregateSupply(packed);
      csv = toCsv(lines, [
        { key: 'product_name', label: 'Product' },
        { key: 'quantity', label: 'Qty' },
        { key: 'requested_weight_kg', label: 'Requested kg' },
        { key: 'actual_weight_kg', label: 'Actual kg' }
      ]);
      filename = 'supply-' + pickup + '.csv';
    } else {
      return json(res, 400, { error: 'unknown_kind' });
    }

    res.statusCode = 200;
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', 'attachment; filename="' + filename + '"');
    res.end(csv);
  } catch (e) {
    console.error('order/export', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
