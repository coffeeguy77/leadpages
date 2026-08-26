/**
 * Scrolling Sponsor Banner — manage.html / Page Editor UI.
 * Uses shared public renderer (LpScrollingSponsorBanner) for live preview.
 */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function uid(prefix) {
    return (prefix || 'ssb') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function defaultTile() {
    return {
      id: uid('tile'),
      name: 'New sponsor',
      image: '',
      imagePid: '',
      alt: '',
      linkLabel: '',
      enabled: true,
      linkEnabled: false,
      linkUrl: '',
      contentMode: 'image',
      text: '',
      textColor: '',
      textSize: 14,
      textAlign: 'center',
      textBg: '',
      overlayTint: '#000000',
      overlayOpacity: 0.35,
      textPad: 8,
      overlayV: 'bottom',
      overlayH: 'center',
      widthOverride: null,
      startAt: null,
      endAt: null,
      imageFit: '',
      imagePos: ''
    };
  }

  function defaultInstance(name) {
    return {
      id: uid('inst'),
      adminName: name || 'Sponsors',
      enabled: true,
      bannerLinksEnabled: true,
      heading: {
        eyebrow: '',
        title: '',
        intro: '',
        align: 'center',
        maxWidth: 720,
        gap: 16,
        eyebrowColor: '',
        titleColor: '',
        introColor: ''
      },
      tiles: [],
      motion: {
        scrolling: true,
        direction: 'left',
        speedPxPerSec: 40,
        pauseOnHover: true,
        showPauseControl: true,
        staticGrid: false
      },
      layout: {
        imageHeightDesktop: 120,
        imageHeightMobile: 88,
        tileWidthDesktop: 200,
        tileWidthMobile: 150,
        gapDesktop: 24,
        gapMobile: 16,
        tilePadding: 16,
        imageFit: 'contain',
        imagePos: 'center'
      },
      appearance: {
        sectionBg: '',
        tileBg: '',
        borderColor: '',
        borderWidth: 0,
        radius: 0,
        shadow: false,
        greyscaleHover: false,
        edgeFade: false,
        edgeFadeWidth: 48,
        fullWidth: true,
        padTop: 24,
        padBottom: 24
      }
    };
  }

  function ens(c) {
    if (!c.sections) c.sections = {};
    if (!c.sections.scrollingSponsorBanner || typeof c.sections.scrollingSponsorBanner !== 'object') {
      c.sections.scrollingSponsorBanner = { on: false, instances: [defaultInstance('Major Sponsors')] };
    }
    var S = c.sections.scrollingSponsorBanner;
    if (!Array.isArray(S.instances) || !S.instances.length) {
      if (Array.isArray(S.tiles)) {
        var inst = defaultInstance(S.adminName || 'Sponsors');
        inst.tiles = S.tiles;
        S.instances = [inst];
      } else {
        S.instances = [defaultInstance('Major Sponsors')];
      }
    }
    return S;
  }

  function scheduleLabel(tile) {
    if (tile.enabled === false) return 'Hidden';
    var now = Date.now();
    var start = tile.startAt ? Date.parse(tile.startAt) : null;
    var end = tile.endAt ? Date.parse(tile.endAt) : null;
    if (start && isFinite(start) && now < start) return 'Scheduled';
    if (end && isFinite(end) && now > end) return 'Expired';
    return 'Active';
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
      '<div class="field" style="margin:0 0 12px">' +
      '<span class="field-hint" style="display:block;margin:0 0 6px">' +
      esc(label) +
      '</span>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">' +
      '<input type="color" id="' +
      id +
      '" value="' +
      esc(pick) +
      '" aria-label="' +
      esc(label) +
      '" style="width:44px;height:38px;padding:2px;border:1px solid var(--line,#ddd);border-radius:8px;background:#fff;cursor:pointer">' +
      '<input type="text" id="' +
      id +
      't" placeholder="' +
      esc(placeholder || '#… or blank') +
      '" value="' +
      esc(v) +
      '" style="flex:1;min-width:120px;max-width:220px">' +
      '<button type="button" class="btn ghost sm" data-ssb-clr="' +
      id +
      '" title="Clear to theme default">↺</button>' +
      '</div></div>'
    );
  }

  function render(body, c, api) {
    api = api || {};
    var persist = api.persist || function () {};
    var previewApply = api.previewApply || function () {};
    var cwUpload = api.cwUpload;
    var secCard = api.secCard;
    var wireSec = api.wireSec;
    var S = ens(c);
    if (S._selInst == null) S._selInst = 0;
    if (S._tab == null) S._tab = 'content';

    function selected() {
      if (S._selInst < 0 || S._selInst >= S.instances.length) S._selInst = 0;
      return S.instances[S._selInst];
    }

    function save() {
      persist();
      previewApply();
      paintPreview();
    }

    function paintPreview() {
      var host = body.querySelector('#ssb-live-preview');
      if (!host || !global.LpScrollingSponsorBanner) return;
      var snap = {
        on: true,
        instances: S.instances.filter(function (inst, i) {
          return i === S._selInst && inst.enabled !== false;
        })
      };
      if (!snap.instances.length && S.instances[S._selInst]) {
        snap.instances = [Object.assign({}, S.instances[S._selInst], { enabled: true })];
      }
      global.LpScrollingSponsorBanner.mount(host, snap, { preview: true, showAllTiles: !!S._showAll });
    }

    function field(label, html) {
      return '<label class="field" style="display:block;margin:0 0 10px"><span class="field-hint" style="display:block;margin:0 0 4px">' + esc(label) + '</span>' + html + '</label>';
    }

    function modeSeg(items, activeVal, dataAttr, extraStyle) {
      return (
        '<div class="sec-modeseg"' + (extraStyle ? ' style="' + extraStyle + '"' : '') + '>' +
        items
          .map(function (it) {
            var val = it[0];
            var label = it[1];
            return (
              '<button type="button" ' +
              dataAttr +
              '="' +
              esc(val) +
              '" class="' +
              (String(activeVal) === String(val) ? 'on' : '') +
              '">' +
              esc(label) +
              '</button>'
            );
          })
          .join('') +
        '</div>'
      );
    }

    function draw() {
      var inst = selected();
      if (S._prevMode == null) S._prevMode = 'desktop';
      var tabs = [
        ['content', 'Content'],
        ['tiles', 'Tiles'],
        ['motion', 'Motion & Layout'],
        ['appearance', 'Appearance'],
        ['reporting', 'Reporting']
      ];
      var tabBtns = modeSeg(tabs, S._tab, 'data-ssb-tab', 'margin:16px 0 18px;flex-wrap:wrap');

      var instItems = S.instances.map(function (instRow, i) {
        return [String(i), (instRow.adminName || 'Banner') + (instRow.enabled === false ? ' (off)' : '')];
      });
      var instList = modeSeg(instItems, String(S._selInst), 'data-ssb-inst', 'margin:0 0 16px;flex-wrap:wrap');

      var panel = '';
      if (S._tab === 'content') {
        var h = inst.heading || {};
        panel =
          field('Internal admin name', '<input id="ssb-admin-name" value="' + esc(inst.adminName || '') + '" style="width:100%;max-width:420px">') +
          '<label class="field" style="display:flex;gap:8px;align-items:center;margin:0 0 12px"><input type="checkbox" id="ssb-inst-enabled"' + (inst.enabled !== false ? ' checked' : '') + '> Banner enabled</label>' +
          '<label class="field" style="display:flex;gap:8px;align-items:center;margin:0 0 12px"><input type="checkbox" id="ssb-banner-links"' + (inst.bannerLinksEnabled !== false ? ' checked' : '') + '> Allow sponsor links (banner-level)</label>' +
          '<h3 style="margin:16px 0 8px;font-size:1rem">Section heading</h3>' +
          field('Eyebrow', '<input id="ssb-eyebrow" value="' + esc(h.eyebrow || '') + '" style="width:100%">') +
          field('Title', '<input id="ssb-title" value="' + esc(h.title || '') + '" style="width:100%">') +
          field('Intro', '<textarea id="ssb-intro" rows="2" style="width:100%">' + esc(h.intro || '') + '</textarea>') +
          field(
            'Heading alignment',
            '<select id="ssb-h-align"><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select>'
          ) +
          field('Heading max width (px)', '<input id="ssb-h-max" type="number" min="280" max="1200" value="' + esc(h.maxWidth || 720) + '">') +
          field('Heading → banner gap (px)', '<input id="ssb-h-gap" type="number" min="0" max="80" value="' + esc(h.gap != null ? h.gap : 16) + '">') +
          '<h3 style="margin:18px 0 6px;font-size:1rem">Heading colours</h3>' +
          '<p class="lede" style="margin:0 0 10px;font-size:12px">Leave blank to inherit theme text colours.</p>' +
          colorRow('ssb-eyebrow-c', 'Eyebrow colour', h.eyebrowColor, 'Theme default') +
          colorRow('ssb-title-c', 'Title colour', h.titleColor, 'Theme default') +
          colorRow('ssb-intro-c', 'Intro colour', h.introColor, 'Theme default');
      } else if (S._tab === 'tiles') {
        var tiles = inst.tiles || [];
        panel =
          '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 12px">' +
          '<button type="button" class="btn ghost" id="ssb-add-tile" style="margin-top:2px">+ Add Image</button>' +
          '<button type="button" class="btn ghost sm" id="ssb-bulk-upload">Bulk upload</button>' +
          '<input type="file" id="ssb-bulk-file" accept="image/*" multiple hidden>' +
          '<label style="display:inline-flex;gap:6px;align-items:center;font-size:13px;font-weight:500"><input type="checkbox" id="ssb-show-all"' + (S._showAll ? ' checked' : '') + '> Preview all tiles (ignore schedule)</label>' +
          '</div>' +
          '<div id="ssb-tile-list">' +
          (tiles.length
            ? tiles
                .map(function (t, i) {
                  return (
                    '<div class="card" data-ssb-tile-i="' + i + '" style="margin:0 0 10px;padding:12px">' +
                    '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between">' +
                    '<strong>' + esc(t.name || 'Tile') + '</strong>' +
                    '<span class="badge muted">' + esc(scheduleLabel(t)) + '</span></div>' +
                    '<div style="display:flex;gap:10px;margin-top:8px;align-items:flex-start">' +
                    (t.image
                      ? '<img src="' + esc(t.image) + '" alt="" style="width:72px;height:48px;object-fit:contain;border:1px solid var(--line,#ddd);border-radius:8px;background:#fff">'
                      : '<div style="width:72px;height:48px;border:1px dashed var(--line);border-radius:8px"></div>') +
                    '<div style="flex:1;min-width:0;display:grid;gap:6px">' +
                    '<input data-k="name" value="' + esc(t.name || '') + '" placeholder="Internal name">' +
                    '<input data-k="alt" value="' + esc(t.alt || '') + '" placeholder="Alt text">' +
                    '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
                    '<button type="button" class="btn ghost" data-ssb-up style="padding:4px 8px;font-size:13px" title="Move up" aria-label="Move up">↑</button>' +
                    '<button type="button" class="btn ghost" data-ssb-down style="padding:4px 8px;font-size:13px" title="Move down" aria-label="Move down">↓</button>' +
                    '<button type="button" class="btn ghost sm" data-ssb-dup>Duplicate</button>' +
                    '<button type="button" class="btn ghost sm" data-ssb-replace>Replace image</button>' +
                    '<button type="button" class="btn ghost danger" data-ssb-del style="padding:4px 9px;font-size:13px">Remove</button>' +
                    '<input type="file" accept="image/*" data-ssb-file hidden>' +
                    '</div>' +
                    '<details><summary>Link, text &amp; schedule</summary>' +
                    '<label style="display:flex;gap:6px;align-items:center;margin:6px 0"><input type="checkbox" data-k="enabled"' + (t.enabled !== false ? ' checked' : '') + '> Enabled</label>' +
                    '<label style="display:flex;gap:6px;align-items:center;margin:6px 0"><input type="checkbox" data-k="linkEnabled"' + (t.linkEnabled ? ' checked' : '') + '> Link enabled</label>' +
                    '<input data-k="linkUrl" value="' + esc(t.linkUrl || '') + '" placeholder="https://…" style="width:100%;margin:4px 0">' +
                    '<input data-k="linkLabel" value="' + esc(t.linkLabel || '') + '" placeholder="Accessible link label" style="width:100%;margin:4px 0">' +
                    '<select data-k="contentMode" style="margin:4px 0"><option value="image">Logo/image only</option><option value="overlay">Image + overlay text</option><option value="caption">Image + text below</option></select>' +
                    '<input data-k="text" value="' + esc(t.text || '') + '" placeholder="Overlay / caption text" style="width:100%;margin:4px 0">' +
                    '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:4px 0">' +
                    '<label>Start <input type="datetime-local" data-k="startAt" value="' + esc(t.startAt ? String(t.startAt).slice(0, 16) : '') + '"></label>' +
                    '<label>End <input type="datetime-local" data-k="endAt" value="' + esc(t.endAt ? String(t.endAt).slice(0, 16) : '') + '"></label>' +
                    '</div>' +
                    '<p class="lede" style="margin:4px 0 0;font-size:12px">Times use the site timezone configured in site settings.</p>' +
                    '</details></div></div></div>'
                  );
                })
                .join('')
            : '<p class="lede">No tiles yet — add images to get started.</p>') +
          '</div>';
      } else if (S._tab === 'motion') {
        var m = inst.motion || {};
        var L = inst.layout || {};
        panel =
          '<label class="field" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ssb-scrolling"' + (m.scrolling !== false ? ' checked' : '') + '> Continuous scrolling</label>' +
          '<label class="field" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ssb-static"' + (m.staticGrid ? ' checked' : '') + '> Static wrapping grid</label>' +
          field(
            'Direction',
            '<select id="ssb-dir"><option value="left">Left</option><option value="right">Right</option></select>'
          ) +
          field(
            'Speed preset',
            '<select id="ssb-speed-preset"><option value="20">Slow (20 px/s)</option><option value="40">Medium (40 px/s)</option><option value="70">Fast (70 px/s)</option></select>'
          ) +
          field('Speed (px/s)', '<input id="ssb-speed" type="range" min="8" max="160" step="1" value="' + esc(m.speedPxPerSec || 40) + '"><span id="ssb-speed-label" style="margin-left:8px;font-weight:700">' + esc(m.speedPxPerSec || 40) + ' px/s</span>') +
          field('Speed (numeric)', '<input id="ssb-speed-num" type="number" min="8" max="160" value="' + esc(m.speedPxPerSec || 40) + '">') +
          '<label class="field" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ssb-pause-hover"' + (m.pauseOnHover !== false ? ' checked' : '') + '> Pause on hover</label>' +
          '<label class="field" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ssb-pause-btn"' + (m.showPauseControl !== false ? ' checked' : '') + '> Visible pause/play control</label>' +
          '<h3 style="margin:16px 0 8px;font-size:1rem">Layout</h3>' +
          field('Image height desktop (px)', '<input id="ssb-h-d" type="number" min="40" max="320" value="' + esc(L.imageHeightDesktop || 120) + '">') +
          field('Image height mobile (px)', '<input id="ssb-h-m" type="number" min="40" max="240" value="' + esc(L.imageHeightMobile || 88) + '">') +
          field('Tile width desktop (px)', '<input id="ssb-w-d" type="number" min="60" max="480" value="' + esc(L.tileWidthDesktop || 200) + '">') +
          field('Tile width mobile (px)', '<input id="ssb-w-m" type="number" min="60" max="360" value="' + esc(L.tileWidthMobile || 150) + '">') +
          field('Gap desktop (px)', '<input id="ssb-g-d" type="number" min="0" max="80" value="' + esc(L.gapDesktop != null ? L.gapDesktop : 24) + '">') +
          field('Gap mobile (px)', '<input id="ssb-g-m" type="number" min="0" max="60" value="' + esc(L.gapMobile != null ? L.gapMobile : 16) + '">') +
          field('Tile padding (px)', '<input id="ssb-pad" type="number" min="0" max="48" value="' + esc(L.tilePadding != null ? L.tilePadding : 16) + '">') +
          field(
            'Image fit',
            '<select id="ssb-fit"><option value="contain">Contain</option><option value="cover">Cover</option><option value="stretch">Stretch</option><option value="natural">Natural size</option><option value="scale_down">Scale down only</option></select>'
          ) +
          field(
            'Image position',
            '<select id="ssb-pos"><option value="center">Centre</option><option value="top">Top</option><option value="bottom">Bottom</option><option value="left">Left</option><option value="right">Right</option><option value="top left">Top left</option><option value="top right">Top right</option><option value="bottom left">Bottom left</option><option value="bottom right">Bottom right</option></select>'
          );
      } else if (S._tab === 'appearance') {
        var a = inst.appearance || {};
        panel =
          field('Section background (blank = transparent)', '<input id="ssb-sec-bg" value="' + esc(a.sectionBg || '') + '" placeholder="#… or empty">') +
          field('Tile background', '<input id="ssb-tile-bg" value="' + esc(a.tileBg || '') + '" placeholder="transparent">') +
          field('Border colour', '<input id="ssb-border-c" value="' + esc(a.borderColor || '') + '">') +
          field('Border width', '<input id="ssb-border-w" type="number" min="0" max="8" value="' + esc(a.borderWidth || 0) + '">') +
          field('Corner radius', '<input id="ssb-radius" type="number" min="0" max="40" value="' + esc(a.radius || 0) + '">') +
          '<label class="field" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ssb-shadow"' + (a.shadow ? ' checked' : '') + '> Shadow</label>' +
          '<label class="field" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ssb-grey"' + (a.greyscaleHover ? ' checked' : '') + '> Greyscale logos (colour on hover/focus)</label>' +
          '<label class="field" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ssb-full"' + (a.fullWidth !== false ? ' checked' : '') + '> Full width</label>' +
          '<label class="field" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ssb-fade"' + (a.edgeFade ? ' checked' : '') + '> Edge fades</label>' +
          field('Edge fade width', '<input id="ssb-fade-w" type="number" min="8" max="120" value="' + esc(a.edgeFadeWidth || 48) + '">') +
          field('Padding top', '<input id="ssb-pt" type="number" min="0" max="120" value="' + esc(a.padTop != null ? a.padTop : 24) + '">') +
          field('Padding bottom', '<input id="ssb-pb" type="number" min="0" max="120" value="' + esc(a.padBottom != null ? a.padBottom : 24) + '">') +
          '<button type="button" class="btn ghost" id="ssb-reset-appearance" style="margin-top:8px">Reset appearance to defaults</button>';
      } else {
        panel =
          '<p class="lede">Sponsor link clicks are recorded as <code>cta_click</code> with <code>location: scrollingSponsorBanner</code>, plus banner and tile IDs. Previews, swipes, disabled links and hovers are not counted.</p>' +
          '<div class="row" style="margin:0 0 10px;gap:10px;flex-wrap:wrap">' +
          field(
            'Date range',
            '<select id="ssb-report-days"><option value="7">Last 7 days</option><option value="30" selected>Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last year</option></select>'
          ) +
          '<button type="button" class="btn ghost sm" id="ssb-report-refresh" style="align-self:flex-end">Refresh</button>' +
          '</div>' +
          '<div id="ssb-report-box" class="card" style="padding:12px"><p class="lede" style="margin:0">Loading…</p></div>';
      }

      var head =
        (typeof secCard === 'function'
          ? secCard(c, 'scrollingSponsorBanner', 'Scrolling Sponsor Banner', true, [])
          : '<div class="card"><h2>Scrolling Sponsor Banner</h2></div>') +
        '<div class="card" style="margin-top:12px">' +
        '<p class="lede" style="margin:0 0 10px">Independent banners (e.g. Major Sponsors, Community Partners). Place the section with <strong>Position</strong>.</p>' +
        '<div style="margin:0 0 6px">' +
        instList +
        '<button type="button" class="btn ghost" id="ssb-add-inst" style="margin:10px 0 4px">+ New banner</button></div>' +
        tabBtns +
        '<div id="ssb-panel">' +
        panel +
        '</div></div>' +
        '<div class="card" style="margin-top:12px"><h3 style="margin:0 0 8px">Live preview</h3>' +
        modeSeg(
          [
            ['desktop', 'Desktop'],
            ['mobile', 'Mobile']
          ],
          S._prevMode,
          'data-ssb-prev',
          'margin:0 0 10px'
        ) +
        '<div id="ssb-live-preview" class="ssb-section" style="border:1px solid var(--line,#e6e2da);border-radius:12px;overflow:hidden;min-height:120px;background:var(--bg,#f6f4ef)"></div></div>';

      body.innerHTML = head;
      if (typeof wireSec === 'function') wireSec(c, 'scrollingSponsorBanner', true, []);

      // Set select values
      var setVal = function (id, v) {
        var el = body.querySelector('#' + id);
        if (el && v != null) el.value = v;
      };
      if (S._tab === 'content') setVal('ssb-h-align', (inst.heading && inst.heading.align) || 'center');
      if (S._tab === 'motion') {
        setVal('ssb-dir', (inst.motion && inst.motion.direction) || 'left');
        setVal('ssb-fit', (inst.layout && inst.layout.imageFit) || 'contain');
        setVal('ssb-pos', (inst.layout && inst.layout.imagePos) || 'center');
        var sp = String((inst.motion && inst.motion.speedPxPerSec) || 40);
        setVal('ssb-speed-preset', ['20', '40', '70'].indexOf(sp) >= 0 ? sp : '40');
      }
      if (S._tab === 'tiles') {
        body.querySelectorAll('[data-ssb-tile-i]').forEach(function (card) {
          var i = Number(card.getAttribute('data-ssb-tile-i'));
          var t = inst.tiles[i];
          if (!t) return;
          var sel = card.querySelector('[data-k="contentMode"]');
          if (sel) sel.value = t.contentMode || 'image';
        });
      }

      wire();
      paintPreview();
    }

    function wire() {
      body.querySelectorAll('[data-ssb-tab]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          S._tab = btn.getAttribute('data-ssb-tab');
          draw();
        });
      });
      body.querySelectorAll('[data-ssb-inst]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          S._selInst = Number(btn.getAttribute('data-ssb-inst')) || 0;
          draw();
        });
      });
      var addInst = body.querySelector('#ssb-add-inst');
      if (addInst) {
        addInst.addEventListener('click', function () {
          S.instances.push(defaultInstance('Banner ' + (S.instances.length + 1)));
          S._selInst = S.instances.length - 1;
          save();
          draw();
        });
      }

      var inst = selected();

      function bind(id, fn) {
        var el = body.querySelector('#' + id);
        if (!el) return;
        el.addEventListener('change', fn);
        el.addEventListener('input', fn);
      }

      function wireColorField(id, key) {
        var pick = body.querySelector('#' + id);
        var text = body.querySelector('#' + id + 't');
        if (!inst.heading) inst.heading = {};
        function syncFromText() {
          if (!text) return;
          var v = String(text.value || '').trim();
          inst.heading[key] = v;
          if (pick && hexOk(v)) pick.value = hexOk(v);
          save();
        }
        function syncFromPick() {
          if (!pick || !text) return;
          text.value = pick.value;
          inst.heading[key] = pick.value;
          save();
        }
        if (text) {
          text.addEventListener('change', syncFromText);
          text.addEventListener('input', syncFromText);
        }
        if (pick) {
          pick.addEventListener('input', syncFromPick);
          pick.addEventListener('change', syncFromPick);
        }
        body.querySelectorAll('[data-ssb-clr="' + id + '"]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            inst.heading[key] = '';
            if (text) text.value = '';
            save();
          });
        });
      }

      if (S._tab === 'content') {
        bind('ssb-admin-name', function () {
          inst.adminName = body.querySelector('#ssb-admin-name').value;
          save();
        });
        bind('ssb-inst-enabled', function () {
          inst.enabled = body.querySelector('#ssb-inst-enabled').checked;
          save();
        });
        bind('ssb-banner-links', function () {
          inst.bannerLinksEnabled = body.querySelector('#ssb-banner-links').checked;
          save();
        });
        ['eyebrow', 'title', 'intro'].forEach(function (k) {
          bind('ssb-' + (k === 'intro' ? 'intro' : k === 'title' ? 'title' : 'eyebrow'), function () {
            if (!inst.heading) inst.heading = {};
            var map = { eyebrow: 'ssb-eyebrow', title: 'ssb-title', intro: 'ssb-intro' };
            inst.heading[k] = body.querySelector('#' + map[k]).value;
            save();
          });
        });
        bind('ssb-h-align', function () {
          inst.heading.align = body.querySelector('#ssb-h-align').value;
          save();
        });
        bind('ssb-h-max', function () {
          inst.heading.maxWidth = Number(body.querySelector('#ssb-h-max').value) || 720;
          save();
        });
        bind('ssb-h-gap', function () {
          inst.heading.gap = Number(body.querySelector('#ssb-h-gap').value) || 0;
          save();
        });
        wireColorField('ssb-eyebrow-c', 'eyebrowColor');
        wireColorField('ssb-title-c', 'titleColor');
        wireColorField('ssb-intro-c', 'introColor');
      }

      if (S._tab === 'tiles') {
        var add = body.querySelector('#ssb-add-tile');
        var bulk = body.querySelector('#ssb-bulk-upload');
        var bulkFile = body.querySelector('#ssb-bulk-file');
        if (add) {
          add.addEventListener('click', function () {
            if (!cwUpload) {
              inst.tiles.push(defaultTile());
              save();
              draw();
              return;
            }
            var inp = document.createElement('input');
            inp.type = 'file';
            inp.accept = 'image/*';
            inp.onchange = async function () {
              var file = inp.files && inp.files[0];
              if (!file) return;
              try {
                var up = await cwUpload(file, ['scrolling-banner', 'image']);
                var t = defaultTile();
                t.image = up.url || up;
                t.imagePid = up.publicId || up.pid || up.public_id || '';
                if (up.width) t.imageW = up.width;
                if (up.height) t.imageH = up.height;
                t.name = (file.name || 'Sponsor').replace(/\.[^.]+$/, '');
                t.alt = t.name;
                inst.tiles.push(t);
                save();
                draw();
              } catch (e) {
                alert((e && e.message) || String(e));
              }
            };
            inp.click();
          });
        }
        if (bulk && bulkFile) {
          bulk.addEventListener('click', function () {
            bulkFile.click();
          });
          bulkFile.addEventListener('change', async function () {
            var files = Array.prototype.slice.call(bulkFile.files || []);
            bulkFile.value = '';
            var failed = [];
            for (var i = 0; i < files.length; i++) {
              try {
                if (!cwUpload) break;
                var up = await cwUpload(files[i], ['scrolling-banner', 'image']);
                var t = defaultTile();
                t.image = up.url || up;
                t.imagePid = up.publicId || up.pid || up.public_id || '';
                t.name = (files[i].name || 'Sponsor').replace(/\.[^.]+$/, '');
                t.alt = t.name;
                inst.tiles.push(t);
              } catch (e) {
                failed.push((files[i] && files[i].name) || 'file');
                console.warn('SSB upload failed', e);
              }
            }
            save();
            draw();
            if (failed.length) {
              alert('Some uploads failed (' + failed.length + '). Successful tiles were kept. Retry the failed files.');
            }
          });
        }
        bind('ssb-show-all', function () {
          S._showAll = body.querySelector('#ssb-show-all').checked;
          paintPreview();
        });

        body.querySelectorAll('[data-ssb-tile-i]').forEach(function (card) {
          var i = Number(card.getAttribute('data-ssb-tile-i'));
          card.querySelectorAll('[data-k]').forEach(function (el) {
            el.addEventListener('change', function () {
              var k = el.getAttribute('data-k');
              if (el.type === 'checkbox') inst.tiles[i][k] = el.checked;
              else inst.tiles[i][k] = el.value;
              if ((k === 'startAt' || k === 'endAt') && el.value) {
                inst.tiles[i][k] = el.value.length === 16 ? el.value + ':00' : el.value;
              }
              if (k === 'linkUrl' && el.value && global.LpScrollingSponsorBanner && !global.LpScrollingSponsorBanner.isSafeHttpUrl(el.value)) {
                alert('Only http(s) URLs are allowed.');
                el.value = '';
                inst.tiles[i].linkUrl = '';
              }
              save();
            });
          });
          var up = card.querySelector('[data-ssb-up]');
          var down = card.querySelector('[data-ssb-down]');
          var dup = card.querySelector('[data-ssb-dup]');
          var del = card.querySelector('[data-ssb-del]');
          var rep = card.querySelector('[data-ssb-replace]');
          var file = card.querySelector('[data-ssb-file]');
          if (up) {
            up.addEventListener('click', function () {
              if (i <= 0) return;
              var tmp = inst.tiles[i - 1];
              inst.tiles[i - 1] = inst.tiles[i];
              inst.tiles[i] = tmp;
              save();
              draw();
            });
          }
          if (down) {
            down.addEventListener('click', function () {
              if (i >= inst.tiles.length - 1) return;
              var tmp = inst.tiles[i + 1];
              inst.tiles[i + 1] = inst.tiles[i];
              inst.tiles[i] = tmp;
              save();
              draw();
            });
          }
          if (dup) {
            dup.addEventListener('click', function () {
              var copy = Object.assign({}, defaultTile(), inst.tiles[i], { id: uid('tile') });
              copy.name = (copy.name || 'Sponsor') + ' (copy)';
              inst.tiles.splice(i + 1, 0, copy);
              save();
              draw();
            });
          }
          if (del) {
            del.addEventListener('click', function () {
              if (!confirm('Remove this tile? The media library image is kept.')) return;
              inst.tiles.splice(i, 1);
              save();
              draw();
            });
          }
          if (rep && file) {
            rep.addEventListener('click', function () {
              file.click();
            });
            file.addEventListener('change', async function () {
              var f = file.files && file.files[0];
              file.value = '';
              if (!f || !cwUpload) return;
              try {
                var up = await cwUpload(f, ['scrolling-banner', 'image']);
                inst.tiles[i].image = up.url || up;
                inst.tiles[i].imagePid = up.publicId || up.pid || up.public_id || '';
                save();
                draw();
              } catch (e) {
                alert((e && e.message) || String(e));
              }
            });
          }
        });
      }

      if (S._tab === 'motion') {
        bind('ssb-scrolling', function () {
          inst.motion.scrolling = body.querySelector('#ssb-scrolling').checked;
          save();
        });
        bind('ssb-static', function () {
          inst.motion.staticGrid = body.querySelector('#ssb-static').checked;
          save();
        });
        bind('ssb-dir', function () {
          inst.motion.direction = body.querySelector('#ssb-dir').value;
          save();
        });
        bind('ssb-speed-preset', function () {
          inst.motion.speedPxPerSec = Number(body.querySelector('#ssb-speed-preset').value) || 40;
          var spd = body.querySelector('#ssb-speed');
          var num = body.querySelector('#ssb-speed-num');
          var lab = body.querySelector('#ssb-speed-label');
          if (spd) spd.value = inst.motion.speedPxPerSec;
          if (num) num.value = inst.motion.speedPxPerSec;
          if (lab) lab.textContent = inst.motion.speedPxPerSec + ' px/s';
          save();
        });
        function syncSpeed(v) {
          inst.motion.speedPxPerSec = Math.max(8, Math.min(160, Number(v) || 40));
          var spd = body.querySelector('#ssb-speed');
          var num = body.querySelector('#ssb-speed-num');
          var lab = body.querySelector('#ssb-speed-label');
          if (spd) spd.value = inst.motion.speedPxPerSec;
          if (num) num.value = inst.motion.speedPxPerSec;
          if (lab) lab.textContent = inst.motion.speedPxPerSec + ' px/s';
          save();
        }
        bind('ssb-speed', function () {
          syncSpeed(body.querySelector('#ssb-speed').value);
        });
        bind('ssb-speed-num', function () {
          syncSpeed(body.querySelector('#ssb-speed-num').value);
        });
        bind('ssb-pause-hover', function () {
          inst.motion.pauseOnHover = body.querySelector('#ssb-pause-hover').checked;
          save();
        });
        bind('ssb-pause-btn', function () {
          inst.motion.showPauseControl = body.querySelector('#ssb-pause-btn').checked;
          save();
        });
        [
          ['ssb-h-d', 'imageHeightDesktop'],
          ['ssb-h-m', 'imageHeightMobile'],
          ['ssb-w-d', 'tileWidthDesktop'],
          ['ssb-w-m', 'tileWidthMobile'],
          ['ssb-g-d', 'gapDesktop'],
          ['ssb-g-m', 'gapMobile'],
          ['ssb-pad', 'tilePadding']
        ].forEach(function (pair) {
          bind(pair[0], function () {
            inst.layout[pair[1]] = Number(body.querySelector('#' + pair[0]).value);
            save();
          });
        });
        bind('ssb-fit', function () {
          inst.layout.imageFit = body.querySelector('#ssb-fit').value;
          save();
        });
        bind('ssb-pos', function () {
          inst.layout.imagePos = body.querySelector('#ssb-pos').value;
          save();
        });
      }

      if (S._tab === 'appearance') {
        [
          ['ssb-sec-bg', 'sectionBg', false],
          ['ssb-tile-bg', 'tileBg', false],
          ['ssb-border-c', 'borderColor', false],
          ['ssb-border-w', 'borderWidth', true],
          ['ssb-radius', 'radius', true],
          ['ssb-fade-w', 'edgeFadeWidth', true],
          ['ssb-pt', 'padTop', true],
          ['ssb-pb', 'padBottom', true]
        ].forEach(function (pair) {
          bind(pair[0], function () {
            var v = body.querySelector('#' + pair[0]).value;
            inst.appearance[pair[1]] = pair[2] ? Number(v) : v;
            save();
          });
        });
        bind('ssb-shadow', function () {
          inst.appearance.shadow = body.querySelector('#ssb-shadow').checked;
          save();
        });
        bind('ssb-grey', function () {
          inst.appearance.greyscaleHover = body.querySelector('#ssb-grey').checked;
          save();
        });
        bind('ssb-full', function () {
          inst.appearance.fullWidth = body.querySelector('#ssb-full').checked;
          save();
        });
        bind('ssb-fade', function () {
          inst.appearance.edgeFade = body.querySelector('#ssb-fade').checked;
          save();
        });
        var reset = body.querySelector('#ssb-reset-appearance');
        if (reset) {
          reset.addEventListener('click', function () {
            inst.appearance = defaultInstance().appearance;
            save();
            draw();
          });
        }
      }

      body.querySelectorAll('[data-ssb-prev]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var mode = btn.getAttribute('data-ssb-prev') === 'mobile' ? 'mobile' : 'desktop';
          S._prevMode = mode;
          body.querySelectorAll('[data-ssb-prev]').forEach(function (b) {
            b.classList.toggle('on', b.getAttribute('data-ssb-prev') === mode);
          });
          var host = body.querySelector('#ssb-live-preview');
          if (!host) return;
          host.style.maxWidth = mode === 'mobile' ? '390px' : '100%';
          host.style.margin = mode === 'mobile' ? '0 auto' : '';
          paintPreview();
        });
      });

      if (S._tab === 'reporting') {
        async function loadReport() {
          var box = body.querySelector('#ssb-report-box');
          if (!box) return;
          var daysEl = body.querySelector('#ssb-report-days');
          var days = daysEl ? Number(daysEl.value) || 30 : 30;
          box.innerHTML = '<p class="lede" style="margin:0">Loading…</p>';
          var rows = [];
          try {
            if (typeof api.fetchReport === 'function') rows = (await api.fetchReport(days)) || [];
          } catch (_e) {
            rows = [];
          }
          var inst = selected();
          var tileNames = {};
          (inst.tiles || []).forEach(function (t) {
            tileNames[t.id] = t.name || t.id;
          });
          var total = 0;
          var byTile = {};
          (rows || []).forEach(function (e) {
            if (!e || e.event !== 'cta_click') return;
            var p = e.props || {};
            if (p.location !== 'scrollingSponsorBanner') return;
            if (inst.id && p.banner_id && String(p.banner_id) !== String(inst.id)) return;
            var tid = p.tile_id || 'unknown';
            var n = e.count > 0 ? e.count : 1;
            byTile[tid] = (byTile[tid] || 0) + n;
            total += n;
          });
          if (!total) {
            box.innerHTML =
              '<p class="lede" style="margin:0">No sponsor link clicks in this range for this banner yet. Published sites record real activations only — this is not sample data.</p>';
            return;
          }
          var keys = Object.keys(byTile).sort(function (a, b) {
            return byTile[b] - byTile[a];
          });
          box.innerHTML =
            '<div style="font-weight:700;margin:0 0 10px">Total clicks: ' +
            total +
            '</div>' +
            '<div style="display:grid;gap:6px">' +
            keys
              .map(function (k) {
                return (
                  '<div style="display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--line,#eee);padding:6px 0">' +
                  '<span>' +
                  esc(tileNames[k] || k) +
                  '</span><strong>' +
                  byTile[k] +
                  '</strong></div>'
                );
              })
              .join('') +
            '</div>';
        }
        var refresh = body.querySelector('#ssb-report-refresh');
        if (refresh) refresh.addEventListener('click', function () { loadReport(); });
        var daysSel = body.querySelector('#ssb-report-days');
        if (daysSel) daysSel.addEventListener('change', function () { loadReport(); });
        loadReport();
      }
    }

    draw();
  }

  global.LpSsbManage = {
    render: render,
    defaultInstance: defaultInstance,
    defaultTile: defaultTile,
    ens: ens
  };
})(typeof window !== 'undefined' ? window : globalThis);
