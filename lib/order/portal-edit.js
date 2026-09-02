'use strict';

const { getAdmin } = require('./supabase');
const { writeChange } = require('./audit');
const { priceLineAtOrder } = require('./pricing');
const { optionExtrasPerUnitCents } = require('./product-options');
const { parseGstSettings, productHasGst } = require('./gst');
const { buildOrderItemRow, assertOrderItemsEditable } = require('./order-item-build');
const { recalculateOrderPreservingDeposit } = require('./service');

function answersMapFromItem(item, answerRows) {
  var map = {};
  (answerRows || []).forEach(function (a) {
    if (!a || a.order_item_id !== item.id) return;
    map[a.question_key] = {
      value: a.value,
      label: a.question_label,
      field_type: a.field_type || 'short_text'
    };
  });
  return map;
}

function normalisePortalAnswers(raw) {
  if (!raw || typeof raw !== 'object') return {};
  var out = {};
  Object.keys(raw).forEach(function (k) {
    var a = raw[k];
    if (a == null) return;
    if (typeof a === 'string' || typeof a === 'number' || typeof a === 'boolean') {
      out[k] = { value: a, label: k, field_type: 'short_text' };
      return;
    }
    if (typeof a === 'object') {
      out[k] = {
        value: a.value != null ? a.value : a,
        label: a.label || k,
        choice_label: a.choice_label || null,
        field_type: a.field_type || 'short_text'
      };
    }
  });
  return out;
}

async function loadProductBundle(admin, productId, systemId) {
  const { data: product, error } = await admin
    .from('order_products')
    .select('*')
    .eq('id', productId)
    .eq('order_system_id', systemId)
    .maybeSingle();
  if (error) throw error;
  if (!product || product.active === false) return null;
  const { data: questions } = await admin
    .from('order_product_questions')
    .select('*')
    .eq('product_id', product.id)
    .eq('staff_only', false)
    .order('sort_order');
  return { product: product, questions: questions || [] };
}

async function syncItemAnswers(admin, itemId, answers) {
  await admin.from('order_item_answers').delete().eq('order_item_id', itemId);
  var rows = Object.keys(answers || {}).map(function (k) {
    var a = answers[k] || {};
    var val = a.value != null ? a.value : a;
    return {
      order_item_id: itemId,
      question_key: k,
      question_label: a.label || k,
      field_type: a.field_type || 'short_text',
      value: val
    };
  });
  if (rows.length) await admin.from('order_item_answers').insert(rows);
}

async function repriceItemWithOptions(admin, item, product, questions, answers, qty, reqWeight) {
  var extras = optionExtrasPerUnitCents(questions, answers);
  var priced = priceLineAtOrder(
    {
      pricing_method: item.pricing_method || product.pricing_method,
      price_cents: item.unit_price_cents != null ? item.unit_price_cents : product.price_cents,
      price_per_kg_cents:
        item.unit_price_cents != null && (item.pricing_method === 'per_weight' || product.pricing_method === 'per_weight')
          ? item.unit_price_cents
          : product.price_per_kg_cents
    },
    qty,
    reqWeight,
    extras.extra_cents
  );
  var snap = Object.assign({}, item.product_snapshot || {}, {
    selected_options: extras.selected
  });
  var patch = {
    quantity: qty,
    requested_weight_kg: reqWeight != null ? reqWeight : null,
    options_snapshot: { selected: extras.selected },
    product_snapshot: snap,
    unit_price_cents: priced.unitPriceCents,
    updated_at: new Date().toISOString()
  };
  if (item.price_status !== 'finalised') {
    patch.price_status = priced.priceStatus;
    patch.line_known_cents = priced.lineKnownCents;
  }
  await admin.from('order_items').update(patch).eq('id', item.id);
  return patch;
}

