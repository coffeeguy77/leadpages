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

  /* ---------- filters ----------
   * range  (server): upcoming | today | tomorrow | week | date | range | past
   * status (client): todo | done | all
   * kind   (client): '' = all, or a kind name (Turkey, Ham…)
   * q      (client): order number / customer / product / notes
   */
  K.f = { range: 'upcoming', status: 'todo', kind: '', q: '' };
  K.collapsed = {};      // kind name → true when its sizes are hidden in the cook plan
  K.daysClosed = {};     // date → true when that day's order list is folded

  function todayYmd() { return (K.data && K.data.today) || new Date().toISOString().slice(0, 10); }
  function addDays(ymd, n) { var d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

  function rangeQuery() {
    var t = todayYmd();
    var r = $('kt-range') ? $('kt-range').value : 'upcoming';
    K.f.range = r;
    var a = $('kt-from') && $('kt-from').value;
    var b = $('kt-to') && $('kt-to').value;
    if (r === 'today') return 'from=' + t + '&to=' + t;
    if (r === 'tomorrow') return 'from=' + addDays(t, 1) + '&to=' + addDays(t, 1);
    if (r === 'week') return 'from=' + t + '&to=' + addDays(t, 6);
    if (r === 'date' && a) return 'from=' + a + '&to=' + a;
    if (r === 'range' && a) return 'from=' + a + (b ? '&to=' + b : '');
    if (r === 'past') return 'from=' + addDays(t, -60) + '&to=' + addDays(t, -1);
    return 'from=' + t;
  }

  async function load() {
    var host = H();
    if (!host.siteId || !host.siteId()) return;
    var wrap = $('kt-days');
    if (wrap) wrap.innerHTML = '<p class="notice">Loading the kitchen…</p>';
    try {
      K.data = await host.api('/api/order/kitchen?' + host.siteQuery(rangeQuery()));
      render();
    } catch (e) {
      if (wrap) wrap.innerHTML = '<p class="notice err">Couldn’t load the kitchen: ' + esc(e.message) + '</p>';
    }
  }

  function matchesQ(r, q) {
    if (!q) return true;
    var hay = [r.order_number, r.customer_name, r.customer_phone, r.product_name, r.options.join(' '), r.notes].join(' ').toLowerCase();
    return q.split(/\s+/).filter(Boolean).every(function (w) { return hay.indexOf(w) >= 0; });
  }

  /** Items after the status / search filters (kind filter applied separately so the chips keep their counts). */
  function baseItems() {
    var out = [];
    var q = (K.f.q || '').trim().toLowerCase();
    ((K.data && K.data.board.days) || []).forEach(function (d) {
      d.items.forEach(function (r) {
        if (K.f.status === 'todo' && r.done) return;
        if (K.f.status === 'done' && !r.done) return;
        if (!matchesQ(r, q)) return;
        out.push(r);
      });
    });
    return out;
  }
  function visibleItems() {
    return baseItems().filter(function (r) { return !K.f.kind || r.kind === K.f.kind; });
  }

  function sum(list, f) { return list.reduce(function (a, r) { return a + (f ? f(r) : r.quantity); }, 0); }

  function render() {
    var d = K.data || { board: { days: [], check: [], totals: {} } };
    var b = d.board;
    var base = baseItems();
    var items = visibleItems();
    var all = [];
    (b.days || []).forEach(function (x) { x.items.forEach(function (r) { all.push(r); }); });

    // Kind chips
    var kinds = {};
    base.forEach(function (r) { kinds[r.kind] = (kinds[r.kind] || 0) + r.quantity; });
    var chips = $('kt-kinds');
    if (chips) {
      if (K.f.kind && !kinds[K.f.kind]) K.f.kind = '';
      chips.innerHTML = '<button type="button" class="kt-chip' + (!K.f.kind ? ' on' : '') + '" data-kt="kind" data-kind="">All <b>' + sum(base) + '</b></button>' +
        Object.keys(kinds).sort().map(function (k) {
          return '<button type="button" class="kt-chip' + (K.f.kind === k ? ' on' : '') + '" data-kt="kind" data-kind="' + esc(k) + '">' + esc(k) + ' <b>' + kinds[k] + '</b></button>';
        }).join('');
    }

    // KPIs for what's on screen
    var toCook = sum(items.filter(function (r) { return !r.done; }));
    var doneN = sum(all.filter(function (r) { return r.done && (!K.f.kind || r.kind === K.f.kind); }));
    var allN = sum(all.filter(function (r) { return !K.f.kind || r.kind === K.f.kind; }));
    var kgN = Math.round(sum(items, function (r) { return r.weight_kg || 0; }) * 10) / 10;
    var val = sum(items, function (r) { return r.cooking_value_cents || estCooking(r); });
    var next = null;
    items.slice().sort(function (x, y) { return String(x.pickup_date + (x.pickup_time || '99')).localeCompare(String(y.pickup_date + (y.pickup_time || '99'))); })
      .some(function (r) { if (!r.done && r.pickup_date >= todayYmd()) { next = r; return true; } return false; });
    var kp = $('kt-kpis');
    if (kp) {
      kp.innerHTML =
        kpi('To cook', String(toCook)) +
        kpi('Done', doneN + ' of ' + allN) +
        kpi('Weight', kgN ? '≈' + kgN + ' kg' : '—') +
        kpi('Cooking value (est.)', val ? money(val) : '—') +
        kpi('Next due', next ? dayLabel(next.pickup_date) + (next.pickup_time ? ' ' + t12(next.pickup_time) : '') : '—');
    }

    renderCheck(b);
    renderPlan(items);
    renderList(items);
  }

  /** Cooking estimate for a line not weighed yet: max(kg × rate, minimum) per item — charged for real when weighed. */
  function estCooking(r) {
    var st = (K.data && K.data.board && K.data.board.settings) || {};
    var rate = Number(st.rate_cents_per_kg) || 0;
    if (!rate) return 0;
    var min = Number(st.min_cents) || 0;
    var q = Math.max(1, Number(r.quantity) || 1);
    var byKg = r.weight_kg ? Math.round(r.weight_kg * rate) : 0;
    return Math.max(byKg, min * q);
  }

  function kpi(l, v) { return '<div class="kpi kt-kpi"><p class="l">' + esc(l) + '</p><p class="v">' + esc(v) + '</p></div>'; }

  function renderUncharged(d) {
    var ub = $('kt-uncharged');
    if (!ub) return;
    if (d.uncharged > 0) {
      ub.classList.remove('hide');
      ub.innerHTML = '<div><strong>' + d.uncharged + ' upcoming cooked/glazed item' + (d.uncharged === 1 ? '' : 's') + ' aren’t charged for cooking yet.</strong> ' +
        'Charging adds the cooking rate per kg (with the minimum) to those order lines and updates each order’s total.</div>' +
        '<div class="kt-ub-btns"><button type="button" class="btn ghost" data-kt="charge-preview">Preview</button>' +
        '<button type="button" class="btn solid" data-kt="charge-apply">Charge cooking on these</button></div>';
    } else { ub.classList.add('hide'); ub.innerHTML = ''; }
  }

  function renderCheck(b) {
    var ck = $('kt-check');
    if (!ck) return;
    var list = b.check || [];
    if (!list.length) { ck.classList.add('hide'); ck.innerHTML = ''; return; }
    ck.classList.remove('hide');
    ck.innerHTML = '<h4 class="kt-h4">Check these — a note mentions cooking (' + list.length + ')</h4>' +
      list.map(function (c) {
        return '<div class="kt-check-row">' +
          '<div class="kt-check-main"><strong>' + esc(c.product_name) + '</strong> × ' + c.quantity +
          '<div class="kt-sub">' + esc(c.order_number) + ' · ' + esc(c.customer_name) + ' · ' + esc(dayLabel(c.pickup_date)) + (c.pickup_time ? ' ' + t12(c.pickup_time) : '') + '</div>' +
          '<div class="kt-note">“' + esc(String(c.note).slice(0, 220)) + '”</div></div>' +
          '<div class="kt-check-btns">' +
          '<button type="button" class="btn solid" data-kt="add" data-id="' + esc(c.item_id) + '">Mark cooked</button>' +
          '<button type="button" class="btn ghost" data-kt="dismiss" data-id="' + esc(c.item_id) + '">Not cooking</button>' +
          '<button type="button" class="btn ghost" data-kt="open" data-order="' + esc(c.order_id) + '">Open order</button></div></div>';
      }).join('');
  }

  /** "1.5-2.5 kg" style sizes sort by their first number, then by name. */
  function sizeKey(v) {
    var t = String(v || '').toLowerCase();
    var m = /(\d+(?:\.\d+)?)/.exec(t);
    // Same cut together (Half, Whole, Boned and rolled…), then smallest size first.
    return t.replace(/[\d.]+\s*-?\s*/g, '').replace(/kg|\s+/g, ' ').trim() + ' ' + (m ? ('00000' + Math.round(Number(m[1]) * 100)).slice(-6) : '999999');
  }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

  /** Cook plan: each kind → its sizes (only those ordered), count per pickup day. */
  function planOf(items) {
    var days = [];
    var kinds = {};
    items.forEach(function (r) {
      var d = r.pickup_date || 'no-date';
      if (days.indexOf(d) < 0) days.push(d);
      var k = kinds[r.kind] || (kinds[r.kind] = { kind: r.kind, total: 0, done: 0, kg: 0, byDay: {}, sizes: {} });
      var sz = k.sizes[r.variant] || (k.sizes[r.variant] = { size: r.variant, total: 0, done: 0, byDay: {}, opts: {} });
      [k, sz].forEach(function (o) {
        o.total += r.quantity;
        if (r.done) o.done += r.quantity;
        o.byDay[d] = (o.byDay[d] || 0) + r.quantity;
      });
      if (r.weight_kg) k.kg += r.weight_kg;
      r.options.forEach(function (op) {
        if (r.cook_labels.indexOf(op) >= 0) return;
        sz.opts[op] = (sz.opts[op] || 0) + r.quantity;
      });
    });
    days.sort();
    return {
      days: days,
      kinds: Object.keys(kinds).sort().map(function (n) {
        var k = kinds[n];
        k.sizes = Object.keys(k.sizes).map(function (s) { return k.sizes[s]; }).sort(function (a, b) { return sizeKey(a.size).localeCompare(sizeKey(b.size)); });
        return k;
      })
    };
  }

  function dayHead(ymd) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return 'No date';
    var d = new Date(ymd + 'T00:00:00');
    return '<span class="kt-dh-d">' + DOW[d.getDay()] + '</span><span class="kt-dh-n">' + d.getDate() + ' ' + MON[d.getMonth()] + '</span>';
  }

  function renderPlan(items) {
    var box = $('kt-plan');
    if (!box) return;
    if (!items.length) { box.innerHTML = ''; box.classList.add('hide'); return; }
    box.classList.remove('hide');
    var plan = planOf(items);
    var allOpen = plan.kinds.every(function (k) { return !K.collapsed[k.kind]; });
    var head = '<div class="kt-plan-head"><h4 class="kt-h4">What to cook' + (K.f.status === 'todo' ? ' (still to cook)' : K.f.status === 'done' ? ' (done)' : '') + '</h4>' +
      '<div class="kt-plan-btns"><button type="button" class="btn ghost" data-kt="plan-toggle-all">' + (allOpen ? 'Hide sizes' : 'Show all sizes') + '</button>' +
      '<button type="button" class="btn ghost" data-kt="print-plan">Print</button></div></div>';
    var th = '<tr><th class="kt-pc-item">Item / size</th><th class="kt-pc-n">Total</th>' +
      plan.days.map(function (d) { return '<th class="kt-pc-n">' + dayHead(d) + '</th>'; }).join('') + '</tr>';
    var rows = plan.kinds.map(function (k) {
      var open = !K.collapsed[k.kind];
      var r = '<tr class="kt-pk" data-kt="plan-kind" data-kind="' + esc(k.kind) + '"><td class="kt-pc-item"><span class="kt-caret">' + (open ? '▾' : '▸') + '</span> <b>' + esc(k.kind) + '</b>' +
        '<span class="kt-pk-meta">' + k.sizes.length + ' size' + (k.sizes.length === 1 ? '' : 's') + (k.kg ? ' · ≈' + (Math.round(k.kg * 10) / 10) + ' kg' : '') + '</span></td>' +
        '<td class="kt-pc-n"><span class="kt-num big">' + k.total + '</span>' + (k.done && K.f.status === 'all' ? '<span class="kt-done-of">' + k.done + ' done</span>' : '') + '</td>' +
        plan.days.map(function (d) { return '<td class="kt-pc-n">' + (k.byDay[d] ? '<span class="kt-num">' + k.byDay[d] + '</span>' : '') + '</td>'; }).join('') + '</tr>';
      if (open) {
        r += k.sizes.map(function (sz) {
          var o = Object.keys(sz.opts).sort().map(function (n) { return esc(n) + ' ' + sz.opts[n]; }).join(' · ');
          return '<tr class="kt-ps"><td class="kt-pc-item"><span class="kt-ps-name">' + esc(cap(sz.size)) + '</span>' + (o ? '<span class="kt-ps-opts">' + o + '</span>' : '') + '</td>' +
            '<td class="kt-pc-n"><span class="kt-num">' + sz.total + '</span></td>' +
            plan.days.map(function (d) { return '<td class="kt-pc-n">' + (sz.byDay[d] ? '<span class="kt-num sm">' + sz.byDay[d] + '</span>' : '') + '</td>'; }).join('') + '</tr>';
        }).join('');
      }
      return r;
    }).join('');
    box.innerHTML = head + '<div class="kt-plan-scroll"><table class="kt-plan-t lpui-bare">' + '<thead>' + th + '</thead><tbody>' + rows + '</tbody></table></div>';
  }

  function renderList(items) {
    var wrap = $('kt-days');
    if (!wrap) return;
    if (!items.length) {
      var msg = K.f.status === 'todo' ? 'Nothing left to cook' : 'Nothing here';
      wrap.innerHTML = '<p class="empty kt-empty">' + msg + (K.f.kind ? ' for ' + esc(K.f.kind) : '') + (K.f.q ? ' matching “' + esc(K.f.q) + '”' : '') + ' in these dates.</p>';
      return;
    }
    var byDay = {};
    items.forEach(function (r) { var d = r.pickup_date || 'no-date'; (byDay[d] = byDay[d] || []).push(r); });
    var t = todayYmd();
    wrap.innerHTML = Object.keys(byDay).sort().map(function (d) {
      var list = byDay[d].slice().sort(function (a, b) {
        return String(a.pickup_time || '99').localeCompare(String(b.pickup_time || '99')) || a.kind.localeCompare(b.kind) || sizeKey(a.variant).localeCompare(sizeKey(b.variant));
      });
      var n = sum(list);
      var left = sum(list.filter(function (r) { return !r.done; }));
      var kinds = {};
      list.forEach(function (r) { kinds[r.kind] = (kinds[r.kind] || 0) + r.quantity; });
      var closed = !!K.daysClosed[d];
      return '<section class="kt-day' + (d < t ? ' kt-past' : '') + '">' +
        '<div class="kt-day-head"><button type="button" class="kt-day-toggle" data-kt="day-toggle" data-day="' + esc(d) + '" aria-expanded="' + (!closed) + '">' +
        '<span class="kt-caret">' + (closed ? '▸' : '▾') + '</span><span class="kt-day-title">' + esc(dayLabel(d, true)) + '</span>' +
        (d === t ? '<span class="kt-tag kt-today">Today</span>' : '') +
        '<span class="kt-day-meta">' + n + ' item' + (n === 1 ? '' : 's') + (K.f.status !== 'done' ? ' · ' + left + ' to cook' : '') + ' · ' +
        Object.keys(kinds).sort().map(function (k) { return kinds[k] + ' ' + esc(k); }).join(', ') + '</span></button>' +
        '<div class="kt-day-btns"><button type="button" class="btn ghost" data-kt="print-day" data-day="' + esc(d) + '">Print list</button>' +
        '<button type="button" class="btn ghost" data-kt="stickers-day" data-day="' + esc(d) + '">Stickers</button></div></div>' +
        (closed ? '' : '<div class="kt-items">' + list.map(renderItem).join('') + '</div>') + '</section>';
    }).join('');
  }

  function renderItem(r) {
    var opts = r.options.filter(function (o) { return r.cook_labels.indexOf(o) < 0; });
    return '<div class="kt-item' + (r.done ? ' done' : '') + (r.important ? ' imp' : '') + '">' +
      '<button type="button" class="kt-tick" data-kt="tick" data-id="' + esc(r.item_id) + '" data-done="' + (r.done ? '1' : '0') + '" aria-pressed="' + (r.done ? 'true' : 'false') + '" aria-label="' + (r.done ? 'Mark not done' : 'Mark done') + '">' + (r.done ? '✓' : '') + '</button>' +
      '<div class="kt-when"><strong>' + (r.pickup_time ? esc(t12(r.pickup_time)) : 'Any time') + '</strong>' +
      (r.oven_by ? '<span class="kt-oven">oven by ' + esc(t12(r.oven_by)) + (r.oven_day_before ? ' (day before)' : '') + '</span>' : '') + '</div>' +
      '<div class="kt-what"><div class="kt-prod"><span class="kt-qty">' + r.quantity + ' ×</span> <span class="kt-kind-l">' + esc(r.kind) + '</span> ' + esc(r.variant) +
      ' <span class="kt-cook">' + esc(r.cook_labels.join(', ') || 'Cooked') + '</span></div>' +
      '<div class="kt-sub">' + esc(weightText(r)) + (opts.length ? ' · <b>' + esc(opts.join(', ')) + '</b>' : '') +
      (r.cooking_value_cents || estCooking(r) ? ' · cooking ≈' + money(r.cooking_value_cents || estCooking(r)) : '') + '</div>' +
      (r.notes ? '<div class="kt-note">“' + esc(r.notes.slice(0, 240)) + '”</div>' : '') +
      '<div class="kt-sub kt-who">' + esc(r.order_number) + ' · ' + esc(r.customer_name) + (r.customer_phone ? ' · ' + esc(r.customer_phone) : '') +
      (r.done && r.done_at ? ' · done ' + esc(new Date(r.done_at).toLocaleString('en-AU', { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' })) : '') + '</div></div>' +
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

  /** Days (with their on-screen items) for printing: the current filters, one day or all. */
  function daysFor(date) {
    var byDay = {};
    visibleItems().forEach(function (r) { var d = r.pickup_date || 'no-date'; (byDay[d] = byDay[d] || []).push(r); });
    return Object.keys(byDay).sort().filter(function (d) { return !date || d === date; }).map(function (d) {
      var items = byDay[d].slice().sort(function (a, b) { return String(a.pickup_time || '99').localeCompare(String(b.pickup_time || '99')) || a.kind.localeCompare(b.kind); });
      var p = planOf(items);
      return {
        date: d, items: items,
        summary: {
          units: sum(items), kg: Math.round(sum(items, function (r) { return r.weight_kg || 0; }) * 10) / 10,
          first_in_oven: items.reduce(function (a, r) { return r.oven_by && !r.oven_day_before && (!a || r.oven_by < a) ? r.oven_by : a; }, null),
          kinds: p.kinds.map(function (k) {
            return { kind: k.kind, units: k.total, variants: k.sizes.map(function (sz) {
              return { variant: sz.size, units: sz.total, options: Object.keys(sz.opts).sort().map(function (n) { return { label: n, units: sz.opts[n] }; }) };
            }) };
          })
        }
      };
    });
  }

  /** A4 cook plan: kinds → sizes × days. */
  function printPlan() {
    var biz = H().businessName ? H().businessName() : '';
    var plan = planOf(visibleItems());
    if (!plan.kinds.length) { if (H().toast) H().toast('Nothing to print', 'err'); return; }
    var head = '<tr><th>Item / size</th><th style="text-align:center">Total</th>' + plan.days.map(function (d) { return '<th style="text-align:center">' + esc(dayLabel(d)) + '</th>'; }).join('') + '</tr>';
    var body = plan.kinds.map(function (k) {
      return '<tr style="background:#eee"><td class="b">' + esc(k.kind) + '</td><td class="b" style="text-align:center">' + k.total + '</td>' +
        plan.days.map(function (d) { return '<td class="b" style="text-align:center">' + (k.byDay[d] || '') + '</td>'; }).join('') + '</tr>' +
        k.sizes.map(function (sz) {
          var o = Object.keys(sz.opts).sort().map(function (n) { return n + ' ' + sz.opts[n]; }).join(', ');
          return '<tr><td style="padding-left:14px">' + esc(sz.size) + (o ? '<br><span class="n">' + esc(o) + '</span>' : '') + '</td><td style="text-align:center">' + sz.total + '</td>' +
            plan.days.map(function (d) { return '<td style="text-align:center">' + (sz.byDay[d] || '') + '</td>'; }).join('') + '</tr>';
        }).join('');
    }).join('');
    openPrint('What to cook', '<h1>What to cook' + (biz ? ' — ' + esc(biz) : '') + '</h1><p class="meta">' + esc(filterSummary()) + ' · printed ' + esc(new Date().toLocaleString('en-AU')) + '</p>' +
      '<table><thead>' + head + '</thead><tbody>' + body + '</tbody></table>');
  }

  function filterSummary() {
    var r = { upcoming: 'Upcoming', today: 'Today', tomorrow: 'Tomorrow', week: 'Next 7 days', date: 'One day', range: 'Date range', past: 'Past 60 days' }[K.f.range] || '';
    return [r, K.f.status === 'todo' ? 'still to cook' : K.f.status === 'done' ? 'done' : 'all', K.f.kind || '', K.f.q ? '“' + K.f.q + '”' : ''].filter(Boolean).join(' · ');
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
      if (act === 'kind') { K.f.kind = b.getAttribute('data-kind') || ''; render(); return; }
      if (act === 'status') { K.f.status = b.getAttribute('data-status'); syncStatus(); render(); return; }
      if (act === 'plan-kind') { var kn = b.getAttribute('data-kind'); K.collapsed[kn] = !K.collapsed[kn]; renderPlan(visibleItems()); return; }
      if (act === 'plan-toggle-all') {
        var its = visibleItems(); var pl = planOf(its);
        var anyOpen = pl.kinds.some(function (k) { return !K.collapsed[k.kind]; });
        pl.kinds.forEach(function (k) { K.collapsed[k.kind] = anyOpen; });
        renderPlan(its); return;
      }
      if (act === 'day-toggle') { var dd = b.getAttribute('data-day'); K.daysClosed[dd] = !K.daysClosed[dd]; renderList(visibleItems()); return; }
      if (act === 'print-plan') return printPlan();
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

  function syncStatus() {
    document.querySelectorAll('#view-kitchen [data-kt="status"]').forEach(function (x) {
      var on = x.getAttribute('data-status') === K.f.status;
      x.classList.toggle('on', on);
      x.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function syncRangeUi() {
    var r = $('kt-range') ? $('kt-range').value : 'upcoming';
    if ($('kt-from-wrap')) $('kt-from-wrap').classList.toggle('hide', r !== 'date' && r !== 'range');
    if ($('kt-to-wrap')) $('kt-to-wrap').classList.toggle('hide', r !== 'range');
    if ($('kt-from-l')) $('kt-from-l').textContent = r === 'range' ? 'From' : 'Day';
  }

  function bind() {
    var v = $('view-kitchen');
    if (!v || v.__ktBound) return;
    v.__ktBound = true;
    v.addEventListener('click', onClick);
    var rg = $('kt-range');
    if (rg) rg.addEventListener('change', function () {
      syncRangeUi();
      if ((rg.value !== 'date' && rg.value !== 'range') || ($('kt-from') && $('kt-from').value)) load();
    });
    ['kt-from', 'kt-to'].forEach(function (id) { var el = $(id); if (el) el.addEventListener('change', load); });
    var q = $('kt-q');
    var tmr = null;
    if (q) q.addEventListener('input', function () { clearTimeout(tmr); tmr = setTimeout(function () { K.f.q = q.value || ''; render(); }, 150); });
    syncStatus();
    syncRangeUi();
  }

  window.LpKitchen = {
    open: function () { bind(); return load(); },
    _state: K
  };
})();
