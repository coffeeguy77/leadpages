/**
 * Local image override for marketplace playground demos.
 * Reads a file into a data URL in the browser — never uploads.
 * Only the visitor sees the override; resetting the example restores the sample.
 */
(function (global) {
  'use strict';

  var MAX_BYTES = 2.5 * 1024 * 1024;

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function isRemote(url) {
    return /^https?:\/\//i.test(String(url || '').trim());
  }

  function isLocalData(url) {
    return /^data:image\//i.test(String(url || '').trim());
  }

  function rememberSample(item, key) {
    key = key || 'image';
    if (!item || typeof item !== 'object') return;
    var cur = item[key];
    if (!item._pgSample && isRemote(cur)) item._pgSample = cur;
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error('No file selected'));
      if (!/^image\//i.test(file.type || '')) return reject(new Error('Please choose an image file'));
      if (file.size > MAX_BYTES) return reject(new Error('Image too large (max about 2.5 MB)'));
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result || '')); };
      r.onerror = function () { reject(new Error('Could not read that image')); };
      r.readAsDataURL(file);
    });
  }

  /**
   * Markup only — call hydrate() / refresh() after insert so long URLs
   * are applied via DOM properties (safe for data URLs + query strings).
   */
  function controlHtml(value, opts) {
    opts = opts || {};
    var v = value || '';
    var sample = opts.sample || (isRemote(v) ? v : '');
    var extra = opts.inputAttrs || '';
    var id = opts.id || ('lp-locimg-' + Math.random().toString(36).slice(2, 9));
    var btnLabel = v ? 'Replace image' : 'Choose image';

    return '<div class="lp-locimg" data-lp-locimg data-has-img="' + (v ? '1' : '0') + '">'
      + '<div class="lp-locimg-row">'
      + '<button type="button" class="lp-locimg-prev' + (v ? '' : ' empty') + '" title="Choose image" aria-label="Choose image">'
      + (v ? '<img alt="">' : '<span>No image</span>')
      + '</button>'
      + '<div class="lp-locimg-actions">'
      + '<button type="button" class="btn ghost sm lp-locimg-choose">' + esc(btnLabel) + '</button>'
      + '<input type="file" id="' + esc(id) + '" class="lp-locimg-file" accept="image/*" hidden>'
      + '<button type="button" class="btn ghost sm lp-locimg-restore"' + (sample && sample !== v ? '' : ' hidden') + '>Restore sample</button>'
      + '<p class="lp-locimg-hint">Local only — nothing uploads.</p>'
      + '</div></div>'
      + '<input type="hidden" class="lp-locimg-input" value="" ' + extra + '>'
      + '<input type="hidden" class="lp-locimg-sample" value="">'
      + '</div>';
  }

  function applyValues(ctl, value, sample) {
    if (!ctl) return;
    var inp = ctl.querySelector('.lp-locimg-input');
    var sampleInp = ctl.querySelector('.lp-locimg-sample');
    var v = value == null ? (inp ? inp.value : '') : String(value || '');
    var s = sample == null
      ? (sampleInp ? sampleInp.value : '')
      : String(sample || '');
    if (inp) inp.value = v;
    if (sampleInp) sampleInp.value = s;
    refreshPreview(ctl);
  }

  function refreshPreview(ctl) {
    if (!ctl) return;
    var inp = ctl.querySelector('.lp-locimg-input');
    var prev = ctl.querySelector('.lp-locimg-prev');
    var sampleInp = ctl.querySelector('.lp-locimg-sample');
    var choose = ctl.querySelector('.lp-locimg-choose');
    var restore = ctl.querySelector('.lp-locimg-restore');
    var v = inp ? inp.value : '';
    var sample = sampleInp ? sampleInp.value : '';
    var ok = !!(v && (isRemote(v) || isLocalData(v)));
    ctl.setAttribute('data-has-img', ok ? '1' : '0');
    if (prev) {
      prev.classList.toggle('empty', !ok);
      if (ok) {
        var img = prev.querySelector('img');
        if (!img) {
          prev.innerHTML = '<img alt="">';
          img = prev.querySelector('img');
        }
        if (img && img.getAttribute('src') !== v) img.setAttribute('src', v);
      } else {
        prev.innerHTML = '<span>No image</span>';
      }
    }
    if (choose) choose.textContent = ok ? 'Replace image' : 'Choose image';
    if (restore) restore.hidden = !(sample && sample !== v);
  }

  function openFilePicker(ctl) {
    var fileInp = ctl && ctl.querySelector('.lp-locimg-file');
    if (fileInp) fileInp.click();
  }

  function setFromFile(ctl, file) {
    var hidden = ctl && ctl.querySelector('.lp-locimg-input');
    if (!ctl || !hidden || !file) return Promise.resolve();
    return readFileAsDataUrl(file).then(function (dataUrl) {
      hidden.value = dataUrl;
      refreshPreview(ctl);
      hidden.dispatchEvent(new Event('input', { bubbles: true }));
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
    }).catch(function (err) {
      var msg = (err && err.message) || 'Could not use that image';
      if (global.console && console.warn) console.warn('[LPLocalImage]', msg);
      hidden.dispatchEvent(new CustomEvent('lp-locimg-error', { bubbles: true, detail: { message: msg } }));
    });
  }

  var __bound = false;

  function bindOnce() {
    if (__bound) return;
    __bound = true;

    document.addEventListener('click', function (e) {
      var choose = e.target.closest && e.target.closest('.lp-locimg-choose, .lp-locimg-prev');
      if (choose) {
        var ctl = choose.closest('[data-lp-locimg]');
        if (!ctl) return;
        e.preventDefault();
        openFilePicker(ctl);
        return;
      }
      var restore = e.target.closest && e.target.closest('.lp-locimg-restore');
      if (!restore) return;
      e.preventDefault();
      var ctl2 = restore.closest('[data-lp-locimg]');
      var hidden = ctl2 && ctl2.querySelector('.lp-locimg-input');
      var sampleInp = ctl2 && ctl2.querySelector('.lp-locimg-sample');
      if (!hidden || !sampleInp) return;
      hidden.value = sampleInp.value || '';
      refreshPreview(ctl2);
      hidden.dispatchEvent(new Event('input', { bubbles: true }));
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
    });

    document.addEventListener('change', function (e) {
      var fileInp = e.target;
      if (!fileInp || !fileInp.classList || !fileInp.classList.contains('lp-locimg-file')) return;
      var ctl = fileInp.closest('[data-lp-locimg]');
      var file = fileInp.files && fileInp.files[0];
      if (!ctl || !file) return;
      setFromFile(ctl, file).then(function () {
        try { fileInp.value = ''; } catch (_e) {}
      });
    });
  }

  function hydrate(scope, value, sample) {
    var root = scope && scope.nodeType ? scope : document;
    var list = [];
    if (root.matches && root.matches('[data-lp-locimg]')) list = [root];
    else list = Array.prototype.slice.call(root.querySelectorAll('[data-lp-locimg]'));
    list.forEach(function (ctl, idx) {
      if (idx === 0 && (value != null || sample != null)) applyValues(ctl, value, sample);
      else refreshPreview(ctl);
    });
  }

  function refresh(scope) {
    (scope || document).querySelectorAll('[data-lp-locimg]').forEach(refreshPreview);
  }

  bindOnce();

  global.LPLocalImage = {
    MAX_BYTES: MAX_BYTES,
    controlHtml: controlHtml,
    readFileAsDataUrl: readFileAsDataUrl,
    rememberSample: rememberSample,
    isRemote: isRemote,
    isLocalData: isLocalData,
    applyValues: applyValues,
    hydrate: hydrate,
    refresh: refresh,
    bindOnce: bindOnce
  };
})(typeof window !== 'undefined' ? window : global);
