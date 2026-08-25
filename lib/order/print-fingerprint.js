'use strict';

const crypto = require('crypto');
const { variationLabelFromItem } = require('./supply');
const { sortOrdersForPrint, pickupWindowLabel } = require('./print-document');

const SNAPSHOT_FORMATS = ['day_run', 'prep', 'pick_list', 'allocation', 'label', 'item_labels'];
const FINGERPRINT_VERSION = 1;

function isSnapshotFormat(format) {
  return SNAPSHOT_FORMATS.indexOf(String(format || '')) >= 0;
}

function stableStringify(value) {
  if (value == null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  var keys = Object.keys(value).sort();
  return (
    '{' +
    keys
      .map(function (k) {
        return JSON.stringify(k) + ':' + stableStringify(value[k]);
      })
      .join(',') +
    '}'
  );
}

function hashCanonical(obj) {
  return crypto.createHash('sha256').update(stableStringify(obj)).digest('hex');
}

function itemCanon(it, opts) {
  opts = opts || {};
  var row = {
    id: it.id || null,
    product_id: it.product_id || null,
    product_name: it.product_name || '',
    quantity: Number(it.quantity) || 0,
    requested_weight_kg: it.requested_weight_kg != null ? Number(it.requested_weight_kg) : null,
    actual_weight_kg: it.actual_weight_kg != null ? Number(it.actual_weight_kg) : null,
    notes: it.notes || '',
    variation: variationLabelFromItem(it),
    price_status: it.price_status || null
  };
  if (opts.includePacked) row.packed = !!it.packed;
  return row;
}

function orderCanon(ord, opts) {
  opts = opts || {};
  var items = (ord.items || []).map(function (it) {
    return itemCanon(it, opts);
  });
  items.sort(function (a, b) {
    return String(a.id || a.product_name).localeCompare(String(b.id || b.product_name));
  });
  var row = {
    id: ord.id,
    order_number: ord.order_number || '',
    status: ord.status || '',
    customer_name: ord.customer_name || '',
    customer_phone: ord.customer_phone || '',
    pickup_window: pickupWindowLabel(ord) || '',
    customer_notes: ord.customer_notes || '',
    is_important: !!ord.is_important,
    items: items
  };
  if (opts.includeInternal) row.internal_notes = ord.internal_notes || '';
  return row;
}

/**
 * Build canonical payload + fingerprint for a staff date print format.
 * @param {string} format
 * @param {{ orders?: object[], supply?: { lines?: object[], allocations?: object[] } }} data
 */
function buildPrintFingerprint(format, data) {
  data = data || {};
  var orders = sortOrdersForPrint(data.orders || []);
  var supply = data.supply || {};
  var canonical;
  var lineCount = 0;

  if (format === 'prep') {
    var lines = (supply.lines || []).slice().sort(function (a, b) {
      return String(a.product_name || '').localeCompare(String(b.product_name || ''));
    });
    canonical = {
      v: FINGERPRINT_VERSION,
      format: format,
      lines: lines.map(function (L) {
        return {
          product_id: L.product_id || null,
          product_name: L.product_name || '',
          quantity: Number(L.quantity) || 0,
          requested_weight_kg: L.requested_weight_kg != null ? Number(L.requested_weight_kg) : null,
          actual_weight_kg: L.actual_weight_kg != null ? Number(L.actual_weight_kg) : null,
          order_count: L.order_count || 0
        };
      })
    };
    lineCount = lines.length;
  } else if (format === 'allocation') {
    // Exclude packed flags — packing ticks should not force re-print of allocation sheet
    var groups = (supply.allocations || []).slice().sort(function (a, b) {
      var pn = String(a.product_name || '').localeCompare(String(b.product_name || ''));
      if (pn) return pn;
      return String(a.variation_label || '').localeCompare(String(b.variation_label || ''));
    });
    canonical = {
      v: FINGERPRINT_VERSION,
      format: format,
      groups: groups.map(function (g) {
        var glines = (g.lines || []).slice().sort(function (a, b) {
          return String(a.order_item_id || '').localeCompare(String(b.order_item_id || ''));
        });
        lineCount += glines.length;
        return {
          product_id: g.product_id || null,
          product_name: g.product_name || '',
          variation_label: g.variation_label || '',
          quantity: Number(g.quantity) || 0,
          requested_weight_kg: g.requested_weight_kg != null ? Number(g.requested_weight_kg) : null,
          lines: glines.map(function (L) {
            return {
              order_item_id: L.order_item_id,
              order_number: L.order_number || '',
              customer_name: L.customer_name || '',
              quantity: Number(L.quantity) || 0,
              requested_weight_kg: L.requested_weight_kg != null ? Number(L.requested_weight_kg) : null,
              notes: L.notes || '',
              customer_notes: L.customer_notes || '',
              is_important: !!L.is_important
            };
          })
        };
      })
    };
  } else if (format === 'label') {
    canonical = {
      v: FINGERPRINT_VERSION,
      format: format,
      orders: orders.map(function (o) {
        return {
          id: o.id,
          order_number: o.order_number || '',
          customer_name: o.customer_name || '',
          pickup_window: pickupWindowLabel(o) || '',
          is_important: !!o.is_important,
          item_count: (o.items || []).length
        };
      })
    };
    lineCount = orders.length;
  } else if (format === 'item_labels') {
    var stickers = [];
    orders.forEach(function (o) {
      (o.items || []).forEach(function (it) {
        stickers.push({
          order_number: o.order_number || '',
          customer_name: o.customer_name || '',
          pickup_window: pickupWindowLabel(o) || '',
          is_important: !!o.is_important,
          item: itemCanon(it)
        });
      });
    });
    stickers.sort(function (a, b) {
      var c = String(a.order_number).localeCompare(String(b.order_number));
      if (c) return c;
      return String(a.item.product_name).localeCompare(String(b.item.product_name));
    });
    canonical = { v: FINGERPRINT_VERSION, format: format, stickers: stickers };
    lineCount = stickers.length;
  } else {
    // day_run, pick_list
    var includeInternal = format === 'day_run' || format === 'pick_list';
    canonical = {
      v: FINGERPRINT_VERSION,
      format: format,
      orders: orders.map(function (o) {
        return orderCanon(o, { includeInternal: includeInternal });
      })
    };
    orders.forEach(function (o) {
      lineCount += (o.items || []).length;
    });
  }

  return {
    fingerprint: hashCanonical(canonical),
    order_count: orders.length,
    line_count: lineCount,
    payload_summary: {
      v: FINGERPRINT_VERSION,
      format: format,
      order_numbers: orders.map(function (o) {
        return o.order_number;
      }).sort()
    }
  };
}

module.exports = {
  SNAPSHOT_FORMATS,
  FINGERPRINT_VERSION,
  isSnapshotFormat,
  stableStringify,
  hashCanonical,
  buildPrintFingerprint
};
