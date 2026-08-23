'use strict';

const { readBody, json, methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, ensureOrderSystem } = require('../../lib/order/auth');
const { getAdmin } = require('../../lib/order/supabase');
const {
  createStaffOrder,
  lockOrdersForDate,
  finaliseItemPrice,
  recalculateOrder
} = require('../../lib/order/service');
const { writeAudit } = require('../../lib/order/audit');
const { createAccessToken } = require('../../lib/order/tokens');
const { formatAud } = require('../../lib/order/money');

const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://leadpages.com.au').replace(/\/+$/, '');

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET', 'POST', 'PATCH'])) return;
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'auth' });
    const body = req.method === 'GET' ? {} : await readBody(req);
    const siteId = (req.query && req.query.site_id) || body.site_id;
    const access = await assertSiteAccess(user, siteId);
    if (!access.ok) return json(res, access.code, { error: access.error });
    const system = await ensureOrderSystem(siteId);
    const admin = getAdmin();
    const actor = { user_id: user.id, label: user.email };

    if (req.method === 'GET') {
      const id = req.query && req.query.id;
      if (id) {
        const { data: order, error } = await admin
          .from('order_orders')
          .select('*')
          .eq('id', id)
          .eq('site_id', siteId)
          .maybeSingle();
        if (error) throw error;
        if (!order) return json(res, 404, { error: 'not_found' });
        const { data: items } = await admin
          .from('order_items')
          .select('*')
          .eq('order_id', id)
          .order('sort_order');
        const { data: payments } = await admin
          .from('order_payments')
          .select('*')
          .eq('order_id', id)
          .order('created_at', { ascending: false });
        const { data: changes } = await admin
          .from('order_changes')
          .select('*')
          .eq('order_id', id)
          .order('created_at', { ascending: false })
          .limit(100);
        const { data: messages } = await admin
          .from('order_messages')
          .select('*')
          .eq('order_id', id)
          .order('created_at', { ascending: false })
          .limit(50);
        const { data: auditEvents } = await admin
          .from('order_audit_events')
          .select('*')
          .eq('order_id', id)
          .order('created_at', { ascending: false })
          .limit(100);
        const itemIds = (items || []).map(function (it) { return it.id; });
        let itemAnswers = [];
        if (itemIds.length) {
          const ans = await admin
            .from('order_item_answers')
            .select('*')
            .in('order_item_id', itemIds);
          itemAnswers = ans.data || [];
        }
        return json(res, 200, {
          order: order,
          items: items || [],
          payments: payments || [],
          changes: changes || [],
          messages: messages || [],
          audit_events: auditEvents || [],
          item_answers: itemAnswers,
          display: {
            known_subtotal: formatAud(order.known_subtotal_cents),
            deposit_required: formatAud(order.deposit_required_cents),
            deposit_paid: formatAud(order.deposit_paid_cents),
            balance: order.balance_cents != null ? formatAud(order.balance_cents) : 'TBC'
          }
        });
      }

      let q = admin
        .from('order_orders')
        .select('*')
        .eq('order_system_id', system.id)
        .order('created_at', { ascending: false })
        .limit(Math.min(parseInt((req.query && req.query.limit) || '100', 10) || 100, 300));
      if (req.query && req.query.active === '1') {
        q = q.not('status', 'in', '("cancelled","draft","archived","completed","refunded")');
      } else if (req.query && req.query.status === 'archived') {
        q = q.in('status', ['archived', 'completed']);
      } else if (req.query && req.query.status) {
        q = q.eq('status', req.query.status);
      }
      if (req.query && req.query.pickup_date) q = q.eq('pickup_date', req.query.pickup_date);
      if (req.query && req.query.price_tbc === '1') q = q.eq('has_unknown_prices', true);
      if (req.query && req.query.editing_state) q = q.eq('editing_state', req.query.editing_state);
      if (req.query && req.query.q) {
        const s = '%' + String(req.query.q).slice(0, 80) + '%';
        q = q.or(
          'order_number.ilike.' + s + ',customer_name.ilike.' + s + ',customer_phone.ilike.' + s + ',customer_email.ilike.' + s
        );
      }
      const { data, error } = await q;
      if (error) throw error;
      return json(res, 200, { orders: data || [] });
    }

    if (req.method === 'POST') {
      const action = body.action || 'create';

      if (action === 'create') {
        const result = await createStaffOrder({
          system: system,
          site: access.site,
          actor: actor,
          body: body
        });
        return json(res, 200, {
          order: result.order,
          items: result.items,
          portal_url: PUBLIC_BASE + '/order-portal?t=' + encodeURIComponent(result.portal_token),
          deposit_url: result.deposit_token
            ? PUBLIC_BASE + '/order-portal?t=' + encodeURIComponent(result.deposit_token)
            : null,
          after_create: result.after_create || {}
        });
      }

      if (action === 'lock_date') {
        if (!body.pickup_date) return json(res, 400, { error: 'pickup_date_required' });
        if (!body.confirm) return json(res, 400, { error: 'confirm_required' });
        const out = await lockOrdersForDate(system, access.site, body.pickup_date, actor);
        return json(res, 200, out);
      }

      if (action === 'lock_order') {
        if (!body.order_id) return json(res, 400, { error: 'order_id_required' });
        const now = new Date().toISOString();
        const { data, error } = await admin
          .from('order_orders')
          .update({
            editing_state: 'locked',
            status: 'locked',
            locked_at: now,
            locked_by: user.id,
            lock_source: 'admin',
            updated_at: now
          })
          .eq('id', body.order_id)
          .eq('site_id', siteId)
          .select('*')
          .single();
        if (error) throw error;
        await writeAudit({
          order_system_id: system.id,
          site_id: siteId,
          order_id: data.id,
          event_type: 'order_locked',
          actor_user_id: user.id,
          source: 'admin',
          payload: {}
        });
        return json(res, 200, { order: data });
      }

      if (action === 'set_status') {
        if (!body.order_id || !body.status) return json(res, 400, { error: 'order_id_and_status_required' });
        const patch = { status: body.status, updated_at: new Date().toISOString() };
        if (body.status === 'ready') patch.ready_at = patch.updated_at;
        if (body.status === 'collected') patch.collected_at = patch.updated_at;
        if (body.status === 'completed') patch.completed_at = patch.updated_at;
        if (body.status === 'cancelled') patch.cancelled_at = patch.updated_at;
        const { data, error } = await admin
          .from('order_orders')
          .update(patch)
          .eq('id', body.order_id)
          .eq('site_id', siteId)
          .select('*')
          .single();
        if (error) throw error;
        await writeAudit({
          order_system_id: system.id,
          site_id: siteId,
          order_id: data.id,
          event_type: 'status_changed',
          actor_user_id: user.id,
          source: 'admin',
          payload: { status: body.status }
        });
        return json(res, 200, { order: data });
      }

      if (action === 'finalise_item') {
        if (!body.order_item_id) return json(res, 400, { error: 'order_item_id_required' });
        const out = await finaliseItemPrice(
          body.order_item_id,
          body.actual_weight_kg,
          body.rate_cents != null ? body.rate_cents : body.unit_price_cents,
          actor
        );
        return json(res, 200, out);
      }

      if (action === 'recalculate') {
        if (!body.order_id) return json(res, 400, { error: 'order_id_required' });
        const out = await recalculateOrder(body.order_id);
        return json(res, 200, out);
      }

      if (action === 'add_order_item') {
        if (!body.order_id) return json(res, 400, { error: 'order_id_required' });
        const { addOrderItem } = require('../../lib/order/order-item-mutations');
        const out = await addOrderItem({
          order_id: body.order_id,
          site_id: siteId,
          system: system,
          site: access.site,
          actor: actor,
          line: {
            product_id: body.product_id,
            quantity: body.quantity,
            requested_weight_kg: body.requested_weight_kg,
            notes: body.notes,
            answers: body.answers
          }
        });
        return json(res, 200, out);
      }

      if (action === 'remove_order_item') {
        if (!body.order_item_id) return json(res, 400, { error: 'order_item_id_required' });
        const { removeOrderItem } = require('../../lib/order/order-item-mutations');
        const out = await removeOrderItem({
          order_item_id: body.order_item_id,
          site_id: siteId,
          system: system,
          actor: actor
        });
        return json(res, 200, out);
      }

      if (action === 'send_deposit_link') {
        if (!body.order_id) return json(res, 400, { error: 'order_id_required' });
        const { sendDepositLink } = require('../../lib/order/staff-order-actions');
        const out = await sendDepositLink({
          order_id: body.order_id,
          site_id: siteId,
          system: system,
          site: access.site,
          actor: actor,
          phone: body.phone,
          email: body.email,
          channel: body.channel || 'both'
        });
        return json(res, 200, out);
      }

      if (action === 'void_order') {
        if (!body.order_id) return json(res, 400, { error: 'order_id_required' });
        const { voidOrder } = require('../../lib/order/staff-order-actions');
        const out = await voidOrder({
          order_id: body.order_id,
          site_id: siteId,
          system: system,
          actor: actor,
          reason: body.reason
        });
        return json(res, 200, out);
      }

      if (action === 'restore_order') {
        if (!body.order_id) return json(res, 400, { error: 'order_id_required' });
        const { restoreOrder } = require('../../lib/order/staff-order-actions');
        const out = await restoreOrder({
          order_id: body.order_id,
          site_id: siteId,
          system: system,
          actor: actor
        });
        return json(res, 200, out);
      }

      if (action === 'record_inhouse_payment') {
        if (!body.order_id) return json(res, 400, { error: 'order_id_required' });
        const { data: order } = await admin
          .from('order_orders')
          .select('*')
          .eq('id', body.order_id)
          .eq('site_id', siteId)
          .maybeSingle();
        if (!order) return json(res, 404, { error: 'not_found' });
        const { recordInhousePayment } = require('../../lib/order/manual-payment');
        const out = await recordInhousePayment({
          order: order,
          system: system,
          site: access.site,
          actor: actor,
          method: body.method,
          amount_cents: body.amount_cents,
          notes: body.notes
        });
        return json(res, 200, out);
      }

      if (action === 'send_receipt') {
        if (!body.order_id) return json(res, 400, { error: 'order_id_required' });
        const { sendOrderReceipt } = require('../../lib/order/staff-order-actions');
        const out = await sendOrderReceipt({
          order_id: body.order_id,
          site_id: siteId,
          system: system,
          site: access.site,
          actor: actor,
          channel: body.channel || 'both'
        });
        return json(res, 200, out);
      }

      if (action === 'send_deposit_reminders') {
        const { sendBulkDepositReminders } = require('../../lib/order/deposit-reminder');
        const out = await sendBulkDepositReminders({
          system: system,
          site: access.site,
          actor: actor,
          order_ids: body.order_ids,
          manual: body.manual !== false,
          channel: body.channel || 'both',
          limit: body.limit || 80
        });
        return json(res, 200, out);
      }

      return json(res, 400, { error: 'unknown_action' });
    }

    if (req.method === 'PATCH') {
      const id = body.id || body.order_id;
      if (!id) return json(res, 400, { error: 'id_required' });
      const { patchOrderWithAudit } = require('../../lib/order/staff-order-actions');
      const out = await patchOrderWithAudit({
        order_id: id,
        site_id: siteId,
        system: system,
        actor: actor,
        body: body
      });
      return json(res, 200, out);
    }
  } catch (e) {
    console.error('order/orders', e);
    const code = e && e.code === 400 ? 400 : e && e.code === 404 ? 404 : 500;
    return json(res, code, { error: String((e && e.message) || e) });
  }
};
