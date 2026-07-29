/**
 * LeadPages marketing colour styler (Try colours).
 * Eight Web Culture presets + Neon Pink / Electric Blue frontend themes.
 * Preview only — sessionStorage; Reset restores the charcoal LeadPages look.
 * Auto-mounts the FAB/panel on any page that loads this script.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'mkt-home-colour-preset';

  var CULTURE_PRESETS = [
    {
      id: 'culture',
      name: 'Culture Lime',
      blurb: 'The signature forest and lime look.',
      primary: '#C5E13F',
      ink: '#0B2114',
      bg: '#FDFCF0',
      surface: '#F5F2E6',
      muted: '#5C6B60',
      glow: '#C5E13F'
    },
    {
      id: 'basalt',
      name: 'Basalt',
      blurb: 'Charcoal ground with a copper spark.',
      primary: '#D97706',
      ink: '#141414',
      bg: '#F7F4EF',
      surface: '#EDE8E1',
      muted: '#6B6560',
      glow: '#F59E0B'
    },
    {
      id: 'rivet',
      name: 'Rivet',
      blurb: 'Deep navy with a sharp signal accent.',
      primary: '#F97316',
      ink: '#0B1C33',
      bg: '#F4F7FB',
      surface: '#E8EEF5',
      muted: '#5A6B7D',
      glow: '#FB923C'
    },
    {
      id: 'tarmac',
      name: 'Tarmac',
      blurb: 'Near-black with an electric teal edge.',
      primary: '#14B8A6',
      ink: '#0A0F14',
      bg: '#F3F6F7',
      surface: '#E6ECEE',
      muted: '#5C6A70',
      glow: '#2DD4BF'
    },
    {
      id: 'petal',
      name: 'Petal',
      blurb: 'Soft rose warmth on cream.',
      primary: '#E8A0A8',
      ink: '#3D2A32',
      bg: '#FFF8F7',
      surface: '#F8ECEC',
      muted: '#7A646A',
      glow: '#F0B7BD'
    },
    {
      id: 'willow',
      name: 'Willow',
      blurb: 'Calm sage and soft daylight green.',
      primary: '#8FAE6B',
      ink: '#243028',
      bg: '#F7F9F3',
      surface: '#EBEEE4',
      muted: '#66705F',
      glow: '#A8C285'
    },
    {
      id: 'orchid',
      name: 'Orchid',
      blurb: 'Quiet mauve with a polished finish.',
      primary: '#B28BB8',
      ink: '#2C2130',
      bg: '#FBF7FC',
      surface: '#F1EAF3',
      muted: '#6F6274',
      glow: '#C9A5CE'
    },
    {
      id: 'dune',
      name: 'Dune',
      blurb: 'Warm sand and terracotta.',
      primary: '#C47A4A',
      ink: '#2B2118',
      bg: '#FBF6EF',
      surface: '#F1E7DA',
      muted: '#736557',
      glow: '#D49264'
    }
  ];

  /** Extra frontend-only themes (not partner Culture lab). */
  var FRONTEND_EXTRA_PRESETS = [
    {
      id: 'neon-pink',
      name: 'Neon Pink',
      blurb: 'Dark pink neon on deep plum.',
      primary: '#FF4DA6',
      ink: '#140F14',
      bg: '#FFF0F7',
      surface: '#F8E0ED',
      muted: '#8F7084',
      glow: '#FF6BB8'
    },
    {
      id: 'electric-blue',
      name: 'Electric Blue',
      blurb: 'Electric blue on midnight navy.',
      primary: '#3B9EFF',
      ink: '#0A1524',
      bg: '#EEF5FF',
      surface: '#E0ECFA',
      muted: '#5A6B80',
      glow: '#5CB0FF'
    }
  ];

  var SITE_DEFAULT = {
    id: 'site-default',
    name: 'LeadPages',
    blurb: 'Charcoal, cream and signal orange.',
    primary: '#C85A2C',
    ink: '#0B1B2A',
    bg: '#F4EBDE',
    surface: '#EBDDCD',
    muted: '#6B7680',
    glow: '#C85A2C'
  };

  var ALL_PRESETS = CULTURE_PRESETS.concat(FRONTEND_EXTRA_PRESETS);

  var HOMEPAGE_VARS = [
    '--navy',
    '--navy-deep',
    '--ink',
    '--ink-soft',
    '--cream',
    '--cream-warm',
    '--cream-price',
    '--surface',
    '--orange',
    '--orange-hover',
    '--partner',
    '--green',
    '--green-check',
    '--green-deep',
    '--gold',
    '--star',
    '--muted',
    '--muted-on-dark',
    '--on-dark',
    '--border',
    '--shadow',
    '--shadow-soft',
    '--mf-ink',
    '--mf-orange',
    '--mf-cream',
    '--mf-on-dark',
    '--mf-green',
    '--mf-green-deep',
    '--theme-primary',
    '--gum',
    '--rose',
    '--rose-d'
  ];

  function clampByte(n) {
    return Math.max(0, Math.min(255, Math.round(n)));
  }

  function parseHex(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }

  function toHex(r, g, b) {
    return (
      '#' +
      [r, g, b]
        .map(function (x) {
          return ('0' + clampByte(x).toString(16)).slice(-2);
        })
        .join('')
    );
  }

  /** pct < 0 darkens toward black; pct > 0 lightens toward white */
  function shade(hex, pct) {
    var c = parseHex(hex);
    if (!c) return hex;
    var f = pct / 100;
    var r = c.r + (pct < 0 ? c.r : 255 - c.r) * f;
    var g = c.g + (pct < 0 ? c.g : 255 - c.g) * f;
    var b = c.b + (pct < 0 ? c.b : 255 - c.b) * f;
    return toHex(r, g, b);
  }

  function mix(a, b, pctB) {
    var ca = parseHex(a);
    var cb = parseHex(b);
    if (!ca || !cb) return a;
    var t = Math.max(0, Math.min(1, pctB));
    return toHex(
      ca.r + (cb.r - ca.r) * t,
      ca.g + (cb.g - ca.g) * t,
      ca.b + (cb.b - ca.b) * t
    );
  }

  function rgba(hex, a) {
    var c = parseHex(hex);
    if (!c) return 'transparent';
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }

  /** Map a Culture-shaped palette onto homepage / marketing design tokens. */
  function homepageVarsFromPalette(p) {
    var primary = p.primary;
    var ink = p.ink;
    var bg = p.bg;
    var surface = p.surface;
    var muted = p.muted || shade(ink, 45);
    var glow = p.glow || primary;
    var orangeHover = shade(primary, -12);
    var partner = shade(primary, -28);
    var greenCheck = mix(primary, muted, 0.25);
    return {
      '--navy': ink,
      '--navy-deep': shade(ink, -18),
      '--ink': mix(ink, muted, 0.15),
      '--ink-soft': mix(ink, muted, 0.35),
      '--cream': bg,
      '--cream-warm': surface,
      '--cream-price': mix(bg, surface, 0.45),
      '--surface': '#FFFFFF',
      '--orange': primary,
      '--orange-hover': orangeHover,
      '--partner': partner,
      '--green': mix(primary, muted, 0.35),
      '--green-check': greenCheck,
      '--green-deep': shade(greenCheck, -18),
      '--gold': glow,
      '--star': glow,
      '--muted': muted,
      '--muted-on-dark': mix(bg, muted, 0.35),
      '--on-dark': bg,
      '--border': mix(surface, muted, 0.22),
      '--shadow': '0 18px 48px ' + rgba(ink, 0.16),
      '--shadow-soft': '0 10px 26px ' + rgba(ink, 0.08),
      /* Marketplace / legacy marketing aliases */
      '--mf-ink': ink,
      '--mf-orange': primary,
      '--mf-cream': bg,
      '--mf-on-dark': bg,
      '--mf-green': greenCheck,
      '--mf-green-deep': shade(greenCheck, -18),
      '--theme-primary': primary,
      '--gum': ink,
      '--rose': primary,
      '--rose-d': orangeHover
    };
  }

  function byIdMap() {
    var map = { 'site-default': SITE_DEFAULT };
    ALL_PRESETS.forEach(function (p) {
      map[p.id] = p;
    });
    return map;
  }

  function refreshLogos() {
    try {
      if (window.LPLogo && typeof window.LPLogo.upgradeAll === 'function') {
        window.LPLogo.upgradeAll(document);
      }
    } catch (_e) {}
  }

  function applyPalette(p, id) {
    var html = document.documentElement;
    var i;
    if (!p || id === 'site-default') {
      for (i = 0; i < HOMEPAGE_VARS.length; i++) {
        html.style.removeProperty(HOMEPAGE_VARS[i]);
      }
      p = SITE_DEFAULT;
    } else {
      var vars = homepageVarsFromPalette(p);
      Object.keys(vars).forEach(function (k) {
        html.style.setProperty(k, vars[k]);
      });
    }
    document.body.setAttribute('data-mkt-colour', id || 'site-default');
    var themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', p.ink || '#0B1B2A');
    var fabDot = document.querySelector('.mkt-colour-lab__fab-dot');
    if (fabDot) fabDot.style.background = p.primary;
    document.querySelectorAll('[data-mkt-colour-preset]').forEach(function (btn) {
      var on = btn.getAttribute('data-mkt-colour-preset') === id;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    /* Keep logo accent in sync with theme */
    document.querySelectorAll('.leadpages-logo, .lp-logo-wrap').forEach(function (el) {
      el.style.setProperty('--lp-logo-accent', p.primary);
      if (el.hasAttribute('data-lp-logo-accent')) {
        el.setAttribute('data-lp-logo-accent', p.primary);
      }
    });
    refreshLogos();
  }

  function selectPreset(id, persist) {
    var map = byIdMap();
    var p = map[id];
    if (!p) return;
    applyPalette(p, id);
    if (persist !== false) {
      try {
        sessionStorage.setItem(STORAGE_KEY, id);
      } catch (_e) {}
    }
  }

  function setOpen(root, fab, panel, scrim, open) {
    root.classList.toggle('is-open', open);
    fab.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.hidden = !open;
    if (scrim) scrim.hidden = !open;
    document.body.classList.toggle('mkt-colour-lab-open', open);
  }

  function ensureCss() {
    if (document.querySelector('link[href*="marketing-colour-lab.css"]')) return;
    /* Homepage inlines lab CSS in marketing-home.css — skip duplicate when present */
    if (document.body && document.body.classList.contains('mkt-home')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/assets/marketing-colour-lab.css';
    document.head.appendChild(link);
  }

  function swatchHtml(p) {
    return (
      '<button type="button" class="mkt-colour-lab__swatch" data-mkt-colour-preset="' +
      p.id +
      '" role="radio" aria-checked="false" aria-label="' +
      p.name +
      '"><span class="mkt-colour-lab__swatch-chips" aria-hidden="true">' +
      '<span style="background:' +
      p.bg +
      '"></span><span style="background:' +
      p.primary +
      '"></span><span style="background:' +
      p.ink +
      '"></span></span>' +
      '<span class="mkt-colour-lab__swatch-meta"><span class="mkt-colour-lab__swatch-name">' +
      p.name +
      '</span><span class="mkt-colour-lab__swatch-blurb">' +
      p.blurb +
      '</span></span></button>'
    );
  }

  function labMarkup() {
    var swatches = ALL_PRESETS.map(swatchHtml).join('');
    return (
      '<aside class="mkt-colour-lab" data-mkt-colour-lab aria-label="Colour scheme playground">' +
      '<button type="button" class="mkt-colour-lab__fab" data-mkt-colour-lab-fab aria-expanded="false" aria-controls="mkt-colour-lab-panel">' +
      '<span class="mkt-colour-lab__fab-orb" aria-hidden="true">' +
      '<span class="mkt-colour-lab__fab-dot" style="background:#C85A2C"></span>' +
      '<span class="mkt-colour-lab__fab-dot" style="background:#0B1B2A"></span>' +
      '<span class="mkt-colour-lab__fab-dot" style="background:#F4EBDE"></span>' +
      '</span>' +
      '<span class="mkt-colour-lab__fab-label">Try colours</span>' +
      '</button>' +
      '<div class="mkt-colour-lab__scrim" data-mkt-colour-lab-scrim hidden></div>' +
      '<div class="mkt-colour-lab__panel" id="mkt-colour-lab-panel" data-mkt-colour-lab-panel hidden role="dialog" aria-modal="false" aria-labelledby="mkt-colour-lab-title">' +
      '<div class="mkt-colour-lab__panel-inner">' +
      '<header class="mkt-colour-lab__head">' +
      '<p class="mkt-colour-lab__eyebrow">Live colour studio</p>' +
      '<h2 id="mkt-colour-lab-title" class="mkt-colour-lab__title">Pick a colour scheme</h2>' +
      '<p class="mkt-colour-lab__lede">Web Culture themes plus Neon Pink and Electric Blue — the whole page updates instantly.</p>' +
      '<button type="button" class="mkt-colour-lab__close" data-mkt-colour-lab-close aria-label="Close colour studio">&times;</button>' +
      '</header>' +
      '<div class="mkt-colour-lab__grid" role="radiogroup" aria-label="Colour presets">' +
      swatches +
      '</div>' +
      '<footer class="mkt-colour-lab__foot">' +
      '<button type="button" class="mkt-colour-lab__reset" data-mkt-colour-lab-reset>LeadPages default</button>' +
      '<a class="mkt-colour-lab__cta" href="/find-a-partner" data-mkt-track="colour_lab_cta">Build my website</a>' +
      '</footer>' +
      '</div></div></aside>'
    );
  }

  function ensureLabRoot() {
    var root = document.querySelector('[data-mkt-colour-lab]');
    if (root) {
      /* Refresh swatch grid so new presets appear even on older static markup */
      var grid = root.querySelector('.mkt-colour-lab__grid');
      if (grid && grid.querySelectorAll('[data-mkt-colour-preset]').length < ALL_PRESETS.length) {
        grid.innerHTML = ALL_PRESETS.map(swatchHtml).join('');
      }
      var lede = root.querySelector('.mkt-colour-lab__lede');
      if (lede) {
        lede.textContent =
          'Web Culture themes plus Neon Pink and Electric Blue — the whole page updates instantly.';
      }
      return root;
    }
    var wrap = document.createElement('div');
    wrap.innerHTML = labMarkup();
    root = wrap.firstChild;
    document.body.appendChild(root);
    return root;
  }

  function init() {
    ensureCss();
    var root = ensureLabRoot();
    if (!root) return;
    var fab = root.querySelector('[data-mkt-colour-lab-fab]');
    var panel = root.querySelector('[data-mkt-colour-lab-panel]');
    var scrim = root.querySelector('[data-mkt-colour-lab-scrim]');
    var closeBtn = root.querySelector('[data-mkt-colour-lab-close]');
    var resetBtn = root.querySelector('[data-mkt-colour-lab-reset]');
    if (!fab || !panel) return;

    fab.addEventListener('click', function () {
      setOpen(root, fab, panel, scrim, panel.hidden);
    });
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        setOpen(root, fab, panel, scrim, false);
      });
    }
    if (scrim) {
      scrim.addEventListener('click', function () {
        setOpen(root, fab, panel, scrim, false);
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        selectPreset('site-default');
      });
    }
    root.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-mkt-colour-preset]');
      if (!btn || !root.contains(btn)) return;
      selectPreset(btn.getAttribute('data-mkt-colour-preset'));
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('is-open')) {
        setOpen(root, fab, panel, scrim, false);
      }
    });

    var stored = null;
    try {
      stored = sessionStorage.getItem(STORAGE_KEY);
    } catch (_e) {}
    if (stored && byIdMap()[stored]) {
      selectPreset(stored, false);
    } else {
      selectPreset('site-default', false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for tests
  window.__mktHomeColour = {
    presets: CULTURE_PRESETS,
    extraPresets: FRONTEND_EXTRA_PRESETS,
    allPresets: ALL_PRESETS,
    siteDefault: SITE_DEFAULT,
    homepageVarsFromPalette: homepageVarsFromPalette,
    selectPreset: selectPreset,
    STORAGE_KEY: STORAGE_KEY
  };
})();
