'use strict';

/**
 * Render a Website Studio draft through the resolved renderer shell.
 * Preview-only: noindex, no-store, forms/analytics sandboxed.
 * Composer drafts use landing-shell-neutral-v1 (not trade content defaults).
 */

const path = require('path');
const {
  RENDERER_SHELL_LANDING_V1,
  RENDERER_SHELL_NEUTRAL_V1,
  RENDERER_SHELL_ASSETS
} = require('../website-composer/constants');

const SHELL_CACHE = new Map();

function loadShellHtml(assetFile) {
  if (SHELL_CACHE.has(assetFile)) return SHELL_CACHE.get(assetFile);
  const abs = path.join(__dirname, '..', '..', assetFile);
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const mod = require(abs);
  const html = String((mod && mod.html) || '');
  SHELL_CACHE.set(assetFile, html);
  return html;
}

function resolveShellAsset(draftConfig) {
  const meta = draftConfig && draftConfig.__websiteComposer;
  const isComposer =
    meta && (meta.contentInheritance === 'none' || meta.rendererShellId === RENDERER_SHELL_NEUTRAL_V1);
  const shellId =
    (meta && meta.rendererShellId) ||
    (isComposer ? RENDERER_SHELL_NEUTRAL_V1 : RENDERER_SHELL_LANDING_V1);
  const asset = RENDERER_SHELL_ASSETS[shellId] || RENDERER_SHELL_ASSETS[RENDERER_SHELL_LANDING_V1];
  return { shellId, assetFile: asset, isComposerDraft: !!isComposer };
}

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function hexOr(v, fallback) {
  return typeof v === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : fallback;
}

function tradeThemeRootCss(theme) {
  if (!theme || typeof theme !== 'object') return '';
  const vars = [];
  if (theme.pipe) vars.push('--pipe:' + hexOr(theme.pipe, '#111'));
  if (theme.hivis) vars.push('--hivis:' + hexOr(theme.hivis, '#f5b700'));
  if (theme.steel) vars.push('--steel:' + hexOr(theme.steel, '#1f3a54'));
  if (theme.safety) vars.push('--safety:' + hexOr(theme.safety, '#e8eef4'));
  if (theme.lightBg) vars.push('--light:' + hexOr(theme.lightBg, '#fff'));
  if (!vars.length) return '';
  return ':root{' + vars.join(';') + '}';
}

