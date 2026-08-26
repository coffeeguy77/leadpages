/**
 * Marketplace feature page V2 — Scrolling Sponsor Banner.
 * Coloured top = app info. White section = demo + live editor.
 * Uses real playground iframe + LPScrollingSponsorBannerEditor.
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
  var dualIframe = null;
  var device = 'tablet';
  var viewportMode = 'desktop';
  var activePreset = '';
  var presetCache = {};
  var announceEl = null;

  function announce(msg) {
    if (!announceEl) announceEl = document.getElementById('mp-live-status');
    if (announceEl) announceEl.textContent = msg || '';
  }

  function isSsb(feature) {
    var sk = (feature && feature.section_key) || '';
    var slug = (feature && feature.slug) || '';
    return sk === 'scrollingSponsorBanner' || slug === 'scrolling-sponsor-banner';
  }

  function loadMeta() {
    return fetch('/marketplace/scrolling-sponsor-banner-v2.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function fetchPreset(slug) {
    if (presetCache[slug]) return Promise.resolve(presetCache[slug]);
    return fetch('/api/marketplace-playground?slug=' + encodeURIComponent(slug) + '&section_key=scrollingSponsorBanner')
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (data) {
        var preset = data;
        if (window.LPPlaygroundPreset) {
          preset = window.LPPlaygroundPreset.normalizePreset(data, {
            slug: slug,
            source: data.source || 'file',
            section_key: 'scrollingSponsorBanner',
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

  function detectViewportMode() {
    var w = window.innerWidth || document.documentElement.clientWidth || 1200;
    if (w <= 720) return 'phone';
    if (w <= 1100) return 'tablet';
    return 'desktop';
  }

  function effectiveDevice() {
    if (viewportMode !== 'phone' && device === 'desktop') return 'tablet';
    return device;
  }

  function syncPreviewLabel() {
    var el = document.querySelector('#playground [data-r="preview-label"]');
    if (!el) return;
    var d = effectiveDevice();
    el.textContent = d === 'phone' ? 'Mobile preview'
      : (d === 'desktop' ? 'Desktop preview' : 'Tablet preview');
  }

  function syncDevButtons() {
    var root = document.getElementById('playground');
    if (!root) return;
    var showDesktopBtn = viewportMode === 'phone';
    root.querySelectorAll('.pg-devbtns button').forEach(function (b) {
      var d = b.getAttribute('data-d');
      if (d === 'desktop') b.hidden = !showDesktopBtn;
      else b.hidden = false;
      b.classList.toggle('on', d === device);
    });
    syncPreviewLabel();
  }

  function fitStage() {
    var root = document.getElementById('playground');
    if (!root) return;
    viewportMode = detectViewportMode();
    root.setAttribute('data-layout', 'dual');
    root.setAttribute('data-viewport', viewportMode);
    var dualStrip = root.querySelector('[data-r="dual-strip"]');
    if (viewportMode === 'phone') {
      if (dualStrip) dualStrip.hidden = true;
      if (device !== 'desktop' && device !== 'tablet' && device !== 'phone') device = 'tablet';
    } else {
      if (dualStrip) dualStrip.hidden = false;
      if (device === 'desktop') device = 'tablet';
    }
    syncDevButtons();
    sizeIframe();
    sizeDualIframe();
  }

  function sizeIframe() {
    if (!iframe) return;
    var wrap = document.querySelector('#playground [data-r="wrap"]');
    var h = measurePreviewHeight(iframe) || 120;
    var d = effectiveDevice();
    iframe.style.minHeight = '0';
    if (wrap) {
      wrap.classList.remove('framed');
      wrap.classList.add('pg-device-fill');
      if (d === 'phone') {
        wrap.classList.add('pg-device-phone');
        iframe.style.width = '100%';
        iframe.style.maxWidth = '390px';
        iframe.style.marginLeft = 'auto';
        iframe.style.marginRight = 'auto';
      } else {
        wrap.classList.remove('pg-device-phone');
        iframe.style.width = '100%';
        iframe.style.maxWidth = '';
        iframe.style.marginLeft = '';
        iframe.style.marginRight = '';
      }
    }
    iframe.style.transform = 'none';
    iframe.style.marginBottom = '';
    iframe.style.height = h + 'px';
    if (wrap) wrap.style.height = '';
  }

  function sizeDualIframe() {
    if (!dualIframe) return;
    var dualWrap = document.querySelector('#playground [data-r="dual-wrap"]');
    var h = measurePreviewHeight(dualIframe) || 120;
    dualIframe.style.minHeight = '0';
    dualIframe.style.height = h + 'px';
    dualIframe.style.width = '100%';
    dualIframe.style.transform = 'none';
    dualIframe.style.marginBottom = '';
    if (dualWrap) {
      dualWrap.classList.remove('framed');
      dualWrap.style.height = '';
    }
  }

  function measurePreviewHeight(fr) {
    fr = fr || iframe;
    if (!fr) return 0;
    try {
      var doc = fr.contentDocument;
      if (!doc) return 0;
      var sec = doc.querySelector('[data-sec="scrollingSponsorBanner"]') || doc.querySelector('main') || doc.body;
      var h = sec ? Math.ceil(sec.getBoundingClientRect().height || sec.scrollHeight || 0) : 0;
      if (!h) h = Math.ceil(doc.body.scrollHeight || 0);
      if (h < 80) h = 80;
      if (h > 960) h = 960;
      return h + 8;
    } catch (_e) {
      return 0;
    }
  }

  function applyLiveConfig() {
    function paint(fr) {
      if (!fr) return;
      try {
        if (fr.contentWindow && fr.contentWindow.__applyTradeConfig) {
          fr.contentWindow.__applyTradeConfig(liveSiteCfg);
        }
      } catch (_e) {}
    }
    paint(iframe);
    paint(dualIframe);
    sizeIframe();
    sizeDualIframe();
  }


  function mountEditor() {
    var host = document.getElementById('mp-ssb-editor');
    if (!host || !window.LPScrollingSponsorBannerEditor) return;
    editorApi = window.LPScrollingSponsorBannerEditor.mount(host, {
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
        var canvas = document.querySelector('#playground [data-r="canvas"]');
        if (canvas) {
          iframe = document.createElement('iframe');
          iframe.className = 'pg-iframe';
          iframe.src = '/marketplace/demos/demo-scrollingSponsorBanner.html';
          iframe.style.cssText = 'width:100%;border:0;display:block;min-height:0;height:auto;vertical-align:top';
          iframe.setAttribute('title', 'Scrolling Sponsor Banner live preview');
          iframe.addEventListener('load', function () {
            applyLiveConfig();
            setTimeout(function () { sizeIframe(); sizeDualIframe(); }, 60);
          });
          canvas.innerHTML = '';
          canvas.appendChild(iframe);
        }
      }
      if (!dualIframe) {
        var dualCanvas = document.querySelector('#playground [data-r="dual-canvas"]');
        if (dualCanvas) {
          dualIframe = document.createElement('iframe');
          dualIframe.className = 'pg-iframe pg-iframe-dual';
          dualIframe.src = '/marketplace/demos/demo-scrollingSponsorBanner.html';
          dualIframe.style.cssText = 'width:100%;border:0;display:block;min-height:0;height:auto;vertical-align:top';
          dualIframe.setAttribute('title', 'Scrolling Sponsor Banner desktop preview');
          dualIframe.addEventListener('load', function () {
            applyLiveConfig();
            setTimeout(sizeDualIframe, 60);
          });
          dualCanvas.innerHTML = '';
          dualCanvas.appendChild(dualIframe);
        }
      }
      if (iframe || dualIframe) applyLiveConfig();
      if (editorApi) editorApi.setValue(liveSiteCfg);
      else mountEditor();
      renderPresetButtons();
      fitStage();
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
      var label = (cached && cached.label) || slug.replace(/^ssb-/, '').replace(/-/g, ' ');
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
      text: 'No extra subscription for the Scrolling Sponsor Banner itself. Premium and usage-based tools on other apps are marked clearly.'
    });
    points.push({
      title: 'Same editor as your website',
      text: 'Layout, colours, icons and items use the real LeadPages controls — nothing here is saved until you join and edit your own site.'
    });
    return points;
  }

  var HERO_FALLBACK = 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1400&h=560&fit=crop&q=80';

  function renderExamples(root, feature) {
    var examples = (meta && meta.examples) || [];
    var Acc = window.LPMarketplaceAccess;
    var accessType = (meta && meta.accessType) || 'included';
    var accessLong = Acc ? Acc.publicLabel(accessType, 'long') : 'Included with your LeadPages website';
    var points = infoPoints(feature);
    var heroImg = (feature && feature.hero_image_url)
      || (meta && meta.heroImage && meta.heroImage.url)
      || HERO_FALLBACK;

    var pointsHtml = points.map(function (p, i) {
      return '<details class="mp-info-point"' + (i === 0 ? ' open' : '') + '>'
        + '<summary><span class="mp-info-title">' + esc(p.title) + '</span></summary>'
        + '<p class="mp-info-text">' + esc(p.text) + '</p>'
        + '</details>';
    }).join('');

    var examplesHtml = examples.map(function (ex, idx) {
      return '<button type="button" class="mp-ex-chip" data-try-preset="' + esc(ex.presetSlug) + '">'
        + '<strong>' + esc(ex.businessName) + '</strong>'
        + '<span>' + esc(ex.mode === 'grid' ? 'Static grid' : 'Continuous scroll') + ' · ' + esc(ex.industry) + '</span>'
        + '</button>';
    }).join('');

    var mediaHtml = heroImg
      ? '<div class="himg"><img src="' + esc(heroImg) + '" alt="' + esc((feature && feature.name) || 'Scrolling Sponsor Banner') + ' preview" loading="eager"></div>'
      : '<div class="himg-placeholder">App preview</div>';

    root.innerHTML = ''
      + '<header class="feat-hero mp-v2-hero mp-info-hero"><div class="feat-hero-inner wrap-wide">'
      + '<div class="feat-hero-grid">'
      + '<div class="feat-hero-copy">'
      + '<div class="crumb"><a href="/marketplace?v2=1">← Marketplace</a></div>'
      + '<span class="eyebrow">' + esc((meta && meta.categoryEyebrow) || 'Sponsors and partners') + '</span>'
      + '<h1>' + esc(feature.name || 'Scrolling Sponsor Banner') + '</h1>'
      + '<p class="hsum">' + esc((meta && meta.shortDescription) || feature.summary || '') + '</p>'
      + '<div class="mp-labels">'
      + ((meta && meta.featureLabels) || []).map(function (l) {
        return '<span class="mp-label">' + esc(l) + '</span>';
      }).join('')
      + '<span class="mf-access mf-badge-inc" title="' + esc(accessLong) + '">Included</span>'
      + '</div>'
      + '<div class="mp-info-list" aria-label="App details">' + pointsHtml + '</div>'
      + '<div class="hcta">'
      + '<a class="btn" href="#playground">Try the demo ↓</a>'
      + '<a class="btn ghost" href="/partners">Become a partner</a>'
      + '</div>'
      + '</div>'
      + '<div class="feat-hero-media">' + mediaHtml + '</div>'
      + '</div></div></header>'

      + '<article class="mp-demo-article"><div class="wrap">'
      + '<section class="mp-demo-block pg pg-full pg-studio" id="playground" data-layout="dual" data-viewport="desktop">'
      + '<div class="mp-demo-head">'
      + '<div class="blk-eyebrow">Live demo</div>'
      + '<h2>Try the live sponsor banner</h2>'
      + '<p class="mp-lede">Edit headings, colours, motion and logos — the preview updates instantly. Nothing here is saved.</p>'
      + '</div>'
      + (examplesHtml ? '<div class="mp-ex-row" aria-label="Real examples">' + examplesHtml + '</div>' : '')
      + '<div class="pg-stage-shell" data-r="stage-shell">'
      + '<div class="pg-stage" data-r="stage">'
      + '<div class="pg-dual-strip" data-r="dual-strip">'
      + '<div class="pg-dual-label">Desktop preview</div>'
      + '<div class="pg-devicewrap pg-dual-wrap" data-r="dual-wrap">'
      + '<div class="pg-viewport"><div class="pg-canvas" data-r="dual-canvas"></div></div>'
      + '</div></div>'
      + '<div class="pg-studio-grid">'
      + '<div class="pg-panel pg-panel-compact">'
      + '<div class="pg-ctl-head"><h4>Customise the preview</h4>'
      + '<p class="hint">Same controls as the page editor — updates instantly</p></div>'
      + '<div id="mp-ssb-editor" class="tb-ed-root tb-ed-compact"></div>'
      + '</div>'
      + '<div class="pg-preview-col">'
      + '<div class="pg-topbar">'
      + '<div class="pg-preview-label" data-r="preview-label">Tablet preview</div>'
      + '<div class="pg-presets" data-r="presets" role="toolbar" aria-label="Industry presets"></div>'
      + '<div class="pg-devbtns" role="group" aria-label="Preview size">'
      + '<button type="button" data-d="desktop" class="pg-dev-desktop">Desktop</button>'
      + '<button type="button" data-d="tablet" class="on">Tablet</button>'
      + '<button type="button" data-d="phone">Phone</button>'
      + '</div>'
      + '<div class="mp-pg-actions">'
      + '<button type="button" class="btn ghost" id="mp-reset">Reset example</button>'
      + '</div></div>'
      + '<div class="pg-devicewrap" data-r="wrap">'
      + '<div class="pg-viewport" data-r="vp">'
      + '<div class="pg-canvas" data-r="canvas"></div>'
      + '</div></div>'
      + '</div>'
      + '</div>'
      + '</div></div>'
      + '<p class="sr-only" id="mp-live-status" aria-live="polite"></p>'
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
        var next = dev.getAttribute('data-d');
        if (viewportMode !== 'phone' && next === 'desktop') next = 'tablet';
        device = next;
        syncDevButtons();
        sizeIframe();
        announce('Preview size: ' + effectiveDevice());
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

    window.addEventListener('resize', function () {
      fitStage();
    });
    fitStage();
  }

  function addStyles() {
    if (document.getElementById('mp-feature-v2-style')) return;
    var s = document.createElement('style');
    s.id = 'mp-feature-v2-style';
    s.textContent = [
      '.mp-info-hero .hsum{max-width:60ch;margin:0 0 14px}',
      '.mp-info-hero .feat-hero-inner{padding-bottom:36px}',
      '.mp-info-hero .feat-hero-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,1fr);gap:clamp(22px,4vw,40px);align-items:stretch}',
      '.mp-info-hero .feat-hero-copy{min-width:0}',
      '.mp-info-hero .feat-hero-media{min-width:0;display:flex;align-self:stretch;min-height:100%}',
      '.mp-info-hero .himg{margin:0;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.12);box-shadow:0 28px 64px rgba(0,0,0,.28);background:rgba(0,0,0,.15);position:relative;flex:1 1 auto;width:100%;height:100%;min-height:100%;align-self:stretch}',
      '.mp-info-hero .himg img{position:absolute;inset:0;width:100%;height:100%;max-height:none;min-height:0;object-fit:cover;object-position:center;display:block}',
      '.mp-info-hero .himg-placeholder{flex:1 1 auto;width:100%;height:100%;min-height:100%;border-radius:18px;background:linear-gradient(135deg,rgba(168,74,94,.35),rgba(47,65,58,.8));border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.55);padding:24px;text-align:center}',
      '@media(max-width:900px){.mp-info-hero .feat-hero-grid{grid-template-columns:1fr}.mp-info-hero .feat-hero-media{order:-1;min-height:240px}.mp-info-hero .himg,.mp-info-hero .himg-placeholder{min-height:240px;height:auto;aspect-ratio:16/10}.mp-info-hero .himg img{position:absolute}}',
      '.mp-labels{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:14px 0 18px}',
      '.mp-label{display:inline-flex;padding:6px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.25);font-size:13px;font-weight:700;color:#F3EFEA}',
      '.mp-info-hero .mf-access.mf-badge-inc{background:color-mix(in srgb,var(--orange,var(--mf-orange,#C85A2C)) 22%,transparent);color:var(--orange,var(--mf-orange,#FFB089));border:1px solid color-mix(in srgb,var(--orange,var(--mf-orange,#C85A2C)) 55%,transparent)}',
      '.mp-info-hero .mf-access.mf-badge-inc::before{content:"✓";margin-right:2px}',
      '.mp-info-list{max-width:720px;margin:0 0 22px;display:grid;gap:8px}',
      '.mp-info-point{border:1px solid rgba(255,255,255,.18);border-radius:12px;background:rgba(255,255,255,.06);padding:0;overflow:hidden}',
      '.mp-info-point summary{list-style:none;cursor:pointer;padding:12px 14px;font-weight:700;display:flex;align-items:center;justify-content:space-between;gap:12px}',
      '.mp-info-point summary::-webkit-details-marker{display:none}',
      '.mp-info-point summary::after{content:"+";font-weight:800;opacity:.8}',
      '.mp-info-point[open] summary::after{content:"–"}',
      '.mp-info-point .mp-info-text{margin:0;padding:0 14px 14px;color:#C9D2CC;font-size:15px;line-height:1.5;max-width:62ch}',
      '.mp-demo-article{background:var(--theme-page-background,var(--paper,#FAF5F2));padding:36px 0 72px}',
      '.mp-demo-block{background:var(--theme-surface,#fff);border:1px solid var(--theme-border,var(--line));border-radius:18px;padding:22px 20px 18px;margin-bottom:0}',
      '.mp-demo-head{margin:0 0 16px}',
      '.mp-demo-head h2{font-family:var(--theme-heading-font,var(--disp));font-size:clamp(24px,3vw,32px);margin:6px 0 8px}',
      '.mp-lede{color:var(--theme-text-muted,var(--mut));max-width:60ch;margin:0}',
      '.mp-ex-row{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}',
      '.mp-ex-chip{appearance:none;border:1px solid var(--theme-border,var(--line));background:var(--theme-surface,#fff);border-radius:12px;padding:10px 12px;text-align:left;cursor:pointer;font:inherit;display:flex;flex-direction:column;gap:2px;min-width:180px}',
      '.mp-ex-chip strong{font-size:14px}',
      '.mp-ex-chip span{font-size:12.5px;color:var(--theme-text-muted,var(--mut))}',
      '.mp-ex-chip:hover,.mp-ex-chip:focus-visible{border-color:var(--theme-primary,var(--rose));outline:3px solid var(--theme-focus,var(--rose));outline-offset:2px}',
      '.mp-demo-block.pg-studio{padding:22px 20px 18px}',
      '.mp-demo-block .pg-ctl-head{margin:0 0 10px}',
      '.mp-demo-block .pg-ctl-head h4{margin:0 0 4px;font-family:var(--theme-heading-font,var(--disp));font-size:1.25rem;font-weight:800;letter-spacing:-0.02em;color:var(--theme-ink,var(--ink,#0b1b2a))}',
      '.mp-demo-block .pg-ctl-head .hint{margin:0;font-size:13px;color:var(--theme-text-muted,var(--mut))}',
      '.mp-demo-block .pg-devicewrap,.mp-demo-block .pg-viewport,.mp-demo-block .pg-canvas{overflow-anchor:none}',
      '.mp-demo-block .pg-iframe,.mp-demo-block iframe{display:block;min-height:0!important;overflow-anchor:none}',
      '.mp-pg-actions{display:flex;gap:8px;flex-wrap:wrap;margin-left:auto}',
      '#tb-h, .tb-ed-zone-style input[type="range"]{touch-action:none}',
      '.mp-demo-block .pg-topbar{flex-wrap:wrap;gap:10px;padding:0 0 10px}',
      '.hcta .btn{display:inline-flex;font-weight:700;padding:12px 22px;border-radius:999px;background:var(--theme-primary,var(--rose));color:#fff;border:2px solid transparent}',
      '.hcta .btn.ghost{background:transparent;border-color:currentColor;color:inherit}',
      '.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}',
      'section.back{display:none}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function bootFeatureV2(feature) {
    if (!isSsb(feature)) return false;
    var page = document.getElementById('page');
    if (!page) return false;
    addStyles();
    document.documentElement.setAttribute('data-mp-v2', '1');

    loadMeta().then(function (m) {
      meta = m || {
        publicHeading: 'Keep sponsors visible without cluttering your page.',
        shortDescription: feature.summary || '',
        longDescription: feature.summary || '',
        categoryEyebrow: 'Sponsors and partners',
        accessType: 'included',
        featureLabels: ['Included with LeadPages', 'Mobile responsive', 'Multiple banners per site'],
        modes: [
          { id: 'scroll', name: 'Continuous scroll', description: 'Logos loop smoothly left or right.' },
          { id: 'grid', name: 'Static grid', description: 'Wrap logos in a responsive grid.' }
        ],
        examples: [],
        presetOrder: ['ssb-veterans-cycling'],
        defaultPlaygroundPreset: 'ssb-veterans-cycling'
      };
      renderExamples(page, feature);
      wirePage();
      var def = meta.defaultPlaygroundPreset || 'ssb-veterans-cycling';
      var order = meta.presetOrder || [def];
      Promise.all(order.map(function (s) { return fetchPreset(s).catch(function () { return null; }); }))
        .then(function () {
          renderPresetButtons();
          return selectPreset(def);
        });
    });
    return true;
  }

  window.LPMarketplaceFeatureSsbV2 = {
    boot: bootFeatureV2,
    isSsb: isSsb,
    v2On: v2On
  };

  function autoBoot() {
    var slug = (location.pathname.split('/').filter(Boolean)[1] || '').toLowerCase();
    if (slug !== 'scrolling-sponsor-banner') return;
    var page = document.getElementById('page');
    if (!page) return;
    page.innerHTML = '<div class="status">Loading Scrolling Sponsor Banner…</div>';
    var fallback = {
      name: 'Scrolling Sponsor Banner',
      slug: 'scrolling-sponsor-banner',
      section_key: 'scrollingSponsorBanner',
      summary: 'Display sponsors, partners and brands in a seamless scrolling banner with optional links, text overlays and custom styling.',
      hero_image_url: HERO_FALLBACK
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
