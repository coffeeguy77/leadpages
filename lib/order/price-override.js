'use strict';

/**
 * Special prices — a price override on one order line, for that order only.
 *
 * order_items.price_override:
 *   { mode: 'rate'    rate_cents   new $/kg (weighed items) or $ each
 *     mode: 'fixed'   line_cents   price for the whole line, whatever it weighs
 *     mode: 'percent' percent      % off the line (options included)
 *     normal_unit_cents, reason, set_by, set_by_label, set_at }
 *
 * The override is kept on the line and re-applied every time the order is recalculated
 * (recalculateOrder), so weighing, customer edits, stock pieces and option changes can't lose it.
 * Product prices and other orders never change.
 *
 * Every set / change / remove is written to order_price_overrides (history, never edited).
 */

const { mulWeightRate, formatAud } = require('./money');

const MODES = ['rate', 'fixed', 'percent'];

function int(n) {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? v : null;
}

function isWeighed(item) {
  return item.pricing_method === 'per_weight' || item.pricing_method === 'price_tbc';
}

/** Clean staff input → override (without who/when), or throws { code: 400 }. */
function sanitizeOverride(input) {
  if (!input || typeof input !== 'object') throw Object.assign(new Error('override_required'), { code: 400 });
  const mode = String(input.mode || '').toLowerCase();
  if (MODES.indexOf(mode) < 0) throw Object.assign(new Error('invalid_override_mode'), { code: 400 });
  const out = { mode: mode };
  if (mode === 'rate') {
    const c = int(input.rate_cents);
    if (c == null || c < 0) throw Object.assign(new Error('invalid_special_price'), { code: 400, message_text: 'Enter the special price.' });
    out.rate_cents = c;
  } else if (mode === 'fixed') {
    const c = int(input.line_cents);
    if (c == null || c < 0) throw Object.assign(new Error('invalid_special_price'), { code: 400, message_text: 'Enter the price for the line.' });
    out.line_cents = c;
  } else {
    const p = Math.round(Number(input.percent) * 100) / 100;
    if (!Number.isFinite(p) || p <= 0 || p > 100) throw Object.assign(new Error('invalid_percent'), { code: 400, message_text: 'Enter a % between 0 and 100.' });
    out.percent = p;
  }
  const reason = input.reason != null ? String(input.reason).trim().slice(0, 200) : '';
  if (reason) out.reason = reason;
  return out;
}

/**
 * The line's amounts at a given unit rate, the same way the order engine prices them:
 * weighed lines use actual weight (final) or requested weight (estimate); each lines rate × qty.
 * @returns {{ line_known_cents, line_final_cents, price_status }} only the fields that apply
 */
function amountsAtRate(item, rate) {
  const { lineOptionExtras } = require('./product-options');
  const q = Math.max(1, Number(item.quantity) || 1);
  const out = {};
  if (rate == null) return out;
  if (isWeighed(item)) {
    const ex = lineOptionExtras(item);
    const flat = Math.round((Number(ex.flat) || 0) * q);
    if (item.actual_weight_kg != null) {
      const w = Number(item.actual_weight_kg);
      out.line_final_cents = mulWeightRate(w, rate) + mulWeightRate(w, ex.per_kg) + flat;
      out.price_status = 'finalised';
    } else if (item.requested_weight_kg != null && Number(item.requested_weight_kg) > 0 && item.pricing_method === 'per_weight') {
      const w = Number(item.requested_weight_kg);
      out.line_known_cents = mulWeightRate(w, rate) + mulWeightRate(w, ex.per_kg) + flat;
      out.price_status = 'estimated';
    } else {
      out.line_known_cents = flat > 0 ? flat : null;
      out.price_status = item.pricing_method === 'price_tbc' ? 'tbc' : 'tbc';
    }
    return out;
  }
  if (item.pricing_method === 'quote_required') return out;
  const line = Math.round(rate * q);
  if (item.line_final_cents != null) {
    out.line_final_cents = line;
  } else {
    out.line_known_cents = line;
  }
  return out;
}