async function updatePortalItem(admin, order, site, system, item, change, actorLabel) {
  var prev = {
    quantity: item.quantity,
    requested_weight_kg: item.requested_weight_kg,
    notes: item.notes
  };
  var qty =
    change.quantity != null
      ? Number(change.quantity)
      : Number(item.quantity) || 1;
  if (!Number.isFinite(qty) || qty < 0) qty = item.quantity;

  if (qty === 0) {
    await admin.from('order_items').delete().eq('id', item.id);
    await admin.from('order_item_answers').delete().eq('order_item_id', item.id);
    await writeChange({
      order_id: order.id,
      site_id: site.id,
      order_item_id: item.id,
      field_path: 'item.removed',
      previous_value: {
        product_name: item.product_name,
        quantity: item.quantity,
        requested_weight_kg: item.requested_weight_kg
      },
      new_value: null,
      source: 'customer_portal',
      actor_label: actorLabel
    });
    return { removed: true };
  }

  var reqWeight =
    change.requested_weight_kg != null
      ? change.requested_weight_kg === '' || change.requested_weight_kg === null
        ? null
        : Number(change.requested_weight_kg)
      : item.requested_weight_kg;

  var patch = { updated_at: new Date().toISOString() };
  if (change.quantity != null) patch.quantity = qty;
  if (change.requested_weight_kg != null) patch.requested_weight_kg = reqWeight;
  if (change.notes != null) patch.notes = change.notes;

  if (change.answers != null && item.product_id) {
    var bundle = await loadProductBundle(admin, item.product_id, system.id);
    if (bundle) {
      var answers = normalisePortalAnswers(change.answers);
      await syncItemAnswers(admin, item.id, answers);
      var repriced = await repriceItemWithOptions(
        admin,
        item,
        bundle.product,
        bundle.questions,
        answers,
        patch.quantity != null ? patch.quantity : item.quantity,
        patch.requested_weight_kg != null ? patch.requested_weight_kg : item.requested_weight_kg
      );
      patch = Object.assign(patch, repriced);
      await writeChange({
        order_id: order.id,
        site_id: site.id,
        order_item_id: item.id,
        field_path: 'item.options',
        previous_value: prev,
        new_value: { answers: answers, quantity: patch.quantity, requested_weight_kg: patch.requested_weight_kg },
        source: 'customer_portal',
        actor_label: actorLabel
      });
      if (change.notes != null) {
        await admin.from('order_items').update({ notes: change.notes, updated_at: new Date().toISOString() }).eq('id', item.id);
      }
      return { removed: false };
    }
  }

  var priced = priceLineAtOrder(
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
    site_id: site.id,
    order_item_id: item.id,
    field_path: 'item',
    previous_value: prev,
    new_value: change,
    source: 'customer_portal',
    actor_label: actorLabel
  });
  return { removed: false };
}

async function addPortalItem(admin, order, site, system, line, actorLabel) {
  assertOrderItemsEditable(order);
  if (!line.product_id) return null;
  var bundle = await loadProductBundle(admin, line.product_id, system.id);
  if (!bundle) return null;

  var { data: existingItems } = await admin
    .from('order_items')
    .select('sort_order')
    .eq('order_id', order.id)
    .order('sort_order', { ascending: false })
    .limit(1);
  var nextSort =
    existingItems && existingItems.length && existingItems[0].sort_order != null
      ? Number(existingItems[0].sort_order) + 1
      : 0;

  var gstSettings = parseGstSettings(system);
  var questionsByProduct = {};
  questionsByProduct[bundle.product.id] = bundle.questions;
  var answers = normalisePortalAnswers(line.answers || {});
  var row = buildOrderItemRow(
    {
      product_id: bundle.product.id,
      quantity: line.quantity,
      requested_weight_kg: line.requested_weight_kg,
      notes: line.notes || null,
      answers: answers
    },
    bundle.product,
    site,
    gstSettings,
    questionsByProduct,
    nextSort
  );

  var { data: inserted, error } = await admin
    .from('order_items')
    .insert(Object.assign({}, row, { order_id: order.id }))
    .select('*')
    .single();
  if (error) throw error;
  await syncItemAnswers(admin, inserted.id, answers);
  await writeChange({
    order_id: order.id,
    site_id: site.id,
    order_item_id: inserted.id,
    field_path: 'item.added',
    previous_value: null,
    new_value: {
      product_id: bundle.product.id,
      product_name: inserted.product_name,
      quantity: inserted.quantity,
      requested_weight_kg: inserted.requested_weight_kg
    },
    source: 'customer_portal',
    actor_label: actorLabel
  });
  return inserted;
}

async function removePortalItem(admin, order, site, item, actorLabel) {
  await admin.from('order_items').delete().eq('id', item.id);
  await admin.from('order_item_answers').delete().eq('order_item_id', item.id);
  await writeChange({
    order_id: order.id,
    site_id: site.id,
    order_item_id: item.id,
    field_path: 'item.removed',
    previous_value: {
      product_name: item.product_name,
      quantity: item.quantity,
      requested_weight_kg: item.requested_weight_kg
    },
    new_value: null,
    source: 'customer_portal',
    actor_label: actorLabel
  });
}

/**
 * Apply customer portal POST body (automatic mode).
 */
