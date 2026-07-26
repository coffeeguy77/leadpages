/**
 * Compact marketplace playground editor for all section apps (Trust Bar UX).
 * Items (tabbed) | Style zones — temporary state only; never saves.
 * Trust Bar still uses LPTrustBarEditor (manage-parity). This covers the rest.
 */
(function (global) {
  'use strict';

  var ITEM_LIST_KEYS = [
    'badges', 'items', 'steps', 'projects', 'slides', 'areas', 'sources',
    'headBadges', 'cards', 'services', 'events', 'stats', 'members', 'options',
    'images', 'albums', 'reels', 'feed', 'points', 'jobOptions'
  ];

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function deepGet(obj, path) {
    var parts = String(path || '').split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function deepSet(obj, path, val) {
    var parts = String(path || '').split('.');
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      var p = parts[i];
      if (cur[p] == null || typeof cur[p] !== 'object') {
        cur[p] = /^\d+$/.test(parts[i + 1]) ? [] : {};
      }
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = val;
  }

  function ensureSection(cfg, sectionKey) {
    if (!cfg.sections) cfg.sections = {};
    if (!cfg.sections[sectionKey] || typeof cfg.sections[sectionKey] !== 'object') {
      cfg.sections[sectionKey] = {};
    }
    cfg.sections[sectionKey].on = true;
    return cfg.sections[sectionKey];
  }

  function detectListKey(sectionKey, sec, fieldDefs, cfg) {
    var i, k;
    for (i = 0; i < ITEM_LIST_KEYS.length; i++) {
      k = ITEM_LIST_KEYS[i];
      if (Array.isArray(sec[k])) return k;
    }
    var fromDefs = {};
    (fieldDefs || []).forEach(function (f) {
      var m = String(f.key || '').match(new RegExp('^sections\\.' + sectionKey + '\\.([^.]+)\\.\\d+\\.'));
      if (m) fromDefs[m[1]] = true;
      var sm = String(f.key || '').match(/^services\.(\d+)\./);
      if (sm) fromDefs.__servicesRoot = true;
    });
    for (i = 0; i < ITEM_LIST_KEYS.length; i++) {
      k = ITEM_LIST_KEYS[i];
      if (fromDefs[k]) return k;
    }
    if (sectionKey === 'services' || fromDefs.__servicesRoot) {
      if (cfg && Array.isArray(cfg.services)) return '__servicesRoot';
      if (fromDefs.__servicesRoot) return '__servicesRoot';
    }
    return null;
  }

  function itemLabel(it, i) {
    if (!it || typeof it !== 'object') return String(i + 1);
    var raw = it.label || it.name || it.title || it.heading || it.who || it.text || it.question || '';
    raw = String(raw).replace(/\s+/g, ' ').trim();
    if (!raw) return String(i + 1);
    return raw.length > 18 ? raw.slice(0, 18) + '…' : raw;
  }

  function splitDefs(sectionKey, listKey, fieldDefs) {
    var itemFieldsByIndex = {};
    var styleFields = [];
    var itemFieldTemplate = [];
    var seenTemplate = {};

    (fieldDefs || []).forEach(function (f) {
      var key = String(f.key || '');
      var m = key.match(new RegExp('^sections\\.' + sectionKey + '\\.' + listKey + '\\.(\\d+)\\.(.+)$'));
      if (listKey === '__servicesRoot') {
        m = key.match(/^services\.(\d+)\.(.+)$/);
      }
      if (m) {
        var idx = parseInt(m[1], 10);
        var prop = m[2];
        if (!itemFieldsByIndex[idx]) itemFieldsByIndex[idx] = [];
        itemFieldsByIndex[idx].push(Object.assign({}, f, { _prop: prop, _index: idx }));
        if (!seenTemplate[prop]) {
          seenTemplate[prop] = true;
          itemFieldTemplate.push({ type: f.type, label: f.label, prop: prop, options: f.options });
        }
        return;
      }
      styleFields.push(f);
    });

    return { itemFieldsByIndex: itemFieldsByIndex, styleFields: styleFields, itemFieldTemplate: itemFieldTemplate };
  }

  function hexOk(v) {
    v = String(v || '').trim();
    return /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(v)
      ? (v.charAt(0) === '#' ? v : '#' + v)
      : '';
  }

  function renderField(f, val, attrName) {
    attrName = attrName || 'data-pgk';
    var keyAttr = attrName + '="' + esc(f.key || f.prop || '') + '"';
    if (f.type === 'checkbox' || f.type === 'check') {
      var on = val === true || val === 'true' || val === 1 || val === '1';
      return '<div class="f tb-ed-check-f"><label class="ck"><input type="checkbox" ' + keyAttr + (on ? ' checked' : '') + '> '
        + esc(f.label) + '</label></div>';
    }
    if (f.type === 'textarea') {
      return '<div class="f"><label>' + esc(f.label) + '</label><textarea ' + keyAttr + ' rows="2">' + esc(String(val || '')) + '</textarea></div>';
    }
    if (f.type === 'color') {
      var col = hexOk(val) || '#cccccc';
      if (col.length === 4) col = '#' + col[1] + col[1] + col[2] + col[2] + col[3] + col[3];
      return '<div class="f tb-ed-color-f"><label>' + esc(f.label) + '</label><div class="tb-ed-color">'
        + '<input type="color" ' + keyAttr + ' data-pgct="cp" value="' + esc(col) + '">'
        + '<input type="text" ' + keyAttr + ' data-pgct="ct" class="tin tb-ed-hex" maxlength="7" value="' + esc(String(val || '')) + '">'
        + '</div></div>';
    }
    if (f.type === 'select' && Array.isArray(f.options)) {
      return '<div class="f"><label>' + esc(f.label) + '</label><select class="tin" ' + keyAttr + '>'
        + f.options.map(function (o) {
          var v = typeof o === 'string' ? o : o.value;
          var l = typeof o === 'string' ? o : o.label;
          return '<option value="' + esc(v) + '"' + (String(val) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>';
        }).join('')
        + '</select></div>';
    }
    var isIcon = f.type === 'icon' || /\.icon$/i.test(f.key || f.prop || '');
    if (isIcon && global.LPIconPicker) {
      return '<div class="f"><label>' + esc(f.label) + '</label>'
        + global.LPIconPicker.controlHtml(val || '', { inputAttrs: keyAttr })
        + '</div>';
    }
    var isImage = f.type === 'image' || /\.image$/i.test(f.key || f.prop || '') || /image/i.test(f.label || '');
    if (isImage && global.LPLocalImage) {
      return '<div class="f"><label>' + esc(f.label) + '</label>'
        + global.LPLocalImage.controlHtml(val || '', {
          sample: global.LPLocalImage.isRemote(val) ? val : '',
          inputAttrs: keyAttr
        })
        + '</div>';
    }
    var inputType = f.type === 'number' ? 'number' : 'text';
    return '<div class="f"><label>' + esc(f.label) + '</label><input type="' + inputType + '" class="tin" ' + keyAttr + ' value="' + esc(String(val == null ? '' : val)) + '"></div>';
  }

  function defaultItemFromTemplate(template) {
    var it = { on: true };
    (template || []).forEach(function (f) {
      if (f.prop === 'on') return;
      if (f.type === 'icon') it[f.prop] = 'circle-check';
      else if (f.type === 'image') it[f.prop] = '';
      else it[f.prop] = f.prop === 'label' || f.prop === 'name' || f.prop === 'title' ? 'New item' : '';
    });
    if (!template || !template.length) {
      it.label = 'New item';
      it.name = 'New item';
      it.title = 'New item';
    }
    return it;
  }

  function mount(host, options) {
    options = options || {};
    var sectionKey = options.sectionKey || '';
    var fieldDefs = options.fieldDefs || [];
    var cfg = options.value || { sections: {}, theme: {} };
    var onChange = typeof options.onChange === 'function' ? options.onChange : function () {};
    var activeIdx = 0;
    var mode = options.mode || 'marketplace-playground';

    function emit() { onChange(cfg); }

    function getList() {
      var sec = ensureSection(cfg, sectionKey);
      var listKey = detectListKey(sectionKey, sec, fieldDefs, cfg);
      if (listKey === '__servicesRoot') {
        if (!Array.isArray(cfg.services)) cfg.services = [];
        return { listKey: listKey, items: cfg.services, sec: sec };
      }
      if (!listKey) return { listKey: null, items: [], sec: sec };
      if (!Array.isArray(sec[listKey])) sec[listKey] = [];
      return { listKey: listKey, items: sec[listKey], sec: sec };
    }

    function readPath(f) {
      if (global.LPPlaygroundFieldPaths && global.LPPlaygroundFieldPaths.normalizePlaygroundPath) {
        return global.LPPlaygroundFieldPaths.normalizePlaygroundPath(sectionKey, f.key);
      }
      return f.key;
    }

    function readVal(f) {
      var key = readPath(f);
      var val = deepGet(cfg, key);
      if (f.getTransform === 'areaNames' && Array.isArray(val)) {
        return val.map(function (a) {
          return typeof a === 'string' ? a : (a && a.name) || '';
        }).filter(Boolean).join(f.join || '\n');
      }
      if (f.join && Array.isArray(val)) val = val.join(f.join);
      return val == null ? '' : val;
    }

    function writeVal(f, raw) {
      var key = readPath(f);
      var val = raw;
      if (f.setTransform === 'areaNames') {
        val = String(raw || '').split(f.join || /\n|,/).map(function (s) { return s.trim(); }).filter(Boolean)
          .map(function (name) { return { on: true, name: name }; });
      } else if (f.join) {
        val = String(raw || '').split(f.join).map(function (s) { return s.trim(); }).filter(Boolean);
      }
      deepSet(cfg, key, val);
      ensureSection(cfg, sectionKey);
    }

    function render() {
      ensureSection(cfg, sectionKey);
      var list = getList();
      var split = splitDefs(sectionKey, list.listKey || 'items', fieldDefs);
      var hasItems = !!(list.listKey && (list.items.length || split.itemFieldTemplate.length));

      var html = '';
      if (mode === 'marketplace-playground') {
        html += '<div class="tb-ed-banner tb-ed-banner-safe">Have a play. Nothing here will be saved.</div>';
      } else {
        html += '<div class="tb-ed-banner">Demo builder — changes can be saved to the selected preset.</div>';
      }

      html += '<div class="tb-ed-zones">';

      if (hasItems) {
        html += '<div class="card tb-ed-card tb-ed-card-items tb-ed-zone-items">'
          + '<div class="tb-ed-items-head">'
          + '<h2>Items</h2>'
          + '<button type="button" class="tb-ed-add" data-mp-add>+ Add</button>'
          + '</div>'
          + '<div data-mp-items></div></div>';
      }

      html += '<div class="card tb-ed-card tb-ed-card-tight tb-ed-zone-style" aria-label="Style">'
        + '<div class="tb-ed-zone-label">' + (hasItems ? 'Style' : 'Controls') + '</div>'
        + '<div class="tb-ed-color-grid" data-mp-style></div>'
        + '</div></div>';

      host.innerHTML = html;
      host.classList.add('tb-ed-root', 'tb-ed-compact');
      drawItems();
      drawStyle(split.styleFields);
      wire();
    }

    function drawItems() {
      var box = host.querySelector('[data-mp-items]');
      if (!box) return;
      var list = getList();
      var items = list.items;
      var split = splitDefs(sectionKey, list.listKey || 'items', fieldDefs);
      if (!items.length) {
        box.innerHTML = '<p class="tb-ed-empty">No items yet — add one to get started.</p>';
        return;
      }
      if (activeIdx >= items.length) activeIdx = items.length - 1;
      if (activeIdx < 0) activeIdx = 0;

      var tabs = items.map(function (it, i) {
        var off = it && it.on === false ? ' off' : '';
        return '<button type="button" class="tb-ed-tab' + (i === activeIdx ? ' on' : '') + off + '" data-mp-tab="' + i + '">'
          + '<span class="tb-ed-tab-n">' + (i + 1) + '</span>'
          + '<span class="tb-ed-tab-l">' + esc(itemLabel(it, i)) + '</span></button>';
      }).join('');

      var it = items[activeIdx] || {};
      var fields = split.itemFieldsByIndex[activeIdx];
      if (!fields || !fields.length) {
        fields = (split.itemFieldTemplate.length ? split.itemFieldTemplate : [
          { type: 'text', label: 'Label', prop: 'label' },
          { type: 'text', label: 'Text', prop: 'body' }
        ]).map(function (t) {
          return Object.assign({}, t, {
            key: list.listKey === '__servicesRoot'
              ? ('services.' + activeIdx + '.' + t.prop)
              : ('sections.' + sectionKey + '.' + list.listKey + '.' + activeIdx + '.' + t.prop)
          });
        });
      }

      var panel = '<div class="tb-ed-item tb-ed-item-panel">'
        + '<div class="tb-ed-item-head">'
        + '<label class="ck"><input type="checkbox" data-mp-item-on' + (it.on !== false ? ' checked' : '') + '> Visible</label>'
        + '<span class="tb-ed-item-actions">'
        + '<button type="button" data-mp-act="up" aria-label="Move left">←</button>'
        + '<button type="button" data-mp-act="dn" aria-label="Move right">→</button>'
        + '<button type="button" data-mp-act="rm" class="danger" aria-label="Remove">Remove</button>'
        + '</span></div><div class="tb-ed-item-main">';

      fields.forEach(function (f) {
        var prop = f._prop || f.prop || String(f.key || '').split('.').pop();
        var val = it[prop];
        panel += renderField(Object.assign({}, f, { key: prop }), val, 'data-mp-item');
      });
      panel += '</div></div>';

      box.innerHTML = '<div class="tb-ed-tabs" role="tablist">' + tabs + '</div>' + panel;
      if (global.LPIconPicker) global.LPIconPicker.refresh(box);
      if (global.LPLocalImage) global.LPLocalImage.refresh(box);
    }

    function drawStyle(styleFields) {
      var box = host.querySelector('[data-mp-style]');
      if (!box) return;
      if (!styleFields.length) {
        box.innerHTML = '<p class="tb-ed-empty" style="margin:0">Style controls appear here when available.</p>';
        return;
      }
      box.innerHTML = styleFields.map(function (f) {
        return renderField(f, readVal(f), 'data-pgk');
      }).join('');
      if (global.LPIconPicker) global.LPIconPicker.refresh(box);
      if (global.LPLocalImage) global.LPLocalImage.refresh(box);
    }

    function wire() {
      if (host.__mpCompactBound) return;
      host.__mpCompactBound = true;

      host.addEventListener('click', function (e) {
        var tab = e.target.closest('[data-mp-tab]');
        if (tab) {
          activeIdx = parseInt(tab.getAttribute('data-mp-tab'), 10) || 0;
          drawItems();
          return;
        }
        var add = e.target.closest('[data-mp-add]');
        if (add) {
          var list = getList();
          var split = splitDefs(sectionKey, list.listKey || 'items', fieldDefs);
          list.items.push(defaultItemFromTemplate(split.itemFieldTemplate));
          activeIdx = list.items.length - 1;
          emit();
          drawItems();
          return;
        }
        var actBtn = e.target.closest('[data-mp-act]');
        if (actBtn) {
          var act = actBtn.getAttribute('data-mp-act');
          var L = getList();
          var items = L.items;
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
        if (t.hasAttribute('data-mp-item-on')) {
          var list = getList();
          if (list.items[activeIdx]) list.items[activeIdx].on = !!t.checked;
          emit();
          drawItems();
          return;
        }
        if (t.hasAttribute('data-mp-item')) {
          var prop = t.getAttribute('data-mp-item');
          var L2 = getList();
          if (!L2.items[activeIdx]) return;
          var val = t.type === 'checkbox' ? !!t.checked : t.value;
          L2.items[activeIdx][prop] = val;
          emit();
          return;
        }
        var key = t.getAttribute('data-pgk');
        if (!key) return;
        var def = fieldDefs.find(function (d) { return d.key === key; });
        if (!def) return;
        if (t.type === 'checkbox') {
          writeVal(def, !!t.checked);
          emit();
          return;
        }
        writeVal(def, t.value);
        if (t.dataset.pgct === 'cp') {
          var tx = host.querySelector('[data-pgk="' + key + '"][data-pgct="ct"]');
          if (tx) tx.value = t.value;
        }
        if (t.dataset.pgct === 'ct' && hexOk(t.value)) {
          var cp = host.querySelector('[data-pgk="' + key + '"][data-pgct="cp"]');
          var h = hexOk(t.value);
          if (cp && h) {
            cp.value = h.length === 4
              ? '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]
              : h;
          }
        }
        emit();
      });

      host.addEventListener('change', function (e) {
        var t = e.target;
        if (t && (t.hasAttribute('data-mp-item') || t.hasAttribute('data-pgk') || t.hasAttribute('data-mp-item-on'))) {
          /* input handler covers most; change catches selects */
          if (t.tagName === 'SELECT') {
            if (t.hasAttribute('data-mp-item')) {
              var L3 = getList();
              if (L3.items[activeIdx]) L3.items[activeIdx][t.getAttribute('data-mp-item')] = t.value;
              emit();
            } else if (t.hasAttribute('data-pgk')) {
              var def2 = fieldDefs.find(function (d) { return d.key === t.getAttribute('data-pgk'); });
              if (def2) { writeVal(def2, t.value); emit(); }
            }
          }
        }
      });
    }

    render();
    return {
      update: function (next) {
        cfg = next || cfg;
        host.__mpCompactBound = false;
        render();
      },
      getValue: function () { return cfg; }
    };
  }

  var APPEARANCE_TRANSITIONS = [
    { value: 'none', label: 'None (flat edge)' },
    { value: 'fade', label: 'Fade blend' },
    { value: 'wave', label: 'Wave' },
    { value: 'angle', label: 'Diagonal' },
    { value: 'curve', label: 'Soft curve' }
  ];

  /** Same section-container controls as manage.html secAppearancePanel */
  function withAppearanceDefs(sectionKey, fieldDefs) {
    var defs = Array.isArray(fieldDefs) ? fieldDefs.slice() : [];
    if (!sectionKey) return defs;
    var prefix = 'sections.' + sectionKey + '.appearance.';
    if (defs.some(function (d) { return String(d.key || '').indexOf(prefix) === 0; })) return defs;
    return defs.concat([
      { type: 'checkbox', key: prefix + 'custom', label: 'Custom section style' },
      { type: 'color', key: prefix + 'containerBg', label: 'Full-width background' },
      { type: 'color', key: prefix + 'strokeColor', label: 'Stroke colour' },
      { type: 'number', key: prefix + 'strokeWidth', label: 'Stroke width (0–8)' },
      {
        type: 'select',
        key: prefix + 'strokeSides',
        label: 'Stroke sides',
        options: [
          { value: 'both', label: 'Top & bottom' },
          { value: 'top', label: 'Top only' },
          { value: 'bottom', label: 'Bottom only' },
          { value: 'all', label: 'All sides' }
        ]
      },
      { type: 'select', key: prefix + 'transitionTop', label: 'Transition into section (top)', options: APPEARANCE_TRANSITIONS },
      { type: 'select', key: prefix + 'transitionBottom', label: 'Transition out (bottom)', options: APPEARANCE_TRANSITIONS }
    ]);
  }

  global.LPMarketplaceCompactEditor = {
    mount: mount,
    detectListKey: detectListKey,
    withAppearanceDefs: withAppearanceDefs
  };
})(typeof window !== 'undefined' ? window : globalThis);
