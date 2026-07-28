/**
 * Custom HTML marketplace app — embedded (not iframe), responsive mount.
 * Config: sections.customHtml = { on, html, cssUrls[], jsUrls[], fullBleed, title, bg }
 */
(function (global) {
  'use strict';

  var ATTR = 'data-lp-custom-html';
  var LOADED = 'data-lp-ch-loaded';

  function arr(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(Boolean).map(String);
    if (typeof v === 'string' && v.trim()) return [v.trim()];
    return [];
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

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (!src) return resolve();
      var existing = document.querySelector('script[data-lp-ch-src="' + src.replace(/"/g, '') + '"]');
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

  function chainScripts(urls) {
    var i = 0;
    function next() {
      if (i >= urls.length) return Promise.resolve();
      var u = urls[i++];
      return loadScript(u).then(next);
    }
    return next();
  }

  function mountIdFor(el) {
    if (!el.id) el.id = 'lp-ch-' + Math.random().toString(36).slice(2, 9);
    return el.id;
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

      var sec = el.closest ? el.closest('[data-sec="customHtml"]') : null;
      if (sec) {
        if (cfg.on === true) {
          sec.style.display = '';
          sec.style.removeProperty('display');
        } else {
          sec.style.display = 'none';
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

      cssUrls.forEach(function (href) { ensureLink(href, mid); });

      // Avoid re-injecting identical HTML (keeps in-app state on soft re-apply)
      var sig = html.length + ':' + cssUrls.join('|') + ':' + jsUrls.join('|');
      if (el.getAttribute(LOADED) === sig && el.getAttribute('data-lp-ch-has') === '1') {
        return;
      }
      el.innerHTML = html;
      el.setAttribute('data-lp-ch-has', html ? '1' : '0');
      el.setAttribute(LOADED, sig);

      if (jsUrls.length) {
        chainScripts(jsUrls).catch(function (err) {
          try { console.warn('[customHtml]', err && err.message ? err.message : err); } catch (e) {}
        });
      }
    });
  }

  function fromSiteConfig(C) {
    C = C || global.__SITE_CONFIG__ || {};
    var sec = (C.sections && C.sections.customHtml) || {};
    applyCustomHtml(sec, document);
  }

  // Hook after applyCfg when present
  var _apply = global.applyCfg;
  if (typeof _apply === 'function' && !_apply.__lpCustomHtmlWrapped) {
    global.applyCfg = function (C) {
      var r = _apply.apply(this, arguments);
      try { fromSiteConfig(C || arguments[0]); } catch (e) {}
      return r;
    };
    global.applyCfg.__lpCustomHtmlWrapped = true;
  }

  global.lpApplyCustomHtml = applyCustomHtml;
  global.lpRefreshCustomHtml = fromSiteConfig;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { fromSiteConfig(); });
  } else {
    fromSiteConfig();
  }
})(typeof window !== 'undefined' ? window : globalThis);