/** Normal $/kg or $ each for the line (before any special price). */
function normalUnitCents(item) {
  const ov = item && item.price_override;
  if (ov && ov.normal_unit_cents != null) return Number(ov.normal_unit_cents);
  return item && item.unit_price_cents != null ? Number(item.unit_price_cents) : null;
}

/** The line's amount without the special price (for history / "was" price). */
function normalLineCents(item) {
  const a = amountsAtRate(item, normalUnitCents(item));
  if (a.line_final_cents != null) return a.line_final_cents;
  if (a.line_known_cents != null) return a.line_known_cents;
  // Not weighed and no weight asked for: no normal line amount yet.
  return null;
}

/**
 * Fields the line should have with its special price applied (pure).
 * Returns {} when there is no override.
 */
function overrideFields(item) {
  const ov = item && item.price_override;
  if (!ov || MODES.indexOf(ov.mode) < 0) return {};
  const normal = normalUnitCents(item);
  if (ov.mode === 'rate') {
    const rate = Number(ov.rate_cents);
    return Object.assign({ unit_price_cents: rate }, amountsAtRate(item, rate));
  }
  if (ov.mode === 'fixed') {
    const fields = { unit_price_cents: normal };
    const c = Number(ov.line_cents);
    if (item.actual_weight_kg != null || item.line_final_cents != null) {
      fields.line_final_cents = c;
      fields.price_status = 'finalised';
    } else {
      // A set price for the line: known now, even before weighing.
      fields.line_known_cents = c;
      fields.price_status = 'known';
    }
    return fields;
  }
  // percent off the line's normal amount (options included)
  const base = amountsAtRate(item, normal);
  const k = 1 - Number(ov.percent) / 100;
  const fields = { unit_price_cents: normal };
  if (base.price_status) fields.price_status = base.price_status;
  if (base.line_final_cents != null) fields.line_final_cents = Math.round(base.line_final_cents * k);
  if (base.line_known_cents !== undefined) fields.line_known_cents = base.line_known_cents == null ? null : Math.round(base.line_known_cents * k);
  return fields;
}

/** Price range until weighed, with the special price: fixed → none, percent → scaled, rate → at the special rate. */
function estimateRange(item) {
  const { lineEstimateRange } = require('./pricing');
  const ov = item && item.price_override;
  if (ov && ov.mode === 'fixed') return null;
  const r = lineEstimateRange(item);
  if (!r || !ov || ov.mode !== 'percent') return r;
  const k = 1 - Number(ov.percent) / 100;
  return Object.assign({}, r, { low_cents: Math.round(r.low_cents * k), high_cents: Math.round(r.high_cents * k) });
}

/** Patch to bring a stored line in line with its override, or null when it already matches. */
function enforcePatch(item) {
  const f = overrideFields(item);
  const patch = {};
  Object.keys(f).forEach(function (k) {
    const cur = item[k] == null ? null : (typeof f[k] === 'number' ? Number(item[k]) : item[k]);
    if (cur !== (f[k] == null ? null : f[k])) patch[k] = f[k];
  });
  return Object.keys(patch).length ? patch : null;
}

/** Line with its override applied (pure) — used for new staff orders before insert. */
function applyToRow(row) {
  if (!row || !row.price_override) return row;
  return Object.assign({}, row, overrideFields(row));
}

/** The line's current amount (final, else known), or null. */
function lineCents(item) {
  if (item.line_final_cents != null) return Number(item.line_final_cents);
  if (item.line_known_cents != null) return Number(item.line_known_cents);
  return null;
}

