/**
 * Quote form → File uploads (sections.quote.uploadsOn === true).
 *
 * Adds an "attach files" box to the trade template's quote form. Photos are shrunk in
 * the browser (longest side 2000px, JPEG) before upload; files go straight to private
 * Supabase Storage through one-time links from /api/lead-files/sign, never through Vercel.
 * submitLead() (trade.template.json) calls LPLeadFiles.upload() before posting the lead
 * and sends the result as `files`. If an upload fails the enquiry is still sent (the
 * template adds a note to the lead), so a file problem never loses a lead.
 *
 * Config (all optional): uploadsOn, uploadsLabel, uploadsHelp, uploadsMax (1–5, default 3).
 */
(function () {
  'use strict';

  var MAX_BYTES = 10 * 1024 * 1024;
  var MAX_SIDE = 2000;
  var OK_TYPES = { 'image/jpeg': 1, 'image/png': 1, 'image/webp': 1, 'image/heic': 1, 'image/heif': 1, 'application/pdf': 1 };
  var EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', pdf: 'application/pdf' };

  var state = { files: [], busy: 0, max: 3 };

  function cfg() {
    var C = window.__lpLiveCfg || ((typeof SITE_CONFIG !== 'undefined') ? SITE_CONFIG : null);
    return C || {};
  }
  function Q(C) { return ((C || cfg()).sections || {}).quote || {}; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function txt(v) { return String(v == null ? '' : v).trim(); }
  function size(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function typeOf(f) {
    var t = String(f.type || '').toLowerCase();
    if (OK_TYPES[t]) return t;
    return EXT[String(f.name || '').toLowerCase().split('.').pop()] || '';
  }
  function maxOf(q) { var n = parseInt(q.uploadsMax, 10); return Math.max(1, Math.min(5, isNaN(n) ? 3 : n)); }

  var CLIP = '<svg class="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';

  /** Shrink a photo: longest side 2000px, JPEG 0.82. Returns the original when it can't (e.g. HEIC outside Safari) or when smaller anyway. */
  function shrink(file, type) {
    if (type === 'application/pdf' || !window.createImageBitmap || !document.createElement('canvas').toBlob) return Promise.resolve({ blob: file, type: type, name: file.name });
    return createImageBitmap(file).then(function (bmp) {
      var s = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
      var w = Math.max(1, Math.round(bmp.width * s)), h = Math.max(1, Math.round(bmp.height * s));
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(bmp, 0, 0, w, h);
      if (bmp.close) bmp.close();
      return new Promise(function (res) { c.toBlob(res, 'image/jpeg', 0.82); });
    }).then(function (blob) {
      if (!blob || blob.size >= file.size) return { blob: file, type: type, name: file.name };
      return { blob: blob, type: 'image/jpeg', name: String(file.name || 'photo').replace(/\.[A-Za-z0-9]{1,5}$/, '') + '.jpg' };
    }).catch(function () { return { blob: file, type: type, name: file.name }; });
  }

  function box() { return document.querySelector('[data-sec="quote"] [data-lpf]'); }
  function msg(t) { var m = box() && box().querySelector('.lpf-msg'); if (m) { m.textContent = t || ''; m.hidden = !t; } }

  function paintList() {
    var b = box(); if (!b) return;
    var ul = b.querySelector('.lpf-list');
    ul.innerHTML = state.files.map(function (f, i) {
      return '<li><span class="lpf-ic">' + CLIP + '</span><span class="lpf-name">' + esc(f.name) + '</span><span class="lpf-size">' +
        (f.ready ? size(f.blob.size) : 'Preparing…') + '</span><button type="button" class="lpf-rm" data-lpf-rm="' + i + '" aria-label="Remove ' + esc(f.name) + '">×</button></li>';
    }).join('');
    ul.hidden = !state.files.length;
    var add = b.querySelector('.lpf-add');
    if (add) add.hidden = state.files.length >= state.max;
  }

  function addFiles(list) {
    msg('');
    var arr = Array.prototype.slice.call(list || []);
    arr.forEach(function (file) {
      if (state.files.length >= state.max) { msg('You can attach up to ' + state.max + ' file' + (state.max === 1 ? '' : 's') + '.'); return; }
      var type = typeOf(file);
      if (!type) { msg('"' + file.name + '" isn’t a photo or PDF.'); return; }
      if (type === 'application/pdf' && file.size > MAX_BYTES) { msg('"' + file.name + '" is over 10 MB.'); return; }
      var item = { name: file.name, type: type, blob: file, ready: false };
      state.files.push(item); state.busy++;
      shrink(file, type).then(function (r) {
        state.busy--;
        if (state.files.indexOf(item) < 0) return;
        if (r.blob.size > MAX_BYTES) { state.files.splice(state.files.indexOf(item), 1); msg('"' + file.name + '" is over 10 MB.'); paintList(); return; }
        item.blob = r.blob; item.type = r.type; item.name = r.name; item.ready = true; paintList();
      });
    });
    paintList();
  }

  function render(C) {
    var form = document.getElementById('quoteForm'); if (!form) return;
    var q = Q(C);
    var old = box();
    if (q.uploadsOn !== true) { if (old) old.parentNode.removeChild(old); state.files = []; return; }
    state.max = maxOf(q);
    if (state.files.length > state.max) state.files.length = state.max;
    var label = txt(q.uploadsLabel) || 'Upload plans or photos';
    var help = txt(q.uploadsHelp) || ('Photos or PDFs — up to ' + state.max + ' file' + (state.max === 1 ? '' : 's') + ', 10 MB each. Optional.');
    if (!old) {
      var host = document.getElementById('quoteExtraFields');
      var html = '<div class="ff lpf" data-lpf><label for="lpf-input"></label><p class="lpf-help"></p>' +
        '<ul class="lpf-list" hidden></ul>' +
        '<label class="lpf-add" for="lpf-input">' + CLIP + '<span>Add files</span></label>' +
        '<input id="lpf-input" class="lpf-input" type="file" multiple accept="image/*,application/pdf,.pdf,.heic,.heif">' +
        '<p class="lpf-msg" role="status" aria-live="polite" hidden></p></div>';
      if (host) host.insertAdjacentHTML('afterend', html);
      else { var btn = form.querySelector('button'); if (btn) btn.insertAdjacentHTML('beforebegin', html); else form.insertAdjacentHTML('beforeend', html); }
      old = box();
      old.querySelector('.lpf-input').addEventListener('change', function (e) { addFiles(e.target.files); e.target.value = ''; });
      old.addEventListener('click', function (e) {
        var rm = e.target.closest && e.target.closest('[data-lpf-rm]');
        if (!rm) return;
        state.files.splice(Number(rm.getAttribute('data-lpf-rm')), 1); msg(''); paintList();
      });
    }
    old.querySelector('label[for="lpf-input"]:not(.lpf-add)').textContent = label;
    old.querySelector('.lpf-help').textContent = help;
    paintList();
  }

  function waitReady() {
    return new Promise(function (res) {
      (function tick(n) { if (!state.busy || n > 150) return res(); setTimeout(function () { tick(n + 1); }, 100); })(0);
    });
  }

  /** Upload the chosen files. Resolves { uploadId, month, items } or null; rejects with a readable message. */
  function upload() {
    var C = cfg();
    if (Q(C).uploadsOn !== true || !state.files.length) return Promise.resolve(null);
    var btn = document.querySelector('#quoteForm button.btn-call, #quoteForm button[type="button"]');
    var label = btn ? btn.innerHTML : '';
    function busy(t) { if (btn) { btn.disabled = !!t; if (t) btn.textContent = t; else btn.innerHTML = label; } }
    busy('Uploading files…');
    return waitReady().then(function () {
      var files = state.files.filter(function (f) { return f.ready; });
      if (!files.length) return null;
      return fetch('/api/lead-files/sign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: ((typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG.siteId) || C.siteId), files: files.map(function (f) { return { name: f.name, type: f.type, size: f.blob.size }; }) })
      }).then(function (r) { return r.json().catch(function () { return {}; }); }).then(function (s) {
        if (!s || !s.ok) throw new Error((s && s.message) || 'File upload isn’t available right now.');
        var n = 0;
        return Promise.all(s.uploads.map(function (u, i) {
          var fd = new FormData();
          fd.append('cacheControl', '3600');
          fd.append('', files[i].blob, u.path.split('/').pop());
          return fetch(u.url, { method: 'PUT', headers: { 'x-upsert': 'false' }, body: fd }).then(function (r) {
            if (!r.ok) throw new Error('A file didn’t upload.');
            n++; busy('Uploading files… ' + n + '/' + files.length);
            return { path: u.path, name: files[i].name, size: files[i].blob.size, type: files[i].type };
          });
        })).then(function (items) {
          state.files = []; paintList();
          return { uploadId: s.uploadId, month: s.month, items: items };
        });
      });
    }).then(function (r) { busy(''); return r; }, function (e) { busy(''); msg(e && e.message); throw e; });
  }

  window.LPLeadFiles = {
    count: function () { return state.files.length; },
    upload: upload,
    render: render
  };

  var BOUND = false;
  function bind() {
    if (BOUND) return;
    var o = window.__applyTradeConfig;
    if (typeof o === 'function' && !o.__lpfWrapped) {
      var w = function (c) {
        var r, err = null;
        try { r = o.apply(this, arguments); } catch (e) { err = e; }
        try { render(c); } catch (e) {}
        if (err) throw err;
        return r;
      };
      w.__lpfWrapped = true;
      // Keep any marker other scripts put on the function they wrapped.
      for (var k in o) { if (Object.prototype.hasOwnProperty.call(o, k) && !(k in w)) w[k] = o[k]; }
      window.__applyTradeConfig = w;
      BOUND = true;
    }
  }
  function init() { bind(); try { render(); } catch (e) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.addEventListener('load', function () { bind(); try { render(); } catch (e) {} });
})();
