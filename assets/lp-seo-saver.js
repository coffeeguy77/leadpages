/*!
 * SEO Saver — editor panel (SEO Command Centre → SEO Saver tab).
 *
 * window.lpSeoSaverPanel(host, {
 *   getConfig: () => data,                 // live editor config; this panel edits cfg.seoSaver in place
 *   save:      async () => {ok},           // writes the live config + purges the CDN
 *   token:     async () => accessToken,
 *   siteId, siteSlug, domain,              // domain: the site's custom domain ('' when none)
 *   toast:     (msg, kind) => void
 * })
 * Matching runs through window.LPSeoSaver (assets/lp-seo-saver-core.js) — the exact
 * code the live site uses, so "Test a URL" shows what visitors and Google will get.
 */
(function () {
  'use strict';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ico(d) { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>'; }
  var I = {
    shield: 'M12 3l8 3v6c0 5-3.4 8.4-8 9-4.6-.6-8-4-8-9V6z', arrow: 'M5 12h14M13 6l6 6-6 6', plus: 'M12 5v14M5 12h14', trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
    search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3', warn: 'M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
    check: 'M5 12l5 5L20 7', x: 'M6 6l12 12M18 6L6 18', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z', g: 'M21 12a9 9 0 11-3-6.7M21 4v5h-5'
  };
  var CSS = '' +
    '.lss{--lss-line:var(--line,#e3e6ea);--lss-muted:var(--ink-soft,#667085);--lss-acc:var(--accent,#1f6f4a);font-size:14px}' +
    '.lss svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none;vertical-align:-3px}' +
    '.lss .card{margin-bottom:14px}.lss h3{margin:0 0 6px;font-size:16px}' +
    '.lss-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:12px 0 0}' +
    '.lss-stat{border:1px solid var(--lss-line);border-radius:10px;padding:10px 12px}.lss-stat b{display:block;font-size:22px;line-height:1.1}.lss-stat span{font-size:12px;color:var(--lss-muted)}' +
    '.lss-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.lss-grow{flex:1}' +
    '.lss-in,.lss-sel{padding:7px 9px;border:1px solid var(--lss-line);border-radius:8px;font:inherit;background:var(--input-bg,#fff);color:inherit;min-width:0;box-sizing:border-box;width:100%}' +
    '.lss-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 11px;border:1px solid var(--lss-line);border-radius:8px;background:var(--card,#fff);color:inherit;font:inherit;font-weight:600;cursor:pointer;white-space:nowrap}' +
    '.lss-btn:hover{border-color:var(--lss-acc)}.lss-btn.pri{background:var(--lss-acc);border-color:var(--lss-acc);color:#fff}.lss-btn.sm{padding:4px 8px;font-size:12.5px}.lss-btn[disabled]{opacity:.5;cursor:not-allowed}' +
    '.lss-btn.icon{padding:5px 7px}.lss-btn.danger:hover{border-color:#d92d20;color:#b42318}' +
    '.lss-tbl{width:100%;border-collapse:separate;border-spacing:0;font-size:13.5px}' +
    '.lss-tbl th{position:sticky;top:0;background:var(--card,#fff);text-align:left;font-size:11.5px;letter-spacing:.04em;text-transform:uppercase;color:var(--lss-muted);font-weight:700;padding:8px 6px;border-bottom:1px solid var(--lss-line);z-index:1}' +
    '.lss-tbl td{padding:6px;border-bottom:1px solid var(--lss-line);vertical-align:middle}' +
    '.lss-tbl tr.off td{opacity:.5}.lss-tbl tr.warn td{background:color-mix(in srgb,#f79009 8%,transparent)}' +
    '.lss-scroll{max-height:62vh;overflow:auto;border:1px solid var(--lss-line);border-radius:10px}' +
    '.lss-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.lss-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;word-break:break-all}' +
    '.lss-pill{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:99px;font-size:11.5px;font-weight:700;border:1px solid var(--lss-line);white-space:nowrap}' +
    '.lss-pill.ok{color:#067647;border-color:#abefc6}.lss-pill.fb{color:#b54708;border-color:#fedf89}.lss-pill.nf{color:#b42318;border-color:#fecdca}.lss-pill.gone{color:#475467}' +
    '.lss-hint{font-size:12.5px;color:var(--lss-muted)}.lss-warn{color:#b54708;font-size:12.5px;display:flex;gap:6px;align-items:flex-start}' +
    '.lss-test{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}.lss-result{margin-top:10px;padding:10px 12px;border-radius:10px;border:1px solid var(--lss-line);display:none}.lss-result.on{display:block}' +
    '.lss-bar{position:sticky;bottom:0;z-index:5;display:none;gap:10px;align-items:center;justify-content:space-between;padding:10px 14px;margin-top:10px;border-radius:12px;background:var(--ink,#141a24);color:#fff}' +
    '.lss-bar.on{display:flex}.lss-bar .lss-btn{background:#fff;color:#141a24;border-color:#fff}' +
    '.lss-sw{position:relative;display:inline-flex;align-items:center;gap:10px;cursor:pointer;font-weight:700}' +
    '.lss-sw input{position:absolute;opacity:0}.lss-sw i{width:40px;height:22px;border-radius:99px;background:#cfd4dc;position:relative;transition:background .2s}' +
    '.lss-sw i::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .2s}' +
    '.lss-sw input:checked+i{background:var(--lss-acc)}.lss-sw input:checked+i::after{transform:translateX(18px)}.lss-sw input:focus-visible+i{outline:2px solid var(--lss-acc);outline-offset:2px}';

  function injectCss() { if (document.getElementById('lss-css')) return; var s = document.createElement('style'); s.id = 'lss-css'; s.textContent = CSS; document.head.appendChild(s); }
  function rel(iso) {
    if (!iso) return '—'; var t = Date.parse(iso); if (!isFinite(t)) return '—';
    var s = Math.round((Date.now() - t) / 1000);
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' hr ago';
    return Math.round(s / 86400) + ' days ago';
  }

  function lpSeoSaverPanel(host, o) {
    if (!host) return;
    injectCss();
    var core = window.LPSeoSaver;
    if (!core) { host.innerHTML = '<div class="card"><p class="lede">SEO Saver could not load. Refresh the page.</p></div>'; return; }
    var hits = [], tableReady = null, dirty = false, q = '', view = 'all';

    function cfg() { return o.getConfig() || {}; }
    function S() {
      var c = cfg();
      if (!c.seoSaver || typeof c.seoSaver !== 'object') c.seoSaver = { on: true, notFound: 'smart', redirects: [] };
      if (!Array.isArray(c.seoSaver.redirects)) c.seoSaver.redirects = [];
      return c.seoSaver;
    }
    function pages() {
      return (Array.isArray(cfg().pages) ? cfg().pages : []).filter(function (p) { return p && p.slug && p.status === 'published'; })
        .map(function (p) { return { slug: p.slug, title: p.title || p.slug }; });
    }
    function livePaths() { var s = new Set(['/']); pages().forEach(function (p) { s.add('/' + String(p.slug).toLowerCase()); }); return s; }
    function mark() { dirty = true; paintBar(); }
    function hitsFor(rule) {
      var c = core.compile({ seoSaver: { redirects: [rule] } }); if (!c || !c.count) return { hits: 0, google: 0, last: null };
      var h = 0, g = 0, last = null;
      hits.forEach(function (r) {
        if (r.kind !== 'redirect' && r.kind !== 'gone') return;
        if (!core.matchRule(c, r.path.split('?')[0], r.path.indexOf('?') >= 0 ? r.path.slice(r.path.indexOf('?')) : '')) return;
        h += Number(r.hits) || 0; g += Number(r.google_hits) || 0; if (!last || r.last_seen > last) last = r.last_seen;
      });
      return { hits: h, google: g, last: last };
    }
    function decide(path) {
      return core.resolve({ cfg: { seoSaver: S(), pages: cfg().pages }, reqPath: path, query: path.indexOf('?') >= 0 ? path.slice(path.indexOf('?') + 1) : {}, base: '', pages: pages(), isLivePath: function (p) { return livePaths().has(p); } });
    }

    /* ---------------- render ---------------- */
    function render() {
      var s = S();
      var unresolved = hits.filter(function (r) { return !r.dismissed && (r.kind === 'not_found' || r.kind === 'fallback'); });
      var caught = hits.filter(function (r) { return r.kind === 'redirect' || r.kind === 'fallback' || r.kind === 'gone'; }).reduce(function (a, r) { return a + (Number(r.hits) || 0); }, 0);
      var gbot = hits.reduce(function (a, r) { return a + (Number(r.google_hits) || 0); }, 0);
      host.innerHTML = '<div class="lss">' +
        '<div class="card"><div class="lss-row" style="justify-content:space-between;align-items:flex-start">' +
        '<div style="max-width:760px"><h3>' + ico(I.shield) + ' SEO Saver</h3><p class="lede" style="margin:0">Keeps the Google rankings a business earned on its old website. Every old address is sent to its new page with a permanent (301) redirect, so links, bookmarks and search results keep working.</p></div>' +
        '<label class="lss-sw"><input type="checkbox" id="lss-on"' + (s.on !== false ? ' checked' : '') + '><i></i><span>' + (s.on !== false ? 'On' : 'Off') + '</span></label></div>' +
        '<div class="lss-stats">' +
        '<div class="lss-stat"><b>' + s.redirects.filter(function (r) { return r && r.on !== false; }).length + '</b><span>Redirects</span></div>' +
        '<div class="lss-stat"><b>' + (tableReady === false ? '—' : caught) + '</b><span>Old-URL visits saved</span></div>' +
        '<div class="lss-stat"><b>' + (tableReady === false ? '—' : gbot) + '</b><span>Googlebot visits</span></div>' +
        '<div class="lss-stat"><b>' + (tableReady === false ? '—' : unresolved.length) + '</b><span>To review</span></div></div>' +
        '<div class="lss-row" style="margin-top:12px">' +
        '<div style="flex:1;min-width:260px"><label class="lss-hint" for="lss-nf">Old addresses with no redirect</label><select id="lss-nf" class="lss-sel">' +
        [['smart', 'Send to the closest matching page (recommended)'], ['home', 'Send to the homepage'], ['page', 'Show a “page not found” page']].map(function (x) { return '<option value="' + x[0] + '"' + ((s.notFound || 'smart') === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') +
        '</select></div>' +
        '<div style="flex:1;min-width:220px"><label class="lss-hint" for="lss-old">Previous website address (for your records)</label><input id="lss-old" class="lss-in" placeholder="e.g. oldbusiness.com.au" value="' + esc(s.oldDomain || '') + '"></div></div>' +
        '<p class="lss-hint" style="margin:8px 0 0">Images, PDFs and other files without a redirect always show “not found” — only web pages are sent to a matching page.' + (o.domain ? '' : ' Redirects matter most once the business’s own domain points at LeadPages.') + '</p></div>' +

        // test
        '<div class="card"><h3>' + ico(I.search) + ' Test an old address</h3><p class="lss-hint" style="margin:0 0 8px">Paste any old URL to see exactly what visitors and Google will get. Uses your unsaved changes.</p>' +
        '<div class="lss-test"><input id="lss-test" class="lss-in" placeholder="https://' + esc(s.oldDomain || o.domain || 'old-website.com.au') + '/services/old-page"><button type="button" class="lss-btn" data-a="test">Test</button></div><div class="lss-result" id="lss-result"></div></div>' +

        // review list
        '<div class="card"><div class="lss-row" style="justify-content:space-between"><h3 style="margin:0">' + ico(I.eye) + ' Old addresses to review</h3><button type="button" class="lss-btn sm" data-a="reload">' + ico(I.g) + ' Refresh</button></div>' +
        (tableReady === false ? '<p class="lss-warn" style="margin-top:8px">' + ico(I.warn) + '<span>Visit tracking switches on once the SEO Saver database update is installed (run <b>db/seo_saver.sql</b> in Supabase). Redirects already work without it.</span></p>'
          : tableReady === null ? '<p class="lss-hint">Loading…</p>'
            : !unresolved.length ? '<p class="lss-hint" style="margin:8px 0 0">' + ico(I.check) + ' Nothing to review. Old addresses that people or Google request without a redirect will show here, with a suggested new page.</p>'
              : '<p class="lss-hint" style="margin:6px 0 10px">Requested on the live site but no redirect covers them' + (s.notFound === 'page' ? ' — visitors see “not found”.' : ' — they were sent to a best-guess page (amber) or got “not found” (red).') + ' Add a redirect to make it exact.</p>' +
                '<div class="lss-scroll"><table class="lss-tbl"><thead><tr><th>Old address</th><th>What happens now</th><th>Suggested new page</th><th class="lss-num">Visits</th><th class="lss-num">Google</th><th>Last seen</th><th></th></tr></thead><tbody>' +
                unresolved.map(function (r, i) {
                  var p = r.path.split('?')[0], sug = core.isPageLike(p) ? core.closestPage(p, pages()) : '';
                  return '<tr data-u="' + i + '"><td class="lss-mono">' + esc(r.path) + (r.last_referrer ? '<div class="lss-hint" title="Last linked from">from ' + esc(r.last_referrer).slice(0, 80) + '</div>' : '') + '</td>' +
                    '<td>' + (r.kind === 'fallback' ? '<span class="lss-pill fb">Best guess → ' + esc(r.target || '/') + '</span>' : '<span class="lss-pill nf">Not found</span>') + '</td>' +
                    '<td><input class="lss-in" data-sug="' + i + '" list="lss-pages" value="' + esc(sug || r.target || '') + '" placeholder="/new-page or /assets/…"></td>' +
                    '<td class="lss-num">' + (r.hits || 0) + '</td><td class="lss-num">' + (r.google_hits || 0) + '</td><td>' + esc(rel(r.last_seen)) + '</td>' +
                    '<td style="white-space:nowrap"><button type="button" class="lss-btn sm pri" data-a="adopt" data-i="' + i + '">' + ico(I.plus) + ' Add redirect</button> <button type="button" class="lss-btn sm" data-a="dismiss" data-i="' + i + '" title="Hide from this list">Dismiss</button></td></tr>';
                }).join('') + '</tbody></table></div>') + '</div>' +

        // rules
        '<div class="card"><div class="lss-row" style="justify-content:space-between"><h3 style="margin:0">' + ico(I.arrow) + ' Redirects</h3>' +
        '<div class="lss-row"><select id="lss-view" class="lss-sel" style="width:auto"><option value="all">All</option><option value="pages"' + (view === 'pages' ? ' selected' : '') + '>Pages</option><option value="files"' + (view === 'files' ? ' selected' : '') + '>Images & files</option><option value="issues"' + (view === 'issues' ? ' selected' : '') + '>Problems</option></select>' +
        '<input id="lss-q" class="lss-in" style="width:220px" placeholder="Search…" value="' + esc(q) + '"><button type="button" class="lss-btn" data-a="add">' + ico(I.plus) + ' Add</button></div></div>' +
        '<p class="lss-hint" style="margin:6px 0 10px">Old address → new page. End an old address with <b>*</b> to cover everything that starts with it (e.g. <span class="lss-mono">/blog/*</span> → <span class="lss-mono">/news/*</span> keeps the rest of the path). Full old URLs can be pasted — only the path is used. Case, trailing slashes, <span class="lss-mono">.html</span> and <span class="lss-mono">/index.php</span> don’t matter.</p>' +
        '<div id="lss-rules">' + rulesTable() + '</div>' +
        '<details style="margin-top:12px"><summary style="cursor:pointer;font-weight:700">Bulk add</summary><p class="lss-hint">One per line: <span class="lss-mono">old-address new-page</span> (space, comma or tab between). Leave the new page off and SEO Saver suggests the closest page.</p>' +
        '<textarea id="lss-bulk" class="lss-in" rows="6" placeholder="/services/old-service /new-service&#10;https://old-site.com.au/about-us, /about&#10;/old-page-with-no-target"></textarea>' +
        '<div class="lss-row" style="margin-top:8px"><button type="button" class="lss-btn" data-a="bulk">' + ico(I.plus) + ' Add these</button><span class="lss-hint" id="lss-bulk-msg"></span></div></details></div>' +

        '<datalist id="lss-pages"><option value="/">Homepage</option>' + pages().map(function (p) { return '<option value="/' + esc(p.slug) + '">' + esc(p.title) + '</option>'; }).join('') + '</datalist>' +
        '<div class="lss-bar" id="lss-bar"><span>Unsaved redirect changes — they go live when you save.</span><span class="lss-row"><button type="button" class="lss-btn" data-a="discard">Discard</button><button type="button" class="lss-btn" data-a="save">Save & go live</button></span></div>' +
        '</div>';
      paintBar();
    }

    function problems() {
      var rules = S().redirects, froms = {}, out = {};
      rules.forEach(function (r, i) {
        if (!r || r.on === false) return;
        var c = core.compile({ seoSaver: { redirects: [r] } });
        if (!c || !c.count) { out[i] = 'Needs an old address' + (r.code == 410 ? '' : ' and a new page'); return; }
        var key = String(r.from || '').toLowerCase().replace(/^[a-z]+:\/\/[^/]+/, '');
        key = core.normalizePath(key) + (key.indexOf('?') >= 0 ? key.slice(key.indexOf('?')).toLowerCase() : '') + (/\*$/.test(key) ? '*' : '');
        if (froms[key] != null) out[i] = 'Same old address as row ' + (froms[key] + 1) + ' — only the first one is used';
        else froms[key] = i;
      });
      var lp = livePaths();
      rules.forEach(function (r, i) {
        if (!r || r.on === false || out[i] || r.code == 410) return;
        var to = String(r.to || '').split(/[?#]/)[0];
        if (/^https?:/i.test(to) || /^\/(assets|api)\//i.test(to)) return;
        var nTo = core.normalizePath(to);
        var fromPath = core.normalizePath(String(r.from || '').replace(/^[a-z]+:\/\/[^/]+/i, ''));
        if (nTo === fromPath && !/\*$/.test(r.from)) { out[i] = 'Points to itself'; return; }
        if (!/\*$/.test(r.to || '') && !lp.has(nTo)) {
          // the target is itself an old address → a redirect chain
          var hop = core.matchRule(core.compile({ seoSaver: { redirects: rules.filter(function (x, j) { return j !== i; }) } }), nTo, '');
          out[i] = hop ? 'Chain: ' + to + ' redirects again to ' + hop.to + ' — point straight there' : 'New page ' + to + ' isn’t a published page';
        }
      });
      return out;
    }

    function rulesTable() {
      var rules = S().redirects, probs = problems(), qq = q.toLowerCase();
      var idx = rules.map(function (r, i) { return i; }).filter(function (i) {
        var r = rules[i] || {};
        var file = /\.[a-z0-9]{2,5}(\*|$)/i.test(String(r.from || '').split('?')[0]) || /\/images\//i.test(r.from || '') || /^\/assets\//.test(r.to || '');
        if (view === 'pages' && file) return false;
        if (view === 'files' && !file) return false;
        if (view === 'issues' && !probs[i]) return false;
        if (qq && (String(r.from || '') + ' ' + String(r.to || '') + ' ' + String(r.note || '')).toLowerCase().indexOf(qq) < 0) return false;
        return true;
      });
      if (!rules.length) return '<p class="lss-hint">No redirects yet. Add the old site’s addresses here — or use Bulk add.</p>';
      if (!idx.length) return '<p class="lss-hint">No redirects match.</p>';
      return '<div class="lss-scroll"><table class="lss-tbl"><thead><tr><th style="width:34px"></th><th>Old address</th><th style="width:28px"></th><th>New page</th><th style="width:150px">Type</th><th class="lss-num">Visits</th><th>Last used</th><th style="width:44px"></th></tr></thead><tbody>' +
        idx.map(function (i) {
          var r = rules[i] || {}, h = tableReady ? hitsFor(r) : null, gone = Number(r.code) === 410;
          return '<tr data-r="' + i + '" class="' + (r.on === false ? 'off' : '') + (probs[i] ? ' warn' : '') + '">' +
            '<td><input type="checkbox" data-f="on" aria-label="Use this redirect"' + (r.on !== false ? ' checked' : '') + '></td>' +
            '<td><input class="lss-in lss-mono" data-f="from" value="' + esc(r.from || '') + '" placeholder="/old-address">' + (r.note ? '<div class="lss-hint">' + esc(r.note) + '</div>' : '') + (probs[i] ? '<div class="lss-warn">' + ico(I.warn) + '<span>' + esc(probs[i]) + '</span></div>' : '') + '</td>' +
            '<td style="text-align:center;color:var(--lss-muted)">' + ico(I.arrow) + '</td>' +
            '<td><input class="lss-in lss-mono" data-f="to" list="lss-pages" value="' + esc(gone ? '' : (r.to || '')) + '"' + (gone ? ' disabled placeholder="Removed on purpose"' : ' placeholder="/new-page"') + '></td>' +
            '<td><select class="lss-sel" data-f="code"><option value="301"' + (!gone && Number(r.code || 301) !== 302 ? ' selected' : '') + '>Permanent (301)</option><option value="302"' + (Number(r.code) === 302 ? ' selected' : '') + '>Temporary (302)</option><option value="410"' + (gone ? ' selected' : '') + '>Gone (410)</option></select></td>' +
            '<td class="lss-num">' + (h ? h.hits + (h.google ? ' <span class="lss-hint" title="Googlebot">· G ' + h.google + '</span>' : '') : '—') + '</td><td>' + (h ? esc(rel(h.last)) : '—') + '</td>' +
            '<td><button type="button" class="lss-btn icon danger" data-a="del" data-i="' + i + '" aria-label="Delete redirect">' + ico(I.trash) + '</button></td></tr>';
        }).join('') + '</tbody></table></div>';
    }

    function repaintRules() { var box = host.querySelector('#lss-rules'); if (box) box.innerHTML = rulesTable(); }
    /** Refresh row warnings without rebuilding inputs (keeps focus and the next click). */
    function updateWarnings() {
      var probs = problems();
      Array.prototype.forEach.call(host.querySelectorAll('tr[data-r]'), function (tr) {
        var i = +tr.getAttribute('data-r'), r = S().redirects[i] || {}, msg = probs[i];
        tr.classList.toggle('warn', !!msg); tr.classList.toggle('off', r.on === false);
        var cell = tr.querySelector('td:nth-child(2)'), w = cell && cell.querySelector('.lss-warn');
        if (msg) { if (!w) { w = document.createElement('div'); w.className = 'lss-warn'; cell.appendChild(w); } w.innerHTML = ico(I.warn) + '<span>' + esc(msg) + '</span>'; }
        else if (w) w.remove();
        var to = tr.querySelector('[data-f="to"]'); if (to) { var g = Number(r.code) === 410; to.disabled = g; to.placeholder = g ? 'Removed on purpose' : '/new-page'; if (g) to.value = ''; }
      });
    }
    function paintBar() { var b = host.querySelector('#lss-bar'); if (b) b.classList.toggle('on', dirty); }

    /* ---------------- data ---------------- */
    async function loadHits() {
      try {
        var tok = await o.token();
        var r = await fetch('/api/seo-saver/hits?siteId=' + encodeURIComponent(o.siteId), { headers: tok ? { Authorization: 'Bearer ' + tok } : {} });
        var j = await r.json().catch(function () { return {}; });
        if (!r.ok || !j.ok) { tableReady = false; hits = []; }
        else { hits = j.rows || []; tableReady = j.tableReady !== false; }
      } catch (e) { tableReady = false; hits = []; }
      render();
    }
    var snapshot = JSON.stringify(S());

    /* ---------------- events ---------------- */
    host.addEventListener('click', async function (ev) {
      var b = ev.target.closest('[data-a]'); if (!b) return;
      var a = b.getAttribute('data-a'), s = S();
      if (a === 'test') { runTest(); return; }
      if (a === 'reload') { tableReady = null; render(); loadHits(); return; }
      if (a === 'add') { s.redirects.unshift({ on: true, from: '', to: '', code: 301, source: 'manual' }); mark(); q = ''; view = 'all'; render(); var f = host.querySelector('tr[data-r="0"] [data-f="from"]'); if (f) f.focus(); return; }
      if (a === 'del') { var i = +b.getAttribute('data-i'); s.redirects.splice(i, 1); mark(); repaintRules(); return; }
      if (a === 'adopt' || a === 'dismiss') {
        var unresolved = hits.filter(function (r) { return !r.dismissed && (r.kind === 'not_found' || r.kind === 'fallback'); });
        var row = unresolved[+b.getAttribute('data-i')]; if (!row) return;
        if (a === 'adopt') {
          var inp = host.querySelector('[data-sug="' + b.getAttribute('data-i') + '"]'), to = inp ? inp.value.trim() : '';
          if (!to) { o.toast('Choose the new page first', 'warn'); if (inp) inp.focus(); return; }
          s.redirects.unshift({ on: true, from: row.path, to: to, code: 301, source: 'review' }); mark();
        }
        row.dismissed = true;
        if (a === 'dismiss') {
          try { var tok = await o.token(); fetch('/api/seo-saver/hits', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ siteId: o.siteId, path: row.path, dismissed: true }) }); } catch (e) {}
        }
        render(); return;
      }
      if (a === 'bulk') {
        var ta = host.querySelector('#lss-bulk'), lines = String(ta.value || '').split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean), added = 0, guessed = 0;
        lines.forEach(function (line) {
          var parts = line.split(/[\s,;\t]+/).filter(Boolean); if (!parts.length) return;
          var from = parts[0].replace(/^[a-z]+:\/\/[^/]+/i, '') || '/', to = parts[1] || '';
          if (from === '/') return;
          if (!to) { to = core.isPageLike(from) ? core.closestPage(from, pages()) : ''; if (!to) return; guessed++; }
          to = to.replace(/^[a-z]+:\/\/[^/]+/i, function (m) { return o.domain && m.toLowerCase().indexOf(o.domain.toLowerCase()) >= 0 ? '' : m; }) || '/';
          s.redirects.push({ on: true, from: from, to: to, code: 301, source: 'bulk' }); added++;
        });
        var msg = host.querySelector('#lss-bulk-msg');
        if (added) { ta.value = ''; mark(); render(); o.toast('Added ' + added + ' redirect' + (added === 1 ? '' : 's') + (guessed ? ' (' + guessed + ' with a suggested page — check them)' : '')); }
        else if (msg) msg.textContent = 'Nothing to add — one old address per line.';
        return;
      }
      if (a === 'discard') { cfg().seoSaver = JSON.parse(snapshot); dirty = false; render(); return; }
      if (a === 'save') {
        // drop empty rows; trim values
        s.redirects = s.redirects.filter(function (r) { return r && String(r.from || '').trim() && (Number(r.code) === 410 || String(r.to || '').trim()); })
          .map(function (r) { r.from = String(r.from).trim(); r.to = String(r.to || '').trim(); r.code = Number(r.code) || 301; return r; });
        b.disabled = true; b.textContent = 'Saving…';
        try {
          var res = await o.save();
          if (res && res.ok === false && !res.superseded) throw new Error(res.error || 'Save failed');
          snapshot = JSON.stringify(S()); dirty = false;
          o.toast('Redirects saved — live within a minute');
        } catch (e) { o.toast('Could not save: ' + ((e && e.message) || e), 'warn'); }
        render(); return;
      }
    });
    host.addEventListener('change', function (ev) {
      var t = ev.target, s = S();
      if (t.id === 'lss-on') { s.on = t.checked; mark(); render(); return; }
      if (t.id === 'lss-nf') { s.notFound = t.value; mark(); return; }
      if (t.id === 'lss-view') { view = t.value; repaintRules(); return; }
      var tr = t.closest('tr[data-r]'); if (!tr) return;
      var r = s.redirects[+tr.getAttribute('data-r')]; if (!r) return;
      var f = t.getAttribute('data-f');
      if (f === 'on') r.on = t.checked;
      else if (f === 'code') { r.code = +t.value; }
      else if (f === 'from' || f === 'to') r[f] = t.value.trim();
      mark(); updateWarnings();
    });
    host.addEventListener('input', function (ev) {
      var t = ev.target;
      if (t.id === 'lss-old') { S().oldDomain = t.value.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, ''); mark(); return; }
      if (t.id === 'lss-q') { q = t.value; repaintRules(); return; }
      var tr = t.closest('tr[data-r]'); if (!tr) return;
      var r = S().redirects[+tr.getAttribute('data-r')]; if (!r) return;
      var f = t.getAttribute('data-f');
      if (f === 'from' || f === 'to') { r[f] = t.value; mark(); updateWarnings(); }
    });
    host.addEventListener('keydown', function (ev) { if (ev.target.id === 'lss-test' && ev.key === 'Enter') { ev.preventDefault(); runTest(); } });

    function runTest() {
      var inp = host.querySelector('#lss-test'), out = host.querySelector('#lss-result');
      var raw = String(inp.value || '').trim(); if (!raw) return;
      var path = raw.replace(/^[a-z]+:\/\/[^/]+/i, '') || '/';
      var nPath = core.normalizePath(path), html;
      if (nPath === '/' && !/index\.php/i.test(path)) html = '<span class="lss-pill ok">' + ico(I.check) + ' Homepage</span> This is the homepage — served as normal.';
      else if (livePaths().has(path.split('?')[0]) ) html = '<span class="lss-pill ok">' + ico(I.check) + ' Live page</span> This address is a page on the new site — served as normal.';
      else if (S().on === false) html = '<span class="lss-pill nf">SEO Saver is off</span> Visitors get “page not found”.';
      else {
        var d = decide(path);
        if (!d) html = '<span class="lss-pill nf">Not found</span>';
        else if (d.action === 'redirect') html = (d.kind === 'fallback' ? '<span class="lss-pill fb">Best guess</span> No redirect for this address — sent to the closest page: ' : '<span class="lss-pill ok">' + ico(I.check) + ' 301 redirect</span> Sent permanently to ') + '<b class="lss-mono">' + esc(d.location) + '</b>' + (d.kind === 'fallback' ? '. Add a redirect to make it exact.' : '');
        else if (d.action === 'gone') html = '<span class="lss-pill gone">410 Gone</span> Marked as removed on purpose — Google drops it from results.';
        else html = '<span class="lss-pill nf">404 Not found</span> ' + (core.isPageLike(path) ? 'No redirect, and “show a not found page” is selected.' : 'Files (images, PDFs …) without a redirect are not found.');
      }
      out.innerHTML = html; out.classList.add('on');
    }

    render();
    loadHits();
    return { refresh: function () { snapshot = JSON.stringify(S()); dirty = false; render(); loadHits(); } };
  }

  window.lpSeoSaverPanel = lpSeoSaverPanel;
})();