/** Text for screens: { label, normal_label, short } e.g. "$27.00/kg", "$30.80/kg", "Special $27.00/kg". */
function describe(item) {
  const ov = item && item.price_override;
  if (!ov) return null;
  const per = isWeighed(item) ? '/kg' : ' each';
  const normal = normalUnitCents(item);
  let label;
  if (ov.mode === 'rate') label = formatAud(ov.rate_cents) + per;
  else if (ov.mode === 'fixed') label = formatAud(ov.line_cents) + ' for the line';
  else label = String(ov.percent).replace(/\.0+$/, '') + '% off';
  return {
    mode: ov.mode,
    label: label,
    normal_label: normal != null ? formatAud(normal) + per : null,
    normal_line_cents: normalLineCents(item),
    reason: ov.reason || null,
    set_by_label: ov.set_by_label || null,
    set_at: ov.set_at || null
  };
}

/**
 * What the customer sees for a special-priced line, or null.
 * showWas: shop setting (default true) and not hidden on this order.
 */
function customerView(item, showWas) {
  const d = describe(item);
  if (!d) return null;
  const was = showWas && d.normal_line_cents != null && lineCents(item) != null && d.normal_line_cents > lineCents(item)
    ? formatAud(d.normal_line_cents) : null;
  return {
    label: 'Special price',
    fixed: d.mode === 'fixed',
    price_label: d.label,
    was_rate_label: showWas && d.mode === 'rate' ? d.normal_label : null,
    was_line_label: was
  };
}

/** Shop setting: show customers the normal ("was") price next to a special price. Default yes. */
function showWasPrice(system, order) {
  if (order && order.hide_normal_price) return false;
  const s = (system && system.settings && system.settings.price_display) || {};
  return s.special_show_was !== false;
}

/** Apply overrides to all lines of an order (DB). Returns the items with patches applied. */
async function enforceForItems(admin, items) {
  const out = [];
  for (const it of items || []) {
    const patch = it.price_override ? enforcePatch(it) : null;
    if (patch) {
      patch.updated_at = new Date().toISOString();
      const { error } = await admin.from('order_items').update(patch).eq('id', it.id);
      if (error) throw error;
      out.push(Object.assign({}, it, patch));
    } else {
      out.push(it);
    }
  }
  return out;
}

function historyRow(order, item, action, ov, actor, after) {
  const normalUnit = normalUnitCents(item);
  return {
    order_system_id: order.order_system_id,
    site_id: order.site_id,
    order_id: order.id,
    order_item_id: item.id,
    order_number: order.order_number || null,
    pickup_date: order.pickup_date || null,
    customer_id: order.customer_id || null,
    customer_name: order.customer_name || null,
    customer_phone: order.customer_phone || null,
    customer_email: order.customer_email || null,
    product_id: item.product_id || null,
    product_name: item.product_name || null,
    pricing_method: item.pricing_method || null,
    quantity: item.quantity != null ? Number(item.quantity) : null,
    weight_kg: item.actual_weight_kg != null ? Number(item.actual_weight_kg) : item.requested_weight_kg != null ? Number(item.requested_weight_kg) : null,
    action: action,
    mode: ov ? ov.mode : null,
    normal_unit_cents: normalUnit,
    special_unit_cents: ov && ov.mode === 'rate' ? Number(ov.rate_cents) : null,
    percent: ov && ov.mode === 'percent' ? Number(ov.percent) : null,
    normal_line_cents: normalLineCents(item),
    special_line_cents: ov && after ? lineCents(after) : null,
    reason: (ov && ov.reason) || null,
    actor_user_id: (actor && actor.user_id) || null,
    actor_label: (actor && actor.label) || null
  };
}

async function refreshOrderFlag(admin, orderId) {
  const { data: rows } = await admin.from('order_items').select('id,price_override').eq('order_id', orderId);
  const has = (rows || []).some(function (r) { return !!r.price_override; });
  await admin.from('order_orders').update({ has_price_override: has }).eq('id', orderId);
  return has;
}

/**
 * Set (override object) or remove (null) a line's special price.
 * @param {{ order_id, item_id, site_id, override, actor }} opts
 */
