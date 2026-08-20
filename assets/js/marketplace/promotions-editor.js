/**
 * Promotions Engine marketplace playground editor.
 * Mirrors manage.html promotions controls (type / placement / style / type fields).
 * marketplace-playground: temporary state only — never saves.
 */
(function (global) {
  'use strict';

  var TYPES = [
    ['weekly', 'Weekly booking window'],
    ['deadline', 'Deadline offer'],
    ['spots', 'Limited spots'],
    ['seasonal', 'Seasonal promotion'],
    ['suburb', 'Suburb promotion'],
    ['finance', 'Finance promotion'],
    ['firstTime', 'First-time customer'],
    ['priority', 'Emergency priority'],
    ['socialProof', 'Social proof'],
    ['mystery', 'Mystery offer']
  ];

  var PLACEMENTS = [
    ['belowHero', 'Below hero'],
    ['inline', 'Inline section'],
    ['floatingBar', 'Floating bar (top)'],
    ['stickyStrip', 'Sticky strip (bottom)'],
    ['popup', 'Popup']
  ];

  var STYLES = [
    ['banner', 'Banner'],
    ['card', 'Card']
  ];

  var CTA_ACTIONS = [
    ['quote', 'Quote form'],
    ['call', 'Call'],
    ['scroll', 'Scroll to form'],
    ['url', 'External URL (new tab)'],
    ['none', 'No button']
  ];

  var DAYS = [
    ['1', 'Monday'], ['2', 'Tuesday'], ['3', 'Wednesday'], ['4', 'Thursday'],
    ['5', 'Friday'], ['6', 'Saturday'], ['0', 'Sunday']
  ];

  var DEFAULT_ITEM = {
    id: 'p-new',
    on: true,
    type: 'weekly',
    placement: 'belowHero',
    style: 'banner',
    title: 'Booking for next week',
    description: 'Secure your spot in next week’s schedule — book before the cut-off.',
    weeklyDay: 4,
    weeklyCutoff: '16:00',
    cta: { text: 'Book now', action: 'quote' }
  };

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function sel(id, label, opts, cur) {
    return '<div class="f"><label for="' + id + '">' + esc(label) + '</label><select id="' + id + '" class="tin">'
      + opts.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (String(cur) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('')
      + '</select></div>';
  }

  function hexOk(v) {
    v = String(v || '').trim();
    return /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(v)
      ? (v.charAt(0) === '#' ? v : '#' + v)
      : '';
  }

  function colorRow(id, label, value, placeholder) {
    var v = value || '';
    var pick = hexOk(v) || '#cccccc';
    if (pick.length === 4) {
      pick = '#' + pick[1] + pick[1] + pick[2] + pick[2] + pick[3] + pick[3];
    }
    return '<div class="f tb-ed-f tb-ed-color-f"><label for="' + id + 't">' + esc(label) + '</label>'
      + '<div class="tb-ed-color">'
      + '<input type="color" id="' + id + '" value="' + esc(pick) + '" aria-label="' + esc(label) + ' colour">'
      + '<input type="text" id="' + id + 't" class="tin tb-ed-hex" maxlength="7" placeholder="' + esc(placeholder || '#…') + '" value="' + esc(v) + '">'
      + '<button type="button" class="btn ghost sm tb-ed-clr" data-pr-clr="' + id + '" title="Default">↺</button>'
      + '</div></div>';
  }

  var APPEARANCE_TRANSITIONS = [
    ['none', 'None (flat edge)'],
    ['fade', 'Fade blend'],
    ['wave', 'Wave'],
    ['angle', 'Diagonal'],
    ['curve', 'Soft curve']
  ];

  function ens(cfg) {
    if (!cfg.sections) cfg.sections = {};
    if (!cfg.sections.promotions || typeof cfg.sections.promotions !== 'object') {
      cfg.sections.promotions = { on: true, items: [Object.assign({}, DEFAULT_ITEM, { cta: Object.assign({}, DEFAULT_ITEM.cta) })] };
    }
    var PR = cfg.sections.promotions;
    PR.on = true;
    if (!Array.isArray(PR.items) || !PR.items.length) {
      PR.items = [Object.assign({}, DEFAULT_ITEM, { cta: Object.assign({}, DEFAULT_ITEM.cta), id: 'p' + Date.now() })];
    }
    if (!PR.appearance || typeof PR.appearance !== 'object') PR.appearance = {};
    return PR;
  }

  function tabLabel(it, i) {
    var raw = String((it && (it.title || it.type)) || '').replace(/\s+/g, ' ').trim();
    if (!raw) return String(i + 1);
    return raw.length > 18 ? raw.slice(0, 18) + '…' : raw;
  }

  function typeFieldsHtml(p) {
    var t = p.type || 'weekly';
    if (t === 'deadline') {
      return '<div class="f"><label for="pr-expiry">Deadline (date &amp; time)</label>'
        + '<input type="datetime-local" id="pr-expiry" class="tin" value="' + esc(p.expiry || '') + '"></div>';
    }
    if (t === 'weekly') {
      return sel('pr-day', 'Book before — day', DAYS, String(p.weeklyDay != null ? p.weeklyDay : 4))
        + '<div class="f"><label for="pr-cut">Cut-off time</label>'
        + '<input type="time" id="pr-cut" class="tin" value="' + esc(p.weeklyCutoff || '16:00') + '"></div>';
    }
    if (t === 'spots') {
      return '<div class="f"><label for="pr-spotsTotal">Total spots</label>'
        + '<input type="number" id="pr-spotsTotal" class="tin" value="' + esc(p.spotsTotal != null ? p.spotsTotal : '') + '"></div>'
        + '<div class="f"><label for="pr-spotsRemaining">Spots remaining</label>'
        + '<input type="number" id="pr-spotsRemaining" class="tin" value="' + esc(p.spotsRemaining != null ? p.spotsRemaining : '') + '"></div>';
    }
    if (t === 'seasonal') {
      return '<div class="f"><label for="pr-startDate">Start date</label>'
        + '<input type="date" id="pr-startDate" class="tin" value="' + esc(p.startDate || '') + '"></div>'
        + '<div class="f"><label for="pr-endDate">End date</label>'
        + '<input type="date" id="pr-endDate" class="tin" value="' + esc(p.endDate || '') + '"></div>';
    }
    if (t === 'suburb') {
      return '<div class="f"><label for="pr-suburbs">Suburbs (comma separated)</label>'
        + '<textarea id="pr-suburbs" class="tin" rows="2">' + esc(p.suburbs || '') + '</textarea></div>';
    }
    if (t === 'finance') {
      return '<div class="f"><label for="pr-amount">Amount (e.g. $28)</label>'
        + '<input type="text" id="pr-amount" class="tin" value="' + esc(p.amount || '') + '"></div>'
        + '<div class="f"><label for="pr-disclaimer">Disclaimer</label>'
        + '<input type="text" id="pr-disclaimer" class="tin" value="' + esc(p.disclaimer || '') + '"></div>';
    }
    if (t === 'firstTime') {
      return '<div class="f"><label for="pr-discountText">Discount text</label>'
        + '<input type="text" id="pr-discountText" class="tin" value="' + esc(p.discountText || '') + '" placeholder="10% off first job"></div>';
    }
    if (t === 'socialProof') {
      return '<div class="f"><label for="pr-number">Number (e.g. 17)</label>'
        + '<input type="text" id="pr-number" class="tin" value="' + esc(p.number != null ? p.number : '') + '"></div>';
    }
    if (t === 'mystery') {
      return '<div class="f"><label for="pr-revealText">Hidden offer (revealed on click)</label>'
        + '<textarea id="pr-revealText" class="tin" rows="2">' + esc(p.revealText || '') + '</textarea></div>';
    }
    return '<p class="hint" style="margin:0;grid-column:1/-1">No extra fields — uses the title, description and button below.</p>';
  }

  function mount(host, options) {
    options = options || {};
    var mode = options.mode || 'marketplace-playground';
    var cfg = options.value || { sections: { promotions: { on: true, items: [] } } };
    var onChange = typeof options.onChange === 'function' ? options.onChange : function () {};
    var announce = typeof options.onAnnounce === 'function' ? options.onAnnounce : function () {};
    var activeIdx = 0;

    function emit(msg) {
      onChange(cfg);
      if (msg) announce(msg);
    }

    function items() { return ens(cfg).items; }

    function clampActive() {
      var n = items().length;
      if (!n) activeIdx = 0;
      else if (activeIdx < 0) activeIdx = 0;
      else if (activeIdx >= n) activeIdx = n - 1;
    }

    function active() {
      clampActive();
      return items()[activeIdx];
    }

    function render() {
      var p = active() || Object.assign({}, DEFAULT_ITEM, { cta: Object.assign({}, DEFAULT_ITEM.cta) });
      if (!p.cta) p.cta = { text: 'Book now', action: 'quote' };
      var A = ens(cfg).appearance || {};
      var custom = A.custom === true;
      var sw = A.strokeWidth != null ? A.strokeWidth : 2;
      var stack = mode === 'marketplace-playground';

      var html = '';
      if (mode === 'marketplace-playground') {
        html += '<div class="tb-ed-banner tb-ed-banner-safe">Have a play. Nothing here will be saved. Use the type chips above to jump between offer demos.</div>';
      } else {
        html += '<div class="tb-ed-banner">Demo builder — changes can be saved to the selected preset.</div>';
      }

      html += '<div class="tb-ed-zones' + (stack ? ' tb-ed-zones-single' : '') + '">'
        + '<div class="card tb-ed-card tb-ed-card-items tb-ed-zone-items">'
        + '<div class="tb-ed-items-head">'
        + '<h2>Promotions</h2>'
        + '<button type="button" class="tb-ed-add" id="pr-add">+ Add</button>'
        + '</div>'
        + '<div id="pr-items"></div></div>'

        + '<div class="card tb-ed-card tb-ed-card-tight tb-ed-zone-style" aria-label="Offer settings">'
        + '<div class="tb-ed-zone-label">Offer type &amp; settings</div>'
        + '<div class="tb-ed-color-grid" id="pr-fields">'
        + sel('pr-type', 'Type', TYPES, p.type || 'weekly')
        + sel('pr-place', 'Placement', PLACEMENTS, p.placement || 'belowHero')
        + sel('pr-style', 'Style', STYLES, p.style || 'banner')
        + '<div class="f" style="grid-column:1/-1"><label for="pr-title">Title</label>'
        + '<input type="text" id="pr-title" class="tin" value="' + esc(p.title || '') + '"></div>'
        + '<div class="f" style="grid-column:1/-1"><label for="pr-desc">Description</label>'
        + '<textarea id="pr-desc" class="tin" rows="2">' + esc(p.description || '') + '</textarea></div>'
        + typeFieldsHtml(p)
        + '<div class="f"><label for="pr-ctatext">Button text</label>'
        + '<input type="text" id="pr-ctatext" class="tin" value="' + esc((p.cta && p.cta.text) || '') + '"></div>'
        + sel('pr-ctaaction', 'Button action', CTA_ACTIONS, (p.cta && p.cta.action) || 'quote')
        + (((p.cta && p.cta.action) === 'url')
          ? ('<div class="f" style="grid-column:1/-1"><label for="pr-ctaurl">Button URL (opens in new tab)</label>'
            + '<input type="url" id="pr-ctaurl" class="tin" placeholder="https://booking.example.com/…" value="'
            + esc((p.cta && p.cta.url) || '') + '"></div>')
          : '')
        + '</div>'
        + '<div class="tb-ed-app-box' + (custom ? ' on' : '') + '" data-mp-app-box>'
        + '<div class="tb-ed-app-head">'
        + '<div class="f tb-ed-check-f"><label class="ck"><input type="checkbox" id="pr-app-custom"'
        + (custom ? ' checked' : '') + '> Enable custom style</label></div>'
        + '<p class="tb-ed-app-hint">Background, text colours, stroke and transitions only apply when custom style is enabled.</p>'
        + '</div>'
        + '<div class="tb-ed-app-fields"' + (custom ? '' : ' hidden') + ' id="pr-app-fields">'
        + colorRow('pr-app-bg', 'Full-width background', A.containerBg || '', 'Theme default')
        + colorRow('pr-app-stroke', 'Stroke colour', A.strokeColor || '', 'None')
        + colorRow('pr-app-eyebrow', 'Eyebrow colour', A.eyebrowColor || '', '')
        + colorRow('pr-app-title', 'Title colour', A.titleColor || '', '')
        + colorRow('pr-app-intro', 'Intro text colour', A.introColor || '', '')
        + '<div class="f"><label for="pr-app-sw">Stroke width <span id="pr-app-sw-v">' + esc(sw) + 'px</span></label>'
        + '<input type="range" id="pr-app-sw" min="0" max="8" step="1" value="' + esc(sw) + '"></div>'
        + '<div class="f"><label for="pr-app-sides">Stroke sides</label><select id="pr-app-sides" class="tin">'
        + [['both', 'Top & bottom'], ['top', 'Top only'], ['bottom', 'Bottom only'], ['all', 'All sides']].map(function (o) {
          return '<option value="' + o[0] + '"' + ((A.strokeSides || 'both') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('')
        + '</select></div>'
        + '<div class="f"><label for="pr-app-ttop">Transition into section (top)</label><select id="pr-app-ttop" class="tin">'
        + APPEARANCE_TRANSITIONS.map(function (o) {
          return '<option value="' + o[0] + '"' + ((A.transitionTop || 'none') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('')
        + '</select></div>'
        + '<div class="f"><label for="pr-app-tbot">Transition out (bottom)</label><select id="pr-app-tbot" class="tin">'
        + APPEARANCE_TRANSITIONS.map(function (o) {
          return '<option value="' + o[0] + '"' + ((A.transitionBottom || 'none') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('')
        + '</select></div>'
        + '</div></div>'
        + '</div></div>';

      host.innerHTML = html;
      host.className = host.className
        .split(/\s+/)
        .filter(function (c) {
          return c && c !== 'tb-ed-root' && c !== 'tb-ed-compact' && c !== 'tb-ed-stack' && c !== 'tb-ed-split';
        })
        .join(' ');
      host.classList.add('tb-ed-root', 'tb-ed-compact');
      if (stack) host.classList.add('tb-ed-stack');
      else host.classList.add('tb-ed-split');
      drawItems();
    }

    function drawItems() {
      var box = host.querySelector('#pr-items');
      if (!box) return;
      var list = items();
      clampActive();
      if (!list.length) {
        box.innerHTML = '<p class="tb-ed-empty">No promotions yet — add one or pick a type demo above.</p>';
        return;
      }
      var tabs = list.map(function (it, i) {
        var off = it.on === false ? ' off' : '';
        return '<button type="button" class="tb-ed-tab' + (i === activeIdx ? ' on' : '') + off + '" data-tab="' + i + '" title="' + esc(tabLabel(it, i)) + '">'
          + '<span class="tb-ed-tab-n">' + (i + 1) + '</span>'
          + '<span class="tb-ed-tab-l">' + esc(tabLabel(it, i)) + '</span></button>';
      }).join('');
      var it = list[activeIdx] || {};
      box.innerHTML = '<div class="tb-ed-tabs" role="tablist" aria-label="Promotions">' + tabs + '</div>'
        + '<div class="tb-ed-item tb-ed-item-panel">'
        + '<div class="tb-ed-item-head">'
        + '<label class="ck"><input type="checkbox" id="pr-on"' + (it.on !== false ? ' checked' : '') + '> Visible</label>'
        + '<span class="tb-ed-item-actions">'
        + '<button type="button" data-act="up" aria-label="Move left">←</button>'
        + '<button type="button" data-act="dn" aria-label="Move right">→</button>'
        + '<button type="button" data-act="rm" class="danger" aria-label="Remove">Remove</button>'
        + '</span></div>'
        + '<p class="hint" style="margin:0">Edit type, placement and copy in Offer type &amp; settings.</p>'
        + '</div>';
    }

    function wireOnce() {
      if (host.__prEdBound) return;
      host.__prEdBound = true;

      host.addEventListener('click', function (e) {
        var clr = e.target.closest('[data-pr-clr]');
        if (clr) {
          var id = clr.getAttribute('data-pr-clr');
          applyAppColor(id, '');
          var cp = host.querySelector('#' + id);
          var tx = host.querySelector('#' + id + 't');
          if (tx) tx.value = '';
          if (cp) cp.value = '#cccccc';
          return;
        }
        var tab = e.target.closest('[data-tab]');
        if (tab) {
          activeIdx = parseInt(tab.getAttribute('data-tab'), 10) || 0;
          render();
          return;
        }
        if (e.target.closest('#pr-add')) {
          items().push(Object.assign({}, DEFAULT_ITEM, {
            id: 'p' + Date.now(),
            cta: Object.assign({}, DEFAULT_ITEM.cta)
          }));
          activeIdx = items().length - 1;
          emit();
          render();
          return;
        }
        var actBtn = e.target.closest('[data-act]');
        if (actBtn) {
          var act = actBtn.getAttribute('data-act');
          var list = items();
          var i = activeIdx;
          if (act === 'rm' && list.length) {
            list.splice(i, 1);
            if (activeIdx >= list.length) activeIdx = Math.max(0, list.length - 1);
          } else if (act === 'up' && i > 0) {
            list.splice(i - 1, 0, list.splice(i, 1)[0]);
            activeIdx = i - 1;
          } else if (act === 'dn' && i < list.length - 1) {
            list.splice(i + 1, 0, list.splice(i, 1)[0]);
            activeIdx = i + 1;
          }
          emit();
          render();
        }
      });

      function ensureApp() {
        var PR = ens(cfg);
        if (!PR.appearance) PR.appearance = {};
        return PR.appearance;
      }
      function applyAppColor(id, v) {
        var h = hexOk(v);
        var A = ensureApp();
        if (id === 'pr-app-bg') A.containerBg = h;
        if (id === 'pr-app-stroke') A.strokeColor = h;
        if (id === 'pr-app-eyebrow') A.eyebrowColor = h;
        if (id === 'pr-app-title') A.titleColor = h;
        if (id === 'pr-app-intro') A.introColor = h;
        var cp = host.querySelector('#' + id);
        var tx = host.querySelector('#' + id + 't');
        if (tx) tx.value = h || v || '';
        if (cp && h) {
          cp.value = h.length === 4
            ? '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]
            : h;
        }
        emit();
      }

      host.addEventListener('change', function (e) {
        var t = e.target;
        var p = active();
        if (!t) return;
        if (t.id === 'pr-app-custom') {
          ensureApp().custom = !!t.checked;
          var box = host.querySelector('[data-mp-app-box]');
          var fields = host.querySelector('#pr-app-fields');
          if (box) box.classList.toggle('on', !!t.checked);
          if (fields) {
            if (t.checked) fields.removeAttribute('hidden');
            else fields.setAttribute('hidden', '');
          }
          emit();
          return;
        }
        if (t.id === 'pr-app-sides') { ensureApp().strokeSides = t.value; emit(); return; }
        if (t.id === 'pr-app-ttop') { ensureApp().transitionTop = t.value; emit(); return; }
        if (t.id === 'pr-app-tbot') { ensureApp().transitionBottom = t.value; emit(); return; }
        if (!p) return;
        if (t.id === 'pr-on') { p.on = !!t.checked; emit(); drawItems(); return; }
        if (t.id === 'pr-type') { p.type = t.value; emit(); render(); return; }
        if (t.id === 'pr-place') { p.placement = t.value; emit(); return; }
        if (t.id === 'pr-style') { p.style = t.value; emit(); return; }
        if (t.id === 'pr-ctaaction') { if (!p.cta) p.cta = {}; p.cta.action = t.value; emit(); render(); return; }
        if (t.id === 'pr-day') { p.weeklyDay = parseInt(t.value, 10); emit(); return; }
        if (t.id === 'pr-expiry' || t.id === 'pr-startDate' || t.id === 'pr-endDate') {
          var k = t.id.replace('pr-', '');
          if (t.value === '') delete p[k]; else p[k] = t.value;
          emit();
        }
      });

      host.addEventListener('input', function (e) {
        var t = e.target;
        var p = active();
        if (!t) return;
        if (t.id === 'pr-app-bg' || t.id === 'pr-app-bgt') { applyAppColor('pr-app-bg', t.value); return; }
        if (t.id === 'pr-app-stroke' || t.id === 'pr-app-stroket') { applyAppColor('pr-app-stroke', t.value); return; }
        if (t.id === 'pr-app-eyebrow' || t.id === 'pr-app-eyebrowt') { applyAppColor('pr-app-eyebrow', t.value); return; }
        if (t.id === 'pr-app-title' || t.id === 'pr-app-titlet') { applyAppColor('pr-app-title', t.value); return; }
        if (t.id === 'pr-app-intro' || t.id === 'pr-app-introt') { applyAppColor('pr-app-intro', t.value); return; }
        if (t.id === 'pr-app-sw') {
          ensureApp().strokeWidth = +t.value;
          var swv = host.querySelector('#pr-app-sw-v');
          if (swv) swv.textContent = t.value + 'px';
          emit();
          return;
        }
        if (!p) return;
        if (t.id === 'pr-title') { p.title = t.value; emit(); return; }
        if (t.id === 'pr-desc') { p.description = t.value; emit(); return; }
        if (t.id === 'pr-ctatext') { if (!p.cta) p.cta = {}; p.cta.text = t.value; emit(); return; }
        if (t.id === 'pr-ctaurl') { if (!p.cta) p.cta = {}; p.cta.url = t.value; emit(); return; }
        if (t.id === 'pr-cut') { p.weeklyCutoff = t.value; emit(); return; }
        if (t.id === 'pr-spotsTotal' || t.id === 'pr-spotsRemaining') {
          var n = parseInt(t.value, 10);
          p[t.id === 'pr-spotsTotal' ? 'spotsTotal' : 'spotsRemaining'] = isNaN(n) ? null : n;
          emit();
          return;
        }
        ['amount', 'disclaimer', 'discountText', 'suburbs', 'revealText', 'number'].forEach(function (k) {
          if (t.id === 'pr-' + k) {
            if (t.value === '') delete p[k];
            else p[k] = t.value;
            emit();
          }
        });
      });
    }

    render();
    wireOnce();
    return {
      update: function (next) {
        cfg = next || cfg;
        render();
      },
      getValue: function () { return cfg; }
    };
  }

  global.LPPromotionsEditor = { mount: mount, TYPES: TYPES };
})(typeof window !== 'undefined' ? window : globalThis);
