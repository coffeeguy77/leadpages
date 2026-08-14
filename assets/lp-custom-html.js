/**
 * Custom HTML marketplace app — embedded (not iframe), responsive mount.
 * Config: sections.customHtml = { on, html, cssUrls[], jsUrls[], cssVars{}, fullBleed, title, bg }
 *
 * Uses window.__lpLiveCfg (page-hybrid merge) when present so homepage defaults
 * cannot wipe a landing-page unique Custom HTML pack after boot.
 *
 * Important: HTML assigned via innerHTML does not run <script> tags. Packs that
 * embed inline JS (e.g. Payment Run Analyser) must be re-hydrated after inject.
 */
(function (global) {
  'use strict';

  var ATTR = 'data-lp-custom-html';
  var LOADED = 'data-lp-ch-loaded';
  var activatedMounts = typeof WeakSet !== 'undefined' ? new WeakSet() : null;

  function arr(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(Boolean).map(String);
    if (typeof v === 'string' && v.trim()) return [v.trim()];
    return [];
  }

  function resolveCfg(C) {
    return C || global.__lpLiveCfg || global.__SITE_CONFIG__ || {};
  }

  function ensureLink(href, mountId) {
    if (!href) return;
    var id = 'lp-ch-css-' + mountId + '-' + href.replace(/[^\w.-]+/g, '_').slice(0, 80);
    if (document.getElementById(id)) return;
    var link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function loadScript(src, force) {
    return new Promise(function (resolve, reject) {
      if (!src) return resolve();
      var sel = 'script[data-lp-ch-src="' + src.replace(/"/g, '') + '"]';
      var existing = document.querySelector(sel);
      if (existing && force) {
        try { existing.remove(); } catch (e) {}
        existing = null;
      }
      if (existing) {
        if (existing.getAttribute('data-lp-ch-ready') === '1') return resolve();
        existing.addEventListener('load', function () { resolve(); });
        existing.addEventListener('error', function () { reject(new Error('script failed: ' + src)); });
        return;
      }
      var s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.setAttribute('data-lp-ch-src', src);
      s.onload = function () {
        s.setAttribute('data-lp-ch-ready', '1');
        resolve();
      };
      s.onerror = function () { reject(new Error('script failed: ' + src)); };
      document.body.appendChild(s);
    });
  }

  function chainScripts(urls, force) {
    var i = 0;
    function next() {
      if (i >= urls.length) return Promise.resolve();
      var u = urls[i++];
      return loadScript(u, force).then(next);
    }
    return next();
  }

  /**
   * innerHTML does not execute <script> tags. Replace each script node so the
   * browser runs it (inline IIFEs and src scripts). Used by packs that paste
   * full HTML+JS into the Custom HTML editor (Payment Run Analyser, etc.).
   */
  function runInlineScripts(mount) {
    if (!mount || !mount.querySelectorAll) return;
    var list = mount.querySelectorAll('script');
    Array.prototype.forEach.call(list, function (old) {
      var s = document.createElement('script');
      var attrs = old.attributes || [];
      for (var i = 0; i < attrs.length; i++) {
        s.setAttribute(attrs[i].name, attrs[i].value);
      }
      if (!old.src) s.text = old.textContent || '';
      s.setAttribute('data-lp-ch-inline', '1');
      if (old.parentNode) old.parentNode.replaceChild(s, old);
    });
  }

  /**
   * Pack scripts often bind listeners at load time. Landing hybrid remounts #top
   * after that, so we must re-bind without re-evaluating the script (const clash).
   */
  function invokePackInits(el) {
    try {
      if (typeof global.lpTransferMatcherInit === 'function' && el.querySelector && el.querySelector('#tm-root')) {
        global.lpTransferMatcherInit(el);
      }
    } catch (e) {
      try { console.warn('[customHtml] transferMatcher init', e && e.message ? e.message : e); } catch (e2) {}
    }
    try {
      if (typeof global.lpCustomHtmlPackInit === 'function') {
        global.lpCustomHtmlPackInit(el);
      }
    } catch (e) {
      try { console.warn('[customHtml] pack init', e && e.message ? e.message : e); } catch (e2) {}
    }
    try {
      if (typeof CustomEvent === 'function') {
        el.dispatchEvent(new CustomEvent('lp-custom-html:ready', { bubbles: true, detail: { mount: el } }));
      }
    } catch (e) {}
  }

  function ensureScriptsAndInit(el, jsUrls) {
    var run = function () {
      invokePackInits(el);
      if (activatedMounts) activatedMounts.add(el);
    };
    if (!jsUrls.length) {
      run();
      return Promise.resolve();
    }
    // Never force-remove classic scripts that use top-level const — re-init instead.
    return chainScripts(jsUrls, false).then(run).catch(function (err) {
      try { console.warn('[customHtml]', err && err.message ? err.message : err); } catch (e) {}
      run();
    });
  }

  function mountIsActivated(el) {
    if (activatedMounts) return activatedMounts.has(el);
    return false;
  }

  function mountNeedsHydrate(el) {
    if (!mountIsActivated(el)) return true;
    var tm = el.querySelector && el.querySelector('#tm-root');
    if (tm && tm.getAttribute('data-tm-bound') !== '1') return true;
    // Cloned inert <script> nodes still need a fresh execute pass
    var scripts = el.querySelectorAll ? el.querySelectorAll('script') : [];
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].getAttribute('data-lp-ch-inline') !== '1') return true;
    }
    return false;
  }

  function mountIdFor(el) {
    if (!el.id) el.id = 'lp-ch-' + Math.random().toString(36).slice(2, 9);
    return el.id;
  }

  function normVarName(raw) {
    var k = String(raw || '').trim();
    if (!k) return '';
    if (k.charAt(0) !== '-') k = '--' + k.replace(/^-+/, '');
    return /^--[a-zA-Z0-9_-]+$/.test(k) ? k : '';
  }

  function normHex(raw) {
    var v = String(raw || '').trim();
    if (!v) return '';
    if (v.charAt(0) !== '#') v = '#' + v;
    if (/^#[0-9a-fA-F]{3}$/.test(v)) {
      v = '#' + v.charAt(1) + v.charAt(1) + v.charAt(2) + v.charAt(2) + v.charAt(3) + v.charAt(3);
    }
    return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : '';
  }

  /**
   * Apply per-site CSS variable colour overrides without rewriting the shared stylesheet.
   * Injected after pack CSS so overrides win light + dark pack defaults.
   */
  function applyCssVars(vars, el, mid) {
    var id = 'lp-ch-vars-' + mid;
    var style = document.getElementById(id);
    var map = vars && typeof vars === 'object' && !Array.isArray(vars) ? vars : {};
    var decls = [];
    Object.keys(map).forEach(function (rawKey) {
      var key = normVarName(rawKey);
      var hex = normHex(map[rawKey]);
      if (key && hex) decls.push(key + ':' + hex + ' !important');
    });
    if (!decls.length) {
      if (style && style.parentNode) style.parentNode.removeChild(style);
      return;
    }
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      style.setAttribute('data-lp-ch-vars', '1');
      document.head.appendChild(style);
    }
    // Scope to this mount (+ nested pack roots)
    var sel = '#' + mid + ', #' + mid + ' #tm-root, #' + mid + ' #pa-root';
    style.textContent = sel + '{' + decls.join(';') + '}';
  }

  function applyCustomHtml(cfg, root) {
    cfg = cfg || {};
    root = root || document;
    var nodes = root.querySelectorAll
      ? root.querySelectorAll('[' + ATTR + ']')
      : [];
    if (!nodes.length && root.getAttribute && root.getAttribute(ATTR) != null) {
      nodes = [root];
    }
    Array.prototype.forEach.call(nodes, function (el) {
      var mid = mountIdFor(el);
      var html = cfg.html != null ? String(cfg.html) : '';
      var cssUrls = arr(cfg.cssUrls || cfg.css);
      var jsUrls = arr(cfg.jsUrls || cfg.js);
      var fullBleed = cfg.fullBleed !== false;
      var isOn = cfg.on === true;

      var sec = el.closest ? el.closest('[data-sec="customHtml"]') : null;
      if (sec) {
        // Templates default customHtml to display:none; beat that + !important toggles.
        if (isOn) {
          sec.style.setProperty('display', 'block', 'important');
        } else {
          sec.style.setProperty('display', 'none', 'important');
        }
        if (cfg.bg) sec.style.background = cfg.bg;
        else sec.style.background = '';
        sec.classList.toggle('lp-ch-fullbleed', !!fullBleed);
        var titleEl = sec.querySelector('.lp-ch-title');
        if (titleEl) {
          var t = String(cfg.title || '').trim();
          titleEl.textContent = t;
          titleEl.style.display = t ? '' : 'none';
        }
      }

      if (!isOn) {
        applyCssVars(null, el, mid);
        // Keep mount empty while off so homepage off-state can't leave stale HTML
        if (el.getAttribute('data-lp-ch-has') === '1' && !html) {
          el.innerHTML = '';
          el.setAttribute('data-lp-ch-has', '0');
          el.removeAttribute(LOADED);
        }
        return;
      }

      cssUrls.forEach(function (href) { ensureLink(href, mid); });
      // Colour overrides always refresh (do not require HTML remount)
      applyCssVars(cfg.cssVars, el, mid);

      // Avoid re-injecting identical HTML (keeps in-app state on soft re-apply),
      // but always hydrate when this mount node is new (landing hybrid remount)
      // or when inline <script> tags have not been executed in this document.
      var sig = html.length + ':' + cssUrls.join('|') + ':' + jsUrls.join('|');
      var samePack = el.getAttribute(LOADED) === sig && el.getAttribute('data-lp-ch-has') === '1';
      var needsHydrate = mountNeedsHydrate(el);
      if (samePack && html && !needsHydrate) {
        return;
      }
      if (!samePack) {
        el.innerHTML = html;
        el.setAttribute('data-lp-ch-has', html ? '1' : '0');
        el.setAttribute(LOADED, sig);
      }

      if (html) {
        // Critical: execute inline <script> from pasted HTML packs
        runInlineScripts(el);
        ensureScriptsAndInit(el, jsUrls);
      }
    });
  }

  function fromSiteConfig(C) {
    C = resolveCfg(C);
    var sec = (C.sections && C.sections.customHtml) || {};
    applyCustomHtml(sec, document);
  }

  // Hook after applyCfg when present
  var _apply = global.applyCfg;
  if (typeof _apply === 'function' && !_apply.__lpCustomHtmlWrapped) {
    global.applyCfg = function (C) {
      var r = _apply.apply(this, arguments);
      try {
        var next = C || arguments[0];
        if (next) global.__lpLiveCfg = next;
        fromSiteConfig(next);
      } catch (e) {}
      return r;
    };
    global.applyCfg.__lpCustomHtmlWrapped = true;
  }

  global.lpApplyCustomHtml = applyCustomHtml;
  global.lpRefreshCustomHtml = fromSiteConfig;
  global.lpRunCustomHtmlInlineScripts = runInlineScripts;

  // Initial paint: prefer live (hybrid) cfg so a late home SITE_CONFIG cannot wipe the pack.
  function boot() {
    fromSiteConfig(global.__lpLiveCfg || global.__SITE_CONFIG__);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
