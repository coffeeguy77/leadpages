/**
 * LeadPages homepage colour styler.
 * Eight presets match Web Culture Colour Lab
 * (lib/partner-website/webculture-color-presets.js).
 * Preview only — sessionStorage; Reset restores the charcoal homepage look.
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
    '--shadow-soft'
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

  /** Map a Culture-shaped palette onto homepage design tokens. */
  function homepageVarsFromPalette(p) {
    var primary = p.primary;
    var ink = p.ink;
    var bg = p.bg;
    var surface = p.surface;
    var muted = p.muted || shade(ink, 45);
    var glow = p.glow || primary;
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
      '--orange-hover': shade(primary, -12),
      '--partner': shade(primary, -28),
      '--green': mix(primary, muted, 0.35),
      '--green-check': mix(primary, muted, 0.25),
      '--green-deep': shade(mix(primary, muted, 0.25), -18),
      '--gold': glow,
      '--star': glow,
      '--muted': muted,
      '--muted-on-dark': mix(bg, muted, 0.35),
      '--on-dark': bg,
      '--border': mix(surface, muted, 0.22),
      '--shadow': '0 18px 48px ' + rgba(ink, 0.16),
      '--shadow-soft': '0 10px 26px ' + rgba(ink, 0.08)
    };
  }

  function byIdMap() {
    var map = { 'site-default': SITE_DEFAULT };
    CULTURE_PRESETS.forEach(function (p) {
      map[p.id] = p;
    });
    return map;
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

  function init() {
    var root = document.querySelector('[data-mkt-colour-lab]');
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
    root.querySelectorAll('[data-mkt-colour-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectPreset(btn.getAttribute('data-mkt-colour-preset'));
      });
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
    siteDefault: SITE_DEFAULT,
    homepageVarsFromPalette: homepageVarsFromPalette,
    selectPreset: selectPreset,
    STORAGE_KEY: STORAGE_KEY
  };
})();
