/**
 * Bookings admin — hire desk, fleet calendar, fleet editor, hire settings.
 * Loaded by bookings.html; talks to /api/bookings/hire/fleet.
 * bookings.html exposes window.__BK (state, api, helpers) and calls window.__BKX[view](root).
 */
(function () {
  'use strict';

  var CSS = [
    '.hx-metrics{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin:0 0 14px}',
    '.hx-metric{background:#fff;border:1px solid var(--line,#e6e8ec);border-radius:14px;padding:12px 14px}',
    '.hx-metric span{display:block;font-size:12px;color:var(--ink-soft,#5b6571);font-weight:600}',
    '.hx-metric b{display:block;font-size:1.6rem;margin-top:2px;letter-spacing:-.02em}',
    '.hx-metric.hx-alert{border-color:#f59e0b;background:#fffbeb}',
    '.hx-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}',
    '.hx-req{border:1px solid var(--line,#e6e8ec);border-radius:12px;padding:12px 14px;margin:0 0 10px;background:#fff;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center}',
    '.hx-req h4{margin:0 0 4px;font-size:15px}',
    '.hx-req .sub{margin:0}',
    '.hx-act{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}',
    '.hx-act .btn{margin:0}',
    '.hx-pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11.5px;font-weight:700;background:#eef2f6;color:#334155}',
    '.hx-pill.pending{background:#fef3c7;color:#92400e}.hx-pill.confirmed{background:#dcfce7;color:#166534}.hx-pill.in_progress{background:#dbeafe;color:#1e40af}.hx-pill.completed{background:#e5e7eb;color:#374151}.hx-pill.cancelled{background:#fee2e2;color:#991b1b}',
    '.hx-pill.active{background:#dcfce7;color:#166534}.hx-pill.maintenance{background:#fde68a;color:#78350f}.hx-pill.unavailable{background:#e5e7eb;color:#374151}',
    '.hx-cal-wrap{overflow-x:auto;border:1px solid var(--line,#e6e8ec);border-radius:14px;background:#fff}',
    '.hx-cal{min-width:900px;position:relative;--hx-name:190px}',
    '.hx-ch,.hx-cr{display:grid;grid-template-columns:190px minmax(0,1fr)}',
    '.hx-ch{position:sticky;top:0;background:#fafbfc;border-bottom:1px solid var(--line,#e6e8ec);z-index:2}',
    '.hx-days{display:grid}',
    '.hx-day{font-size:11.5px;text-align:center;padding:6px 2px;border-left:1px solid var(--line,#eef0f3);color:var(--ink-soft,#5b6571)}',
    '.hx-day b{display:block;font-size:14px;color:var(--ink,#15191e)}',
    '.hx-day.today{background:color-mix(in srgb,var(--accent,#155c4a) 10%,#fff)}',
    '.hx-day.we{background:#fafafa}',
    '.hx-free{display:block;font-size:10.5px;font-weight:700;margin-top:2px}',
    '.hx-free.ok{color:#15803d}.hx-free.few{color:#b45309}.hx-free.none{color:#b91c1c}',
    '.hx-cr{border-bottom:1px solid var(--line,#eef0f3);min-height:58px}',
    '.hx-name{padding:8px 10px;border-right:1px solid var(--line,#eef0f3);font-size:13px;display:flex;flex-direction:column;justify-content:center;gap:2px;background:#fff;position:sticky;left:0;z-index:1}',
    '.hx-name b{font-size:13.5px}',
    '.hx-name small{color:var(--ink-soft,#5b6571)}',
    '.hx-lane{position:relative;display:grid}',
    '.hx-slot{border-left:1px solid var(--line,#f1f2f4);cursor:copy}',
    '.hx-slot:hover{background:color-mix(in srgb,var(--accent,#155c4a) 6%,transparent)}',
    '.hx-bar{position:absolute;top:8px;bottom:8px;border-radius:8px;padding:4px 8px;font-size:12px;line-height:1.25;color:#fff;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.15);border:0;text-align:left;font-family:inherit}',
    '.hx-bar small{display:block;opacity:.9;font-size:11px}',
    '.hx-bar.confirmed{background:var(--accent,#155c4a)}.hx-bar.pending{background:#f59e0b;color:#3b2300}.hx-bar.in_progress,.hx-bar.checked_in{background:#2563eb}.hx-bar.completed{background:#9ca3af}',
    '.hx-bar.block{background:repeating-linear-gradient(135deg,#e5e7eb 0 8px,#d1d5db 8px 16px);color:#374151}',
    '.hx-legend{display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:var(--ink-soft,#5b6571);margin:10px 2px 0}',
    '.hx-legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-2px}',
    '.hx-now{position:absolute;top:0;bottom:0;width:2px;background:#ef4444;z-index:1;pointer-events:none}',
    '.hx-trucks{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}',
    '.hx-truck{background:#fff;border:1px solid var(--line,#e6e8ec);border-radius:14px;overflow:hidden;display:flex;flex-direction:column}',
    '.hx-truck .ph{height:120px;background:#f1f3f6 center/cover no-repeat;display:grid;place-items:center;color:#9aa3ad;font-size:13px}',
    '.hx-truck .bd{padding:12px 14px;display:flex;flex-direction:column;gap:4px;flex:1}',
    '.hx-truck .bd .btns{margin-top:auto;padding-top:8px;display:flex;gap:6px;flex-wrap:wrap}',
    '.hx-truck .btn{margin:0}',
    '.hx-form{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    '.hx-form .field{margin:0}',
    '.hx-form .wide{grid-column:1/-1}',
    '.hx-form h3{grid-column:1/-1;margin:8px 0 0;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-soft,#5b6571)}',
    '.hx-days7{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}',
    '.hx-days7 label{font-size:11px;font-weight:700;color:var(--ink-soft,#5b6571);display:block;text-align:center}',
    '.hx-days7 input{width:100%;padding:8px 4px;border-radius:8px;border:1px solid var(--line-strong,#d5d9df);text-align:center;font:inherit}',
    '.hx-opt{border:1px solid var(--line,#e6e8ec);border-radius:12px;padding:10px 12px;margin:0 0 8px;display:flex;justify-content:space-between;gap:10px;align-items:center;cursor:pointer;background:#fff}',
    '.hx-opt.on{border-color:var(--accent,#155c4a);box-shadow:0 0 0 2px var(--accent,#155c4a)}',
    '.hx-opt.off{opacity:.6}',
    '.hx-dl{display:grid;grid-template-columns:120px 1fr;gap:6px 10px;font-size:13.5px;margin:10px 0}',
    '.hx-dl dt{color:var(--ink-soft,#5b6571)}.hx-dl dd{margin:0}',
    '.hx-presets{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}',
    '.hx-preset{border:1px solid var(--line,#e6e8ec);border-radius:12px;padding:12px;background:#fff;cursor:pointer;text-align:left;font:inherit}',
    '.hx-preset:hover{border-color:var(--accent,#155c4a)}',
    '.hx-preset b{display:block;margin-bottom:4px}.hx-preset small{color:var(--ink-soft,#5b6571);font-size:12px;line-height:1.35;display:block}',
    '.hx-group{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-soft,#5b6571);margin:14px 0 6px}',
    '@media(max-width:700px){.hx-ch,.hx-cr{grid-template-columns:120px minmax(0,1fr)}.hx-cal{min-width:760px;--hx-name:120px}.hx-name small{display:none}.hx-form{grid-template-columns:1fr}.hx-req{grid-template-columns:1fr}.hx-act{justify-content:flex-start}}'
  ].join('\n');

  var DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  var DAY_LABEL = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
  var DATA = null; // last overview
  var FROM = null; // calendar start (YYYY-MM-DD)

  function B() { return window.__BK; }
  function esc(s) { return B().esc(s); }
  function money(c) { return B().money(c); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymdLocal(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(ymd, n) { var p = ymd.split('-').map(Number); return ymdLocal(new Date(p[0], p[1] - 1, p[2] + n)); }
  function tz() { return (DATA && DATA.timezone) || 'Australia/Sydney'; }
  function fmt(iso, opts) { try { return new Date(iso).toLocaleString('en-AU', Object.assign({ timeZone: tz() }, opts || { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })); } catch (e) { return iso; } }
  function ymdTz(iso) { try { return new Date(iso).toLocaleDateString('en-CA', { timeZone: tz() }); } catch (e) { return String(iso).slice(0, 10); } }
  function terms() { return (DATA && DATA.terms) || { singular: 'Truck', plural: 'Trucks' }; }
  function dollars(c) { return c == null || c === '' ? '' : (Number(c) / 100).toFixed(Number(c) % 100 ? 2 : 0); }
  function cents(v) { if (v === '' || v == null) return ''; var n = Math.round(Number(String(v).replace(/[$,\s]/g, '')) * 100); return isFinite(n) ? n : ''; }
  function vName(v) { return v ? (v.name || v.public_name) : ''; }
  function blockRange(x) {
    var o = { day: 'numeric', month: 'short' };
    var a = fmt(x.starts_at, o), z = fmt(new Date(Date.parse(x.ends_at) - 1).toISOString(), o);
    return a === z ? a : a + ' – ' + z;
  }
  function vehicleById(id) { return ((DATA && DATA.vehicles) || []).find(function (v) { return v.id === id; }) || null; }

  async function call(action, body) {
    var bk = B();
    return bk.api('/api/bookings/hire/fleet', { method: 'POST', body: JSON.stringify(Object.assign({ site_id: bk.state.siteId, action: action }, body || {})) });
  }
  async function load(from, to) {
    DATA = await call('overview', { from: from, to: to });
    return DATA;
  }
  function flash(m, bad) { B().flash(m, bad); }

  function ensureCss() {
    if (document.getElementById('hx-css')) return;
    var st = document.createElement('style'); st.id = 'hx-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  function side(html) {
    var s = document.getElementById('side');
    s.innerHTML = '<div class="hx-row" style="margin-bottom:8px"><span></span><button class="btn ghost" type="button" id="side-close">Close</button></div>' + html;
    B().show(s, true);
    return s;
  }
  function closeSide() { B().show(document.getElementById('side'), false); }

  function notSetUp(root) {
    root.innerHTML = '<div class="card"><h2>Set up hire bookings</h2><p class="sub">Pick what this business hires out. It adds a hire service and switches online booking on — nothing shows on the website until you add your first vehicle.</p>' +
      '<div id="hx-presets-hire" class="hx-presets"></div></div>';
    paintPresets(document.getElementById('hx-presets-hire'), function (p) { return p.kind === 'hire'; });
  }

  async function paintPresets(host, filter) {
    var j = await call('presets');
    var groups = {};
    j.presets.filter(filter || function () { return true; }).forEach(function (p) { (groups[p.group] = groups[p.group] || []).push(p); });
    host.innerHTML = Object.keys(groups).map(function (g) {
      return '<div style="grid-column:1/-1" class="hx-group">' + esc(g) + '</div>' + groups[g].map(function (p) {
        return '<button type="button" class="hx-preset" data-preset="' + esc(p.key) + '"><b>' + esc(p.label) + (j.current === p.key ? ' ✓' : '') + '</b><small>' + esc(p.blurb) + '</small><small style="margin-top:6px">' + esc(p.services.join(' · ')) + '</small></button>';
      }).join('');
    }).join('');
    host.onclick = async function (e) {
      var b = e.target.closest('[data-preset]'); if (!b) return;
      var key = b.getAttribute('data-preset');
      if (!confirm('Add the “' + b.querySelector('b').textContent.replace(' ✓', '') + '” set-up? Existing services and settings are kept.')) return;
      try {
        var r = await call('apply_preset', { preset: key });
        flash('Set up: ' + (r.created || []).length + ' service(s) added' + (r.hours_added ? ', opening hours added' : '') + '. Check prices before going live.');
        B().state.system = r.system || B().state.system;
        B().state.view = r && r.system && (r.system.booking_types || []).indexOf('resource_hire') >= 0 ? 'trucks' : 'services';
        B().state.pickedView = true;
        if (B().reloadSite) B().reloadSite(); else B().setView(B().state.view);
      } catch (err) { flash(err.message, true); }
    };
  }

  /* ================================================================ HIRE DESK */
  async function hiredesk(root) {
    ensureCss();
    root.innerHTML = '<p class="sub">Loading…</p>';
    var today = ymdLocal(new Date());
    var d = await load(today, addDays(today, 13)).catch(function (e) { root.innerHTML = '<div class="card"><p class="msg bad">' + esc(e.message) + '</p></div>'; return null; });
    if (!d) return;
    if (!d.service) return notSetUp(root);
    var t = terms();
    var nowMs = Date.now();
    var out = d.movements.filter(function (m) { return m.status === 'in_progress' || m.status === 'checked_in'; });
    var pickToday = d.movements.filter(function (m) { return ymdTz(m.pickup_at) === d.today && (m.status === 'confirmed' || m.status === 'pending'); });
    var returnToday = d.movements.filter(function (m) { return ymdTz(m.return_at) === d.today && m.status !== 'pending'; });
    var active = d.vehicles.filter(function (v) { return v.hire_status === 'active'; });
    var busyNow = {};
    d.reservations.forEach(function (r) {
      if (['pending', 'confirmed', 'checked_in', 'in_progress'].indexOf(r.status) < 0) return;
      if (Date.parse(r.starts_at) <= nowMs && Date.parse(r.ends_at) > nowMs) busyNow[r.resource_id] = true;
    });
    var freeNow = active.filter(function (v) { return !busyNow[v.id]; }).length;

    var h = '<div class="hx-row" style="margin-bottom:12px"><div><strong style="font-size:1.1rem">Hire desk</strong><div class="sub" style="margin:0">' + esc(fmt(new Date().toISOString(), { weekday: 'long', day: 'numeric', month: 'long' })) + '</div></div>' +
      '<div><button class="btn solid" type="button" data-hx="phone">+ Phone booking</button><button class="btn ghost" type="button" data-view="fleet">Fleet calendar</button></div></div>';
    h += '<div class="hx-metrics">' +
      metric('Requests waiting', d.requests.length, d.requests.length ? 'hx-alert' : '') +
      metric(t.plural + ' free now', freeNow + ' of ' + active.length) +
      metric('Out on hire', out.length) +
      metric('Picking up today', pickToday.length) +
      metric('Due back today', returnToday.length) + '</div>';
    if (!d.vehicles.length) {
      h += '<div class="card"><h2>Add your ' + esc(t.plural.toLowerCase()) + '</h2><p class="sub">Online booking starts working once you add your first ' + esc(t.singular.toLowerCase()) + '.</p><button class="btn solid" type="button" data-hx="add-truck">+ Add ' + esc(t.singular.toLowerCase()) + '</button></div>';
    }
    h += '<div class="card"><h2>Requests to approve</h2>' + (d.requests.length ? '<p class="sub">Online bookings wait here. Approving emails the customer their confirmation.</p>' + d.requests.map(reqRow).join('') : '<p class="sub">No requests waiting.</p>') + '</div>';
    h += '<div class="card"><h2>Today</h2>' +
      '<h3 style="font-size:14px;margin:6px 0">Picking up</h3>' + (pickToday.length ? pickToday.map(moveRow('pickup')).join('') : '<p class="sub">None.</p>') +
      '<h3 style="font-size:14px;margin:12px 0 6px">Coming back</h3>' + (returnToday.length ? returnToday.map(moveRow('return')).join('') : '<p class="sub">None.</p>') +
      (out.length ? '<h3 style="font-size:14px;margin:12px 0 6px">Out on hire</h3>' + out.map(moveRow('out')).join('') : '') + '</div>';
    root.innerHTML = h;
    root.onclick = deskClick;
  }

  function metric(label, val, cls) { return '<div class="hx-metric ' + (cls || '') + '"><span>' + esc(label) + '</span><b>' + esc(val) + '</b></div>'; }

  function reqRow(r) {
    var h = r.hire || {};
    var v = vehicleById(h.resource_id);
    var drv = h.driver_json || {};
    return '<div class="hx-req"><div><h4>' + esc(r.customer_name || 'Customer') + ' <span class="hx-pill pending">Request ' + esc(r.reference) + '</span></h4>' +
      '<p class="sub">' + esc(vName(v)) + ' · ' + esc(fmt(h.pickup_at || r.starts_at)) + ' → ' + esc(fmt(h.return_at || r.ends_at)) + ' · <strong>' + money(r.total_cents) + '</strong>' + (h.bond_cents ? ' + ' + money(h.bond_cents) + ' bond' : '') + '</p>' +
      '<p class="sub"><a href="tel:' + esc(String(r.customer_phone || '').replace(/[^0-9+]/g, '')) + '">' + esc(r.customer_phone || '') + '</a> · <a href="mailto:' + esc(r.customer_email || '') + '">' + esc(r.customer_email || '') + '</a>' +
      (drv.licence_number ? ' · Licence ' + esc(drv.licence_number) + ' ' + esc(drv.licence_state || '') : '') + ' · Card ' + (h.card_on_file_status === 'secured' ? 'saved ✓' : 'not saved') + '</p>' +
      (r.customer_notes ? '<p class="sub">“' + esc(r.customer_notes) + '”</p>' : '') + '</div>' +
      '<div class="hx-act"><button class="btn solid" type="button" data-hx="approve" data-id="' + esc(r.id) + '">Approve</button><button class="btn ghost" type="button" data-hx="decline" data-id="' + esc(r.id) + '">Decline</button><button class="btn ghost" type="button" data-hx="open" data-id="' + esc(r.id) + '">View</button></div></div>';
  }

  function moveRow(kind) {
    return function (m) {
      var v = vehicleById(m.resource_id);
      var btn = kind === 'pickup' && m.status === 'confirmed' ? '<button class="btn solid" type="button" data-hx="status" data-status="in_progress" data-id="' + esc(m.id) + '">Picked up</button>'
        : (kind !== 'pickup' && (m.status === 'in_progress' || m.status === 'checked_in')) ? '<button class="btn solid" type="button" data-hx="status" data-status="completed" data-id="' + esc(m.id) + '">Returned</button>' : '';
      return '<div class="hx-req"><div><h4>' + esc(vName(v)) + (v && v.registration_number ? ' <small class="sub">' + esc(v.registration_number) + '</small>' : '') + ' <span class="hx-pill ' + esc(m.status) + '">' + esc(label(m.status)) + '</span></h4>' +
        '<p class="sub">' + esc(m.customer_name || '') + ' · ' + esc(m.reference || '') + ' · ' + (kind === 'pickup' ? 'Pick up ' + esc(fmt(m.pickup_at, { hour: 'numeric', minute: '2-digit' })) : 'Due back ' + esc(fmt(m.return_at))) + '</p></div>' +
        '<div class="hx-act">' + btn + '<button class="btn ghost" type="button" data-hx="open" data-id="' + esc(m.id) + '">View</button></div></div>';
    };
  }
  function label(s) { return { pending: 'Request', confirmed: 'Confirmed', in_progress: 'Out on hire', checked_in: 'Out on hire', completed: 'Returned', cancelled: 'Cancelled', no_show: 'No-show' }[s] || s; }

  async function deskClick(e) {
    var el = e.target.closest('[data-hx]'); if (!el) return;
    var a = el.getAttribute('data-hx'), id = el.getAttribute('data-id');
    try {
      if (a === 'phone') return phoneBooking({});
      if (a === 'add-truck') return truckEditor(null);
      if (a === 'open') return bookingPanel(id);
      if (a === 'approve') { el.disabled = true; await call('approve', { booking_id: id }); flash('Approved — confirmation emailed.'); return refresh(); }
      if (a === 'decline') { var why = prompt('Reason for declining (sent to the customer, optional):', 'Sorry, that ' + terms().singular.toLowerCase() + ' isn’t available for those dates.'); if (why === null) return; await call('decline', { booking_id: id, reason: why }); flash('Declined — customer emailed.'); return refresh(); }
      if (a === 'status') { el.disabled = true; await call('set_status', { booking_id: id, status: el.getAttribute('data-status') }); flash(el.getAttribute('data-status') === 'completed' ? 'Marked as returned.' : 'Marked as picked up.'); return refresh(); }
    } catch (err) { el.disabled = false; flash(err.message, true); }
  }
  function refresh() { B().setView(B().state.view); }

  /* ================================================================ FLEET CALENDAR */
  var SPAN = 14;
  async function fleetCalendar(root) {
    ensureCss();
    if (!FROM) { var t0 = new Date(); t0.setDate(t0.getDate() - 1); FROM = ymdLocal(t0); }
    root.innerHTML = '<p class="sub">Loading…</p>';
    var d = await load(FROM, addDays(FROM, SPAN - 1)).catch(function (e) { root.innerHTML = '<div class="card"><p class="msg bad">' + esc(e.message) + '</p></div>'; return null; });
    if (!d) return;
    if (!d.service) return notSetUp(root);
    var t = terms();
    var days = []; for (var i = 0; i < SPAN; i++) days.push(addDays(FROM, i));
    var startMs = Date.parse(new Date(fmtStart(FROM)).toISOString());
    var spanMs = SPAN * 86400000;
    var cols = 'grid-template-columns:repeat(' + SPAN + ',minmax(0,1fr))';
    var active = d.vehicles.filter(function (v) { return v.hire_status !== 'archived'; });

    // free per day (bookable vehicles not busy at any time that day — approximate: busy all day)
    function freeOn(ymd) {
      var a = Date.parse(fmtStart(ymd)), b = a + 86400000;
      var n = 0;
      active.forEach(function (v) {
        if (v.hire_status !== 'active') return;
        var busy = d.reservations.some(function (r) { return r.resource_id === v.id && ['pending', 'confirmed', 'checked_in', 'in_progress'].indexOf(r.status) >= 0 && Date.parse(r.starts_at) < b - 6 * 3600000 && Date.parse(r.ends_at) > a + 12 * 3600000; });
        var blocked = d.blocks.some(function (x) { return (x.scope === 'business' || x.scope_id === v.id) && Date.parse(x.starts_at) < b && Date.parse(x.ends_at) > a; });
        if (!busy && !blocked) n++;
      });
      return n;
    }
    var todayY = ymdLocal(new Date());
    var head = '<div class="hx-ch"><div class="hx-name" style="background:#fafbfc"><b>' + esc(t.plural) + '</b><small>' + active.filter(function (v) { return v.hire_status === 'active'; }).length + ' on the road</small></div><div class="hx-days" style="' + cols + '">' +
      days.map(function (y) {
        var p = y.split('-').map(Number); var dt = new Date(p[0], p[1] - 1, p[2]);
        var f = freeOn(y), tot = active.filter(function (v) { return v.hire_status === 'active'; }).length;
        var cls = f === 0 ? 'none' : (f <= Math.max(1, Math.floor(tot / 3)) ? 'few' : 'ok');
        return '<div class="hx-day' + (y === todayY ? ' today' : '') + (dt.getDay() === 0 || dt.getDay() === 6 ? ' we' : '') + '">' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getDay()] + '<b>' + dt.getDate() + '</b><span class="hx-free ' + cls + '">' + f + '/' + tot + ' free</span></div>';
      }).join('') + '</div></div>';

    var rows = active.map(function (v) {
      var bars = '';
      d.reservations.filter(function (r) { return r.resource_id === v.id && r.status !== 'cancelled'; }).forEach(function (r) {
        bars += bar(r.starts_at, r.ends_at, startMs, spanMs, 'hx-bar ' + esc(r.status), '<strong>' + esc(r.customer_name || r.reference) + '</strong><small>' + esc(label(r.status)) + ' · ' + esc(fmt(r.starts_at, { hour: 'numeric', minute: '2-digit' })) + ' → ' + esc(fmt(r.ends_at, { weekday: 'short', hour: 'numeric', minute: '2-digit' })) + '</small>', 'data-hx="open" data-id="' + esc(r.booking_id) + '"');
      });
      d.blocks.filter(function (x) { return x.scope === 'business' || x.scope_id === v.id; }).forEach(function (x) {
        bars += bar(x.starts_at, x.ends_at, startMs, spanMs, 'hx-bar block', '<strong>' + esc(x.title || 'Unavailable') + '</strong><small>' + (x.kind === 'maintenance' ? 'Repairs' : x.kind === 'closed' ? 'Closed' : 'Unavailable') + ' · click to remove</small>', 'data-hx="unblock" data-id="' + esc(x.id) + '"');
      });
      var slots = days.map(function (y) { return '<div class="hx-slot" data-hx="new" data-truck="' + esc(v.id) + '" data-ymd="' + y + '" title="New booking"></div>'; }).join('');
      return '<div class="hx-cr"><div class="hx-name"><b>' + esc(vName(v)) + '</b><small>' + esc([v.registration_number, [v.make, v.model].filter(Boolean).join(' ')].filter(Boolean).join(' · ')) + '</small>' +
        (v.hire_status !== 'active' ? '<span class="hx-pill ' + esc(v.hire_status) + '">' + esc(v.hire_status === 'maintenance' ? 'Repairs' : 'Off the road') + '</span>' : '') + '</div>' +
        '<div class="hx-lane" style="' + cols + '">' + slots + bars + '</div></div>';
    }).join('');
    var nowPct = (Date.now() - startMs) / spanMs * 100;
    var nowLine = nowPct > 0 && nowPct < 100 ? '<div class="hx-now" style="left:calc(var(--hx-name,190px) + (100% - var(--hx-name,190px)) * ' + (nowPct / 100).toFixed(4) + ')"></div>' : '';

    root.innerHTML = '<div class="hx-row" style="margin-bottom:10px"><div><strong style="font-size:1.1rem">Fleet calendar</strong><div class="sub" style="margin:0">' + esc(fmt(fmtStart(FROM), { day: 'numeric', month: 'short' })) + ' – ' + esc(fmt(fmtStart(addDays(FROM, SPAN - 1)), { day: 'numeric', month: 'short', year: 'numeric' })) + ' · click an empty day to book</div></div>' +
      '<div><button class="btn ghost" type="button" data-hx="prev">‹ Prev</button><button class="btn ghost" type="button" data-hx="today">Today</button><button class="btn ghost" type="button" data-hx="next">Next ›</button>' +
      '<button class="btn ghost" type="button" data-hx="block">Mark unavailable</button><button class="btn solid" type="button" data-hx="phone">+ Phone booking</button></div></div>' +
      (active.length ? '<div class="hx-cal-wrap"><div class="hx-cal">' + head + rows + nowLine + '</div></div>' : '<div class="card"><p class="sub">No ' + esc(t.plural.toLowerCase()) + ' yet.</p><button class="btn solid" type="button" data-hx="add-truck">+ Add ' + esc(t.singular.toLowerCase()) + '</button></div>') +
      '<div class="hx-legend"><span><i style="background:#f59e0b"></i>Request (holds the ' + esc(t.singular.toLowerCase()) + ')</span><span><i style="background:var(--accent,#155c4a)"></i>Confirmed</span><span><i style="background:#2563eb"></i>Out on hire</span><span><i style="background:#9ca3af"></i>Returned</span><span><i style="background:repeating-linear-gradient(135deg,#e5e7eb 0 4px,#d1d5db 4px 8px)"></i>Unavailable / repairs</span></div>';
    root.onclick = calClick;
  }
  function fmtStart(ymd) {
    // midnight of ymd in the business timezone, as an ISO string (Australia: +10/+11)
    var guess = new Date(ymd + 'T00:00:00Z');
    var off = tzOffsetMin(guess);
    return new Date(guess.getTime() - off * 60000).toISOString();
  }
  function tzOffsetMin(date) {
    var s = date.toLocaleString('en-US', { timeZone: tz(), hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    var m = /(\d+)\/(\d+)\/(\d+),\s*(\d+):(\d+)/.exec(s);
    if (!m) return 600;
    var asUtc = Date.UTC(+m[3], +m[1] - 1, +m[2], +m[4] % 24, +m[5]);
    return Math.round((asUtc - date.getTime()) / 60000);
  }
  function bar(startIso, endIso, startMs, spanMs, cls, inner, attrs) {
    var a = Math.max(0, (Date.parse(startIso) - startMs) / spanMs);
    var b = Math.min(1, (Date.parse(endIso) - startMs) / spanMs);
    if (b <= 0 || a >= 1 || b <= a) return '';
    return '<button type="button" class="' + cls + '" ' + attrs + ' style="left:calc(' + (a * 100).toFixed(3) + '% + 2px);width:calc(' + ((b - a) * 100).toFixed(3) + '% - 4px)">' + inner + '</button>';
  }
  async function calClick(e) {
    var el = e.target.closest('[data-hx]'); if (!el) return;
    var a = el.getAttribute('data-hx');
    if (a === 'prev') { FROM = addDays(FROM, -7); return refresh(); }
    if (a === 'next') { FROM = addDays(FROM, 7); return refresh(); }
    if (a === 'today') { FROM = null; return refresh(); }
    if (a === 'phone') return phoneBooking({});
    if (a === 'add-truck') return truckEditor(null);
    if (a === 'new') return phoneBooking({ resource_id: el.getAttribute('data-truck'), date: el.getAttribute('data-ymd') });
    if (a === 'open') return bookingPanel(el.getAttribute('data-id'));
    if (a === 'block') return blockForm(null);
    if (a === 'unblock') {
      if (!confirm('Make this available again?')) return;
      try { await call('remove_block', { id: el.getAttribute('data-id') }); flash('Removed.'); refresh(); } catch (err) { flash(err.message, true); }
    }
  }

  /* ================================================================ BOOKING PANEL */
  async function bookingPanel(id) {
    ensureCss();
    var s = side('<p class="sub">Loading…</p>');
    var j;
    try { j = await call('booking', { booking_id: id }); } catch (err) { s.innerHTML = '<p class="msg bad">' + esc(err.message) + '</p>'; return; }
    var b = j.booking, h = j.hire || {}, v = j.vehicle || {}, drv = h.driver_json || {};
    var st = b.status;
    var acts = '';
    if (st === 'pending') acts += '<button class="btn solid" type="button" data-p="approve">Approve</button><button class="btn ghost" type="button" data-p="decline">Decline</button>';
    if (st === 'confirmed') acts += '<button class="btn solid" type="button" data-p="in_progress">Picked up</button>';
    if (st === 'in_progress' || st === 'checked_in') acts += '<button class="btn solid" type="button" data-p="completed">Returned</button>';
    if (st === 'confirmed') acts += '<button class="btn ghost" type="button" data-p="no_show">No-show</button>';
    if (['pending', 'confirmed'].indexOf(st) >= 0) acts += '<button class="btn ghost" type="button" data-p="cancel">Cancel booking</button>';
    var fee = j.cancellation && (j.cancellation.fee_cents != null ? j.cancellation.fee_cents : j.cancellation.cancellation_fee_cents);
    s.innerHTML = '<div class="hx-row" style="margin-bottom:8px"><strong style="font-size:1.1rem">' + esc(b.reference) + ' <span class="hx-pill ' + esc(st) + '">' + esc(label(st)) + '</span></strong><button class="btn ghost" type="button" id="side-close">Close</button></div>' +
      '<dl class="hx-dl">' +
      '<dt>Customer</dt><dd><strong>' + esc(b.customer_name) + '</strong><br><a href="tel:' + esc(String(b.customer_phone || '').replace(/[^0-9+]/g, '')) + '">' + esc(b.customer_phone || '') + '</a><br><a href="mailto:' + esc(b.customer_email || '') + '">' + esc(b.customer_email || '') + '</a></dd>' +
      '<dt>' + esc(terms().singular) + '</dt><dd>' + esc(vName(v)) + (v.registration_number ? '<br><small class="sub">Rego ' + esc(v.registration_number) + '</small>' : '') + '</dd>' +
      '<dt>Pick up</dt><dd>' + esc(fmt(h.pickup_at || b.starts_at)) + '</dd>' +
      '<dt>Return by</dt><dd>' + esc(fmt(h.return_at || b.ends_at)) + '</dd>' +
      '<dt>Hire total</dt><dd><strong>' + money(b.total_cents) + '</strong> · paid ' + money(b.amount_paid_cents || 0) + '</dd>' +
      (h.bond_cents ? '<dt>Bond</dt><dd>' + money(h.bond_cents) + '</dd>' : '') +
      '<dt>Licence</dt><dd>' + esc([drv.licence_number, drv.licence_state, drv.licence_expiry ? 'exp ' + drv.licence_expiry : ''].filter(Boolean).join(' · ') || '—') + '</dd>' +
      '<dt>Card</dt><dd>' + (j.card ? esc((j.card.brand || 'Card').toUpperCase() + ' •••• ' + j.card.last4 + ' (exp ' + pad(j.card.exp_month) + '/' + String(j.card.exp_year).slice(-2) + ')') : 'Not saved') + '</dd>' +
      (b.customer_notes ? '<dt>Notes</dt><dd>' + esc(b.customer_notes) + '</dd>' : '') +
      (b.internal_notes ? '<dt>Staff notes</dt><dd>' + esc(b.internal_notes) + '</dd>' : '') +
      '<dt>Source</dt><dd>' + esc(b.source === 'public' ? 'Website' : 'Staff') + '</dd></dl>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 12px">' + acts + '</div>' +
      (j.can_charge ? '<div class="card" style="margin:0 0 12px"><h2 style="font-size:14px">Charge the saved card</h2><div class="hx-form"><div class="field"><label>Amount ($)</label><input id="hx-ch-amt" value="' + esc(dollars(Math.max(0, (b.total_cents || 0) - (b.amount_paid_cents || 0)))) + '"></div><div class="field"><label>What for</label><input id="hx-ch-desc" value="Hire"></div></div><button class="btn solid" type="button" data-p="charge" style="margin-top:8px">Charge card</button></div>' : '') +
      (fee != null && ['pending', 'confirmed'].indexOf(st) >= 0 ? '<p class="sub">Cancelling now: fee by your policy would be ' + money(fee) + '.</p>' : '') +
      '<details><summary class="sub">Activity</summary>' + (j.activity || []).map(function (x) { return '<div class="sub" style="margin:4px 0">' + esc(x.summary) + ' · ' + esc(fmt(x.created_at)) + '</div>'; }).join('') + '</details>';
    s.onclick = async function (e) {
      var el = e.target.closest('[data-p]'); if (!el) return;
      var a = el.getAttribute('data-p');
      try {
        if (a === 'approve') { await call('approve', { booking_id: id }); flash('Approved — confirmation emailed.'); }
        else if (a === 'decline') { var why = prompt('Reason (sent to the customer, optional):', ''); if (why === null) return; await call('decline', { booking_id: id, reason: why }); flash('Declined.'); }
        else if (a === 'cancel') { var r2 = prompt('Cancel this booking? Reason (optional):', ''); if (r2 === null) return; var em = confirm('Email the customer to tell them it’s cancelled?'); await call('cancel', { booking_id: id, reason: r2, email: em }); flash('Cancelled.'); }
        else if (a === 'charge') {
          var amt = cents(document.getElementById('hx-ch-amt').value);
          if (!amt) return flash('Enter an amount.', true);
          if (!confirm('Charge ' + money(amt) + ' to the saved card?')) return;
          await call('charge', { booking_id: id, amount_cents: amt, description: document.getElementById('hx-ch-desc').value });
          flash('Charged ' + money(amt) + '.');
        } else { await call('set_status', { booking_id: id, status: a }); flash('Updated.'); }
        closeSide(); refresh();
      } catch (err) { flash(err.message, true); }
    };
  }

  /* ================================================================ PHONE BOOKING */
  function timesList() {
    var h = (DATA && DATA.system && DATA.system.hire) || {};
    var a = toMin(h.open_time || '07:30'), b = toMin(h.close_time || '17:00'), st = Number(h.time_step) || 30, out = [];
    for (var t = a; t <= b; t += st) out.push(pad(Math.floor(t / 60)) + ':' + pad(t % 60));
    return out;
  }
  function toMin(s) { var p = String(s).split(':').map(Number); return p[0] * 60 + (p[1] || 0); }

  async function phoneBooking(pre) {
    ensureCss();
    if (!DATA) { var td = ymdLocal(new Date()); await load(td, addDays(td, 13)); }
    var t = terms();
    var st = { date: pre.date || ymdLocal(new Date()), time: '', days: 1, resource_id: pre.resource_id || '', options: null, key: 'staff-' + Date.now().toString(36) };
    st.time = timesList()[0] || '08:00';
    var s = side('');
    function paint() {
      s.innerHTML = '<div class="hx-row" style="margin-bottom:8px"><strong style="font-size:1.1rem">Phone booking</strong><button class="btn ghost" type="button" id="side-close">Close</button></div>' +
        '<div class="hx-form">' +
        '<div class="field"><label>Pick up date</label><input type="date" id="pb-date" value="' + esc(st.date) + '"></div>' +
        '<div class="field"><label>Pick up time</label><select id="pb-time">' + timesList().map(function (x) { return '<option' + (x === st.time ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label>Days</label><input type="number" min="1" max="365" id="pb-days" value="' + st.days + '"></div>' +
        '<div class="field" style="display:flex;align-items:flex-end"><button class="btn solid" type="button" id="pb-find" style="width:100%">Find ' + esc(t.plural.toLowerCase()) + '</button></div></div>' +
        '<div id="pb-opts" style="margin-top:12px">' + (st.options ? optsHtml() : '<p class="sub">Pick dates, then find what’s free.</p>') + '</div>' +
        (st.options ? customerHtml() : '');
      wire();
    }
    function optsHtml() {
      return st.options.map(function (o) {
        var v = o.vehicle, on = st.resource_id === v.id;
        var why = o.available ? '' : (o.off_road ? 'Off the road' : o.blocked.length ? (o.blocked[0].title || 'Unavailable') : o.busy.length ? 'Booked: ' + o.busy.map(function (x) { return x.customer_name || x.reference; }).join(', ') : '');
        return '<div class="hx-opt' + (on ? ' on' : '') + (o.available ? '' : ' off') + '" data-pick="' + esc(v.id) + '"><div><strong>' + esc(vName(v)) + '</strong> <small class="sub">' + esc(v.registration_number || '') + '</small><div class="sub" style="margin:0">' + (o.available ? 'Free' : esc(why)) + '</div></div><div><strong>' + (o.quote ? money(o.quote.total_cents) : '') + '</strong></div></div>';
      }).join('');
    }
    function customerHtml() {
      var pick = st.options.find(function (o) { return o.vehicle.id === st.resource_id; });
      if (!pick) return '<p class="sub">Choose a ' + esc(t.singular.toLowerCase()) + ' above.</p>';
      return '<div class="hx-form" style="margin-top:10px"><h3>Customer</h3>' +
        '<div class="field wide"><label>Name</label><input id="pb-name" autocomplete="off"></div>' +
        '<div class="field"><label>Phone</label><input id="pb-phone" type="tel"></div>' +
        '<div class="field"><label>Email</label><input id="pb-email" type="email"></div>' +
        '<div class="field"><label>Licence number</label><input id="pb-lic"></div>' +
        '<div class="field"><label>Licence state</label><select id="pb-state"><option>ACT</option><option>NSW</option><option>VIC</option><option>QLD</option><option>SA</option><option>WA</option><option>TAS</option><option>NT</option><option>Overseas</option></select></div>' +
        '<div class="field wide"><label>Customer notes</label><textarea id="pb-notes" rows="2"></textarea></div>' +
        '<div class="field wide"><label>Staff notes (not shown to customer)</label><textarea id="pb-int" rows="2"></textarea></div>' +
        '<div class="field"><label>Status</label><select id="pb-status"><option value="confirmed">Confirmed</option><option value="pending">Pencilled in (pending)</option></select></div>' +
        '<div class="field"><label>Price change ($, optional)</label><input id="pb-adj" placeholder="e.g. -20"></div>' +
        '<label class="wide" style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="pb-email-send" checked> Email the customer a confirmation</label>' +
        (!pick.available ? '<label class="wide" style="display:flex;gap:8px;align-items:center;font-size:13px;color:#b45309"><input type="checkbox" id="pb-override"> Book anyway (this ' + esc(t.singular.toLowerCase()) + ' is busy or off the road)</label>' : '') +
        '<p class="msg bad wide hidden" id="pb-err"></p>' +
        '<button class="btn solid wide" type="button" id="pb-save">Book ' + esc(vName(pick.vehicle)) + ' — ' + (pick.quote ? money(pick.quote.total_cents) : '') + '</button></div>';
    }
    function wire() {
      var f = document.getElementById('pb-find');
      f.onclick = async function () {
        st.date = document.getElementById('pb-date').value; st.time = document.getElementById('pb-time').value; st.days = Math.max(1, Number(document.getElementById('pb-days').value) || 1);
        f.disabled = true;
        try { var j = await call('options', { pickup_ymd: st.date, pickup_hm: st.time, hire_days: st.days }); st.options = j.options; if (!st.resource_id || !st.options.some(function (o) { return o.vehicle.id === st.resource_id; })) { var fr = st.options.find(function (o) { return o.available; }); st.resource_id = fr ? fr.vehicle.id : ''; } paint(); }
        catch (err) { flash(err.message, true); f.disabled = false; }
      };
      s.querySelectorAll('[data-pick]').forEach(function (el) {
        el.onclick = function () {
          // keep anything already typed about the customer when switching vehicle
          var keep = {};
          s.querySelectorAll('[id^="pb-"]').forEach(function (f) { if (f.id === 'pb-date' || f.id === 'pb-time' || f.id === 'pb-days' || f.id === 'pb-override') return; if ('value' in f) keep[f.id] = f.type === 'checkbox' ? f.checked : f.value; });
          st.resource_id = el.getAttribute('data-pick'); paint();
          Object.keys(keep).forEach(function (id) { var f = document.getElementById(id); if (!f) return; if (f.type === 'checkbox') f.checked = keep[id]; else f.value = keep[id]; });
        };
      });
      var save = document.getElementById('pb-save');
      if (save) save.onclick = async function () {
        var err = document.getElementById('pb-err');
        var name = document.getElementById('pb-name').value.trim();
        if (!name) { err.textContent = 'Add the customer’s name.'; err.classList.remove('hidden'); return; }
        save.disabled = true;
        try {
          var adj = cents(document.getElementById('pb-adj').value);
          var r = await call('phone_booking', {
            resource_id: st.resource_id, pickup_ymd: st.date, pickup_hm: st.time, hire_days: st.days,
            name: name, phone: document.getElementById('pb-phone').value, email: document.getElementById('pb-email').value,
            licence_number: document.getElementById('pb-lic').value, licence_state: document.getElementById('pb-state').value,
            notes: document.getElementById('pb-notes').value, internal_notes: document.getElementById('pb-int').value,
            status: document.getElementById('pb-status').value, send_email: document.getElementById('pb-email-send').checked,
            override: !!(document.getElementById('pb-override') && document.getElementById('pb-override').checked),
            adjustment_cents: adj === '' ? 0 : adj, idempotency_key: st.key
          });
          flash('Booked ' + r.booking.reference + '.');
          closeSide(); refresh();
        } catch (e2) {
          save.disabled = false;
          var body = e2.body || {};
          err.textContent = body.error === 'resource_conflict' ? 'That ' + t.singular.toLowerCase() + ' is already booked then. Tick “Book anyway” to double-book it.' : (body.message || e2.message);
          err.classList.remove('hidden');
        }
      };
    }
    paint();
    if (pre.date) document.getElementById('pb-find').click();
  }

  /* ================================================================ FLEET (vehicles) */
  async function trucks(root) {
    ensureCss();
    root.innerHTML = '<p class="sub">Loading…</p>';
    var today = ymdLocal(new Date());
    var d = await load(today, addDays(today, 30)).catch(function (e) { root.innerHTML = '<div class="card"><p class="msg bad">' + esc(e.message) + '</p></div>'; return null; });
    if (!d) return;
    if (!d.service) return notSetUp(root);
    var t = terms();
    root.innerHTML = '<div class="hx-row" style="margin-bottom:10px"><div><strong style="font-size:1.1rem">Fleet</strong><div class="sub" style="margin:0">' + d.vehicles.length + ' ' + esc((d.vehicles.length === 1 ? t.singular : t.plural).toLowerCase()) + ' · rego, rates and availability</div></div>' +
      '<div><button class="btn ghost" type="button" data-hx="block">Mark unavailable</button><button class="btn solid" type="button" data-hx="add">+ Add ' + esc(t.singular.toLowerCase()) + '</button></div></div>' +
      '<div class="hx-trucks">' + d.vehicles.map(function (v) {
        var dr = (v.hire_meta && v.hire_meta.day_rates) || {};
        var rates = 'From ' + money(Math.min.apply(null, [v.default_daily_rate_cents || 0].concat(Object.keys(dr).map(function (k) { return dr[k]; })))) + '/day';
        var blocks = d.blocks.filter(function (x) { return x.scope_id === v.id; });
        var due = [['Rego', v.registration_expires_on], ['Service', v.service_due_on], ['Insurance', v.insurance_expires_on]].filter(function (x) { return x[1] && Date.parse(x[1]) - Date.now() < 30 * 86400000; });
        return '<div class="hx-truck"><div class="ph" style="' + (v.image_url ? 'background-image:url(&quot;' + esc(v.image_url) + '&quot;)' : '') + '">' + (v.image_url ? '' : 'No photo') + '</div><div class="bd">' +
          '<strong>' + esc(vName(v)) + ' <span class="hx-pill ' + esc(v.hire_status) + '">' + esc(v.hire_status === 'active' ? 'On the road' : v.hire_status === 'maintenance' ? 'Repairs' : 'Off the road') + '</span></strong>' +
          '<span class="sub" style="margin:0">' + esc([v.year_built, v.make, v.model].filter(Boolean).join(' ')) + (v.registration_number ? ' · Rego <strong>' + esc(v.registration_number) + '</strong>' : '') + '</span>' +
          '<span class="sub" style="margin:0">' + esc(rates) + (v.bond_cents ? ' · bond ' + money(v.bond_cents) : '') + (v.included_km ? ' · ' + v.included_km + 'km/day' : '') + '</span>' +
          blocks.map(function (x) { return '<span class="sub" style="margin:0;color:#92400e">⚠ ' + esc(x.title || 'Unavailable') + ': ' + esc(blockRange(x)) + ' <a href="#" data-hx="unblock" data-id="' + esc(x.id) + '">remove</a></span>'; }).join('') +
          due.map(function (x) { return '<span class="sub" style="margin:0;color:#b91c1c">' + esc(x[0]) + ' due ' + esc(x[1]) + '</span>'; }).join('') +
          '<div class="btns"><button class="btn ghost" type="button" data-hx="edit" data-id="' + esc(v.id) + '">Edit</button><button class="btn ghost" type="button" data-hx="block" data-id="' + esc(v.id) + '">Mark unavailable</button></div></div></div>';
      }).join('') + '</div>' +
      (!d.vehicles.length ? '<div class="card"><p class="sub">Add each ' + esc(t.singular.toLowerCase()) + ' with its make, model and rego. Customers see the name, make, model and photo — never the rego.</p></div>' : '');
    root.onclick = async function (e) {
      var el = e.target.closest('[data-hx]'); if (!el) return;
      e.preventDefault();
      var a = el.getAttribute('data-hx');
      if (a === 'add') return truckEditor(null);
      if (a === 'edit') return truckEditor(vehicleById(el.getAttribute('data-id')));
      if (a === 'block') return blockForm(el.getAttribute('data-id'));
      if (a === 'unblock') { if (!confirm('Make it available again?')) return; try { await call('remove_block', { id: el.getAttribute('data-id') }); flash('Removed.'); refresh(); } catch (err) { flash(err.message, true); } }
    };
  }

  function truckEditor(v) {
    ensureCss();
    v = v || { hire_status: 'active', resource_type: 'vehicle', min_hire_days: 1 };
    var t = terms();
    var dr = (v.hire_meta && v.hire_meta.day_rates) || {};
    var feats = ((v.hire_meta && v.hire_meta.features) || []).join('\n');
    function inp(id, label, val, extra) { return '<div class="field ' + ((extra && extra.cls) || '') + '"><label>' + esc(label) + '</label><input id="tv-' + id + '" value="' + esc(val == null ? '' : val) + '"' + ((extra && extra.attrs) || '') + '></div>'; }
    var s = side('<div class="hx-row" style="margin-bottom:8px"><strong style="font-size:1.1rem">' + (v.id ? 'Edit ' : 'Add ') + esc(t.singular.toLowerCase()) + '</strong><button class="btn ghost" type="button" id="side-close">Close</button></div>' +
      '<div class="hx-form">' +
      '<h3>Vehicle</h3>' +
      inp('name', 'Internal name (e.g. Truck 3)', v.name) + inp('public_name', 'Name customers see', v.public_name) +
      inp('make', 'Make', v.make) + inp('model', 'Model', v.model) +
      inp('year_built', 'Year', v.year_built, { attrs: ' type="number"' }) + inp('registration_number', 'Rego', v.registration_number) +
      inp('fleet_number', 'Fleet number (optional)', v.fleet_number) +
      '<div class="field"><label>Status</label><select id="tv-hire_status"><option value="active"' + (v.hire_status === 'active' ? ' selected' : '') + '>On the road (bookable)</option><option value="maintenance"' + (v.hire_status === 'maintenance' ? ' selected' : '') + '>In for repairs (not bookable)</option><option value="unavailable"' + (v.hire_status === 'unavailable' ? ' selected' : '') + '>Off the road (not bookable)</option></select></div>' +
      inp('image_url', 'Photo URL', v.image_url, { cls: 'wide' }) +
      '<h3>Pricing</h3>' +
      inp('default_daily_rate_cents', 'Standard day rate ($)', dollars(v.default_daily_rate_cents)) + inp('weekend_rate_cents', 'Weekend day rate ($, optional)', dollars(v.weekend_rate_cents)) +
      '<div class="field wide"><label>Rate by weekday ($, optional — overrides the above)</label><div class="hx-days7">' + ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(function (k) { return '<div><label>' + DAY_LABEL[k] + '</label><input id="tv-dr-' + k + '" value="' + esc(dollars(dr[k])) + '" placeholder="–"></div>'; }).join('') + '</div></div>' +
      inp('public_holiday_rate_cents', 'Public holiday rate ($, optional)', dollars(v.public_holiday_rate_cents)) + inp('bond_cents', 'Bond ($)', dollars(v.bond_cents)) +
      inp('included_km', 'Km included per day', v.included_km, { attrs: ' type="number"' }) + inp('excess_km_rate_cents', 'Extra km ($ per km)', dollars(v.excess_km_rate_cents)) +
      inp('min_hire_days', 'Minimum days', v.min_hire_days || 1, { attrs: ' type="number" min="1"' }) + inp('max_hire_days', 'Maximum days (optional)', v.max_hire_days, { attrs: ' type="number"' }) +
      '<h3>Details customers see</h3>' +
      inp('licence_class', 'Licence needed', v.licence_class) + inp('carrying_capacity', 'Payload / capacity', v.carrying_capacity) +
      inp('transmission', 'Transmission', v.transmission) +
      '<div class="field wide"><label>Features (one per line)</label><textarea id="tv-features" rows="3">' + esc(feats) + '</textarea></div>' +
      '<div class="field wide"><label>Description</label><textarea id="tv-description" rows="2">' + esc(v.description || '') + '</textarea></div>' +
      '<h3>Upkeep (staff only)</h3>' +
      inp('registration_expires_on', 'Rego expires', v.registration_expires_on, { attrs: ' type="date"' }) + inp('service_due_on', 'Service due', v.service_due_on, { attrs: ' type="date"' }) +
      inp('insurance_expires_on', 'Insurance expires', v.insurance_expires_on, { attrs: ' type="date"' }) + inp('odometer_km', 'Odometer (km)', v.odometer_km, { attrs: ' type="number"' }) +
      '<div class="field wide"><label>Staff notes</label><textarea id="tv-staff_notes" rows="2">' + esc((v.hire_meta && v.hire_meta.staff_notes) || '') + '</textarea></div>' +
      '<p class="msg bad wide hidden" id="tv-err"></p>' +
      '<button class="btn solid wide" type="button" id="tv-save">Save</button>' +
      (v.id ? '<button class="btn ghost wide" type="button" id="tv-archive">Remove from fleet</button>' : '') + '</div>');
    function val(id) { var el = document.getElementById('tv-' + id); return el ? el.value : ''; }
    document.getElementById('tv-save').onclick = async function () {
      var day = {}; ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].forEach(function (k) { var c = cents(val('dr-' + k)); if (c !== '') day[k] = c; });
      var body = { id: v.id || undefined };
      ['name', 'public_name', 'make', 'model', 'year_built', 'registration_number', 'fleet_number', 'hire_status', 'image_url', 'included_km', 'min_hire_days', 'max_hire_days', 'licence_class', 'carrying_capacity', 'transmission', 'description', 'registration_expires_on', 'service_due_on', 'insurance_expires_on', 'odometer_km', 'staff_notes'].forEach(function (k) { body[k] = val(k); });
      ['default_daily_rate_cents', 'weekend_rate_cents', 'public_holiday_rate_cents', 'bond_cents', 'excess_km_rate_cents'].forEach(function (k) { body[k] = cents(val(k)); });
      body.day_rates = day;
      body.features = val('features');
      var err = document.getElementById('tv-err');
      if (!body.name && !body.make) { err.textContent = 'Add a name or make.'; err.classList.remove('hidden'); return; }
      if (!body.default_daily_rate_cents && !Object.keys(day).length) { err.textContent = 'Add a day rate.'; err.classList.remove('hidden'); return; }
      try { await call('save_vehicle', { vehicle: body }); flash('Saved.'); closeSide(); refresh(); } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); }
    };
    var ar = document.getElementById('tv-archive');
    if (ar) ar.onclick = async function () { if (!confirm('Remove ' + vName(v) + ' from the fleet? Past bookings are kept.')) return; try { await call('archive_vehicle', { id: v.id }); flash('Removed.'); closeSide(); refresh(); } catch (e) { flash(e.message, true); } };
  }

  function blockForm(resourceId) {
    ensureCss();
    var t = terms();
    var today = ymdLocal(new Date());
    var s = side('<div class="hx-row" style="margin-bottom:8px"><strong style="font-size:1.1rem">Mark unavailable</strong><button class="btn ghost" type="button" id="side-close">Close</button></div>' +
      '<p class="sub">Customers can’t book it for these dates. Use it for repairs, servicing, a private job or anything else.</p>' +
      '<div class="hx-form">' +
      '<div class="field wide"><label>' + esc(t.singular) + '</label><select id="bl-res"><option value="">Whole business (closed)</option>' + ((DATA && DATA.vehicles) || []).map(function (v) { return '<option value="' + esc(v.id) + '"' + (v.id === resourceId ? ' selected' : '') + '>' + esc(vName(v)) + (v.registration_number ? ' — ' + esc(v.registration_number) : '') + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>From</label><input type="date" id="bl-from" value="' + today + '"></div>' +
      '<div class="field"><label>To (inclusive)</label><input type="date" id="bl-to" value="' + today + '"></div>' +
      '<div class="field"><label>Reason</label><select id="bl-kind"><option value="maintenance">Repairs / servicing</option><option value="block">Private booking / other</option></select></div>' +
      '<div class="field"><label>Note (staff only)</label><input id="bl-reason" placeholder="e.g. Brake service"></div>' +
      '<p class="msg wide hidden" id="bl-msg"></p>' +
      '<button class="btn solid wide" type="button" id="bl-save">Save</button></div>');
    if (!resourceId) document.getElementById('bl-res').value = ((DATA && DATA.vehicles && DATA.vehicles[0]) || {}).id || '';
    document.getElementById('bl-save').onclick = async function () {
      var res = document.getElementById('bl-res').value;
      try {
        var r = await call('add_block', { resource_id: res || null, from_ymd: document.getElementById('bl-from').value, to_ymd: document.getElementById('bl-to').value, kind: res ? document.getElementById('bl-kind').value : 'closed', reason: document.getElementById('bl-reason').value });
        if (r.clashes && r.clashes.length) alert('Saved — but ' + r.clashes.length + ' booking(s) already fall in that period: ' + r.clashes.map(function (c) { return c.reference + ' (' + (c.customer_name || '') + ')'; }).join(', ') + '. Move or cancel them from the fleet calendar.');
        flash('Marked unavailable.'); closeSide(); refresh();
      } catch (e) { var m = document.getElementById('bl-msg'); m.textContent = e.message; m.classList.add('bad'); m.classList.remove('hidden'); }
    };
  }

  /* ================================================================ HIRE SETTINGS */
  async function hiresettings(root) {
    ensureCss();
    var today = ymdLocal(new Date());
    var d = await load(today, today).catch(function (e) { root.innerHTML = '<div class="card"><p class="msg bad">' + esc(e.message) + '</p></div>'; return null; });
    if (!d) return;
    var h = d.system.hire || {};
    var durs = (h.durations || []).map(function (x) { return x.label + ' = ' + x.days; }).join('\n');
    var closed = h.closed_weekdays || [];
    root.innerHTML = (d.service ? '' : '<div class="card"><h2>Not set up yet</h2><p class="sub">Choose a set-up below first.</p></div>') +
      '<div class="card"><h2>Hire booking settings</h2><div class="hx-form">' +
      '<label class="wide" style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" id="hs-enabled"' + (d.system.enabled ? ' checked' : '') + '> Take bookings online</label>' +
      '<h3>Business</h3>' +
      field('hs-biz', 'Business name', d.system.business_name) + field('hs-phone', 'Phone (shown to customers)', d.system.phone) +
      field('hs-email', 'Email (gets new request alerts)', d.system.email, 'wide') +
      '<h3>Pick ups</h3>' +
      field('hs-open', 'First pick-up time', h.open_time || '07:30', '', ' type="time"') + field('hs-close', 'Last pick-up time', h.close_time || '17:00', '', ' type="time"') +
      field('hs-step', 'Time slots every (minutes)', h.time_step || 30, '', ' type="number"') + field('hs-notice', 'Book at least this many days ahead', h.min_notice_days || 0, '', ' type="number" min="0"') +
      field('hs-maxdays', 'Longest online booking (days)', h.max_public_days || 30, '', ' type="number"') + field('hs-maxjobs', 'Most hire jobs per day', d.system.max_daily_jobs || 4, '', ' type="number"') +
      '<div class="field wide"><label>Closed for pick ups on</label><div class="chips">' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(function (w, i) { return '<label class="chip' + (closed.indexOf(i) >= 0 ? ' on' : '') + '"><input type="checkbox" class="hs-closed" value="' + i + '"' + (closed.indexOf(i) >= 0 ? ' checked' : '') + ' style="display:none">' + w + '</label>'; }).join('') + '</div></div>' +
      '<div class="field wide"><label>Hire lengths offered (one per line: label = days)</label><textarea id="hs-durs" rows="4" placeholder="1 Day (24 hours) = 1">' + esc(durs) + '</textarea></div>' +
      '<div class="field wide"><label>Public holidays (YYYY-MM-DD, one per line — uses the holiday rate)</label><textarea id="hs-hols" rows="3">' + esc((h.public_holidays || []).join('\n')) + '</textarea></div>' +
      '<div class="field wide"><label>Hire terms (shown before booking)</label><textarea id="hs-terms" rows="5">' + esc(h.booking_terms || '') + '</textarea></div>' +
      '<label class="wide" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="hs-left"' + (h.show_left !== false ? ' checked' : '') + '> Show “X left” on the booking calendar</label>' +
      '<h3>Cards</h3>' +
      '<div class="field wide"><label>Stripe account ID (acct_…) — customers save a card when booking; you charge it later</label><input id="hs-stripe" value="' + esc(d.system.stripe_connect_account_id || '') + '" placeholder="acct_…"></div>' +
      '<p class="sub wide">' + (d.system.card_saving ? 'Card saving is on.' : 'Card saving is off until a connected Stripe account is added. Bookings still work — you take payment at pick up.') + '</p>' +
      '<button class="btn solid wide" type="button" id="hs-save">Save settings</button></div></div>' +
      '<div class="card"><h2>Booking set-ups</h2><p class="sub">Presets for other kinds of business. Adding one only adds what’s missing.</p><div id="hx-presets-all" class="hx-presets"></div></div>';
    paintPresets(document.getElementById('hx-presets-all'));
    root.querySelectorAll('.hs-closed').forEach(function (c) { c.parentNode.onclick = function (e) { e.preventDefault(); c.checked = !c.checked; c.parentNode.classList.toggle('on', c.checked); }; });
    document.getElementById('hs-save').onclick = async function () {
      function v(id) { return document.getElementById(id).value; }
      var durations = v('hs-durs').split('\n').map(function (l) { var m = /^(.*?)\s*=\s*(\d+)\s*$/.exec(l.trim()); return m ? { label: m[1], days: Number(m[2]) } : null; }).filter(Boolean);
      try {
        await call('settings', {
          enabled: document.getElementById('hs-enabled').checked,
          business: { business_name: v('hs-biz'), phone: v('hs-phone'), email: v('hs-email') },
          stripe_connect_account_id: v('hs-stripe'),
          hire: {
            open_time: v('hs-open'), close_time: v('hs-close'), time_step: v('hs-step'), min_notice_days: v('hs-notice'),
            max_public_days: v('hs-maxdays'), max_daily_hire_jobs: v('hs-maxjobs'), durations: durations,
            closed_weekdays: [].map.call(root.querySelectorAll('.hs-closed:checked'), function (c) { return Number(c.value); }),
            public_holidays: v('hs-hols'), booking_terms: v('hs-terms'), show_left: document.getElementById('hs-left').checked
          }
        });
        flash('Settings saved.');
      } catch (e) { flash(e.message, true); }
    };
  }
  function field(id, label, val, cls, attrs) { return '<div class="field ' + (cls || '') + '"><label>' + esc(label) + '</label><input id="' + id + '" value="' + esc(val == null ? '' : val) + '"' + (attrs || '') + '></div>'; }

  window.__BKX = {
    hiredesk: hiredesk,
    fleet: fleetCalendar,
    trucks: trucks,
    hiresettings: hiresettings,
    phoneBooking: phoneBooking,
    presets: paintPresets,
    isHire: function () { var s = B() && B().state && B().state.system; return !!(s && Array.isArray(s.booking_types) && s.booking_types.indexOf('resource_hire') >= 0); }
  };
})();
