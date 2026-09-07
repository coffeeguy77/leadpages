'use strict';

/**
 * Match order line items by product name (partial or exact).
 * Used for butcher production sheets — e.g. all "Turkey" lines or exact "Stuffed turkey roll".
 */

function normaliseQuery(q) {
  return String(q || '')
    .trim()
    .toLowerCase();
}

function itemSearchHaystack(item) {
  var parts = [item.product_name, item.product_sku];
  var snap = item.product_snapshot || {};
  if (snap.name) parts.push(snap.name);
  if (snap.sku) parts.push(snap.sku);
  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function productMatchesItem(item, query, mode) {
  var q = normaliseQuery(query);
  if (!q || !item) return false;
  var hay = itemSearchHaystack(item);
  if (!hay) return false;
  if (mode === 'exact') {
    var name = String(item.product_name || snapName(item) || '')
      .trim()
      .toLowerCase();
    var sku = String(item.product_sku || '').trim().toLowerCase();
    return name === q || sku === q;
  }
  return hay.indexOf(q) >= 0;
}

function snapName(item) {
  var snap = (item && item.product_snapshot) || {};
  return snap.name || '';
}

function itemOptionsText(item) {
  var snap = (item && item.product_snapshot) || {};
  var opts = snap.selected_options || snap.options || [];
  if (!Array.isArray(opts) || !opts.length) {
    var os = (item && item.options_snapshot) || {};
    opts = os.selected || os.selected_options || [];
  }
  if (!Array.isArray(opts) || !opts.length) return '';
  return opts
    .map(function (o) {
      if (!o) return '';
      if (typeof o === 'string') return o;
      return o.label || o.value || '';
    })
    .filter(Boolean)
    .join(', ');
}

function productLineQtyLabel(item) {
  var parts = [];
  if (item.quantity != null) parts.push('Qty ' + item.quantity);
  if (item.unit_label) parts.push(String(item.unit_label));
  if (item.requested_weight_kg != null) parts.push('Req ' + item.requested_weight_kg + ' kg');
  if (item.actual_weight_kg != null) parts.push('Actual ' + item.actual_weight_kg + ' kg');
  return parts.join(' · ');
}

/**
 * Flat list of matching line rows for print / preview.
 * @returns {{ pickup_date: string, order: object, item: object }[]}
 */
function collectProductSheetRows(orders, query, mode) {
  var rows = [];
  (orders || []).forEach(function (ord) {
    (ord.items || []).forEach(function (it) {
      if (!productMatchesItem(it, query, mode)) return;
      rows.push({
        pickup_date: ord.pickup_date,
        order: ord,
        item: it
      });
    });
  });
  return sortProductSheetRows(rows, 'date');
}

/**
 * @param {'date'|'name'|'product'} sortKey
 */
function sortProductSheetRows(rows, sortKey) {
  var key = String(sortKey || 'date').toLowerCase();
  var list = (rows || []).slice();
  list.sort(function (a, b) {
    var an = String((a.order && a.order.customer_name) || '').toLowerCase();
    var bn = String((b.order && b.order.customer_name) || '').toLowerCase();
    var ap = String((a.item && a.item.product_name) || '').toLowerCase();
    var bp = String((b.item && b.item.product_name) || '').toLowerCase();
    var ad = String(a.pickup_date || '');
    var bd = String(b.pickup_date || '');
    var ao = String((a.order && a.order.order_number) || '');
    var bo = String((b.order && b.order.order_number) || '');
    var cmp = 0;
    if (key === 'name') {
      cmp = an.localeCompare(bn);
      if (cmp !== 0) return cmp;
      cmp = ad.localeCompare(bd);
      if (cmp !== 0) return cmp;
      return ap.localeCompare(bp);
    }
    if (key === 'product') {
      cmp = ap.localeCompare(bp);
      if (cmp !== 0) return cmp;
      cmp = ad.localeCompare(bd);
      if (cmp !== 0) return cmp;
      return an.localeCompare(bn);
    }
    // date (default)
    cmp = ad.localeCompare(bd);
    if (cmp !== 0) return cmp;
    cmp = ao.localeCompare(bo);
    if (cmp !== 0) return cmp;
    return ap.localeCompare(bp);
  });
  return list;
}

/**
 * Compact rows for live preview UI / API clients.
 */
function serializeProductSheetRows(rows) {
  return (rows || []).map(function (row) {
    var ord = row.order || {};
    var it = row.item || {};
    return {
      pickup_date: row.pickup_date || ord.pickup_date || null,
      order_id: ord.id || null,
      order_number: ord.order_number || null,
      customer_name: ord.customer_name || null,
      customer_phone: ord.customer_phone || null,
      product_name: it.product_name || null,
      product_sku: it.product_sku || null,
      quantity: it.quantity != null ? it.quantity : null,
      requested_weight_kg: it.requested_weight_kg != null ? it.requested_weight_kg : null,
      actual_weight_kg: it.actual_weight_kg != null ? it.actual_weight_kg : null,
      qty_label: productLineQtyLabel(it),
      options: itemOptionsText(it),
      notes: it.notes || null
    };
  });
}

/**
 * Group rows by pickup date for range printouts.
 * @returns {{ date: string, rows: object[] }[]}
 */
function groupProductSheetRowsByDate(rows) {
  var byDate = {};
  (rows || []).forEach(function (row) {
    var d = row.pickup_date || '';
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(row);
  });
  return Object.keys(byDate)
    .sort()
    .map(function (d) {
      return { date: d, rows: byDate[d] };
    });
}

function summariseProductSearch(rows) {
  var orderIds = {};
  var dates = {};
  (rows || []).forEach(function (r) {
    if (r.order && r.order.id) orderIds[r.order.id] = true;
    if (r.pickup_date) dates[r.pickup_date] = true;
  });
  return {
    match_count: rows.length,
    order_count: Object.keys(orderIds).length,
    dates: Object.keys(dates).sort()
  };
}

module.exports = {
  normaliseQuery,
  productMatchesItem,
  itemOptionsText,
  productLineQtyLabel,
  collectProductSheetRows,
  sortProductSheetRows,
  serializeProductSheetRows,
  groupProductSheetRowsByDate,
  summariseProductSearch
};
