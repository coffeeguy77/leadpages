'use strict';

/**
 * Customer copy — the printable version of the customer's own order page (order-portal.html
 * docket), for staff to print and hand over the counter.
 *
 *   size 'a4'     full page (also AirPrint from an iPad)
 *   size '80mm'   receipt-printer docket
 *
 * Same content as the customer page: shop logo + contact, order number, pickup day/date/time,
 * customer, items with options on one line, $/kg, line prices (ranges until weighed, or $/kg only
 * when the shop has "kg prices only" on), deposit / payments, total or balance, and a QR code
 * to open the order online.
 */

const { formatAud } = require('./money');
const { orderGstSummary } = require('./gst');
const { formatOptionsForPortal } = require('./portal-edit');
const { lineEstimateRange, lineCookingCents } = require('./pricing');
const PD = require('./price-display');
const { ledgerLine } = require('./payment-ledger');

const STATUS_LABELS = {
  draft: 'Draft',
  awaiting_deposit: 'Awaiting deposit',
  confirmed: 'Confirmed',
  changes_open: 'Confirmed',
  locked: 'Confirmed — being prepared',
  in_preparation: 'Being prepared',
  ready: 'Ready for pickup',
  collected: 'Collected',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded'
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function money(c) {
  return formatAud(c);
}

function kgText(n) {
  const v = Number(n);
  if (!isFinite(v)) return '';
  return String(Math.round(v * 1000) / 1000).replace(/\.0+$/, '') + ' kg';
}

function shortDate(iso, tz) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString('en-AU', { timeZone: tz || 'Australia/Sydney', day: 'numeric', month: 'short', year: 'numeric' });
  } catch (_e) {
    return d.toISOString().slice(0, 10);
  }
}

/** Pickup as on the paper docket: Day "Thursday", Date "24 Dec 2026", Time window. */
function pickupParts(o) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String((o && o.pickup_date) || ''));
  const out = { day: '', date: (o && o.pickup_date) || '—', time: '' };
  if (m) {
    const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    out.day = dt.toLocaleDateString('en-AU', { weekday: 'long' });
    out.date = dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  if (o && o.pickup_window_start && o.pickup_window_end) {
    out.time = String(o.pickup_window_start).slice(0, 5) + '–' + String(o.pickup_window_end).slice(0, 5);
  } else if (o && o.pickup_time) out.time = String(o.pickup_time).slice(0, 5);
  return out;
}

