'use strict';

const { readBody, json, methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, ensureOrderSystem } = require('../../lib/order/auth');
const { getAdmin } = require('../../lib/order/supabase');
const { writeAudit, writeChange } = require('../../lib/order/audit');
const { recalculateOrder } = require('../../lib/order/service');

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

    if (req.method === 'GET') {
      let q = admin
        .from('order_change_requests')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (req.query.status) q = q.eq('status', req.query.status);
      else q = q.eq('status', 'pending');
      const { data, error } = await q;
      if (error) throw error;
      return json(res, 200, { requests: data || [] });
    }

    const action = body.action;
    if (!body.id) return json(res, 400, { error: 'id_required' });
    const { data: reqRow } = await admin
      .from('order_change_requests')
      .select('*')
      .eq('id', body.id)
      .eq('site_id', siteId)
      .maybeSingle();
    if (!reqRow) return json(res, 404, { error: 'not_found' });

    if (action === 'decline') {
      const { data } = await admin
        .from('order_change_requests')
        .update({
          status: 'declined',
          decided_by: user.id,
          decided_at: new Date().toISOString(),
          admin_note: body.note || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', reqRow.id)
        .select('*')
        .single();
      await writeAudit({
        order_system_id: system.id,
        site_id: siteId,
        order_id: reqRow.order_id,
        event_type: 'change_request_declined',
        actor_user_id: user.id,
        source: 'admin',
        payload: { id: reqRow.id }
      });
      return json(res, 200, { request: data });
    }

    if (action === 'approve') {
      const changes = Array.isArray(reqRow.proposed_changes)
        ? reqRow.proposed_changes
        : reqRow.proposed_changes && reqRow.proposed_changes.items
          ? reqRow.proposed_changes.items
          : [];
      const meta =
        reqRow.proposed_changes && !Array.isArray(reqRow.proposed_changes)
          ? reqRow.proposed_changes
          : {};

      for (const line of changes) {
        const itemId = line.order_item_id || line.id;
        if (!itemId) continue;
        const itemPatch = {};
        if (line.quantity != null) itemPatch.quantity = line.quantity;
        if (line.requested_weight_kg != null) itemPatch.requested_weight_kg = line.requested_weight_kg;
        if (line.notes != null) itemPatch.notes = line.notes;
        if (Object.keys(itemPatch).length) {
          const { data: before } = await admin.from('order_items').select('*').eq('id', itemId).maybeSingle();
          await admin.from('order_items').update(itemPatch).eq('id', itemId).eq('order_id', reqRow.order_id);
          if (before) {
            await writeChange({
              order_id: reqRow.order_id,
              site_id: siteId,
              order_item_id: itemId,
              field_path: 'item_update',
              previous_value: { quantity: before.quantity, requested_weight_kg: before.requested_weight_kg },
              new_value: itemPatch,
              source: 'admin',
              actor_user_id: user.id,
              actor_label: user.email
            });
          }
        }
      }

      const orderPatch = { updated_at: new Date().toISOString() };
      if (meta.customer_notes != null) orderPatch.customer_notes = meta.customer_notes;
      if (meta.pickup_date != null) orderPatch.pickup_date = meta.pickup_date;
      if (meta.pickup_time != null) orderPatch.pickup_time = meta.pickup_time;
      await admin.from('order_orders').update(orderPatch).eq('id', reqRow.order_id);
      if (changes.length) await recalculateOrder(reqRow.order_id);

      const { data } = await admin
        .from('order_change_requests')
        .update({
          status: 'approved',
          decided_by: user.id,
          decided_at: new Date().toISOString(),
          admin_note: body.note || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', reqRow.id)
        .select('*')
        .single();

      await writeAudit({
        order_system_id: system.id,
        site_id: siteId,
        order_id: reqRow.order_id,
        event_type: 'change_request_approved',
        actor_user_id: user.id,
        source: 'admin',
        payload: { id: reqRow.id }
      });
      return json(res, 200, { request: data });
    }

    return json(res, 400, { error: 'unknown_action' });
  } catch (e) {
    console.error('order/change-requests', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
