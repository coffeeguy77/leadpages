'use strict';

/**
 * Pure CSV / mapping helpers for Order Engine import (no DB).
 */

var CUSTOMER_FIELDS = [
  { id: 'first_name', label: 'First name' },
  { id: 'surname', label: 'Surname' },
  { id: 'name', label: 'Full name' },
  { id: 'phone', label: 'Phone' },
  { id: 'email', label: 'Email' },
  { id: 'notes', label: 'Notes' },
  { id: 'external_ref', label: 'External ref' },
  { id: 'ignore', label: '— Ignore —' }
];

var PRODUCT_FIELDS = [
  { id: 'name', label: 'Product name' },
  { id: 'sku', label: 'SKU' },
  { id: 'category', label: 'Category' },
  { id: 'pricing_method', label: 'Pricing method' },
  { id: 'price_cents', label: 'Price ($)' },
  { id: 'price_per_kg_cents', label: 'Price per kg ($)' },
  { id: 'short_description', label: 'Description' },
  { id: 'ignore', label: '— Ignore —' }
];

var ORDER_HISTORY_FIELDS = [
  { id: 'first_name', label: 'First name' },
  { id: 'surname', label: 'Surname' },
  { id: 'name', label: 'Full name' },
  { id: 'phone', label: 'Phone' },
  { id: 'email', label: 'Email' },
  { id: 'order_date', label: 'Order / created date' },
  { id: 'pickup_date', label: 'Pickup date' },
  { id: 'order_number', label: 'Order number' },
  { id: 'deposit', label: 'Deposit ($)' },
  { id: 'product_name', label: 'Product / order detail' },
  { id: 'size_weight', label: 'Size / weight note' },
  { id: 'quantity', label: 'Quantity' },
  { id: 'line_notes', label: 'Line notes / options' },
  { id: 'ignore', label: '— Ignore —' }
];

var PRESET_BUTCHER_LINE_ITEMS = {
  id: 'butcher_line_items',
  label: 'Butchery line items (no header)',
  kind: 'order_history',
  has_header: false,
  mapping: {
    0: 'first_name',
    1: 'surname',
    2: 'phone',
    3: 'pickup_date',
    4: 'order_number',
    5: 'product_name',
    6: 'size_weight',
    7: 'quantity',
    8: 'line_notes',
    9: 'ignore'
  }
};

function parseCsv(text) {
  var raw = String(text || '').replace(/^\uFEFF/, '');
  var rows = [];
  var i = 0;
  var field = '';
  var row = [];
  var inQuotes = false;
  while (i < raw.length) {
    var c = raw.charAt(i);
    if (inQuotes) {
      if (c === '"') {
        if (raw.charAt(i + 1) === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && raw.charAt(i + 1) === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some(function (x) { return String(x).trim() !== ''; })) rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some(function (x) { return String(x).trim() !== ''; })) rows.push(row);
  }
  return rows;
}

function parseAuDate(v) {
  var s = String(v || '').trim();
  if (!s) return null;
  var m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    var d = parseInt(m[1], 10);
    var mo = parseInt(m[2], 10);
    var y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    var iso = y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    if (!isNaN(Date.parse(iso))) return iso;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function parseMoneyToCents(v) {
  if (v == null || v === '') return null;
  var s = String(v).replace(/[^0-9.\-]/g, '');
  if (!s) return null;
  var n = Number(s);
  if (!isFinite(n)) return null;
  return Math.round(n * 100);
}

function parseQty(v) {
  if (v == null || String(v).trim() === '') return 1;
  var n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  if (!isFinite(n) || n <= 0) return 1;
  return n;
}

function cleanOrderNumber(v) {
  return String(v == null ? '' : v).replace(/,/g, '').replace(/\s+/g, '').trim();
}

function mapRow(cells, mapping) {
  var out = {};
  Object.keys(mapping || {}).forEach(function (idx) {
    var field = mapping[idx];
    if (!field || field === 'ignore') return;
    var val = cells[Number(idx)];
    out[field] = val == null ? '' : String(val).trim();
  });
  return out;
}

function fullName(mapped) {
  if (mapped.name) return mapped.name;
  return [mapped.first_name, mapped.surname].filter(Boolean).join(' ').trim();
}

function fieldsForKind(kind) {
  if (kind === 'customers') return CUSTOMER_FIELDS;
  if (kind === 'products') return PRODUCT_FIELDS;
  return ORDER_HISTORY_FIELDS;
}

function previewImport(opts) {
  var kind = opts.kind || 'order_history';
  var rows = Array.isArray(opts.rows) ? opts.rows : parseCsv(opts.csv_text || '');
  var hasHeader = !!opts.has_header;
  var mapping = opts.mapping || {};
  var start = hasHeader ? 1 : 0;
  var sample = [];
  var maxCols = 0;
  rows.forEach(function (r) {
    if (r.length > maxCols) maxCols = r.length;
  });
  for (var i = start; i < Math.min(rows.length, start + 8); i++) {
    sample.push({ index: i, mapped: mapRow(rows[i], mapping), raw: rows[i] });
  }
  return {
    kind: kind,
    has_header: hasHeader,
    row_count: Math.max(0, rows.length - start),
    column_count: maxCols,
    header_guess: hasHeader && rows[0] ? rows[0] : null,
    fields: fieldsForKind(kind),
    presets: [PRESET_BUTCHER_LINE_ITEMS],
    sample: sample,
    mapping: mapping
  };
}

function groupOrderHistoryRows(rows, mapping, hasHeader, phoneNormaliser) {
  var normalise = typeof phoneNormaliser === 'function' ? phoneNormaliser : function (p) {
    return String(p || '').replace(/\D/g, '');
  };
  var start = hasHeader ? 1 : 0;
  var groups = {};
  var keys = [];
  for (var i = start; i < rows.length; i++) {
    var mapped = mapRow(rows[i], mapping);
    var onum = cleanOrderNumber(mapped.order_number);
    var e164 = normalise(mapped.phone);
    var key = (onum || 'row-' + i) + '|' + (e164 || fullName(mapped) || 'anon');
    if (!groups[key]) {
      groups[key] = { mappedMeta: mapped, lines: [], rowIndexes: [] };
      keys.push(key);
    }
    groups[key].lines.push(mapped);
    groups[key].rowIndexes.push(i + 1);
    ['first_name', 'surname', 'name', 'phone', 'email', 'pickup_date', 'order_date', 'deposit', 'order_number'].forEach(
      function (k) {
        if (mapped[k]) groups[key].mappedMeta[k] = mapped[k];
      }
    );
  }
  return { groups: groups, keys: keys };
}

module.exports = {
  CUSTOMER_FIELDS,
  PRODUCT_FIELDS,
  ORDER_HISTORY_FIELDS,
  PRESET_BUTCHER_LINE_ITEMS,
  parseCsv,
  parseAuDate,
  parseMoneyToCents,
  parseQty,
  cleanOrderNumber,
  mapRow,
  fullName,
  fieldsForKind,
  previewImport,
  groupOrderHistoryRows
};