async function setLineOverride(opts) {
  const { getAdmin } = require('./supabase');
  const { recalculateOrderPreservingDeposit } = require('./service');
  const { writeChange, writeAudit } = require('./audit');
  const admin = getAdmin();
  const { data: order, error: oErr } = await admin.from('order_orders').select('*').eq('id', opts.order_id).eq('site_id', opts.site_id).maybeSingle();
  if (oErr) throw oErr;
  if (!order) throw Object.assign(new Error('not_found'), { code: 404 });
  if (['cancelled', 'refunded', 'archived'].indexOf(order.status) >= 0) {
    throw Object.assign(new Error('order_closed'), { code: 400, message_text: 'This order is closed.' });
  }
  const { data: item, error: iErr } = await admin.from('order_items').select('*').eq('id', opts.item_id).eq('order_id', order.id).maybeSingle();
  if (iErr) throw iErr;
  if (!item) throw Object.assign(new Error('item_not_found'), { code: 404 });

  const prev = item.price_override || null;
  const actor = opts.actor || {};
  let next = null;
  let patch;
  if (opts.override) {
    next = Object.assign(sanitizeOverride(opts.override), {
      normal_unit_cents: normalUnitCents(item),
      set_by: actor.user_id || null,
      set_by_label: actor.label || null,
      set_at: new Date().toISOString()
    });
    patch = Object.assign({ price_override: next }, overrideFields(Object.assign({}, item, { price_override: next })));
  } else {
    if (!prev) return { order: order, item: item, unchanged: true };
    // Back to the normal price for this line.
    const normal = normalUnitCents(item);
    patch = Object.assign({ price_override: null, unit_price_cents: normal }, amountsAtRate(Object.assign({}, item, { unit_price_cents: normal }), normal));
  }
  patch.updated_at = new Date().toISOString();
  const { data: updated, error: uErr } = await admin.from('order_items').update(patch).eq('id', item.id).select('*').single();
  if (uErr) throw uErr;

  const action = !next ? 'removed' : prev ? 'changed' : 'set';
  const hist = historyRow(order, Object.assign({}, item, { price_override: prev || next }), action, next || prev, actor, next ? updated : null);
  if (!next) hist.special_line_cents = null;
  const { error: hErr } = await admin.from('order_price_overrides').insert(hist);
  if (hErr) throw hErr;
  await writeChange({
    order_id: order.id,
    site_id: order.site_id,
    order_item_id: item.id,
    field_path: 'item.special_price',
    previous_value: prev,
    new_value: next,
    source: 'admin',
    actor_user_id: actor.user_id || null,
    actor_label: actor.label || null,
    note: (next && next.reason) || null
  });
  await refreshOrderFlag(admin, order.id);
  const recalc = await recalculateOrderPreservingDeposit(order.id);
  await writeAudit({
    order_system_id: order.order_system_id,
    site_id: order.site_id,
    order_id: order.id,
    event_type: 'special_price_' + action,
    actor_user_id: actor.user_id || null,
    actor_label: actor.label || null,
    source: 'admin',
    payload: { order_item_id: item.id, product_name: item.product_name, override: next }
  });
  return { order: recalc.order, item: updated };
}

/** History rows for new staff orders created with special prices on lines. */
async function logNewOrderOverrides(admin, order, items, actor) {
  const rows = (items || []).filter(function (it) { return it.price_override; }).map(function (it) {
    return historyRow(order, it, 'set', it.price_override, actor, it);
  });
  if (!rows.length) return 0;
  const { error } = await admin.from('order_price_overrides').insert(rows);
  if (error) throw error;
  await admin.from('order_orders').update({ has_price_override: true }).eq('id', order.id);
  return rows.length;
}

module.exports = {
  MODES,
  sanitizeOverride,
  amountsAtRate,
  normalUnitCents,
  normalLineCents,
  overrideFields,
  enforcePatch,
  estimateRange,
  applyToRow,
  describe,
  customerView,
  showWasPrice,
  enforceForItems,
  historyRow,
  refreshOrderFlag,
  setLineOverride,
  logNewOrderOverrides
};
