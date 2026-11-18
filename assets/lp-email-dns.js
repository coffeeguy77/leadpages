/* LeadPages — Settings → Email (MX / SPF / DKIM / DMARC on Vercel DNS).
 * LeadPages never hosts email: this points the site's custom domain at the
 * customer's provider (Google Workspace, Microsoft 365 or any other).
 * API: /api/site/email-dns (GET status, POST preview / apply / undo).
 * Mount: LPEmailDns.mount(el, { siteId, token: () => Promise<string> }).
 */
(function () {
  'use strict';

  var CSS = ''
    + '.lpe{display:block}'
    + '.lpe *{box-sizing:border-box}'
    + '.lpe .lpe-status{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:0 0 14px}'
    + '.lpe .lpe-chip{display:flex;gap:8px;align-items:flex-start;padding:9px 11px;border:1px solid var(--line);border-radius:10px;background:transparent;color:var(--ink);font-size:13px;line-height:1.35;min-width:0}'
    + '.lpe .lpe-chip b{display:block;font-size:12px;color:var(--ink-soft);font-weight:600}'
    + '.lpe .lpe-chip span.v{word-break:break-all}'
    + '.lpe .lpe-dot{flex:0 0 auto;width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;margin-top:1px}'
    + '.lpe .lpe-dot.ok{background:var(--success-soft,color-mix(in srgb,#16a34a 18%,transparent));color:var(--success,#16a34a)}'
    + '.lpe .lpe-dot.no{background:color-mix(in srgb,var(--ink-faint,#888) 18%,transparent);color:var(--ink-soft)}'
    + '.lpe .lpe-dot.bad{background:color-mix(in srgb,var(--danger,#d92d20) 18%,transparent);color:var(--danger,#d92d20)}'
    + '.lpe .lpe-note{margin:0 0 14px;padding:10px 12px;border-radius:10px;border:1px solid var(--line);font-size:13px;line-height:1.5;color:var(--ink)}'
    + '.lpe .lpe-note.warn{border-color:color-mix(in srgb,#d97706 45%,var(--line));background:color-mix(in srgb,#d97706 10%,transparent)}'
    + '.lpe .lpe-note.err{border-color:color-mix(in srgb,var(--danger,#d92d20) 45%,var(--line));background:color-mix(in srgb,var(--danger,#d92d20) 10%,transparent)}'
    + '.lpe .lpe-note.ok{border-color:color-mix(in srgb,var(--success,#16a34a) 45%,var(--line));background:color-mix(in srgb,var(--success,#16a34a) 10%,transparent)}'
    + '.lpe .lpe-note ul{margin:6px 0 0;padding-left:18px}'
    + '.lpe .lpe-provs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 14px}'
    + '.lpe .lpe-prov{display:flex;flex-direction:column;gap:2px;padding:11px 12px;border:1.5px solid var(--line-strong,var(--line));border-radius:10px;cursor:pointer;background:transparent;color:var(--ink);text-align:left;font:inherit}'
    + '.lpe .lpe-prov small{color:var(--ink-soft);font-size:12px}'
    + '.lpe .lpe-prov[aria-pressed="true"]{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,transparent)}'
    + '.lpe .lpe-prov:focus-visible{outline:2px solid var(--focus,var(--accent));outline-offset:2px}'
    + '.lpe .lpe-sec{margin:0 0 14px;padding:12px;border:1px solid var(--line);border-radius:10px}'
    + '.lpe .lpe-sec h3{margin:0 0 8px;font-size:14px;color:var(--ink)}'
    + '.lpe .lpe-tog{display:flex;gap:8px;align-items:flex-start;font-weight:600;color:var(--ink);margin:0 0 6px;cursor:pointer}'
    + '.lpe .lpe-tog input{margin-top:3px}'
    + '.lpe .lpe-tog .hint{font-weight:400;margin:0}'
    + '.lpe label.lpe-l{display:block;font-size:12px;font-weight:600;color:var(--ink-soft);margin:8px 0 4px}'
    + '.lpe .tin{width:100%}'
    + '.lpe textarea.tin{min-height:84px;resize:vertical;font-family:ui-monospace,Menlo,monospace;font-size:12.5px;line-height:1.45}'
    + '.lpe .lpe-row{display:grid;grid-template-columns:minmax(0,1fr) 110px auto;gap:8px;align-items:end;margin-bottom:6px}'
    + '.lpe .lpe-dk{display:grid;grid-template-columns:140px 100px minmax(0,1fr) auto;gap:8px;align-items:start;margin-bottom:8px}'
    + '.lpe code.lpe-c{font-family:ui-monospace,Menlo,monospace;font-size:12.5px;word-break:break-all;color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:1px 6px;background:transparent}'
    + '.lpe .lpe-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}'
    + '.lpe table.lpe-plan{width:100%;border-collapse:collapse;font-size:12.5px;margin:6px 0 10px}'
    + '.lpe table.lpe-plan td{padding:6px 6px;border-top:1px solid var(--line);vertical-align:top;color:var(--ink)}'
    + '.lpe table.lpe-plan td.v{font-family:ui-monospace,Menlo,monospace;word-break:break-all}'
    + '.lpe table.lpe-plan small.lpe-nm{font-family:ui-monospace,Menlo,monospace;color:var(--ink-soft);word-break:break-all}'
    + '.lpe .lpe-tag{display:inline-block;font-size:11px;font-weight:700;padding:2px 7px;border-radius:999px;white-space:nowrap}'
    + '.lpe .lpe-tag.add{background:color-mix(in srgb,var(--success,#16a34a) 16%,transparent);color:var(--success,#16a34a)}'
    + '.lpe .lpe-tag.del{background:color-mix(in srgb,var(--danger,#d92d20) 16%,transparent);color:var(--danger,#d92d20)}'
    + '.lpe .lpe-tag.keep{background:color-mix(in srgb,var(--ink-faint,#888) 16%,transparent);color:var(--ink-soft)}'
    + '.lpe .lpe-x{appearance:none;border:1px solid var(--line);background:transparent;color:var(--ink-soft);border-radius:8px;padding:8px 10px;cursor:pointer;font:inherit}'
    + '@media(max-width:640px){'
    + '.lpe .lpe-provs{grid-template-columns:1fr}'
    + '.lpe .lpe-row{grid-template-columns:minmax(0,1fr) 90px auto}'
    + '.lpe .lpe-dk{grid-template-columns:1fr 1fr}'
    + '.lpe .lpe-dk .lpe-dk-v{grid-column:1/-1}'
        + '}';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var LABEL = { google: 'Google Workspace', outlook: 'Microsoft 365 (Outlook)', remote: 'Other provider', none: 'No email set up' };

  function injectCss() {
    if (document.getElementById('lpe-css')) return;
    var s = document.createElement('style'); s.id = 'lpe-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  function mount(root, opts) {
    if (!root || !opts || !opts.siteId) return;
    injectCss();
    var S = {
      siteId: opts.siteId, token: opts.token, data: null, provider: null,
      spf: true, dkim: false, dmarc: true, autodiscover: true,
      outlookMx: '', remoteMx: [{ host: '', priority: 10 }], remoteSpf: '',
      dkimRecords: [], plan: null, msg: null, busy: false,
    };
    root.classList.add('lpe');

    function api(method, body) {
      return Promise.resolve(S.token ? S.token() : null).then(function (t) {
        var url = '/api/site/email-dns' + (method === 'GET' ? '?siteId=' + encodeURIComponent(S.siteId) : '');
        return fetch(url, { method: method, headers: Object.assign({ 'content-type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {}), body: body ? JSON.stringify(Object.assign({ siteId: S.siteId }, body)) : undefined });
      }).then(function (r) { return r.json().catch(function () { return { ok: false, error: 'Unexpected reply (' + r.status + ')' }; }); });
    }

    function defaultDkim(p) {
      if (p === 'google') return [{ selector: 'google', type: 'TXT', value: '' }];
      if (p === 'outlook') return [{ selector: 'selector1', type: 'CNAME', value: '' }, { selector: 'selector2', type: 'CNAME', value: '' }];
      return [{ selector: '', type: 'TXT', value: '' }];
    }

    function setProvider(p) {
      if (S.provider === p) return;
      S.provider = p; S.plan = null; S.msg = null;
      S.dkimRecords = defaultDkim(p);
      var cur = S.data && S.data.current;
      // Prefill from what's already on the domain when it matches.
      if (cur && cur.provider === p) {
        if (p === 'outlook' && cur.mx[0]) S.outlookMx = cur.mx[0].host;
        if (p === 'remote' && cur.mx.length) S.remoteMx = cur.mx.map(function (m) { return { host: m.host, priority: m.priority }; });
        var have = (cur.dkim || []).filter(function (d) { return d.selector !== 'resend'; });
        if (have.length) S.dkimRecords = S.dkimRecords.map(function (d) { var h = have.filter(function (x) { return x.selector === d.selector; })[0]; return h ? { selector: h.selector, type: h.type, value: h.value } : d; });
      }
      render();
    }

    function input() {
      var o = { provider: S.provider, spf: S.spf, dkim: S.dkim, dmarc: S.dmarc, dkimRecords: S.dkim ? S.dkimRecords : [] };
      if (S.provider === 'outlook') { o.outlookMx = S.outlookMx; o.autodiscover = S.autodiscover; }
      if (S.provider === 'remote') { o.remoteMx = S.remoteMx; o.remoteSpf = S.remoteSpf; }
      return o;
    }

    function chip(label, state, value) {
      var cls = state === true ? 'ok' : (state === 'bad' ? 'bad' : 'no');
      var sym = state === true ? '✓' : (state === 'bad' ? '!' : '–');
      return '<div class="lpe-chip"><span class="lpe-dot ' + cls + '" aria-hidden="true">' + sym + '</span><div><b>' + esc(label) + '</b><span class="v">' + esc(value) + '</span></div></div>';
    }

    function statusHtml(d) {
      var c = d.current || {};
      var mx = (c.mx || []).map(function (m) { return m.host; }).join(', ');
      var dk = (c.dkim || []).filter(function (x) { return x.selector !== 'resend'; }).map(function (x) { return x.selector; }).join(', ');
      return '<div class="lpe-status">'
        + chip('Email provider', c.provider && c.provider !== 'none' ? true : false, LABEL[c.provider] || '—')
        + chip('MX', (c.mx || []).length ? true : false, mx || 'Not set')
        + chip('SPF', (c.spf || []).length > 1 ? 'bad' : ((c.spf || []).length ? true : false), (c.spf || []).length > 1 ? 'Two SPF records (fix below)' : ((c.spf || [])[0] || 'Not set'))
        + chip('DKIM', dk ? true : false, dk ? ('Selector ' + dk) : 'Not set')
        + chip('DMARC', (c.dmarc || []).length ? true : false, (c.dmarc || [])[0] || 'Not set')
        + '</div>';
    }

    function stateNote(d) {
      var st = d.state || {};
      if (!d.domain) return '<div class="lpe-note">Add a custom domain to this site first (Client site details → Custom domain).</div>';
      if (!st.canManage) {
        if (st.reason === 'not_in_vercel') return '<div class="lpe-note warn"><b>' + esc(d.domain) + '</b> isn’t in LeadPages DNS yet, so email records can’t be set here.' + (d.isSuper ? ' Add the domain in Vercel → Domains first.' : ' Contact LeadPages support to move the domain’s DNS to us.') + '</div>';
        if (st.reason === 'zone_off') return '<div class="lpe-note err">The nameservers point at LeadPages, but Vercel DNS couldn\u2019t be switched on for <b>' + esc(d.domain) + '</b>: ' + esc(st.error || '') + '</div>';
        if (st.reason === 'vercel_not_configured') return '<div class="lpe-note err">DNS management isn’t configured on the server (Vercel token missing).</div>';
        return '<div class="lpe-note err">Can’t manage DNS for this domain right now.</div>';
      }
      if (!st.onVercelNs) {
        return '<div class="lpe-note warn">The domain’s nameservers aren’t on LeadPages DNS yet (now: <code class="lpe-c">' + esc((st.nameservers || []).join(', ') || 'unknown') + '</code>). You can set email up here first — it starts working when the nameservers are changed to <code class="lpe-c">' + esc((st.intendedNameservers || ['ns1.vercel-dns.com', 'ns2.vercel-dns.com']).join(', ')) + '</code>. Doing it in this order avoids any break in email.</div>';
      }
      return '';
    }

    function dkimHelp(p) {
      if (p === 'google') return 'In Google Admin: Apps → Google Workspace → Gmail → <b>Authenticate email</b> → pick the domain → Generate new record. Paste the TXT value (starts with <code class="lpe-c">v=DKIM1;</code>). Click <b>Start authentication</b> in Google after applying.';
      if (p === 'outlook') return 'In <b>security.microsoft.com</b> → Email &amp; collaboration → Policies → Email authentication → <b>DKIM</b> → pick the domain. Copy both CNAME values from “Publish CNAMEs”. Turn DKIM on in Microsoft after applying.';
      return 'Copy the DKIM selector and value from your email provider’s DNS settings.';
    }

    function providerFields() {
      var p = S.provider, h = '';
      if (p === 'google') {
        h += '<div class="lpe-sec"><h3>Mail server (MX)</h3><p class="hint" style="margin:0">Google’s mail server: <code class="lpe-c">smtp.google.com</code> priority 1. Any other MX records on the domain are removed.</p></div>';
      } else if (p === 'outlook') {
        h += '<div class="lpe-sec"><h3>Mail server (MX)</h3>'
          + '<label class="lpe-l" for="lpe-omx">“Points to address” for the MX record</label>'
          + '<input id="lpe-omx" class="tin" placeholder="e.g. yourbusiness-com-au.mail.protection.outlook.com" value="' + esc(S.outlookMx) + '">'
          + '<p class="hint" style="margin:6px 0 0">Microsoft 365 admin centre → Settings → <b>Domains</b> → the domain → DNS records. Each business has its own address, so copy it exactly.</p>'
          + '<label class="lpe-tog" style="margin-top:10px"><input type="checkbox" id="lpe-auto"' + (S.autodiscover ? ' checked' : '') + '> <span>Add Outlook autodiscover <span class="hint">— CNAME <code class="lpe-c">autodiscover</code> → <code class="lpe-c">autodiscover.outlook.com</code>, so Outlook apps set themselves up.</span></span></label></div>';
      } else if (p === 'remote') {
        h += '<div class="lpe-sec"><h3>Mail servers (MX)</h3><p class="hint" style="margin:0 0 8px">From your email provider’s setup page. Lower priority is tried first.</p>';
        S.remoteMx.forEach(function (m, i) {
          h += '<div class="lpe-row"><div><label class="lpe-l" for="lpe-rmh' + i + '">Mail server ' + (i + 1) + '</label><input id="lpe-rmh' + i + '" class="tin" data-rm="host" data-i="' + i + '" placeholder="mx1.provider.com" value="' + esc(m.host) + '"></div>'
            + '<div><label class="lpe-l" for="lpe-rmp' + i + '">Priority</label><input id="lpe-rmp' + i + '" class="tin" type="number" min="0" max="65535" data-rm="priority" data-i="' + i + '" value="' + esc(m.priority) + '"></div>'
            + '<button type="button" class="lpe-x" data-rm-del="' + i + '" aria-label="Remove mail server ' + (i + 1) + '"' + (S.remoteMx.length < 2 ? ' disabled' : '') + '>✕</button></div>';
        });
        h += '<button type="button" class="btn ghost sm" id="lpe-rm-add">+ Add mail server</button></div>';
      }
      // SPF
      h += '<div class="lpe-sec"><label class="lpe-tog"><input type="checkbox" id="lpe-spf"' + (S.spf ? ' checked' : '') + '> <span>SPF <span class="hint">— tells other mail servers this provider may send for the domain. One SPF record is kept; other senders already in it stay.</span></span></label>';
      if (S.spf && p === 'remote') h += '<label class="lpe-l" for="lpe-rspf">SPF include from your provider</label><input id="lpe-rspf" class="tin" placeholder="include:spf.provider.com" value="' + esc(S.remoteSpf) + '">';
      if (S.spf && p === 'google') h += '<p class="hint" style="margin:0">Adds <code class="lpe-c">include:_spf.google.com</code></p>';
      if (S.spf && p === 'outlook') h += '<p class="hint" style="margin:0">Adds <code class="lpe-c">include:spf.protection.outlook.com</code></p>';
      h += '</div>';
      // DKIM
      h += '<div class="lpe-sec"><label class="lpe-tog"><input type="checkbox" id="lpe-dkim"' + (S.dkim ? ' checked' : '') + '> <span>DKIM <span class="hint">— signs outgoing email so it doesn’t land in spam.</span></span></label>';
      if (S.dkim) {
        h += '<p class="hint" style="margin:0 0 8px">' + dkimHelp(p) + '</p>';
        S.dkimRecords.forEach(function (d, i) {
          var fixed = p !== 'remote';
          h += '<div class="lpe-dk"><div><label class="lpe-l" for="lpe-dks' + i + '">Selector</label><input id="lpe-dks' + i + '" class="tin" data-dk="selector" data-i="' + i + '" value="' + esc(d.selector) + '"' + (fixed && p === 'outlook' ? ' readonly' : '') + '></div>'
            + '<div><label class="lpe-l" for="lpe-dkt' + i + '">Type</label><select id="lpe-dkt' + i + '" class="tin" data-dk="type" data-i="' + i + '"' + (fixed ? ' disabled' : '') + '><option' + (d.type === 'TXT' ? ' selected' : '') + '>TXT</option><option' + (d.type === 'CNAME' ? ' selected' : '') + '>CNAME</option></select></div>'
            + '<div class="lpe-dk-v"><label class="lpe-l" for="lpe-dkv' + i + '">' + (d.type === 'CNAME' ? 'Points to' : 'Value') + '</label>'
            + (d.type === 'CNAME' ? '<input id="lpe-dkv' + i + '" class="tin" data-dk="value" data-i="' + i + '" value="' + esc(d.value) + '" placeholder="' + esc(d.selector || 'selector') + '-…._domainkey.…">' : '<textarea id="lpe-dkv' + i + '" class="tin" data-dk="value" data-i="' + i + '" placeholder="v=DKIM1; k=rsa; p=MIIBIjANBg…">' + esc(d.value) + '</textarea>')
            + '</div>' + (p === 'remote' ? '<div><label class="lpe-l">&nbsp;</label><button type="button" class="lpe-x" data-dk-del="' + i + '" aria-label="Remove DKIM ' + (i + 1) + '"' + (S.dkimRecords.length < 2 ? ' disabled' : '') + '>✕</button></div>' : '<div></div>') + '</div>';
        });
        if (p === 'remote') h += '<button type="button" class="btn ghost sm" id="lpe-dk-add">+ Add DKIM record</button>';
      }
      h += '</div>';
      // DMARC
      h += '<div class="lpe-sec"><label class="lpe-tog"><input type="checkbox" id="lpe-dmarc"' + (S.dmarc ? ' checked' : '') + '> <span>DMARC <span class="hint">— adds <code class="lpe-c">v=DMARC1; p=none</code> (no report emails). An existing DMARC record is left as it is.</span></span></label></div>';
      return h;
    }

    function planHtml(pl) {
      var rows = [];
      var nm = function (r) { return r.name ? r.name : '@'; };
      var val = function (r) { return (r.type === 'MX' && r.priority != null ? r.priority + ' ' : '') + r.value; };
      pl.remove.forEach(function (r) { rows.push('<tr><td><span class="lpe-tag del">Remove</span></td><td>' + esc(r.type) + '<br><small class="lpe-nm">' + esc(nm(r)) + '</small></td><td class="v">' + esc(val(r)) + '</td></tr>'); });
      pl.add.forEach(function (r) { rows.push('<tr><td><span class="lpe-tag add">Add</span></td><td>' + esc(r.type) + '<br><small class="lpe-nm">' + esc(nm(r)) + '</small></td><td class="v">' + esc(val(r)) + '</td></tr>'); });
      pl.unchanged.forEach(function (r) { rows.push('<tr><td><span class="lpe-tag keep">Keep</span></td><td>' + esc(r.type) + '<br><small class="lpe-nm">' + esc(nm(r)) + '</small></td><td class="v">' + esc(val(r)) + '</td></tr>'); });
      var nothing = !pl.add.length && !pl.remove.length;
      var mxChange = pl.add.concat(pl.remove).some(function (r) { return r.type === 'MX'; });
      return '<div class="lpe-sec" id="lpe-plan"><h3>' + (nothing ? 'Already set up — nothing to change' : 'These changes will be made') + '</h3>'
        + '<table class="lpe-plan"><tbody>' + rows.join('') + '</tbody></table>'
        + (pl.notes && pl.notes.length ? '<p class="hint" style="margin:0 0 8px">' + pl.notes.map(esc).join(' ') + '</p>' : '')
        + (nothing ? '' : (mxChange ? '<p class="hint" style="margin:0 0 10px"><b>New email will be delivered to ' + esc(LABEL[S.provider]) + '</b> within minutes of applying (some servers take up to an hour). Make sure the mailboxes exist there first. You can undo straight after.</p>' : '')
          + '<div class="lpe-actions"><button type="button" class="btn" id="lpe-apply"' + (S.busy ? ' disabled' : '') + '>Apply changes</button><button type="button" class="btn ghost" id="lpe-cancel">Cancel</button></div>')
        + '</div>';
    }

    function render() {
      var d = S.data;
      if (!d) { root.innerHTML = '<p class="hint" style="margin:0">Checking the domain…</p>'; return; }
      if (d.ok === false) { root.innerHTML = '<div class="lpe-note err">' + esc(d.error || 'Could not load email settings.') + '</div>'; return; }
      var h = '<p class="lede" style="margin:0 0 12px">Point <b>' + esc(d.domain || 'this site’s domain') + '</b> at the business’s email provider. LeadPages doesn’t host email — this only sets the DNS records so mail is delivered and sent properly.</p>';
      h += stateNote(d);
      if (d.state && d.state.canManage) {
        h += statusHtml(d);
        if (d.last && d.last.canUndo) {
          h += '<div class="lpe-note">Last change: ' + esc(LABEL[d.last.provider] || d.last.provider) + ' on ' + esc(new Date(d.last.created_at).toLocaleString()) + '. <button type="button" class="btn ghost sm" id="lpe-undo"' + (S.busy ? ' disabled' : '') + '>Undo it</button></div>';
        }
        if (S.msg) h += '<div class="lpe-note ' + esc(S.msg.kind) + '">' + S.msg.html + '</div>';
        h += '<p class="lede" style="margin:0 0 8px;font-weight:600">Where is their email?</p><div class="lpe-provs" role="group" aria-label="Email provider">'
          + ['google', 'outlook', 'remote'].map(function (p) {
            var sub = p === 'google' ? 'Gmail for business' : (p === 'outlook' ? 'Exchange / Outlook' : 'SiteGround, cPanel, Zoho…');
            return '<button type="button" class="lpe-prov" data-prov="' + p + '" aria-pressed="' + (S.provider === p) + '"><b>' + esc(LABEL[p]) + '</b><small>' + sub + '</small></button>';
          }).join('') + '</div>';
        if (S.provider) {
          h += providerFields();
          h += S.plan ? planHtml(S.plan) : '<div class="lpe-actions"><button type="button" class="btn" id="lpe-preview"' + (S.busy ? ' disabled' : '') + '>Preview changes</button><span class="hint" style="margin:0">Nothing changes until you apply.</span></div>';
        }
      }
      var ae = document.activeElement, aid = ae && root.contains(ae) ? ae.id : null, sel = aid && ae.selectionStart != null ? [ae.selectionStart, ae.selectionEnd] : null;
      root.innerHTML = h;
      if (aid) { var el = document.getElementById(aid); if (el) { el.focus(); if (sel && el.setSelectionRange) try { el.setSelectionRange(sel[0], sel[1]); } catch (_e) {} } }
    }

    function changed() { if (S.plan) { S.plan = null; render(); } }

    root.addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t || !root.contains(t)) return;
      if (t.dataset.prov) return setProvider(t.dataset.prov);
      if (t.id === 'lpe-rm-add') { S.remoteMx.push({ host: '', priority: (S.remoteMx.length + 1) * 10 }); S.plan = null; return render(); }
      if (t.dataset.rmDel != null) { S.remoteMx.splice(+t.dataset.rmDel, 1); S.plan = null; return render(); }
      if (t.id === 'lpe-dk-add') { S.dkimRecords.push({ selector: '', type: 'TXT', value: '' }); S.plan = null; return render(); }
      if (t.dataset.dkDel != null) { S.dkimRecords.splice(+t.dataset.dkDel, 1); S.plan = null; return render(); }
      if (t.id === 'lpe-cancel') { S.plan = null; return render(); }
      if (t.id === 'lpe-preview') {
        S.busy = true; S.msg = null; render();
        return api('POST', { action: 'preview', input: input() }).then(function (j) {
          S.busy = false;
          if (j.ok) S.plan = j.plan;
          else S.msg = { kind: 'err', html: j.errors ? ('Check these first:<ul>' + j.errors.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>') : esc(j.error || 'Could not preview.') };
          render();
          var pe = document.getElementById('lpe-plan'); if (pe && pe.scrollIntoView) pe.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
      }
      if (t.id === 'lpe-apply') {
        S.busy = true; render();
        return api('POST', { action: 'apply', input: input() }).then(function (j) {
          S.busy = false; S.plan = null;
          if (j.ok) {
            if (j.current) S.data.current = j.current;
            if (j.last) S.data.last = j.last;
            S.msg = j.nothingToDo ? { kind: 'ok', html: 'Already set up — nothing needed changing.' }
              : { kind: j.failedRemovals ? 'warn' : 'ok', html: 'Done: ' + j.applied.added + ' record(s) added, ' + j.applied.removed + ' removed.' + (j.failedRemovals ? ' Some old records couldn’t be removed — check the list above.' : '') + (S.dkim ? ' Now finish DKIM in ' + esc(LABEL[S.provider]) + ' (Start authentication / turn DKIM on).' : '') };
          } else S.msg = { kind: 'err', html: esc(j.error || 'Could not apply the changes.') + (j.errors ? '<ul>' + j.errors.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') };
          render();
        });
      }
      if (t.id === 'lpe-undo') {
        if (t.dataset.armed !== '1') { t.dataset.armed = '1'; t.textContent = 'Click again to undo'; return; }
        S.busy = true; render();
        return api('POST', { action: 'undo' }).then(function (j) {
          S.busy = false;
          if (j.ok) { if (j.current) S.data.current = j.current; S.data.last = j.last; S.msg = { kind: 'ok', html: 'Undone — the previous email records are back.' }; }
          else S.msg = { kind: 'err', html: esc(j.error || 'Could not undo.') };
          render();
        });
      }
    });

    root.addEventListener('input', function (e) {
      var t = e.target;
      if (t.id === 'lpe-omx') { S.outlookMx = t.value; return changed(); }
      if (t.id === 'lpe-rspf') { S.remoteSpf = t.value; return changed(); }
      if (t.dataset.rm) { S.remoteMx[+t.dataset.i][t.dataset.rm] = t.value; return changed(); }
      if (t.dataset.dk && t.dataset.dk !== 'type') { S.dkimRecords[+t.dataset.i][t.dataset.dk] = t.value; return changed(); }
    });
    root.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'lpe-spf') { S.spf = t.checked; S.plan = null; return render(); }
      if (t.id === 'lpe-dkim') { S.dkim = t.checked; S.plan = null; return render(); }
      if (t.id === 'lpe-dmarc') { S.dmarc = t.checked; S.plan = null; return render(); }
      if (t.id === 'lpe-auto') { S.autodiscover = t.checked; S.plan = null; return render(); }
      if (t.dataset.dk === 'type') { S.dkimRecords[+t.dataset.i].type = t.value; S.plan = null; return render(); }
    });

    render();
    api('GET').then(function (j) {
      S.data = j;
      var cur = j && j.current;
      if (cur && cur.provider && cur.provider !== 'none') setProvider(cur.provider);
      else render();
    }).catch(function () { S.data = { ok: false, error: 'Could not load email settings.' }; render(); });
  }

  window.LPEmailDns = { mount: mount };
})();
