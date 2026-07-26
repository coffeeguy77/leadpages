/**
 * Local image override for marketplace playground demos.
 * Reads a file into a data URL in the browser — never uploads.
 * Only the visitor sees the override; resetting the example restores the sample.
 *
 * Uses a native <label for="file"> control (not programmatic .click() on a
 * hidden input) so Choose / Replace works on iOS Safari / iPad.
 */
(function (global) {
  'use strict';

  var MAX_BYTES = 2.5 * 1024 * 1024;
  var MAX_EDGE = 1600;
  var JPEG_QUALITY = 0.82;

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

  function loadImageFromFile(file) {
    return new Promise(function (resolve, reject) {
      var url = '';
      try { url = URL.createObjectURL(file); } catch (_e) {}
      if (!url) return reject(new Error('Could not read that image'));
      var img = new Image();
      img.onload = function () {
        try { URL.revokeObjectURL(url); } catch (_r) {}
        resolve(img);
      };
      img.onerror = function () {
        try { URL.revokeObjectURL(url); } catch (_r2) {}
        reject(new Error('That image format is not supported here. Try a JPG or PNG.'));
      };
      img.src = url;
    });
  }

  function canvasToDataUrl(canvas, type, quality) {
    try {
      if (type === 'image/jpeg' || type === 'image/webp') {
        return canvas.toDataURL(type, quality);
      }
      return canvas.toDataURL('image/png');
    } catch (_e) {
      return canvas.toDataURL('image/png');
    }
  }

  function resizeToDataUrl(file) {
    return loadImageFromFile(file).then(function (img) {
      var w = img.naturalWidth || img.width || 0;
      var h = img.naturalHeight || img.height || 0;
      if (!w || !h) throw new Error('Could not read that image');

      var scale = 1;
      var longEdge = Math.max(w, h);
      if (longEdge > MAX_EDGE) scale = MAX_EDGE / longEdge;

      var tw = Math.max(1, Math.round(w * scale));
      var th = Math.max(1, Math.round(h * scale));
      var canvas = document.createElement('canvas');
      canvas.width = tw;
      canvas.height = th;
      var ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not process that image');
      ctx.drawImage(img, 0, 0, tw, th);

      var srcType = String(file.type || '').toLowerCase();
      var outType = (srcType === 'image/png' || srcType === 'image/gif' || srcType === 'image/webp')
        ? srcType
        : 'image/jpeg';
      // Prefer JPEG for camera photos — much smaller data URLs for the live preview.
      if (srcType === 'image/heic' || srcType === 'image/heif' || srcType === 'image/jpeg' || srcType === 'image/jpg') {
        outType = 'image/jpeg';
      }

      var dataUrl = canvasToDataUrl(canvas, outType, JPEG_QUALITY);
      if (!dataUrl || dataUrl.length < 32) throw new Error('Could not process that image');

      // Rough byte estimate from base64 payload; recompress harder if still huge.
      var approxBytes = Math.ceil((dataUrl.length - (dataUrl.indexOf(',') + 1)) * 0.75);
      if (approxBytes > MAX_BYTES && outType !== 'image/jpeg') {
        dataUrl = canvasToDataUrl(canvas, 'image/jpeg', JPEG_QUALITY);
        approxBytes = Math.ceil((dataUrl.length - (dataUrl.indexOf(',') + 1)) * 0.75);
      }
      if (approxBytes > MAX_BYTES) {
        var scale2 = Math.sqrt(MAX_BYTES / approxBytes) * 0.92;
        var tw2 = Math.max(1, Math.round(tw * scale2));
        var th2 = Math.max(1, Math.round(th * scale2));
        canvas.width = tw2;
        canvas.height = th2;
        ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, tw2, th2);
        dataUrl = canvasToDataUrl(canvas, 'image/jpeg', 0.72);
        approxBytes = Math.ceil((dataUrl.length - (dataUrl.indexOf(',') + 1)) * 0.75);
      }
      if (approxBytes > MAX_BYTES) {
        throw new Error('Image too large even after shrinking (max about 2.5 MB)');
      }
      return dataUrl;
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error('No file selected'));
      var type = String(file.type || '');
      if (type && !/^image\//i.test(type)) {
        return reject(new Error('Please choose an image file'));
      }
      // Always go through canvas when possible so large iPad photos and HEIC
      // (when the browser can decode them) become a usable preview data URL.
      if (typeof document !== 'undefined' && document.createElement) {
        return resizeToDataUrl(file).then(resolve, function (err) {
          // Fall back to raw FileReader for tiny / odd files if canvas path fails.
          if (file.size > MAX_BYTES) return reject(err || new Error('Image too large (max about 2.5 MB)'));
          var r = new FileReader();
          r.onload = function () { resolve(String(r.result || '')); };
          r.onerror = function () { reject(new Error('Could not read that image')); };
          r.readAsDataURL(file);
        });
      }
      if (file.size > MAX_BYTES) return reject(new Error('Image too large (max about 2.5 MB)'));
      var r2 = new FileReader();
      r2.onload = function () { resolve(String(r2.result || '')); };
      r2.onerror = function () { reject(new Error('Could not read that image')); };
      r2.readAsDataURL(file);
    });
  }

  /**
   * Markup only — call hydrate() / applyValues() after insert so long URLs
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
      + '<label class="lp-locimg-prev' + (v ? '' : ' empty') + '" for="' + esc(id) + '" title="Choose image">'
      + (v ? '<img alt="">' : '<span>No image</span>')
      + '</label>'
      + '<div class="lp-locimg-actions">'
      + '<label class="btn ghost sm lp-locimg-choose" for="' + esc(id) + '">' + esc(btnLabel) + '</label>'
      // Visually hidden (not [hidden]/display:none) — required for iOS Safari label activation.
      + '<input type="file" id="' + esc(id) + '" class="lp-locimg-file" accept="image/*" tabindex="-1">'
      + '<button type="button" class="btn ghost sm lp-locimg-restore"' + (sample && sample !== v ? '' : ' hidden') + '>Restore sample</button>'
      + '<p class="lp-locimg-hint">On your screen only — nothing is uploaded.</p>'
      + '<p class="lp-locimg-err" hidden></p>'
      + '</div></div>'
      + '<input type="hidden" class="lp-locimg-input" value="" ' + extra + '>'
      + '<input type="hidden" class="lp-locimg-sample" value="">'
      + '</div>';
  }

  function showError(ctl, msg) {
    if (!ctl) return;
    var err = ctl.querySelector('.lp-locimg-err');
    if (!err) return;
    if (msg) {
      err.textContent = msg;
      err.hidden = false;
    } else {
      err.textContent = '';
      err.hidden = true;
    }
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
    showError(ctl, '');
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

  function setFromFile(ctl, file) {
    var hidden = ctl && ctl.querySelector('.lp-locimg-input');
    if (!ctl || !hidden || !file) return Promise.resolve();
    showError(ctl, '');
    return readFileAsDataUrl(file).then(function (dataUrl) {
      hidden.value = dataUrl;
      refreshPreview(ctl);
      hidden.dispatchEvent(new Event('input', { bubbles: true }));
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
    }).catch(function (err) {
      var msg = (err && err.message) || 'Could not use that image';
      if (global.console && console.warn) console.warn('[LPLocalImage]', msg);
      showError(ctl, msg);
      hidden.dispatchEvent(new CustomEvent('lp-locimg-error', { bubbles: true, detail: { message: msg } }));
    });
  }

  var __bound = false;

  function bindOnce() {
    if (__bound) return;
    __bound = true;

    document.addEventListener('click', function (e) {
      var restore = e.target.closest && e.target.closest('.lp-locimg-restore');
      if (!restore) return;
      e.preventDefault();
      var ctl2 = restore.closest('[data-lp-locimg]');
      var hidden = ctl2 && ctl2.querySelector('.lp-locimg-input');
      var sampleInp = ctl2 && ctl2.querySelector('.lp-locimg-sample');
      if (!hidden || !sampleInp) return;
      hidden.value = sampleInp.value || '';
      showError(ctl2, '');
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
    MAX_EDGE: MAX_EDGE,
    controlHtml: controlHtml,
    readFileAsDataUrl: readFileAsDataUrl,
    setFromFile: setFromFile,
    rememberSample: rememberSample,
    isRemote: isRemote,
    isLocalData: isLocalData,
    applyValues: applyValues,
    hydrate: hydrate,
    refresh: refresh,
    bindOnce: bindOnce
  };
})(typeof window !== 'undefined' ? window : global);
