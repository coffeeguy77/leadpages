/**
 * Shared LeadPages icon picker for marketplace demos / playground editors.
 * Same behaviour as manage.html openIconPicker — search, categories, popular.
 */
(function (global) {
  'use strict';

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function iconBtnInner(v) {
    if (v && String(v).trim()) {
      var n = String(v).trim();
      if (/^[a-z0-9-]+$/.test(n) && global.LP_ICONS && global.LP_ICONS[n]) {
        return '<svg class="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + global.LP_ICONS[n] + '</svg>';
      }
      if (global.LP_ICONS && global.LP_ICONS['circle-help']) {
        return '<svg class="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + global.LP_ICONS['circle-help'] + '</svg>';
      }
      return esc(n);
    }
    return '<span style="opacity:.35;">＋</span>';
  }

  var __iconCb = null;
  var __iconCat = '__pop__';
  var __iconModal = null;
  var __bound = false;

  function cats() {
    return (global.LP_ICON_CATS || []).map(function (p) { return p[0]; });
  }

  function ensureModal() {
    if (__iconModal) return __iconModal;
    var ov = document.createElement('div');
    ov.id = 'icon-modal';
    ov.className = 'icon-ov';
    ov.style.display = 'none';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Choose an icon');
    ov.innerHTML = '<div class="icon-box">'
      + '<div class="icon-top">'
      + '<input type="text" id="icon-search" placeholder="Search — e.g. builder, cafe, plumber, quote, house…" autocomplete="off">'
      + '<button type="button" class="btn ghost" id="icon-remove">Remove icon</button>'
      + '<button type="button" class="btn ghost" id="icon-close">Close</button>'
      + '</div>'
      + '<div class="icon-cats" id="icon-cats"></div>'
      + '<div class="icon-grid" id="icon-grid"></div>'
      + '</div>';
    document.body.appendChild(ov);
    __iconModal = ov;

    ov.addEventListener('click', function (e) {
      if (e.target === ov) hide();
    });
    ov.querySelector('#icon-close').addEventListener('click', hide);
    ov.querySelector('#icon-remove').addEventListener('click', function () {
      if (__iconCb) __iconCb('');
      hide();
    });
    ov.querySelector('#icon-search').addEventListener('input', renderGrid);

    var cc = ov.querySelector('#icon-cats');
    cc.innerHTML = '<button type="button" class="icchip on" data-cat="__pop__">★ Popular</button>'
      + '<button type="button" class="icchip" data-cat="">All</button>'
      + cats().map(function (x) {
        return '<button type="button" class="icchip" data-cat="' + esc(x) + '">' + esc(x) + '</button>';
      }).join('');
    cc.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]');
      if (!b) return;
      __iconCat = b.getAttribute('data-cat');
      cc.querySelectorAll('[data-cat]').forEach(function (x) {
        x.classList.toggle('on', x === b);
      });
      renderGrid();
    });

    ov.querySelector('#icon-grid').addEventListener('click', function (e) {
      var b = e.target.closest('[data-ch]');
      if (!b) return;
      if (__iconCb) __iconCb(b.getAttribute('data-ch'));
      hide();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && __iconModal && __iconModal.style.display !== 'none') hide();
    });

    return ov;
  }

  function renderGrid() {
    var ov = __iconModal;
    if (!ov) return;
    var q = (ov.querySelector('#icon-search').value || '').trim().toLowerCase();
    var cat = __iconCat;
    var keys;
    if (global.LP_searchIcons) {
      if (!q && cat === '__pop__') {
        keys = global.LP_popularIcons ? global.LP_popularIcons() : [];
      } else {
        keys = global.LP_searchIcons(q, (cat && cat !== '__pop__') ? cat : '');
      }
    } else {
      keys = Object.keys(global.LP_ICONS || {});
      if (q) {
        keys = keys.filter(function (k) {
          return k.replace(/-/g, ' ').indexOf(q) >= 0;
        });
      }
    }
    function lbl(k) {
      return String(k).replace(/-/g, ' ').replace(/(^|\s)\S/g, function (m) {
        return m.toUpperCase();
      });
    }
    var g = ov.querySelector('#icon-grid');
    var CAP = 600;
    var shown = keys.slice(0, CAP);
    var more = keys.length - shown.length;
    g.innerHTML = keys.length
      ? (shown.map(function (k) {
        return '<button type="button" class="icbtn" data-ch="' + esc(k) + '" title="' + esc(lbl(k)) + '">' + iconBtnInner(k) + '</button>';
      }).join('') + (more > 0
        ? '<div style="grid-column:1/-1;padding:14px;text-align:center;color:#8a93a0;font-size:13px;">+' + more + ' more — search or pick a category to narrow.</div>'
        : ''))
      : '<div style="grid-column:1/-1;padding:26px;text-align:center;color:#8a93a0;">No icons match “' + esc(q) + '”.</div>';
  }

  function hide() {
    if (__iconModal) {
      __iconModal.style.display = 'none';
      __iconCb = null;
    }
  }

  function open(cb) {
    ensureModal();
    __iconCb = cb;
    __iconCat = '__pop__';
    __iconModal.style.display = 'flex';
    var s = __iconModal.querySelector('#icon-search');
    s.value = '';
    var cc = __iconModal.querySelector('#icon-cats');
    if (cc) {
      cc.querySelectorAll('[data-cat]').forEach(function (x) {
        x.classList.toggle('on', x.getAttribute('data-cat') === '__pop__');
      });
    }
    renderGrid();
    setTimeout(function () {
      try { s.focus(); } catch (_e) {}
    }, 30);
  }

  function controlHtml(value, opts) {
    opts = opts || {};
    var id = opts.id || '';
    var name = opts.name || '';
    var hidden = opts.hiddenInput !== false;
    var inputType = hidden ? 'hidden' : 'text';
    var extra = opts.inputAttrs || '';
    return '<div class="iconctl">'
      + '<button type="button" class="icon-pick" tabindex="0" title="Choose an icon">' + iconBtnInner(value || '') + '</button>'
      + '<input type="' + inputType + '" class="icon-input" '
      + (id ? 'id="' + esc(id) + '" ' : '')
      + (name ? 'name="' + esc(name) + '" ' : '')
      + 'value="' + esc(value || '') + '" ' + extra + '>'
      + '</div>';
  }

  function bindOnce() {
    if (__bound) return;
    __bound = true;
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.icon-pick');
      if (!b) return;
      e.preventDefault();
      var ctl = b.closest('.iconctl');
      var inp = ctl && ctl.querySelector('.icon-input');
      if (!inp) return;
      open(function (ch) {
        inp.value = ch;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        b.innerHTML = iconBtnInner(ch);
      });
    });
    document.addEventListener('input', function (e) {
      var el = e.target;
      if (el && el.classList && el.classList.contains('icon-input')) {
        var ctl = el.closest('.iconctl');
        var b = ctl && ctl.querySelector('.icon-pick');
        if (b) b.innerHTML = iconBtnInner(el.value);
      }
    });
  }

  function refresh(scope) {
    (scope || document).querySelectorAll('.icon-pick').forEach(function (b) {
      var ctl = b.closest('.iconctl');
      var inp = ctl && ctl.querySelector('.icon-input');
      b.innerHTML = iconBtnInner(inp ? inp.value : '');
    });
  }

  bindOnce();

  global.LPIconPicker = {
    open: open,
    hide: hide,
    controlHtml: controlHtml,
    iconBtnInner: iconBtnInner,
    refresh: refresh,
    bindOnce: bindOnce
  };
})(typeof window !== 'undefined' ? window : global);
