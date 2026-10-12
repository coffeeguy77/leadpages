/**
 * LeadPages "New look" boot — load in <head> before the stylesheets so a page never flashes
 * the old look. Reads the Appearance choice saved by lp-workspace-appearance.js and sets
 * html[data-lp-ui], [data-lp-nav], [data-lp-side-collapsed] and, for the new look, the theme
 * and a matching background. Pages add /assets/lp-ui.css themselves;
 * pages that don't load lp-themes.css mark this script data-themes and get it here (new look only).
 */
(function () {
  'use strict';
  try {
    var d = document, r = d.documentElement;
    var p = JSON.parse(localStorage.getItem('leadpages_workspace_appearance') || 'null') || {};
    var v2 = p.ui === 'v2';
    r.setAttribute('data-lp-ui', v2 ? 'v2' : 'classic');
    r.setAttribute('data-lp-nav', p.nav === 'top' ? 'top' : 'side');
    r.setAttribute('data-lp-side-collapsed', p.sideCollapsed ? 'true' : 'false');
    if (!v2) return;
    var THEMES = ['classic-light', 'command-dark', 'neon-pink', 'electric-blue', 'blush', 'blueprint', 'studio-light', 'studio-dark'];
    var BG = { 'classic-light': '#f6f4ef', 'command-dark': '#12151a', 'neon-pink': '#140f14', 'electric-blue': '#0f1419', blush: '#faf3f2', blueprint: '#f0f4f8', 'studio-light': '#f7f7f8', 'studio-dark': '#0b0c0f' };
    var DARK = { 'command-dark': 1, 'neon-pink': 1, 'electric-blue': 1, 'studio-dark': 1 };
    var t = p.theme || 'classic-light';
    if (t === 'system') t = (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'command-dark' : 'classic-light';
    if (THEMES.indexOf(t) < 0) t = 'classic-light';
    if (!r.getAttribute('data-theme')) r.setAttribute('data-theme', t);
    r.style.colorScheme = DARK[t] ? 'dark' : 'light';
    r.style.background = BG[t];
    var head = d.head || d.getElementsByTagName('head')[0];
    function css(href, id) {
      if (d.querySelector('link[href^="' + href.split('?')[0] + '"]')) return;
      var l = d.createElement('link'); l.rel = 'stylesheet'; l.href = href; if (id) l.id = id;
      head.appendChild(l);
    }
    var me = d.currentScript;
    if (me && me.hasAttribute('data-themes')) css('/assets/lp-themes.css?v=ai-composer-btn-1');
    if (!d.getElementById('lp-ui-font')) css('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap', 'lp-ui-font');
  } catch (e) { /* storage blocked — classic look */ }
})();
