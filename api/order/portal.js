'use strict';

const { readBody, json, methodOk } = require('../../lib/order/http');
const { getAdmin } = require('../../lib/order/supabase');
const { resolveAccessToken } = require('../../lib/order/tokens');
const { formatAud } = require('../../lib/order/money');
const { orderGstSummary } = require('../../lib/order/gst');
const { editingStateFor } = require('../../lib/order/cutoff');
const { writeChange, writeAudit } = require('../../lib/order/audit');
const { parsePickupSchedule } = require('../../lib/order/pickup-schedule');
const { isMasterLockActive } = require('../../lib/order/master-lock');
const {
  applyPortalEdits,
  formatOptionsForPortal,
  summariseChangeRow,
  answersMapFromItem
} = require('../../lib/order/portal-edit');

async function portalContext(raw) {
  const tokenRow = await resolveAccessToken(raw);
  if (!tokenRow) return null;
  const admin = getAdmin();
  const { data: order } = await admin.from('order_orders').select('*').eq('id', tokenRow.order_id).single();
  if (!order) return null;
  const { data: items } = await admin
    .from('order_items')
    .select('*')
    .eq('order_id', order.id)
    .order('sort_order');
  const itemIds = (items || []).map(function (it) {
    return it.id;
  });
  var answerRows = [];
  if (itemIds.length) {
    const { data: ans } = await admin.from('order_item_answers').select('*').in('order_item_id', itemIds);
    answerRows = ans || [];
  }
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
  const canEdit =
    !masterLocked && editingState !== 'locked' && !!(system && system.customer_editing_enabled);
  return {
    tokenRow: tokenRow,
    admin: admin,
    order: order,
    items: items || [],
    answerRows: answerRows,
    system: system,
    site: site,
    editingState: editingState,
    masterLocked: masterLocked,
    canEdit: canEdit
  };
}

async function loadPortalCatalog(admin, system) {
  const { buildPortalCatalog } = require('../../lib/order/portal-catalog');
  const { data: categories } = await admin
    .from('order_categories')
    .select('id,name,slug,sort_order')
    .eq('order_system_id', system.id)
    .eq('active', true)
    .order('sort_order');
  const { data: products } = await admin
    .from('order_products')
    .select(
      'id,category_id,name,slug,pricing_method,price_cents,price_per_kg_cents,unit_label,weight_required,options,active'
    )
    .eq('order_system_id', system.id)
    .eq('active', true)
    .order('sort_order');
  const ids = (products || []).map(function (p) {
    return p.id;
  });
  var questions = [];
  if (ids.length) {
    const { data: qs } = await admin
      .from('order_product_questions')
      .select('*')
      .in('product_id', ids)
      .eq('staff_only', false)
      .order('sort_order');
    questions = qs || [];
  }
  const byProduct = {};
  questions.forEach(function (q) {
    if (!byProduct[q.product_id]) byProduct[q.product_id] = [];
    byProduct[q.product_id].push(q);
  });
  return buildPortalCatalog(categories || [], products || [], byProduct);
}

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET', 'POST'])) return;
    const body = req.method === 'GET' ? {} : await readBody(req);
    const raw = (req.query && req.query.t) || body.t || body.token;
    const ctx = await portalContext(raw);
    if (!ctx) return json(res, 401, { error: 'invalid_or_expired_token' });

    const { admin, order, items, answerRows, system, site, editingState, masterLocked, canEdit, tokenRow } =
      ctx;

    if (req.method === 'GET') {
      const gstSummary = orderGstSummary(items);
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

      const { data: changes } = await admin
        .from('order_changes')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false })
        .limit(30);

      const { data: pendingReq } = await admin
        .from('order_change_requests')
        .select('id,status,created_at,customer_note')
        .eq('order_id', order.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      var catalog = null;
      if (canEdit) {
        catalog = await loadPortalCatalog(admin, system);
      }

      const depositSatisfied =
        (Number(order.deposit_required_cents) || 0) > 0 &&
        (Number(order.deposit_paid_cents) || 0) >= (Number(order.deposit_required_cents) || 0);

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
          deposit_satisfied: depositSatisfied,
          balance_settlement: (order.payment_rule_snapshot && order.payment_rule_snapshot.balance_settlement) ||
            (system && system.balance_settlement) ||
            'at_pickup'
        },
        items: items.map(function (it) {
          return {
            id: it.id,
            product_id: it.product_id,
            product_name: it.product_name,
            quantity: it.quantity,
            requested_weight_kg: it.requested_weight_kg,
            actual_weight_kg: it.actual_weight_kg,
            unit_label: it.unit_label,
            price_status: it.price_status,
            line_known_cents: it.line_known_cents,
            line_final_cents: it.line_final_cents,
            notes: it.notes,
            includes_gst: !!(it.product_snapshot && it.product_snapshot.includes_gst),
            selected_options: formatOptionsForPortal(it, answerRows),
            answers: answersMapFromItem(it, answerRows),
            pricing_method: it.pricing_method
          };
        }),
        change_history: (changes || []).map(summariseChangeRow),
        pending_change_request: pendingReq || null,
        catalog: catalog,
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
        can_edit: canEdit,
        master_lock_active: masterLocked,
        purpose: tokenRow.purpose
      });
    }

    if (!canEdit) {
      return json(res, 403, { error: masterLocked ? 'master_lock_active' : 'order_locked' });
    }

    if (system.change_mode === 'approval_required') {
      await admin.from('order_change_requests').insert({
        order_id: order.id,
        site_id: order.site_id,
        status: 'pending',
        proposed_changes: {
          items: body.changes || [],
          add_items: body.add_items || [],
          remove_item_ids: body.remove_item_ids || [],
          customer_notes: body.customer_notes != null ? body.customer_notes : undefined,
          pickup_date: body.pickup_date != null ? body.pickup_date : undefined,
          pickup_time: body.pickup_time != null ? body.pickup_time : undefined
        },
        customer_note: body.note || body.customer_notes || null
      });
      await writeAudit({
        order_system_id: order.order_system_id,
        site_id: order.site_id,
        order_id: order.id,
        event_type: 'change_request_submitted',
        source: 'customer_portal',
        actor_label: order.customer_name,
        payload: {}
      });
      return json(res, 200, { ok: true, mode: 'approval_required' });
    }

    const recalc = await applyPortalEdits({
      order: order,
      site: site,
      system: system,
      body: body,
      actorLabel: order.customer_name
    });

    await writeAudit({
      order_system_id: order.order_system_id,
      site_id: order.site_id,
      order_id: order.id,
      event_type: 'customer_edit',
      source: 'customer_portal',
      actor_label: order.customer_name,
      payload: {
        changes: (body.changes || []).length,
        add_items: (body.add_items || []).length,
        remove_item_ids: (body.remove_item_ids || []).length
      }
    });

    return json(res, 200, { ok: true, order: recalc.order });
  } catch (e) {
    console.error('order/portal', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
