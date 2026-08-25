'use strict';

const { formatAud } = require('./money');
const { orderGstSummary, lineGstCents } = require('./gst');

const CUSTOMER_FORMATS = ['receipt', 'thermal'];
const STAFF_FORMATS = [
  'slip',
  'receipt',
  'thermal',
  'day_run',
  'prep',
  'procurement',
  'pick_list',
  'allocation',
  'label',
  'item_labels',
  'exceptions'
];

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function formatDateLabel(iso) {
  if (!iso) return '—';
  var p = String(iso).slice(0, 10).split('-');
  if (p.length !== 3) return esc(iso);
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  if (isNaN(d.getTime())) return esc(iso);
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function pickupWindowLabel(order) {
  if (!order) return '';
  var start = order.pickup_window_start ? String(order.pickup_window_start).slice(0, 5) : '';
  var end = order.pickup_window_end ? String(order.pickup_window_end).slice(0, 5) : '';
  if (start && end) return start + '–' + end;
  if (order.pickup_time) return String(order.pickup_time).slice(0, 5);
  return '';
}

function sortKeyForOrder(order) {
  var w = pickupWindowLabel(order);
  return (w || '99:99') + '|' + String(order.customer_name || '').toLowerCase();
}

function sortOrdersForPrint(orders) {
  return (orders || []).slice().sort(function (a, b) {
    return sortKeyForOrder(a).localeCompare(sortKeyForOrder(b));
  });
}

function itemOptionsText(item) {
  var snap = item.product_snapshot || {};
  var opts = snap.selected_options || snap.options || [];
  if (!Array.isArray(opts) || !opts.length) return '';
  return opts
    .map(function (o) {
      if (!o) return '';
      if (typeof o === 'string') return o;
      var label = o.label || o.value || '';
      var price = o.price_cents != null && Number(o.price_cents) > 0 ? ' (+' + formatAud(o.price_cents) + ')' : '';
      return label + price;
    })
    .filter(Boolean)
    .join(', ');
}

function linePriceLabel(item) {
  if (item.line_final_cents != null) return formatAud(item.line_final_cents);
  if (item.price_status === 'tbc' || item.price_status === 'pending_weight' || item.price_status === 'quote_required') {
    return 'TBC';
  }
  if (item.line_known_cents != null) return formatAud(item.line_known_cents);
  return '—';
}

function isTbcItem(item) {
  return (
    item.price_status === 'tbc' ||
    item.price_status === 'pending_weight' ||
    item.price_status === 'quote_required' ||
    item.pricing_method === 'per_weight' ||
    item.pricing_method === 'price_tbc'
  );
}

function printCss(format) {
  var thermal = format === 'thermal';
  var labels = format === 'label' || format === 'item_labels';
  var pageW = thermal ? '80mm' : 'auto';
  var pageRule = thermal
    ? '@page{margin:4mm 3mm;size:80mm auto;}'
    : labels
      ? '@page{margin:8mm;size:A4 portrait;}'
      : '@page{margin:12mm;size:A4 portrait;}';
  var base =
    pageRule +
    '*{box-sizing:border-box}' +
    'html,body{margin:0;padding:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#111;background:#fff}' +
    '.doc{max-width:' +
    pageW +
    ';margin:0 auto;padding:' +
    (thermal ? '2mm 1mm 6mm' : labels ? '0' : '0 0 12mm') +
    '}' +
    '.no-print{display:block;margin:0 0 12px;padding:10px 12px;background:#f4f1eb;border:1px solid #ddd6cb;border-radius:8px;font-size:13px}' +
    '.no-print button{margin-right:8px;padding:8px 12px;border:1px solid #1f5c3a;background:#1f5c3a;color:#fff;border-radius:8px;font:inherit;font-weight:600;cursor:pointer}' +
    '.no-print button.ghost{background:#fff;color:#1f5c3a}' +
    '@media print{.no-print{display:none!important}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}';

  if (labels) {
    return (
      '<style>' +
      base +
      '.label-sheet{display:flex;flex-wrap:wrap;gap:3mm;align-content:flex-start}' +
      '.label-sticker{width:92mm;height:48mm;border:1px dashed #bbb;border-radius:2mm;padding:2.5mm 3mm;overflow:hidden;page-break-inside:avoid;break-inside:avoid;display:flex;gap:2.5mm;position:relative;background:#fff}' +
      '.label-sticker.important{border-color:#c47a00;border-style:solid;box-shadow:inset 0 0 0 1.5px #c47a00}' +
      '.label-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}' +
      '.label-biz{font-size:9px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#1f5c3a;margin:0;line-height:1.2}' +
      '.label-num{font-size:18px;font-weight:900;letter-spacing:-.02em;margin:0;line-height:1.1}' +
      '.label-cust{font-size:13px;font-weight:700;margin:1px 0 0;line-height:1.2}' +
      '.label-meta{font-size:10px;color:#333;margin:0;line-height:1.25}' +
      '.label-item{font-size:11px;font-weight:600;margin:2px 0 0;line-height:1.2}' +
      '.label-detail{font-size:9px;color:#444;margin:0;line-height:1.25}' +
      '.label-qr{width:22mm;height:22mm;flex-shrink:0;align-self:flex-start}' +
      '.label-qr svg{width:100%;height:100%;display:block}' +
      '.label-imp{display:inline-block;margin-top:2px;padding:1px 5px;font-size:8px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;background:#fff1d6;color:#8a5a00;border-radius:3px}' +
      '.label-sheet-head{margin:0 0 8px}' +
      '.label-sheet-head .title{font-size:16px;margin:0}' +
      '.label-sheet-head .sub{font-size:12px;color:#555;margin:2px 0 0}' +
      '.footer{margin-top:10px;font-size:10px;color:#666;text-align:center}' +
      '</style>'
    );
  }

  return (
    '<style>' +
    base +
    '.head{margin:0 0 ' +
    (thermal ? '6px' : '14px') +
    ';padding-bottom:' +
    (thermal ? '4px' : '10px') +
    ';border-bottom:2px solid #111;position:relative;padding-right:' +
    (thermal ? '72px' : '140px') +
    ';min-height:' +
    (thermal ? '36px' : '52px') +
    '}' +
    '.order-num-big{position:absolute;top:0;right:0;font-size:' +
    (thermal ? '22px' : '36px') +
    ';font-weight:900;line-height:1;letter-spacing:-.02em;text-align:right;color:#111;max-width:' +
    (thermal ? '68px' : '130px') +
    ';word-break:break-word}' +
    '.biz{font-size:' +
    (thermal ? '11px' : '13px') +
    ';font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#1f5c3a;margin:0 0 4px}' +
    '.title{margin:0;font-size:' +
    (thermal ? '16px' : '22px') +
    ';font-weight:800;line-height:1.15}' +
    '.sub{margin:4px 0 0;font-size:' +
    (thermal ? '11px' : '13px') +
    ';color:#444}' +
    '.meta{display:grid;grid-template-columns:' +
    (thermal ? '1fr' : '1fr 1fr') +
    ';gap:' +
    (thermal ? '4px' : '8px') +
    ';margin:' +
    (thermal ? '6px 0' : '12px 0') +
    '}' +
    '.meta div{padding:' +
    (thermal ? '4px 0' : '8px 10px') +
    ';background:#f7f4ef;border-radius:6px}' +
    '.meta label{display:block;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#666;margin:0 0 2px}' +
    '.meta strong{font-size:' +
    (thermal ? '12px' : '14px') +
    '}' +
    '.items{margin-top:' +
    (thermal ? '6px' : '10px') +
    '}' +
    '.item{padding:' +
    (thermal ? '6px 0' : '10px 0') +
    ';border-top:1px solid #ddd}' +
    '.item:first-child{border-top:0}' +
    '.item h4{margin:0 0 2px;font-size:' +
    (thermal ? '13px' : '16px') +
    ';line-height:1.25}' +
    '.item .detail{margin:0;font-size:' +
    (thermal ? '11px' : '13px') +
    ';color:#333;line-height:1.4}' +
    '.item.tbc h4{color:#8a5a00}' +
    '.item.tbc{background:#fff9eb;margin:0 -4px;padding-left:4px;padding-right:4px;border-radius:4px}' +
    '.chk{display:inline-block;width:14px;height:14px;border:2px solid #111;margin-right:6px;vertical-align:-2px}' +
    '.totals{margin-top:' +
    (thermal ? '8px' : '12px') +
    ';padding-top:' +
    (thermal ? '6px' : '10px') +
    ';border-top:2px dashed #bbb;font-size:' +
    (thermal ? '11px' : '14px') +
    '}' +
    '.totals .row{display:flex;justify-content:space-between;gap:8px;margin:3px 0}' +
    '.totals .row.emph{font-weight:800;font-size:' +
    (thermal ? '13px' : '16px') +
    ';margin-top:6px;padding-top:6px;border-top:1px solid #111}' +
    '.notes{margin-top:8px;padding:8px 10px;background:#f7f4ef;border-radius:6px;font-size:' +
    (thermal ? '11px' : '13px') +
    '}' +
    '.badge{display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;background:#efeaf6;color:#5b3d8a}' +
    '.badge.warn{background:#fff1d6;color:#8a5a00}' +
    '.badge.ok{background:#e7f3ea;color:#1f5c3a}' +
    '.page-break{page-break-after:always;break-after:page;height:0}' +
    '.order-block{margin-bottom:' +
    (thermal ? '8px' : '16px') +
    '}' +
    '.pick-list table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}' +
    '.pick-list th,.pick-list td{border:1px solid #ccc;padding:5px 6px;text-align:left;vertical-align:top}' +
    '.pick-list th{background:#f0ebe3;font-size:10px;text-transform:uppercase;letter-spacing:.04em}' +
    '.prep table{width:100%;border-collapse:collapse;font-size:13px;margin-top:10px}' +
    '.prep th,.prep td{border:1px solid #ccc;padding:6px 8px;text-align:left}' +
    '.prep th{background:#f0ebe3}' +
    '.prep tfoot td{font-weight:700;background:#faf7f2}' +
    '.footer{margin-top:12px;font-size:10px;color:#666;text-align:center}' +
    '</style>'
  );
}

function renderOrderNumberBadge(orderNumber, format) {
  var num = orderNumber || '';
  if (!num) return '';
  var short = String(num).replace(/^ORD-/i, '').replace(/^[A-Z]+-/i, '');
  var label = short.length >= 4 ? short : num;
  return '<div class="order-num-big" aria-label="Order number">' + esc(label) + '</div>';
}

function renderItemRow(item, format, opts) {
  opts = opts || {};
  var showPrices = format === 'receipt' || format === 'thermal';
  var showCheck = format === 'slip' || format === 'pick_list';
  var tbc = isTbcItem(item) && item.price_status !== 'final';
  var html = '<div class="item' + (tbc ? ' tbc' : '') + '">';
  html += '<h4>';
  if (showCheck) html += '<span class="chk" aria-hidden="true"></span>';
  html += esc(item.product_name);
  if (tbc) html += ' <span class="badge warn">TBC</span>';
  html += '</h4>';
  var parts = [];
  parts.push('Qty ' + esc(item.quantity));
  if (item.unit_label) parts.push(esc(item.unit_label));
  if (item.requested_weight_kg != null) parts.push('Req ' + esc(item.requested_weight_kg) + ' kg');
  if (item.actual_weight_kg != null) parts.push('Actual ' + esc(item.actual_weight_kg) + ' kg');
  var optTxt = itemOptionsText(item);
  if (optTxt) parts.push('Options: ' + esc(optTxt));
  if (item.notes) parts.push('Note: ' + esc(item.notes));
  html += '<p class="detail">' + parts.join(' · ') + '</p>';
  if (showPrices) {
    html += '<p class="detail"><strong>' + esc(linePriceLabel(item)) + '</strong>';
    if (item.price_status === 'estimated') html += ' <span class="badge">Est.</span>';
    if ((item.product_snapshot && item.product_snapshot.includes_gst) || lineGstCents(item) > 0) {
      html += ' <span class="badge ok">inc. GST</span>';
    }
    html += '</p>';
  }
  html += '</div>';
  return html;
}

function renderOrderTotals(order, format, items) {
  if (format !== 'receipt' && format !== 'thermal') return '';
  var bal =
    order.balance_cents != null
      ? formatAud(order.balance_cents)
      : order.has_unknown_prices
        ? 'TBC'
        : formatAud(0);
  var gst = orderGstSummary(items || []);
  var html = '<div class="totals">';
  html +=
    '<div class="row"><span>Known subtotal</span><span>' + esc(formatAud(order.known_subtotal_cents)) + '</span></div>';
  if (order.has_unknown_prices) {
    html += '<div class="row"><span>Other items</span><span>Price TBC after prep</span></div>';
  }
  if (gst.gst_included_cents > 0) {
    html +=
      '<div class="row"><span>GST included in prices</span><span>' +
      esc(formatAud(gst.gst_included_cents)) +
      '</span></div>';
    html += '<p class="detail" style="margin:4px 0 0;font-size:11px;color:#555">GST applies to selected items only (e.g. pies). Fresh meat is GST-free.</p>';
  }
  html +=
    '<div class="row"><span>Deposit required</span><span>' +
    esc(formatAud(order.deposit_required_cents)) +
    '</span></div>';
  html +=
    '<div class="row"><span>Deposit paid</span><span>' + esc(formatAud(order.deposit_paid_cents)) + '</span></div>';
  html += '<div class="row emph"><span>Balance</span><span>' + esc(bal) + '</span></div>';
  html += '</div>';
  return html;
}

function renderOrderBlock(order, items, format, business, opts) {
  opts = opts || {};
  var biz = (business && business.business_name) || 'Order';
  var windowLbl = pickupWindowLabel(order);
  var html = '<div class="order-block">';
  html += '<div class="head">';
  html += renderOrderNumberBadge(order.order_number, format);
  html += '<p class="biz">' + esc(biz) + '</p>';
  html += '<h1 class="title">' + esc(order.order_number || 'Order') + '</h1>';
  html += '<p class="sub">';
  if (format === 'slip' || format === 'pick_list') html += 'Packing slip · ';
  else if (format === 'thermal') html += 'Receipt · ';
  else html += 'Order receipt · ';
  html += esc(formatDateLabel(order.pickup_date));
  if (windowLbl) html += ' · ' + esc(windowLbl);
  html += '</p></div>';

  html += '<div class="meta">';
  html += '<div><label>Customer</label><strong>' + esc(order.customer_name || '—') + '</strong></div>';
  html += '<div><label>Contact</label><strong>' + esc(order.customer_phone || order.customer_email || '—') + '</strong></div>';
  if (format !== 'thermal') {
    html +=
      '<div><label>Fulfilment</label><strong>' +
      esc(String(order.fulfilment_type || 'pickup').replace(/_/g, ' ')) +
      '</strong></div>';
    html +=
      '<div><label>Status</label><strong>' +
      esc(String(order.status || '').replace(/_/g, ' ')) +
      '</strong></div>';
  }
  html += '</div>';

  html += '<div class="items">';
  (items || []).forEach(function (it) {
    html += renderItemRow(it, format, opts);
  });
  if (!(items || []).length) html += '<p class="detail">No items.</p>';
  html += '</div>';

  html += renderOrderTotals(order, format, items);

  if (order.customer_notes) {
    html += '<div class="notes"><strong>Customer notes</strong><br>' + esc(order.customer_notes) + '</div>';
  }
  if ((format === 'slip' || format === 'pick_list') && order.internal_notes) {
    html += '<div class="notes"><strong>Internal notes</strong><br>' + esc(order.internal_notes) + '</div>';
  }

  html += '</div>';
  return html;
}

function renderPickList(orders, business, pickupDate) {
  var biz = (business && business.business_name) || 'Orders';
  var sorted = sortOrdersForPrint(orders);
  var html = '<div class="head"><p class="biz">' + esc(biz) + '</p>';
  html += '<h1 class="title">Pick list — ' + esc(formatDateLabel(pickupDate)) + '</h1>';
  html +=
    '<p class="sub">' +
    esc(sorted.length) +
    ' order' +
    (sorted.length === 1 ? '' : 's') +
    ' · sorted by pickup window</p></div>';
  html += '<div class="pick-list"><table><thead><tr>';
  html += '<th>✓</th><th>Order</th><th>Window</th><th>Customer</th><th>Phone</th><th>Items</th><th>Notes</th>';
  html += '</tr></thead><tbody>';
  sorted.forEach(function (ord) {
    var itemSummary = (ord.items || [])
      .map(function (it) {
        var bit = (it.quantity != null ? it.quantity + '× ' : '') + (it.product_name || '');
        if (it.requested_weight_kg != null) bit += ' (' + it.requested_weight_kg + 'kg)';
        if (isTbcItem(it) && it.price_status !== 'final') bit += ' [TBC]';
        return bit;
      })
      .join('; ');
    var notes = [ord.customer_notes, ord.internal_notes].filter(Boolean).join(' / ');
    html += '<tr>';
    html += '<td style="width:24px"><span class="chk"></span></td>';
    html += '<td><strong>' + esc(ord.order_number) + '</strong><br><span style="font-size:11px;color:#666">' + esc(ord.status) + '</span></td>';
    html += '<td>' + esc(pickupWindowLabel(ord) || '—') + '</td>';
    html += '<td>' + esc(ord.customer_name) + '</td>';
    html += '<td>' + esc(ord.customer_phone || '') + '</td>';
    html += '<td>' + esc(itemSummary) + '</td>';
    html += '<td>' + esc(notes) + '</td>';
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

function renderPrepSummary(supply, business, pickupDate, meta) {
  meta = meta || {};
  var biz = (business && business.business_name) || 'Prep';
  var lines = supply.lines || [];
  var html = '<div class="head"><p class="biz">' + esc(biz) + '</p>';
  html += '<h1 class="title">Prep summary — ' + esc(formatDateLabel(pickupDate)) + '</h1>';
  html +=
    '<p class="sub">' +
    esc(meta.order_count || 0) +
    ' orders · ' +
    esc(lines.length) +
    ' product lines</p></div>';
  html += '<div class="prep"><table><thead><tr>';
  html += '<th>Product</th><th>Orders</th><th>Qty</th><th>Req. kg</th><th>Actual kg</th>';
  html += '</tr></thead><tbody>';
  var totalQty = 0;
  var totalKg = 0;
  lines.forEach(function (L) {
    totalQty += Number(L.quantity) || 0;
    if (L.has_weight) totalKg += Number(L.requested_weight_kg) || 0;
    html += '<tr>';
    html +=
      '<td><strong>' +
      esc(L.product_name) +
      '</strong>' +
      (L.product_sku ? '<br><span style="font-size:11px;color:#666">' + esc(L.product_sku) + '</span>' : '') +
      '</td>';
    html += '<td>' + esc(L.order_count) + '</td>';
    html += '<td>' + esc(L.quantity) + (L.unit_label ? ' ' + esc(L.unit_label) : '') + '</td>';
    html += '<td>' + (L.has_weight ? esc(Number(L.requested_weight_kg || 0).toFixed(3)) : '—') + '</td>';
    html += '<td>' + (L.actual_weight_kg ? esc(Number(L.actual_weight_kg).toFixed(3)) : '—') + '</td>';
    html += '</tr>';
  });
  html += '</tbody><tfoot><tr><td>Totals</td><td>—</td><td>' + esc(totalQty) + '</td><td>' + esc(totalKg.toFixed(3)) + '</td><td>—</td></tr></tfoot></table></div>';
  if (meta.known_value_label || meta.deposits_label) {
    html += '<div class="notes"><strong>Day totals</strong><br>';
    if (meta.known_value_label) html += 'Known value: ' + esc(meta.known_value_label) + '<br>';
    if (meta.deposits_label) html += 'Deposits collected: ' + esc(meta.deposits_label);
    html += '</div>';
  }
  return html;
}

/** Buy list — what to purchase (not pack). Checkbox column for staff ticking. */
function renderProcurement(supply, business, pickupDate, meta) {
  meta = meta || {};
  var biz = (business && business.business_name) || 'Procurement';
  var lines = supply.lines || [];
  var html = '<div class="head"><p class="biz">' + esc(biz) + '</p>';
  html += '<h1 class="title">Procurement checklist — ' + esc(formatDateLabel(pickupDate)) + '</h1>';
  html +=
    '<p class="sub">' +
    esc(meta.order_count || 0) +
    ' orders · ' +
    esc(lines.length) +
    ' products to source</p></div>';
  html += '<div class="prep"><table><thead><tr>';
  html += '<th style="width:28px">✓</th><th>Product</th><th>Orders</th><th>Buy qty</th><th>Req. kg</th>';
  html += '</tr></thead><tbody>';
  var totalQty = 0;
  var totalKg = 0;
  lines.forEach(function (L) {
    totalQty += Number(L.quantity) || 0;
    if (L.has_weight) totalKg += Number(L.requested_weight_kg) || 0;
    html += '<tr>';
    html += '<td><span class="chk"></span></td>';
    html +=
      '<td><strong>' +
      esc(L.product_name) +
      '</strong>' +
      (L.product_sku ? '<br><span style="font-size:11px;color:#666">' + esc(L.product_sku) + '</span>' : '') +
      '</td>';
    html += '<td>' + esc(L.order_count) + '</td>';
    html += '<td>' + esc(L.quantity) + (L.unit_label ? ' ' + esc(L.unit_label) : '') + '</td>';
    html += '<td>' + (L.has_weight ? esc(Number(L.requested_weight_kg || 0).toFixed(3)) : '—') + '</td>';
    html += '</tr>';
  });
  html +=
    '</tbody><tfoot><tr><td></td><td>Totals</td><td>—</td><td>' +
    esc(totalQty) +
    '</td><td>' +
    esc(totalKg.toFixed(3)) +
    '</td></tr></tfoot></table></div>';
  return html;
}

function renderExceptionsList(orders, business, pickupDate) {
  var { classifyOrderExceptions, filterExceptionOrders, importantTypeLabel } = require('./exceptions');
  var biz = (business && business.business_name) || 'Exceptions';
  var list = filterExceptionOrders(orders || [], 'exceptions');
  list = sortOrdersForPrint(list);
  var html = '<div class="head"><p class="biz">' + esc(biz) + '</p>';
  html += '<h1 class="title">Exceptions — ' + esc(formatDateLabel(pickupDate)) + '</h1>';
  html +=
    '<p class="sub">' +
    esc(list.length) +
    ' order' +
    (list.length === 1 ? '' : 's') +
    ' needing attention (important, notes, unpaid, TBC)</p></div>';
  if (!list.length) {
    html += '<p class="sub">No exception orders for this date.</p>';
    return html;
  }
  html += '<div class="pick-list"><table><thead><tr>';
  html += '<th>Order</th><th>Window</th><th>Customer</th><th>Flags</th><th>Notes</th>';
  html += '</tr></thead><tbody>';
  list.forEach(function (ord) {
    var c = classifyOrderExceptions(ord);
    html += '<tr>';
    html +=
      '<td><strong>' +
      esc(ord.order_number) +
      '</strong><br><span style="font-size:11px;color:#666">' +
      esc(ord.status) +
      '</span></td>';
    html += '<td>' + esc(pickupWindowLabel(ord) || '—') + '</td>';
    html += '<td>' + esc(ord.customer_name || '—') + '</td>';
    html +=
      '<td>' +
      esc(
        c.flags
          .map(function (f) {
            if (f === 'important') return importantTypeLabel(ord);
            return f.replace(/_/g, ' ');
          })
          .join(', ')
      ) +
      '</td>';
    html += '<td>' + esc([ord.customer_notes, c.reasons.join(' · ')].filter(Boolean).join(' / ')) + '</td>';
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

function renderAllocation(supply, business, pickupDate, meta) {
  meta = meta || {};
  var biz = (business && business.business_name) || 'Allocation';
  var groups = supply.allocations || [];
  var totals = supply.allocation_totals || {};
  var html = '<div class="head"><p class="biz">' + esc(biz) + '</p>';
  html += '<h1 class="title">Product allocation — ' + esc(formatDateLabel(pickupDate)) + '</h1>';
  html +=
    '<p class="sub">' +
    esc(meta.order_count || 0) +
    ' orders · ' +
    esc(totals.lines || 0) +
    ' lines · ' +
    esc(totals.packed || 0) +
    ' packed</p></div>';

  if (!groups.length) {
    html += '<p class="sub">No allocation lines for this date.</p>';
    return html;
  }

  groups.forEach(function (g) {
    html += '<div class="prep" style="margin-bottom:18px">';
    html +=
      '<h2 style="font-size:15px;margin:0 0 6px">' +
      esc(g.product_name) +
      (g.variation_label ? ' — ' + esc(g.variation_label) : '') +
      '</h2>';
    html +=
      '<p class="sub" style="margin:0 0 8px">Qty ' +
      esc(g.quantity) +
      (g.unit_label ? ' ' + esc(g.unit_label) : '') +
      (g.has_weight ? ' · ' + esc(Number(g.requested_weight_kg || 0).toFixed(3)) + ' kg req.' : '') +
      ' · ' +
      esc(g.packed_count) +
      '/' +
      esc(g.line_count) +
      ' packed</p>';
    html += '<table><thead><tr>';
    html += '<th>✓</th><th>Customer</th><th>Order</th><th>Qty</th><th>Weight</th><th>Notes</th>';
    html += '</tr></thead><tbody>';
    (g.lines || []).forEach(function (L) {
      var wt =
        L.requested_weight_kg != null
          ? Number(L.requested_weight_kg).toFixed(3) + ' kg'
          : '—';
      var notes = [L.notes, L.customer_notes].filter(Boolean).join(' / ');
      html += '<tr>';
      html +=
        '<td style="width:28px">' +
        (L.packed ? '☑' : '<span class="chk"></span>') +
        '</td>';
      html +=
        '<td>' +
        esc(L.customer_name || '—') +
        (L.is_important ? ' ★' : '') +
        '</td>';
      html += '<td>' + esc(L.order_number || '') + '</td>';
      html += '<td>' + esc(L.quantity) + '</td>';
      html += '<td>' + esc(wt) + '</td>';
      html += '<td>' + esc(notes) + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
  });
  return html;
}

function toolbarHtml(autoprint) {
  return (
    '<div class="no-print">' +
    '<button type="button" onclick="window.print()">Print</button>' +
    '<button type="button" class="ghost" onclick="window.close()">Close</button>' +
  (autoprint ? '<span style="margin-left:8px;color:#666">AirPrint: choose your printer or Save as PDF.</span>' : '') +
    '</div>'
  );
}

/** Important flag on stickers — default on when order is important unless show_on_labels === false. */
function showImportantOnLabel(order) {
  if (!order || !order.is_important) return false;
  var meta = order.important_meta && typeof order.important_meta === 'object' ? order.important_meta : {};
  if (meta.show_on_labels === false) return false;
  return true;
}

function importantLabelReason(order) {
  var meta = order && order.important_meta && typeof order.important_meta === 'object' ? order.important_meta : {};
  return meta.reason ? String(meta.reason).slice(0, 80) : '';
}

function importantLabelColour(order) {
  try {
    var { importantColourHex } = require('./exceptions');
    return importantColourHex(order);
  } catch (_e) {
    return '#c47a00';
  }
}

function importantBadgeText(order) {
  try {
    var { importantTypeLabel } = require('./exceptions');
    var type = importantTypeLabel(order);
    var reason = importantLabelReason(order);
    return type + (reason ? ' — ' + reason : '');
  } catch (_e) {
    return 'Important' + (importantLabelReason(order) ? ' — ' + importantLabelReason(order) : '');
  }
}

function orderItemsSummary(items) {
  return (items || [])
    .slice(0, 4)
    .map(function (it) {
      var bit = (it.quantity != null ? it.quantity + '× ' : '') + (it.product_name || '');
      if (it.requested_weight_kg != null) bit += ' (' + it.requested_weight_kg + 'kg)';
      return bit;
    })
    .join('; ');
}

function renderQrBlock(order) {
  if (order && order.portal_qr_svg) {
    return '<div class="label-qr" aria-hidden="true">' + order.portal_qr_svg + '</div>';
  }
  return '<div class="label-qr" aria-hidden="true"></div>';
}

function renderOrderLabelSticker(order, business) {
  var biz = (business && business.business_name) || 'Order';
  var imp = showImportantOnLabel(order);
  var windowLbl = pickupWindowLabel(order);
  var colour = imp ? importantLabelColour(order) : '';
  var style = imp ? ' style="border-color:' + esc(colour) + ';border-style:solid;box-shadow:inset 0 0 0 1.5px ' + esc(colour) + '"' : '';
  var html =
    '<div class="label-sticker' +
    (imp ? ' important' : '') +
    '"' +
    style +
    '>' +
    '<div class="label-main">';
  html += '<p class="label-biz">' + esc(biz) + '</p>';
  html += '<p class="label-num">' + esc(order.order_number || 'Order') + '</p>';
  html += '<p class="label-cust">' + esc(order.customer_name || '—') + '</p>';
  html +=
    '<p class="label-meta">' +
    esc(formatDateLabel(order.pickup_date)) +
    (windowLbl ? ' · ' + esc(windowLbl) : '') +
    '</p>';
  var summary = orderItemsSummary(order.items || []);
  if (summary) html += '<p class="label-detail">' + esc(summary) + '</p>';
  if (imp) {
    html +=
      '<span class="label-imp" style="background:' +
      esc(colour) +
      '22;color:' +
      esc(colour) +
      '">' +
      esc(importantBadgeText(order)) +
      '</span>';
  }
  html += '</div>' + renderQrBlock(order) + '</div>';
  return html;
}

function renderItemLabelSticker(order, item, business) {
  var biz = (business && business.business_name) || 'Order';
  var imp = showImportantOnLabel(order);
  var windowLbl = pickupWindowLabel(order);
  var optTxt = itemOptionsText(item);
  var colour = imp ? importantLabelColour(order) : '';
  var style = imp ? ' style="border-color:' + esc(colour) + ';border-style:solid;box-shadow:inset 0 0 0 1.5px ' + esc(colour) + '"' : '';
  var html =
    '<div class="label-sticker' +
    (imp ? ' important' : '') +
    '"' +
    style +
    '>' +
    '<div class="label-main">';
  html += '<p class="label-biz">' + esc(biz) + '</p>';
  html += '<p class="label-num">' + esc(order.order_number || 'Order') + '</p>';
  html += '<p class="label-cust">' + esc(order.customer_name || '—') + '</p>';
  html +=
    '<p class="label-meta">' +
    esc(formatDateLabel(order.pickup_date)) +
    (windowLbl ? ' · ' + esc(windowLbl) : '') +
    '</p>';
  html += '<p class="label-item">' + esc(item.product_name || 'Item') + '</p>';
  var parts = [];
  parts.push('Qty ' + (item.quantity != null ? item.quantity : 1));
  if (item.unit_label) parts.push(item.unit_label);
  if (item.requested_weight_kg != null) parts.push(item.requested_weight_kg + ' kg');
  if (optTxt) parts.push(optTxt);
  if (item.notes) parts.push(item.notes);
  html += '<p class="label-detail">' + esc(parts.join(' · ')) + '</p>';
  if (imp) {
    html +=
      '<span class="label-imp" style="background:' +
      esc(colour) +
      '22;color:' +
      esc(colour) +
      '">' +
      esc(importantBadgeText(order)) +
      '</span>';
  }
  html += '</div>' + renderQrBlock(order) + '</div>';
  return html;
}

function renderLabelSheet(orders, business, pickupDate, mode) {
  var biz = (business && business.business_name) || 'Labels';
  var sorted = sortOrdersForPrint(orders || []);
  var title = mode === 'item_labels' ? 'Item stickers' : 'Order labels';
  var html = '<div class="label-sheet-head"><p class="label-biz">' + esc(biz) + '</p>';
  html += '<h1 class="title">' + esc(title) + ' — ' + esc(formatDateLabel(pickupDate)) + '</h1>';
  html +=
    '<p class="sub">' +
    esc(sorted.length) +
    ' order' +
    (sorted.length === 1 ? '' : 's') +
    ' · QR opens customer portal</p></div>';
  html += '<div class="label-sheet">';
  var count = 0;
  if (mode === 'item_labels') {
    sorted.forEach(function (ord) {
      (ord.items || []).forEach(function (it) {
        html += renderItemLabelSticker(ord, it, business);
        count += 1;
      });
    });
  } else {
    sorted.forEach(function (ord) {
      html += renderOrderLabelSticker(ord, business);
      count += 1;
    });
  }
  html += '</div>';
  if (!count) {
    html =
      '<div class="label-sheet-head"><h1 class="title">No labels</h1><p class="sub">No active orders for ' +
      esc(formatDateLabel(pickupDate)) +
      '.</p></div>';
  }
  return html;
}

/**
 * Build a complete printable HTML document.
 * @param {object} payload
 * @param {string} payload.format - slip|receipt|thermal|day_run|prep|pick_list|allocation|label|item_labels
 * @param {object} [payload.business]
 * @param {object} [payload.order]
 * @param {object[]} [payload.items]
 * @param {object[]} [payload.orders] - for day_run / pick_list / labels
 * @param {string} [payload.pickup_date]
 * @param {object} [payload.supply]
 * @param {object} [payload.meta]
 * @param {boolean} [payload.autoprint]
 */
function buildPrintDocument(payload) {
  payload = payload || {};
  var format = payload.format || 'slip';
  var autoprint = !!payload.autoprint;
  var body = '';

  if (format === 'prep') {
    body = renderPrepSummary(payload.supply || {}, payload.business, payload.pickup_date, payload.meta || {});
  } else if (format === 'procurement') {
    body = renderProcurement(payload.supply || {}, payload.business, payload.pickup_date, payload.meta || {});
  } else if (format === 'exceptions') {
    body = renderExceptionsList(payload.orders || [], payload.business, payload.pickup_date);
  } else if (format === 'allocation') {
    body = renderAllocation(payload.supply || {}, payload.business, payload.pickup_date, payload.meta || {});
  } else if (format === 'label' || format === 'item_labels') {
    var labelOrders = payload.orders || [];
    if (!labelOrders.length && payload.order) {
      labelOrders = [Object.assign({}, payload.order, { items: payload.items || payload.order.items || [] })];
    }
    body = renderLabelSheet(
      labelOrders,
      payload.business,
      payload.pickup_date || (payload.order && payload.order.pickup_date),
      format
    );
  } else if (format === 'pick_list') {
    body = renderPickList(payload.orders || [], payload.business, payload.pickup_date);
  } else if (format === 'day_run') {
    var list = sortOrdersForPrint(payload.orders || []);
    list.forEach(function (ord, idx) {
      body += renderOrderBlock(ord, ord.items || [], 'slip', payload.business, {});
      if (idx < list.length - 1) body += '<div class="page-break"></div>';
    });
    if (!list.length) {
      body =
        '<div class="head"><h1 class="title">No orders</h1><p class="sub">No active orders for ' +
        esc(formatDateLabel(payload.pickup_date)) +
        '.</p></div>';
    }
  } else {
    body = renderOrderBlock(payload.order || {}, payload.items || [], format, payload.business, {});
  }

  var script = autoprint
    ? '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},300);});<\/script>'
    : '';

  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Print — ' +
    esc((payload.business && payload.business.business_name) || 'Order') +
    '</title>' +
    printCss(format) +
    '</head><body><div class="doc">' +
    toolbarHtml(autoprint) +
    body +
    '<p class="footer">Printed ' +
    esc(new Date().toLocaleString('en-AU')) +
    '</p></div>' +
    script +
    '</body></html>'
  );
}

function isAllowedFormat(format, isCustomer) {
  var f = String(format || 'slip').toLowerCase();
  if (isCustomer) return CUSTOMER_FORMATS.indexOf(f) >= 0;
  return STAFF_FORMATS.indexOf(f) >= 0;
}

function normaliseFormat(format, isCustomer) {
  var f = String(format || (isCustomer ? 'receipt' : 'slip')).toLowerCase();
  if (!isAllowedFormat(f, isCustomer)) {
    return isCustomer ? 'receipt' : 'slip';
  }
  return f;
}

module.exports = {
  esc,
  formatDateLabel,
  pickupWindowLabel,
  sortOrdersForPrint,
  buildPrintDocument,
  isAllowedFormat,
  normaliseFormat,
  showImportantOnLabel,
  CUSTOMER_FORMATS,
  STAFF_FORMATS
};
