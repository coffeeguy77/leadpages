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
    return {
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
      '--steel-950': r.darker, '--steel-900': r.dark, '--steel-800': r.darkCard,
      '--light': r.bg, '--ink': r.dark, '--muted': r.muted, '--line': r.line,
      '--lp-btn-bg': r.primary, '--lp-btn-fg': r.onPrimary, '--lp-btn-stroke': r.primary,
      '--lp-logo-accent': r.primary, '--lptc-on-primary': r.onPrimary
    };
    return 'html[data-lp-try]{' + Object.keys(v).map(function (k) { return k + ':' + v[k] + ' !important'; }).join(';') + '}' +
      'html[data-lp-try] body{background-color:' + r.bg + '}';
  }

  /* ---------- 2. inline colours that equal the site's theme colours ---------- */
  var COLOUR_PROPS = ['background-color', 'color', 'border-color', 'border-top-color', 'border-bottom-color', 'border-left-color', 'border-right-color', 'fill', 'stroke', 'outline-color'];
  var saved = [];     // [el, prop, value, priority]
  var marked = [];    // elements given data-lptc-onlight

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

  function targetFor(role, prop, r) {
    if (role === 'primary') return prop === 'color' ? r.accentText : r.primary;
    if (role === 'dark') return r.dark;
    if (role === 'glow') return r.glow;
    if (role === 'bg') return r.bg;
    return '';
  }

  function remapNode(el, map, r) {
    var st = el.style;
    if (!st || !st.length) return;
    var bgRole = '';
    for (var i = 0; i < st.length; i++) {
      var prop = st[i];
      var isVar = prop.indexOf('--') === 0;
      if (!isVar && COLOUR_PROPS.indexOf(prop) < 0 && prop !== 'background') continue;
      var val = st.getPropertyValue(prop);
      var k = rgbKey(val);
      if (!k || !map[k]) continue;
      // Only plain colour values (not gradients / images / shorthands with other parts).
      if (!isVar && prop === 'background' && /url\(|gradient/i.test(val)) continue;
      var asText = prop === 'color' || /(^|-)(fg|ink|text|color)$/i.test(prop) && !/bg/i.test(prop);
      var to = targetFor(map[k], asText ? 'color' : 'bg', r);
      if (!to) continue;
      saved.push([el, prop, val, st.getPropertyPriority(prop)]);
      st.setProperty(prop, to, st.getPropertyPriority(prop));
      if (prop === 'background-color' || prop === 'background' || (isVar && !asText && /(bg|background|card|fill)/i.test(prop))) bgRole = map[k];
    }
    // A light scheme colour behind white text (e.g. lime buttons): switch the text to the scheme's dark.
    if (bgRole === 'primary' && r.onPrimary !== '#FFFFFF') {
      var c = rgbKey(st.getPropertyValue('color'));
      if (c === '#ffffff' || !c) { saved.push([el, 'color', st.getPropertyValue('color'), st.getPropertyPriority('color')]); st.setProperty('color', r.onPrimary); }
      // Headings / text inside the band follow too (CSS in lp-try-colours.css).
      if (!el.hasAttribute('data-lptc-onlight')) { el.setAttribute('data-lptc-onlight', ''); marked.push(el); }
    }
  }

  function restoreInline() {
    for (var i = saved.length - 1; i >= 0; i--) {
      var s = saved[i];
      if (s[2]) s[0].style.setProperty(s[1], s[2], s[3]); else s[0].style.removeProperty(s[1]);
    }
    saved = [];
    marked.forEach(function (el) { el.removeAttribute('data-lptc-onlight'); });
    marked = [];
  }

  var active = null, mo = null, moTimer = null;
  function remapAll() {
    if (!active) return;
    var map = themeRoles(), r = active.r;
    if (!Object.keys(map).length) return;
    var els = d.querySelectorAll('[style]');
    for (var i = 0; i < els.length; i++) {
      if (els[i].closest('[data-lptc]')) continue;
      remapNode(els[i], map, r);
    }
    // Light scheme colour as a band (set through a CSS variable): mark the element that actually
    // paints it, so its text switches to the scheme's dark.
    if (r.onPrimary !== '#FFFFFF') {
      var want = rgbKey(r.primary);
      marked.slice().forEach(function (host) {
        host.querySelectorAll('*').forEach(function (el) {
          if (el.hasAttribute('data-lptc-onlight') || el.closest('a,button,.btn')) return;
          if (rgbKey(getComputedStyle(el).backgroundColor) === want) { el.setAttribute('data-lptc-onlight', ''); marked.push(el); }
        });
      });
    }
  }

  function apply(id, persist) {
    var p = null;
    for (var i = 0; i < SCHEMES.length; i++) if (SCHEMES[i].id === id) p = SCHEMES[i];
    restoreInline();
    var style = d.getElementById('lptc-tokens');
    if (!p) {
      active = null;
      d.documentElement.removeAttribute('data-lp-try');
      if (style) style.textContent = '';
      if (persist !== false) { try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
    } else {
      active = { p: p, r: roles(p) };
      if (!style) { style = d.createElement('style'); style.id = 'lptc-tokens'; d.head.appendChild(style); }
      style.textContent = tokenCss(active.r);
      d.documentElement.setAttribute('data-lp-try', p.id);
      remapAll();
      if (persist !== false) { try { sessionStorage.setItem(KEY, p.id); } catch (e) { /* ignore */ } }
    }
    syncUi(p ? p.id : '');
    watch();
  }

  // Sections redraw themselves (sub-pages, slider, editor preview): re-apply to new inline colours.
  function watch() {
    if (!w.MutationObserver) return;
    if (!active) { if (mo) { mo.disconnect(); mo = null; } return; }
    if (mo) return;
    mo = new MutationObserver(function (list) {
      var relevant = list.some(function (m) { return !(m.target.closest && m.target.closest('[data-lptc]')); });
      if (!relevant) return;
      clearTimeout(moTimer);
      moTimer = setTimeout(function () {
        if (!active) return;
        mo.disconnect();
        remapAll();
        mo.observe(d.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
      }, 150);
    });
    mo.observe(d.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
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
    if (stored && offered().some(function (s) { return s.id === stored; })) apply(stored, false); else syncUi('');
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 0); });
  else setTimeout(boot, 0);
  w.LPTryColours.apply = apply;
})(window, document);
