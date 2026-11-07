/* Partner showcase manager (super admin, /manage \u2192 Settings \u2192 Partner showcase). Nov 2026.
   Lists the LeadPages sites partners can show on their pages and, per site: a feature picture,
   auto-scroll, "LeadPages pick", order and removal. Talks to /api/partner/showcase-library.
   window.LPShowcaseManager.open({ token: async () => jwt, toast: fn, sites: [{id,name,slug,status}], onChange: fn }) */
(function (global) {
  'use strict';
  var API = '/api/partner/showcase-library';
  var CLOUD = 'dzx6x1hou';
  var S = { items: [], ready: true, busy: false, opts: null };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  function toast(m) { try { (S.opts.toast || function () {})(m); } catch (_e) {} }

  async function call(method, body, query) {
    var t = await S.opts.token();
    var r = await fetch(API + (query || ''), {
      method: method,
      headers: Object.assign({ Authorization: 'Bearer ' + t }, body ? { 'content-type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined
    });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || !j.ok) throw new Error(j.message || j.error || 'Something went wrong');
    return j;
  }

  function css() {
    if ($('lpsm-css')) return;
    var s = document.createElement('style');
    s.id = 'lpsm-css';
    s.textContent = ''
      + '#lpsm{position:fixed;inset:0;z-index:9999;background:color-mix(in srgb,var(--ink,#0e1726) 55%,transparent);overflow:auto;padding:32px 16px;color:var(--ink,var(--text));font-family:var(--font-ui,inherit);}'
      + '#lpsm .sm-card{max-width:980px;margin:0 auto;background:var(--panel,var(--surface,var(--bg)));color:var(--ink,var(--text));border:1px solid var(--line);border-radius:18px;padding:24px;box-shadow:var(--shadow,0 30px 80px rgba(0,0,0,.35));}'
      + '#lpsm h1{margin:0;font:700 24px/1.1 var(--font-display,Georgia),serif;color:var(--ink,var(--text));}'
      + '#lpsm .sm-top{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap;}'
      + '#lpsm .lede,#lpsm .hint{color:var(--ink-soft,var(--text-soft,var(--ink)));}'
      + '#lpsm .sm-add{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:14px 0 18px;padding:12px;border:1px dashed var(--line);border-radius:12px;}'
      + '#lpsm .sm-add select{flex:1 1 260px;min-width:0;padding:9px 10px;border-radius:8px;border:1px solid var(--line);background:var(--input-bg,var(--panel-soft,var(--bg)));color:var(--ink,var(--text));font:inherit;}'
      + '#lpsm .sm-row{display:grid;grid-template-columns:200px minmax(0,1fr);gap:16px;padding:14px;border:1px solid var(--line);border-radius:14px;margin-bottom:12px;background:var(--surface-2,var(--panel-soft,var(--bg)));}'
      + '#lpsm .sm-pic{position:relative;aspect-ratio:16/10;border-radius:10px;overflow:hidden;border:1px solid var(--line);background:color-mix(in srgb,var(--sm-c,var(--accent)) 18%,var(--panel,var(--bg)));display:flex;align-items:center;justify-content:center;}'
      + '#lpsm .sm-pic img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block;}'
      + '#lpsm .sm-pic b{font:800 30px/1 var(--font-display,Georgia),serif;color:var(--sm-c,var(--accent));}'
      + '#lpsm .sm-pic .sm-live{position:absolute;left:8px;bottom:8px;font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;background:color-mix(in srgb,var(--panel,#000) 80%,transparent);color:var(--ink,var(--text));}'
      + '#lpsm .sm-main{min-width:0;display:flex;flex-direction:column;gap:10px;}'
      + '#lpsm .sm-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;}'
      + '#lpsm .sm-name{font-weight:700;font-size:15.5px;}'
      + '#lpsm .sm-sub{font-size:12.5px;color:var(--ink-soft,var(--text-soft));overflow-wrap:anywhere;}'
      + '#lpsm .sm-badge{display:inline-block;margin-left:6px;font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;padding:2px 7px;border-radius:999px;vertical-align:2px;}'
      + '#lpsm .sm-badge.live{background:color-mix(in srgb,var(--success,#16a34a) 18%,transparent);color:var(--success,#16a34a);}'
      + '#lpsm .sm-badge.wait{background:color-mix(in srgb,var(--warning,#d97706) 18%,transparent);color:var(--warning,#d97706);}'
      + '#lpsm .sm-badge.pick{background:color-mix(in srgb,var(--accent) 20%,transparent);color:var(--accent);}'
      + '#lpsm .sm-order{display:flex;gap:6px;flex-wrap:wrap;}'
      + '#lpsm .sm-opts{display:flex;gap:10px 18px;flex-wrap:wrap;}'
      + '#lpsm .sm-opts label{display:flex;gap:8px;align-items:flex-start;font-size:13.5px;cursor:pointer;max-width:330px;}'
      + '#lpsm .sm-opts input{width:auto;margin-top:2px;accent-color:var(--accent);}'
      + '#lpsm .sm-opts small{display:block;font-size:12px;color:var(--ink-soft,var(--text-soft));}'
      + '#lpsm .sm-picrow{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}'
      + '#lpsm .sm-picrow input[type=text]{flex:1 1 220px;min-width:0;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:var(--input-bg,var(--panel-soft,var(--bg)));color:var(--ink,var(--text));font:inherit;font-size:13px;}'
      + '#lpsm .btn.sm-sm{padding:6px 10px;font-size:12.5px;}'
      + '#lpsm .sm-msg{font-size:12.5px;min-height:1em;}'
      + '#lpsm .sm-empty{padding:26px;text-align:center;border:1px dashed var(--line);border-radius:14px;}'
      + '@media (max-width:640px){#lpsm{padding:12px 8px;}#lpsm .sm-card{padding:16px;}#lpsm .sm-row{grid-template-columns:minmax(0,1fr);}#lpsm .sm-opts label{max-width:none;}}';
    document.head.appendChild(s);
  }

  function rowHtml(it, i, n) {
    var live = it.status === 'live' || it.live;
    var pic = it.image
      ? '<img src="' + esc(it.image) + '" alt="">'
      : (it.logo ? '<img src="' + esc(it.logo) + '" alt="" style="object-fit:contain;padding:18px;background:#fff">' : '<b>' + esc(String(it.name || '?').charAt(0).toUpperCase()) + '</b>');
    return '<div class="sm-row" data-id="' + esc(it.id) + '"' + (it.color ? ' style="--sm-c:' + esc(it.color) + '"' : '') + '>'
      + '<div class="sm-pic">' + pic + '<span class="sm-live">' + (it.image ? (it.autoScroll ? 'Picture \u00b7 scrolls live' : 'Feature picture') : (it.autoScroll ? 'Live \u00b7 auto-scroll' : 'Live preview')) + '</span></div>'
      + '<div class="sm-main">'
      + '<div class="sm-head"><div><div class="sm-name">' + esc(it.name)
      + (live ? '<span class="sm-badge live">Live</span>' : '<span class="sm-badge wait">Not live \u2014 hidden</span>')
      + (it.featured ? '<span class="sm-badge pick">LeadPages pick</span>' : '') + '</div>'
      + '<div class="sm-sub">' + esc(it.industry ? it.industry + ' \u00b7 ' : '') + '<a href="' + esc(it.url) + '" target="_blank" rel="noopener">' + esc(it.host) + '</a></div></div>'
      + '<div class="sm-order">'
      + '<button type="button" class="btn ghost sm-sm" data-sm="up"' + (i === 0 ? ' disabled' : '') + ' title="Move up" aria-label="Move up">&uarr;</button>'
      + '<button type="button" class="btn ghost sm-sm" data-sm="down"' + (i === n - 1 ? ' disabled' : '') + ' title="Move down" aria-label="Move down">&darr;</button>'
      + '<button type="button" class="btn ghost sm-sm" data-sm="remove" style="color:var(--danger,#b42318)">Remove</button>'
      + '</div></div>'
      + '<div class="sm-picrow">'
      + '<input type="text" data-sm-link placeholder="Feature picture link (https://\u2026) \u2014 or upload" value="' + esc(it.image || '') + '">'
      + '<label class="btn ghost sm-sm" style="position:relative;overflow:hidden;cursor:pointer">Upload<input type="file" accept="image/*" data-sm-file style="position:absolute;inset:0;opacity:0;cursor:pointer"></label>'
      + '<button type="button" class="btn ghost sm-sm" data-sm="savelink">Use link</button>'
      + (it.image ? '<button type="button" class="btn ghost sm-sm" data-sm="clearpic">Remove picture</button>' : '')
      + '</div>'
      + '<div class="sm-opts">'
      + '<label><input type="checkbox" data-sm-opt="auto_scroll"' + (it.autoScroll ? ' checked' : '') + '><span><strong>Auto-scroll</strong><small>The live site slowly scrolls on partner pages to catch the eye.</small></span></label>'
      + '<label><input type="checkbox" data-sm-opt="featured"' + (it.featured ? ' checked' : '') + '><span><strong>LeadPages pick</strong><small>Listed first, and marked as a pick in partners\u2019 Showcase tab.</small></span></label>'
      + '</div>'
      + '<div class="sm-msg" aria-live="polite"></div>'
      + '</div></div>';
  }

  function render() {
    var box = $('lpsm-list'); if (!box) return;
    var inLib = {};
    S.items.forEach(function (it) { inLib[it.id] = true; });
    var addable = (S.opts.sites || []).filter(function (s) { return !inLib[String(s.id).toLowerCase()] && !inLib[s.id]; });
    var add = $('lpsm-add-sel');
    if (add) {
      add.innerHTML = '<option value="">Add a site to the showcase\u2026</option>' + addable.map(function (s) {
        return '<option value="' + esc(s.id) + '">' + esc(s.name) + ' (' + esc(s.slug) + ')' + (s.status === 'live' ? '' : ' \u2014 not live') + '</option>';
      }).join('');
    }
    if (!S.ready) { box.innerHTML = '<div class="sm-empty hint">The showcase table isn\u2019t set up yet.</div>'; return; }
    if (!S.items.length) { box.innerHTML = '<div class="sm-empty hint">No sites in the showcase yet. Add one above, or tick <strong>Partner showcase</strong> on a site in the Site Switcher.</div>'; return; }
    box.innerHTML = S.items.map(function (it, i) { return rowHtml(it, i, S.items.length); }).join('');
  }

  async function load() {
    try {
      var j = await call('GET', null, '?scope=admin');
      S.ready = j.ready !== false;
      S.items = j.items || [];
    } catch (e) {
      S.items = []; toast(e.message);
    }
    render();
  }

  function rowMsg(row, text, bad) {
    var m = row && row.querySelector('.sm-msg');
    if (m) { m.textContent = text || ''; m.style.color = bad ? 'var(--danger,#b42318)' : 'var(--success,#16a34a)'; }
  }

  async function update(id, patch, row) {
    rowMsg(row, 'Saving\u2026');
    try {
      await call('POST', Object.assign({ action: 'update', site_id: id }, patch));
      await load();
      var fresh = document.querySelector('#lpsm .sm-row[data-id="' + id + '"]');
      rowMsg(fresh, 'Saved \u2713');
      if (S.opts.onChange) S.opts.onChange();
    } catch (e) { rowMsg(row, e.message, true); }
  }

  async function upload(file, id) {
    var t = await S.opts.token();
    var folder = 'leadpages/' + id + '/showcase';
    var pid = folder + '/feature-' + Math.random().toString(36).slice(2, 10);
    var sr = await fetch('/api/cloudinary/sign', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ publicId: pid, assetFolder: folder }) });
    if (!sr.ok) throw new Error('Could not authorise the upload');
    var s = await sr.json();
    var fd = new FormData();
    fd.append('file', file, file.name || 'feature.jpg');
    fd.append('api_key', s.apiKey); fd.append('timestamp', s.timestamp); fd.append('public_id', s.publicId);
    if (s.assetFolder) fd.append('asset_folder', s.assetFolder);
    if (s.overwrite) fd.append('overwrite', s.overwrite);
    fd.append('signature', s.signature);
    var cloud = (s.cloudName && /^[a-zA-Z0-9_\-]+$/.test(s.cloudName)) ? s.cloudName : CLOUD;
    var ur = await fetch('https://api.cloudinary.com/v1_1/' + cloud + '/image/upload', { method: 'POST', body: fd });
    var uj = await ur.json().catch(function () { return {}; });
    if (!ur.ok || !uj.secure_url) throw new Error((uj.error && uj.error.message) || 'Upload failed');
    // Serve a sensible size: 1600px wide, auto format/quality.
    var url = uj.secure_url.replace('/image/upload/', '/image/upload/f_auto,q_auto,w_1600/');
    return { url: url, publicId: uj.public_id };
  }

  function wire(root) {
    root.addEventListener('click', async function (e) {
      if (e.target === root || e.target.closest('#lpsm-close')) { close(); return; }
      if (e.target.closest('#lpsm-add-btn')) {
        var sel = $('lpsm-add-sel'); var id = sel && sel.value; if (!id) return;
        try { await call('POST', { site_id: id, on: true }); toast('Added to the partner showcase'); await load(); if (S.opts.onChange) S.opts.onChange(); }
        catch (err) { toast(err.message); }
        return;
      }
      var b = e.target.closest('[data-sm]'); if (!b) return;
      var row = b.closest('.sm-row'); var id2 = row && row.getAttribute('data-id'); if (!id2) return;
      var act = b.getAttribute('data-sm');
      if (act === 'remove') {
        if (b.getAttribute('data-armed') !== '1') { b.setAttribute('data-armed', '1'); b.textContent = 'Tap again to remove'; setTimeout(function () { if (b.isConnected) { b.removeAttribute('data-armed'); b.textContent = 'Remove'; } }, 3500); return; }
        try { await call('POST', { site_id: id2, on: false }); toast('Removed from the partner showcase'); await load(); if (S.opts.onChange) S.opts.onChange(); }
        catch (err) { rowMsg(row, err.message, true); }
        return;
      }
      if (act === 'up' || act === 'down') {
        var ids = S.items.map(function (x) { return x.id; });
        var at = ids.indexOf(id2); var to = act === 'up' ? at - 1 : at + 1;
        if (at < 0 || to < 0 || to >= ids.length) return;
        ids.splice(to, 0, ids.splice(at, 1)[0]);
        try { await call('POST', { action: 'reorder', order: ids }); await load(); } catch (err) { rowMsg(row, err.message, true); }
        return;
      }
      if (act === 'savelink') {
        var v = (row.querySelector('[data-sm-link]') || {}).value || '';
        update(id2, { image_url: v.trim(), image_pid: '' }, row);
        return;
      }
      if (act === 'clearpic') { update(id2, { image_url: '' }, row); return; }
    });
    root.addEventListener('change', async function (e) {
      var row = e.target.closest('.sm-row'); var id = row && row.getAttribute('data-id');
      if (!id) return;
      var opt = e.target.getAttribute('data-sm-opt');
      if (opt) { var p = {}; p[opt] = !!e.target.checked; update(id, p, row); return; }
      if (e.target.hasAttribute('data-sm-file') && e.target.files && e.target.files[0]) {
        var f = e.target.files[0];
        if (f.size > 8 * 1024 * 1024) { rowMsg(row, 'Please use an image under 8 MB.', true); return; }
        rowMsg(row, 'Uploading\u2026');
        try { var up = await upload(f, id); update(id, { image_url: up.url, image_pid: up.publicId }, row); }
        catch (err) { rowMsg(row, err.message, true); }
      }
    });
    document.addEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }

  function close() {
    var p = $('lpsm'); if (p) p.remove();
    document.removeEventListener('keydown', onKey);
  }

  function open(opts) {
    S.opts = opts || {};
    close(); css();
    var p = document.createElement('div');
    p.id = 'lpsm';
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', 'Partner showcase');
    p.innerHTML = '<div class="sm-card">'
      + '<div class="sm-top"><h1>Partner showcase</h1><button type="button" class="btn ghost" id="lpsm-close">Close</button></div>'
      + '<p class="lede" style="margin:0;max-width:70ch">LeadPages sites partners can show on their pages (\u201cBuilt on LeadPages\u201d). Only live sites appear. Give a site a feature picture, make its live preview scroll, mark your best as a <strong>LeadPages pick</strong>, and set the order partners see.</p>'
      + '<div class="sm-add"><select id="lpsm-add-sel" aria-label="Add a site"><option value="">Loading\u2026</option></select><button type="button" class="btn" id="lpsm-add-btn">Add</button></div>'
      + '<div id="lpsm-list"><div class="hint">Loading\u2026</div></div>'
      + '</div>';
    document.body.appendChild(p);
    wire(p);
    load();
  }

  global.LPShowcaseManager = { open: open, close: close };
})(window);
