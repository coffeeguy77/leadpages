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

function productMatchesItem(item, query, mode, refine) {
  var q = normaliseQuery(query);
  if (!q || !item) return false;
  var hay = itemSearchHaystack(item);
  if (!hay) return false;
  var ok = false;
  if (mode === 'exact') {
    var name = String(item.product_name || snapName(item) || '')
      .trim()
      .toLowerCase();
    var sku = String(item.product_sku || '').trim().toLowerCase();
    ok = name === q || sku === q;
  } else {
    ok = hay.indexOf(q) >= 0;
  }
  if (!ok) return false;
  var r = normaliseQuery(refine);
  if (!r) return true;
  var optHay = (itemOptionsText(item) || '').toLowerCase();
  var notes = String((item && item.notes) || '').toLowerCase();
  return hay.indexOf(r) >= 0 || optHay.indexOf(r) >= 0 || notes.indexOf(r) >= 0;
}

/**
 * Flat list of matching line rows for print / preview.
 * @returns {{ pickup_date: string, order: object, item: object }[]}
 */
function collectProductSheetRows(orders, query, mode, refine) {
  var rows = [];
  (orders || []).forEach(function (ord) {
    (ord.items || []).forEach(function (it) {
      if (!productMatchesItem(it, query, mode, refine)) return;
      rows.push({
        pickup_date: ord.pickup_date,
        order: ord,
        item: it
      });
    });
  });
  return sortProductSheetRows(rows, 'date', 'asc');
}

/**
 * @param {string} sortKey date|order|name|phone|product|qty|weight|options
 * @param {'asc'|'desc'} dir
 */
function sortProductSheetRows(rows, sortKey, dir) {
  var key = String(sortKey || 'date').toLowerCase();
  var desc = String(dir || 'asc').toLowerCase() === 'desc';
  var list = (rows || []).slice();

  function qtyVal(it) {
    if (!it) return 0;
    if (it.quantity != null && it.quantity !== '') return Number(it.quantity) || 0;
    return 0;
  }
  function weightVal(it) {
    if (!it) return 0;
    if (it.actual_weight_kg != null) return Number(it.actual_weight_kg) || 0;
    if (it.requested_weight_kg != null) return Number(it.requested_weight_kg) || 0;
    return 0;
  }

  list.sort(function (a, b) {
    var an = String((a.order && a.order.customer_name) || '').toLowerCase();
    var bn = String((b.order && b.order.customer_name) || '').toLowerCase();
    var ap = String((a.item && a.item.product_name) || '').toLowerCase();
    var bp = String((b.item && b.item.product_name) || '').toLowerCase();
    var ad = String(a.pickup_date || '');
    var bd = String(b.pickup_date || '');
    var ao = String((a.order && a.order.order_number) || '');
    var bo = String((b.order && b.order.order_number) || '');
    var aph = String((a.order && a.order.customer_phone) || '');
    var bph = String((b.order && b.order.customer_phone) || '');
    var aopt = itemOptionsText(a.item || {}).toLowerCase();
    var bopt = itemOptionsText(b.item || {}).toLowerCase();
    var cmp = 0;

    if (key === 'name' || key === 'customer') {
      cmp = an.localeCompare(bn);
    } else if (key === 'product') {
      cmp = ap.localeCompare(bp);
    } else if (key === 'order') {
      cmp = ao.localeCompare(bo);
    } else if (key === 'phone') {
      cmp = aph.localeCompare(bph);
    } else if (key === 'qty') {
      cmp = qtyVal(a.item) - qtyVal(b.item);
    } else if (key === 'weight') {
      cmp = weightVal(a.item) - weightVal(b.item);
    } else if (key === 'options') {
      cmp = aopt.localeCompare(bopt);
    } else {
      // date (default)
      cmp = ad.localeCompare(bd);
      if (cmp === 0) cmp = ao.localeCompare(bo);
      if (cmp === 0) cmp = ap.localeCompare(bp);
    }

    if (cmp === 0 && key !== 'date') {
      cmp = ad.localeCompare(bd);
      if (cmp === 0) cmp = ao.localeCompare(bo);
    }
    return desc ? -cmp : cmp;
  });
  return list;
}

/**
 * Sort compact API/UI rows (already serialized).
 */
function sortSerializedProductRows(rows, sortKey, dir) {
  var key = String(sortKey || 'date').toLowerCase();
  var desc = String(dir || 'asc').toLowerCase() === 'desc';
  var list = (rows || []).slice();
  list.sort(function (a, b) {
    var cmp = 0;
    function s(v) {
      return String(v == null ? '' : v).toLowerCase();
    }
    function n(v) {
      var x = Number(v);
      return Number.isFinite(x) ? x : 0;
    }
    if (key === 'name' || key === 'customer') cmp = s(a.customer_name).localeCompare(s(b.customer_name));
    else if (key === 'product') cmp = s(a.product_name).localeCompare(s(b.product_name));
    else if (key === 'order') cmp = s(a.order_number).localeCompare(s(b.order_number));
    else if (key === 'phone') cmp = s(a.customer_phone).localeCompare(s(b.customer_phone));
    else if (key === 'qty') cmp = n(a.quantity) - n(b.quantity);
    else if (key === 'weight') {
      var aw = a.actual_weight_kg != null ? a.actual_weight_kg : a.requested_weight_kg;
      var bw = b.actual_weight_kg != null ? b.actual_weight_kg : b.requested_weight_kg;
      cmp = n(aw) - n(bw);
    } else if (key === 'options') cmp = s(a.options).localeCompare(s(b.options));
    else {
      cmp = s(a.pickup_date).localeCompare(s(b.pickup_date));
      if (cmp === 0) cmp = s(a.order_number).localeCompare(s(b.order_number));
    }
    if (cmp === 0 && key !== 'date') {
      cmp = s(a.pickup_date).localeCompare(s(b.pickup_date));
    }
    return desc ? -cmp : cmp;
  });
  return list;
}

function serializeProductSheetRows(rows) {
  return (rows || []).map(function (row) {
    var ord = row.order || {};
    var it = row.item || {};
    var weightLabel = '';
    if (it.actual_weight_kg != null) weightLabel = Number(it.actual_weight_kg) + ' kg';
    else if (it.requested_weight_kg != null) weightLabel = 'Req ' + Number(it.requested_weight_kg) + ' kg';
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
      qty_label: it.quantity != null ? String(it.quantity) + (it.unit_label ? ' ' + it.unit_label : '') : '—',
      weight_label: weightLabel || '—',
      options: itemOptionsText(it),
      notes: it.notes || null
    };
  });
}

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

/** Local calendar YYYY-MM-DD (Australia-friendly for butcher shops). */
function todayYmd(timeZone) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'Australia/Sydney',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  } catch (_e) {
    var d = new Date();
    return d.toISOString().slice(0, 10);
  }
}

module.exports = {
  normaliseQuery,
  productMatchesItem,
  itemOptionsText,
  productLineQtyLabel,
  collectProductSheetRows,
  sortProductSheetRows,
  sortSerializedProductRows,
  serializeProductSheetRows,
  groupProductSheetRowsByDate,
  summariseProductSearch,
  todayYmd
};
