/**
 * Scrolling Sponsor Banner — marketplace playground editor.
 * Mirrors manage.html controls (content, tiles, motion, appearance).
 * marketplace-playground: temporary state only — never saves.
 */
(function (global) {
  'use strict';

  var Manage = global.LpSsbManage;

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

  function colorRow(id, label, value, placeholder) {
    var v = value || '';
    var pick = hexOk(v) || '#cccccc';
    return (
      '<div class="f tb-ed-f tb-ed-color-f"><label for="' + id + 't">' + esc(label) + '</label>'
      + '<div class="tb-ed-color">'
      + '<input type="color" id="' + id + '" value="' + esc(pick) + '" aria-label="' + esc(label) + ' colour">'
      + '<input type="text" id="' + id + 't" class="tin tb-ed-hex" maxlength="7" placeholder="' + esc(placeholder || 'Theme default') + '" value="' + esc(v) + '">'
      + '<button type="button" class="btn ghost sm tb-ed-clr" data-ssb-clr="' + id + '" title="Theme default">↺</button>'
      + '</div></div>'
    );
  }

  function sel(id, label, opts, cur) {
    return (
      '<div class="f"><label for="' + id + '">' + esc(label) + '</label><select id="' + id + '" class="tin">'
      + opts
        .map(function (o) {
          return (
            '<option value="' + esc(o[0]) + '"' + (String(cur) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'
          );
        })
        .join('')
      + '</select></div>'
    );
  }

  function field(id, label, html) {
    return '<div class="f"><label for="' + id + '">' + esc(label) + '</label>' + html + '</div>';
  }

  function defaultTile() {
    return Manage && Manage.defaultTile ? Manage.defaultTile() : { id: 'tile-' + Date.now(), name: 'New sponsor', enabled: true, image: '', contentMode: 'image', linkEnabled: false };
  }

  function ens(cfg) {
    if (Manage && Manage.ens) return Manage.ens(cfg);
    if (!cfg.sections) cfg.sections = {};
    if (!cfg.sections.scrollingSponsorBanner) {
      cfg.sections.scrollingSponsorBanner = { on: true, instances: [] };
    }
    return cfg.sections.scrollingSponsorBanner;
  }

  function mount(host, options) {
    options = options || {};
    var cfg = options.value || { sections: { scrollingSponsorBanner: { on: true, instances: [] } } };
    var onChange = typeof options.onChange === 'function' ? options.onChange : function () {};
    var announce = typeof options.onAnnounce === 'function' ? options.onAnnounce : function () {};
    var S = ens(cfg);
    if (S._selInst == null) S._selInst = 0;
    if (S._tab == null) S._tab = 'content';

    function emit(msg) {
      onChange(cfg);
      if (msg) announce(msg);
    }

    function selected() {
      if (!S.instances.length) {
        S.instances.push(Manage && Manage.defaultInstance ? Manage.defaultInstance('Sponsors') : { enabled: true, heading: {}, tiles: [], motion: {}, layout: {}, appearance: {} });
      }
      if (S._selInst < 0 || S._selInst >= S.instances.length) S._selInst = 0;
      return S.instances[S._selInst];
    }

    function tabButtons() {
      var tabs = [
        ['content', 'Content'],
        ['tiles', 'Tiles'],
        ['motion', 'Motion'],
        ['appearance', 'Look']
      ];
      return (
        '<div class="tb-ed-toolbar tb-ed-tabs" role="tablist" aria-label="Banner sections">'
        + tabs
          .map(function (t) {
            return (
              '<button type="button" class="tb-ed-tab' + (S._tab === t[0] ? ' on' : '') + '" data-ssb-tab="' + t[0] + '">' + esc(t[1]) + '</button>'
            );
          })
          .join('')
        + '</div>'
      );
    }

    function renderContent(inst) {
      var h = inst.heading || {};
      return (
        field('ssb-eyebrow', 'Eyebrow', '<input id="ssb-eyebrow" class="tin" value="' + esc(h.eyebrow || '') + '">')
        + field('ssb-title', 'Title', '<input id="ssb-title" class="tin" value="' + esc(h.title || '') + '">')
        + field('ssb-intro', 'Intro', '<textarea id="ssb-intro" class="tin" rows="2">' + esc(h.intro || '') + '</textarea>')
        + sel(
          'ssb-h-align',
          'Heading alignment',
          [
            ['left', 'Left'],
            ['center', 'Centre'],
            ['right', 'Right']
          ],
          h.align || 'center'
        )
        + field('ssb-h-max', 'Heading max width (px)', '<input id="ssb-h-max" class="tin" type="number" min="280" max="1200" value="' + esc(h.maxWidth != null ? h.maxWidth : 720) + '">')
        + '<div class="tb-ed-zone-label" style="margin-top:14px">Heading colours</div>'
        + colorRow('ssb-eyebrow-c', 'Eyebrow colour', h.eyebrowColor, 'Theme default')
        + colorRow('ssb-title-c', 'Title colour', h.titleColor, 'Theme default')
        + colorRow('ssb-intro-c', 'Intro colour', h.introColor, 'Theme default')
      );
    }

    function renderTiles(inst) {
      var tiles = inst.tiles || [];
      var list = tiles.length
        ? tiles
            .map(function (t, i) {
              var sample = t.image && global.LPLocalImage && global.LPLocalImage.isRemote(t.image) ? t.image : '';
              var imgCtl =
                global.LPLocalImage
                  ? global.LPLocalImage.controlHtml(t.image || '', {
                    field: 'image',
                    sample: sample,
                    label: 'Logo image',
                    inputAttrs: 'data-k="image"'
                  })
                  : field('ssb-img-' + i, 'Image URL', '<input class="tin" data-k="image" value="' + esc(t.image || '') + '">');
              return (
                '<div class="card tb-ed-item" data-ssb-tile="' + i + '" style="padding:12px;margin:0 0 10px">'
                + '<div class="tb-ed-items-head" style="margin-bottom:8px"><strong>' + esc(t.name || 'Sponsor') + '</strong>'
                + '<div style="display:flex;gap:6px">'
                + '<button type="button" class="btn ghost sm" data-ssb-up title="Move up">↑</button>'
                + '<button type="button" class="btn ghost sm" data-ssb-down title="Move down">↓</button>'
                + '<button type="button" class="btn ghost sm danger" data-ssb-del>Remove</button>'
                + '</div></div>'
                + field('ssb-name-' + i, 'Name', '<input class="tin" data-k="name" value="' + esc(t.name || '') + '">')
                + field('ssb-alt-' + i, 'Alt text', '<input class="tin" data-k="alt" value="' + esc(t.alt || '') + '">')
                + imgCtl
                + '</div>'
              );
            })
            .join('')
        : '<p class="tb-ed-app-hint">No tiles yet — add a logo to get started.</p>';
      return (
        '<div class="tb-ed-items-head"><h2>Sponsor logos</h2><button type="button" class="tb-ed-add" id="ssb-add-tile">+ Add logo</button></div>'
        + list
      );
    }

    function renderMotion(inst) {
      var m = inst.motion || {};
      var L = inst.layout || {};
      return (
        '<label class="ck f"><input type="checkbox" id="ssb-scrolling"' + (m.scrolling !== false ? ' checked' : '') + '> Continuous scrolling</label>'
        + '<label class="ck f"><input type="checkbox" id="ssb-static"' + (m.staticGrid ? ' checked' : '') + '> Static wrapping grid</label>'
        + sel('ssb-dir', 'Direction', [['left', 'Scroll left'], ['right', 'Scroll right']], m.direction || 'left')
        + field('ssb-speed', 'Speed (px/s)', '<input id="ssb-speed" class="tin" type="range" min="8" max="160" step="1" value="' + esc(m.speedPxPerSec != null ? m.speedPxPerSec : 40) + '"><span id="ssb-speed-label" style="margin-left:8px;font-weight:700">' + esc(m.speedPxPerSec != null ? m.speedPxPerSec : 40) + ' px/s</span>')
        + '<label class="ck f"><input type="checkbox" id="ssb-pause-hover"' + (m.pauseOnHover !== false ? ' checked' : '') + '> Pause on hover</label>'
        + '<label class="ck f"><input type="checkbox" id="ssb-pause-btn"' + (m.showPauseControl !== false ? ' checked' : '') + '> Show pause/play control</label>'
        + '<div class="tb-ed-zone-label" style="margin-top:12px">Tile sizing</div>'
        + field('ssb-h-d', 'Logo height desktop (px)', '<input id="ssb-h-d" class="tin" type="number" min="40" max="320" value="' + esc(L.imageHeightDesktop != null ? L.imageHeightDesktop : 120) + '">')
        + field('ssb-h-m', 'Logo height mobile (px)', '<input id="ssb-h-m" class="tin" type="number" min="40" max="240" value="' + esc(L.imageHeightMobile != null ? L.imageHeightMobile : 88) + '">')
        + field('ssb-w-d', 'Tile width desktop (px)', '<input id="ssb-w-d" class="tin" type="number" min="60" max="480" value="' + esc(L.tileWidthDesktop != null ? L.tileWidthDesktop : 200) + '">')
        + field('ssb-w-m', 'Tile width mobile (px)', '<input id="ssb-w-m" class="tin" type="number" min="60" max="360" value="' + esc(L.tileWidthMobile != null ? L.tileWidthMobile : 150) + '">')
        + sel(
          'ssb-fit',
          'Image fit',
          [
            ['contain', 'Contain'],
            ['cover', 'Cover'],
            ['stretch', 'Stretch'],
            ['natural', 'Natural size'],
            ['scale_down', 'Scale down only']
          ],
          L.imageFit || 'contain'
        )
      );
    }

    function renderAppearance(inst) {
      var a = inst.appearance || {};
      return (
        colorRow('ssb-sec-bg', 'Section background', a.sectionBg, 'Transparent')
        + colorRow('ssb-tile-bg', 'Tile background', a.tileBg, 'Transparent')
        + field('ssb-radius', 'Corner radius (px)', '<input id="ssb-radius" class="tin" type="number" min="0" max="40" value="' + esc(a.radius != null ? a.radius : 0) + '">')
        + field('ssb-pt', 'Padding top (px)', '<input id="ssb-pt" class="tin" type="number" min="0" max="120" value="' + esc(a.padTop != null ? a.padTop : 24) + '">')
        + field('ssb-pb', 'Padding bottom (px)', '<input id="ssb-pb" class="tin" type="number" min="0" max="120" value="' + esc(a.padBottom != null ? a.padBottom : 24) + '">')
        + '<label class="ck f"><input type="checkbox" id="ssb-grey"' + (a.greyscaleHover ? ' checked' : '') + '> Greyscale logos (colour on hover)</label>'
        + '<label class="ck f"><input type="checkbox" id="ssb-fade"' + (a.edgeFade ? ' checked' : '') + '> Edge fades</label>'
        + '<label class="ck f"><input type="checkbox" id="ssb-full"' + (a.fullWidth !== false ? ' checked' : '') + '> Full width</label>'
      );
    }

    function renderPanel() {
      var inst = selected();
      if (S._tab === 'content') return renderContent(inst);
      if (S._tab === 'tiles') return renderTiles(inst);
      if (S._tab === 'motion') return renderMotion(inst);
      return renderAppearance(inst);
    }

    function render() {
      host.className = host.className
        .split(/\s+/)
        .filter(function (c) {
          return c && c !== 'tb-ed-root' && c !== 'tb-ed-compact' && c !== 'tb-ed-stack';
        })
        .join(' ');
      host.classList.add('tb-ed-root', 'tb-ed-compact', 'tb-ed-stack');

      host.innerHTML =
        '<div class="tb-ed-banner tb-ed-banner-safe">Have a play. Nothing here will be saved.</div>'
        + tabButtons()
        + '<div class="card tb-ed-card tb-ed-card-tight" id="ssb-panel">' + renderPanel() + '</div>';

      wire();
      if (global.LPLocalImage) global.LPLocalImage.refresh(host);
    }

    function wireColorField(id, obj, key) {
      var pick = host.querySelector('#' + id);
      var text = host.querySelector('#' + id + 't');
      function syncFromText() {
        if (!text) return;
        obj[key] = String(text.value || '').trim();
        if (pick && hexOk(obj[key])) pick.value = hexOk(obj[key]);
        emit();
      }
      function syncFromPick() {
        if (!pick || !text) return;
        text.value = pick.value;
        obj[key] = pick.value;
        emit();
      }
      if (text) {
        text.addEventListener('change', syncFromText);
        text.addEventListener('input', syncFromText);
      }
      if (pick) {
        pick.addEventListener('input', syncFromPick);
        pick.addEventListener('change', syncFromPick);
      }
      host.querySelectorAll('[data-ssb-clr="' + id + '"]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          obj[key] = '';
          if (text) text.value = '';
          emit('Colour reset');
        });
      });
    }

    function bind(id, fn) {
      var el = host.querySelector('#' + id);
      if (!el) return;
      el.addEventListener('change', fn);
      el.addEventListener('input', fn);
    }

    function wire() {
      var inst = selected();
      if (!inst.heading) inst.heading = {};
      if (!inst.motion) inst.motion = {};
      if (!inst.layout) inst.layout = {};
      if (!inst.appearance) inst.appearance = {};
      if (!inst.tiles) inst.tiles = [];

      host.querySelectorAll('[data-ssb-tab]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          S._tab = btn.getAttribute('data-ssb-tab');
          render();
        });
      });

      if (S._tab === 'content') {
        bind('ssb-eyebrow', function () {
          inst.heading.eyebrow = host.querySelector('#ssb-eyebrow').value;
          emit();
        });
        bind('ssb-title', function () {
          inst.heading.title = host.querySelector('#ssb-title').value;
          emit();
        });
        bind('ssb-intro', function () {
          inst.heading.intro = host.querySelector('#ssb-intro').value;
          emit();
        });
        bind('ssb-h-align', function () {
          inst.heading.align = host.querySelector('#ssb-h-align').value;
          emit();
        });
        bind('ssb-h-max', function () {
          inst.heading.maxWidth = Number(host.querySelector('#ssb-h-max').value) || 720;
          emit();
        });
        wireColorField('ssb-eyebrow-c', inst.heading, 'eyebrowColor');
        wireColorField('ssb-title-c', inst.heading, 'titleColor');
        wireColorField('ssb-intro-c', inst.heading, 'introColor');
      }

      if (S._tab === 'tiles') {
        var add = host.querySelector('#ssb-add-tile');
        if (add) {
          add.addEventListener('click', function () {
            inst.tiles.push(defaultTile());
            emit('Logo added');
            render();
          });
        }
        host.querySelectorAll('[data-ssb-tile]').forEach(function (card) {
          var i = Number(card.getAttribute('data-ssb-tile'));
          if (global.LPLocalImage) {
            global.LPLocalImage.rememberSample(inst.tiles[i], 'image');
            var sample = inst.tiles[i].image && global.LPLocalImage.isRemote(inst.tiles[i].image) ? inst.tiles[i].image : '';
            var ctl = card.querySelector('[data-lp-locimg]');
            if (ctl) global.LPLocalImage.applyValues(ctl, inst.tiles[i].image || '', sample);
          }
          card.querySelectorAll('[data-k]').forEach(function (el) {
            function sync() {
              inst.tiles[i][el.getAttribute('data-k')] = el.type === 'checkbox' ? el.checked : el.value;
              emit();
            }
            el.addEventListener('change', sync);
            el.addEventListener('input', sync);
          });
          var up = card.querySelector('[data-ssb-up]');
          var down = card.querySelector('[data-ssb-down]');
          var del = card.querySelector('[data-ssb-del]');
          if (up) {
            up.addEventListener('click', function () {
              if (i <= 0) return;
              var tmp = inst.tiles[i - 1];
              inst.tiles[i - 1] = inst.tiles[i];
              inst.tiles[i] = tmp;
              emit();
              render();
            });
          }
          if (down) {
            down.addEventListener('click', function () {
              if (i >= inst.tiles.length - 1) return;
              var tmp = inst.tiles[i + 1];
              inst.tiles[i + 1] = inst.tiles[i];
              inst.tiles[i] = tmp;
              emit();
              render();
            });
          }
          if (del) {
            del.addEventListener('click', function () {
              inst.tiles.splice(i, 1);
              emit('Logo removed');
              render();
            });
          }
        });
      }

      if (S._tab === 'motion') {
        bind('ssb-scrolling', function () {
          inst.motion.scrolling = host.querySelector('#ssb-scrolling').checked;
          emit();
        });
        bind('ssb-static', function () {
          inst.motion.staticGrid = host.querySelector('#ssb-static').checked;
          emit();
        });
        bind('ssb-dir', function () {
          inst.motion.direction = host.querySelector('#ssb-dir').value;
          emit();
        });
        bind('ssb-speed', function () {
          inst.motion.speedPxPerSec = Number(host.querySelector('#ssb-speed').value) || 40;
          var lab = host.querySelector('#ssb-speed-label');
          if (lab) lab.textContent = inst.motion.speedPxPerSec + ' px/s';
          emit();
        });
        bind('ssb-pause-hover', function () {
          inst.motion.pauseOnHover = host.querySelector('#ssb-pause-hover').checked;
          emit();
        });
        bind('ssb-pause-btn', function () {
          inst.motion.showPauseControl = host.querySelector('#ssb-pause-btn').checked;
          emit();
        });
        [
          ['ssb-h-d', 'imageHeightDesktop'],
          ['ssb-h-m', 'imageHeightMobile'],
          ['ssb-w-d', 'tileWidthDesktop'],
          ['ssb-w-m', 'tileWidthMobile']
        ].forEach(function (pair) {
          bind(pair[0], function () {
            inst.layout[pair[1]] = Number(host.querySelector('#' + pair[0]).value);
            emit();
          });
        });
        bind('ssb-fit', function () {
          inst.layout.imageFit = host.querySelector('#ssb-fit').value;
          emit();
        });
      }

      if (S._tab === 'appearance') {
        wireColorField('ssb-sec-bg', inst.appearance, 'sectionBg');
        wireColorField('ssb-tile-bg', inst.appearance, 'tileBg');
        bind('ssb-radius', function () {
          inst.appearance.radius = Number(host.querySelector('#ssb-radius').value) || 0;
          emit();
        });
        bind('ssb-pt', function () {
          inst.appearance.padTop = Number(host.querySelector('#ssb-pt').value);
          emit();
        });
        bind('ssb-pb', function () {
          inst.appearance.padBottom = Number(host.querySelector('#ssb-pb').value);
          emit();
        });
        bind('ssb-grey', function () {
          inst.appearance.greyscaleHover = host.querySelector('#ssb-grey').checked;
          emit();
        });
        bind('ssb-fade', function () {
          inst.appearance.edgeFade = host.querySelector('#ssb-fade').checked;
          emit();
        });
        bind('ssb-full', function () {
          inst.appearance.fullWidth = host.querySelector('#ssb-full').checked;
          emit();
        });
      }
    }

    render();

    return {
      setValue: function (next) {
        cfg = next || cfg;
        S = ens(cfg);
        render();
      },
      getValue: function () {
        return cfg;
      }
    };
  }

  global.LPScrollingSponsorBannerEditor = {
    mount: mount,
    MODES: { MARKETPLACE_PLAYGROUND: 'marketplace-playground' }
  };
})(typeof window !== 'undefined' ? window : globalThis);
