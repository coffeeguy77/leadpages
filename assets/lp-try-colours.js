/**
 * LeadPages "Try colours" for customer sites (Nov 2026).
 *
 * The same colour picker as leadpages.com.au: a "Try colours" button (bottom left) opens the
 * ten LeadPages schemes — Culture Lime, Basalt, Rivet, Tarmac, Petal, Willow, Orchid, Dune,
 * Neon Pink, Electric Blue — plus "Site colours" to go back. A pick lasts for the visit only
 * (sessionStorage); the site's saved colours never change.
 *
 * Loaded by api/render.js only when config.sections.tryColours.on === true.
  *   config.sections.tryColours = { on: true, schemes: ['culture','basalt',…] (optional subset), label: 'Try colours' }
 *
 * How a scheme is applied:
 *   1. the theme tokens (--pipe, --hivis, --steel-900, --light, --ink …) are overridden by a
 *      stylesheet (!important, because the template sets them inline on <html>);
 *   2. any inline colour on the page that equals one of the site's own theme colours
 *      (e.g. a section whose background was typed in as the brand blue) is swapped to the
 *      matching scheme colour, and put back on "Site colours".
 */
(function (w, d) {
  'use strict';
  if (w.__lpTryColours) return;
  w.__lpTryColours = true;

  var SCHEMES = [
    { id: 'culture', name: 'Culture Lime', blurb: 'The signature forest and lime look.', primary: '#C5E13F', ink: '#0B2114', bg: '#FDFCF0', surface: '#F5F2E6', muted: '#5C6B60', glow: '#C5E13F' },
    { id: 'basalt', name: 'Basalt', blurb: 'Charcoal ground with a copper spark.', primary: '#D97706', ink: '#141414', bg: '#F7F4EF', surface: '#EDE8E1', muted: '#6B6560', glow: '#F59E0B' },
    { id: 'rivet', name: 'Rivet', blurb: 'Deep navy with a sharp signal accent.', primary: '#F97316', ink: '#0B1C33', bg: '#F4F7FB', surface: '#E8EEF5', muted: '#5A6B7D', glow: '#FB923C' },
    { id: 'tarmac', name: 'Tarmac', blurb: 'Near-black with an electric teal edge.', primary: '#14B8A6', ink: '#0A0F14', bg: '#F3F6F7', surface: '#E6ECEE', muted: '#5C6A70', glow: '#2DD4BF' },
    { id: 'petal', name: 'Petal', blurb: 'Soft rose warmth on cream.', primary: '#E8A0A8', ink: '#3D2A32', bg: '#FFF8F7', surface: '#F8ECEC', muted: '#7A646A', glow: '#F0B7BD' },
    { id: 'willow', name: 'Willow', blurb: 'Calm sage and soft daylight green.', primary: '#8FAE6B', ink: '#243028', bg: '#F7F9F3', surface: '#EBEEE4', muted: '#66705F', glow: '#A8C285' },
    { id: 'orchid', name: 'Orchid', blurb: 'Quiet mauve with a polished finish.', primary: '#B28BB8', ink: '#2C2130', bg: '#FBF7FC', surface: '#F1EAF3', muted: '#6F6274', glow: '#C9A5CE' },
    { id: 'dune', name: 'Dune', blurb: 'Warm sand and terracotta.', primary: '#C47A4A', ink: '#2B2118', bg: '#FBF6EF', surface: '#F1E7DA', muted: '#736557', glow: '#D49264' },
    { id: 'neon-pink', name: 'Neon Pink', blurb: 'Dark pink neon on deep plum.', primary: '#FF4DA6', ink: '#140F14', bg: '#FFF0F7', surface: '#F8E0ED', muted: '#8F7084', glow: '#FF6BB8' },
    { id: 'electric-blue', name: 'Electric Blue', blurb: 'Electric blue on midnight navy.', primary: '#3B9EFF', ink: '#0A1524', bg: '#EEF5FF', surface: '#E0ECFA', muted: '#5A6B80', glow: '#5CB0FF' }
  ];
  w.LPTryColours = { SCHEMES: SCHEMES };
  /** Token CSS + light flag for a scheme (also used by api/render.js for the early <head> boot). */
  w.LPTryColours.early = function (id) {
    for (var i = 0; i < SCHEMES.length; i++) if (SCHEMES[i].id === id) { var r = roles(SCHEMES[i]); return [tokenCss(r), r.onPrimary !== '#FFFFFF' ? 1 : 0]; }
    return null;
  };
  if (!d) return;   // loaded on the server just for the token CSS

  var CFG = w.__LP_TRY_COLOURS__ || {};
  var SC = (typeof SITE_CONFIG !== 'undefined') ? SITE_CONFIG : (w.SITE_CONFIG || {});
  var KEY = 'lp-try-colours:' + (SC.slug || SC.siteId || 'site');

  /* ---------- colour maths ---------- */
  function parse(hex) {
    var h = String(hex || '').trim().replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function hex(c) { return '#' + c.map(function (x) { return ('0' + Math.max(0, Math.min(255, Math.round(x))).toString(16)).slice(-2); }).join(''); }
  function shade(h, pct) { var c = parse(h); if (!c) return h; var f = pct / 100; return hex(c.map(function (x) { return x + (pct < 0 ? x : 255 - x) * f; })); }
  function mix(a, b, t) { var ca = parse(a), cb = parse(b); if (!ca || !cb) return a; return hex(ca.map(function (x, i) { return x + (cb[i] - x) * t; })); }
  function lum(h) {
    var c = parse(h); if (!c) return 0;
    var l = c.map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
  }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function rgbKey(v) {
    var m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(String(v || ''));
    if (m) return hex([+m[1], +m[2], +m[3]]).toLowerCase();
    var c = parse(v); return c ? hex(c).toLowerCase() : '';
  }

  /** Everything a scheme needs, derived the same way for every site. */
  function roles(p) {
    var lightPrimary = contrast(p.primary, '#FFFFFF') < 2.6;
    // Links / accent text must read on the page background.
    var accentText = p.primary;
    for (var i = 0; i < 6 && contrast(accentText, p.bg) < 3.2; i++) accentText = mix(accentText, p.ink, 0.25);
    // Dark bands (header bars, feature strips, footers) get a deep shade of the scheme colour,
    // not the near-black ink, so the scheme shows on them; white text must still read (>= 4.8:1).
    var deep = mix(p.primary, p.ink, 0.6);
    for (var j = 0; j < 6 && contrast(deep, '#FFFFFF') < 4.8; j++) deep = mix(deep, p.ink, 0.3);
    return {
      deep: deep,
      primary: p.primary,
      primaryDeep: shade(p.primary, -14),
      onPrimary: lightPrimary ? p.ink : '#FFFFFF',
      accentText: accentText,
      dark: p.ink,
      darker: shade(p.ink, -18),
      darkCard: mix(p.ink, p.muted, 0.25),
      bg: p.bg,
      surface: p.surface,
      muted: p.muted,
      line: mix(p.surface, p.muted, 0.22),
      glow: p.glow || p.primary
    };
  }

  /* ---------- 1. theme tokens ---------- */
  function tokenCss(r) {
    var v = {
      '--pipe': r.accentText, '--pipe-deep': shade(r.accentText, -14), '--pipe-glow': r.glow,
      '--hivis': r.primary, '--hivis-600': r.primaryDeep, '--safety': r.glow,
      '--steel-950': shade(r.deep, -35), '--steel-900': r.deep, '--steel-800': mix(r.deep, r.muted, 0.25),
      '--light': r.bg, '--ink': r.dark, '--muted': r.muted, '--line': r.line,
      '--lp-btn-bg': r.primary, '--lp-btn-fg': r.onPrimary, '--lp-btn-stroke': r.primary,
      '--lp-logo-accent': r.primary, '--lptc-on-primary': r.onPrimary
    };
    return 'html[data-lp-try]{' + Object.keys(v).map(function (k) { return k + ':' + v[k] + ' !important'; }).join(';') + '}' +
      'html[data-lp-try] body{background-color:' + r.bg + '}';
  }

  /* ---------- 2. colours on the page that equal the site's theme colours ---------- */
  // Each element keeps its own originals in data-lptc-o, so copies the template makes (slider
  // slides, re-drawn sections) restore and re-colour correctly, and a scheme never "sticks".
  var COLOUR_PROPS = ['background-color', 'color', 'border-color', 'border-top-color', 'border-bottom-color', 'border-left-color', 'border-right-color', 'fill', 'stroke', 'outline-color', 'text-decoration-color'];
  var OWN_STYLES = /^(lptc-|lpch-|lp-theme-vars$)/;

  /** site theme colour (lowercase hex) → which role it plays. */
  function themeRoles() {
    var th = SC.theme || {};
    var out = {};
    function put(h, role) { var k = rgbKey(h); if (k && !out[k]) out[k] = role; }
    // Dark bands first: when brand and dark band are the same colour (common), it acts as the dark.
    put(th.steel, 'dark');
    put(th.hivis, 'primary'); put(th.accent, 'primary');
    put(th.pipe, 'primary');
    put(th.safety, 'glow');
    put(th.lightBg, 'bg');
    return out;
  }

  function targetFor(role, asText, r) {
    if (role === 'primary') return asText ? r.accentText : r.primary;
    if (role === 'dark') return asText ? r.dark : r.deep;
    if (role === 'glow') return r.glow;
    if (role === 'bg') return r.bg;
    return '';
  }
  function isTextProp(prop) {
    return prop === 'color' || (prop.indexOf('--') === 0 && /(^|-)(fg|ink|text|color)$/i.test(prop) && !/(bg|background)/i.test(prop));
  }
  function isBgProp(prop) {
    return prop === 'background-color' || prop === 'background' || (prop.indexOf('--') === 0 && !isTextProp(prop) && /(bg|background|card|fill|band)/i.test(prop));
  }

  function restoreNode(el) {
    var raw = el.getAttribute('data-lptc-o');
    if (raw) {
      var o = {}; try { o = JSON.parse(raw); } catch (e) { o = {}; }
      Object.keys(o).forEach(function (prop) {
        // Only put back a value we changed; if the page has since set something new, keep that.
        if (o[prop].length > 2 && rgbKey(el.style.getPropertyValue(prop)) !== rgbKey(o[prop][2]) && el.style.getPropertyValue(prop).trim() !== String(o[prop][2]).trim()) return;
        if (o[prop][0]) el.style.setProperty(prop, o[prop][0], o[prop][1]); else el.style.removeProperty(prop);
      });
      el.removeAttribute('data-lptc-o');
    }
    if (el.hasAttribute('data-lptc-onlight')) el.removeAttribute('data-lptc-onlight');
  }

  function remapNode(el, map, r) {
    restoreNode(el);
    var st = el.style;
    if (!st || !st.length) return;
    var o = {}, bgRole = '';
    function put(prop, to) { var pr = st.getPropertyPriority(prop); o[prop] = [st.getPropertyValue(prop), pr, to]; st.setProperty(prop, to, pr); }
    var props = [];
    for (var i = 0; i < st.length; i++) props.push(st[i]);
    props.forEach(function (prop) {
      var isVar = prop.indexOf('--') === 0;
      if (!isVar && COLOUR_PROPS.indexOf(prop) < 0) return;
      var k = rgbKey(st.getPropertyValue(prop));
      if (!k || !map[k]) return;
      var to = targetFor(map[k], isTextProp(prop), r);
      if (!to) return;
      put(prop, to);
      if (isBgProp(prop)) bgRole = map[k];
    });
    // The LeadPages footer logo: its pulse rings follow the scheme.
    if (el.classList && el.classList.contains('lp-foot-logo') && st.getPropertyValue('--lp-logo-accent')) put('--lp-logo-accent', r.glow);
    // A light scheme colour behind white text (e.g. lime buttons): switch the text to the scheme's dark.
    if (bgRole === 'primary' && r.onPrimary !== '#FFFFFF') {
      var c = rgbKey(st.getPropertyValue('color'));
      if (c === '#ffffff' || !c) put('color', r.onPrimary);
      el.setAttribute('data-lptc-onlight', '');
    }
    if (Object.keys(o).length) el.setAttribute('data-lptc-o', JSON.stringify(o));
  }

  /** Re-colour a stylesheet's text: every theme colour in a declaration becomes the scheme's. */
  function rewriteCss(css, map, r) {
    return css.replace(/([\w-]+)(\s*:\s*)([^;{}]+)/g, function (all, prop, sep, val) {
      if (!/#[0-9a-fA-F]{3,6}\b|rgba?\(/.test(val)) return all;
      var text = isTextProp(prop.toLowerCase());
      var nv = val.replace(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(\s*\d+[,\s]+\d+[,\s]+\d+\s*(?:[,/]\s*[\d.]+\s*)?\)/g, function (c) {
        if (/rgba\(/i.test(c) && !/,\s*1\s*\)$/.test(c)) return c;   // keep see-through colours
        var k = rgbKey(c);
        return (k && map[k]) ? (targetFor(map[k], text, r) || c) : c;
      });
      return prop + sep + nv;
    });
  }
  function remapStyles(map, r) {
    d.querySelectorAll('style').forEach(function (el) {
      if (OWN_STYLES.test(el.id || '') || el.closest('[data-lptc]')) return;
      var cur = el.textContent;
      if (el.__lptcOut !== cur) el.__lptcOrig = cur;   // new or re-written by the page: that's the original
      var out = rewriteCss(el.__lptcOrig, map, r);
      if (out !== cur) el.textContent = out;
      el.__lptcOut = out;
    });
  }
  function restoreStyles() {
    d.querySelectorAll('style').forEach(function (el) {
      if (el.__lptcOrig != null && el.textContent === el.__lptcOut) el.textContent = el.__lptcOrig;
      el.__lptcOrig = null; el.__lptcOut = null;
    });
  }

  function restoreAll() {
    d.querySelectorAll('[data-lptc-o],[data-lptc-onlight]').forEach(restoreNode);
    restoreStyles();
  }

  var active = null, mo = null, lightTimer = null;
  function remapAll() {
    if (!active) return;
    var map = themeRoles(), r = active.r;
    if (!Object.keys(map).length) return;
    var els = d.querySelectorAll('[style],[data-lptc-o]');
    for (var i = 0; i < els.length; i++) {
      if (els[i].closest('[data-lptc]')) continue;
      remapNode(els[i], map, r);
    }
    remapStyles(map, r);
    markLightBands();
  }

  // Light scheme colour painted as a band (via a stylesheet / variable): text in it uses the dark.
  function markLightBands() {
    clearTimeout(lightTimer);
    if (!active || active.r.onPrimary === '#FFFFFF') return;
    lightTimer = setTimeout(function () {
      if (!active) return;
      var want = rgbKey(active.r.primary);
      d.querySelectorAll('main *, header.site *, footer.site *, [data-sec]').forEach(function (el) {
        if (el.hasAttribute('data-lptc-onlight') || el.closest('a,button,.btn,[data-lptc]')) return;
        if (rgbKey(getComputedStyle(el).backgroundColor) === want) el.setAttribute('data-lptc-onlight', '');
      });
    }, 60);
  }

  function apply(id, persist) {
    var p = null;
    for (var i = 0; i < SCHEMES.length; i++) if (SCHEMES[i].id === id) p = SCHEMES[i];
    if (mo) mo.disconnect();
    restoreAll();
    var style = d.getElementById('lptc-tokens');
    if (!p) {
      active = null;
      d.documentElement.removeAttribute('data-lp-try');
      d.documentElement.removeAttribute('data-lp-try-light');
      if (style) style.textContent = '';
      if (persist !== false) { try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
    } else {
      active = { p: p, r: roles(p) };
      if (!style) { style = d.createElement('style'); style.id = 'lptc-tokens'; d.head.appendChild(style); }
      style.textContent = tokenCss(active.r);
      d.documentElement.setAttribute('data-lp-try', p.id);
      if (active.r.onPrimary !== '#FFFFFF') d.documentElement.setAttribute('data-lp-try-light', ''); else d.documentElement.removeAttribute('data-lp-try-light');
      remapAll();
      if (persist !== false) { try { sessionStorage.setItem(KEY, p.id); } catch (e) { /* ignore */ } }
    }
    syncUi(p ? p.id : '');
    watch();
  }

  // Sections redraw themselves (sub-pages, slider, editor preview). The observer callback runs
  // before the browser paints, so new parts are re-coloured with no flash of the site colours.
  function watch() {
    if (!w.MutationObserver) return;
    if (!active) { if (mo) { mo.disconnect(); mo = null; } return; }
    if (!mo) {
      mo = new MutationObserver(function (list) {
        if (!active) return;
        var relevant = list.some(function (m) {
          var t = m.target.nodeType === 1 ? m.target : m.target.parentNode;
          return !(t && t.closest && t.closest('[data-lptc]'));
        });
        if (!relevant) return;
        mo.disconnect();
        remapAll();
        observe();
      });
    }
    observe();
  }
  function observe() {
    if (!mo || !active) return;
    mo.observe(d.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style'] });
  }

  /* ---------- UI ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function offered() {
    var list = Array.isArray(CFG.schemes) && CFG.schemes.length ? CFG.schemes : null;
    return list ? SCHEMES.filter(function (s) { return list.indexOf(s.id) >= 0; }) : SCHEMES;
  }

  function siteChips() {
    var th = SC.theme || {};
    return [th.lightBg || '#F4F7FB', th.hivis || th.accent || th.pipe || '#1f7bb8', th.steel || '#1a2230'];
  }

  var root, fab, panel;
  function build() {
    if (d.querySelector('[data-lptc]')) return;
    var sc = siteChips();
    var sw = function (id, name, blurb, chips) {
      return '<button type="button" class="lptc-sw" data-lptc-id="' + esc(id) + '" role="radio" aria-checked="false">' +
        '<span class="lptc-chips" aria-hidden="true">' + chips.map(function (c) { return '<span style="background:' + esc(c) + '"></span>'; }).join('') + '</span>' +
        '<span class="lptc-meta"><span class="lptc-name">' + esc(name) + '</span><span class="lptc-blurb">' + esc(blurb) + '</span></span></button>';
    };
    root = d.createElement('div');
    root.className = 'lptc';
    root.setAttribute('data-lptc', '');
    root.innerHTML =
      '<button type="button" class="lptc-fab" aria-expanded="false" aria-controls="lptc-panel">' +
        '<span class="lptc-orb" aria-hidden="true"><span></span><span></span><span></span></span>' +
        '<span class="lptc-fab-label">' + esc(CFG.label || 'Try colours') + '</span></button>' +
      '<div class="lptc-scrim" hidden></div>' +
      '<div class="lptc-panel" id="lptc-panel" role="dialog" aria-modal="false" aria-labelledby="lptc-title" hidden>' +
        '<div class="lptc-head"><p class="lptc-eyebrow">Live colour studio</p><h2 class="lptc-title" id="lptc-title">Pick a colour scheme</h2>' +
          '<p class="lptc-lede">See this site in a different colour scheme. Only you see it, and only for this visit.</p>' +
          '<button type="button" class="lptc-close" aria-label="Close colours">&times;</button></div>' +
        '<div class="lptc-grid" role="radiogroup" aria-label="Colour schemes">' +
          offered().map(function (p) { return sw(p.id, p.name, p.blurb, [p.bg, p.primary, p.ink]); }).join('') +
        '</div>' +
        '<div class="lptc-foot">' + sw('', 'Site colours', 'Back to this site’s own colours.', sc).replace('lptc-sw"', 'lptc-sw lptc-reset"') + '</div>' +
      '</div>';
    d.body.appendChild(root);
    fab = root.querySelector('.lptc-fab');
    panel = root.querySelector('.lptc-panel');
    var scrim = root.querySelector('.lptc-scrim');
    function open(on) {
      root.classList.toggle('is-open', on);
      fab.setAttribute('aria-expanded', on ? 'true' : 'false');
      panel.hidden = !on; scrim.hidden = !on;
      if (on) { var cur = panel.querySelector('[aria-checked="true"]') || panel.querySelector('.lptc-sw'); try { cur.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }
    fab.addEventListener('click', function () { open(panel.hidden); });
    scrim.addEventListener('click', function () { open(false); });
    root.querySelector('.lptc-close').addEventListener('click', function () { open(false); fab.focus(); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { open(false); fab.focus(); } });
    root.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-lptc-id]');
      if (b) apply(b.getAttribute('data-lptc-id'));
    });
  }

  function syncUi(id) {
    if (!root) return;
    root.querySelectorAll('[data-lptc-id]').forEach(function (b) {
      var on = b.getAttribute('data-lptc-id') === id;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.classList.toggle('is-on', on);
    });
    var p = active && active.p;
    var dots = root.querySelectorAll('.lptc-orb span');
    var s = siteChips();
    var c = p ? [p.primary, p.ink, p.bg] : [s[1], s[2], s[0]];
    dots.forEach(function (dot, i) { dot.style.background = c[i]; });
  }

  function boot() {
    build();
    var stored = null;
    try { stored = sessionStorage.getItem(KEY); } catch (e) { stored = null; }
    if (stored && offered().some(function (s) { return s.id === stored; })) apply(stored, false); else { syncUi(''); if (d.documentElement.hasAttribute('data-lp-try')) apply('', false); }
    d.documentElement.removeAttribute('data-lptc-boot');
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 0); });
  else setTimeout(boot, 0);
  w.LPTryColours.apply = apply;
})(window, document);
