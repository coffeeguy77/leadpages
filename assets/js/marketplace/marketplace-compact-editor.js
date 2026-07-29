/**
 * Compact marketplace playground editor for all section apps (Trust Bar UX).
 * Marketplace playground: single stacked column (half-screen beside preview).
 * Demo builder may still use a wider two-zone layout.
 * Trust Bar still uses LPTrustBarEditor (manage-parity). This covers the rest.
 */
(function (global) {
  'use strict';

  var ITEM_LIST_KEYS = [
    'badges', 'items', 'steps', 'projects', 'slides', 'areas', 'sources',
    'headBadges', 'cards', 'services', 'events', 'stats', 'members', 'options',
    'images', 'albums', 'reels', 'feed', 'points', 'jobOptions'
  ];

  /** Colour / appearance / layout chrome stays in the Style column; copy & form wording go left. */
  function isStyleField(f) {
    if (!f) return false;
    if (f.zone === 'style') return true;
    if (f.zone === 'content') return false;
    var key = String(f.key || '');
    var type = String(f.type || '');
    var label = String(f.label || '');
    if (type === 'color') return true;
    if (/\.appearance\./.test(key)) return true;
    if (/^theme\./.test(key)) return true;
    if (type === 'number') {
      if (/(width|height|opacity|radius|size|cols|columns|count|stroke|gap|pad|scale)/i.test(key + ' ' + label)) {
        return true;
      }
    }
    if (type === 'select') {
      if (/(formStyle|cardStyle|imageLayout|strokeSides|transition|align|placement|mode)/i.test(key)) return true;
      if (/(Style|Colour|Color|Layout|Align|Sides|Transition|Background|Stroke|Columns|Mode)/i.test(label)) return true;
    }
    if (type === 'checkbox' || type === 'check') {
      if (/(Custom section|full.?width|stroke|shadow|glow|transparent|overlay)/i.test(label)) return true;
      if (/\.appearance\./.test(key)) return true;
    }
    return false;
  }

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

  /** Rewrite "Point 1 title" → "Point 5 title" when editing via the shared template. */
  function labelForItemIndex(label, idx) {
    var n = (parseInt(idx, 10) || 0) + 1;
    return String(label || '').replace(
      /^(Step|Card|Item|Feature|Stat|Slide|Badge|Review|Event|Member|Service|Project|Reel|Point)\s+\d+/i,
      function (_, word) { return word + ' ' + n; }
    );
  }

  function splitDefs(sectionKey, listKey, fieldDefs) {
    var itemFieldsByIndex = {};
    var contentFields = [];
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
          itemFieldTemplate.push({
            type: f.type,
            label: labelForItemIndex(f.label, 0),
            prop: prop,
            options: f.options
          });
        }
        return;
      }
      if (isStyleField(f)) styleFields.push(f);
      else contentFields.push(f);
    });

    return {
      itemFieldsByIndex: itemFieldsByIndex,
      contentFields: contentFields,
      styleFields: styleFields,
      itemFieldTemplate: itemFieldTemplate
    };
  }

  function hexOk(v) {
    v = String(v || '').trim();
    return /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(v)
      ? (v.charAt(0) === '#' ? v : '#' + v)
      : '';
  }

  function isMainCopyTextarea(f) {
    var key = String((f && f.key) || (f && f.prop) || '');
    var label = String((f && f.label) || '');
    return /\.(content|body|html|copy|mainText)$/i.test(key)
      || /^(Content|Body|Main text|Copy|Long text)$/i.test(label);
  }

  function textareaRows(f) {
    if (f && f.rows != null && f.rows !== '') {
      var n = parseInt(f.rows, 10);
      if (!isNaN(n)) return String(Math.max(2, Math.min(24, n)));
    }
    if (f && f.join) return '6';
    var key = String((f && f.key) || '');
    var label = String((f && f.label) || '');
    if (isMainCopyTextarea(f)) return '12';
    if (/\.(intro|sub|description|detailPh|fineText|summary)$/i.test(key)
      || /^(Intro|Sub-text|Description|Summary)$/i.test(label)) {
      return '6';
    }
    return '4';
  }

  function isAppearanceField(f) {
    return /\.appearance\./.test(String((f && f.key) || ''));
  }

  function isAppearanceCustomToggle(f) {
    return /\.appearance\.custom$/.test(String((f && f.key) || ''));
  }

  function isTruthyCheck(val) {
    return val === true || val === 'true' || val === 1 || val === '1';
  }

  function renderField(f, val, attrName) {
    attrName = attrName || 'data-pgk';
    var keyAttr = attrName + '="' + esc(f.key || f.prop || '') + '"';
    if (f.type === 'checkbox' || f.type === 'check') {
      var on = isTruthyCheck(val);
      return '<div class="f tb-ed-check-f"><label class="ck"><input type="checkbox" ' + keyAttr + (on ? ' checked' : '') + '> '
        + esc(f.label) + '</label></div>';
    }
    if (f.type === 'textarea') {
      /* Chip list for newline-joined string arrays (e.g. area suburbs) — add / remove without a raw dump */
      if (f.join && (f.listUi === 'chips' || /\.suburbs$/i.test(f.key || ''))) {
        var chips = String(val || '').split(f.join).map(function (s) { return s.trim(); }).filter(Boolean);
        var chipHtml = chips.map(function (name, i) {
          return '<span class="tb-ed-chip">' + esc(name)
            + '<button type="button" class="tb-ed-chip-x" data-mp-chip-rm="' + i + '" data-pgk="' + esc(f.key) + '" aria-label="Remove ' + esc(name) + '">×</button></span>';
        }).join('');
        return '<div class="f tb-ed-chiplist tb-ed-span-2" data-mp-chiplist="' + esc(f.key) + '">'
          + '<label>' + esc(f.label) + '</label>'
          + '<div class="tb-ed-chips">' + (chipHtml || '<span class="tb-ed-empty" style="margin:0">No suburbs yet</span>') + '</div>'
          + '<div class="tb-ed-chip-add">'
          + '<input type="text" class="tin" data-mp-chip-in="' + esc(f.key) + '" placeholder="Add a suburb" maxlength="80">'
          + '<button type="button" class="tb-ed-add" data-mp-chip-add="' + esc(f.key) + '">+ Add</button>'
          + '</div>'
          + '<textarea ' + keyAttr + ' hidden rows="2">' + esc(String(val || '')) + '</textarea>'
          + '</div>';
      }
      var rows = textareaRows(f);
      var mainCopy = isMainCopyTextarea(f);
      return '<div class="f tb-ed-span-2 tb-ed-textarea-f' + (mainCopy ? ' tb-ed-textarea-main' : '') + '">'
        + '<label>' + esc(f.label) + '</label>'
        + '<textarea ' + keyAttr + ' rows="' + rows + '">' + esc(String(val || '')) + '</textarea></div>';
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
      return '<div class="f tb-ed-span-2"><label>' + esc(f.label) + '</label>'
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
      else if (f.type === 'number') {
        if (f.prop === 'bgOpacity' || f.prop === 'mediaScale' || f.prop === 'iconScale') it[f.prop] = 100;
        else it[f.prop] = '';
      } else if (f.type === 'select' && Array.isArray(f.options) && f.options.length) {
        var o0 = f.options[0];
        it[f.prop] = typeof o0 === 'string' ? o0 : o0.value;
      } else if (f.prop === 'n') it[f.prop] = '+';
      else if (f.type === 'color') it[f.prop] = '';
      else it[f.prop] = f.prop === 'label' || f.prop === 'name' || f.prop === 'title' ? 'New item' : '';
    });
    if (!template || !template.length) {
      it.label = 'New item';
      it.name = 'New item';
      it.title = 'New item';
      it.icon = 'circle-check';
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
      var hasContent = !!(split.contentFields && split.contentFields.length);
      var hasStyle = !!(split.styleFields && split.styleFields.length);
      /* Quote Form etc: keep copy/labels on the left so Style is not a giant scroll */
      var showLeft = hasItems || hasContent;

      var html = '';
      if (mode === 'marketplace-playground') {
        html += '<div class="tb-ed-banner tb-ed-banner-safe">Have a play. Nothing here will be saved.</div>';
      } else {
        html += '<div class="tb-ed-banner">Demo builder — changes can be saved to the selected preset.</div>';
      }

      /* Playground sits in ~half the screen — always stack Content then Style */
      var stackPlayground = mode === 'marketplace-playground';
      html += '<div class="tb-ed-zones' + (stackPlayground || !(showLeft && hasStyle) ? ' tb-ed-zones-single' : '') + '">';

      if (showLeft) {
        html += '<div class="tb-ed-zone-left">';
        if (hasItems) {
          var itemsTitle = sectionKey === 'quote' ? 'Trust points' : 'Items';
          html += '<div class="card tb-ed-card tb-ed-card-items tb-ed-zone-items">'
            + '<div class="tb-ed-items-head">'
            + '<h2>' + itemsTitle + '</h2>'
            + '<button type="button" class="tb-ed-add" data-mp-add>+ Add</button>'
            + '</div>'
            + '<div data-mp-items></div></div>';
        }
        if (hasContent) {
          html += '<div class="card tb-ed-card tb-ed-card-tight tb-ed-zone-content" aria-label="Content">'
            + '<div class="tb-ed-zone-label">Content</div>'
            + '<div class="tb-ed-color-grid" data-mp-content></div>'
            + '</div>';
        }
        if (stackPlayground && (hasStyle || !showLeft)) {
          html += '<div class="card tb-ed-card tb-ed-card-tight tb-ed-zone-style" aria-label="Style">'
            + '<div class="tb-ed-zone-label">Style</div>'
            + '<div class="tb-ed-color-grid" data-mp-style></div>'
            + '</div>';
        }
        html += '</div>';
      }

      if (!stackPlayground && (hasStyle || !showLeft)) {
        html += '<div class="card tb-ed-card tb-ed-card-tight tb-ed-zone-style" aria-label="Style">'
          + '<div class="tb-ed-zone-label">' + (showLeft || hasStyle ? 'Style' : 'Content') + '</div>'
          + '<div class="tb-ed-color-grid" data-mp-style></div>'
          + '</div>';
      } else if (stackPlayground && !showLeft && hasStyle) {
        html += '<div class="card tb-ed-card tb-ed-card-tight tb-ed-zone-style" aria-label="Style">'
          + '<div class="tb-ed-zone-label">Style</div>'
          + '<div class="tb-ed-color-grid" data-mp-style></div>'
          + '</div>';
      }

      html += '</div>';

      host.innerHTML = html;
      host.className = host.className
        .split(/\s+/)
        .filter(function (c) {
          return c && c.indexOf('tb-ed-sec-') !== 0
            && c !== 'tb-ed-root'
            && c !== 'tb-ed-compact'
            && c !== 'tb-ed-stack'
            && c !== 'tb-ed-copyheavy';
        })
        .join(' ');
      host.classList.add('tb-ed-root', 'tb-ed-compact');
      if (stackPlayground) host.classList.add('tb-ed-stack');
      if (sectionKey) host.classList.add('tb-ed-sec-' + sectionKey);
      if (hasContent && hasStyle && !hasItems) host.classList.add('tb-ed-copyheavy');
      drawItems();
      drawContent(split.contentFields);
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
            label: labelForItemIndex(t.label, activeIdx),
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
        panel += renderField(Object.assign({}, f, {
          key: prop,
          label: labelForItemIndex(f.label, activeIdx)
        }), val, 'data-mp-item');
      });
      panel += '</div></div>';

      box.innerHTML = '<div class="tb-ed-tabs" role="tablist">' + tabs + '</div>' + panel;
      if (global.LPIconPicker) global.LPIconPicker.refresh(box);
      if (global.LPLocalImage) global.LPLocalImage.refresh(box);
    }

    function drawFieldGrid(box, fields, emptyMsg) {
      if (!box) return;
      if (!fields || !fields.length) {
        box.innerHTML = '<p class="tb-ed-empty" style="margin:0">' + esc(emptyMsg || 'Nothing here yet.') + '</p>';
        return;
      }
      box.innerHTML = fields.map(function (f) {
        return renderField(f, readVal(f), 'data-pgk');
      }).join('');
      if (global.LPIconPicker) global.LPIconPicker.refresh(box);
      if (global.LPLocalImage) global.LPLocalImage.refresh(box);
    }

    function drawContent(contentFields) {
      drawFieldGrid(host.querySelector('[data-mp-content]'), contentFields, 'Content controls appear here when available.');
    }

    function drawStyle(styleFields) {
      var box = host.querySelector('[data-mp-style]');
      if (!box) return;
      if (!styleFields || !styleFields.length) {
        box.innerHTML = '<p class="tb-ed-empty" style="margin:0">Style controls appear here when available.</p>';
        return;
      }
      var plain = [];
      var appearance = [];
      var customToggle = null;
      styleFields.forEach(function (f) {
        if (isAppearanceCustomToggle(f)) customToggle = f;
        else if (isAppearanceField(f)) appearance.push(f);
        else plain.push(f);
      });
      var html = plain.map(function (f) {
        return renderField(f, readVal(f), 'data-pgk');
      }).join('');
      if (customToggle || appearance.length) {
        var customOn = customToggle ? isTruthyCheck(readVal(customToggle)) : false;
        var toggleField = customToggle
          ? Object.assign({}, customToggle, { label: 'Enable custom style' })
          : null;
        html += '<div class="tb-ed-app-box' + (customOn ? ' on' : '') + '" data-mp-app-box>'
          + '<div class="tb-ed-app-head">'
          + (toggleField ? renderField(toggleField, readVal(customToggle), 'data-pgk') : '')
          + '<p class="tb-ed-app-hint">Background, stroke and transitions only apply when custom style is enabled.</p>'
          + '</div>'
          + '<div class="tb-ed-app-fields"' + (customOn ? '' : ' hidden') + '>'
          + appearance.map(function (f) {
            return renderField(f, readVal(f), 'data-pgk');
          }).join('')
          + '</div></div>';
      }
      box.innerHTML = html || '<p class="tb-ed-empty" style="margin:0">Style controls appear here when available.</p>';
      if (global.LPIconPicker) global.LPIconPicker.refresh(box);
      if (global.LPLocalImage) global.LPLocalImage.refresh(box);
    }

    function wire() {
      if (host.__mpCompactBound) return;
      host.__mpCompactBound = true;

      function refreshPanels() {
        var list = getList();
        var split = splitDefs(sectionKey, list.listKey || 'items', fieldDefs);
        drawContent(split.contentFields);
        drawStyle(split.styleFields);
      }

      function refreshStyle() { refreshPanels(); }

      function chipNames(def) {
        return String(readVal(def) || '')
          .split(def.join || '\n')
          .map(function (s) { return s.trim(); })
          .filter(Boolean);
      }

      host.addEventListener('click', function (e) {
        var tab = e.target.closest('[data-mp-tab]');
        if (tab) {
          activeIdx = parseInt(tab.getAttribute('data-mp-tab'), 10) || 0;
          drawItems();
          return;
        }
        var chipRm = e.target.closest('[data-mp-chip-rm]');
        if (chipRm) {
          var rmKey = chipRm.getAttribute('data-pgk');
          var rmDef = fieldDefs.find(function (d) { return d.key === rmKey; });
          if (rmDef) {
            var rmIdx = parseInt(chipRm.getAttribute('data-mp-chip-rm'), 10);
            var rmList = chipNames(rmDef);
            if (rmIdx >= 0 && rmIdx < rmList.length) {
              rmList.splice(rmIdx, 1);
              writeVal(rmDef, rmList.join(rmDef.join || '\n'));
              emit();
              refreshStyle();
            }
          }
          return;
        }
        var chipAdd = e.target.closest('[data-mp-chip-add]');
        if (chipAdd) {
          var addKey = chipAdd.getAttribute('data-mp-chip-add');
          var addDef = fieldDefs.find(function (d) { return d.key === addKey; });
          var addIn = host.querySelector('[data-mp-chip-in="' + addKey + '"]');
          if (addDef && addIn) {
            var name = String(addIn.value || '').trim();
            if (name) {
              var addList = chipNames(addDef);
              var exists = addList.some(function (s) { return s.toLowerCase() === name.toLowerCase(); });
              if (!exists) addList.push(name);
              writeVal(addDef, addList.join(addDef.join || '\n'));
              addIn.value = '';
              emit();
              refreshStyle();
              var focusIn = host.querySelector('[data-mp-chip-in="' + addKey + '"]');
              if (focusIn) focusIn.focus();
            }
          }
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

      host.addEventListener('keydown', function (e) {
        var t = e.target;
        if (!t || !t.hasAttribute('data-mp-chip-in')) return;
        if (e.key !== 'Enter') return;
        e.preventDefault();
        var key = t.getAttribute('data-mp-chip-in');
        var btn = host.querySelector('[data-mp-chip-add="' + key + '"]');
        if (btn) btn.click();
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
          if (isAppearanceCustomToggle(def)) refreshStyle();
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
    /* Top emergency bar is not a full-width section container */
    if (sectionKey === 'emerg') return defs;
    var prefix = 'sections.' + sectionKey + '.appearance.';
    if (defs.some(function (d) { return String(d.key || '').indexOf(prefix) === 0; })) return defs;
    return defs.concat([
      { type: 'checkbox', key: prefix + 'custom', label: 'Enable custom style' },
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
    isStyleField: isStyleField,
    splitDefs: splitDefs,
    withAppearanceDefs: withAppearanceDefs
  };
})(typeof window !== 'undefined' ? window : globalThis);
