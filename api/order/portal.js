'use strict';

const { readBody, json, methodOk } = require('../../lib/order/http');
const { getAdmin } = require('../../lib/order/supabase');
const { resolveAccessToken } = require('../../lib/order/tokens');
const { formatAud } = require('../../lib/order/money');
const { orderGstSummary } = require('../../lib/order/gst');
const { editingStateFor } = require('../../lib/order/cutoff');
const { writeChange, writeAudit } = require('../../lib/order/audit');
const { recalculateOrder } = require('../../lib/order/service');
const { priceLineAtOrder } = require('../../lib/order/pricing');
const { parsePickupSchedule } = require('../../lib/order/pickup-schedule');
const { isMasterLockActive } = require('../../lib/order/master-lock');

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET', 'POST'])) return;
    const body = req.method === 'GET' ? {} : await readBody(req);
    const raw = (req.query && req.query.t) || body.t || body.token;
    const tokenRow = await resolveAccessToken(raw);
    if (!tokenRow) return json(res, 401, { error: 'invalid_or_expired_token' });

    const admin = getAdmin();
    const { data: order } = await admin.from('order_orders').select('*').eq('id', tokenRow.order_id).single();
    if (!order) return json(res, 404, { error: 'order_not_found' });
    const { data: items } = await admin
      .from('order_items')
      .select('*')
      .eq('order_id', order.id)
      .order('sort_order');
    const { data: system } = await admin.from('order_systems').select('*').eq('id', order.order_system_id).single();
    const { data: site } = await admin
      .from('sites')
      .select('id,slug,business_name')
      .eq('id', order.site_id)
      .single();

    const liveEdit = editingStateFor(order.effective_cutoff_at);
    const editingState =
      order.editing_state === 'locked' || liveEdit === 'locked' ? 'locked' : liveEdit;

    const masterLocked = isMasterLockActive(
      parsePickupSchedule(system),
      new Date(),
      system.timezone || 'Australia/Sydney'
    );

    if (req.method === 'GET') {
      const gstSummary = orderGstSummary(items || []);
      const viewEvent = tokenRow.purpose === 'deposit' ? 'invoice_viewed' : 'portal_viewed';
      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: recentView } = await admin
        .from('order_audit_events')
        .select('id')
        .eq('order_id', order.id)
        .eq('event_type', viewEvent)
        .gte('created_at', since)
        .limit(1)
        .maybeSingle();
      if (!recentView) {
        await writeAudit({
          order_system_id: order.order_system_id,
          site_id: order.site_id,
          order_id: order.id,
          event_type: viewEvent,
          source: 'customer_portal',
          actor_label: order.customer_name,
          payload: { purpose: tokenRow.purpose }
        });
      }
      return json(res, 200, {
        order: {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          customer_name: order.customer_name,
          fulfilment_type: order.fulfilment_type,
          pickup_date: order.pickup_date,
          pickup_time: order.pickup_time,
          pickup_window_start: order.pickup_window_start,
          pickup_window_end: order.pickup_window_end,
          customer_notes: order.customer_notes,
          known_subtotal_cents: order.known_subtotal_cents,
          deposit_required_cents: order.deposit_required_cents,
          deposit_paid_cents: order.deposit_paid_cents,
          balance_cents: order.balance_cents,
          has_unknown_prices: order.has_unknown_prices,
          price_status: order.price_status,
          effective_cutoff_at: order.effective_cutoff_at,
          cutoff_reason: order.cutoff_reason,
          editing_state: editingState,
          balance_settlement: (order.payment_rule_snapshot && order.payment_rule_snapshot.balance_settlement) ||
            (system && system.balance_settlement) ||
            'at_pickup'
        },
        items: (items || []).map(function (it) {
          return {
            id: it.id,
            product_name: it.product_name,
            quantity: it.quantity,
            requested_weight_kg: it.requested_weight_kg,
            actual_weight_kg: it.actual_weight_kg,
            unit_label: it.unit_label,
            price_status: it.price_status,
            line_known_cents: it.line_known_cents,
            line_final_cents: it.line_final_cents,
            notes: it.notes,
            includes_gst: !!(it.product_snapshot && it.product_snapshot.includes_gst)
          };
        }),
        business: site,
        display: {
          known_subtotal: formatAud(order.known_subtotal_cents),
          deposit_required: formatAud(order.deposit_required_cents),
          deposit_paid: formatAud(order.deposit_paid_cents),
          gst_included:
            gstSummary.gst_included_cents > 0 ? formatAud(gstSummary.gst_included_cents) : null,
          balance:
            order.balance_cents != null
              ? formatAud(order.balance_cents)
              : order.has_unknown_prices
                ? 'Final balance TBC'
                : formatAud(0),
          locked_message:
            masterLocked
              ? 'ORDERING CLOSED — The season lock date has passed. Please contact us if you need assistance.'
              : editingState === 'locked'
              ? 'ORDER LOCKED — Your order is now being prepared and can no longer be changed online. Please contact us if you require assistance.'
              : null
        },
        can_edit:
          !masterLocked &&
          editingState !== 'locked' &&
          !!(system && system.customer_editing_enabled),
        master_lock_active: masterLocked,
        purpose: tokenRow.purpose
      });
    }

    // POST — customer edit (only when open)
    if (masterLocked || editingState === 'locked' || !(system && system.customer_editing_enabled)) {
      return json(res, 403, { error: masterLocked ? 'master_lock_active' : 'order_locked' });
    }
    if (system.change_mode === 'approval_required') {
      await admin.from('order_change_requests').insert({
        order_id: order.id,
        site_id: order.site_id,
        status: 'pending',
        proposed_changes: body.changes || [],
        customer_note: body.note || null
      });
      return json(res, 200, { ok: true, mode: 'approval_required' });
    }

    // V1 automatic: allow quantity / notes / requested weight on existing items
    const changes = Array.isArray(body.changes) ? body.changes : [];
    for (const ch of changes) {
      if (!ch.order_item_id) continue;
      const { data: item } = await admin.from('order_items').select('*').eq('id', ch.order_item_id).eq('order_id', order.id).maybeSingle();
      if (!item) continue;
      const patch = { updated_at: new Date().toISOString() };
      const prev = {};
      if (ch.quantity != null) {
        prev.quantity = item.quantity;
        patch.quantity = ch.quantity;
      }
      if (ch.requested_weight_kg != null) {
        prev.requested_weight_kg = item.requested_weight_kg;
        patch.requested_weight_kg = ch.requested_weight_kg;
      }
      if (ch.notes != null) {
        prev.notes = item.notes;
        patch.notes = ch.notes;
      }
      // Re-price known lines from snapshot
      const priced = priceLineAtOrder(
        {
          pricing_method: item.pricing_method,
          price_cents: item.unit_price_cents,
          price_per_kg_cents: item.unit_price_cents
        },
        patch.quantity != null ? patch.quantity : item.quantity,
        patch.requested_weight_kg != null ? patch.requested_weight_kg : item.requested_weight_kg
      );
      if (item.price_status !== 'finalised') {
        patch.price_status = priced.priceStatus;
        patch.line_known_cents = priced.lineKnownCents;
      }
      await admin.from('order_items').update(patch).eq('id', item.id);
      await writeChange({
        order_id: order.id,
        site_id: order.site_id,
        order_item_id: item.id,
        field_path: 'item',
        previous_value: prev,
        new_value: ch,
        source: 'customer_portal',
        actor_label: order.customer_name
      });
    }

    if (body.customer_notes != null) {
      await writeChange({
        order_id: order.id,
        site_id: order.site_id,
        field_path: 'customer_notes',
        previous_value: order.customer_notes,
        new_value: body.customer_notes,
        source: 'customer_portal',
        actor_label: order.customer_name
      });
      await admin
        .from('order_orders')
        .update({ customer_notes: body.customer_notes, updated_at: new Date().toISOString() })
        .eq('id', order.id);
    }

    if (body.pickup_date != null || body.pickup_time != null) {
      const patchPick = { updated_at: new Date().toISOString() };
      if (body.pickup_date != null) patchPick.pickup_date = body.pickup_date;
      if (body.pickup_time != null) patchPick.pickup_time = body.pickup_time;
      await writeChange({
        order_id: order.id,
        site_id: order.site_id,
        field_path: 'pickup',
        previous_value: { pickup_date: order.pickup_date, pickup_time: order.pickup_time },
        new_value: patchPick,
        source: 'customer_portal',
        actor_label: order.customer_name
      });
      await admin.from('order_orders').update(patchPick).eq('id', order.id);
    }

    const recalc = await recalculateOrder(order.id);
    await writeAudit({
      order_system_id: order.order_system_id,
      site_id: order.site_id,
      order_id: order.id,
      event_type: 'customer_edit',
      source: 'customer_portal',
      actor_label: order.customer_name,
      payload: { changes: changes.length }
    });
    return json(res, 200, { ok: true, order: recalc.order });
  } catch (e) {
    console.error('order/portal', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
