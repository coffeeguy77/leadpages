/* LeadPages click-and-edit for partner pages (Nov 2026).
   Open your page with ?edit=1. Click any words to change them, click a picture to replace it,
   use the eye on a section to hide or show it, pick a design from the drop-down, then Save.
   Words are saved to the shared set, so they follow you to any design with the same spot.
   Boot data: window.__LPE = { partnerId, template, slug, hidden, designs, textEditing }. */
(function () {
  'use strict';
  var B = window.__LPE || {};
  var LP = window.__LP || {};
  var API = '/api/partner/website-profile';
  var CLOUD = 'dzx6x1hou';
  var st = {
    sb: null, token: '', wp: null, savedTemplate: '', edits: {}, hidden: {}, dirty: false,
    editing: false, saving: false, uploadKey: '', uploadEl: null
  };
  (B.hidden || []).forEach(function (k) { st.hidden[k] = true; });

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var EYE = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A16.6 16.6 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  var PIC = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/></svg>';

  /* ---------- toolbar ---------- */
  function bar() {
    var designs = (B.designs || []).map(function (d) {
      return '<option value="' + esc(d.id) + '"' + (d.id === B.template ? ' selected' : '') + '>' + esc(d.label) + '</option>';
    }).join('');
    var el = document.createElement('div');
    el.id = 'lpe-bar';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Page editor');
    el.innerHTML = '<div class="lpe-bar-in">'
      + '<span class="lpe-brand"><span class="lpe-dot" aria-hidden="true"></span><strong>Editing your page</strong></span>'
      + '<label class="lpe-design"><span>Design</span><select id="lpe-design" aria-label="Design">' + designs + '</select></label>'
      + '<span class="lpe-preview-note" id="lpe-preview-note" hidden></span>'
      + '<span class="lpe-status" id="lpe-status" aria-live="polite">Checking you\u2019re signed in\u2026</span>'
      + '<span class="lpe-spacer"></span>'
      + '<button type="button" class="lpe-btn lpe-ghost" id="lpe-toggle" title="See the page without editing outlines">Preview</button>'
      + '<a class="lpe-btn lpe-ghost" id="lpe-exit" href="' + esc(location.pathname) + '">Exit</a>'
      + '<button type="button" class="lpe-btn lpe-primary" id="lpe-save" disabled>Save</button>'
      + '</div>';
    document.body.appendChild(el);
    document.documentElement.classList.add('lpe-on');
    var input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.id = 'lpe-file'; input.hidden = true;
    document.body.appendChild(input);
    var pill = document.createElement('button');
    pill.type = 'button'; pill.id = 'lpe-pic'; pill.className = 'lpe-pic'; pill.hidden = true;
    pill.innerHTML = PIC + '<span>Change picture</span>';
    document.body.appendChild(pill);
  }

  function status(t, bad) {
    var s = $('#lpe-status'); if (!s) return;
    s.textContent = t || ''; s.classList.toggle('is-bad', !!bad);
  }
  function setDirty(on) {
    st.dirty = !!on;
    var b = $('#lpe-save'); if (b) b.disabled = !on || st.saving || !st.editing;
    if (on) status('Unsaved changes');
  }

  /* ---------- sections ---------- */
  function secTitle(sec) {
    var h = sec.querySelector('h1,h2,h3');
    var t = h ? (h.innerText || h.textContent).replace(/\s+/g, ' ').trim() : '';
    if (!t) t = sec.getAttribute('aria-label') || sec.getAttribute('data-lp-sec') || 'Section';
    return t.length > 70 ? t.slice(0, 67) + '\u2026' : t;
  }
  function paintSection(sec) {
    var key = sec.getAttribute('data-lp-sec');
    var off = !!st.hidden[key];
    sec.classList.toggle('lpe-sec-off', off);
    var b = sec.querySelector(':scope > .lpe-secbar');
    if (!b) {
      b = document.createElement('div');
      b.className = 'lpe-secbar';
      sec.insertBefore(b, sec.firstChild);
    }
    b.innerHTML = (off ? '<span class="lpe-sec-name">' + esc(secTitle(sec)) + '<em>Hidden</em></span>' : '')
      + '<button type="button" class="lpe-eye" data-lpe-eye="' + esc(key) + '" aria-pressed="' + (off ? 'true' : 'false') + '"'
      + ' title="' + (off ? 'Show this section' : 'Hide this section') + '" aria-label="' + (off ? 'Show' : 'Hide') + ' section: ' + esc(secTitle(sec)) + '">'
      + (off ? EYE_OFF : EYE) + '<span>' + (off ? 'Show' : 'Hide') + '</span></button>';
  }
  function initSections() {
    $$('[data-lp-sec]').forEach(function (sec) {
      if (sec.closest('#lpe-bar')) return;
      if (getComputedStyle(sec).position === 'static') sec.classList.add('lpe-rel');
      paintSection(sec);
    });
  }

  /* ---------- words ---------- */
  function initText() {
    $$('[data-lpe]').forEach(function (el) {
      try { el.contentEditable = 'plaintext-only'; } catch (_e) { el.contentEditable = 'true'; }
      if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
      el.spellcheck = true;
      el.classList.add('lpe-text');
      el.setAttribute('data-lpe-orig', el.innerText);
    });
    document.addEventListener('input', function (e) {
      var el = e.target && e.target.closest && e.target.closest('[data-lpe]');
      if (!el) return;
      var key = el.getAttribute('data-lpe');
      st.edits[key] = el.innerText.replace(/\u00a0/g, ' ');
      // The same words can appear twice on a page (e.g. menu + footer): keep them in step.
      $$('[data-lpe="' + key + '"]').forEach(function (o) { if (o !== el && o.innerText !== el.innerText) o.innerText = el.innerText; });
      setDirty(true);
    }, true);
    document.addEventListener('paste', function (e) {
      var el = e.target && e.target.closest && e.target.closest('[data-lpe]');
      if (!el || !e.clipboardData) return;
      e.preventDefault();
      var txt = e.clipboardData.getData('text/plain') || '';
      document.execCommand('insertText', false, txt);
    }, true);
  }

  /* ---------- pictures ---------- */
  function positionPill(el) {
    var p = $('#lpe-pic'); if (!p || !el) return;
    var r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 30) { p.hidden = true; return; }
    p.style.top = Math.max(70, r.top + 10) + 'px';
    p.style.left = Math.max(8, r.left + 10) + 'px';
    p.hidden = false;
    st.uploadEl = el;
  }
  function initImages() {
    $$('[data-lpe-img]').forEach(function (el) { el.classList.add('lpe-img'); });
    document.addEventListener('mouseover', function (e) {
      if (!st.editing) return;
      var el = e.target.closest && e.target.closest('[data-lpe-img]');
      if (el) positionPill(el);
    });
    window.addEventListener('scroll', function () { var p = $('#lpe-pic'); if (p) p.hidden = true; }, { passive: true });
    $('#lpe-pic').addEventListener('click', function () { pick(st.uploadEl); });
    $('#lpe-file').addEventListener('change', async function (e) {
      var f = e.target.files && e.target.files[0];
      e.target.value = '';
      var el = st.uploadEl; if (!f || !el) return;
      if (f.size > 8 * 1024 * 1024) { status('Please use a picture under 8 MB.', true); return; }
      var key = el.getAttribute('data-lpe-img');
      status('Uploading picture\u2026');
      try {
        var url = await upload(f);
        st.edits[key] = url;
        $$('[data-lpe-img="' + key + '"]').forEach(function (x) {
          if (x.tagName === 'IMG') { x.src = url; x.removeAttribute('srcset'); }
          else x.style.backgroundImage = 'url("' + url + '")';
        });
        setDirty(true);
        status('Picture changed \u2014 press Save to keep it');
      } catch (err) { status(err.message || 'Upload failed', true); }
    });
  }
  function pick(el) {
    if (!el || !st.editing) return;
    st.uploadEl = el;
    $('#lpe-file').click();
  }
  async function upload(file) {
    var folder = 'leadpages/partners/' + B.partnerId + '/design';
    var pid = folder + '/pic-' + Math.random().toString(36).slice(2, 10);
    var sr = await fetch('/api/cloudinary/sign', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + st.token }, body: JSON.stringify({ publicId: pid, assetFolder: folder }) });
    var sg = await sr.json().catch(function () { return {}; });
    if (!sr.ok || !sg.signature) throw new Error('Could not start the upload');
    var fd = new FormData();
    fd.append('file', file); fd.append('api_key', sg.apiKey); fd.append('timestamp', sg.timestamp); fd.append('public_id', sg.publicId);
    if (sg.assetFolder) fd.append('asset_folder', sg.assetFolder);
    if (sg.overwrite) fd.append('overwrite', sg.overwrite);
    fd.append('signature', sg.signature);
    var ur = await fetch('https://api.cloudinary.com/v1_1/' + (sg.cloudName || CLOUD) + '/image/upload', { method: 'POST', body: fd });
    var uj = await ur.json().catch(function () { return {}; });
    if (!ur.ok || !uj.secure_url) throw new Error('Upload failed');
    return uj.secure_url.replace('/image/upload/', '/image/upload/f_auto,q_auto,w_2000/');
  }

  /* ---------- clicks while editing ---------- */
  function onClick(e) {
    if (!st.editing) return;
    if (e.target.closest('#lpe-bar,#lpe-pic')) return;
    var eye = e.target.closest('[data-lpe-eye]');
    if (eye) {
      e.preventDefault(); e.stopPropagation();
      var key = eye.getAttribute('data-lpe-eye');
      if (st.hidden[key]) delete st.hidden[key]; else st.hidden[key] = true;
      var sec = eye.closest('[data-lp-sec]'); if (sec) paintSection(sec);
      setDirty(true);
      return;
    }
    var txt = e.target.closest('[data-lpe]');
    var img = e.target.closest('[data-lpe-img]');
    // Links, buttons and pop-ups don't fire while editing; words become editable instead.
    var act = e.target.closest('a,button,[data-st-open],[role=button],label,summary');
    if (act) { e.preventDefault(); if (!txt) e.stopPropagation(); }
    if (txt) { if (document.activeElement !== txt) txt.focus(); return; }
    if (img) { e.preventDefault(); e.stopPropagation(); pick(img); }
  }
  function onSubmit(e) { if (st.editing && !e.target.closest('#lpe-bar')) e.preventDefault(); }

  function setEditing(on) {
    st.editing = !!on;
    document.documentElement.classList.toggle('lpe-editing', st.editing);
    $$('[data-lpe]').forEach(function (el) {
      if (on) { try { el.contentEditable = 'plaintext-only'; } catch (_e) {} if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true'; }
      else el.contentEditable = 'false';
    });
    var t = $('#lpe-toggle'); if (t) t.textContent = on ? 'Preview' : 'Back to editing';
    var p = $('#lpe-pic'); if (p && !on) p.hidden = true;
    setDirty(st.dirty);
  }

  /* ---------- save ---------- */
  function collect() {
    var wp = st.wp || {};
    var dc = wp.designCopy || {};
    var shared = Object.assign({}, dc.shared || {});
    var own = Object.assign({}, dc[B.template] || {});
    var lines = {};
    Object.keys(st.edits).forEach(function (k) {
      var m = /^(.+)#(\d+)$/.exec(k);
      if (m) { lines[m[1]] = true; return; }
      var v = String(st.edits[k] || '').replace(/\n{3,}/g, '\n\n').trim();
      delete own[k];
      if (v) shared[k] = v; else delete shared[k];
    });
    // List boxes (one item per line): rebuild the whole list in page order.
    Object.keys(lines).forEach(function (base) {
      var items = $$('[data-lpe^="' + base + '#"]').map(function (el) { return el.innerText.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
      delete own[base];
      if (items.length) shared[base] = items.join('\n'); else delete shared[base];
    });
    var designCopy = { shared: shared };
    designCopy[B.template] = own;
    var designHidden = {};
    designHidden[B.template] = Object.keys(st.hidden);
    return { designCopy: designCopy, designHidden: designHidden };
  }

  async function save(opts) {
    opts = opts || {};
    if (st.saving || !st.token) return false;
    st.saving = true; setDirty(st.dirty);
    status('Saving\u2026');
    try {
      var body = { partner_id: B.partnerId, section: 'all', websiteProfile: collect() };
      if (opts.templateKey) body.templateKey = opts.templateKey;
      var r = await fetch(API + '?partner_id=' + encodeURIComponent(B.partnerId), {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + st.token },
        body: JSON.stringify(body)
      });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok || !j.ok) throw new Error(j.error || 'Could not save');
      st.wp = j.websiteProfile || st.wp;
      if (opts.templateKey) st.savedTemplate = opts.templateKey;
      st.edits = {};
      st.saving = false;
      setDirty(false);
      status('Saved \u2713');
      return true;
    } catch (e) {
      st.saving = false; setDirty(true);
      status(e.message || 'Could not save', true);
      return false;
    }
  }

  function goDesign(id) {
    var u = new URL(location.href);
    u.searchParams.set('edit', '1');
    if (id === st.savedTemplate) u.searchParams.delete('tpl'); else u.searchParams.set('tpl', id);
    location.href = u.toString();
  }

  function previewNote() {
    var n = $('#lpe-preview-note'); if (!n) return;
    if (st.savedTemplate && st.savedTemplate !== B.template) {
      var cur = (B.designs || []).filter(function (d) { return d.id === B.template; })[0];
      n.hidden = false;
      n.innerHTML = 'Trying <strong>' + esc(cur ? cur.label : B.template) + '</strong> \u00b7 <button type="button" class="lpe-btn lpe-primary lpe-sm" id="lpe-use">Use this design</button>';
    } else n.hidden = true;
  }

  async function boot() {
    bar();
    initSections();
    if (B.textEditing) initText();
    initImages();
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    window.addEventListener('beforeunload', function (e) { if (st.dirty) { e.preventDefault(); e.returnValue = ''; } });

    $('#lpe-save').addEventListener('click', function () { save(); });
    $('#lpe-toggle').addEventListener('click', function () { setEditing(!st.editing); });
    $('#lpe-design').addEventListener('change', async function (e) {
      var id = e.target.value;
      if (st.dirty) { var ok = await save(); if (!ok) { e.target.value = B.template; return; } }
      goDesign(id);
    });
    document.addEventListener('click', async function (e) {
      if (!e.target.closest('#lpe-use')) return;
      var ok = await save({ templateKey: B.template });
      if (ok) goDesign(B.template);
    });

    if (!window.supabase || !LP.url) { status('Editor could not load. Refresh to try again.', true); return; }
    st.sb = window.supabase.createClient(LP.url, LP.anon);
    var se = await st.sb.auth.getSession();
    var sess = se && se.data && se.data.session;
    if (!sess) {
      status('');
      var s = $('#lpe-status');
      if (s) s.innerHTML = 'Sign in to edit \u00b7 <a href="/partner">Partner sign-in</a>';
      document.documentElement.classList.add('lpe-locked');
      return;
    }
    st.token = sess.access_token;
    try {
      var r = await fetch(API + '?partner_id=' + encodeURIComponent(B.partnerId), { headers: { Authorization: 'Bearer ' + st.token } });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok || !j.ok) throw new Error(r.status === 403 ? 'This page belongs to another partner.' : (j.error || 'Could not load your page'));
      st.wp = j.websiteProfile || {};
      st.savedTemplate = (j.profile && j.profile.showcase_config && j.profile.showcase_config.templateKey) || B.template;
    } catch (e2) {
      status(e2.message, true);
      document.documentElement.classList.add('lpe-locked');
      return;
    }
    setEditing(true);
    previewNote();
    status(B.textEditing ? 'Click any words or picture to change them' : 'Hide sections or switch design. Culture\u2019s words are edited in Partner Website \u2192 Content.');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