function injectTradeThemeVars(html, cfg) {
  if (!html || !cfg) return html;
  const css = tradeThemeRootCss(cfg.theme);
  if (!css) return html;
  const block = '<style id="lp-theme-vars">' + css + '</style>\n';
  if (html.includes('id="lp-theme-vars"')) {
    return html.replace(/<style id="lp-theme-vars">[\s\S]*?<\/style>\n?/, block);
  }
  if (html.includes('</head>')) return html.replace('</head>', block + '</head>');
  return block + html;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Replace static identity tokens left in shell HTML (same set as api/render.js). */
function applyIdentityTokens(html, cfg) {
  if (!html || !cfg) return html;
  const biz = String(cfg.business || cfg.name || 'Preview').trim();
  const trade = String(cfg.trade || biz).trim();
  const phoneText = String(cfg.phoneText || cfg.phone || '').trim();
  const pageTitle = String(cfg.seoTitle || biz).trim();
  const pageDesc = String(cfg.seoDescription || '').trim() || biz;
  const tokens = {
    '{{businessName}}': esc(biz),
    '{{phoneText}}': esc(phoneText || 'Call us'),
    '{{email}}': esc(cfg.email || ''),
    '{{phone}}': esc(cfg.phone || ''),
    '{{domain}}': esc('preview.local'),
    '{{slug}}': esc('theme-studio-preview'),
    '{{initial}}': esc((biz || 'B').trim().charAt(0).toUpperCase()),
    '{{trade}}': esc(trade),
    '{{pageTitle}}': esc(pageTitle),
    '{{pageDesc}}': esc(pageDesc),
    '{{canonical}}': esc('https://preview.local/theme-studio-preview'),
    '{{favicon}}': esc(
      cfg.favicon || 'https://res.cloudinary.com/dzx6x1hou/image/upload/v1782912405/favicon.ico'
    ),
    '{{appleTouchIcon}}': esc(
      cfg.appleTouchIcon ||
        cfg.favicon ||
        'https://app.leadpages.com.au/assets/apple-touch-icon-180.png'
    )
  };
  let out = html;
  for (const [k, v] of Object.entries(tokens)) out = out.replaceAll(k, v);
  return out;
}

function sandboxConfig(draftConfig) {
  const cfg = JSON.parse(JSON.stringify(draftConfig || {}));
  delete cfg.analytics;
  delete cfg.gtmId;
  delete cfg.gaId;
  delete cfg.facebookPixel;
  delete cfg.googleAds;
  delete cfg.google_ads;
  delete cfg.tracking;
  delete cfg.crm;
  delete cfg.leadRouting;
  delete cfg.formDestinations;
  delete cfg.emailIntegrations;
  delete cfg.billing;
  delete cfg.users;
  delete cfg.permissions;
  delete cfg.auth;
  cfg.__themeStudioPreview = true;
  cfg.__disableForms = true;
  cfg.__disableTracking = true;
  cfg.__noindex = true;
  return cfg;
}

const PREVIEW_GUARD = `
<style id="ts-preview-banner">.ts-preview-banner{position:sticky;top:0;z-index:99999;background:#111;color:#fff;font:600 12px/1.3 system-ui,sans-serif;padding:8px 12px;text-align:center}.ts-preview-banner small{opacity:.8;font-weight:500}</style>
<div class="ts-preview-banner">Website Studio preview · draft only · not published · forms &amp; tracking disabled<br><small>Desktop/mobile via parent toolbar</small></div>
<script id="ts-preview-guard">
(function(){
  document.documentElement.setAttribute('data-ts-preview','1');
  document.addEventListener('submit', function(e){ e.preventDefault(); e.stopPropagation(); alert('Preview only — form submissions are disabled.'); }, true);
  document.addEventListener('click', function(e){
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if(!a) return;
    var href = a.getAttribute('href') || '';
    if(/^tel:|mailto:/i.test(href)) return;
    if(href.charAt(0) === '#') return;
    e.preventDefault();
  }, true);
  try { window.gtag = function(){}; window.fbq = function(){}; window.dataLayer = []; } catch (err) {}
})();
</script>
<meta name="robots" content="noindex,nofollow">
`;

/** Belt-and-suspenders wipe if a non-neutral shell is ever used for Composer drafts. */
const SHELL_NEUTRALIZE = `
<script id="ws-shell-neutralize">
(function(){
  try {
    var cfg = window.__SITE_CONFIG__ || window.SITE_CONFIG || null;
    if(!cfg || !cfg.__websiteComposer || cfg.__websiteComposer.contentInheritance !== 'none') return;
    document.documentElement.setAttribute('data-ws-composer','1');
    function wipe(el){
      if(!el) return;
      var nodes = el.querySelectorAll('h1,h2,h3,h4,p,li,span,a,button,figcaption,blockquote');
      for (var i=0;i<nodes.length;i++){
        var t = (nodes[i].textContent||'').trim();
        if(!t) continue;
        if(/blocked\\s*drain|plumber|plumbing|hi-?vis|emergency\\s*call|licensed\\s*canberra\\s*plumber|hedge\\s*trimm|master\\s*plumber|Gungahlin|Belconnen|Tuggeranong|pergola|landscap(e|ing)\\s+(design|crew)|drain\\s*clear/i.test(t)){
          nodes[i].textContent = '';
        }
      }
    }
    document.querySelectorAll('[data-sec]').forEach(function(sec){
      var key = sec.getAttribute('data-sec');
      var s = cfg.sections && cfg.sections[key];
      if(!s || s.on === false){ sec.style.display = 'none'; sec.hidden = true; wipe(sec); }
      else wipe(sec);
    });
  } catch (e) {}
})();
</script>
`;

/**
 * @param {object} draftConfig
 * @param {{ mode?: 'desktop'|'mobile'|'tablet' }} [opts]
 * @returns {string} HTML
 */
function renderDraftPreviewHtml(draftConfig, opts) {
  const mode = (opts && opts.mode) || 'desktop';
  const cfg = sandboxConfig(draftConfig);
  const resolved = resolveShellAsset(cfg);
  if (cfg.__websiteComposer) {
    cfg.__websiteComposer.rendererShellId = resolved.shellId;
    cfg.__websiteComposer.rendererShellAsset = resolved.assetFile;
  }
  let html = loadShellHtml(resolved.assetFile);
  html = html.replaceAll('__SITE_CONFIG__', safeJson(cfg));
  html = applyIdentityTokens(html, cfg);
  html = injectTradeThemeVars(html, cfg);

  const useNeutralize =
    resolved.isComposerDraft && resolved.shellId !== RENDERER_SHELL_NEUTRAL_V1;
  const headInject = PREVIEW_GUARD + (useNeutralize ? SHELL_NEUTRALIZE : '');
  if (html.includes('</head>')) {
    html = html.replace('</head>', headInject + '</head>');
  } else {
    html = headInject + html;
  }
  if (useNeutralize && html.includes('<body')) {
    html = html.replace(/<body([^>]*)>/i, '<body$1>' + SHELL_NEUTRALIZE);
  }

  if (mode === 'mobile') {
    const mobileCss =
      '<style id="ts-mobile-frame">body{max-width:412px;margin:0 auto;box-shadow:0 0 0 1px rgba(0,0,0,.08)}</style>';
    html = html.includes('</head>')
      ? html.replace('</head>', mobileCss + '</head>')
      : mobileCss + html;
  } else if (mode === 'tablet') {
    const tabletCss =
      '<style id="ts-tablet-frame">body{max-width:834px;margin:0 auto;box-shadow:0 0 0 1px rgba(0,0,0,.08)}</style>';
    html = html.includes('</head>')
      ? html.replace('</head>', tabletCss + '</head>')
      : tabletCss + html;
  }
  return html;
}

module.exports = {
  renderDraftPreviewHtml,
  sandboxConfig,
  injectTradeThemeVars,
  safeJson,
  resolveShellAsset,
  loadShellHtml
};
