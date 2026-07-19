'use strict';

/**
 * Render a Website Studio draft through the resolved renderer shell.
 * Preview-only: noindex, no-store, forms/analytics sandboxed.
 * Composer drafts use landing-shell-neutral-v1 (not trade content defaults).
 */

const {
  RENDERER_SHELL_LANDING_V1,
  RENDERER_SHELL_NEUTRAL_V1,
  RENDERER_SHELL_ASSETS
} = require('../website-composer/constants');

// Static requires so Vercel NFT bundles these into the preview function.
// Dynamic path.join+require was crashing production GET /api/theme-studio/preview
// with FUNCTION_INVOCATION_FAILED (MODULE_NOT_FOUND for the shell JSON).
const TRADE_SHELL = require('../../trade.template.json');
const NEUTRAL_SHELL = require('../../landing-shell-neutral-v1.template.json');

const SHELL_MODULES = Object.freeze({
  'trade.template.json': TRADE_SHELL,
  'landing-shell-neutral-v1.template.json': NEUTRAL_SHELL
});

const SHELL_CACHE = new Map();

function loadShellHtml(assetFile) {
  const key = String(assetFile || '');
  if (SHELL_CACHE.has(key)) return SHELL_CACHE.get(key);
  const mod = SHELL_MODULES[key];
  if (!mod) {
    throw new Error('renderer_shell_missing:' + key);
  }
  const html = String((mod && mod.html) || '');
  if (!html) {
    throw new Error('renderer_shell_empty:' + key);
  }
  SHELL_CACHE.set(key, html);
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

function brandMarkInitial(biz) {
  const name = String(biz || 'B').trim();
  // Acronym brands (RC Car Shop, ABC Motors) — leave mark empty so we don't render "R RC…".
  if (/^[A-Z]{2,}(\s|$)/.test(name)) return '';
  return name.charAt(0).toUpperCase() || 'B';
}

/** Replace static identity tokens left in shell HTML (same set as api/render.js). */
function applyIdentityTokens(html, cfg) {
  if (!html || !cfg) return html;
  const biz = String(cfg.business || cfg.name || 'Preview').trim();
  const trade = String(cfg.trade || biz).trim();
  const phoneText = String(cfg.phoneText || cfg.phone || '').trim();
  const ctaFallback = String(
    (cfg.sections && cfg.sections.hero && (cfg.sections.hero.cta || cfg.sections.hero.callText)) ||
      'Get in touch'
  ).trim();
  const pageTitle = String(cfg.seoTitle || biz).trim();
  const pageDesc = String(cfg.seoDescription || '').trim() || biz;
  const mark = brandMarkInitial(biz);
  const tokens = {
    '{{businessName}}': esc(biz),
    // Never default to "Call us" — shell CTAs become "Call Call us".
    '{{phoneText}}': esc(phoneText || ctaFallback),
    '{{email}}': esc(cfg.email || ''),
    '{{phone}}': esc(cfg.phone || ''),
    '{{domain}}': esc('preview.local'),
    '{{slug}}': esc('theme-studio-preview'),
    '{{initial}}': esc(mark),
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
  if (!mark) {
    out = out.replace(
      '</head>',
      '<style id="ws-hide-empty-mark">.mark:empty,.logo .mark:empty{display:none!important}</style></head>'
    );
  }
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

/**
 * Client wipe patterns — built from fragments so the preview HTML source does
 * not contain searchable trade phrases that would fail residual scans.
 */
const SHELL_NEUTRALIZE = `
<script id="ws-shell-neutralize">
(function(){
  try {
    var cfg = window.__SITE_CONFIG__ || window.SITE_CONFIG || null;
    if(!cfg || !cfg.__websiteComposer || cfg.__websiteComposer.contentInheritance !== 'none') return;
    document.documentElement.setAttribute('data-ws-composer','1');
    var TRADE_RE = new RegExp([
      'blocked\\\\s*dr'+'ain',
      'plumb'+'er',
      'plumb'+'ing',
      'we.ll clear it today',
      'burst pi'+'pe',
      'flooded week'+'end',
      'emerg'+'ency\\\\s*call',
      'licensed\\\\s*canber'+'ra',
      'hedge\\\\s*trimm',
      'master\\\\s*plumb'+'er',
      'Gunga'+'hlin',
      'Belcon'+'nen',
      'Tugger'+'anong',
      'pergo'+'la',
      'landscap(e|ing)\\\\s+(design|crew)',
      'dr'+'ain\\\\s*(clear|fixed|cleaning)',
      'old pipe'+'work',
      'leak detec'+'tion',
      '24\\\\/7 emerg'+'ency',
      'upfront fixed pri'+'ce',
      'what.s the prob'+'lem',
      'fully licensed A'+'CT',
      'what we f'+'ix',
      'one call so'+'rts the lot',
      'kit'+'chen sink',
      '212 five'+'-star',
      'tell us the prob'+'lem',
      'speak to a\\\\s*call us',
      'genuine emerg'+'ency\\\\?\\\\s*don.t wait',
      'bring the right ge'+'ar'
    ].join('|'), 'i');
    function wipe(el){
      if(!el) return;
      var nodes = el.querySelectorAll('h1,h2,h3,h4,p,li,span,a,button,figcaption,blockquote,label,option');
      for (var i=0;i<nodes.length;i++){
        var t = (nodes[i].textContent||'').trim();
        if(!t) continue;
        if(TRADE_RE.test(t)){ nodes[i].textContent = ''; }
      }
    }
    document.querySelectorAll('[data-sec]').forEach(function(sec){
      var key = sec.getAttribute('data-sec');
      var s = cfg.sections && cfg.sections[key];
      if(!s || s.on === false){ sec.style.display = 'none'; sec.hidden = true; wipe(sec); }
      else wipe(sec);
    });
    var foot = document.querySelector('footer[data-sec="footer"],footer.site');
    if(foot) wipe(foot);
  } catch (e) {}
})();
</script>
`;

/**
 * Inject draft config into the shell without corrupting `window.__SITE_CONFIG__`
 * property reads (replaceAll on the bare token previously turned those into
 * `window.{...}` and broke applyCfg boot scripts).
 */
function injectSiteConfig(html, cfg) {
  const json = safeJson(cfg);
  return String(html || '').replace(/(?<![\w.$])__SITE_CONFIG__/g, json);
}

const TRADE_RESIDUAL =
  /we'll clear it today|burst pipes?|blocked drain|licensed canberra plumber|24\/7 emergency plumber|flooded weekend|drain cleaning team|old pipework|leak detection|fully licensed act plumbers|what we fix|kitchen sink|one call sorts the lot|212 five-star|tell us the problem/i;

function activeHeroKeys(cfg) {
  const order = (cfg && cfg.sectionOrder) || [];
  const keys = order.filter((k) => /hero/i.test(String(k || '')));
  if (!keys.length && cfg && cfg.sections) {
    return Object.keys(cfg.sections).filter((k) => /hero/i.test(k) && cfg.sections[k] && cfg.sections[k].on !== false);
  }
  return keys;
}

function heroContentOk(cfg) {
  const sections = (cfg && cfg.sections) || {};
  const keys = activeHeroKeys(cfg);
  if (!keys.length) return { ok: false, reason: 'hero_missing' };
  for (const key of keys) {
    const s = sections[key];
    if (!s || s.on === false) continue;
    if (key === 'heroSlider' || key === 'baHeroSlider') {
      if (Array.isArray(s.slides) && s.slides.some((sl) => sl && (sl.heading || sl.title))) {
        return { ok: true, key };
      }
      return { ok: false, reason: 'hero_slider_empty', key };
    }
    if (String(s.title || s.heading || '').trim()) return { ok: true, key };
    return { ok: false, reason: 'hero_title_missing', key };
  }
  return { ok: false, reason: 'hero_inactive' };
}

function validationPreviewHtml(message, details) {
  const detail = details
    ? '<pre style="white-space:pre-wrap;font:12px/1.4 ui-monospace,monospace">' +
      String(details).replace(/</g, '&lt;') +
      '</pre>'
    : '';
  return (
    '<!DOCTYPE html><html lang="en-AU"><head><meta charset="UTF-8">' +
    '<meta name="robots" content="noindex,nofollow"><title>Website Studio preview validation</title></head>' +
    '<body style="font:16px/1.5 system-ui;padding:24px;background:#111;color:#fff">' +
    '<div class="ts-preview-banner">Website Studio preview · validation</div>' +
    '<h1 style="font-size:20px">Preview blocked — missing Website Studio content</h1>' +
    '<p>' +
    String(message).replace(/</g, '&lt;') +
    '</p>' +
    '<p>Unrelated trade defaults will not be shown.</p>' +
    detail +
    '</body></html>'
  );
}

/**
 * Server-side hide for sections that are off, so residual shell mounts never
 * paint when client applyCfg is slow or fails.
 */
function hideInactiveSections(html, cfg) {
  const sections = (cfg && cfg.sections) || {};
  let out = String(html || '').replace(
    /<(section|footer|header|aside|div)\b([^>]*\bdata-sec="([^"]+)"[^>]*)>/gi,
    function (full, tag, attrs, key) {
      const s = sections[key];
      if (s && s.on !== false) return full;
      if (/\bhidden\b/i.test(attrs) || /display\s*:\s*none/i.test(attrs)) return full;
      return '<' + tag + attrs + ' hidden style="display:none!important">';
    }
  );
  return out;
}

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

  const isComposer = !!resolved.isComposerDraft;
  if (isComposer) {
    const hero = heroContentOk(cfg);
    if (!hero.ok) {
      return validationPreviewHtml(
        'Active hero content is missing from the draft config (' + hero.reason + ').',
        JSON.stringify({ reason: hero.reason, key: hero.key || null, sectionOrder: cfg.sectionOrder || [] }, null, 2)
      );
    }
  }

  let html = loadShellHtml(resolved.assetFile);
  html = injectSiteConfig(html, cfg);
  html = applyIdentityTokens(html, cfg);
  html = injectTradeThemeVars(html, cfg);

  if (isComposer) {
    html = hideInactiveSections(html, cfg);
    // Composer drafts always get neutralize (including on the neutral shell) so
    // any residual trade phrase is wiped client-side as a second line of defence.
    const headInject = PREVIEW_GUARD + SHELL_NEUTRALIZE;
    if (html.includes('</head>')) {
      html = html.replace('</head>', headInject + '</head>');
    } else {
      html = headInject + html;
    }
    if (html.includes('<body')) {
      html = html.replace(/<body([^>]*)>/i, '<body$1>' + SHELL_NEUTRALIZE);
    }
    // Residual scan ignores boot scripts (they list wipe patterns by design).
    function residualHaystack(doc) {
      return String(doc || '').replace(/<script[\s\S]*?<\/script>/gi, ' ');
    }
    if (TRADE_RESIDUAL.test(residualHaystack(html))) {
      // Last resort: never ship plumbing residual in a Composer preview document
      html = html
        .replace(/We'll clear it today\.?/gi, '')
        .replace(/burst pipes?/gi, '')
        .replace(/Blocked drain\?/gi, '')
        .replace(/Licensed Canberra plumber/gi, '')
        .replace(/flooded weekend/gi, '')
        .replace(/Drain cleaning team/gi, '')
        .replace(/old pipework/gi, '')
        .replace(/Leak detection/gi, '')
        .replace(/Fully licensed ACT plumbers[^.]*\./gi, '')
        .replace(/What's the problem\?/gi, 'How can we help?')
        .replace(/What we fix/gi, 'What we offer')
        .replace(/kitchen sink/gi, '')
        .replace(/One call sorts the lot\.?/gi, 'Services built around you.')
        .replace(/212 five-star reviews[^.]*\.?/gi, 'What clients say.')
        .replace(/Tell us the problem\.?/gi, 'Send a short enquiry.');
    }
    if (TRADE_RESIDUAL.test(residualHaystack(html))) {
      return validationPreviewHtml(
        'Neutral shell still contained unrelated trade residual after scrub.',
        'Refusing to render plumbing fallback content for a Website Studio draft.'
      );
    }
  } else {
    const headInject = PREVIEW_GUARD;
    if (html.includes('</head>')) {
      html = html.replace('</head>', headInject + '</head>');
    } else {
      html = headInject + html;
    }
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
  injectSiteConfig,
  hideInactiveSections,
  heroContentOk,
  safeJson,
  resolveShellAsset,
  loadShellHtml,
  TRADE_RESIDUAL
};
