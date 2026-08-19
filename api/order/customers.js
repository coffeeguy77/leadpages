'use strict';

const { readBody, json, methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, ensureOrderSystem } = require('../../lib/order/auth');
const { getAdmin } = require('../../lib/order/supabase');
const { formatAud } = require('../../lib/order/money');

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET', 'PATCH'])) return;
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'auth' });
    const body = req.method === 'GET' ? {} : await readBody(req);
    const siteId = (req.query && req.query.site_id) || body.site_id;
    const access = await assertSiteAccess(user, siteId);
    if (!access.ok) return json(res, access.code, { error: access.error });
    await ensureOrderSystem(siteId);
    const admin = getAdmin();

    if (req.method === 'GET') {
      const id = req.query && req.query.id;
      if (id) {
        const { data: customer } = await admin
          .from('order_customers')
          .select('*')
          .eq('id', id)
          .eq('site_id', siteId)
          .maybeSingle();
        if (!customer) return json(res, 404, { error: 'not_found' });
        const { data: orders } = await admin
          .from('order_orders')
          .select('id,order_number,status,pickup_date,known_subtotal_cents,deposit_paid_cents,created_at')
          .eq('customer_id', id)
          .order('created_at', { ascending: false })
          .limit(50);
        const { data: payments } = await admin
          .from('order_payments')
          .select('*')
          .eq('customer_id', id)
          .order('created_at', { ascending: false })
          .limit(50);
        const { data: messages } = await admin
          .from('order_messages')
          .select('*')
          .eq('customer_id', id)
          .order('created_at', { ascending: false })
          .limit(50);
        return json(res, 200, {
          customer: customer,
          orders: orders || [],
          payments: payments || [],
          messages: messages || [],
          display: { lifetime_spend: formatAud(customer.lifetime_spend_cents) }
        });
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
      const { data, error } = await admin
        .from('order_customers')
        .update(patch)
        .eq('id', id)
        .eq('site_id', siteId)
        .select('*')
        .single();
      if (error) throw error;
      return json(res, 200, { customer: data });
    }
  } catch (e) {
    console.error('order/customers', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
