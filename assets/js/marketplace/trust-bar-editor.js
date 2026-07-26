/**
 * Trust Bar editor for marketplace playground / demo-builder modes.
 * Mirrors the manage.html Trust Bar controls (labels, fields, layouts).
 * Modes: production (unused here), demo-builder, marketplace-playground.
 *
 * marketplace-playground: temporary state only — never saves.
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
    return '<div class="f tb-ed-f"><label for="' + id + 't">' + esc(label) + '</label>'
      + '<div class="tb-ed-color">'
      + '<input type="color" id="' + id + '" value="' + esc(pick) + '" aria-label="' + esc(label) + ' colour">'
      + '<input type="text" id="' + id + 't" class="tin" placeholder="' + esc(placeholder || 'Theme default') + '" value="' + esc(v) + '">'
      + '<button type="button" class="btn ghost sm" data-tb-clr="' + id + '">Default</button>'
      + '</div></div>';
  }

  function mount(host, options) {
    options = options || {};
    var mode = options.mode || 'marketplace-playground';
    var cfg = options.value || { sections: { trustBar: { on: true, badges: [] } } };
    var onChange = typeof options.onChange === 'function' ? options.onChange : function () {};
    var announce = typeof options.onAnnounce === 'function' ? options.onAnnounce : function () {};

    function emit(msg) {
      onChange(cfg);
      if (msg) announce(msg);
    }

    function tb() { return ens(cfg); }

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

      html += '<div class="card tb-ed-card"><h2>Show on page</h2>'
        + '<label class="ck"><input type="checkbox" id="tb-on"' + (TB.on !== false ? ' checked' : '') + '> Show Trust Bar on the page</label>'
        + '</div>';

      html += '<div class="card tb-ed-card"><h2>Layout</h2>'
        + '<p class="lede">Classic icon badges, or a full-width image strip with caption text on each tile.</p>'
        + '<div class="row"><div class="f"><label for="tb-mode">Style</label>'
        + '<select id="tb-mode" class="tin">'
        + '<option value="badges"' + (tbMode === 'badges' ? ' selected' : '') + '>Classic badges</option>'
        + '<option value="images"' + (tbMode === 'images' ? ' selected' : '') + '>Image tiles</option>'
        + '</select></div></div></div>';

      html += '<div class="card tb-ed-card" id="tb-classic-opts"' + (tbMode === 'images' ? ' style="display:none"' : '') + '>'
        + '<h2>Bar appearance</h2>'
        + '<p class="lede">Separator, colours and per-badge icons. Each badge icon is chosen in the list below.</p>'
        + '<div class="row"><div class="f"><label for="tb-sep">Separator between items</label>'
        + '<select id="tb-sep" class="tin"><option value="none">Spacing only</option><option value="pipe">Vertical line ( | )</option></select></div></div>'
        + '<div class="row">' + colorRow('tb-bg', 'Background colour', TB.bg, 'Theme default')
        + colorRow('tb-fg', 'Font colour', TB.fg, 'Theme default') + '</div>'
        + '<div class="row"><div class="f"><label>Top &amp; bottom line</label>'
        + '<label class="ck"><input type="checkbox" id="tb-lineon"' + (TB.lineOn !== false ? ' checked' : '') + '> Show the divider lines</label></div>'
        + colorRow('tb-line', 'Line colour', TB.line, 'Theme default') + '</div></div>';

      html += '<div class="card tb-ed-card" id="tb-image-opts"' + (tbMode === 'images' ? '' : ' style="display:none"') + '>'
        + '<h2>Image strip</h2>'
        + '<p class="lede">Full-width equal tiles. Add more items and they share the row evenly. Press Enter in the text field to drop a line.</p>'
        + '<div class="row"><div class="f"><label for="tb-h">Image height <span id="tb-h-v">' + esc(h) + 'px</span></label>'
        + '<input type="range" id="tb-h" min="160" max="520" step="10" value="' + esc(h) + '"></div></div>'
        + '<div class="row"><div class="f"><label>Stroke between tiles</label>'
        + '<label class="ck"><input type="checkbox" id="tb-strokeon"' + (TB.strokeOn !== false ? ' checked' : '') + '> Show stroke separators</label></div>'
        + colorRow('tb-stroke', 'Stroke colour', TB.strokeColour || TB.stroke || '#ffffff', '#ffffff') + '</div>'
        + '<div class="row"><div class="f"><label>Top &amp; bottom stroke</label>'
        + '<label class="ck"><input type="checkbox" id="tb-edgeon"' + (TB.edgeOn !== false ? ' checked' : '') + '> Show top &amp; bottom strokes</label></div>'
        + colorRow('tb-edge', 'Edge stroke colour', TB.edgeColour || TB.edge || '#ffffff', '#ffffff') + '</div>'
        + '<div class="row">' + colorRow('tb-img-fg', 'Caption text colour', TB.fg || '#ffffff', '#ffffff') + '</div></div>';

      html += '<div class="card tb-ed-card"><h2 id="tb-list-title">' + (tbMode === 'images' ? 'Image tiles' : 'Trust badges') + '</h2>'
        + '<p class="lede" id="tb-list-lede">' + (tbMode === 'images'
          ? 'Each tile is an image with caption text overlaid at the bottom. Toggle, reorder, or add tiles — they share the full width evenly.'
          : 'The row of badges shown directly under your hero — on every layout. Toggle off any that don’t apply, edit the wording, reorder, or add your own.')
        + '</p><div id="tb-items"></div>'
        + '<button type="button" class="tb-ed-add" id="tb-add">+ Add item</button></div>';

      host.innerHTML = html;
      wire();
      drawItems();
    }

    function drawItems() {
      var box = host.querySelector('#tb-items');
      if (!box) return;
      var items = tb().badges;
      var images = tb().mode === 'images';
      if (!items.length) {
        box.innerHTML = '<p class="lede" style="opacity:.7">No items yet — add one to get started.</p>';
        return;
      }
      box.innerHTML = items.map(function (it, i) {
        return '<div class="tb-ed-item" data-i="' + i + '">'
          + '<div class="tb-ed-item-head">'
          + '<label class="ck"><input type="checkbox" data-k="on"' + (it.on !== false ? ' checked' : '') + '> Item ' + (i + 1) + '</label>'
          + '<span class="tb-ed-item-actions">'
          + '<button type="button" data-act="up" aria-label="Move up">↑</button>'
          + '<button type="button" data-act="dn" aria-label="Move down">↓</button>'
          + '<button type="button" data-act="rm" class="danger" aria-label="Remove">Remove</button>'
          + '</span></div>'
          + (images
            ? '<div class="f"><label>Tile image URL</label><input type="url" data-k="image" value="' + esc(it.image || '') + '" placeholder="https://…"></div>'
              + '<div class="row"><div class="f"><label>Image fit</label><select data-k="imageFit">'
              + [['cover', 'Cover (fill & crop)'], ['contain', 'Contain (fit, no crop)'], ['fill', 'Fill'], ['stretch', 'Stretch (distort)']]
                .map(function (o) { return '<option value="' + o[0] + '"' + ((it.imageFit || 'cover') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('')
              + '</select></div><div class="f"><label>Image position</label><select data-k="imagePos">'
              + [['center', 'Centre'], ['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right']]
                .map(function (o) { return '<option value="' + o[0] + '"' + ((it.imagePos || 'center') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('')
              + '</select></div></div>'
            : '')
          + '<div class="f"><label>Icon</label>'
          + (window.LPIconPicker
            ? window.LPIconPicker.controlHtml(it.icon || '', { inputAttrs: 'data-k="icon"' })
            : '<input type="text" data-k="icon" value="' + esc(it.icon || '') + '" placeholder="e.g. shield-check">')
          + '</div>'
          + '<div class="f"><label>Text (press Enter for a new line)</label><textarea data-k="label" rows="2">' + esc(it.label || '') + '</textarea></div>'
          + '</div>';
      }).join('');
      if (window.LPIconPicker) window.LPIconPicker.refresh(box);
    }

    function syncModeUi() {
      var images = tb().mode === 'images';
      var co = host.querySelector('#tb-classic-opts');
      var io = host.querySelector('#tb-image-opts');
      if (co) co.style.display = images ? 'none' : '';
      if (io) io.style.display = images ? '' : 'none';
      var h = host.querySelector('#tb-list-title');
      var p = host.querySelector('#tb-list-lede');
      if (h) h.textContent = images ? 'Image tiles' : 'Trust badges';
      if (p) {
        p.textContent = images
          ? 'Each tile is an image with caption text overlaid at the bottom. Toggle, reorder, or add tiles — they share the full width evenly.'
          : 'The row of badges shown directly under your hero — on every layout. Toggle off any that don’t apply, edit the wording, reorder, or add your own.';
      }
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
      var on = host.querySelector('#tb-on');
      if (on) on.addEventListener('change', function () { tb().on = on.checked; emit('Preview updated'); });

      var md = host.querySelector('#tb-mode');
      if (md) {
        md.value = tb().mode === 'images' ? 'images' : 'badges';
        md.addEventListener('change', function () {
          tb().mode = md.value;
          syncModeUi();
          drawItems();
          emit('Layout changed to ' + (md.value === 'images' ? 'image tiles' : 'text and icons'));
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
          emit('Preview updated');
        });
        box.addEventListener('click', function (e) {
          var btn = e.target.closest('[data-act]');
          if (!btn) return;
          var row = btn.closest('.tb-ed-item');
          var i = +row.getAttribute('data-i');
          var a = tb().badges;
          var act = btn.getAttribute('data-act');
          if (act === 'rm') {
            a.splice(i, 1);
            drawItems();
            emit('Item removed');
          } else if (act === 'up' && i > 0) {
            var x = a[i - 1]; a[i - 1] = a[i]; a[i] = x;
            drawItems();
            emit('Item reordered');
          } else if (act === 'dn' && i < a.length - 1) {
            var y = a[i + 1]; a[i + 1] = a[i]; a[i] = y;
            drawItems();
            emit('Item reordered');
          }
        });
      }
    }

    function setValue(next) {
      cfg = next || cfg;
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
