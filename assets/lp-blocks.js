/* LeadPages design blocks — new layouts for existing apps, created by AI Composer.
 *
 * A block is data in the site config:
 *   config.blockLayouts[id] = { app, name, template, css, fields: { scalars, lists } }
 *   config.sections[app].blockLayout = id      ← the app uses that block
 * The block reads the app's own content fields, so the section stays editable in the
 * normal editor. The template is checked server-side (lib/ai-composer/blocks.js) and
 * every value is escaped here; URLs are limited to http(s), relative, #, tel: and mailto:.
 * Works in Node too (module.exports) so tests can render templates.
 */
(function (root) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function txt(v) { return v == null ? '' : (typeof v === 'object' ? '' : String(v)); }
  function safeUrl(v) {
    var u = String(v == null ? '' : v).trim();
    if (!u) return '';
    if (/^(https?:\/\/|\/(?!\/)|#|tel:|mailto:)/i.test(u)) return u;
    return '';
  }
  function getPath(obj, path) {
    return String(path).split('.').reduce(function (o, k) { return o && typeof o === 'object' ? o[k] : undefined; }, obj);
  }

  /** Data the template can see: the app's fields by short name, its lists, brand info. */
  function contextFor(block, C) {
    var ctx = { scalars: {}, lists: {} };
    var f = block.fields || {};
    Object.keys(f.scalars || {}).forEach(function (n) { ctx.scalars[n] = getPath(C, f.scalars[n].path); });
    Object.keys(f.lists || {}).forEach(function (n) {
      var arr = getPath(C, f.lists[n].path);
      ctx.lists[n] = Array.isArray(arr) ? arr.filter(function (it) { return it && it.on !== false; }) : [];
    });
    ctx.brand = { name: txt(C.businessName || C.name), phone: txt(C.phoneText || C.phone) };
    return ctx;
  }

  function icon(name, icons) {
    var n = String(name || '').trim();
    if (!/^[a-z0-9-]+$/.test(n) || !icons || !icons[n]) return '';
    return '<svg class="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[n] + '</svg>';
  }

  function empty(v) {
    if (Array.isArray(v)) return v.length === 0;
    return String(v == null ? '' : v).trim() === '';
  }

  /** Placeholders inside one scope (item first, then the section). */
  function fill(part, scope, ctx, icons, index) {
    // Conditionals: {{?name}} … {{/name}}
    part = part.replace(/\{\{\s*\?\s*([a-zA-Z][\w]*)\s*\}\}([\s\S]*?)\{\{\s*\/\s*\1\s*\}\}/g, function (_m, name, inner) {
      var v = scope && Object.prototype.hasOwnProperty.call(scope, name) ? scope[name]
        : (Object.prototype.hasOwnProperty.call(ctx.lists, name) ? ctx.lists[name] : ctx.scalars[name]);
      return empty(v) ? '' : inner;
    });
    return part.replace(/(src|href)?(=")?\{\{\s*([a-zA-Z@][\w.:@]*)\s*\}\}/g, function (m, attr, eq, name) {
      var lead = (attr || '') + (eq || '');
      var v;
      if (name === '@n') v = index != null ? String(index + 1) : '';
      else if (name === '@nn') v = index != null ? (index + 1 < 10 ? '0' : '') + (index + 1) : '';
      else if (name === 'brand.name') v = ctx.brand.name;
      else if (name === 'brand.phone') v = ctx.brand.phone;
      else if (name.indexOf('icon:') === 0) {
        var iname = name.slice(5);
        var iv = scope && scope[iname] != null ? scope[iname] : ctx.scalars[iname];
        return lead + icon(iv, icons);
      } else {
        v = scope && Object.prototype.hasOwnProperty.call(scope, name) ? scope[name] : ctx.scalars[name];
      }
      if (attr && eq) return lead + esc(safeUrl(v));
      return lead + esc(txt(v)).replace(/\n/g, '<br>');
    });
  }

  /** Render a block template to HTML. */
  function render(block, C, icons) {
    var ctx = contextFor(block, C);
    var tpl = String(block.template || '');
    // Lists: {{#name}} … {{/name}} (no nesting).
    tpl = tpl.replace(/\{\{\s*#\s*([a-zA-Z][\w]*)\s*\}\}([\s\S]*?)\{\{\s*\/\s*\1\s*\}\}/g, function (_m, name, inner) {
      var items = ctx.lists[name] || [];
      return items.map(function (it, i) { return fill(inner, it, ctx, icons, i); }).join('');
    });
    return fill(tpl, null, ctx, icons, null);
  }

  var api = { render: render, safeUrl: safeUrl, esc: esc };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  /* ---------------- browser ---------------- */
  var LAST = null;
  function cfgOf() { return LAST || root.__lpLiveCfg || ((typeof SITE_CONFIG !== 'undefined') ? SITE_CONFIG : null); }
  function ensureBaseCss() {
    if (document.getElementById('lpb-base')) return;
    var st = document.createElement('style');
    st.id = 'lpb-base';
    st.textContent = '[data-sec].lpb-on{padding:0!important;min-height:0!important;background-image:none!important}[data-sec].lpb-on>:not([data-lpb]):not(.lp-seclabel){display:none!important}.lpb{text-align:left;text-transform:none;letter-spacing:normal;color:var(--steel-900)}.lpb *{box-sizing:border-box}[data-lpb] img{max-width:100%;height:auto}[data-lpb] .lp-ic{width:1.4em;height:1.4em;vertical-align:middle}';
    document.head.appendChild(st);
  }
  function run(cfg) {
    if (cfg) LAST = cfg;
    var C = cfgOf();
    if (!C) return;
    var defs = C.blockLayouts || {};
    var S = C.sections || {};
    ensureBaseCss();
    var icons = root.LP_ICONS || {};
    // Clear old blocks (layout switched back, or re-render after an edit).
    Array.prototype.forEach.call(document.querySelectorAll('[data-lpb]'), function (n) { n.parentNode.removeChild(n); });
    Array.prototype.forEach.call(document.querySelectorAll('.lpb-on'), function (n) { n.classList.remove('lpb-on'); });
    Object.keys(defs).forEach(function (id) {
      var b = defs[id];
      if (!b || !b.app || !S[b.app] || S[b.app].blockLayout !== id || S[b.app].on === false) return;
      var node = document.querySelector('[data-sec="' + b.app + '"]');
      if (!node) return;
      var cssId = 'lpb-css-' + id.replace(/[^\w-]/g, '');
      if (!document.getElementById(cssId)) {
        var st = document.createElement('style'); st.id = cssId; st.textContent = String(b.css || ''); document.head.appendChild(st);
      }
      var html;
      try { html = render(b, C, icons); } catch (e) { try { console.warn('[lp-blocks]', id, e && e.message); } catch (_x) {} return; }
      node.insertAdjacentHTML('beforeend', '<div class="lpb lpb-' + esc(id.replace(/[^\w-]/g, '')) + '" data-lpb="' + esc(id) + '">' + html + '</div>');
      node.classList.add('lpb-on');
    });
  }
  var BOUND = false;
  function bind() {
    if (BOUND) return;
    var o = root.__applyTradeConfig;
    if (typeof o === 'function' && !o.__lpbWrapped) {
      var w = function (cfg) {
        var r, err = null;
        try { r = o.apply(this, arguments); } catch (e) { err = e; }
        try { run(cfg); } catch (e) {}
        if (err) throw err;
        return r;
      };
      w.__lpbWrapped = true;
      root.__applyTradeConfig = w;
      BOUND = true;
    }
  }
  function init() { bind(); run(); }
  if (document.readyState !== 'loading') init(); else document.addEventListener('DOMContentLoaded', init);
  setTimeout(bind, 0);
  root.addEventListener('load', function () { setTimeout(function () { bind(); run(); }, 80); });
  root.__lpBlocksRun = run;
})(typeof window !== 'undefined' ? window : this);