function splitName(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { first: parts[0] || '', last: '' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

/** Items shaped like the customer page gets them (options text, ranges, kg-only). */
function shapeItems(system, items, answerRows) {
  const shaped = (items || []).map(function (it) {
    return Object.assign({}, it, {
      selected_options: formatOptionsForPortal(it, answerRows || []),
      est_range: lineEstimateRange(it),
      cooking_cents: lineCookingCents(it)
    });
  });
  return PD.applyKgOnly(system, shaped);
}

function lineCells(it, narrow) {
  const perKg = it.pricing_method === 'per_weight' || it.pricing_method === 'price_tbc';
  const q = Number(it.quantity) || 1;
  const qty =
    it.actual_weight_kg != null
      ? kgText(it.actual_weight_kg)
      : it.requested_weight_kg != null && perKg && !(q > 1)
        ? '~' + kgText(it.requested_weight_kg)
        : String(q).replace(/\.0+$/, '') + 'x';
  const rate = it.unit_price_cents != null && it.unit_price_cents > 0 ? money(it.unit_price_cents) + (perKg ? '/kg' : ' ea') : '';
  const er = it.est_range;
  let amt;
  if (it.line_final_cents != null) amt = esc(money(it.line_final_cents));
  else if (it.kg_only_rate) amt = '<span class="cc-muted">when weighed</span>';
  else if (er) amt = '<span class="cc-muted">est.</span> ' + esc(money(er.low_cents)) + '–' + (narrow ? '<br>' : '') + esc(money(er.high_cents));
  else if (it.price_status === 'tbc' || it.price_status === 'quote_required') amt = '<span class="cc-muted">TBC</span>';
  else if (it.line_known_cents != null) amt = esc(money(it.line_known_cents)) + (it.price_status === 'estimated' ? ' <span class="cc-muted">est.</span>' : '');
  else amt = '';
  const subs = [];
  if ((it.selected_options || []).length) subs.push(esc(it.selected_options.join(' · ')));
  if (it.notes) subs.push('<em>' + esc(it.notes) + '</em>');
  if (it.cooking_cents) subs.push('Includes cooking ' + esc(money(it.cooking_cents)) + (it.actual_weight_kg == null ? ' (est.)' : ''));
  else if (er && er.per_kg_extra_high_cents) subs.push('Includes cooking est. ' + esc(money(er.per_kg_extra_low_cents)) + '–' + esc(money(er.per_kg_extra_high_cents)));
  if (er) subs.push('Final price when weighed (' + esc(er.low_kg) + '–' + esc(er.high_kg) + ' kg)');
  else if (it.kg_only_rate) subs.push('Priced when weighed');
  return { qty: qty, rate: rate, amt: amt, subs: subs };
}

function css(size) {
  const narrow = size === '80mm';
  return (
    '<style>' +
    (narrow ? '@page{margin:3mm 2mm;size:80mm auto}' : '@page{margin:12mm;size:A4 portrait}') +
    '*{box-sizing:border-box}' +
    'html,body{margin:0;padding:0;background:#fff;color:#1a1f1c;font-family:"DM Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.cc{max-width:' + (narrow ? '76mm' : '190mm') + ';margin:0 auto;padding:' + (narrow ? '2mm 1mm 4mm' : '0') + '}' +
    '.no-print{margin:10px auto 14px;max-width:' + (narrow ? '76mm' : '190mm') + ';padding:10px 12px;background:#f4f1eb;border:1px solid #ddd6cb;border-radius:8px;font:13px system-ui,sans-serif}' +
    '.no-print button{margin-right:8px;padding:8px 12px;border:1px solid #1f5c3a;background:#1f5c3a;color:#fff;border-radius:8px;font:inherit;font-weight:700;cursor:pointer}' +
    '.no-print a{color:#1f5c3a;font-weight:600}' +
    '@media print{.no-print{display:none!important}}' +
    '.cc-head{display:flex;justify-content:space-between;gap:' + (narrow ? '6px' : '16px') + ';align-items:flex-start;margin-bottom:' + (narrow ? '8px' : '16px') + (narrow ? ';flex-direction:column' : '') + '}' +
    '.cc-logo{display:block;max-width:' + (narrow ? '60mm' : '240px') + ';max-height:' + (narrow ? '22mm' : '90px') + ';width:auto;height:auto;object-fit:contain;' + (narrow ? 'filter:grayscale(1)' : '') + '}' +
    '.cc-biz{margin:0;font-family:Fraunces,Georgia,serif;font-size:' + (narrow ? '18px' : '26px') + ';font-weight:600}' +
    '.cc-contact{margin:4px 0 0;font-size:' + (narrow ? '11px' : '12px') + ';color:#5c675f}' +
    '.cc-numbox{border:2px solid #1a1f1c;padding:' + (narrow ? '5px 8px' : '8px 12px') + ';min-width:' + (narrow ? '0' : '170px') + ';text-align:center' + (narrow ? ';align-self:stretch' : '') + '}' +
    '.cc-num{font-family:Fraunces,Georgia,serif;font-size:' + (narrow ? '20px' : '24px') + ';font-weight:700;color:' + (narrow ? '#000' : '#b42318') + ';letter-spacing:.02em;line-height:1.1}' +
    '.cc-date{margin-top:4px;font-size:12px}.cc-date b{font-size:10px;letter-spacing:.06em}' +
    '.cc-state{margin-top:4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#1f5c3a}' +
    '.cc-fields{margin:0 0 ' + (narrow ? '8px' : '14px') + '}' +
    '.cc-line{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 8px;padding:' + (narrow ? '5px 0' : '8px 0') + ';border-bottom:1px solid #9b9b9b}' +
    '.cc-tag{border:1.5px solid #1a1f1c;padding:1px 6px;font-weight:700;font-size:11px;letter-spacing:.04em}' +
    '.cc-lbl{font-size:12px;color:#3b3b3b}' +
    '.cc-val{font-size:' + (narrow ? '13px' : '16px') + ';font-weight:600;margin-right:10px}' +
    '.cc-grow{flex:1 1 ' + (narrow ? '60px' : '120px') + '}' +
    'table.cc-table{width:100%;border-collapse:collapse;font-size:' + (narrow ? '12px' : '14px') + ';border:1.5px solid #1a1f1c}' +
    '.cc-table th{background:#2f2f2f;color:#fff;font-weight:600;font-size:' + (narrow ? '11px' : '13px') + ';padding:' + (narrow ? '4px 5px' : '7px 8px') + ';text-align:left}' +
    '.cc-table td{border-top:1px solid #9b9b9b;padding:' + (narrow ? '5px' : '9px 8px') + ';vertical-align:top}' +
    '.cc-table .q{width:' + (narrow ? '44px' : '84px') + ';white-space:nowrap;font-weight:600}' +
    '.cc-table .r{text-align:right;white-space:nowrap}' +
    '.cc-item{font-weight:700;display:block}' +
    '.cc-sub{display:block;font-size:' + (narrow ? '11px' : '12px') + ';color:#3b3b3b;margin-top:2px;line-height:1.35}' +
    '.cc-muted{color:#5c675f;font-size:.9em}' +
    '.cc-foot{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-top:' + (narrow ? '8px' : '14px') + (narrow ? ';flex-direction:column;align-items:stretch' : '') + '}' +
    '.cc-pay{font-size:' + (narrow ? '12px' : '13px') + '}.cc-pay b{display:block;margin-bottom:2px}' +
    '.cc-pay table{border-collapse:collapse}.cc-pay td{padding:1px 10px 1px 0}' +
    '.cc-total{display:flex;flex-direction:column;align-items:' + (narrow ? 'stretch' : 'flex-end') + '}' +
    '.cc-total-box{display:flex;align-items:center;gap:10px;border:2px solid #1a1f1c;min-width:150px;min-height:' + (narrow ? '36px' : '46px') + ';padding:4px 10px}' +
    '.cc-total-box span{font-weight:700;font-size:16px}.cc-total-box strong{font-size:' + (narrow ? '18px' : '22px') + ';margin-left:auto}' +
    '.cc-total-lbl{margin-top:4px;font-size:10px;font-weight:800;letter-spacing:.04em;text-align:' + (narrow ? 'left' : 'right') + ';line-height:1.3}' +
    '.cc-note{margin:8px 0 0;font-size:' + (narrow ? '11px' : '13px') + ';line-height:1.4}' +
    '.cc-qr{display:flex;gap:10px;align-items:center;margin-top:' + (narrow ? '10px' : '16px') + ';font-size:' + (narrow ? '11px' : '12px') + ';color:#3b3b3b' + (narrow ? ';flex-direction:column;text-align:center' : '') + '}' +
    '.cc-qr svg{width:' + (narrow ? '26mm' : '24mm') + ';height:' + (narrow ? '26mm' : '24mm') + ';flex:0 0 auto}' +
    '.cc-sign{margin-top:' + (narrow ? '12px' : '22px') + ';padding-top:6px;border-top:1px solid #1a1f1c;font-size:12px;text-align:center;color:#3b3b3b}' +
    '.cc-thanks{margin:6px 0 0;text-align:center;font-weight:700;font-size:' + (narrow ? '13px' : '14px') + '}' +
    '</style>'
  );
}

/**
 * @param {object} p
 * @param {object} p.system
 * @param {object} p.order
 * @param {object[]} p.items
 * @param {object[]} [p.answer_rows]
 * @param {object[]} [p.payments]   order_payments rows
 * @param {object} [p.business]     { business_name, logo_url, phone, email }
 * @param {string} [p.size]         'a4' | '80mm'
 * @param {boolean} [p.autoprint]
 * @param {string} [p.other_size_url]  link to the other paper size (toolbar)
 */
function buildCustomerCopy(p) {
  p = p || {};
  const size = p.size === '80mm' ? '80mm' : 'a4';
  const narrow = size === '80mm';
  const o = p.order || {};
  const bz = p.business || {};
  const biz = bz.business_name || 'Your order';
  const tz = (p.system && p.system.timezone) || 'Australia/Sydney';
  const items = shapeItems(p.system, p.items || [], p.answer_rows || []);
  const kgOnly = PD.kgPricesOnly(p.system);

  let h = '<article class="cc">';
  h += '<header class="cc-head"><div>';
  h += bz.logo_url ? '<img class="cc-logo" src="' + esc(bz.logo_url) + '" alt="' + esc(biz) + '">' : '<p class="cc-biz">' + esc(biz) + '</p>';
  const contact = [bz.phone, bz.email].filter(Boolean).map(esc).join(' · ');
  if (contact) h += '<p class="cc-contact">' + contact + '</p>';
  h += '</div><div class="cc-numbox"><div class="cc-num">' + esc(o.order_number || '') + '</div>';
  h += '<div class="cc-date"><b>DATE:</b> ' + esc(shortDate(o.created_at, tz)) + '</div>';
  h += '<div class="cc-state">' + esc(STATUS_LABELS[o.status] || String(o.status || '').replace(/_/g, ' ')) + '</div></div>';
  h += '</header>';

  const pk = pickupParts(o);
  const nm = splitName(o.customer_name);
  h += '<div class="cc-fields">';
  if (narrow) {
    // Narrow docket: one line each, no label/value wrapping.
    h += '<div class="cc-line"><span class="cc-tag">' + (o.fulfilment_type === 'delivery' ? 'DELIVERY:' : 'PICK UP:') + '</span>' +
      '<span class="cc-val">' + esc([pk.day, pk.date, pk.time].filter(Boolean).join(' ')) + '</span></div>';
    h += '<div class="cc-line"><span class="cc-lbl">Name:</span><span class="cc-val">' + esc(o.customer_name || '') + '</span></div>';
    if (o.customer_phone) h += '<div class="cc-line"><span class="cc-lbl">Phone:</span><span class="cc-val">' + esc(o.customer_phone) + '</span></div>';
  } else {
  h += '<div class="cc-line"><span class="cc-tag">' + (o.fulfilment_type === 'delivery' ? 'DELIVERY DATE:' : 'PICK UP DATE:') + '</span>' +
    (pk.day ? '<span class="cc-lbl">Day:</span><span class="cc-val">' + esc(pk.day) + '</span>' : '') +
    '<span class="cc-lbl">Date:</span><span class="cc-val">' + esc(pk.date) + '</span>' +
    (pk.time ? '<span class="cc-lbl">Time:</span><span class="cc-val">' + esc(pk.time) + '</span>' : '') + '</div>';
  h += '<div class="cc-line"><span class="cc-lbl">Surname:</span><span class="cc-val cc-grow">' + esc(nm.last) + '</span>' +
    '<span class="cc-lbl">First name:</span><span class="cc-val cc-grow">' + esc(nm.first) + '</span></div>';
  if (o.customer_phone) h += '<div class="cc-line"><span class="cc-lbl">Phone:</span><span class="cc-val cc-grow">' + esc(o.customer_phone) + '</span></div>';
  if (o.customer_email) h += '<div class="cc-line"><span class="cc-lbl">Email:</span><span class="cc-val cc-grow">' + esc(o.customer_email) + '</span></div>';
  }
  h += '</div>';

  h += '<table class="cc-table"><thead><tr><th class="q">' + (narrow ? 'Qty' : 'Quantity') + '</th><th>Order</th>' +
    (narrow ? '' : '<th class="r">$/kg</th>') + '<th class="r">$</th></tr></thead><tbody>';
  items.forEach(function (it) {
    const c = lineCells(it, narrow);
    h += '<tr><td class="q">' + esc(c.qty) + '</td><td><span class="cc-item">' + esc(it.product_name) + '</span>' +
      (narrow && c.rate ? '<span class="cc-sub">' + esc(c.rate) + '</span>' : '') +
      c.subs.map(function (s) { return '<span class="cc-sub">' + s + '</span>'; }).join('') +
      '</td>' + (narrow ? '' : '<td class="r">' + esc(c.rate) + '</td>') + '<td class="r">' + c.amt + '</td></tr>';
  });
  if (!items.length) h += '<tr><td></td><td colspan="' + (narrow ? 2 : 3) + '">No items.</td></tr>';
  if (o.customer_notes) h += '<tr><td></td><td colspan="' + (narrow ? 2 : 3) + '"><em>' + esc(o.customer_notes) + '</em></td></tr>';
  h += '</tbody></table>';

  // Payments received (deposit, part payments) — what the customer has paid so far.
  const paid = (p.payments || [])
    .map(function (row) { return ledgerLine(row, tz); })
    .filter(function (l) { return l.status === 'received' && l.amount_cents > 0; });
  const total = o.final_subtotal_cents != null ? money(o.final_subtotal_cents)
    : (!o.has_unknown_prices && o.known_subtotal_cents != null) ? money(o.known_subtotal_cents) : '';
  const gst = orderGstSummary(p.items || []);

  h += '<div class="cc-foot"><div class="cc-pay">';
  if (paid.length) {
    h += '<b>Paid</b><table>' + paid.map(function (l) {
      return '<tr><td>' + esc(l.date ? shortDate(l.date + 'T12:00:00', tz) : '') + '</td><td>' + esc(l.method_label) + '</td><td class="r">' + esc(money(l.amount_cents)) + '</td></tr>';
    }).join('') + '</table>';
  } else if ((o.deposit_required_cents || 0) > 0) {
    h += '<b>Deposit</b>' + esc(money(o.deposit_required_cents)) + ' due';
  } else {
    h += '<b>Deposit</b>none';
  }
  if (gst.gst_included_cents > 0) h += '<div class="cc-muted" style="margin-top:4px">Includes GST ' + esc(money(gst.gst_included_cents)) + '</div>';
  h += '</div>';
  h += '<div class="cc-total"><div class="cc-total-box"><span>$</span><strong>' + (total ? esc(total.replace(/^\$/, '')) : '') + '</strong></div>' +
    '<div class="cc-total-lbl">TOTAL PAYABLE<br>INCLUDING GST</div></div>';
  h += '</div>';

  const depPaid = (o.deposit_paid_cents || 0) > 0;
  if (!total) {
    h += '<p class="cc-note">' + (kgOnly ? 'Weighed items are priced at the $/kg shown once they’re prepared' : 'Weighed items are priced once they’re prepared') +
      ' — your total is confirmed at pickup' + (depPaid ? ' (less what you’ve paid)' : '') + '.</p>';
  } else if (depPaid) {
    h += '<p class="cc-note">Balance at pickup: <strong>' + esc(o.balance_cents != null ? money(o.balance_cents) : 'TBC') + '</strong></p>';
  }

  if (o.portal_qr_svg) {
    h += '<div class="cc-qr">' + o.portal_qr_svg + '<span>Scan to see your order online' +
      ((o.deposit_required_cents || 0) > (o.deposit_paid_cents || 0) ? ' or pay your deposit' : '') + '.</span></div>';
  }
  h += '<div class="cc-sign">For and on behalf of ' + esc(biz) + '</div>';
  h += '<p class="cc-thanks">Thank you for your order</p>';
  h += '</article>';

  const toolbar = '<div class="no-print"><button type="button" onclick="window.print()">Print</button>' +
    (p.other_size_url ? '<a href="' + esc(p.other_size_url) + '">' + (narrow ? 'A4 page instead' : 'Receipt printer (80mm) instead') + '</a>' : '') +
    '</div>';
  const script = p.autoprint
    ? '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},400);});<\/script>'
    : '';
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Customer copy — ' + esc(o.order_number || '') + ' — ' + esc(biz) + '</title>' +
    '<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet">' +
    css(size) + '</head><body>' + toolbar + h + script + '</body></html>'
  );
}

module.exports = { buildCustomerCopy, shapeItems, lineCells, pickupParts, splitName };
