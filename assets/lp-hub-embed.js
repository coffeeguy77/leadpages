/**
 * Ops Command embed mode.
 * When loaded with ?embed=1 (or inside the Ops iframe), strips satellite chrome
 * so pages read as panels of one command centre instead of nested apps.
 */
(function (global) {
  'use strict';

  function isEmbed() {
    try {
      var q = new URLSearchParams(global.location.search || '');
      if (q.get('embed') === '1' || q.get('hub') === '1') return true;
    } catch (e) { /* ignore */ }
    try {
      return global.parent && global.parent !== global;
    } catch (e2) {
      return false;
    }
  }

  function applyBodyClass() {
    if (!isEmbed()) return false;
    var root = global.document.documentElement;
    var body = global.document.body;
    root.classList.add('lp-hub-embed', 'lp-super-admin');
    root.dataset.lpHubEmbed = '1';
    if (body) {
      body.classList.add('lp-hub-embed', 'lp-super-admin');
    }
    return true;
  }

  function softPaintFromTheme() {
    try {
      if (!global.LPWorkspaceAppearance) return;
      global.LPWorkspaceAppearance.apply(global.LPWorkspaceAppearance.load());
    } catch (e) { /* ignore */ }
  }

  function listenParentTheme() {
    global.addEventListener('message', function (ev) {
      try {
        var data = ev && ev.data;
        if (!data || data.type !== 'lp-workspace-appearance') return;
        if (!global.LPWorkspaceAppearance) return;
        if (data.prefs && typeof data.prefs === 'object') {
          global.LPWorkspaceAppearance.set(data.prefs);
        } else if (data.theme) {
          global.LPWorkspaceAppearance.set({ theme: data.theme });
        }
      } catch (e) { /* ignore */ }
    });
  }

  function listenStorage() {
    global.addEventListener('storage', function (ev) {
      if (ev.key !== 'leadpages_workspace_appearance') return;
      softPaintFromTheme();
    });
  }

  function notifyParentReady() {
    try {
      if (!isEmbed() || !global.parent || global.parent === global) return;
      global.parent.postMessage({ type: 'lp-hub-panel-ready', href: String(global.location.href) }, '*');
    } catch (e) { /* ignore */ }
  }

  function boot() {
    var on = applyBodyClass();
    softPaintFromTheme();
    listenParentTheme();
    listenStorage();
    if (on) notifyParentReady();
  }

  global.LPHubEmbed = {
    isEmbed: isEmbed,
    apply: applyBodyClass,
    boot: boot
  };

  if (global.document && global.document.documentElement) {
    applyBodyClass();
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
