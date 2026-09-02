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
  rows.sort(function (a, b) {
    var d = String(a.pickup_date || '').localeCompare(String(b.pickup_date || ''));
    if (d !== 0) return d;
    var on = String((a.order && a.order.order_number) || '').localeCompare(String((b.order && b.order.order_number) || ''));
    if (on !== 0) return on;
    return String(a.item.product_name || '').localeCompare(String(b.item.product_name || ''));
  });
  return rows;
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
  collectProductSheetRows,
  groupProductSheetRowsByDate,
  summariseProductSearch
};
