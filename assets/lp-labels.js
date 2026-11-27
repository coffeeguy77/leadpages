/* LeadPages order labels: label sizes, size + printer per area, sticker layout, printing.
 *
 * Settings (order_systems.settings.labels):
 *   { default_size: 'a4-2up' | <size id>,
 *     custom_sizes: [{ id, name, w_mm, h_mm, dymo_paper }],
 *     areas: { item_stickers:{size,printer}, order_labels:{size,printer}, kitchen:{size,printer}, search_stickers:{size,printer} } }
 *   size ''      → use the default size
 *   printer ''   → print dialog (any device); a DYMO printer name → straight to that DYMO
 *                  when DYMO Connect is running on this computer, otherwise the print dialog.
 *
 * Printing:
 *   - A4 sheet sizes: stickers laid out on A4 (as before).
 *   - Label sizes: one sticker per page, page = the label (works with any label printer via the dialog).
 *   - DYMO direct: the sticker is drawn to an image and sent through DYMO Connect (assets/vendor/dymo.connect.framework.js).
 */
(function (root) {
  'use strict';

  var PRESETS = [
    { id: 'a4-2up', name: 'A4 sheet — 2 across, 92 × 48 mm stickers (current)', w_mm: 92, h_mm: 48, sheet: true },
    { id: 'a4-3up', name: 'A4 sheet — 3 across, 63.5 × 38.1 mm (21 per sheet)', w_mm: 63.5, h_mm: 38.1, sheet: true },
    { id: 'dymo-11354', name: 'DYMO 11354 — 57 × 32 mm multi-purpose', w_mm: 57, h_mm: 32, dymo_paper: '11354 Multi-Purpose' },
    { id: 'dymo-11352', name: 'DYMO 11352 — 54 × 25 mm return address', w_mm: 54, h_mm: 25, dymo_paper: '11352 Return Address Int' },
    { id: 'dymo-99010', name: 'DYMO 99010 — 89 × 28 mm standard address', w_mm: 89, h_mm: 28, dymo_paper: '99010 Standard Address' },
    { id: 'dymo-99012', name: 'DYMO 99012 — 89 × 36 mm large address', w_mm: 89, h_mm: 36, dymo_paper: '99012 Large Address' },
    { id: 'dymo-11356', name: 'DYMO 11356 — 89 × 41 mm name badge', w_mm: 89, h_mm: 41, dymo_paper: '11356 White Name Badge' },
    { id: 'dymo-99014', name: 'DYMO 99014 — 101 × 54 mm shipping', w_mm: 101, h_mm: 54, dymo_paper: '99014 Shipping' },
    { id: 'dymo-1744907', name: 'DYMO 1744907 — 102 × 152 mm (4×6") XL shipping (5XL / 4XL only)', w_mm: 102, h_mm: 152, dymo_paper: '1744907 4in x 6in' }
  ];

  var AREAS = [
    { id: 'item_stickers', name: 'Item stickers', hint: 'One sticker per item (Production Summary, Labels & Stickers).' },
    { id: 'order_labels', name: 'Order labels', hint: 'One label per order (bags / boxes).' },
    { id: 'kitchen', name: 'Kitchen stickers', hint: 'Cooked / glazed stickers from the Kitchen tab.' },
    { id: 'search_stickers', name: 'Saved-search stickers', hint: 'e.g. all the turkeys or all the hams.' }
  ];

  var DEVICE_KEY = 'lp.labels.dialog_only';

  function cfgOf(settings) {
    var c = (settings && settings.labels) || {};
    return {
      default_size: c.default_size || 'a4-2up',
      custom_sizes: Array.isArray(c.custom_sizes) ? c.custom_sizes.filter(function (s) { return s && s.id && Number(s.w_mm) > 0 && Number(s.h_mm) > 0; }) : [],
      areas: c.areas && typeof c.areas === 'object' ? c.areas : {}
    };
  }

  function allSizes(settings) {
    return PRESETS.concat(cfgOf(settings).custom_sizes.map(function (s) {
      return { id: s.id, name: s.name || (s.w_mm + ' × ' + s.h_mm + ' mm'), w_mm: Number(s.w_mm), h_mm: Number(s.h_mm), dymo_paper: s.dymo_paper || '', custom: true };
    }));
  }

  function sizeById(settings, id) {
    var list = allSizes(settings);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /** The size an area prints on: its own, else (saved-search stickers) the item-sticker size, else the default. */
  function sizeFor(settings, area) {
    var c = cfgOf(settings);
    var a = c.areas[area] || {};
    var id = a.size;
    if (!id && area === 'search_stickers') id = (c.areas.item_stickers || {}).size;
    if (!id && area === 'kitchen') id = (c.areas.item_stickers || {}).size;
    return sizeById(settings, id || c.default_size) || PRESETS[0];
  }

  function printerFor(settings, area) {
    var c = cfgOf(settings);
    var a = c.areas[area] || {};
    var p = a.printer;
    if (!p && (area === 'search_stickers' || area === 'kitchen')) p = (c.areas.item_stickers || {}).printer;
    return String(p || '');
  }

  /** Has the shop chosen anything for this area (so it should use this module rather than the old A4 print)? */
  function configured(settings, area) {
    var c = cfgOf(settings);
    var a = c.areas[area] || {};
    return !!(a.size || a.printer || (c.default_size && c.default_size !== 'a4-2up'));
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- sticker content ----------
   * sticker = { brand, title, product, lines:[], who, ref, foot, flag }
   * Small labels drop the less important lines.
   */
  function fitLines(st, size) {
    var h = Number(size.h_mm) || 48;
    var w = Number(size.w_mm) || 92;
    var lines = (st.lines || []).filter(Boolean);
    var tiny = h < 30 || w < 50;
    var small = !tiny && h < 40;
    return {
      brand: tiny ? '' : st.brand || '',
      title: st.title || '',
      product: st.product || '',
      lines: tiny ? lines.slice(0, 1) : small ? lines.slice(0, 2) : lines,
      who: st.who || '',
      ref: st.ref || '',
      foot: tiny ? '' : st.foot || '',
      flag: st.flag || ''
    };
  }

  /** Type grows with the label: about 1 at 36 mm tall, capped for very small / very tall labels. */
  function textScale(size) {
    var h = Number(size.h_mm) || 48;
    var w = Number(size.w_mm) || 92;
    var k = Math.max(0.7, Math.min(1.8, h / 36));
    if (w < 60) k = Math.min(k, 0.95);
    return k;
  }

  function stickerHtml(st, size) {
    var f = fitLines(st, size);
    var h = Number(size.h_mm) || 48;
    var k = textScale(size);
    var pt = function (n) { return (n * k).toFixed(1) + 'pt'; };
    return '<div class="lbl" style="width:' + size.w_mm + 'mm;height:' + size.h_mm + 'mm">' +
      (f.brand ? '<div class="lbl-brand" style="font-size:' + pt(6.5) + '">' + esc(f.brand) + '</div>' : '') +
      (f.title ? '<div class="lbl-title" style="font-size:' + pt(13) + '">' + esc(f.title) + (f.flag ? ' <span class="lbl-flag">' + esc(f.flag) + '</span>' : '') + '</div>' : '') +
      (f.product ? '<div class="lbl-prod" style="font-size:' + pt(9) + '">' + esc(f.product) + '</div>' : '') +
      f.lines.map(function (l) { return '<div class="lbl-line" style="font-size:' + pt(7.5) + '">' + esc(l) + '</div>'; }).join('') +
      '<div class="lbl-foot"><div><div class="lbl-who" style="font-size:' + pt(9) + '">' + esc(f.who) + '</div>' +
      (f.ref ? '<div class="lbl-ref" style="font-size:' + pt(11) + '">' + esc(f.ref) + '</div>' : '') + '</div>' +
      (f.foot ? '<div class="lbl-keep" style="font-size:' + pt(6.5) + '">' + esc(f.foot) + '</div>' : '') + '</div></div>';
  }

  var BASE_CSS = '*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif}' +
    '.np{margin:10px;padding:10px 12px;background:#f4f1eb;border:1px solid #ddd6cb;border-radius:8px;font-size:13px}.np button{padding:8px 14px;border:1px solid #1f5c3a;background:#1f5c3a;color:#fff;border-radius:8px;font:inherit;font-weight:600;cursor:pointer;margin-right:8px}' +
    '@media print{.np{display:none!important}}' +
    '.lbl{overflow:hidden;display:flex;flex-direction:column;padding:1.6mm 2.2mm;line-height:1.15}' +
    '.lbl-brand{font-weight:700;letter-spacing:.05em;text-transform:uppercase}.lbl-title{font-weight:900;letter-spacing:.03em;text-transform:uppercase}' +
    '.lbl-flag{font-size:.6em;border:1px solid #000;border-radius:2px;padding:0 2px;vertical-align:middle}' +
    '.lbl-prod{font-weight:700}.lbl-line{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.lbl-foot{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;gap:2mm}.lbl-who{font-weight:700}.lbl-ref{font-weight:900}.lbl-keep{font-weight:700;text-transform:uppercase;text-align:right}';

  function printDialog(stickers, size, title, existingWin) {
    var w = existingWin || root.open('', '_blank');
    if (!w) return { ok: false, error: 'popup_blocked' };
    var css = BASE_CSS;
    var body;
    if (size.sheet) {
      css += '@page{size:A4 portrait;margin:8mm}.sheet{display:flex;flex-wrap:wrap;gap:2mm;align-content:flex-start;padding:0}.lbl{border:1px dashed #bbb;border-radius:2mm;break-inside:avoid;page-break-inside:avoid}';
      body = '<div class="sheet">' + stickers.map(function (s) { return stickerHtml(s, size); }).join('') + '</div>';
    } else {
      // One label per page; the page is the label, so a label printer prints one sticker each.
      css += '@page{size:' + size.w_mm + 'mm ' + size.h_mm + 'mm;margin:0}.lbl{break-after:page;page-break-after:always}.lbl:last-child{break-after:auto;page-break-after:auto}' +
        '@media screen{.lbl{border:1px dashed #bbb;margin:8px;border-radius:2mm}}';
      body = stickers.map(function (s) { return stickerHtml(s, size); }).join('');
    }
    w.document.open();
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title || 'Labels') + '</title><style>' + css + '</style></head><body>' +
      '<div class="np"><button onclick="window.print()">Print</button>' + stickers.length + ' label' + (stickers.length === 1 ? '' : 's') + ' · ' + esc(size.name) +
      (size.sheet ? '' : ' · In the print dialog choose your label printer, paper size ' + size.w_mm + ' × ' + size.h_mm + ' mm, margins none, scale 100%.') + '</div>' +
      body + '</body></html>');
    w.document.close();
    setTimeout(function () { try { w.focus(); w.print(); } catch (_e) {} }, 450);
    return { ok: true, via: 'dialog' };
  }

  /* ---------- DYMO Connect (direct to a named DYMO printer) ---------- */
  var dymoState = { loading: null, ready: false, error: '' };

  function deviceDialogOnly() {
    try { return root.localStorage.getItem(DEVICE_KEY) === '1'; } catch (_e) { return false; }
  }
  function setDeviceDialogOnly(on) {
    try { if (on) root.localStorage.setItem(DEVICE_KEY, '1'); else root.localStorage.removeItem(DEVICE_KEY); } catch (_e) {}
  }

  function isMobileDevice() {
    var ua = (root.navigator && root.navigator.userAgent) || '';
    return /iPad|iPhone|Android/i.test(ua) || (/Macintosh/.test(ua) && root.navigator && root.navigator.maxTouchPoints > 1);
  }

  /** Load DYMO Connect's script and look for the service on this computer. Resolves { ok, printers:[{name, model}] }. */
  function dymoProbe() {
    if (isMobileDevice()) return Promise.resolve({ ok: false, reason: 'mobile', printers: [] });
    if (!dymoState.loading) {
      dymoState.loading = new Promise(function (resolve) {
        var done = function (r) { resolve(r); };
        var s = root.document.createElement('script');
        s.src = '/assets/vendor/dymo.connect.framework.js?v=1';
        s.async = true;
        s.onerror = function () { done({ ok: false, reason: 'script', printers: [] }); };
        s.onload = function () {
          var fw = root.dymo && root.dymo.label && root.dymo.label.framework;
          if (!fw) return done({ ok: false, reason: 'script', printers: [] });
          var timer = setTimeout(function () { done({ ok: false, reason: 'not_running', printers: [] }); }, 6000);
          try {
            fw.init(function () {
              fw.getPrintersAsync().then(function (list) {
                clearTimeout(timer);
                var out = [];
                for (var i = 0; list && i < list.length; i++) {
                  if (list[i] && list[i].name) out.push({ name: list[i].name, model: list[i].modelName || '', type: list[i].printerType || '' });
                }
                dymoState.ready = true;
                done({ ok: true, printers: out });
              }, function () { clearTimeout(timer); done({ ok: false, reason: 'not_running', printers: [] }); });
            });
          } catch (_e) { clearTimeout(timer); done({ ok: false, reason: 'not_running', printers: [] }); }
        };
        root.document.head.appendChild(s);
      });
    }
    return dymoState.loading;
  }

  /** Draw a sticker to a PNG (base64, no prefix) at 300 dpi for DYMO. */
  function stickerPng(st, size) {
    var dpi = 300;
    var W = Math.round(size.w_mm / 25.4 * dpi);
    var Hh = Math.round(size.h_mm / 25.4 * dpi);
    var c = root.document.createElement('canvas');
    c.width = W; c.height = Hh;
    var x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, Hh);
    x.fillStyle = '#000'; x.textBaseline = 'top';
    var f = fitLines(st, size);
    var k = textScale(size);
    var px = function (pt) { return Math.round(pt * k * dpi / 72); };
    var pad = Math.round(1.8 / 25.4 * dpi);
    var y = pad;
    var maxW = W - pad * 2;
    function text(t, sizePt, weight) {
      if (!t) return;
      var s = px(sizePt);
      x.font = (weight || 'normal') + ' ' + s + 'px Arial, Helvetica, sans-serif';
      var str = String(t);
      while (x.measureText(str).width > maxW && str.length > 3) str = str.slice(0, -2) + '…';
      x.fillText(str, pad, y);
      y += Math.round(s * 1.18);
    }
    text(f.brand.toUpperCase(), 6.5, 'bold');
    text((f.title + (f.flag ? ' · ' + f.flag : '')).toUpperCase(), 13, '900');
    text(f.product, 9, 'bold');
    f.lines.forEach(function (l) { text(l, 7.5); });
    // Footer pinned to the bottom.
    var whoS = px(9), refS = px(11), keepS = px(6.5);
    var by = Hh - pad - refS;
    if (f.ref) { x.font = '900 ' + refS + 'px Arial, Helvetica, sans-serif'; x.fillText(f.ref, pad, by); }
    if (f.who) { x.font = 'bold ' + whoS + 'px Arial, Helvetica, sans-serif'; x.fillText(f.who, pad, by - Math.round(whoS * 1.2)); }
    if (f.foot) {
      x.font = 'bold ' + keepS + 'px Arial, Helvetica, sans-serif';
      var tw = x.measureText(f.foot.toUpperCase()).width;
      x.fillText(f.foot.toUpperCase(), W - pad - tw, Hh - pad - keepS);
    }
    return c.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
  }

  /** DYMO label XML: one image covering the label (twips: 1440 per inch). */
  function dymoLabelXml(size, pngBase64) {
    var tw = function (mm) { return Math.round(mm / 25.4 * 1440); };
    var longMm = Math.max(size.w_mm, size.h_mm);
    var shortMm = Math.min(size.w_mm, size.h_mm);
    var landscape = size.w_mm >= size.h_mm;
    var m = 60;
    return '<?xml version="1.0" encoding="utf-8"?>' +
      '<DieCutLabel Version="8.0" Units="twips">' +
      '<PaperOrientation>' + (landscape ? 'Landscape' : 'Portrait') + '</PaperOrientation>' +
      '<Id>LeadPages</Id>' +
      '<PaperName>' + esc(size.dymo_paper || '') + '</PaperName>' +
      '<DrawCommands><RoundRectangle X="0" Y="0" Width="' + tw(shortMm) + '" Height="' + tw(longMm) + '" Rx="180" Ry="180" /></DrawCommands>' +
      '<ObjectInfo><ImageObject><Name>IMG</Name>' +
      '<ForeColor Alpha="255" Red="0" Green="0" Blue="0" /><BackColor Alpha="0" Red="255" Green="255" Blue="255" />' +
      '<LinkedObjectName></LinkedObjectName><Rotation>Rotation0</Rotation><IsMirrored>False</IsMirrored><IsVariable>False</IsVariable>' +
      '<Image>' + pngBase64 + '</Image><ScaleMode>Uniform</ScaleMode><BorderWidth>0</BorderWidth>' +
      '<BorderColor Alpha="255" Red="0" Green="0" Blue="0" /><HorizontalAlignment>Center</HorizontalAlignment><VerticalAlignment>Center</VerticalAlignment>' +
      '</ImageObject><Bounds X="' + m + '" Y="' + m + '" Width="' + (tw(size.w_mm) - 2 * m) + '" Height="' + (tw(size.h_mm) - 2 * m) + '" /></ObjectInfo>' +
      '</DieCutLabel>';
  }

  function printDymo(stickers, size, printerName) {
    var fw = root.dymo.label.framework;
    var chain = Promise.resolve();
    var sent = 0;
    stickers.forEach(function (st) {
      chain = chain.then(function () {
        var xml = dymoLabelXml(size, stickerPng(st, size));
        return Promise.resolve(fw.printLabelAsync(printerName, '', xml, '')).then(function () { sent++; });
      });
    });
    return chain.then(function () { return { ok: true, via: 'dymo', sent: sent, printer: printerName }; });
  }

  /**
   * Print stickers for an area.
   * @param {object} settings order system settings
   * @param {string} area item_stickers | order_labels | kitchen | search_stickers
   * @param {object[]} stickers see stickerHtml()
   * @param {{title?:string, forceDialog?:boolean}} [opts]
   * @returns {Promise<{ok, via, sent?, printer?, error?, fallback_reason?}>}
   */
  function print(settings, area, stickers, opts) {
    opts = opts || {};
    var size = sizeFor(settings, area);
    var printer = printerFor(settings, area);
    if (!stickers || !stickers.length) {
      try { if (opts.win) opts.win.close(); } catch (_e) {}
      return Promise.resolve({ ok: false, error: 'nothing' });
    }
    var holder = opts.win || null;
    var dialog = function (reason) {
      var r = printDialog(stickers, size, opts.title, holder);
      if (reason) r.fallback_reason = reason;
      return r;
    };
    if (opts.forceDialog || size.sheet || !printer || deviceDialogOnly() || isMobileDevice()) return Promise.resolve(dialog(''));
    // Browsers only allow a new window during the click, so open it now; it's closed again if DYMO prints.
    if (!holder) holder = root.open('', '_blank');
    try { if (holder) holder.document.write('<p style="font:14px Arial;padding:16px">Sending to ' + esc(printer) + '…</p>'); } catch (_e) {}
    var closeHolder = function () { try { if (holder) holder.close(); } catch (_e) {} };
    return dymoProbe().then(function (p) {
      if (!p.ok) return dialog('dymo_not_found');
      var found = p.printers.some(function (x) { return x.name === printer; });
      if (!found) return dialog('printer_not_found');
      return printDymo(stickers, size, printer).then(function (r) { closeHolder(); return r; }).catch(function (e) {
        var r = dialog('dymo_failed');
        r.error = (e && e.message) || 'dymo_failed';
        return r;
      });
    });
  }

  var api = {
    PRESETS: PRESETS,
    AREAS: AREAS,
    cfgOf: cfgOf,
    allSizes: allSizes,
    sizeById: sizeById,
    sizeFor: sizeFor,
    printerFor: printerFor,
    configured: configured,
    fitLines: fitLines,
    stickerHtml: stickerHtml,
    dymoLabelXml: dymoLabelXml,
    dymoProbe: dymoProbe,
    print: print,
    printDialog: printDialog,
    deviceDialogOnly: deviceDialogOnly,
    setDeviceDialogOnly: setDeviceDialogOnly
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.LpLabels = api;
})(typeof window !== 'undefined' ? window : globalThis);