async function applyPortalEdits(opts) {
  var admin = getAdmin();
  var order = opts.order;
  var site = opts.site;
  var system = opts.system;
  var body = opts.body || {};
  var actorLabel = opts.actorLabel || order.customer_name;

  assertOrderItemsEditable(order);

  var changes = Array.isArray(body.changes) ? body.changes : [];
  for (var i = 0; i < changes.length; i++) {
    var ch = changes[i];
    if (!ch.order_item_id) continue;
    var { data: item } = await admin
      .from('order_items')
      .select('*')
      .eq('id', ch.order_item_id)
      .eq('order_id', order.id)
      .maybeSingle();
    if (!item) continue;
    await updatePortalItem(admin, order, site, system, item, ch, actorLabel);
  }

  var removeIds = Array.isArray(body.remove_item_ids) ? body.remove_item_ids : [];
  for (var r = 0; r < removeIds.length; r++) {
    var rid = removeIds[r];
    var { data: remItem } = await admin
      .from('order_items')
      .select('*')
      .eq('id', rid)
      .eq('order_id', order.id)
      .maybeSingle();
    if (remItem) await removePortalItem(admin, order, site, remItem, actorLabel);
  }

  var addItems = Array.isArray(body.add_items) ? body.add_items : [];
  for (var a = 0; a < addItems.length; a++) {
    await addPortalItem(admin, order, site, system, addItems[a], actorLabel);
  }

  if (body.customer_notes != null) {
    await writeChange({
      order_id: order.id,
      site_id: site.id,
      field_path: 'customer_notes',
      previous_value: order.customer_notes,
      new_value: body.customer_notes,
      source: 'customer_portal',
      actor_label: actorLabel
    });
    await admin
      .from('order_orders')
      .update({ customer_notes: body.customer_notes, updated_at: new Date().toISOString() })
      .eq('id', order.id);
  }

  if (body.pickup_date != null || body.pickup_time != null) {
    var patchPick = { updated_at: new Date().toISOString() };
    if (body.pickup_date != null) patchPick.pickup_date = body.pickup_date;
    if (body.pickup_time != null) patchPick.pickup_time = body.pickup_time;
    await writeChange({
      order_id: order.id,
      site_id: site.id,
      field_path: 'pickup',
      previous_value: { pickup_date: order.pickup_date, pickup_time: order.pickup_time },
      new_value: patchPick,
      source: 'customer_portal',
      actor_label: actorLabel
    });
    await admin.from('order_orders').update(patchPick).eq('id', order.id);
  }

  return recalculateOrderPreservingDeposit(order.id);
}

function formatOptionsForPortal(item, answerRows) {
  var snap = item.product_snapshot || {};
  var sel = snap.selected_options || (item.options_snapshot && item.options_snapshot.selected) || [];
  var labels = [];
  if (Array.isArray(sel)) {
    sel.forEach(function (o) {
      if (!o) return;
      if (typeof o === 'string') labels.push(o);
      else {
        var bit = o.question ? String(o.question) + ': ' + (o.label || o.value || '') : o.label || o.value || '';
        if (bit) labels.push(bit);
      }
    });
  }
  (answerRows || [])
    .filter(function (a) {
      return a.order_item_id === item.id;
    })
    .forEach(function (a) {
      var v = a.value;
      if (v && typeof v === 'object' && v.label) labels.push(a.question_label + ': ' + v.label);
      else if (v != null && v !== '') labels.push(a.question_label + ': ' + String(v));
    });
  return labels;
}

function summariseChangeRow(chg) {
  var when = chg.created_at ? String(chg.created_at).slice(0, 16).replace('T', ' ') : '';
  var who = chg.actor_label || chg.source || 'System';
  var path = chg.field_path || 'change';
  var detail = '';
  if (path === 'item.removed' && chg.previous_value && chg.previous_value.product_name) {
    detail = 'Removed ' + chg.previous_value.product_name;
  } else if (path === 'item.added' && chg.new_value && chg.new_value.product_name) {
    detail = 'Added ' + chg.new_value.product_name;
  } else if (path === 'item.options') {
    detail = 'Updated options';
  } else if (path === 'item' && chg.new_value) {
    detail = 'Updated line';
    if (chg.new_value.quantity != null) detail += ' (qty ' + chg.new_value.quantity + ')';
  } else if (path === 'pickup') {
    detail = 'Changed pickup';
  } else if (path === 'customer_notes') {
    detail = 'Updated notes';
  } else {
    detail = path.replace(/_/g, ' ');
  }
  return { when: when, who: who, detail: detail, source: chg.source };
}

module.exports = {
  answersMapFromItem,
  normalisePortalAnswers,
  applyPortalEdits,
  formatOptionsForPortal,
  summariseChangeRow,
  loadProductBundle
};
