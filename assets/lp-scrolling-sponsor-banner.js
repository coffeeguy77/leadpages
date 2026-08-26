/* Scrolling Sponsor Banner — public + editor preview renderer */
(function (root) {
  'use strict';

  var SPEED_MIN = 8;
  var SPEED_MAX = 160;

  function clamp(n, lo, hi) {
    n = Number(n);
    if (!isFinite(n)) return lo;
    return Math.min(hi, Math.max(lo, n));
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isSafeHttpUrl(url) {
    if (!url) return false;
    var s = String(url).trim();
    try {
      var u = new URL(s);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (_e) {
      return false;
    }
  }

  function parseTs(v) {
    if (v == null || v === '') return null;
    var t = Date.parse(String(v));
    return isFinite(t) ? t : null;
  }

  function tileActive(t, now) {
    if (!t || t.enabled === false) return false;
    var start = parseTs(t.startAt);
    var end = parseTs(t.endAt);
    if (start != null && now < start) return false;
    if (end != null && now > end) return false;
    return true;
  }

  function fitCss(fit) {
    var m = {
      contain: 'contain',
      cover: 'cover',
      stretch: 'fill',
      natural: 'none',
      scale_down: 'scale-down',
      fill: 'fill'
    };
    return m[fit] || 'contain';
  }

  function posCss(pos) {
    var m = {
      center: 'center',
      top: 'top',
      bottom: 'bottom',
      left: 'left',
      right: 'right',
      'top left': 'top left',
      'top right': 'top right',
      'bottom left': 'bottom left',
      'bottom right': 'bottom right',
      topLeft: 'top left',
      topRight: 'top right',
      bottomLeft: 'bottom left',
      bottomRight: 'bottom right'
    };
    return m[pos] || 'center';
  }

  function cloudinaryResponsive(url) {
    if (!url) return '';
    var u = String(url);
    if (u.indexOf('res.cloudinary.com') < 0) return u;
    if (u.indexOf('/upload/') < 0) return u;
    if (u.indexOf('f_auto') >= 0) return u;
    return u.replace('/upload/', '/upload/f_auto,q_auto:good,c_limit,w_800/');
  }

  function tileHtml(tile, inst, opts) {
    opts = opts || {};
    var layout = inst.layout || {};
    var appearance = inst.appearance || {};
    var fit = fitCss(tile.imageFit || layout.imageFit || 'contain');
    var pos = posCss(tile.imagePos || layout.imagePos || 'center');
    var w = tile.widthOverride != null ? Number(tile.widthOverride) : null;
    var pad = Number(layout.tilePadding) || 16;
    var bg = appearance.tileBg || 'transparent';
    var borderW = Number(appearance.borderWidth) || 0;
    var borderC = appearance.borderColor || 'transparent';
    var radius = Number(appearance.radius) || 0;
    var shadow = appearance.shadow ? '0 6px 18px rgba(0,0,0,.08)' : 'none';
    var grey = appearance.greyscaleHover ? ' ssb-tile--grey' : '';
    var style =
      'padding:' + pad + 'px;' +
      'background:' + bg + ';' +
      'border:' + borderW + 'px solid ' + borderC + ';' +
      'border-radius:' + radius + 'px;' +
      'box-shadow:' + shadow + ';' +
      (w ? 'width:' + w + 'px;flex:0 0 ' + w + 'px;' : '');

    var imgUrl = cloudinaryResponsive(tile.image);
    var alt = tile.alt || tile.name || '';
    var mode = tile.contentMode || 'image';
    var text = tile.text || '';
    var canLink =
      !!opts.allowLinks &&
      inst.bannerLinksEnabled !== false &&
      tile.linkEnabled &&
      isSafeHttpUrl(tile.linkUrl);

    var imgAlt = canLink ? '' : alt;
    var img =
      '<span class="ssb-media" style="object-fit:none;">' +
      (imgUrl
        ? '<img class="ssb-img" src="' + esc(imgUrl) + '" alt="' + esc(imgAlt) + '"' + (canLink ? ' aria-hidden="true"' : '') + ' loading="lazy" decoding="async" style="object-fit:' + fit + ';object-position:' + pos + ';"' +
          (tile.imageW ? ' width="' + esc(tile.imageW) + '"' : '') +
          (tile.imageH ? ' height="' + esc(tile.imageH) + '"' : '') +
          ' />'
        : '<span class="ssb-img-fallback" aria-hidden="true"></span>') +
      '</span>';

    var textBlock = '';
    if ((mode === 'overlay' || mode === 'caption') && text) {
      var tStyle =
        'color:' + (tile.textColor || 'inherit') + ';' +
        'font-size:' + (tile.textSize || 14) + 'px;' +
        'text-align:' + (tile.textAlign || 'center') + ';' +
        'padding:' + (tile.textPad != null ? tile.textPad : 8) + 'px;';
      if (tile.textBg) tStyle += 'background:' + tile.textBg + ';';
      if (mode === 'overlay') {
        var tint = tile.overlayTint || '#000';
        var op = clamp(tile.overlayOpacity, 0, 1);
        textBlock =
          '<span class="ssb-overlay ssb-ov-' + esc(tile.overlayV || 'bottom') + ' ssb-oh-' + esc(tile.overlayH || 'center') + '" style="--ssb-tint:' + esc(tint) + ';--ssb-tint-op:' + op + ';">' +
          '<span class="ssb-overlay-text" style="' + tStyle + '">' + esc(text) + '</span></span>';
      } else {
        textBlock = '<span class="ssb-caption" style="' + tStyle + '">' + esc(text) + '</span>';
      }
    }

    var inner = '<span class="ssb-tile-inner">' + img + textBlock + '</span>';
    var label = tile.linkLabel || tile.name || alt || 'Sponsor';
    if (canLink) {
      return (
        '<a class="ssb-tile' + grey + '" style="' + style + '" href="' + esc(tile.linkUrl) + '" target="_blank" rel="noopener noreferrer" data-ssb-tile="' + esc(tile.id) + '" data-ssb-inst="' + esc(inst.id) + '" aria-label="' + esc(label) + '">' +
        inner +
        '</a>'
      );
    }
    return (
      '<span class="ssb-tile ssb-tile--static' + grey + '" style="' + style + '" data-ssb-tile="' + esc(tile.id) + '" data-ssb-inst="' + esc(inst.id) + '"' +
      (alt ? ' role="img" aria-label="' + esc(alt) + '"' : ' aria-hidden="true"') +
      '>' +
      inner +
      '</span>'
    );
  }

  function headingHtml(h) {
    h = h || {};
    var parts = [];
    var align = h.align || 'center';
    var max = Number(h.maxWidth) || 720;
    var gap = Number(h.gap) || 16;
    if (h.eyebrow) {
      parts.push(
        '<p class="ssb-eyebrow" style="color:' + (h.eyebrowColor || 'var(--pipe,inherit)') + ';">' + esc(h.eyebrow) + '</p>'
      );
    }
    if (h.title) {
      parts.push(
        '<h2 class="ssb-title" style="color:' + (h.titleColor || 'inherit') + ';">' + esc(h.title) + '</h2>'
      );
    }
    if (h.intro) {
      parts.push(
        '<p class="ssb-intro" style="color:' + (h.introColor || 'var(--steel,inherit)') + ';">' + esc(h.intro) + '</p>'
      );
    }
    if (!parts.length) return '';
    return (
      '<div class="ssb-heading ssb-align-' + esc(align) + '" style="max-width:' + max + 'px;margin-bottom:' + gap + 'px;">' +
      parts.join('') +
      '</div>'
    );
  }

  function destroyMount(root) {
    if (!root || !root._ssb) return;
    var st = root._ssb;
    if (st.raf) cancelAnimationFrame(st.raf);
    if (st.ro) try { st.ro.disconnect(); } catch (_e) {}
    if (st.io) try { st.io.disconnect(); } catch (_e) {}
    if (st.onVis) document.removeEventListener('visibilitychange', st.onVis);
    if (st.onReduce) {
      try { st.mq.removeEventListener('change', st.onReduce); } catch (_e2) {}
    }
    root._ssb = null;
    root.innerHTML = '';
  }

  function wireInstance(el, inst, opts) {
    opts = opts || {};
    var motion = inst.motion || {};
    var layout = inst.layout || {};
    var appearance = inst.appearance || {};
    var track = el.querySelector('.ssb-track');
    var viewport = el.querySelector('.ssb-viewport');
    if (!track || !viewport) return;

    var reduced =
      opts.forceStatic ||
      motion.staticGrid ||
      !motion.scrolling ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    var pauseReasons = Object.create(null);
    function setPause(reason, on) {
      if (on) pauseReasons[reason] = true;
      else delete pauseReasons[reason];
    }
    function isPaused() {
      for (var k in pauseReasons) if (pauseReasons[k]) return true;
      return false;
    }

    var btn = el.querySelector('.ssb-pause-btn');
    function syncBtn() {
      if (!btn) return;
      var man = !!pauseReasons.manual;
      btn.setAttribute('aria-pressed', man ? 'true' : 'false');
      btn.textContent = man ? 'Play' : 'Pause';
      btn.setAttribute('aria-label', man ? 'Play scrolling banner' : 'Pause scrolling banner');
    }
    if (btn) {
      btn.addEventListener('click', function () {
        setPause('manual', !pauseReasons.manual);
        syncBtn();
      });
    }

    if (motion.pauseOnHover && !reduced) {
      viewport.addEventListener('mouseenter', function () { setPause('hover', true); });
      viewport.addEventListener('mouseleave', function () { setPause('hover', false); });
    }
    viewport.addEventListener('focusin', function () { setPause('focus', true); });
    viewport.addEventListener('focusout', function (ev) {
      if (!viewport.contains(ev.relatedTarget)) setPause('focus', false);
    });

    // Touch swipe
    var touchX = null;
    var moved = false;
    viewport.addEventListener(
      'pointerdown',
      function (ev) {
        if (ev.pointerType === 'mouse' && ev.button !== 0) return;
        touchX = ev.clientX;
        moved = false;
        setPause('drag', true);
      },
      { passive: true }
    );
    viewport.addEventListener(
      'pointermove',
      function (ev) {
        if (touchX == null) return;
        if (Math.abs(ev.clientX - touchX) > 8) moved = true;
      },
      { passive: true }
    );
    viewport.addEventListener('pointerup', function () {
      touchX = null;
      setTimeout(function () { setPause('drag', false); }, 450);
    });
    viewport.addEventListener('click', function (ev) {
      if (moved) {
        ev.preventDefault();
        ev.stopPropagation();
        moved = false;
      }
    }, true);

    if (opts.preview) {
      // no analytics in editor
    } else {
      track.addEventListener('click', function (ev) {
        var a = ev.target && ev.target.closest ? ev.target.closest('a.ssb-tile') : null;
        if (!a || moved) return;
        var tileId = a.getAttribute('data-ssb-tile');
        var instId = a.getAttribute('data-ssb-inst');
        try {
          if (typeof root.trackEvent === 'function') {
            root.trackEvent('cta_click', {
              location: 'scrollingSponsorBanner',
              banner_id: instId,
              tile_id: tileId
            });
          } else if (typeof window.trackEvent === 'function') {
            window.trackEvent('cta_click', {
              location: 'scrollingSponsorBanner',
              banner_id: instId,
              tile_id: tileId
            });
          }
        } catch (_e) {}
      });
    }

    var state = {
      x: 0,
      last: 0,
      raf: 0,
      speed: clamp(motion.speedPxPerSec, SPEED_MIN, SPEED_MAX),
      dir: motion.direction === 'right' ? 1 : -1,
      loopW: 0,
      reduced: reduced
    };

    function measure() {
      var gap = window.matchMedia('(max-width:720px)').matches
        ? Number(layout.gapMobile) || 16
        : Number(layout.gapDesktop) || 24;
      track.style.gap = gap + 'px';
      var h = window.matchMedia('(max-width:720px)').matches
        ? Number(layout.imageHeightMobile) || 88
        : Number(layout.imageHeightDesktop) || 120;
      el.style.setProperty('--ssb-media-h', h + 'px');
      var tw = window.matchMedia('(max-width:720px)').matches
        ? Number(layout.tileWidthMobile) || 150
        : Number(layout.tileWidthDesktop) || 200;
      el.style.setProperty('--ssb-tile-w', tw + 'px');

      if (state.reduced) {
        track.style.transform = '';
        el.classList.add('ssb-static');
        return;
      }
      el.classList.remove('ssb-static');
      // Measure first group width (original tiles before clones)
      var originals = track.querySelectorAll('.ssb-tile[data-ssb-origin="1"]');
      var w = 0;
      for (var i = 0; i < originals.length; i++) {
        w += originals[i].offsetWidth;
        if (i < originals.length - 1) w += gap;
      }
      state.loopW = w;
    }

    function tick(ts) {
      if (!state.last) state.last = ts;
      var dt = Math.min(48, ts - state.last);
      state.last = ts;
      if (!isPaused() && state.loopW > 0 && !state.reduced) {
        state.x += state.dir * state.speed * (dt / 1000);
        if (state.dir < 0 && state.x <= -state.loopW) state.x += state.loopW;
        if (state.dir > 0 && state.x >= 0) state.x -= state.loopW;
        track.style.transform = 'translate3d(' + state.x + 'px,0,0)';
      }
      state.raf = requestAnimationFrame(tick);
    }

    measure();
    syncBtn();

    if (!state.reduced && state.loopW > 0) {
      // Start off-screen for rightward so wrap works
      if (state.dir > 0) state.x = -state.loopW;
      state.raf = requestAnimationFrame(tick);
    }

    var ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function () { measure(); }) : null;
    if (ro) ro.observe(viewport);

    var io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            function (ents) {
              var vis = ents.some(function (e) { return e.isIntersecting; });
              setPause('offscreen', !vis);
            },
            { threshold: 0.05 }
          )
        : null;
    if (io) io.observe(el);

    function onVis() {
      setPause('hidden', document.hidden);
    }
    document.addEventListener('visibilitychange', onVis);

    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    function onReduce(ev) {
      if (ev.matches) {
        state.reduced = true;
        measure();
      }
    }
    try { mq.addEventListener('change', onReduce); } catch (_e) {}

    el._ssbRuntime = {
      destroy: function () {
        if (state.raf) cancelAnimationFrame(state.raf);
        if (ro) ro.disconnect();
        if (io) io.disconnect();
        document.removeEventListener('visibilitychange', onVis);
        try { mq.removeEventListener('change', onReduce); } catch (_e2) {}
      }
    };
  }

  function renderInstance(inst, opts) {
    opts = opts || {};
    var now = opts.now != null ? opts.now : Date.now();
    var showAll = !!opts.showAllTiles;
    var tiles = (inst.tiles || []).filter(function (t) {
      return showAll ? t && t.enabled !== false : tileActive(t, now);
    });
    if (!tiles.length) return '';

    var appearance = inst.appearance || {};
    var motion = inst.motion || {};
    var layout = inst.layout || {};
    var gap = Number(layout.gapDesktop) || 24;
    var reduced =
      opts.forceStatic ||
      motion.staticGrid ||
      !motion.scrolling ||
      tiles.length <= 1 ||
      (typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    var sectionStyle = '';
    if (appearance.sectionBg) sectionStyle += 'background:' + appearance.sectionBg + ';';
    var padTopDefault = 24;
    var padBottomDefault = 24;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width:820px)').matches) {
      padTopDefault = 16;
      padBottomDefault = 12;
    }
    sectionStyle +=
      'padding-top:' + (appearance.padTop != null ? appearance.padTop : padTopDefault) + 'px;' +
      'padding-bottom:' + (appearance.padBottom != null ? appearance.padBottom : padBottomDefault) + 'px;';

    var tileOpts = { allowLinks: !opts.preview };
    var originals = tiles
      .map(function (t) {
        var html = tileHtml(t, inst, tileOpts);
        return html.replace(/^<(a|span) /, '<$1 data-ssb-origin="1" ');
      })
      .join('');

    var clones = '';
    if (!reduced && tiles.length > 0) {
      clones = tiles
        .map(function (t) {
          var html = tileHtml(t, inst, tileOpts);
          html = html.replace(/^<(a|span) /, '<$1 aria-hidden="true" tabindex="-1" data-ssb-clone="1" ');
          html = html.replace(/ aria-label="[^"]*"/g, '');
          return html;
        })
        .join('');
      if (tiles.length < 6) clones = clones + clones;
    }

    var fadeClass = appearance.edgeFade ? ' ssb-has-fade' : '';
    var fadeStyle = appearance.edgeFade
      ? '--ssb-fade-w:' + (appearance.edgeFadeWidth || 48) + 'px;'
      : '';

    var pauseBtn =
      !reduced && motion.showPauseControl !== false
        ? '<button type="button" class="ssb-pause-btn" aria-pressed="false">Pause</button>'
        : '<button type="button" class="ssb-pause-btn ssb-pause-btn--sr" aria-pressed="false">Pause</button>';

    var wrapClass = appearance.fullWidth === false ? 'wrap' : 'ssb-full';

    return (
      '<div class="ssb-instance' + (reduced ? ' ssb-static' : '') + '" data-ssb-inst="' + esc(inst.id) + '" style="' + sectionStyle + '">' +
      '<div class="' + wrapClass + '">' +
      headingHtml(inst.heading) +
      '<div class="ssb-banner" role="region" aria-label="' + esc(inst.adminName || 'Sponsors') + '">' +
      '<div class="ssb-viewport' + fadeClass + '" style="--ssb-gap:' + gap + 'px;touch-action:pan-y;' + fadeStyle + '">' +
      '<div class="ssb-track" style="gap:' + gap + 'px;">' +
      originals +
      clones +
      '</div></div>' +
      pauseBtn +
      '</div></div></div>'
    );
  }

  function mount(root, sectionCfg, opts) {
    opts = opts || {};
    destroyMount(root);
    if (!root) return;
    sectionCfg = sectionCfg || {};
    if (sectionCfg.on === false && !opts.preview) {
      root.style.display = 'none';
      root.innerHTML = '';
      return;
    }
    var instances = Array.isArray(sectionCfg.instances) ? sectionCfg.instances : [];
    if (!instances.length && Array.isArray(sectionCfg.tiles)) {
      instances = [sectionCfg];
    }
    var html = instances
      .filter(function (inst) {
        return opts.preview || inst.enabled !== false;
      })
      .map(function (inst) {
        return renderInstance(inst, opts);
      })
      .filter(Boolean)
      .join('');

    if (!html) {
      root.style.display = 'none';
      root.innerHTML = '';
      return;
    }
    root.style.display = '';
    root.innerHTML = html;
    var nodes = root.querySelectorAll('.ssb-instance');
    var runtimes = [];
    for (var i = 0; i < nodes.length; i++) {
      var id = nodes[i].getAttribute('data-ssb-inst');
      var inst = instances.filter(function (x) { return String(x.id) === String(id); })[0];
      if (inst) {
        wireInstance(nodes[i], inst, opts);
        if (nodes[i]._ssbRuntime) runtimes.push(nodes[i]._ssbRuntime);
      }
    }
    root._ssb = {
      destroy: function () {
        runtimes.forEach(function (r) { try { r.destroy(); } catch (_e) {} });
        root.innerHTML = '';
        root._ssb = null;
      }
    };
  }

  var api = {
    mount: mount,
    destroy: destroyMount,
    renderInstance: renderInstance,
    isSafeHttpUrl: isSafeHttpUrl,
    tileActive: tileActive
  };

  root.LpScrollingSponsorBanner = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
