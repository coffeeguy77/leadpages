/* LeadPages online consent / new-patient form (Nov 2026).
 * Mounted by lp-layouts.js on a page whose content has a ":::consent" block and whose page
 * config has consentForm (see lib/consent-form.js). Three steps: read → details → sign & send.
 * Progress is kept only on this device (localStorage) until the person sends the form; the
 * server builds a signed PDF, emails it to the practice and hands the same PDF back. */
(function () {
  'use strict';
  if (window.LPConsent) return;

  var CSS = [
    '.lpc{--c-ink:var(--ink,#0a2248);--c-blue:var(--hivis,#0b5da8);--c-line:#dbe5f1;--c-soft:#f3f7fc;--c-muted:#4a5668;color:var(--c-ink);border:1px solid var(--c-line);border-radius:18px;background:#fff;box-shadow:0 14px 40px rgba(10,34,72,.08);overflow:hidden}',
    '.lpc *{box-sizing:border-box}',
    '.lpc-top{padding:26px clamp(18px,3vw,34px) 20px;background:linear-gradient(135deg,#f5f9fd,#e8f1fb);border-bottom:1px solid var(--c-line)}',
    '.lpc-top h2{margin:0 0 6px;font-size:clamp(22px,2.4vw,28px);color:var(--c-ink)}',
    '.lpc-top p{margin:0;font-size:15px;line-height:1.55;color:var(--c-ink)}',
    '.lpc-priv{display:flex;gap:10px;align-items:flex-start;margin-top:14px;padding:10px 14px;border-radius:10px;background:#fff;border:1px solid var(--c-line);font-size:13.5px;line-height:1.45;color:var(--c-muted)}',
    '.lpc-priv svg{flex:0 0 18px;width:18px;height:18px;color:var(--c-blue);margin-top:1px}',
    '.lpc-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin:18px 0 0;padding:0;list-style:none;counter-reset:s}',
    '.lpc-steps li{position:relative;display:flex;align-items:center;gap:10px;font-size:14px;font-weight:600;color:var(--c-muted);padding-top:12px}',
    '.lpc-steps li::before{content:"";position:absolute;left:0;right:0;top:0;height:4px;border-radius:4px;background:#d6e2f0}',
    '.lpc-steps li.on::before,.lpc-steps li.done::before{background:var(--c-blue)}',
    '.lpc-steps li + li{margin-left:8px}',
    '.lpc-steps b{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:#e3ecf7;color:var(--c-ink);font-size:13px}',
    '.lpc-steps li.on{color:var(--c-ink)}.lpc-steps li.on b,.lpc-steps li.done b{background:var(--c-blue);color:#fff}',
    '.lpc-body{padding:24px clamp(18px,3vw,34px)}',
    '.lpc-pane[hidden]{display:none}',
    '.lpc-doc{border:1px solid var(--c-line);border-radius:12px;margin-bottom:16px;background:var(--c-soft)}',
    '.lpc-doc h3{margin:0;padding:14px 18px;font-size:17px;color:var(--c-ink);border-bottom:1px solid var(--c-line);display:flex;justify-content:space-between;gap:10px;align-items:center}',
    '.lpc-doc h3 small{font-size:12px;font-weight:600;color:var(--c-blue);white-space:nowrap}',
    '.lpc-doc-text{max-height:320px;overflow:auto;padding:14px 18px;background:#fff;font-size:14px;line-height:1.6;color:#1a2230}',
    '.lpc-doc-text h4{margin:14px 0 6px;font-size:15px;color:var(--c-ink)}.lpc-doc-text p{margin:0 0 10px}.lpc-doc-text ul{margin:0 0 10px;padding-left:20px}',
    '.lpc-doc-text table{border-collapse:collapse;width:100%;margin:6px 0 12px;font-size:13px}.lpc-doc-text th,.lpc-doc-text td{border:1px solid var(--c-line);padding:6px 8px;text-align:left;vertical-align:top}.lpc-doc-text th{background:var(--c-soft)}',
    '.lpc-doc-foot{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center;padding:12px 18px}',
    '.lpc-check{display:flex;gap:10px;align-items:flex-start;font-size:14.5px;font-weight:600;cursor:pointer;color:var(--c-ink)}',
    '.lpc-check input{width:20px;height:20px;margin:1px 0 0;accent-color:var(--c-blue);flex:0 0 auto}',
    '.lpc-ini{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600}',
    '.lpc .lpc-ini input{width:84px!important;padding:8px!important;text-transform:uppercase;text-align:center;letter-spacing:.08em}',
    '.lpc-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px 20px}',
    '.lpc-f{display:flex;flex-direction:column;gap:6px;font-size:14px;font-weight:600;color:var(--c-ink)}',
    '.lpc-f.full{grid-column:1/-1}',
    '.lpc-f em{color:#b42323;font-style:normal}',
    '.lpc input[type=text],.lpc input[type=email],.lpc input[type=tel],.lpc input[type=date],.lpc textarea{font:inherit;font-weight:400;font-size:16px;color:var(--c-ink);background:#fff;border:1px solid #c5d3e4;border-radius:9px;padding:11px 12px;width:100%}',
    '.lpc textarea{min-height:84px;resize:vertical}',
    '.lpc input:focus,.lpc textarea:focus{outline:2px solid rgba(11,93,168,.35);border-color:var(--c-blue)}',
    '.lpc .bad{border-color:#d04141!important;background:#fff6f6!important}',
    '.lpc-decl{padding:16px 18px;border-radius:12px;background:var(--c-soft);border:1px solid var(--c-line);font-size:15px;line-height:1.55;margin-bottom:18px}',
    '.lpc-sig{position:relative;border:2px dashed #b9c9dc;border-radius:12px;background:#fff;height:190px;touch-action:none}',
    '.lpc-sig.bad{border-color:#d04141}',
    '.lpc-sig canvas{position:absolute;inset:0;width:100%;height:100%;cursor:crosshair;border-radius:10px}',
    '.lpc-sig-ph{position:absolute;left:18px;bottom:16px;right:18px;border-top:1px solid #c5d3e4;padding-top:6px;font-size:12.5px;color:var(--c-muted);pointer-events:none}',
    '.lpc-sig-row{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:8px 0 18px;font-size:13.5px;color:var(--c-muted)}',
    '.lpc-nav{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;margin-top:22px}',
    '.lpc-btn{display:inline-flex;align-items:center;gap:8px;font:inherit;font-weight:600;font-size:15px;border-radius:9px;padding:12px 20px;cursor:pointer;border:1px solid var(--c-blue);background:var(--c-blue);color:#fff;text-decoration:none}',
    '.lpc-btn[disabled]{opacity:.55;cursor:not-allowed}',
    '.lpc-btn.ghost{background:#fff;color:var(--c-blue)}',
    '.lpc-btn.link{border:0;background:none;color:var(--c-blue);padding:8px 4px;text-decoration:underline;text-underline-offset:3px}',
    '.lpc-btn svg{width:18px;height:18px}',
    '.lpc-save{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;padding:12px clamp(18px,3vw,34px);border-top:1px solid var(--c-line);background:var(--c-soft);font-size:13.5px;color:var(--c-muted)}',
    '.lpc-save span{display:inline-flex;align-items:center;gap:8px}',
    '.lpc-save svg{width:16px;height:16px;color:var(--c-blue)}',
    '.lpc-save .lpc-btn{padding:8px 14px;font-size:13.5px}',
    '.lpc-msg{margin:14px 0 0;padding:12px 14px;border-radius:10px;font-size:14px;font-weight:600}',
    '.lpc-msg.err{background:#fdeeee;color:#b42323;border:1px solid #f3cccc}',
    '.lpc-msg.ok{background:#eaf6ee;color:#1d6b3a;border:1px solid #c8e6d2}',
    '.lpc-done{text-align:center;padding:30px 10px}',
    '.lpc-done-ic{width:78px;height:78px;margin:0 auto 14px;border-radius:50%;background:#e4f3ea;color:#1d8a4a;display:grid;place-items:center;animation:lpcPop .45s ease-out}',
    '.lpc-done-ic svg{width:40px;height:40px}',
    '.lpc-done h3{margin:0 0 8px;font-size:24px;color:var(--c-ink)}.lpc-done p{margin:0 auto 18px;max-width:520px;font-size:15px;line-height:1.55}',
    '@keyframes lpcPop{0%{transform:scale(.5);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}',
    '.lpc-hp{position:absolute!important;left:-9999px!important;width:1px;height:1px;overflow:hidden}',
    '@media(max-width:640px){.lpc-grid{grid-template-columns:1fr}.lpc-steps li span{display:none}.lpc-nav .lpc-btn{flex:1;justify-content:center}.lpc-doc-text{max-height:260px}}'
  ].join('\n');

  var IC = {
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>'
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function inline(s) {
    return esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\(((?:https?:|mailto:|tel:|\/)[^)\s]*)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  /** Small markdown for the documents: ### headings, - lists, | tables |, paragraphs. */
  function md(t) {
    var L = String(t || '').replace(/\r/g, '').split('\n'), h = '', i = 0;
    while (i < L.length) {
      var l = L[i];
      if (!l.trim()) { i++; continue; }
      var hd = /^\s*#{1,4}\s+(.*)$/.exec(l);
      if (hd) { h += '<h4>' + inline(hd[1]) + '</h4>'; i++; continue; }
      if (/^\s*\|/.test(l)) {
        var rows = [];
        while (i < L.length && /^\s*\|/.test(L[i])) { if (!/^\s*\|?\s*:?-{2,}/.test(L[i])) rows.push(L[i]); i++; }
        h += '<table>' + rows.map(function (r, n) {
          var c = r.trim().replace(/^\||\|$/g, '').split('|');
          return '<tr>' + c.map(function (x) { return n ? '<td>' + inline(x.trim()) + '</td>' : '<th>' + inline(x.trim()) + '</th>'; }).join('') + '</tr>';
        }).join('') + '</table>';
        continue;
      }
      if (/^\s*[-*]\s+/.test(l)) {
        var li = [];
        while (i < L.length && /^\s*[-*]\s+/.test(L[i])) { li.push(L[i].replace(/^\s*[-*]\s+/, '')); i++; }
        h += '<ul>' + li.map(function (x) { return '<li>' + inline(x) + '</li>'; }).join('') + '</ul>';
        continue;
      }
      var p = [];
      while (i < L.length && L[i].trim() && !/^\s*(#{1,4}\s|\||[-*]\s)/.test(L[i])) { p.push(L[i].trim()); i++; }
      h += '<p>' + inline(p.join(' ')) + '</p>';
    }
    return h;
  }

  var store = {
    get: function (k) { try { var v = window.localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del: function (k) { try { window.localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  function timeOf(ts) {
    try { return new Date(ts).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; }
  }

  function mount(host) {
    if (!host || host.__lpcMounted) return;
    var ctx = host.__lpConsent; if (!ctx || !ctx.form) return;
    host.__lpcMounted = true;
    if (!document.getElementById('lpc-css')) { var st = document.createElement('style'); st.id = 'lpc-css'; st.textContent = CSS; document.head.appendChild(st); }

    var F = ctx.form, SC = ((typeof SITE_CONFIG !== 'undefined') ? SITE_CONFIG : window.SITE_CONFIG) || {};
    var pageSlug = ctx.page && ctx.page.slug;
    var KEY = 'lpConsent:' + (SC.slug || SC.siteId || location.host) + ':' + pageSlug;
    var docs = (F.documents || []).filter(function (d) { return d && (d.title || d.body); });
    var fields = (F.fields || []).filter(function (f) { return f && f.k && f.on !== false; });
    var started = Date.now();
    var S = { step: 0, answers: {}, read: {}, initials: {}, signedName: '', agree: false, signature: '', at: 0 };
    var saved = store.get(KEY);
    if (saved && saved.v === 1) { Object.keys(S).forEach(function (k) { if (saved[k] != null) S[k] = saved[k]; }); }
    var restored = !!(saved && saved.v === 1);

    var steps = ['Read', 'Your details', 'Sign & send'];
    host.innerHTML = '<div class="lpc" role="form" aria-label="' + esc(F.title || 'Form') + '">' +
      '<div class="lpc-top"><h2>' + esc(F.title || 'New patient form') + '</h2>' + (F.intro ? '<p>' + inline(F.intro) + '</p>' : '') +
      '<div class="lpc-priv">' + IC.lock + '<span>' + inline(F.privacyNote || 'Your answers are kept only on this device until you press **Send**. When you send the form it is emailed straight to the practice as a signed PDF — it is not stored on this website.') + '</span></div>' +
      '<ol class="lpc-steps">' + steps.map(function (s, i) { return '<li data-s="' + i + '"><b>' + (i + 1) + '</b><span>' + s + '</span></li>'; }).join('') + '</ol></div>' +
      '<div class="lpc-body">' +
      // Step 1: read
      '<div class="lpc-pane" data-pane="0">' + docs.map(function (d, i) {
        return '<div class="lpc-doc"><h3>' + esc(d.title || 'Document') + (d.initial ? '<small>Initials needed</small>' : '') + '</h3>' +
          '<div class="lpc-doc-text" tabindex="0">' + md(d.body) + '</div>' +
          '<div class="lpc-doc-foot"><label class="lpc-check"><input type="checkbox" data-read="' + i + '"> I have read and understood the ' + esc(d.title || 'document') + '</label>' +
          (d.initial ? '<label class="lpc-ini">Initials <input type="text" maxlength="5" autocomplete="off" data-ini="' + i + '" aria-label="Your initials for ' + esc(d.title || '') + '"></label>' : '') + '</div></div>';
      }).join('') +
      '<div class="lpc-nav"><span></span><button type="button" class="lpc-btn" data-go="1">Next: your details</button></div></div>' +
      // Step 2: details
      '<div class="lpc-pane" data-pane="1" hidden><div class="lpc-grid">' + fields.map(function (f) {
        var t = ({ email: 1, tel: 1, date: 1, textarea: 1 })[f.type] ? f.type : 'text';
        var ac = ({ fullName: 'name', email: 'email', phone: 'tel', address: 'street-address', dob: 'bday' })[f.k] || 'on';
        var input = t === 'textarea' ? '<textarea data-k="' + esc(f.k) + '" autocomplete="' + ac + '"' + (f.ph ? ' placeholder="' + esc(f.ph) + '"' : '') + '></textarea>'
          : '<input type="' + t + '" data-k="' + esc(f.k) + '" autocomplete="' + ac + '"' + (f.ph ? ' placeholder="' + esc(f.ph) + '"' : '') + '>';
        return '<label class="lpc-f' + (t === 'textarea' || f.full ? ' full' : '') + '"><span>' + esc(f.label || f.k) + (f.req ? ' <em>*</em>' : '') + '</span>' + input + '</label>';
      }).join('') + '</div>' +
      '<div class="lpc-nav"><button type="button" class="lpc-btn ghost" data-go="0">Back</button><button type="button" class="lpc-btn" data-go="2">Next: sign</button></div></div>' +
      // Step 3: sign
      '<div class="lpc-pane" data-pane="2" hidden><div class="lpc-decl" data-decl></div>' +
      '<div class="lpc-grid"><label class="lpc-f"><span>Full name (as your signature) <em>*</em></span><input type="text" data-signed autocomplete="name"></label>' +
      '<label class="lpc-f"><span>Date</span><input type="text" data-date readonly></label></div>' +
      '<p style="margin:18px 0 8px;font-weight:600;font-size:14px">Sign below with your finger, stylus or mouse <em style="color:#b42323;font-style:normal">*</em></p>' +
      '<div class="lpc-sig" data-sigbox><canvas aria-label="Signature pad"></canvas><div class="lpc-sig-ph">Signature</div></div>' +
      '<div class="lpc-sig-row"><span>Your signature is added to the PDF.</span><button type="button" class="lpc-btn link" data-sigclear>Clear signature</button></div>' +
      '<label class="lpc-check"><input type="checkbox" data-agree> ' + esc(F.agreeText || 'I confirm the details above are correct and agree to the documents I have read.') + '</label>' +
      '<div class="lpc-hp" aria-hidden="true"><label>Leave empty<input type="text" tabindex="-1" autocomplete="off" data-hp></label></div>' +
      '<div class="lpc-nav"><button type="button" class="lpc-btn ghost" data-go="1">Back</button><button type="button" class="lpc-btn" data-send>' + IC.send + 'Send to ' + esc(F.sendTo || 'the practice') + '</button></div>' +
      '<div data-msg></div></div>' +
      '<div class="lpc-pane" data-pane="3" hidden><div class="lpc-done" data-done></div></div>' +
      '</div>' +
      '<div class="lpc-save" data-savebar><span data-savestate>' + IC.save + (restored ? 'Welcome back — your answers saved on this device (' + esc(timeOf(S.at)) + ') have been restored.' : 'Progress saves automatically on this device as you go.') + '</span>' +
      '<span><button type="button" class="lpc-btn ghost" data-save>Save progress</button><button type="button" class="lpc-btn link" data-clear>Clear saved answers</button></span></div>' +
      '</div>';

    var root = host.querySelector('.lpc');
    var $ = function (sel) { return host.querySelector(sel); };
    var $$ = function (sel) { return Array.prototype.slice.call(host.querySelectorAll(sel)); };

    // Fill in what we have.
    $$('[data-read]').forEach(function (cb) { cb.checked = S.read[cb.getAttribute('data-read')] === true; });
    $$('[data-ini]').forEach(function (inp) { inp.value = S.initials[inp.getAttribute('data-ini')] || ''; });
    $$('[data-k]').forEach(function (inp) { inp.value = S.answers[inp.getAttribute('data-k')] || ''; });
    $('[data-signed]').value = S.signedName || '';
    $('[data-agree]').checked = S.agree === true;
    var today = new Date();
    $('[data-date]').value = today.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

    function nameGuess() { var f = fields.filter(function (x) { return x.k === 'fullName'; })[0]; return f ? (S.answers.fullName || '') : ''; }
    function decl() {
      var nm = S.signedName || nameGuess() || '__________';
      $('[data-decl]').innerHTML = inline(String(F.declaration || 'I, {name}, have read and understood the documents above.').replace(/\{name\}/g, '**' + nm.replace(/\*/g, '') + '**'));
    }

    // Saving on this device.
    var saveTimer = null;
    function collect() {
      $$('[data-read]').forEach(function (cb) { S.read[cb.getAttribute('data-read')] = cb.checked; });
      $$('[data-ini]').forEach(function (inp) { S.initials[inp.getAttribute('data-ini')] = inp.value.trim().toUpperCase(); });
      $$('[data-k]').forEach(function (inp) { S.answers[inp.getAttribute('data-k')] = inp.value; });
      S.signedName = $('[data-signed]').value;
      S.agree = $('[data-agree]').checked;
    }
    var sent = false;
    function saveNow(manual) {
      if (sent) return;
      collect();
      S.at = Date.now();
      var ok = store.set(KEY, Object.assign({ v: 1 }, S));
      var st = $('[data-savestate]');
      st.innerHTML = IC.save + (ok ? (manual ? 'Saved on this device — you can close this page and come back to finish later (' + esc(timeOf(S.at)) + ').' : 'Saved on this device · ' + esc(timeOf(S.at))) : 'This browser won’t let us save progress — please finish the form in one go.');
    }
    function later() { clearTimeout(saveTimer); saveTimer = setTimeout(function () { saveNow(false); }, 700); }
    root.addEventListener('input', function (e) { if (e.target && e.target.matches('[data-hp]')) return; if (e.target && e.target.matches('[data-signed]')) { S.signedName = e.target.value; decl(); } later(); });
    root.addEventListener('change', function () { later(); });
    $('[data-save]').addEventListener('click', function () { saveNow(true); });
    var clearArm = false;
    $('[data-clear]').addEventListener('click', function (e) {
      if (!clearArm) { clearArm = true; e.target.textContent = 'Click again to clear everything'; setTimeout(function () { clearArm = false; e.target.textContent = 'Clear saved answers'; }, 4000); return; }
      store.del(KEY);
      host.__lpcMounted = false; mount(host);
    });

    // Signature pad.
    var box = $('[data-sigbox]'), cv = box.querySelector('canvas'), cx = cv.getContext('2d'), drawing = false, last = null, dirty = !!S.signature;
    function sizePad() {
      var r = box.getBoundingClientRect(), d = Math.max(1, window.devicePixelRatio || 1);
      var keep = dirty ? cv.toDataURL('image/png') : '';
      cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d);
      cx.setTransform(d, 0, 0, d, 0, 0);
      cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.lineWidth = 2.4; cx.strokeStyle = '#0a2248';
      var src = keep || S.signature;
      if (src) { var im = new Image(); im.onload = function () { cx.drawImage(im, 0, 0, r.width, r.height); }; im.src = src; }
    }
    function pt(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    cv.addEventListener('pointerdown', function (e) { drawing = true; last = pt(e); cv.setPointerCapture && cv.setPointerCapture(e.pointerId); cx.beginPath(); cx.arc(last.x, last.y, 1.1, 0, 7); cx.fillStyle = '#0a2248'; cx.fill(); dirty = true; e.preventDefault(); });
    cv.addEventListener('pointermove', function (e) { if (!drawing) return; var p = pt(e); cx.beginPath(); cx.moveTo(last.x, last.y); cx.lineTo(p.x, p.y); cx.stroke(); last = p; e.preventDefault(); });
    function endStroke() { if (!drawing) return; drawing = false; S.signature = cv.toDataURL('image/png'); box.classList.remove('bad'); later(); }
    cv.addEventListener('pointerup', endStroke); cv.addEventListener('pointercancel', endStroke); cv.addEventListener('pointerleave', endStroke);
    $('[data-sigclear]').addEventListener('click', function () { cx.clearRect(0, 0, cv.width, cv.height); dirty = false; S.signature = ''; later(); });

    // Steps.
    function show(n) {
      S.step = n;
      $$('[data-pane]').forEach(function (p) { p.hidden = Number(p.getAttribute('data-pane')) !== n; });
      $$('.lpc-steps li').forEach(function (li) { var i = Number(li.getAttribute('data-s')); li.classList.toggle('on', i === n); li.classList.toggle('done', i < n); });
      if (n === 2) { if (!$('[data-signed]').value) { $('[data-signed]').value = nameGuess(); S.signedName = nameGuess(); } decl(); setTimeout(sizePad, 0); }
    }
    function checkStep(n) {
      var bad = [];
      if (n === 0) {
        $$('[data-read]').forEach(function (cb) { var b = !cb.checked; cb.closest('.lpc-doc').querySelector('.lpc-check').style.color = b ? '#b42323' : ''; if (b) bad.push(cb); });
        $$('[data-ini]').forEach(function (inp) { var b = !inp.value.trim(); inp.classList.toggle('bad', b); if (b) bad.push(inp); });
      }
      if (n === 1) {
        fields.forEach(function (f) {
          var inp = host.querySelector('[data-k="' + f.k + '"]'); if (!inp) return;
          var v = inp.value.trim(), b = (f.req && !v) || (v && f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v));
          inp.classList.toggle('bad', !!b); if (b) bad.push(inp);
        });
      }
      if (bad.length && bad[0].focus) { bad[0].focus(); if (bad[0].scrollIntoView) bad[0].scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      return !bad.length;
    }
    $$('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () {
        var to = Number(b.getAttribute('data-go'));
        if (to > S.step && !checkStep(S.step)) return;
        collect(); show(to); saveNow(false);
        var top = host.getBoundingClientRect().top + window.pageYOffset - (window.innerWidth < 760 ? 150 : 110);
        if (window.pageYOffset > top) window.scrollTo({ top: top, behavior: 'smooth' });
      });
    });

    function msg(t, kind) { $('[data-msg]').innerHTML = t ? '<p class="lpc-msg ' + (kind || 'err') + '">' + t + '</p>' : ''; }
    function download(b64, name) {
      try {
        var bin = atob(b64), arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        var url = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));
        var a = document.createElement('a'); a.href = url; a.download = name || 'form.pdf'; document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
      } catch (e) { /* ignore */ }
    }
    $('[data-send]').addEventListener('click', function () {
      collect();
      var bad = false;
      if (!S.signedName.trim()) { $('[data-signed]').classList.add('bad'); bad = true; } else $('[data-signed]').classList.remove('bad');
      if (!dirty || !S.signature) { box.classList.add('bad'); bad = true; }
      if (!S.agree) { $('[data-agree]').parentNode.style.color = '#b42323'; bad = true; } else $('[data-agree]').parentNode.style.color = '';
      if (bad) { msg('Please type your full name, sign in the box and tick the confirmation.'); return; }
      if (!checkStep(0)) { show(0); return; }
      if (!checkStep(1)) { show(1); return; }
      var btn = this; btn.disabled = true; btn.innerHTML = IC.send + 'Sending…'; msg('');
      var payload = { slug: SC.slug, siteId: SC.siteId, page: pageSlug, answers: S.answers, read: {}, initials: S.initials, signedName: S.signedName.trim(), agree: true, signature: S.signature, hp: $('[data-hp]').value, startedAt: started };
      Object.keys(S.read).forEach(function (k) { payload.read[k] = S.read[k] === true; });
      fetch('/api/consent-form', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
        .then(function (j) {
          if (!j || !j.ok) {
            btn.disabled = false; btn.innerHTML = IC.send + 'Send to ' + esc(F.sendTo || 'the practice');
            msg(j && j.errors ? 'Some answers need another look — please check the highlighted fields.' : 'Sorry, the form could not be sent just now. Your answers are saved on this device — please try again shortly, or email ' + esc(F.recipientLabel || 'the practice') + '.');
            return;
          }
          sent = true; clearTimeout(saveTimer);
          store.del(KEY);
          var done = $('[data-done]');
          done.innerHTML = '<div class="lpc-done-ic">' + IC.check + '</div>' +
            '<h3>' + (j.sent ? 'Thank you — your form has been sent' : 'Your form is ready — please email it') + '</h3>' +
            '<p>' + (j.sent ? inline(F.successText || 'Your signed form has been emailed to the practice. A copy is ready for you to keep.') :
              'We couldn’t email it automatically. Please download your signed copy and email it to ' + esc(F.recipientLabel || 'the practice') + '.') + '</p>' +
            (j.pdf ? '<button type="button" class="lpc-btn" data-dl>' + IC.down + 'Download your copy (PDF)</button>' : '');
          var dl = done.querySelector('[data-dl]');
          if (dl) dl.addEventListener('click', function () { download(j.pdf, j.filename); });
          $('[data-savebar]').hidden = true;
          show(3);
          $$('.lpc-steps li').forEach(function (li) { li.classList.add('done'); li.classList.remove('on'); });
        })
        .catch(function () {
          btn.disabled = false; btn.innerHTML = IC.send + 'Send to ' + esc(F.sendTo || 'the practice');
          msg('Sorry, the form could not be sent — please check your connection. Your answers are saved on this device.');
        });
    });

    window.addEventListener('resize', function () { if (S.step === 2) sizePad(); });
    show(Math.min(Number(S.step) || 0, 2));
  }

  window.LPConsent = { mount: mount, _md: md };
})();
