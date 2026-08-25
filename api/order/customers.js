'use strict';

const { readBody, json, methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, ensureOrderSystem } = require('../../lib/order/auth');
const { getAdmin } = require('../../lib/order/supabase');
const { formatAud } = require('../../lib/order/money');
const { normaliseAuPhone } = require('../../lib/order/phone');
const { displayFullName } = require('../../lib/order/customer-name');
const { backfillCustomerNames } = require('../../lib/order/backfill-customer-names');

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET', 'PATCH', 'POST'])) return;
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'auth' });
    const body = req.method === 'GET' ? {} : await readBody(req);
    const siteId = (req.query && req.query.site_id) || body.site_id;
    const access = await assertSiteAccess(user, siteId);
    if (!access.ok) return json(res, access.code, { error: access.error });
    await ensureOrderSystem(siteId);
    const admin = getAdmin();

    if (req.method === 'POST') {
      const action = body.action || 'normalize_names';
      if (action === 'normalize_names') {
        const result = await backfillCustomerNames({ site_id: siteId, limit: body.limit || 5000 });
        return json(res, 200, { ok: true, result: result });
      }
      return json(res, 400, { error: 'bad_action' });
    }

    if (req.method === 'GET') {
      const id = req.query && req.query.id;
      if (id) {
        const lite = req.query && req.query.lite === '1';
        const { data: customer } = await admin
          .from('order_customers')
          .select('*')
          .eq('id', id)
          .eq('site_id', siteId)
          .maybeSingle();
        if (!customer) return json(res, 404, { error: 'not_found' });
        const ordersRes = await admin
          .from('order_orders')
          .select('id,order_number,status,pickup_date,known_subtotal_cents,deposit_paid_cents,created_at')
          .eq('customer_id', id)
          .order('created_at', { ascending: false })
          .limit(50);
        const orders = ordersRes.data || [];
        var orderIds = orders.map(function (o) { return o.id; });
        var payments = [];
        var messages = [];
        if (!lite) {
          const msgRes = await admin
            .from('order_messages')
            .select('*')
            .eq('customer_id', id)
            .order('created_at', { ascending: false })
            .limit(50);
          messages = msgRes.data || [];
          if (orderIds.length) {
            const payRes = await admin
              .from('order_payments')
              .select('*')
              .in('order_id', orderIds)
              .order('created_at', { ascending: false })
              .limit(50);
            payments = payRes.data || [];
          }
        }
        return json(res, 200, {
          customer: customer,
          orders: orders,
          payments: payments,
          messages: messages,
          display: { lifetime_spend: formatAud(customer.lifetime_spend_cents) }
        });
      }

      const liteList = req.query && req.query.lite === '1';
      // Opportunistic backfill — skip on lite list requests (preload / warm cache).
      if (!liteList) {
        try {
          await backfillCustomerNames({ site_id: siteId, limit: 400 });
        } catch (_e) {}
      }

      const q = (req.query && req.query.q) || '';
      let query = admin
        .from('order_customers')
        .select('*')
        .eq('site_id', siteId)
        .order('last_order_at', { ascending: false, nullsFirst: false })
        .limit(200);
      if (q) {
        query = query.or(
          'name.ilike.%' + q + '%,phone.ilike.%' + q + '%,email.ilike.%' + q + '%'
        );
      }
      const { data, error } = await query;
      if (error) throw error;
      return json(res, 200, { customers: data || [] });
    }

    if (req.method === 'PATCH') {
      const id = body.id;
      if (!id) return json(res, 400, { error: 'id_required' });
      const patch = { updated_at: new Date().toISOString() };
      ['name', 'phone', 'email', 'address_line1', 'address_line2', 'suburb', 'state', 'postcode', 'notes'].forEach(
        function (k) {
          if (body[k] !== undefined) patch[k] = body[k];
        }
      );
      if (body.name !== undefined) {
        patch.name = displayFullName(body.name) || body.name;
      }
      if (body.phone !== undefined) {
        patch.phone_e164 = normaliseAuPhone(body.phone) || null;
      }
      const { data, error } = await admin
        .from('order_customers')
        .update(patch)
        .eq('id', id)
        .eq('site_id', siteId)
        .select('*')
        .single();
      if (error) throw error;
      if (body.phone !== undefined || body.email !== undefined || body.name !== undefined) {
        const orderPatch = { updated_at: new Date().toISOString() };
        if (body.name !== undefined) orderPatch.customer_name = data.name;
        if (body.phone !== undefined) orderPatch.customer_phone = data.phone;
        if (body.email !== undefined) orderPatch.customer_email = data.email;
        await admin.from('order_orders').update(orderPatch).eq('customer_id', id).eq('site_id', siteId);
      }
      return json(res, 200, { customer: data });
    }
  } catch (e) {
    console.error('order/customers', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
