/* Order tools for orders.html:
 *   1. Saved searches (Production Summary → Product search sheet)
 *   2. Settings → Labels & printers
 *   3. Sticker builders for searches (all the turkeys / all the hams)
 * Host: window.LpOrderToolsHost = { api, siteQuery, siteId, toast, esc, businessName, getSettings, saveSettings, ps:{get,set,run,print,rows} }
 * Saved searches live in order_systems.settings.saved_searches; labels in settings.labels (see assets/lp-labels.js).
 */
(function () {
  'use strict';

  function H() { return window.LpOrderToolsHost || {}; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function toast(m, k) { if (H().toast) H().toast(m, k); }
  function uid() { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dLabel(ymd) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ''))) return '';
    var d = new Date(ymd + 'T00:00:00');
    return DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()];
  }
  function t12(t) {
    var m = /^(\d{2}):(\d{2})/.exec(String(t || '')); if (!m) return '';
    var h = Number(m[1]); return (h % 12 || 12) + (m[2] === '00' ? '' : ':' + m[2]) + (h >= 12 ? 'pm' : 'am');
  }

  /* ================= Saved searches ================= */
  var SS = { list: [], loaded: false, current: null, filter: '' };

  function describe(s) {
    var parts = [];
    parts.push('Products: ' + (s.product_q || '—').split(',').map(function (x) { return x.trim(); }).filter(Boolean).join(' or '));
    if (s.refine) parts.push('must include: ' + s.refine.split(',').map(function (x) { return x.trim(); }).filter(Boolean).join(' + '));
    if (s.mode === 'exact') parts.push('exact name');
    if (s.date_mode === 'next_days') parts.push('next ' + (s.days || 7) + ' days');
    else if (s.date_mode === 'single') parts.push(s.from ? 'on ' + dLabel(s.from) : 'one day');
    else if (s.date_mode === 'range') parts.push((s.from ? dLabel(s.from) : '?') + ' – ' + (s.to ? dLabel(s.to) : '?'));
    else parts.push('from today');
    return parts.join(' · ');
  }

  async function loadSaved(force) {
    if (SS.loaded && !force) return SS.list;
    try {
      var st = await H().getSettings();
      SS.list = Array.isArray(st && st.saved_searches) ? st.saved_searches.filter(function (x) { return x && x.id; }) : [];
      SS.loaded = true;
    } catch (e) { SS.list = SS.list || []; }
    return SS.list;
  }

  async function persist() {
    await H().saveSettings({ saved_searches: SS.list.slice(0, 200) });
  }

  function renderSaved() {
    var box = $('ss-list');
    if (!box) return;
    var f = SS.filter.trim().toLowerCase();
    var list = SS.list.filter(function (s) {
      if (!f) return true;
      return (String(s.label) + ' ' + String(s.product_q) + ' ' + String(s.refine || '')).toLowerCase().indexOf(f) >= 0;
    }).sort(function (a, b) { return String(a.label).localeCompare(String(b.label)); });
    var count = $('ss-count');
    if (count) count.textContent = SS.list.length ? '(' + SS.list.length + ')' : '';
    if (!SS.list.length) {
      box.innerHTML = '<p class="kt-muted" style="margin:0">No saved searches yet. Search below (e.g. <em>turkey</em>, or <em>ham</em> + must include <em>cooked</em>), then press <strong>Save search</strong>.</p>';
      return;
    }
    if (!list.length) { box.innerHTML = '<p class="kt-muted" style="margin:0">No saved search matches “' + esc(SS.filter) + '”.</p>'; return; }
    box.innerHTML = list.map(function (s) {
      var on = SS.current && SS.current.id === s.id;
      return '<div class="ss-card' + (on ? ' on' : '') + '">' +
        '<button type="button" class="ss-run" data-ss="run" data-id="' + esc(s.id) + '"><span class="ss-name">' + esc(s.label) + '</span>' +
        '<span class="ss-desc">' + esc(describe(s)) + '</span></button>' +
        '<div class="ss-btns">' +
        '<button type="button" class="btn ghost" data-ss="print" data-id="' + esc(s.id) + '" title="Print the A4 list">A4 list</button>' +
        '<button type="button" class="btn ghost" data-ss="stickers" data-id="' + esc(s.id) + '" title="One sticker for every matching item">Stickers</button>' +
        '<button type="button" class="btn ghost" data-ss="rename" data-id="' + esc(s.id) + '">Rename</button>' +
        '<button type="button" class="btn ghost" data-ss="delete" data-id="' + esc(s.id) + '">Delete</button></div></div>';
    }).join('');
  }

  function syncCurrentBar() {
    var bar = $('ss-current');
    if (!bar) return;
    if (!SS.current) { bar.classList.add('hide'); bar.innerHTML = ''; return; }
    var now = H().ps.get();
    var changed = now.product_q !== SS.current.product_q || (now.refine || '') !== (SS.current.refine || '') ||
      now.mode !== (SS.current.mode || 'partial') || now.date_mode !== (SS.current.date_mode || 'from_today') ||
      String(now.from || '') !== String(SS.current.from || '') || String(now.to || '') !== String(SS.current.to || '') ||
      Number(now.days || 0) !== Number(SS.current.days || 0);
    bar.classList.remove('hide');
    bar.innerHTML = '<span>Saved search: <strong>' + esc(SS.current.label) + '</strong>' + (changed ? ' <em class="kt-muted">(changed — not saved)</em>' : '') + '</span>' +
      (changed ? '<button type="button" class="btn ghost" data-ss="update">Update “' + esc(SS.current.label) + '”</button>' : '') +
      '<button type="button" class="btn ghost" data-ss="clear">Close</button>';
  }

  function find(id) { return SS.list.filter(function (s) { return s.id === id; })[0] || null; }

  async function runSaved(s) {
    SS.current = s;
    H().ps.set(s);
    renderSaved();
    syncCurrentBar();
    await H().ps.run();
    var card = $('ps-card');
    if (card && card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function onSavedClick(e) {
    var b = e.target.closest('[data-ss]');
    if (!b) return;
    var act = b.getAttribute('data-ss');
    var s = find(b.getAttribute('data-id'));
    try {
      if (act === 'run' && s) return runSaved(s);
      if (act === 'print' && s) { SS.current = s; H().ps.set(s); syncCurrentBar(); return H().ps.print(); }
      if (act === 'stickers' && s) {
        var win = preopen();
        SS.current = s; H().ps.set(s); syncCurrentBar();
        await H().ps.run();
        return printSearchStickers(win);
      }
      if (act === 'rename' && s) {
        var nl = window.prompt('Name for this search', s.label);
        if (!nl || !nl.trim()) return;
        s.label = nl.trim().slice(0, 60); s.updated_at = new Date().toISOString();
        await persist(); renderSaved(); syncCurrentBar(); toast('Renamed');
        return;
      }
      if (act === 'delete' && s) {
        if (!window.confirm('Delete the saved search “' + s.label + '”? (The orders are not affected.)')) return;
        SS.list = SS.list.filter(function (x) { return x.id !== s.id; });
        if (SS.current && SS.current.id === s.id) SS.current = null;
        await persist(); renderSaved(); syncCurrentBar(); toast('Deleted');
        return;
      }
      if (act === 'save') {
        var now = H().ps.get();
        if (!now.product_q) { toast('Type what to search for first (e.g. turkey)', 'err'); return; }
        var guess = now.product_q.split(',')[0].trim();
        guess = guess.charAt(0).toUpperCase() + guess.slice(1) + (now.refine ? ' ' + now.refine.split(',')[0].trim() : '');
        var label = window.prompt('Name this search (e.g. Turkeys, Hams, Ham cooked)', guess);
        if (!label || !label.trim()) return;
        await loadSaved(true);
        var rec = Object.assign({ id: uid(), label: label.trim().slice(0, 60), created_at: new Date().toISOString() }, now, { updated_at: new Date().toISOString() });
        SS.list.push(rec);
        SS.current = rec;
        await persist(); renderSaved(); syncCurrentBar(); toast('Saved “' + rec.label + '”');
        return;
      }
      if (act === 'update' && SS.current) {
        var cur = find(SS.current.id) || SS.current;
        Object.assign(cur, H().ps.get(), { updated_at: new Date().toISOString() });
        SS.current = cur;
        await persist(); renderSaved(); syncCurrentBar(); toast('Updated “' + cur.label + '”');
        return;
      }
      if (act === 'clear') { SS.current = null; renderSaved(); syncCurrentBar(); return; }
      if (act === 'search-stickers') return printSearchStickers(preopen());
    } catch (err) {
      toast((err && err.message) || 'Something went wrong', 'err');
    }
  }

  /** Stickers for every item in the current search results (one per unit). */
  function searchStickers(rows) {
    var biz = H().businessName ? H().businessName() : '';
    var out = [];
    (rows || []).forEach(function (r) {
      var q = Math.max(1, Math.min(50, Math.round(Number(r.quantity) || 1)));
      var kind = String(r.product_name || '').split(/\s*[-–:]\s+/)[0] || '';
      var w = r.weight_label && r.weight_label !== '—' ? r.weight_label : '';
      var opts = r.options || '';
      for (var i = 0; i < q; i++) {
        out.push({
          brand: biz,
          title: kind,
          product: r.product_name,
          lines: [[w, opts].filter(Boolean).join(' · '), 'Pickup ' + dLabel(r.pickup_date) + (r.pickup_time ? ' ' + t12(r.pickup_time) : '') + (q > 1 ? ' · ' + (i + 1) + ' of ' + q : '')].filter(Boolean),
          who: r.customer_name || '',
          ref: r.order_number || '',
          foot: ''
        });
      }
    });
    return out;
  }

  /** Browsers only allow a new window during the click: open it before anything async. */
  function preopen() {
    var w = null;
    try { w = window.open('', '_blank'); if (w) w.document.write('<p style="font:14px Arial;padding:16px">Preparing labels…</p>'); } catch (_e) {}
    return w;
  }

  async function printSearchStickers(win) {
    var rows = H().ps.rows();
    if (!rows || !rows.length) { try { if (win) win.close(); } catch (_e) {} toast('Nothing in the results to print', 'err'); return; }
    var settings = H().settingsNow ? H().settingsNow() : await H().getSettings();
    var st = searchStickers(rows);
    var r = await window.LpLabels.print(settings, 'search_stickers', st, { title: (SS.current ? SS.current.label : 'Search') + ' stickers', win: win });
    reportPrint(r, st.length);
  }

  function reportPrint(r, n) {
    if (!r) return;
    if (r.via === 'dymo' && r.ok) toast('Sent ' + r.sent + ' label' + (r.sent === 1 ? '' : 's') + ' to ' + r.printer);
    else if (r.error === 'popup_blocked') toast('Allow pop-ups to print', 'err');
    else if (r.fallback_reason === 'dymo_not_found') toast('DYMO Connect isn’t running on this device — opened the print dialog instead', 'warn');
    else if (r.fallback_reason === 'printer_not_found') toast('That DYMO printer isn’t connected to this device — opened the print dialog instead', 'warn');
    else if (r.fallback_reason === 'dymo_failed') toast('DYMO didn’t take the job (' + (r.error || 'error') + ') — opened the print dialog instead', 'warn');
  }

  function wireSaved() {
    var card = $('ss-card');
    if (!card || card.__ssBound) return;
    card.__ssBound = true;
    card.addEventListener('click', onSavedClick);
    var ps = $('ps-card');
    if (ps) ps.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ss]');
      if (b) onSavedClick(e);
    });
    var q = $('ss-q');
    if (q) q.addEventListener('input', function () { SS.filter = q.value || ''; renderSaved(); });
    ['ps-q', 'ps-refine', 'ps-date-mode', 'ps-from', 'ps-to', 'ps-days'].forEach(function (id) {
      var el = $(id); if (el) { el.addEventListener('input', syncCurrentBar); el.addEventListener('change', syncCurrentBar); }
    });
  }

  async function openSaved() {
    wireSaved();
    await loadSaved(true);
    renderSaved();
    syncCurrentBar();
  }

  /* ================= Settings → Labels & printers ================= */
  var LB = { settings: null, cfg: null, dymo: null };

  function sizeOptions(selected, withDefault) {
    var L = window.LpLabels;
    var opts = withDefault ? '<option value="">Use the default</option>' : '';
    return opts + L.allSizes(LB.settings).map(function (s) {
      return '<option value="' + esc(s.id) + '"' + (s.id === selected ? ' selected' : '') + '>' + esc(s.name) + '</option>';
    }).join('');
  }

  function printerControl(area, value) {
    var printers = (LB.dymo && LB.dymo.ok && LB.dymo.printers) || [];
    if (printers.length) {
      var has = !value || printers.some(function (p) { return p.name === value; });
      return '<select data-lb-printer="' + area + '"><option value="">Print dialog (choose each time)</option>' +
        printers.map(function (p) { return '<option value="' + esc(p.name) + '"' + (p.name === value ? ' selected' : '') + '>' + esc(p.name) + (p.model ? ' (' + esc(p.model) + ')' : '') + '</option>'; }).join('') +
        (has ? '' : '<option value="' + esc(value) + '" selected>' + esc(value) + ' (not on this device)</option>') + '</select>';
    }
    return '<input type="text" data-lb-printer="' + area + '" value="' + esc(value || '') + '" placeholder="Print dialog (or a DYMO printer name)">';
  }

  function renderLabels() {
    var box = $('settings-panel-labels');
    if (!box) return;
    var L = window.LpLabels;
    var c = LB.cfg;
    var d = LB.dymo;
    var dymoLine = !d ? 'Checking for DYMO Connect on this device…'
      : d.ok ? 'DYMO Connect is running on this device — ' + (d.printers.length ? d.printers.length + ' DYMO printer' + (d.printers.length === 1 ? '' : 's') + ' found.' : 'but no DYMO printer is connected.')
      : d.reason === 'mobile' ? 'This is a phone or tablet: labels print through the print dialog (AirPrint / your printer app).'
      : 'DYMO Connect wasn’t found on this device. Labels print through the print dialog. To send straight to a DYMO, install DYMO Connect on the computer next to the printer.';
    box.innerHTML =
      '<p class="notice">Choose the label size each area prints on, and (optional) which DYMO printer it goes to. Every device works: with a DYMO printer chosen, a computer running DYMO Connect prints straight to it; any other device (iPad, phone, a PC without DYMO Connect) opens the print dialog with the page set to the label size.</p>' +
      '<div class="lb-status"><span>' + esc(dymoLine) + '</span> <button type="button" class="btn ghost" data-lb="probe">Check again</button></div>' +
      '<div class="field"><label for="lb-default">Default label size</label><select id="lb-default">' + sizeOptions(c.default_size, false) + '</select>' +
      '<span class="field-hint">“A4 sheet” keeps printing stickers on A4 sticker sheets, as now.</span></div>' +
      '<h4 class="section-title">Each area</h4>' +
      '<div class="lb-areas">' + L.AREAS.map(function (a) {
        var ac = c.areas[a.id] || {};
        var eff = L.sizeFor(LB.settings, a.id);
        return '<div class="lb-area"><div class="lb-area-head"><strong>' + esc(a.name) + '</strong><span class="kt-muted">' + esc(a.hint) + '</span></div>' +
          '<div class="lb-area-row"><label>Label size<select data-lb-size="' + a.id + '">' + sizeOptions(ac.size || '', true) + '</select></label>' +
          '<label>Printer' + printerControl(a.id, ac.printer || '') + '</label>' +
          '<button type="button" class="btn ghost" data-lb="test" data-area="' + a.id + '">Print test</button></div>' +
          '<div class="kt-muted lb-eff">Prints on: ' + esc(eff.name) + '</div></div>';
      }).join('') + '</div>' +
      '<h4 class="section-title">Your own label sizes</h4>' +
      '<div id="lb-custom">' + (c.custom_sizes.length ? c.custom_sizes.map(function (s, i) {
        return '<div class="lb-custom-row"><span><strong>' + esc(s.name || '') + '</strong> ' + esc(s.w_mm) + ' × ' + esc(s.h_mm) + ' mm' + (s.dymo_paper ? ' · DYMO paper “' + esc(s.dymo_paper) + '”' : '') + '</span>' +
          '<button type="button" class="btn ghost" data-lb="del-size" data-i="' + i + '">Remove</button></div>';
      }).join('') : '<p class="kt-muted" style="margin:0 0 8px">None yet.</p>') + '</div>' +
      '<div class="lb-add"><input id="lb-new-name" type="text" placeholder="Name, e.g. Kitchen small"><input id="lb-new-w" type="number" min="10" max="300" step="0.1" placeholder="Width mm"><input id="lb-new-h" type="number" min="10" max="300" step="0.1" placeholder="Height mm">' +
      '<input id="lb-new-paper" type="text" placeholder="DYMO paper name (optional)"><button type="button" class="btn ghost" data-lb="add-size">Add size</button></div>' +
      '<label class="lb-device"><input type="checkbox" id="lb-dialog-only"' + (L.deviceDialogOnly() ? ' checked' : '') + '> On this device, always use the print dialog</label>' +
      '<div class="lb-save"><button type="button" class="btn solid" data-lb="save">Save labels &amp; printers</button><span class="notice" id="lb-msg"></span></div>';
  }

  function readForm() {
    var c = LB.cfg;
    var dflt = $('lb-default'); if (dflt) c.default_size = dflt.value || 'a4-2up';
    document.querySelectorAll('[data-lb-size]').forEach(function (el) {
      var a = el.getAttribute('data-lb-size'); c.areas[a] = Object.assign({}, c.areas[a] || {}, { size: el.value || '' });
    });
    document.querySelectorAll('[data-lb-printer]').forEach(function (el) {
      var a = el.getAttribute('data-lb-printer'); c.areas[a] = Object.assign({}, c.areas[a] || {}, { printer: String(el.value || '').trim().slice(0, 120) });
    });
    LB.settings = Object.assign({}, LB.settings || {}, { labels: c });
  }

  async function onLabelsClick(e) {
    var b = e.target.closest('[data-lb]');
    if (!b) return;
    var act = b.getAttribute('data-lb');
    var L = window.LpLabels;
    try {
      if (act === 'probe') { LB.dymo = null; renderLabels(); readForm(); LB.dymo = await L.dymoProbe(); renderLabels(); return; }
      if (act === 'add-size') {
        readForm();
        var w = Number($('lb-new-w').value), h = Number($('lb-new-h').value);
        if (!(w >= 10 && h >= 10)) { toast('Enter the width and height in mm', 'err'); return; }
        var name = String($('lb-new-name').value || '').trim() || (w + ' × ' + h + ' mm');
        LB.cfg.custom_sizes.push({ id: 'c-' + Date.now().toString(36), name: name.slice(0, 60), w_mm: w, h_mm: h, dymo_paper: String($('lb-new-paper').value || '').trim().slice(0, 80) });
        LB.settings.labels = LB.cfg;
        renderLabels();
        return;
      }
      if (act === 'del-size') {
        readForm();
        var removed = LB.cfg.custom_sizes.splice(Number(b.getAttribute('data-i')), 1)[0];
        if (removed) {
          if (LB.cfg.default_size === removed.id) LB.cfg.default_size = 'a4-2up';
          Object.keys(LB.cfg.areas).forEach(function (k) { if (LB.cfg.areas[k].size === removed.id) LB.cfg.areas[k].size = ''; });
        }
        LB.settings.labels = LB.cfg;
        renderLabels();
        return;
      }
      if (act === 'test') {
        readForm();
        var area = b.getAttribute('data-area');
        var biz = H().businessName ? H().businessName() : '';
        var r = await L.print(LB.settings, area, [{
          brand: biz, title: area === 'kitchen' ? 'Cooked' : 'Turkey', product: 'TURKEY - Small Roll (Stuffed) 1.5-2.5 kg',
          lines: ['2.1 kg · Apricot', 'Pickup Thu 24 Dec 7:30am'], who: 'Test Customer', ref: 'ORD-TEST', foot: area === 'kitchen' ? 'Keep refrigerated' : ''
        }], { title: 'Test label' });
        reportPrint(r, 1);
        return;
      }
      if (act === 'save') {
        readForm();
        var dlg = $('lb-dialog-only'); L.setDeviceDialogOnly(!!(dlg && dlg.checked));
        await H().saveSettings({ labels: LB.cfg });
        var m = $('lb-msg'); if (m) m.textContent = 'Saved.';
        toast('Labels & printers saved');
        return;
      }
    } catch (err) {
      toast((err && err.message) || 'Something went wrong', 'err');
    }
  }

  async function openLabels() {
    var box = $('settings-panel-labels');
    if (!box) return;
    if (!box.__lbBound) { box.__lbBound = true; box.addEventListener('click', onLabelsClick); }
    box.innerHTML = '<p class="notice">Loading…</p>';
    LB.settings = await H().getSettings();
    LB.cfg = window.LpLabels.cfgOf(LB.settings);
    LB.cfg = JSON.parse(JSON.stringify(LB.cfg));
    LB.dymo = null;
    renderLabels();
    LB.dymo = await window.LpLabels.dymoProbe();
    readForm();
    renderLabels();
  }

  window.LpOrderTools = {
    openSaved: openSaved,
    openLabels: openLabels,
    searchStickers: searchStickers,
    printSearchStickers: printSearchStickers,
    reportPrint: reportPrint,
    describe: describe
  };
})();
