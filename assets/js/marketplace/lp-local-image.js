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
   * @param {string} value current image URL / data URL
   * @param {{ inputAttrs?: string, sample?: string, id?: string }} opts
   */
  function controlHtml(value, opts) {
    opts = opts || {};
    var v = value || '';
    var sample = opts.sample || '';
    var extra = opts.inputAttrs || '';
    var id = opts.id || ('lp-locimg-' + Math.random().toString(36).slice(2, 9));
    var hasPreview = !!(v && (isRemote(v) || isLocalData(v)));
    var canRestore = !!(sample && sample !== v);

    return '<div class="lp-locimg" data-lp-locimg>'
      + '<div class="lp-locimg-row">'
      + '<div class="lp-locimg-prev' + (hasPreview ? '' : ' empty') + '" aria-hidden="true">'
      + (hasPreview ? '<img src="' + esc(v) + '" alt="">' : '<span>No image</span>')
      + '</div>'
      + '<div class="lp-locimg-actions">'
      + '<label class="btn ghost sm lp-locimg-choose" for="' + esc(id) + '">Choose image</label>'
      + '<input type="file" id="' + esc(id) + '" class="lp-locimg-file" accept="image/*" hidden>'
      + (canRestore
        ? '<button type="button" class="btn ghost sm lp-locimg-restore">Restore sample</button>'
        : '')
      + '<p class="lp-locimg-hint">Only on your screen — nothing is uploaded.</p>'
      + '</div></div>'
      + '<input type="hidden" class="lp-locimg-input" value="' + esc(v) + '" ' + extra + '>'
      + (sample ? '<input type="hidden" class="lp-locimg-sample" value="' + esc(sample) + '">' : '')
      + '</div>';
  }

  function refreshPreview(ctl) {
    if (!ctl) return;
    var inp = ctl.querySelector('.lp-locimg-input');
    var prev = ctl.querySelector('.lp-locimg-prev');
    var sampleInp = ctl.querySelector('.lp-locimg-sample');
    var v = inp ? inp.value : '';
    var sample = sampleInp ? sampleInp.value : '';
    if (prev) {
      var ok = !!(v && (isRemote(v) || isLocalData(v)));
      prev.classList.toggle('empty', !ok);
      prev.innerHTML = ok ? '<img src="' + esc(v) + '" alt="">' : '<span>No image</span>';
    }
    var restore = ctl.querySelector('.lp-locimg-restore');
    var actions = ctl.querySelector('.lp-locimg-actions');
    if (sample && sample !== v) {
      if (!restore && actions) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn ghost sm lp-locimg-restore';
        btn.textContent = 'Restore sample';
        var hint = actions.querySelector('.lp-locimg-hint');
        actions.insertBefore(btn, hint || null);
      }
    } else if (restore) {
      restore.remove();
    }
  }

  var __bound = false;

  function bindOnce() {
    if (__bound) return;
    __bound = true;

    document.addEventListener('change', function (e) {
      var fileInp = e.target;
      if (!fileInp || !fileInp.classList || !fileInp.classList.contains('lp-locimg-file')) return;
      var ctl = fileInp.closest('[data-lp-locimg]');
      var hidden = ctl && ctl.querySelector('.lp-locimg-input');
      var file = fileInp.files && fileInp.files[0];
      if (!ctl || !hidden || !file) return;
      readFileAsDataUrl(file).then(function (dataUrl) {
        hidden.value = dataUrl;
        refreshPreview(ctl);
        hidden.dispatchEvent(new Event('input', { bubbles: true }));
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
      }).catch(function (err) {
        var msg = (err && err.message) || 'Could not use that image';
        if (global.console && console.warn) console.warn('[LPLocalImage]', msg);
        try { fileInp.value = ''; } catch (_e) {}
        hidden.dispatchEvent(new CustomEvent('lp-locimg-error', { bubbles: true, detail: { message: msg } }));
      }).then(function () {
        try { fileInp.value = ''; } catch (_e2) {}
      });
    });

    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.lp-locimg-restore');
      if (!btn) return;
      e.preventDefault();
      var ctl = btn.closest('[data-lp-locimg]');
      var hidden = ctl && ctl.querySelector('.lp-locimg-input');
      var sampleInp = ctl && ctl.querySelector('.lp-locimg-sample');
      if (!hidden || !sampleInp) return;
      hidden.value = sampleInp.value || '';
      refreshPreview(ctl);
      hidden.dispatchEvent(new Event('input', { bubbles: true }));
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
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
    refresh: refresh,
    bindOnce: bindOnce
  };
})(typeof window !== 'undefined' ? window : global);
