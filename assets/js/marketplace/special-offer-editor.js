/**
 * Special Offer marketplace playground editor.
 * Mirrors manage.html specialOffer controls (secCard + points list + section appearance).
 * marketplace-playground: temporary state only — never saves.
 */
(function (global) {
  'use strict';

  var DEFAULT_POINTS = [
    { on: true, text: 'No callout fee' },
    { on: true, text: 'Fixed pricing' },
    { on: true, text: 'Same day response' }
  ];

  var TRANSITIONS = [
    ['none', 'None (flat edge)'],
    ['fade', 'Fade blend'],
    ['wave', 'Wave'],
    ['angle', 'Diagonal'],
    ['curve', 'Soft curve']
  ];

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function hexOk(v) {
    v = String(v || '').trim();
    return /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(v)
      ? (v.charAt(0) === '#' ? v : '#' + v)
      : '';
  }

  function ens(cfg) {
    if (!cfg.sections) cfg.sections = {};
    if (!cfg.sections.specialOffer || typeof cfg.sections.specialOffer !== 'object') {
      cfg.sections.specialOffer = {
        on: true,
        eyebrow: 'Limited time offer',
        heading: 'Free onsite quote',
        intro: 'Book before Friday',
        cta: 'Claim this offer',
        points: DEFAULT_POINTS.map(function (p) { return Object.assign({}, p); })
      };
    }
    var SO = cfg.sections.specialOffer;
    SO.on = true;
    if (!Array.isArray(SO.points) || !SO.points.length) {
      SO.points = DEFAULT_POINTS.map(function (p) { return Object.assign({}, p); });
    }
    if (!SO.appearance || typeof SO.appearance !== 'object') SO.appearance = {};
    return SO;
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
      + '<button type="button" class="btn ghost sm tb-ed-clr" data-so-clr="' + id + '" title="Default">↺</button>'
      + '</div></div>';
  }

  function tabLabel(it, i) {
    var raw = String((it && it.text) || '').replace(/\s+/g, ' ').trim();
    if (!raw) return String(i + 1);
    return raw.length > 18 ? raw.slice(0, 18) + '…' : raw;
  }

  function mount(host, options) {
    options = options || {};
    var mode = options.mode || 'marketplace-playground';
    var cfg = options.value || { sections: { specialOffer: { on: true, points: [] } } };
    var onChange = typeof options.onChange === 'function' ? options.onChange : function () {};
    var announce = typeof options.onAnnounce === 'function' ? options.onAnnounce : function () {};
    var activeIdx = 0;

    function emit(msg) {
      onChange(cfg);
      if (msg) announce(msg);
    }

    function so() { return ens(cfg); }

    function clampActive() {
      var n = so().points.length;
      if (!n) activeIdx = 0;
      else if (activeIdx < 0) activeIdx = 0;
      else if (activeIdx >= n) activeIdx = n - 1;
    }

    function render() {
      var SO = so();
      var A = SO.appearance || {};
      var custom = A.custom === true;
      var sw = A.strokeWidth != null ? A.strokeWidth : 2;
      var hideAdmin = mode === 'marketplace-playground';
      var stack = hideAdmin;

      var html = '';
      if (!hideAdmin) {
        html += '<div class="tb-ed-banner">Demo builder — changes can be saved to the selected preset.</div>';
      } else {
        html += '<div class="tb-ed-banner tb-ed-banner-safe">Have a play. Nothing here will be saved.</div>';
      }

      html += '<div class="tb-ed-zones' + (stack ? ' tb-ed-zones-single' : '') + '">'
        + '<div class="card tb-ed-card tb-ed-card-items tb-ed-zone-items">'
        + '<div class="tb-ed-items-head">'
        + '<h2>Offer points</h2>'
        + '<button type="button" class="tb-ed-add" id="so-add">+ Add</button>'
        + '</div>'
        + '<div id="so-items"></div></div>'

        + '<div class="card tb-ed-card tb-ed-card-tight tb-ed-zone-style" aria-label="Offer copy & style">'
        + '<div class="tb-ed-zone-label">Offer copy</div>'
        + '<div class="tb-ed-color-grid">'
        + '<div class="f"><label for="so-eyebrow">Small label</label><input type="text" id="so-eyebrow" class="tin" value="' + esc(SO.eyebrow || '') + '" placeholder="Limited time offer"></div>'
        + '<div class="f"><label for="so-heading">Offer headline</label><input type="text" id="so-heading" class="tin" value="' + esc(SO.heading || '') + '" placeholder="Free onsite quote"></div>'
        + '<div class="f"><label for="so-intro">Deadline / subline</label><input type="text" id="so-intro" class="tin" value="' + esc(SO.intro || '') + '" placeholder="Book before Friday"></div>'
        + '<div class="f"><label for="so-cta">Button text</label><input type="text" id="so-cta" class="tin" value="' + esc(SO.cta || '') + '" placeholder="Claim this offer"></div>'
        + '</div>'

        + '<div class="tb-ed-app-box' + (custom ? ' on' : '') + '" data-mp-app-box>'
        + '<div class="tb-ed-app-head">'
        + '<div class="f tb-ed-check-f"><label class="ck"><input type="checkbox" id="so-app-custom"'
        + (custom ? ' checked' : '') + '> Enable custom style</label></div>'
        + '<p class="tb-ed-app-hint">Background, text colours, stroke and transitions only apply when custom style is enabled.</p>'
        + '</div>'
        + '<div class="tb-ed-app-fields"' + (custom ? '' : ' hidden') + ' id="so-app-fields">'
        + colorRow('so-app-bg', 'Full-width background', A.containerBg || '', 'Theme default')
        + colorRow('so-app-stroke', 'Stroke colour', A.strokeColor || '', 'None')
        + colorRow('so-app-eyebrow', 'Eyebrow colour', A.eyebrowColor || '', '')
        + colorRow('so-app-title', 'Title colour', A.titleColor || '', '')
        + colorRow('so-app-intro', 'Intro text colour', A.introColor || '', '')
        + '<div class="f"><label for="so-app-sw">Stroke width <span id="so-app-sw-v">' + esc(sw) + 'px</span></label>'
        + '<input type="range" id="so-app-sw" min="0" max="8" step="1" value="' + esc(sw) + '"></div>'
        + '<div class="f"><label for="so-app-sides">Stroke sides</label><select id="so-app-sides" class="tin">'
        + [['both', 'Top & bottom'], ['top', 'Top only'], ['bottom', 'Bottom only'], ['all', 'All sides']].map(function (o) {
          return '<option value="' + o[0] + '"' + ((A.strokeSides || 'both') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('')
        + '</select></div>'
        + '<div class="f"><label for="so-app-ttop">Transition into section (top)</label><select id="so-app-ttop" class="tin">'
        + TRANSITIONS.map(function (o) {
          return '<option value="' + o[0] + '"' + ((A.transitionTop || 'none') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('')
        + '</select></div>'
        + '<div class="f"><label for="so-app-tbot">Transition out (bottom)</label><select id="so-app-tbot" class="tin">'
        + TRANSITIONS.map(function (o) {
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
      var box = host.querySelector('#so-items');
      if (!box) return;
      var items = so().points;
      clampActive();
      if (!items.length) {
        box.innerHTML = '<p class="tb-ed-empty">No points yet — add one to get started.</p>';
        return;
      }
      var tabs = items.map(function (it, i) {
        var off = it.on === false ? ' off' : '';
        return '<button type="button" class="tb-ed-tab' + (i === activeIdx ? ' on' : '') + off + '" data-tab="' + i + '" title="' + esc(tabLabel(it, i)) + '">'
          + '<span class="tb-ed-tab-n">' + (i + 1) + '</span>'
          + '<span class="tb-ed-tab-l">' + esc(tabLabel(it, i)) + '</span></button>';
      }).join('');
      var it = items[activeIdx] || {};
      box.innerHTML = '<div class="tb-ed-tabs" role="tablist" aria-label="Offer points">' + tabs + '</div>'
        + '<div class="tb-ed-item tb-ed-item-panel" data-i="' + activeIdx + '">'
        + '<div class="tb-ed-item-head">'
        + '<label class="ck"><input type="checkbox" data-k="on"' + (it.on !== false ? ' checked' : '') + '> Visible</label>'
        + '<span class="tb-ed-item-actions">'
        + '<button type="button" data-act="up" aria-label="Move left">←</button>'
        + '<button type="button" data-act="dn" aria-label="Move right">→</button>'
        + '<button type="button" data-act="rm" class="danger" aria-label="Remove">Remove</button>'
        + '</span></div>'
        + '<div class="f tb-ed-text-f"><label>Point</label><input type="text" data-k="text" class="tin" value="' + esc(it.text || '') + '" placeholder="e.g. No callout fee"></div>'
        + '</div>';
    }

    function ensureApp() {
      var SO = so();
      if (!SO.appearance) SO.appearance = {};
      return SO.appearance;
    }

      function applyAppColor(id, v) {
      var h = hexOk(v);
      var A = ensureApp();
      if (id === 'so-app-bg') A.containerBg = h;
      if (id === 'so-app-stroke') A.strokeColor = h;
      if (id === 'so-app-eyebrow') A.eyebrowColor = h;
      if (id === 'so-app-title') A.titleColor = h;
      if (id === 'so-app-intro') A.introColor = h;
      var cp = host.querySelector('#' + id);
      var tx = host.querySelector('#' + id + 't');
      if (tx) tx.value = h || v || '';
      if (cp && h) {
        cp.value = h.length === 4
          ? '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]
          : h;
      }
      emit('Preview updated');
    }

    function wireOnce() {
      if (host.__soEdBound) return;
      host.__soEdBound = true;

      host.addEventListener('click', function (e) {
        var clr = e.target.closest('[data-so-clr]');
        if (clr) {
          var id = clr.getAttribute('data-so-clr');
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
          drawItems();
          return;
        }
        if (e.target.closest('#so-add')) {
          so().points.push({ on: true, text: '' });
          activeIdx = so().points.length - 1;
          emit();
          drawItems();
          return;
        }
        var actBtn = e.target.closest('[data-act]');
        if (actBtn) {
          var act = actBtn.getAttribute('data-act');
          var items = so().points;
          var i = activeIdx;
          if (act === 'rm' && items.length) {
            items.splice(i, 1);
            if (activeIdx >= items.length) activeIdx = Math.max(0, items.length - 1);
          } else if (act === 'up' && i > 0) {
            items.splice(i - 1, 0, items.splice(i, 1)[0]);
            activeIdx = i - 1;
          } else if (act === 'dn' && i < items.length - 1) {
            items.splice(i + 1, 0, items.splice(i, 1)[0]);
            activeIdx = i + 1;
          }
          emit();
          drawItems();
        }
      });

      host.addEventListener('input', function (e) {
        var t = e.target;
        if (!t) return;
        if (t.id === 'so-eyebrow') { so().eyebrow = t.value; emit(); return; }
        if (t.id === 'so-heading') { so().heading = t.value; emit(); return; }
        if (t.id === 'so-intro') { so().intro = t.value; emit(); return; }
        if (t.id === 'so-cta') { so().cta = t.value; emit(); return; }
        if (t.id === 'so-app-bg' || t.id === 'so-app-bgt') {
          applyAppColor('so-app-bg', t.value);
          return;
        }
        if (t.id === 'so-app-stroke' || t.id === 'so-app-stroket') {
          applyAppColor('so-app-stroke', t.value);
          return;
        }
        if (t.id === 'so-app-eyebrow' || t.id === 'so-app-eyebrowt') {
          applyAppColor('so-app-eyebrow', t.value);
          return;
        }
        if (t.id === 'so-app-title' || t.id === 'so-app-titlet') {
          applyAppColor('so-app-title', t.value);
          return;
        }
        if (t.id === 'so-app-intro' || t.id === 'so-app-introt') {
          applyAppColor('so-app-intro', t.value);
          return;
        }
        if (t.id === 'so-app-sw') {
          ensureApp().strokeWidth = +t.value;
          var swv = host.querySelector('#so-app-sw-v');
          if (swv) swv.textContent = t.value + 'px';
          emit();
          return;
        }
        if (t.hasAttribute('data-k') && t.closest('.tb-ed-item-panel')) {
          var items = so().points;
          var it = items[activeIdx];
          if (!it) return;
          var k = t.getAttribute('data-k');
          it[k] = t.type === 'checkbox' ? !!t.checked : t.value;
          emit();
          if (k === 'on' || k === 'text') drawItems();
        }
      });

      host.addEventListener('change', function (e) {
        var t = e.target;
        if (!t) return;
        if (t.id === 'so-app-custom') {
          ensureApp().custom = !!t.checked;
          var box = host.querySelector('[data-mp-app-box]');
          var fields = host.querySelector('#so-app-fields');
          if (box) box.classList.toggle('on', !!t.checked);
          if (fields) {
            if (t.checked) fields.removeAttribute('hidden');
            else fields.setAttribute('hidden', '');
          }
          emit();
          return;
        }
        if (t.id === 'so-app-sides') { ensureApp().strokeSides = t.value; emit(); return; }
        if (t.id === 'so-app-ttop') { ensureApp().transitionTop = t.value; emit(); return; }
        if (t.id === 'so-app-tbot') { ensureApp().transitionBottom = t.value; emit(); return; }
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

  global.LPSpecialOfferEditor = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);
