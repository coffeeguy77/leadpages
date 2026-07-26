/**
 * Marketplace feature page V2 — compact Trust Bar reference.
 * Coloured top = app info. White section = demo + examples.
 * Uses real playground iframe + LPTrustBarEditor + LPIconPicker.
 */
(function () {
  'use strict';

  function flags() {
    return (window.LPMarketplaceFlags && window.LPMarketplaceFlags.getFlags())
      || window.__LP_MARKETPLACE_FLAGS__
      || {};
  }

  function v2On() {
    return !!flags().APP_MARKETPLACE_V2;
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function deepClone(o) {
    return JSON.parse(JSON.stringify(o || {}));
  }

  var liveSiteCfg = { sections: {}, theme: {} };
  var baselineCfg = null;
  var meta = null;
  var editorApi = null;
  var iframe = null;
  var device = 'desktop';
  var activePreset = '';
  var presetCache = {};
  var announceEl = null;

  function announce(msg) {
    if (!announceEl) announceEl = document.getElementById('mp-live-status');
    if (announceEl) announceEl.textContent = msg || '';
  }

  function isTrustBar(feature) {
    var sk = (feature && feature.section_key) || '';
    var slug = (feature && feature.slug) || '';
    return sk === 'trustBar' || slug === 'trust-bar';
  }

  function loadMeta() {
    return fetch('/marketplace/trust-bar-v2.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function fetchPreset(slug) {
    if (presetCache[slug]) return Promise.resolve(presetCache[slug]);
    return fetch('/api/marketplace-playground?slug=' + encodeURIComponent(slug) + '&section_key=trustBar')
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (data) {
        var preset = data;
        if (window.LPPlaygroundPreset) {
          preset = window.LPPlaygroundPreset.normalizePreset(data, {
            slug: slug,
            source: data.source || 'file',
            section_key: 'trustBar',
            label: data.label
          });
        }
        presetCache[slug] = preset;
        return preset;
      });
  }

  function presetToSiteConfig(preset) {
    if (window.LPPlaygroundPreset) return window.LPPlaygroundPreset.presetToSiteConfig(preset);
    if (preset && preset.site_config) return deepClone(preset.site_config);
    return { sections: {}, theme: {} };
  }

  function measurePreviewHeight() {
    if (!iframe) return 0;
    try {
      var doc = iframe.contentDocument;
      if (!doc) return 0;
      var sec = doc.querySelector('[data-sec="trustBar"]') || doc.querySelector('main') || doc.body;
      var h = sec ? Math.ceil(sec.getBoundingClientRect().height || sec.scrollHeight || 0) : 0;
      if (!h) h = Math.ceil(doc.body.scrollHeight || 0);
      if (h < 40) h = 40;
      if (h > 720) h = 720;
      return h + 8;
    } catch (_e) {
      return 0;
    }
  }

  function sizeIframe() {
    if (!iframe) return;
    var wrap = document.querySelector('[data-r="wrap"]');
    var wmap = { desktop: null, tablet: 768, phone: 390 };
    var w = wmap[device];
    var h = measurePreviewHeight() || 120;
    iframe.style.minHeight = '0';
    if (!w) {
      iframe.style.width = '100%';
      iframe.style.transform = 'none';
      iframe.style.marginBottom = '';
      iframe.style.height = h + 'px';
      if (wrap) { wrap.style.height = ''; wrap.classList.remove('framed'); }
      return;
    }
    if (wrap) wrap.classList.add('framed');
    iframe.style.width = w + 'px';
    var avail = (wrap ? wrap.clientWidth : window.innerWidth) - 48;
    var s = Math.min(1, avail / w);
    iframe.style.transform = 'scale(' + s + ')';
    iframe.style.transformOrigin = 'top center';
    iframe.style.height = h + 'px';
    iframe.style.marginBottom = ((h * s) - h) + 'px';
    if (wrap) wrap.style.height = (h * s + 16) + 'px';
  }

  function applyLiveConfig() {
    if (!iframe) return;
    try {
      if (iframe.contentWindow && iframe.contentWindow.__applyTradeConfig) {
        iframe.contentWindow.__applyTradeConfig(liveSiteCfg);
      }
    } catch (_e) {}
    sizeIframe();
  }

  function mountEditor() {
    var host = document.getElementById('mp-tb-editor');
    if (!host || !window.LPTrustBarEditor) return;
    editorApi = window.LPTrustBarEditor.mount(host, {
      mode: 'marketplace-playground',
      value: liveSiteCfg,
      onChange: function (cfg) {
        liveSiteCfg = cfg;
        applyLiveConfig();
      },
      onAnnounce: announce
    });
  }

  function selectPreset(slug, opts) {
    opts = opts || {};
    return fetchPreset(slug).then(function (preset) {
      activePreset = slug;
      liveSiteCfg = deepClone(presetToSiteConfig(preset));
      baselineCfg = deepClone(liveSiteCfg);
      if (!iframe) {
        var canvas = document.querySelector('[data-r="canvas"]');
        if (canvas) {
          iframe = document.createElement('iframe');
          iframe.className = 'pg-iframe';
          iframe.src = '/marketplace/demos/demo-trustBar.html';
          iframe.style.cssText = 'width:100%;border:0;display:block;min-height:0;height:auto;vertical-align:top';
          iframe.setAttribute('title', 'Trust Bar live preview');
          iframe.addEventListener('load', function () {
            applyLiveConfig();
            setTimeout(sizeIframe, 60);
          });
          canvas.innerHTML = '';
          canvas.appendChild(iframe);
        }
      } else {
        applyLiveConfig();
      }
      if (editorApi) editorApi.setValue(liveSiteCfg);
      else mountEditor();
      renderPresetButtons();
      announce('Loaded example: ' + (preset.label || slug));
      if (opts.scroll) {
        var pg = document.getElementById('playground');
        if (pg) pg.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  function renderPresetButtons() {
    var box = document.querySelector('[data-r="presets"]');
    if (!box || !meta) return;
    var order = meta.presetOrder || [];
    box.innerHTML = order.map(function (slug) {
      var cached = presetCache[slug];
      var label = (cached && cached.label) || slug.replace(/^trustbar-/, '').replace(/-/g, ' ');
      return '<button type="button" data-preset="' + esc(slug) + '"' + (slug === activePreset ? ' class="on"' : '') + '>' + esc(label) + '</button>';
    }).join('');
  }

  function infoPoints(feature) {
    var points = [];
    var short = ((meta && meta.shortDescription) || feature.summary || '').trim();
    var overview = ((meta && meta.longDescription) || feature.summary || feature.tagline || '').trim();
    if (overview && overview !== short) {
      points.push({ title: 'What it does', text: overview });
    }
    ((meta && meta.modes) || []).forEach(function (m) {
      if (!m || !m.name) return;
      points.push({ title: m.name, text: m.description || '' });
    });
    ((meta && meta.benefits) || []).forEach(function (b) {
      if (!b || !b.title) return;
      points.push({ title: b.title, text: b.text || b.description || '' });
    });
    points.push({
      title: 'Included with LeadPages',
      text: 'No extra subscription for the Trust Bar itself. Premium and usage-based tools on other apps are marked clearly.'
    });
    points.push({
      title: 'Same editor as your website',
      text: 'Layout, colours, icons and items use the real LeadPages controls — nothing here is saved until you join and edit your own site.'
    });
    return points;
  }

  function renderExamples(root, feature) {
    var examples = (meta && meta.examples) || [];
    var Acc = window.LPMarketplaceAccess;
    var accessType = (meta && meta.accessType) || 'included';
    var accessLong = Acc ? Acc.publicLabel(accessType, 'long') : 'Included with your LeadPages website';
    var points = infoPoints(feature);

    var pointsHtml = points.map(function (p, i) {
      return '<details class="mp-info-point"' + (i === 0 ? ' open' : '') + '>'
        + '<summary><span class="mp-info-title">' + esc(p.title) + '</span></summary>'
        + '<p class="mp-info-text">' + esc(p.text) + '</p>'
        + '</details>';
    }).join('');

    var examplesHtml = examples.map(function (ex, idx) {
      return '<button type="button" class="mp-ex-chip" data-try-preset="' + esc(ex.presetSlug) + '">'
        + '<strong>' + esc(ex.businessName) + '</strong>'
        + '<span>' + esc(ex.mode === 'images' ? 'Image tiles' : 'Text and icons') + ' · ' + esc(ex.industry) + '</span>'
        + '</button>';
    }).join('');

    root.innerHTML = ''
      + '<header class="feat-hero mp-v2-hero mp-info-hero"><div class="feat-hero-inner wrap">'
      + '<div class="crumb"><a href="/marketplace?v2=1">← Marketplace</a></div>'
      + '<span class="eyebrow">' + esc((meta && meta.categoryEyebrow) || 'Trust and credibility') + '</span>'
      + '<h1>' + esc(feature.name || 'Trust Bar') + '</h1>'
      + '<p class="hsum">' + esc((meta && meta.shortDescription) || feature.summary || '') + '</p>'
      + '<div class="mp-labels">'
      + ((meta && meta.featureLabels) || []).map(function (l) {
        return '<span class="mp-label">' + esc(l) + '</span>';
      }).join('')
      + '<span class="mp-label">' + esc(accessLong) + '</span>'
      + '</div>'
      + '<div class="mp-info-list" aria-label="App details">' + pointsHtml + '</div>'
      + '<div class="hcta">'
      + '<a class="btn" href="#playground">Try the demo ↓</a>'
      + '<a class="btn ghost" href="/partners">Become a partner</a>'
      + '</div>'
      + '</div></header>'

      + '<article class="mp-demo-article"><div class="wrap">'
      + '<section class="mp-demo-block" id="playground">'
      + '<div class="mp-demo-head">'
      + '<div class="blk-eyebrow">Live demo</div>'
      + '<h2>Try it with real business examples</h2>'
      + '<p class="mp-lede">Pick an example, edit icons and wording, and watch the preview update. Nothing here is saved.</p>'
      + '</div>'
      + (examplesHtml ? '<div class="mp-ex-row" aria-label="Real examples">' + examplesHtml + '</div>' : '')
      + '<div class="mp-pg-preview">'
      + '<div class="pg-devicewrap" data-r="wrap"><div class="pg-viewport" data-r="vp"><div class="pg-canvas" data-r="canvas"></div></div></div>'
      + '</div>'
      + '<div class="pg-topbar">'
      + '<div class="pg-presets" data-r="presets" role="toolbar" aria-label="Industry presets"></div>'
      + '<div class="pg-devbtns" role="group" aria-label="Preview size">'
      + '<button type="button" data-d="desktop" class="on">Desktop</button>'
      + '<button type="button" data-d="tablet">Tablet</button>'
      + '<button type="button" data-d="phone">Phone</button>'
      + '</div>'
      + '<div class="mp-pg-actions">'
      + '<button type="button" class="btn ghost" id="mp-reset">Reset example</button>'
      + '</div></div>'
      + '<div class="mp-pg-editor mp-pg-editor-compact">'
      + '<div id="mp-tb-editor" class="tb-ed-root tb-ed-compact"></div>'
      + '</div>'
      + '<p class="sr-only" id="mp-live-status" aria-live="polite"></p>'
      + '</section>'

      + '<section class="mp-demo-cta">'
      + '<h2>Ready to use this on your website?</h2>'
      + '<p>Many apps are included. Premium and usage-based tools are clearly marked before you use them.</p>'
      + '<div class="mp-hero-cta">'
      + '<a class="btn" href="/start-your-business">Build my LeadPages website</a>'
      + '<a class="btn ghost" href="/partners">Become a LeadPages partner</a>'
      + '</div>'
      + '</section>'
      + '</div></article>';
  }

  function wirePage() {
    document.addEventListener('click', function (e) {
      var tryBtn = e.target.closest('[data-try-preset]');
      if (tryBtn) {
        selectPreset(tryBtn.getAttribute('data-try-preset'), { scroll: true });
        return;
      }
      var presetBtn = e.target.closest('[data-preset]');
      if (presetBtn) {
        selectPreset(presetBtn.getAttribute('data-preset'));
        return;
      }
      var dev = e.target.closest('[data-d]');
      if (dev && dev.closest('.pg-devbtns')) {
        device = dev.getAttribute('data-d');
        document.querySelectorAll('.pg-devbtns button').forEach(function (b) {
          b.classList.toggle('on', b === dev);
        });
        sizeIframe();
        announce('Preview size: ' + device);
      }
    });

    var reset = document.getElementById('mp-reset');
    if (reset) {
      reset.addEventListener('click', function () {
        if (!baselineCfg) return;
        liveSiteCfg = deepClone(baselineCfg);
        if (editorApi) editorApi.setValue(liveSiteCfg);
        applyLiveConfig();
        announce('Example reset');
      });
    }
  }

  function addStyles() {
    if (document.getElementById('mp-feature-v2-style')) return;
    var s = document.createElement('style');
    s.id = 'mp-feature-v2-style';
    s.textContent = [
      '.mp-info-hero .hsum{max-width:60ch;margin:0 0 14px}',
      '.mp-info-hero .feat-hero-inner{padding-bottom:36px}',
      '.mp-labels{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 18px}',
      '.mp-label{display:inline-flex;padding:6px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.25);font-size:13px;font-weight:700;color:#F3EFEA}',
      '.mp-info-list{max-width:720px;margin:0 0 22px;display:grid;gap:8px}',
      '.mp-info-point{border:1px solid rgba(255,255,255,.18);border-radius:12px;background:rgba(255,255,255,.06);padding:0;overflow:hidden}',
      '.mp-info-point summary{list-style:none;cursor:pointer;padding:12px 14px;font-weight:700;display:flex;align-items:center;justify-content:space-between;gap:12px}',
      '.mp-info-point summary::-webkit-details-marker{display:none}',
      '.mp-info-point summary::after{content:"+";font-weight:800;opacity:.8}',
      '.mp-info-point[open] summary::after{content:"–"}',
      '.mp-info-point .mp-info-text{margin:0;padding:0 14px 14px;color:#C9D2CC;font-size:15px;line-height:1.5;max-width:62ch}',
      '.mp-demo-article{background:var(--theme-page-background,var(--paper,#FAF5F2));padding:36px 0 72px}',
      '.mp-demo-block{background:var(--theme-surface,#fff);border:1px solid var(--theme-border,var(--line));border-radius:18px;padding:22px 20px 18px;margin-bottom:22px}',
      '.mp-demo-head{margin:0 0 16px}',
      '.mp-demo-head h2{font-family:var(--theme-heading-font,var(--disp));font-size:clamp(24px,3vw,32px);margin:6px 0 8px}',
      '.mp-lede{color:var(--theme-text-muted,var(--mut));max-width:60ch;margin:0}',
      '.mp-ex-row{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}',
      '.mp-ex-chip{appearance:none;border:1px solid var(--theme-border,var(--line));background:var(--theme-surface-alt,var(--shell));border-radius:12px;padding:10px 12px;text-align:left;cursor:pointer;font:inherit;display:flex;flex-direction:column;gap:2px;min-width:180px}',
      '.mp-ex-chip strong{font-size:14px}',
      '.mp-ex-chip span{font-size:12.5px;color:var(--theme-text-muted,var(--mut))}',
      '.mp-ex-chip:hover,.mp-ex-chip:focus-visible{border-color:var(--theme-primary,var(--rose));outline:3px solid var(--theme-focus,var(--rose));outline-offset:2px}',
      '.mp-pg-preview{margin:0 0 8px;line-height:0}',
      '.mp-pg-preview .pg-iframe,.mp-pg-preview iframe{display:block;min-height:0!important}',
      '.mp-pg-editor-compact{margin-top:4px}',
      '.mp-pg-actions{display:flex;gap:8px;flex-wrap:wrap}',
      '.mp-pg .pg-topbar,.mp-demo-block .pg-topbar{flex-wrap:wrap;gap:10px;padding:4px 0 10px}',
      '.mp-demo-cta{text-align:center;padding:28px 18px 8px}',
      '.mp-demo-cta h2{font-family:var(--theme-heading-font,var(--disp));font-size:clamp(24px,3vw,32px);margin:0 0 10px}',
      '.mp-demo-cta p{color:var(--theme-text-muted,var(--mut));max-width:48ch;margin:0 auto 18px}',
      '.mp-hero-cta{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}',
      '.mp-hero-cta .btn,.hcta .btn{display:inline-flex;font-weight:700;padding:12px 22px;border-radius:999px;background:var(--theme-primary,var(--rose));color:#fff;border:2px solid transparent}',
      '.mp-hero-cta .btn.ghost,.hcta .btn.ghost{background:transparent;border-color:currentColor;color:inherit}',
      '.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}',
      'section.back{display:none}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function bootFeatureV2(feature) {
    if (!v2On() || !isTrustBar(feature)) return false;
    var page = document.getElementById('page');
    if (!page) return false;
    addStyles();
    document.documentElement.setAttribute('data-mp-v2', '1');

    loadMeta().then(function (m) {
      meta = m || {
        publicHeading: 'Give visitors a reason to trust you immediately.',
        shortDescription: feature.summary || '',
        longDescription: feature.summary || '',
        categoryEyebrow: 'Trust and credibility',
        accessType: 'included',
        featureLabels: ['Included with LeadPages', 'Mobile responsive', 'Multiple layouts'],
        modes: [
          { id: 'badges', name: 'Text and Icons', description: 'Compact icon-and-text strip.' },
          { id: 'images', name: 'Image Tiles', description: 'Full-width image tiles with captions.' }
        ],
        examples: [],
        presetOrder: ['trustbar-aam1', 'trustbar-bean-culture'],
        defaultPlaygroundPreset: 'trustbar-aam1'
      };
      renderExamples(page, feature);
      wirePage();
      var def = meta.defaultPlaygroundPreset || 'trustbar-aam1';
      var order = meta.presetOrder || [def];
      Promise.all(order.map(function (s) { return fetchPreset(s).catch(function () { return null; }); }))
        .then(function () {
          renderPresetButtons();
          return selectPreset(def);
        });
    });
    return true;
  }

  window.LPMarketplaceFeatureV2 = {
    boot: bootFeatureV2,
    isTrustBar: isTrustBar,
    v2On: v2On
  };

  function autoBoot() {
    var slug = (location.pathname.split('/').filter(Boolean)[1] || '').toLowerCase();
    if (!v2On() || slug !== 'trust-bar') return;
    var page = document.getElementById('page');
    if (!page) return;
    page.innerHTML = '<div class="status">Loading Trust Bar…</div>';
    var fallback = {
      name: 'Trust Bar',
      slug: 'trust-bar',
      section_key: 'trustBar',
      summary: 'Keep important services, promises or credentials visible without distracting from the rest of your page.'
    };
    fetch('/api/catalog?slug=' + encodeURIComponent(slug))
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) {
        bootFeatureV2((j && j.feature) || fallback);
      })
      .catch(function () {
        bootFeatureV2(fallback);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoBoot);
  } else {
    autoBoot();
  }
})();
