/**
 * LeadPages universal inline SVG logo.
 * Upgrades img.leadpages-logo / [data-lp-logo] to themed inline SVG with optional ring pulse.
 */
(function (global) {
  'use strict';

  var SVG_URL = '/assets/leadpages-logo.svg';
  var svgCache = null;
  var svgPromise = null;

  var THEME_LOGO = {
    'classic-light': { accent: '#1f7a63', ink: '#13161b' },
    'command-dark': { accent: '#2ecc8f', ink: '#eef2f7' },
    blush: { accent: '#c45c7a', ink: '#2a1f2e' },
    blueprint: { accent: '#2563eb', ink: '#1a2a3a' }
  };

  function loadSvgMarkup() {
    if (svgCache) return Promise.resolve(svgCache);
    if (svgPromise) return svgPromise;
    svgPromise = fetch(SVG_URL, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('logo fetch ' + res.status);
        return res.text();
      })
      .then(function (text) {
        svgCache = String(text || '').replace(/<\?xml[^>]*>\s*/i, '').trim();
        return svgCache;
      })
      .catch(function () {
        svgCache =
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 320" aria-hidden="true">'
          + '<text x="360" y="170" fill="var(--lp-logo-ink,#13161b)" font-family="system-ui,sans-serif" font-size="72" font-weight="700">leadpages</text></svg>';
        return svgCache;
      });
    return svgPromise;
  }

  function resolvedWorkspaceTheme() {
    if (global.LPWorkspaceAppearance && global.LPWorkspaceAppearance.resolveTheme) {
      var p = global.LPWorkspaceAppearance.load ? global.LPWorkspaceAppearance.load() : {};
      return global.LPWorkspaceAppearance.resolveTheme(p.theme || 'classic-light');
    }
    var root = global.document && global.document.documentElement;
    return (root && root.dataset && root.dataset.theme) || 'classic-light';
  }

  function logoTokens(opts) {
    opts = opts || {};
    if (opts.accent || opts.ink) {
      return {
        accent: opts.accent || '#2ecc8f',
        ink: opts.ink || '#13161b'
      };
    }
    if (opts.inkMode === 'light') return { accent: opts.accent || '#2ecc8f', ink: '#f3f6fa' };
    if (opts.inkMode === 'dark') return { accent: opts.accent || '#1f7a63', ink: '#13161b' };

    var theme = opts.theme || resolvedWorkspaceTheme();
    var meta = THEME_LOGO[theme];
    if (meta) return { accent: meta.accent, ink: meta.ink };

    var root = global.document && global.document.documentElement;
    if (root) {
      var cs = global.getComputedStyle(root);
      return {
        accent: (cs.getPropertyValue('--lp-logo-accent') || cs.getPropertyValue('--accent') || '#2ecc8f').trim(),
        ink: (cs.getPropertyValue('--lp-logo-ink') || cs.getPropertyValue('--text') || '#13161b').trim()
      };
    }
    return { accent: '#2ecc8f', ink: '#13161b' };
  }

  function shouldPulse(el, opts) {
    if (opts && opts.pulse === false) return false;
    if (opts && opts.pulse === true) return true;
    if (el && el.hasAttribute('data-lp-logo-pulse')) return true;
    if (el && el.classList && el.classList.contains('lp-logo-pulse')) return true;
    return false;
  }

  function wrapFromElement(el) {
    var wrap = global.document.createElement('span');
    wrap.className = 'lp-logo-wrap leadpages-logo';
    if (el.className) {
      el.className.split(/\s+/).forEach(function (c) {
        if (c && c !== 'leadpages-logo') wrap.classList.add(c);
      });
    }
    if (el.id) wrap.id = el.id;
    ['data-lp-logo', 'data-lp-logo-pulse', 'data-lp-logo-ink', 'data-lp-logo-accent', 'title'].forEach(function (a) {
      if (el.hasAttribute(a)) wrap.setAttribute(a, el.getAttribute(a));
    });
    var alt = el.getAttribute('alt') || 'LeadPages';
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', alt);
    if (el.getAttribute('style')) wrap.setAttribute('style', el.getAttribute('style'));
    return wrap;
  }

  function applyTokens(wrap, tokens) {
    wrap.style.setProperty('--lp-logo-accent', tokens.accent);
    wrap.style.setProperty('--lp-logo-ink', tokens.ink);
  }

  function inkFromSrc(el) {
    var src = (el.getAttribute('src') || '').toLowerCase();
    if (src.indexOf('white') >= 0 || src.indexOf('-wh') >= 0) return 'light';
    if (src.indexOf('black') >= 0 || src.indexOf('-bk') >= 0) return 'dark';
    return null;
  }

  function parseRgb(color) {
    if (!color) return null;
    var m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (m) return { r: +m[1], g: +m[2], b: +m[3] };
    var hx = color.replace('#', '').trim();
    if (hx.length === 3) hx = hx.charAt(0) + hx.charAt(0) + hx.charAt(1) + hx.charAt(1) + hx.charAt(2) + hx.charAt(2);
    if (/^[0-9a-fA-F]{6}$/.test(hx)) {
      return { r: parseInt(hx.slice(0, 2), 16), g: parseInt(hx.slice(2, 4), 16), b: parseInt(hx.slice(4, 6), 16) };
    }
    return null;
  }

  function isDarkBackground(el) {
    if (!el || !global.getComputedStyle) return false;
    var node = el.parentElement;
    var hops = 0;
    while (node && node !== global.document.body && node !== global.document.documentElement && hops < 8) {
      var cs = global.getComputedStyle(node);
      var bg = (cs.backgroundColor || '').trim();
      var rgb = parseRgb(bg);
      if (rgb && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        var lum = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
        if (lum < 145) return true;
        if (lum > 175) return false;
      }
      var theme = node.getAttribute && (node.getAttribute('data-lp-site-theme') || node.getAttribute('data-theme'));
      if (theme === 'command-dark') return true;
      if (node.classList) {
        if (node.classList.contains('nav') || node.classList.contains('sec-gum') || node.tagName === 'FOOTER') return true;
      }
      node = node.parentElement;
      hops += 1;
    }
    return false;
  }

  function resolveInkMode(el) {
    var explicit = el.getAttribute('data-lp-logo-ink');
    if (explicit === 'light' || explicit === 'dark') return explicit;
    if (isDarkBackground(el)) return 'light';
    return inkFromSrc(el);
  }

  function mountLogo(el, opts) {
    if (!el || el.dataset.lpLogoMounted === 'true') return Promise.resolve(el);
    opts = opts || {};

    return loadSvgMarkup().then(function (markup) {
      var wrap = el.classList && el.classList.contains('lp-logo-wrap') ? el : wrapFromElement(el);
      var inkMode = resolveInkMode(el);
      var tokens = logoTokens({
        accent: opts.accent || el.getAttribute('data-lp-logo-accent'),
        ink: opts.ink || (inkMode === 'light' ? '#f3f6fa' : inkMode === 'dark' ? '#13161b' : null),
        inkMode: inkMode,
        theme: opts.theme,
        pulse: opts.pulse
      });
      applyTokens(wrap, tokens);

      if (shouldPulse(wrap, opts)) wrap.classList.add('lp-logo-pulse');

      wrap.innerHTML = markup;
      var svg = wrap.querySelector('svg');
      if (svg) {
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        if (!svg.getAttribute('role')) svg.removeAttribute('role');
      }

      if (el !== wrap && el.parentNode) el.parentNode.replaceChild(wrap, el);
      wrap.dataset.lpLogoMounted = 'true';
      if (isMarketingHost()) {
        wrap.style.width = '300px';
        wrap.style.maxWidth = 'min(300px, 70vw)';
        wrap.style.height = 'auto';
        if (!el.getAttribute('data-lp-logo-ink') || el.getAttribute('data-lp-logo-ink') === 'auto') {
          applyTokens(wrap, { accent: tokens.accent, ink: '#f3f6fa' });
        }
      }
      return wrap;
    });
  }

  function upgradeAll(opts) {
    if (!global.document) return Promise.resolve();
    opts = opts || {};
    var nodes = [];
    global.document.querySelectorAll('[data-lp-logo], .leadpages-logo, img[src*="leadpages-logo"]').forEach(function (el) {
      if (el.tagName === 'IMG' || el.hasAttribute('data-lp-logo') || el.classList.contains('leadpages-logo')) {
        nodes.push(el);
      }
    });
    return Promise.all(nodes.map(function (el) { return mountLogo(el, opts); }));
  }

  function applyWorkspaceTheme() {
    if (!global.document) return;
    var theme = resolvedWorkspaceTheme();
    var tokens = logoTokens({ theme: theme });
    var root = global.document.documentElement;
    root.style.setProperty('--lp-logo-accent', tokens.accent);
    root.style.setProperty('--lp-logo-ink', tokens.ink);
    global.document.querySelectorAll('.lp-logo-wrap.leadpages-logo, [data-lp-logo].lp-logo-wrap').forEach(function (wrap) {
      applyTokens(wrap, tokens);
    });
  }

  function isMarketingHost() {
    var host = (global.location && global.location.hostname) || '';
    var path = (global.location && global.location.pathname) || '';
    if (!/^(www\.)?leadpages\.(com\.au|webculture\.au)$/i.test(host)) return false;
    if (global.document && global.document.body) {
      if (global.document.body.getAttribute('data-lp-admin-page')) return false;
      if (global.document.body.classList.contains('lp-cmd-on')) return false;
    }
    if (/^\/(manage|partner-dashboard|partners-admin|apps-admin|marketplace-admin)(\/|$)/.test(path)) return false;
    return true;
  }

  function loadStylesheet(href) {
    if (!global.document || global.document.querySelector('link[href="' + href + '"]')) return;
    var link = global.document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    global.document.head.appendChild(link);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (!global.document) return resolve();
      if (global.document.querySelector('script[src="' + src + '"]')) return resolve();
      var s = global.document.createElement('script');
      s.src = src;
      s.defer = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('script ' + src)); };
      global.document.body.appendChild(s);
    });
  }

  function maybeBootMarketingA11y() {
    if (!isMarketingHost() || !global.document) return;
    if (global.__LP_VISITOR_A11Y__ && global.__LP_VISITOR_A11Y__.enabled === false) return;
    if (!global.__LP_VISITOR_A11Y__) {
      global.__LP_VISITOR_A11Y__ = {
        enabled: true,
        position: 'bottom-right',
        defaults: {
          allowColorSchemes: true,
          colorScheme: 'brand',
          defaultTextSize: 'standard',
          defaultContrast: 'standard',
          reducedMotionSupport: true,
          showAccessibilityButton: true,
          allowVisitorControls: true
        }
      };
    }
    loadStylesheet('/assets/lp-visitor-themes.css');
    loadStylesheet('/assets/lp-visitor-schemes.css');
    loadStylesheet('/assets/lp-visitor-accessibility.css');
    loadScript('/assets/lp-visitor-schemes.js')
      .then(function () { return loadScript('/assets/lp-visitor-accessibility.js'); })
      .catch(function () { /* optional */ });
  }

  function init() {
    upgradeAll({ pulse: true }).then(function () {
      applyWorkspaceTheme();
      maybeBootMarketingA11y();
    });
    if (global.document) {
      global.document.addEventListener('lp-workspace-appearance-change', function () {
        applyWorkspaceTheme();
        upgradeAll({ pulse: true });
      });
    }
  }

  global.LPLogo = {
    SVG_URL: SVG_URL,
    THEME_LOGO: THEME_LOGO,
    loadSvgMarkup: loadSvgMarkup,
    logoTokens: logoTokens,
    mountLogo: mountLogo,
    upgradeAll: upgradeAll,
    applyWorkspaceTheme: applyWorkspaceTheme,
    init: init
  };

  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
