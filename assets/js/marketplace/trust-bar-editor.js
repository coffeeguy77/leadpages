/**
 * Trust Bar editor for marketplace playground / demo-builder modes.
 * Mirrors the manage.html Trust Bar controls (labels, fields, layouts).
 * Modes: production (unused here), demo-builder, marketplace-playground.
 *
 * marketplace-playground: temporary state only — never saves.
 * Compact UI: section always on; tabbed items; no mini preview in the editor.
 */
(function (global) {
  'use strict';

  var DEFAULT_ITEM = {
    on: true,
    label: 'New item',
    image: '',
    imageFit: 'cover',
    imagePos: 'center',
    icon: 'circle-check'
  };

  var DEFAULT_FOUR = [
    { on: true, label: 'Garden Design', icon: 'flower-2', image: '', imageFit: 'cover', imagePos: 'center' },
    { on: true, label: 'Retaining Walls', icon: 'brick-wall', image: '', imageFit: 'cover', imagePos: 'center' },
    { on: true, label: 'Paving', icon: 'grid-3x3', image: '', imageFit: 'cover', imagePos: 'center' },
    { on: true, label: 'Outdoor Living', icon: 'trees', image: '', imageFit: 'cover', imagePos: 'center' }
  ];

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function ens(cfg) {
    if (!cfg.sections) cfg.sections = {};
    if (!cfg.sections.trustBar) {
      cfg.sections.trustBar = {
        on: true,
        mode: 'badges',
        sep: 'none',
        lineOn: true,
        badges: DEFAULT_FOUR.map(function (b) { return Object.assign({}, b); })
      };
    }
    if (!Array.isArray(cfg.sections.trustBar.badges) || !cfg.sections.trustBar.badges.length) {
      cfg.sections.trustBar.badges = DEFAULT_FOUR.map(function (b) { return Object.assign({}, b); });
    }
    cfg.sections.trustBar.on = true;
    return cfg.sections.trustBar;
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
    return '<div class="f tb-ed-f tb-ed-color-f"><label for="' + id + 't">' + esc(label) + '</label>'
      + '<div class="tb-ed-color">'
      + '<input type="color" id="' + id + '" value="' + esc(pick) + '" aria-label="' + esc(label) + ' colour">'
      + '<input type="text" id="' + id + 't" class="tin tb-ed-hex" maxlength="7" placeholder="' + esc(placeholder || '#…') + '" value="' + esc(v) + '">'
      + '<button type="button" class="btn ghost sm tb-ed-clr" data-tb-clr="' + id + '" title="Default">↺</button>'
      + '</div></div>';
  }

  function tabLabel(it, i) {
    var raw = String((it && it.label) || '').replace(/\s+/g, ' ').trim();
    var short = raw.split(/\n/)[0].slice(0, 18);
    if (!short) return String(i + 1);
    if (raw.length > 18) short += '…';
    return short;
  }

  function mount(host, options) {
    options = options || {};
    var mode = options.mode || 'marketplace-playground';
    var cfg = options.value || { sections: { trustBar: { on: true, badges: [] } } };
    var onChange = typeof options.onChange === 'function' ? options.onChange : function () {};
    var announce = typeof options.onAnnounce === 'function' ? options.onAnnounce : function () {};
    var activeIdx = 0;

    function emit(msg) {
      onChange(cfg);
      if (msg) announce(msg);
    }

    function tb() { return ens(cfg); }

    function clampActive() {
      var n = tb().badges.length;
      if (!n) activeIdx = 0;
      else if (activeIdx < 0) activeIdx = 0;
      else if (activeIdx >= n) activeIdx = n - 1;
    }

    function render() {
      var TB = tb();
      var tbMode = TB.mode === 'images' ? 'images' : 'badges';
      var h = TB.imageHeight != null ? TB.imageHeight : 280;
      var hideAdmin = mode === 'marketplace-playground';

      var html = '';
      if (!hideAdmin) {
        html += '<div class="tb-ed-banner">Demo builder — changes can be saved to the selected preset.</div>';
      } else {
        html += '<div class="tb-ed-banner tb-ed-banner-safe">Have a play. Nothing here will be saved.</div>';
      }

      // Items left, Style right — style sits on a light theme wash to separate the zones.
      html += '<div class="tb-ed-zones">'
        + '<div class="card tb-ed-card tb-ed-card-items tb-ed-zone-items">'
        + '<div class="tb-ed-items-head">'
        + '<h2 id="tb-list-title">Items</h2>'
        + '<button type="button" class="tb-ed-add" id="tb-add">+ Add</button>'
        + '</div>'
        + '<div id="tb-items"></div></div>'

        + '<div class="card tb-ed-card tb-ed-card-tight tb-ed-zone-style">'
        + '<div class="tb-ed-zone-label">Style</div>'
        + '<div class="tb-ed-toolbar">'
        + '<div class="f tb-ed-style"><label for="tb-mode">Layout</label>'
        + '<select id="tb-mode" class="tin">'
        + '<option value="badges"' + (tbMode === 'badges' ? ' selected' : '') + '>Classic badges</option>'
        + '<option value="images"' + (tbMode === 'images' ? ' selected' : '') + '>Image tiles</option>'
        + '</select></div>'
        + '<div class="f" id="tb-classic-opts"' + (tbMode === 'images' ? ' style="display:none"' : '') + '>'
        + '<label for="tb-sep">Separator</label>'
        + '<select id="tb-sep" class="tin"><option value="none">Spacing only</option><option value="pipe">Vertical line</option></select>'
        + '</div>'
        + '<div class="f" id="tb-h-wrap"' + (tbMode === 'images' ? '' : ' style="display:none"') + '>'
        + '<label for="tb-h">Height <span id="tb-h-v">' + esc(h) + 'px</span></label>'
        + '<input type="range" id="tb-h" min="160" max="520" step="10" value="' + esc(h) + '">'
        + '</div></div>'

        + '<div id="tb-classic-colors" class="tb-ed-color-grid"' + (tbMode === 'images' ? ' style="display:none"' : '') + '>'
        + colorRow('tb-bg', 'Background', TB.bg, '')
        + colorRow('tb-fg', 'Font', TB.fg, '')
        + '<div class="f tb-ed-check-f"><label class="ck"><input type="checkbox" id="tb-lineon"' + (TB.lineOn !== false ? ' checked' : '') + '> Divider lines</label></div>'
        + colorRow('tb-line', 'Line', TB.line, '')
        + '</div>'

        + '<div id="tb-image-opts" class="tb-ed-color-grid"' + (tbMode === 'images' ? '' : ' style="display:none"') + '>'
        + '<div class="f tb-ed-check-f"><label class="ck"><input type="checkbox" id="tb-strokeon"' + (TB.strokeOn !== false ? ' checked' : '') + '> Tile stroke</label></div>'
        + colorRow('tb-stroke', 'Stroke', TB.strokeColour || TB.stroke || '#ffffff', '#ffffff')
        + '<div class="f tb-ed-check-f"><label class="ck"><input type="checkbox" id="tb-edgeon"' + (TB.edgeOn !== false ? ' checked' : '') + '> Edge stroke</label></div>'
        + colorRow('tb-edge', 'Edge', TB.edgeColour || TB.edge || '#ffffff', '#ffffff')
        + colorRow('tb-img-fg', 'Caption', TB.fg || '#ffffff', '#ffffff')
        + '</div></div>'
        + '</div>';

      host.innerHTML = html;
      wire();
      drawItems();
    }

    function itemPanelHtml(it, i, images) {
      if (images && window.LPLocalImage) window.LPLocalImage.rememberSample(it, 'image');
      var sample = (it && it._pgSample) || '';
      var localImg = images && mode === 'marketplace-playground' && window.LPLocalImage;
      var imageField = '';
      if (images) {
        if (localImg) {
          imageField = '<div class="f tb-ed-img-f"><label>Tile image</label>'
            + window.LPLocalImage.controlHtml(it.image || '', {
              sample: sample || ((window.LPLocalImage.isRemote(it.image) ? it.image : '') || ''),
              inputAttrs: 'data-k="image"'
            })
            + '</div>';
        } else {
          imageField = '<div class="f"><label>Tile image URL</label><input type="url" data-k="image" value="' + esc(it.image || '') + '" placeholder="https://…"></div>';
        }
        imageField += '<div class="row tb-ed-fit-row"><div class="f"><label>Fit</label><select data-k="imageFit">'
          + [['cover', 'Cover'], ['contain', 'Contain'], ['fill', 'Fill'], ['stretch', 'Stretch']]
            .map(function (o) { return '<option value="' + o[0] + '"' + ((it.imageFit || 'cover') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('')
          + '</select></div><div class="f"><label>Position</label><select data-k="imagePos">'
          + [['center', 'Centre'], ['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right']]
            .map(function (o) { return '<option value="' + o[0] + '"' + ((it.imagePos || 'center') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('')
          + '</select></div></div>';
      }

      return '<div class="tb-ed-item tb-ed-item-panel" data-i="' + i + '">'
        + '<div class="tb-ed-item-head">'
        + '<label class="ck"><input type="checkbox" data-k="on"' + (it.on !== false ? ' checked' : '') + '> Visible</label>'
        + '<span class="tb-ed-item-actions">'
        + '<button type="button" data-act="up" aria-label="Move left">←</button>'
        + '<button type="button" data-act="dn" aria-label="Move right">→</button>'
        + '<button type="button" data-act="rm" class="danger" aria-label="Remove">Remove</button>'
        + '</span></div>'
        + imageField
        + '<div class="row tb-ed-item-main">'
        + '<div class="f"><label>Icon</label>'
        + (window.LPIconPicker
          ? window.LPIconPicker.controlHtml(it.icon || '', { inputAttrs: 'data-k="icon"' })
          : '<input type="text" data-k="icon" value="' + esc(it.icon || '') + '" placeholder="e.g. shield-check">')
        + '</div>'
        + '<div class="f tb-ed-text-f"><label>Text</label><textarea data-k="label" rows="2">' + esc(it.label || '') + '</textarea></div>'
        + '</div></div>';
    }

    function drawItems() {
      var box = host.querySelector('#tb-items');
      if (!box) return;
      var items = tb().badges;
      var images = tb().mode === 'images';
      clampActive();

      if (!items.length) {
        box.innerHTML = '<p class="tb-ed-empty">No items yet — add one to get started.</p>';
        return;
      }

      var tabs = items.map(function (it, i) {
        var off = it.on === false ? ' off' : '';
        return '<button type="button" class="tb-ed-tab' + (i === activeIdx ? ' on' : '') + off + '" data-tab="' + i + '" title="' + esc(tabLabel(it, i)) + '">'
          + '<span class="tb-ed-tab-n">' + (i + 1) + '</span>'
          + '<span class="tb-ed-tab-l">' + esc(tabLabel(it, i)) + '</span>'
          + '</button>';
      }).join('');

      box.innerHTML = '<div class="tb-ed-tabs" role="tablist" aria-label="Items">' + tabs + '</div>'
        + itemPanelHtml(items[activeIdx], activeIdx, images);

      if (window.LPIconPicker) window.LPIconPicker.refresh(box);
      if (window.LPLocalImage) {
        var it = items[activeIdx];
        var sample = (it && it._pgSample) || '';
        var ctl = box.querySelector('[data-lp-locimg]');
        if (ctl) window.LPLocalImage.applyValues(ctl, (it && it.image) || '', sample);
        else window.LPLocalImage.refresh(box);
      }
    }

    function syncModeUi() {
      var images = tb().mode === 'images';
      var co = host.querySelector('#tb-classic-opts');
      var cc = host.querySelector('#tb-classic-colors');
      var io = host.querySelector('#tb-image-opts');
      var hw = host.querySelector('#tb-h-wrap');
      if (co) co.style.display = images ? 'none' : '';
      if (cc) cc.style.display = images ? 'none' : '';
      if (io) io.style.display = images ? '' : 'none';
      if (hw) hw.style.display = images ? '' : 'none';
    }

    function wireColor(id, apply, clearVal) {
      var cp = host.querySelector('#' + id);
      var tx = host.querySelector('#' + id + 't');
      if (!cp || !tx) return;
      function set(v) {
        var h = hexOk(v);
        apply(h);
        tx.value = h || v || '';
        if (h) cp.value = h.length === 4
          ? '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]
          : h;
        emit('Preview updated');
      }
      cp.addEventListener('input', function () { set(cp.value); });
      tx.addEventListener('input', function () { set(tx.value); });
      var clr = host.querySelector('[data-tb-clr="' + id + '"]');
      if (clr) {
        clr.addEventListener('click', function () {
          apply(clearVal === undefined ? '' : clearVal);
          tx.value = clearVal || '';
          cp.value = clearVal || '#cccccc';
          emit('Preview updated');
        });
      }
    }

    function wire() {
      var md = host.querySelector('#tb-mode');
      if (md) {
        md.value = tb().mode === 'images' ? 'images' : 'badges';
        md.addEventListener('change', function () {
          tb().mode = md.value;
          if (md.value === 'images') {
            // Make sure each tile has fit/pos defaults when switching from badges.
            (tb().badges || []).forEach(function (b) {
              if (!b || typeof b !== 'object') return;
              if (!b.imageFit) b.imageFit = 'cover';
              if (!b.imagePos) b.imagePos = 'center';
              if (b.image == null) b.image = '';
            });
          }
          syncModeUi();
          drawItems();
          var msg = md.value === 'images'
            ? 'Image tiles — pick an image for each item'
            : 'Layout changed to text and icons';
          emit(msg);
        });
      }

      var sp = host.querySelector('#tb-sep');
      if (sp) {
        sp.value = tb().sep || 'none';
        sp.addEventListener('change', function () { tb().sep = sp.value; emit('Preview updated'); });
      }

      wireColor('tb-bg', function (v) { tb().bg = v; }, '');
      wireColor('tb-fg', function (v) { tb().fg = v; }, '');
      wireColor('tb-line', function (v) { tb().line = v; }, '');
      wireColor('tb-stroke', function (v) { tb().strokeColour = v || '#ffffff'; }, '#ffffff');
      wireColor('tb-edge', function (v) { tb().edgeColour = v || '#ffffff'; }, '#ffffff');
      wireColor('tb-img-fg', function (v) { tb().fg = v || '#ffffff'; }, '#ffffff');

      var lo = host.querySelector('#tb-lineon');
      if (lo) lo.addEventListener('change', function () { tb().lineOn = lo.checked; emit('Preview updated'); });
      var so = host.querySelector('#tb-strokeon');
      if (so) so.addEventListener('change', function () { tb().strokeOn = so.checked; emit('Preview updated'); });
      var eo = host.querySelector('#tb-edgeon');
      if (eo) eo.addEventListener('change', function () { tb().edgeOn = eo.checked; emit('Preview updated'); });

      var hh = host.querySelector('#tb-h');
      var hv = host.querySelector('#tb-h-v');
      if (hh) {
        hh.addEventListener('input', function () {
          tb().imageHeight = +hh.value;
          if (hv) hv.textContent = hh.value + 'px';
          emit('Preview updated');
        });
      }

      var add = host.querySelector('#tb-add');
      if (add) {
        add.addEventListener('click', function () {
          tb().badges.push(Object.assign({}, DEFAULT_ITEM));
          activeIdx = tb().badges.length - 1;
          drawItems();
          emit('Item added');
        });
      }

      var box = host.querySelector('#tb-items');
      if (box && !box.__bound) {
        box.__bound = true;
        box.addEventListener('input', function (e) {
          var row = e.target.closest('.tb-ed-item');
          if (!row) return;
          var i = +row.getAttribute('data-i');
          var k = e.target.getAttribute('data-k');
          if (!k || !tb().badges[i]) return;
          if (k === 'on') tb().badges[i].on = e.target.checked;
          else tb().badges[i][k] = e.target.value;
          if (k === 'label' || k === 'on') {
            var tab = box.querySelector('.tb-ed-tab[data-tab="' + i + '"]');
            if (tab) {
              var lab = tab.querySelector('.tb-ed-tab-l');
              if (lab) lab.textContent = tabLabel(tb().badges[i], i);
              tab.classList.toggle('off', tb().badges[i].on === false);
              tab.title = tabLabel(tb().badges[i], i);
            }
          }
          emit('Preview updated');
        });
        box.addEventListener('change', function (e) {
          var row = e.target.closest('.tb-ed-item');
          if (!row) return;
          var i = +row.getAttribute('data-i');
          var k = e.target.getAttribute('data-k');
          if (!k || !tb().badges[i]) return;
          if (k === 'on') tb().badges[i].on = e.target.checked;
          else tb().badges[i][k] = e.target.value;
          if (k === 'on') {
            var tab = box.querySelector('.tb-ed-tab[data-tab="' + i + '"]');
            if (tab) tab.classList.toggle('off', tb().badges[i].on === false);
          }
          emit('Preview updated');
        });
        box.addEventListener('click', function (e) {
          var tabBtn = e.target.closest('[data-tab]');
          if (tabBtn && box.contains(tabBtn)) {
            activeIdx = +tabBtn.getAttribute('data-tab');
            drawItems();
            announce('Editing item ' + (activeIdx + 1));
            return;
          }
          var btn = e.target.closest('[data-act]');
          if (!btn) return;
          var row = btn.closest('.tb-ed-item');
          if (!row) return;
          var i = +row.getAttribute('data-i');
          var a = tb().badges;
          var act = btn.getAttribute('data-act');
          if (act === 'rm') {
            a.splice(i, 1);
            if (activeIdx >= a.length) activeIdx = Math.max(0, a.length - 1);
            drawItems();
            emit('Item removed');
          } else if (act === 'up' && i > 0) {
            var x = a[i - 1]; a[i - 1] = a[i]; a[i] = x;
            activeIdx = i - 1;
            drawItems();
            emit('Item reordered');
          } else if (act === 'dn' && i < a.length - 1) {
            var y = a[i + 1]; a[i + 1] = a[i]; a[i] = y;
            activeIdx = i + 1;
            drawItems();
            emit('Item reordered');
          }
        });
        box.addEventListener('lp-locimg-error', function (e) {
          var msg = (e.detail && e.detail.message) || 'Could not use that image';
          announce(msg);
        });
      }
    }

    function setValue(next) {
      cfg = next || cfg;
      activeIdx = 0;
      render();
    }

    function getValue() {
      return cfg;
    }

    render();
    return { setValue: setValue, getValue: getValue, remount: render };
  }

  global.LPTrustBarEditor = {
    mount: mount,
    mode: {
      PRODUCTION: 'production',
      DEMO_BUILDER: 'demo-builder',
      MARKETPLACE_PLAYGROUND: 'marketplace-playground'
    }
  };
})(typeof window !== 'undefined' ? window : global);
