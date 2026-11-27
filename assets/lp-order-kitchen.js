/* Kitchen (cooked orders) view for orders.html — Order Operations → Kitchen.
 * Host (orders.html) provides window.LpKitchenHost = { api, esc, toast, siteQuery, siteId, businessName, openOrder, fmt }.
 * Data: GET/POST /api/order/kitchen (see api/order/kitchen.js).
 */
(function () {
  'use strict';

  var K = { data: null, showDone: true, range: 'upcoming', busy: false };

  function H() { return window.LpKitchenHost || {}; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return H().esc ? H().esc(s) : String(s == null ? '' : s); }
  function money(c) { return c == null ? '' : '$' + (Number(c) / 100).toFixed(2); }
  function kg(n) { return n == null ? '' : (Math.round(Number(n) * 100) / 100) + ' kg'; }

  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dayLabel(ymd, long) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd))) return 'No pickup date';
    var d = new Date(ymd + 'T00:00:00');
    return (long ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()] : DOW[d.getDay()]) + ' ' + d.getDate() + ' ' + MON[d.getMonth()];
  }
  function t12(t) {
    if (!t) return '';
    var m = /^(\d{2}):(\d{2})/.exec(t); if (!m) return t;
    var h = Number(m[1]); var ap = h >= 12 ? 'pm' : 'am'; var h12 = h % 12 || 12;
    return h12 + (m[2] === '00' ? '' : ':' + m[2]) + ap;
  }
  function weightText(r) {
    if (!r.weight_kg) return 'Weight unknown';
    if (r.weight_basis === 'weighed') return kg(r.weight_kg) + ' weighed';
    if (r.weight_basis === 'requested') return '≈' + kg(r.weight_kg) + ' asked';
    if (r.weight_basis === 'size' && r.weight_low) return r.weight_low + '–' + r.weight_high + ' kg';
    return '≈' + kg(r.weight_kg);
  }

  function rangeQuery() {
    var today = (K.data && K.data.today) || new Date().toISOString().slice(0, 10);
    var sel = $('kt-range') ? $('kt-range').value : 'upcoming';
    K.range = sel;
    if (sel === 'date') {
      var d = $('kt-date') && $('kt-date').value;
      if (d) return 'from=' + d + '&to=' + d;
    }
    if (sel === 'past') return 'from=' + addDays(today, -60) + '&to=' + addDays(today, -1);
    return '';
  }
  function addDays(ymd, n) { var d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

  async function load() {
    var host = H();
    if (!host.siteId || !host.siteId()) return;
    var wrap = $('kt-days');
    if (wrap) wrap.innerHTML = '<p class="notice">Loading the kitchen…</p>';
    try {
      var q = rangeQuery();
      K.data = await host.api('/api/order/kitchen?' + host.siteQuery(q));
      render();
    } catch (e) {
      if (wrap) wrap.innerHTML = '<p class="notice err">Couldn’t load the kitchen: ' + esc(e.message) + '</p>';
    }
  }

  function render() {
    var d = K.data || { board: { days: [], check: [], totals: {} } };
    var b = d.board;
    var days = (b.days || []).filter(function (x) { return x.date !== 'no-date' || x.items.length; });
    // KPIs
    var next = null;
    days.some(function (day) {
      return day.items.some(function (r) { if (!r.done && !day.is_past) { next = { day: day.date, time: r.pickup_time }; return true; } return false; });
    });
    var kp = $('kt-kpis');
    if (kp) {
      kp.innerHTML =
        kpi('To cook', (b.totals.units - b.totals.done) + '') +
        kpi('Done', b.totals.done + ' of ' + b.totals.units) +
        kpi('Total weight', b.totals.kg ? '≈' + b.totals.kg + ' kg' : '—') +
        kpi('Cooking value', b.totals.cooking_value_cents ? money(b.totals.cooking_value_cents) : '—') +
        kpi('Next due', next ? dayLabel(next.day) + (next.time ? ' ' + t12(next.time) : '') : '—');
    }
    // Uncharged banner
    var ub = $('kt-uncharged');
    if (ub) {
      if (d.uncharged > 0) {
        ub.classList.remove('hide');
        ub.innerHTML = '<div><strong>' + d.uncharged + ' upcoming cooked/glazed item' + (d.uncharged === 1 ? '' : 's') + ' aren’t charged for cooking yet.</strong> ' +
          'Charging adds the cooking rate per kg (with the minimum) to those order lines and updates each order’s total.</div>' +
          '<div class="kt-ub-btns"><button type="button" class="btn ghost" data-kt="charge-preview">Preview</button>' +
          '<button type="button" class="btn solid" data-kt="charge-apply">Charge cooking on these</button></div>';
      } else {
        ub.classList.add('hide');
        ub.innerHTML = '';
      }
    }
    // Check these
    var ck = $('kt-check');
    if (ck) {
      var list = b.check || [];
      if (!list.length) { ck.classList.add('hide'); ck.innerHTML = ''; }
      else {
        ck.classList.remove('hide');
        ck.innerHTML = '<h4 class="kt-h4">Check these — a note mentions cooking (' + list.length + ')</h4>' +
          list.map(function (c) {
            return '<div class="kt-check-row">' +
              '<div class="kt-check-main"><strong>' + esc(c.product_name) + '</strong> × ' + c.quantity +
              ' <span class="kt-muted">· ' + esc(c.order_number) + ' · ' + esc(c.customer_name) + ' · ' + esc(dayLabel(c.pickup_date)) + (c.pickup_time ? ' ' + t12(c.pickup_time) : '') + '</span>' +
              '<div class="kt-note">“' + esc(String(c.note).slice(0, 220)) + '”</div></div>' +
              '<div class="kt-check-btns">' +
              '<button type="button" class="btn solid" data-kt="add" data-id="' + esc(c.item_id) + '">Mark cooked</button>' +
              '<button type="button" class="btn ghost" data-kt="dismiss" data-id="' + esc(c.item_id) + '">Not cooking</button>' +
              '<button type="button" class="btn ghost" data-kt="open" data-order="' + esc(c.order_id) + '">Open order</button></div></div>';
          }).join('');
      }
    }
    // Days
    var wrap = $('kt-days');
    if (!wrap) return;
    if (!days.length) {
      wrap.innerHTML = '<p class="empty">No cooked orders in this range.</p>';
      return;
    }
    wrap.innerHTML = days.map(renderDay).join('');
  }

  function kpi(l, v) { return '<div class="kpi"><p class="l">' + esc(l) + '</p><p class="v">' + esc(v) + '</p></div>'; }

  function renderDay(day) {
    var s = day.summary;
    var head = '<div class="kt-day-head">' +
      '<div><h3 class="kt-day-title">' + esc(dayLabel(day.date, true)) + (day.is_today ? ' <span class="kt-tag kt-today">Today</span>' : '') + (day.is_past ? ' <span class="kt-tag">Past</span>' : '') + '</h3>' +
      '<p class="kt-day-meta">' + s.units + ' item' + (s.units === 1 ? '' : 's') + ' · <strong>' + s.to_do + ' to cook</strong>' +
      (s.kg ? ' · ≈' + s.kg + ' kg' + (s.kg_complete ? '' : ' +') : '') +
      (s.cooking_value_cents ? ' · cooking ' + money(s.cooking_value_cents) : '') +
      (s.earliest_pickup ? ' · first pickup ' + t12(s.earliest_pickup) : '') +
      (s.first_in_oven ? ' · first in the oven by <strong>' + t12(s.first_in_oven) + '</strong>' : '') + '</p></div>' +
      '<div class="kt-day-btns"><button type="button" class="btn ghost" data-kt="print-day" data-day="' + esc(day.date) + '">Print list</button>' +
      '<button type="button" class="btn ghost" data-kt="stickers-day" data-day="' + esc(day.date) + '">Print stickers</button></div></div>';
    var summary = '<div class="kt-kinds">' + s.kinds.map(function (k) {
      return '<div class="kt-kind"><div class="kt-kind-top"><span class="kt-kind-n">' + k.units + '</span> <span class="kt-kind-name">' + esc(k.kind) + '</span>' +
        (k.kg ? '<span class="kt-muted"> · ≈' + k.kg + ' kg</span>' : '') + '</div>' +
        '<ul class="kt-vars">' + k.variants.map(function (v) {
          return '<li><strong>' + v.units + ' ×</strong> ' + esc(v.variant) +
            (v.options.length ? ' <span class="kt-muted">(' + v.options.map(function (o) { return esc(o.label) + ' ' + o.units; }).join(', ') + ')</span>' : '') + '</li>';
        }).join('') + '</ul></div>';
    }).join('') + '</div>';
    var rows = day.items.filter(function (r) { return K.showDone || !r.done; }).map(renderItem).join('');
    return '<section class="card kt-day' + (day.is_past ? ' kt-past' : '') + '">' + head + summary +
      '<div class="kt-items">' + (rows || '<p class="kt-muted" style="margin:8px 0">All done for this day.</p>') + '</div></section>';
  }

  function renderItem(r) {
    var opts = r.options.filter(function (o) { return r.cook_labels.indexOf(o) < 0; });
    return '<div class="kt-item' + (r.done ? ' done' : '') + (r.important ? ' imp' : '') + '">' +
      '<button type="button" class="kt-tick" data-kt="tick" data-id="' + esc(r.item_id) + '" data-done="' + (r.done ? '1' : '0') + '" aria-pressed="' + (r.done ? 'true' : 'false') + '" aria-label="' + (r.done ? 'Mark not done' : 'Mark done') + '">' + (r.done ? '✓' : '') + '</button>' +
      '<div class="kt-when"><strong>' + (r.pickup_time ? esc(t12(r.pickup_time)) : '—') + '</strong>' +
      (r.oven_by ? '<span class="kt-oven">oven by ' + esc(t12(r.oven_by)) + (r.oven_day_before ? ' (day before)' : '') + '</span>' : '') + '</div>' +
      '<div class="kt-what"><div class="kt-prod">' + (r.quantity > 1 ? r.quantity + ' × ' : '') + esc(r.product_name) +
      ' <span class="kt-cook">' + esc(r.cook_labels.join(', ') || 'Cooked') + '</span></div>' +
      '<div class="kt-sub">' + esc(weightText(r)) + (opts.length ? ' · ' + esc(opts.join(', ')) : '') +
      (r.cooking_value_cents ? ' · cooking ' + money(r.cooking_value_cents) : (r.charged ? '' : ' · <span class="kt-warn">not charged</span>')) + '</div>' +
      (r.notes ? '<div class="kt-note">“' + esc(r.notes.slice(0, 240)) + '”</div>' : '') +
      '<div class="kt-sub kt-muted">' + esc(r.order_number) + ' · ' + esc(r.customer_name) + (r.customer_phone ? ' · ' + esc(r.customer_phone) : '') +
      (r.done && r.done_by ? ' · done ' + esc(new Date(r.done_at).toLocaleString('en-AU', { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' })) : '') + '</div></div>' +
      '<div class="kt-acts"><button type="button" class="btn ghost" data-kt="sticker" data-id="' + esc(r.item_id) + '">Sticker</button>' +
      '<button type="button" class="btn ghost" data-kt="open" data-order="' + esc(r.order_id) + '">Order</button>' +
      (r.source === 'staff' ? '<button type="button" class="btn ghost" data-kt="remove" data-id="' + esc(r.item_id) + '">Remove</button>' : '') +
      '</div></div>';
  }

  function findItem(id) {
    var out = null;
    ((K.data && K.data.board.days) || []).some(function (d) {
      return d.items.some(function (r) { if (r.item_id === id) { out = r; return true; } return false; });
    });
    return out;
  }

  async function post(body) {
    var host = H();
    return host.api('/api/order/kitchen', { method: 'POST', body: Object.assign({ site_id: host.siteId() }, body) });
  }

  /* ---------- printing ---------- */
  var PRINT_CSS = '@page{size:A4 portrait;margin:10mm}*{box-sizing:border-box}body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#111;background:#fff;margin:0;font-size:12px}' +
    '.np{margin:0 0 12px;padding:10px 12px;background:#f4f1eb;border:1px solid #ddd6cb;border-radius:8px}.np button{padding:8px 14px;border:1px solid #1f5c3a;background:#1f5c3a;color:#fff;border-radius:8px;font:inherit;font-weight:600;cursor:pointer}' +
    '@media print{.np{display:none}}' +
    'h1{font-size:20px;margin:0 0 2px}h2{font-size:15px;margin:16px 0 4px;border-bottom:2px solid #111;padding-bottom:3px;page-break-after:avoid}.meta{color:#444;margin:0 0 8px}' +
    '.sum{display:flex;flex-wrap:wrap;gap:6px 18px;margin:4px 0 8px}.sum div{font-size:12px}' +
    'table{width:100%;border-collapse:collapse}th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#555;border-bottom:1px solid #999;padding:4px}' +
    'td{border-bottom:1px solid #ddd;padding:6px 4px;vertical-align:top}tr{page-break-inside:avoid}.box{width:16px;height:16px;border:2px solid #111;border-radius:3px;display:inline-block}.box.on{background:#111}' +
    '.n{color:#444;font-style:italic}.b{font-weight:700}' +
    '.sheet{display:flex;flex-wrap:wrap;gap:3mm;align-content:flex-start}' +
    '.st{width:92mm;height:48mm;border:1px dashed #bbb;border-radius:2mm;padding:2.5mm 3mm;overflow:hidden;page-break-inside:avoid;break-inside:avoid;display:flex;flex-direction:column;gap:1px}' +
    '.st-biz{font-size:9px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#1f5c3a;margin:0}' +
    '.st-cook{font-size:17px;font-weight:900;letter-spacing:.04em;margin:0;line-height:1.1}' +
    '.st-prod{font-size:12px;font-weight:700;margin:1px 0 0;line-height:1.2}.st-d{font-size:10px;margin:0;line-height:1.25;color:#222}' +
    '.st-foot{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;gap:6px}.st-num{font-size:14px;font-weight:900}.st-who{font-size:12px;font-weight:700}.st-keep{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}';

  function openPrint(title, body) {
    var w = window.open('', '_blank');
    if (!w) { if (H().toast) H().toast('Allow pop-ups to print', 'err'); return; }
    w.document.open();
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' + PRINT_CSS + '</style></head><body>' +
      '<div class="np"><button onclick="window.print()">Print</button> <span>Tip: for stickers use your 92 × 48 mm label sheets (same as order labels).</span></div>' + body + '</body></html>');
    w.document.close();
    setTimeout(function () { try { w.focus(); w.print(); } catch (_e) {} }, 400);
  }

  function daysFor(date) {
    var days = (K.data && K.data.board.days) || [];
    return date ? days.filter(function (d) { return d.date === date; }) : days.filter(function (d) { return !d.is_past; });
  }

  function printList(date) {
    var biz = H().businessName ? H().businessName() : '';
    var days = daysFor(date);
    var html = '<h1>Kitchen list' + (biz ? ' — ' + esc(biz) : '') + '</h1><p class="meta">Printed ' + esc(new Date().toLocaleString('en-AU')) + '</p>';
    days.forEach(function (day) {
      var s = day.summary;
      html += '<h2>' + esc(dayLabel(day.date, true)) + ' — ' + s.units + ' item' + (s.units === 1 ? '' : 's') + (s.kg ? ', ≈' + s.kg + ' kg' : '') + (s.first_in_oven ? ', first in the oven by ' + t12(s.first_in_oven) : '') + '</h2>';
      html += '<div class="sum">' + s.kinds.map(function (k) {
        return '<div><span class="b">' + k.units + ' ' + esc(k.kind) + '</span>: ' + k.variants.map(function (v) {
          return v.units + ' × ' + esc(v.variant) + (v.options.length ? ' (' + v.options.map(function (o) { return esc(o.label) + ' ' + o.units; }).join(', ') + ')' : '');
        }).join('; ') + '</div>';
      }).join('') + '</div>';
      html += '<table><thead><tr><th style="width:26px">✓</th><th>Pickup</th><th>Item</th><th>Weight</th><th>Order</th><th>Notes</th></tr></thead><tbody>' +
        day.items.map(function (r) {
          var opts = r.options.filter(function (o) { return r.cook_labels.indexOf(o) < 0; });
          return '<tr><td><span class="box' + (r.done ? ' on' : '') + '"></span></td>' +
            '<td class="b">' + esc(t12(r.pickup_time) || '—') + (r.oven_by ? '<br><span class="n">oven ' + esc(t12(r.oven_by)) + '</span>' : '') + '</td>' +
            '<td><span class="b">' + (r.quantity > 1 ? r.quantity + ' × ' : '') + esc(r.product_name) + '</span><br>' + esc(r.cook_labels.join(', ')) + (opts.length ? ' · ' + esc(opts.join(', ')) : '') + '</td>' +
            '<td>' + esc(weightText(r)) + '</td>' +
            '<td>' + esc(r.order_number) + '<br>' + esc(r.customer_name) + '</td>' +
            '<td class="n">' + esc((r.notes || '').slice(0, 160)) + '</td></tr>';
        }).join('') + '</tbody></table>';
    });
    if (!days.length) html += '<p>No cooked orders.</p>';
    openPrint('Kitchen list', html);
  }

  function sticker(r) {
    var biz = H().businessName ? H().businessName() : '';
    var opts = r.options.filter(function (o) { return r.cook_labels.indexOf(o) < 0; });
    var out = '';
    for (var i = 0; i < Math.max(1, Math.min(20, Math.round(r.quantity) || 1)); i++) {
      out += '<div class="st">' + (biz ? '<p class="st-biz">' + esc(biz) + '</p>' : '') +
        '<p class="st-cook">' + esc((r.cook_labels[0] || 'Cooked').toUpperCase()) + '</p>' +
        '<p class="st-prod">' + esc(r.product_name) + '</p>' +
        '<p class="st-d">' + esc(r.weight_basis === 'weighed' ? kg(r.weight_kg) : weightText(r)) + (opts.length ? ' · ' + esc(opts.join(', ')) : '') + '</p>' +
        '<p class="st-d">Pickup ' + esc(dayLabel(r.pickup_date)) + (r.pickup_time ? ' ' + esc(t12(r.pickup_time)) : '') + (r.quantity > 1 ? ' · ' + (i + 1) + ' of ' + r.quantity : '') + '</p>' +
        '<div class="st-foot"><div><div class="st-who">' + esc(r.customer_name) + '</div><div class="st-num">' + esc(r.order_number) + '</div></div>' +
        '<div class="st-keep">Keep refrigerated</div></div></div>';
    }
    return out;
  }

  /** Sticker data for assets/lp-labels.js (size + printer from Settings → Labels & Printers → Kitchen). */
  function labelStickers(r) {
    var biz = H().businessName ? H().businessName() : '';
    var opts = r.options.filter(function (o) { return r.cook_labels.indexOf(o) < 0; });
    var out = [];
    var q = Math.max(1, Math.min(20, Math.round(r.quantity) || 1));
    for (var i = 0; i < q; i++) {
      out.push({
        brand: biz,
        title: r.cook_labels[0] || 'Cooked',
        product: r.product_name,
        lines: [
          [r.weight_basis === 'weighed' ? kg(r.weight_kg) : weightText(r), opts.join(', ')].filter(Boolean).join(' · '),
          'Pickup ' + dayLabel(r.pickup_date) + (r.pickup_time ? ' ' + t12(r.pickup_time) : '') + (q > 1 ? ' · ' + (i + 1) + ' of ' + q : '')
        ],
        who: r.customer_name || '',
        ref: r.order_number || '',
        foot: 'Keep refrigerated'
      });
    }
    return out;
  }

  function printStickers(date, itemId) {
    var rows = [];
    if (itemId) { var one = findItem(itemId); if (one) rows.push(one); }
    else daysFor(date).forEach(function (d) { d.items.forEach(function (r) { rows.push(r); }); });
    if (!rows.length) { if (H().toast) H().toast('Nothing to print', 'err'); return; }
    if (window.LpLabels && window.LpOrderToolsHost) {
      var st = [];
      rows.forEach(function (r) { st = st.concat(labelStickers(r)); });
      window.LpLabels.print(window.LpOrderToolsHost.settingsNow(), 'kitchen', st, { title: 'Cooked stickers' }).then(function (res) {
        if (window.LpOrderTools) window.LpOrderTools.reportPrint(res, st.length);
      });
      return;
    }
    openPrint('Cooked stickers', '<div class="sheet">' + rows.map(sticker).join('') + '</div>');
  }

  /* ---------- events ---------- */
  async function onClick(e) {
    var b = e.target.closest('[data-kt]');
    if (!b || K.busy) return;
    var act = b.getAttribute('data-kt');
    var host = H();
    try {
      if (act === 'tick') {
        var done = b.getAttribute('data-done') !== '1';
        b.disabled = true;
        await post({ action: 'set_done', order_item_id: b.getAttribute('data-id'), done: done });
        var r = findItem(b.getAttribute('data-id'));
        if (r) { r.done = done; r.done_at = done ? new Date().toISOString() : null; r.done_by = done ? 'me' : null; }
        recount();
        render();
        return;
      }
      if (act === 'open') { if (host.openOrder) host.openOrder(b.getAttribute('data-order')); return; }
      if (act === 'print-day') return printList(b.getAttribute('data-day'));
      if (act === 'print-all') return printList(null);
      if (act === 'stickers-day') return printStickers(b.getAttribute('data-day'));
      if (act === 'stickers-all') return printStickers(null);
      if (act === 'sticker') return printStickers(null, b.getAttribute('data-id'));
      if (act === 'refresh') return load();
      if (act === 'add' || act === 'dismiss' || act === 'remove') {
        K.busy = true;
        var out = await post({ action: act === 'add' ? 'add_cooking' : act === 'dismiss' ? 'dismiss_check' : 'remove', order_item_id: b.getAttribute('data-id') });
        K.busy = false;
        if (host.toast) host.toast(act === 'add' ? (out.charged ? 'Added to the kitchen and charged cooking' : 'Added to the kitchen') : act === 'dismiss' ? 'Dismissed' : 'Removed from the kitchen');
        return load();
      }
      if (act === 'charge-preview' || act === 'charge-apply') {
        K.busy = true;
        var pv = await post({ action: 'apply_charges', dry_run: true });
        K.busy = false;
        var lines = (pv.lines || []).map(function (l) {
          return l.order_number + ' · ' + l.customer_name + ' · ' + l.product_name + ': ' + (l.before_cents == null ? 'TBC' : money(l.before_cents)) + ' → ' + (l.after_cents == null ? 'TBC until weighed' : money(l.after_cents));
        });
        var box = $('kt-charge-preview');
        if (box) {
          box.classList.remove('hide');
          box.innerHTML = '<h4 class="kt-h4">' + pv.count + ' line' + (pv.count === 1 ? '' : 's') + ' will be charged cooking</h4><p class="kt-muted" style="margin:0 0 6px">Weight not known yet = TBC; the cooking is added when the item is weighed.</p><ul class="kt-pv">' +
            lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' +
            (act === 'charge-apply' ? '<div class="kt-ub-btns"><button type="button" class="btn solid" data-kt="charge-confirm">Yes, charge ' + pv.count + ' line' + (pv.count === 1 ? '' : 's') + '</button><button type="button" class="btn ghost" data-kt="charge-cancel">Cancel</button></div>' : '');
        }
        return;
      }
      if (act === 'charge-cancel') { var bx = $('kt-charge-preview'); if (bx) bx.classList.add('hide'); return; }
      if (act === 'charge-confirm') {
        K.busy = true;
        b.disabled = true;
        var res = await post({ action: 'apply_charges' });
        K.busy = false;
        if (host.toast) host.toast('Charged cooking on ' + res.charged + ' line' + (res.charged === 1 ? '' : 's') + (res.failed && res.failed.length ? ' (' + res.failed.length + ' failed)' : ''), res.failed && res.failed.length ? 'err' : undefined);
        var bx2 = $('kt-charge-preview'); if (bx2) bx2.classList.add('hide');
        return load();
      }
    } catch (err) {
      K.busy = false;
      b.disabled = false;
      if (host.toast) host.toast(err.message || 'Something went wrong', 'err');
    }
  }

  function recount() {
    var b = K.data && K.data.board; if (!b) return;
    var tDone = 0;
    b.days.forEach(function (d) {
      var done = 0;
      d.items.forEach(function (r) { if (r.done) done += r.quantity; });
      d.summary.done = done; d.summary.to_do = d.summary.units - done; tDone += done;
    });
    b.totals.done = tDone;
  }

  function bind() {
    var v = $('view-kitchen');
    if (!v || v.__ktBound) return;
    v.__ktBound = true;
    v.addEventListener('click', onClick);
    var rg = $('kt-range');
    if (rg) rg.addEventListener('change', function () {
      var dt = $('kt-date'); if (dt) dt.classList.toggle('hide', rg.value !== 'date');
      if (rg.value !== 'date' || (dt && dt.value)) load();
    });
    var dt = $('kt-date');
    if (dt) dt.addEventListener('change', load);
    var sd = $('kt-show-done');
    if (sd) sd.addEventListener('change', function () { K.showDone = sd.checked; render(); });
  }

  window.LpKitchen = {
    open: function () { bind(); return load(); },
    _state: K
  };
})();
