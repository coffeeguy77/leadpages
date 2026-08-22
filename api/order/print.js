'use strict';

const { methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, ensureOrderSystem } = require('../../lib/order/auth');
const { getAdmin } = require('../../lib/order/supabase');
const { resolveAccessToken } = require('../../lib/order/tokens');
const { supplyForDate } = require('../../lib/order/service');
const { formatAud } = require('../../lib/order/money');
const { buildPrintDocument, normaliseFormat } = require('../../lib/order/print-document');

async function loadOrderWithItems(admin, orderId, siteId) {
  const { data: order, error } = await admin
    .from('order_orders')
    .select('*')
    .eq('id', orderId)
    .eq('site_id', siteId)
    .maybeSingle();
  if (error) throw error;
  if (!order) return null;
  const { data: items } = await admin
    .from('order_items')
    .select('*')
    .eq('order_id', order.id)
    .order('sort_order');
  return { order: order, items: items || [] };
}

async function loadOrdersForDate(admin, systemId, siteId, pickupDate) {
  const { data: orders, error } = await admin
    .from('order_orders')
    .select('*')
    .eq('order_system_id', systemId)
    .eq('site_id', siteId)
    .eq('pickup_date', pickupDate)
    .not('status', 'in', '("draft","cancelled","refunded")');
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

function sendHtml(res, code, html) {
  res.statusCode = code;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(html);
}

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET'])) return;

    const admin = getAdmin();
    const portalToken = req.query && req.query.t;
    const format = (req.query && req.query.format) || 'slip';
    const autoprint = (req.query && req.query.autoprint) === '1';
    const pickupDate = req.query && req.query.pickup_date;
    const orderId = req.query && req.query.order_id;

    if (portalToken) {
      const tokenRow = await resolveAccessToken(portalToken);
      if (!tokenRow || !tokenRow.order_id) {
        return sendHtml(res, 401, buildPrintDocument({
          format: 'receipt',
          business: { business_name: 'Order' },
          order: { order_number: 'Access denied' },
          items: [],
          autoprint: false
        }));
      }
      const loaded = await loadOrderWithItems(admin, tokenRow.order_id, tokenRow.site_id);
      if (!loaded) return sendHtml(res, 404, buildPrintDocument({ format: 'receipt', order: { order_number: 'Not found' }, items: [] }));
      const { data: site } = await admin
        .from('sites')
        .select('id,slug,business_name')
        .eq('id', tokenRow.site_id)
        .maybeSingle();
      const fmt = normaliseFormat(format, true);
      return sendHtml(
        res,
        200,
        buildPrintDocument({
          format: fmt,
          business: site || {},
          order: loaded.order,
          items: loaded.items,
          autoprint: autoprint
        })
      );
    }

    const user = await requireUser(req);
    if (!user) return sendHtml(res, 401, buildPrintDocument({ format: 'slip', order: { order_number: 'Sign in required' }, items: [] }));
    const siteId = req.query && req.query.site_id;
    const access = await assertSiteAccess(user, siteId);
    if (!access.ok) {
      return sendHtml(res, access.code, buildPrintDocument({ format: 'slip', order: { order_number: 'Access denied' }, items: [] }));
    }
    const system = await ensureOrderSystem(siteId);
    const fmt = normaliseFormat(format, false);
    const business = access.site || {};

    if (fmt === 'prep' || fmt === 'day_run' || fmt === 'pick_list') {
      if (!pickupDate) {
        return sendHtml(res, 400, buildPrintDocument({ format: 'slip', business: business, order: { order_number: 'pickup_date required' }, items: [] }));
      }
      const orders = await loadOrdersForDate(admin, system.id, siteId, pickupDate);
      if (fmt === 'prep') {
        const supply = await supplyForDate(system.id, siteId, pickupDate);
        let known = 0;
        let deposits = 0;
        orders.forEach(function (o) {
          known += Number(o.final_subtotal_cents != null ? o.final_subtotal_cents : o.known_subtotal_cents) || 0;
          deposits += Number(o.deposit_paid_cents) || 0;
        });
        return sendHtml(
          res,
          200,
          buildPrintDocument({
            format: 'prep',
            business: business,
            pickup_date: pickupDate,
            supply: supply,
            meta: {
              order_count: supply.order_count,
              known_value_label: formatAud(known),
              deposits_label: formatAud(deposits)
            },
            autoprint: autoprint
          })
        );
      }
      return sendHtml(
        res,
        200,
        buildPrintDocument({
          format: fmt,
          business: business,
          pickup_date: pickupDate,
          orders: orders,
          autoprint: autoprint
        })
      );
    }

    if (!orderId) {
      return sendHtml(res, 400, buildPrintDocument({ format: 'slip', business: business, order: { order_number: 'order_id required' }, items: [] }));
    }
    const loaded = await loadOrderWithItems(admin, orderId, siteId);
    if (!loaded) {
      return sendHtml(res, 404, buildPrintDocument({ format: fmt, business: business, order: { order_number: 'Not found' }, items: [] }));
    }
    return sendHtml(
      res,
      200,
      buildPrintDocument({
        format: fmt,
        business: business,
        order: loaded.order,
        items: loaded.items,
        autoprint: autoprint
      })
    );
  } catch (e) {
    console.error('order/print', e);
    return sendHtml(
      res,
      500,
      buildPrintDocument({ format: 'slip', order: { order_number: 'Error' }, items: [], autoprint: false })
    );
  }
};
