/**
 * Marketplace feature page V2 — sell-first Trust Bar reference implementation.
 * Uses real playground iframe + LPTrustBarEditor (same control set as manage).
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
  var layoutMode = 'side'; // side | stacked
  var activePreset = '';
  var presetCache = {};
  var announceEl = null;

  function announce(msg) {
    if (!announceEl) {
      announceEl = document.getElementById('mp-live-status');
    }
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

  function applyLiveConfig() {
    if (!iframe) return;
    try {
      if (iframe.contentWindow && iframe.contentWindow.__applyTradeConfig) {
        iframe.contentWindow.__applyTradeConfig(liveSiteCfg);
      }
    } catch (_e) {}
    sizeIframe();
  }

  function sizeIframe() {
    if (!iframe) return;
    var wrap = document.querySelector('.mp-pg-devicewrap');
    var wmap = { desktop: null, tablet: 768, phone: 390 };
    var w = wmap[device];
    if (!w) {
      iframe.style.width = '100%';
      iframe.style.transform = 'none';
      iframe.style.marginBottom = '';
      if (wrap) { wrap.style.height = ''; wrap.classList.remove('framed'); }
    } else if (wrap) {
      wrap.classList.add('framed');
      iframe.style.width = w + 'px';
      var avail = wrap.clientWidth - 48;
      var s = Math.min(1, avail / w);
      iframe.style.transform = 'scale(' + s + ')';
      iframe.style.transformOrigin = 'top center';
      setTimeout(function () {
        try {
          var h = iframe.contentDocument.body.scrollHeight || 420;
          iframe.style.height = (h + 32) + 'px';
          iframe.style.marginBottom = ((h * s) - h) + 'px';
          wrap.style.height = (h * s + 48) + 'px';
        } catch (_e) {
          iframe.style.height = '420px';
        }
      }, 200);
      return;
    }
    setTimeout(function () {
      try {
        var h2 = iframe.contentDocument.body.scrollHeight;
        iframe.style.height = (h2 + 32) + 'px';
      } catch (_e2) {
        iframe.style.height = '420px';
      }
    }, 120);
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
          iframe.style.cssText = 'width:100%;border:0;display:block;min-height:320px';
          iframe.setAttribute('title', 'Trust Bar live preview');
          iframe.addEventListener('load', function () {
            applyLiveConfig();
            sizeIframe();
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
      // highlight paired preset if any
      var paired = preset.pairedPresetId || (preset.site_config && preset.pairedPresetId);
      void paired;
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

  function renderExamples(root, feature) {
    var examples = (meta && meta.examples) || [];
    var Acc = window.LPMarketplaceAccess;
    var accessType = (meta && meta.accessType) || 'included';
    var accessLong = Acc ? Acc.publicLabel(accessType, 'long') : 'Included with your LeadPages website';

    var modesHtml = ((meta && meta.modes) || []).map(function (m) {
      return '<article class="mp-mode-card"><h3>' + esc(m.name) + '</h3><p>' + esc(m.description) + '</p></article>';
    }).join('');

    var examplesHtml = examples.map(function (ex, idx) {
      var items = (ex.visibleItems || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
      return '<article class="mp-example-card">'
        + '<div class="mp-example-copy">'
        + '<span class="eyebrow">Example ' + (idx + 1) + ' — ' + esc(ex.businessName) + '</span>'
        + '<h3>' + esc(ex.title) + '</h3>'
        + '<p>' + esc(ex.description) + '</p>'
        + '<p class="mp-example-meta"><strong>Industry:</strong> ' + esc(ex.industry)
        + ' · <strong>Mode:</strong> ' + esc(ex.mode === 'images' ? 'Image Tiles' : 'Text and Icons') + '</p>'
        + '<ul class="mp-example-items">' + items + '</ul>'
        + '<button type="button" class="btn" data-try-preset="' + esc(ex.presetSlug) + '">Try this example</button>'
        + '</div>'
        + '<div class="mp-example-preview" data-example-preview="' + esc(ex.presetSlug) + '" aria-label="' + esc(ex.businessName) + ' Trust Bar preview"></div>'
        + '</article>';
    }).join('');

    var industry = (meta.presetOrder || []).filter(function (s) {
      return s.indexOf('carpenter') >= 0 || s.indexOf('plumber') >= 0 || s.indexOf('electrician') >= 0
        || s.indexOf('landscaper') >= 0 || s.indexOf('cafe') >= 0 || s.indexOf('accountant') >= 0
        || s.indexOf('medical') >= 0 || s.indexOf('rendering') >= 0 || s.indexOf('beauty') >= 0
        || s.indexOf('builder') >= 0 || s.indexOf('restaurant') >= 0 || s.indexOf('event') >= 0
        || s.indexOf('bean') >= 0 || s.indexOf('aam1') >= 0;
    });

    root.innerHTML = ''
      + '<header class="feat-hero mp-v2-hero"><div class="feat-hero-inner wrap-wide">'
      + '<div class="crumb"><a href="/marketplace?v2=1">← Marketplace</a></div>'
      + '<span class="eyebrow">' + esc((meta && meta.categoryEyebrow) || 'Trust and credibility') + '</span>'
      + '<h1>' + esc((meta && meta.publicHeading) || feature.name) + '</h1>'
      + '<p class="hsum">' + esc((meta && meta.longDescription) || feature.summary || '') + '</p>'
      + '<div class="mp-labels">'
      + ((meta && meta.featureLabels) || []).map(function (l) { return '<span class="mp-label">' + esc(l) + '</span>'; }).join('')
      + '<span class="mp-label">' + esc(accessLong) + '</span>'
      + '</div>'
      + '<div class="hcta">'
      + '<a class="btn" href="#examples">View examples</a>'
      + '<a class="btn ghost" href="#playground">Try the playground</a>'
      + '</div>'
      + '<div class="mp-hero-live" id="mp-hero-preview" aria-label="Featured Trust Bar example"></div>'
      + '</div></header>'

      + '<article class="mp-v2-article"><div class="wrap">'
      + '<section class="blk" id="examples">'
      + '<div class="blk-eyebrow">Real website examples</div>'
      + '<h2>See how different businesses use it.</h2>'
      + '<p class="mp-lede">Finished results first — then try the same layout in the playground.</p>'
      + examplesHtml
      + '</section>'

      + '<section class="blk" id="modes">'
      + '<div class="blk-eyebrow">Layouts and possibilities</div>'
      + '<h2>Two clear ways to present the same idea.</h2>'
      + '<div class="mp-modes">' + modesHtml + '</div>'
      + '</section>'

      + '<section class="blk" id="presets">'
      + '<div class="blk-eyebrow">Industry inspiration</div>'
      + '<h2>Start with an idea for your industry.</h2>'
      + '<p class="mp-lede">Choose an example, then change the wording, icons, images and colours using the same editor available inside LeadPages.</p>'
      + '<div class="mp-industry-grid" id="mp-industry">'
      + industry.map(function (slug) {
        var label = slug.replace(/^trustbar-/, '').replace(/-/g, ' ');
        return '<button type="button" class="mp-industry-card" data-try-preset="' + esc(slug) + '"><span>' + esc(label) + '</span></button>';
      }).join('')
      + '</div></section>'

      + '<section class="blk" id="access">'
      + '<div class="blk-eyebrow">Access</div>'
      + '<h2>Included with your LeadPages website.</h2>'
      + '<p class="mp-lede">The Trust Bar is included. Other marketplace apps may be free with limits, premium, usage-based, or require an external connection — those are marked clearly on each page.</p>'
      + '</section>'

      + '<section class="blk pg pg-full mp-pg" id="playground">'
      + '<div class="pg-band">'
      + '<div class="blk-eyebrow">Try it yourself</div>'
      + '<h2>It really is this simple.</h2>'
      + '<p>Choose a preset and make a few changes. This is the same editor used inside LeadPages, so what you try here is exactly what you will use when editing your own website.</p>'
      + '<p class="mp-note">Have a play. Nothing here will be saved.</p>'
      + '</div>'
      + '<div class="pg-topbar">'
      + '<div class="pg-presets" data-r="presets" role="toolbar" aria-label="Industry presets"></div>'
      + '<div class="pg-devbtns" role="group" aria-label="Preview size">'
      + '<button type="button" data-d="desktop" class="on">Desktop</button>'
      + '<button type="button" data-d="tablet">Tablet</button>'
      + '<button type="button" data-d="phone">Phone</button>'
      + '</div>'
      + '<div class="mp-pg-actions">'
      + '<button type="button" class="btn ghost" id="mp-layout-toggle">Editor below</button>'
      + '<button type="button" class="btn ghost" id="mp-reset">Reset example</button>'
      + '</div></div>'
      + '<div class="mp-pg-grid" id="mp-pg-grid" data-layout="side">'
      + '<div class="mp-pg-preview">'
      + '<div class="pg-devicewrap" data-r="wrap"><div class="pg-viewport" data-r="vp"><div class="pg-canvas" data-r="canvas"></div></div></div>'
      + '</div>'
      + '<div class="mp-pg-editor">'
      + '<button type="button" class="btn mp-edit-mobile" id="mp-edit-mobile">Edit this example</button>'
      + '<div id="mp-tb-editor" class="tb-ed-root"></div>'
      + '</div></div>'
      + '<p class="sr-only" id="mp-live-status" aria-live="polite"></p>'
      + '</section>'

      + '<section class="blk" id="same-editor">'
      + '<div class="blk-eyebrow">The real editor</div>'
      + '<h2>No hidden builder to learn later.</h2>'
      + '<p class="mp-lede">The controls above are the real LeadPages controls. Upload your images, change your wording, choose a layout and publish when you are ready.</p>'
      + '<ol class="mp-steps">'
      + '<li><strong>Choose an idea.</strong> Start from a practical business preset.</li>'
      + '<li><strong>Make it yours.</strong> Replace the wording, icons and images.</li>'
      + '<li><strong>See every change.</strong> The website preview updates instantly.</li>'
      + '<li><strong>Publish confidently.</strong> The same controls continue inside your LeadPages account.</li>'
      + '</ol></section>'

      + '<section class="blk"><div class="ctab">'
      + '<h2>Imagine this already built into your website.</h2>'
      + '<p>LeadPages gives you practical website features, real business examples and an editor designed for people who want to build attractive websites without learning code.</p>'
      + '<div class="mp-hero-cta">'
      + '<a class="btn" style="background:var(--theme-page-background,var(--paper));color:var(--theme-secondary,var(--gum))" href="/start-your-business">Build my LeadPages website</a>'
      + '<a class="btn ghost" href="/partners">Become a LeadPages partner</a>'
      + '</div>'
      + '<p class="mp-note" style="margin-top:16px">Many apps are included. Premium and usage-based tools are clearly marked before you use them.</p>'
      + '</div></section>'
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

    var layoutToggle = document.getElementById('mp-layout-toggle');
    var grid = document.getElementById('mp-pg-grid');
    if (layoutToggle && grid) {
      function applyLayout() {
        var stacked = layoutMode === 'stacked' || window.innerWidth < 960;
        grid.setAttribute('data-layout', stacked ? 'stacked' : 'side');
        layoutToggle.textContent = stacked ? 'Side by side' : 'Editor below';
      }
      layoutToggle.addEventListener('click', function () {
        layoutMode = layoutMode === 'side' ? 'stacked' : 'side';
        applyLayout();
      });
      window.addEventListener('resize', applyLayout);
      applyLayout();
    }

    var editMobile = document.getElementById('mp-edit-mobile');
    if (editMobile) {
      editMobile.addEventListener('click', function () {
        var ed = document.getElementById('mp-tb-editor');
        if (ed) {
          ed.hidden = false;
          ed.scrollIntoView({ behavior: 'smooth', block: 'start' });
          announce('Editor opened');
        }
      });
    }
  }

  function mountHeroPreview(slug) {
    var host = document.getElementById('mp-hero-preview');
    if (!host) return;
    var fr = document.createElement('iframe');
    fr.src = '/marketplace/demos/demo-trustBar.html';
    fr.title = 'Featured Trust Bar example';
    fr.style.cssText = 'width:100%;border:0;display:block;min-height:200px;border-radius:14px;background:#fff';
    fr.addEventListener('load', function () {
      fetchPreset(slug).then(function (preset) {
        try {
          fr.contentWindow.__applyTradeConfig(presetToSiteConfig(preset));
          setTimeout(function () {
            try { fr.style.height = (fr.contentDocument.body.scrollHeight + 16) + 'px'; } catch (_e) {}
          }, 200);
        } catch (_e2) {}
      });
    });
    host.appendChild(fr);
  }

  function mountExamplePreviews() {
    document.querySelectorAll('[data-example-preview]').forEach(function (host) {
      var slug = host.getAttribute('data-example-preview');
      var fr = document.createElement('iframe');
      fr.src = '/marketplace/demos/demo-trustBar.html';
      fr.title = 'Example preview';
      fr.loading = 'lazy';
      fr.style.cssText = 'width:100%;border:0;display:block;min-height:180px;border-radius:12px;background:#fff';
      fr.addEventListener('load', function () {
        fetchPreset(slug).then(function (preset) {
          try {
            fr.contentWindow.__applyTradeConfig(presetToSiteConfig(preset));
            setTimeout(function () {
              try { fr.style.height = (fr.contentDocument.body.scrollHeight + 12) + 'px'; } catch (_e) {}
            }, 220);
          } catch (_e2) {}
        });
      });
      host.appendChild(fr);
    });
  }

  function addStyles() {
    if (document.getElementById('mp-feature-v2-style')) return;
    var s = document.createElement('style');
    s.id = 'mp-feature-v2-style';
    s.textContent = [
      '.mp-v2-hero .hsum{max-width:60ch}',
      '.mp-labels{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 8px}',
      '.mp-label{display:inline-flex;padding:6px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.25);font-size:13px;font-weight:700;color:#F3EFEA}',
      '.mp-hero-live{margin-top:28px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:10px;overflow:hidden}',
      '.mp-lede{color:var(--theme-text-muted,var(--mut));max-width:60ch;margin:0 0 22px}',
      '.mp-note{font-size:14px;color:var(--theme-text-muted,var(--mut));margin-top:10px}',
      '.mp-example-card{display:grid;grid-template-columns:1.05fr .95fr;gap:28px;align-items:start;margin:0 0 36px;padding:24px;border:1px solid var(--theme-border,var(--line));border-radius:var(--theme-radius-large,22px);background:var(--theme-surface,#fff)}',
      '@media(max-width:900px){.mp-example-card{grid-template-columns:1fr}}',
      '.mp-example-items{margin:12px 0 18px;padding-left:18px;color:var(--theme-text,var(--ink))}',
      '.mp-example-meta{font-size:14px;color:var(--theme-text-muted,var(--mut))}',
      '.mp-modes{display:grid;grid-template-columns:1fr 1fr;gap:16px}',
      '@media(max-width:700px){.mp-modes{grid-template-columns:1fr}}',
      '.mp-mode-card{padding:20px;border:1px solid var(--theme-border,var(--line));border-radius:16px;background:var(--theme-surface-alt,var(--shell))}',
      '.mp-mode-card h3{font-family:var(--theme-heading-font,var(--disp));margin-bottom:8px}',
      '.mp-industry-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}',
      '@media(max-width:900px){.mp-industry-grid{grid-template-columns:repeat(2,1fr)}}',
      '.mp-industry-card{appearance:none;border:1px solid var(--theme-border,var(--line));background:var(--theme-surface,#fff);border-radius:14px;padding:16px;text-align:left;font:inherit;font-weight:700;cursor:pointer;text-transform:capitalize}',
      '.mp-industry-card:hover,.mp-industry-card:focus-visible{border-color:var(--theme-primary,var(--rose));outline:3px solid var(--theme-focus,var(--rose));outline-offset:2px}',
      '.mp-pg-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:18px;align-items:start}',
      '.mp-pg-grid[data-layout="stacked"]{grid-template-columns:1fr}',
      '@media(max-width:960px){.mp-pg-grid{grid-template-columns:1fr}.mp-edit-mobile{display:inline-flex!important}}',
      '.mp-edit-mobile{display:none;margin-bottom:12px}',
      '.mp-pg-actions{display:flex;gap:8px;flex-wrap:wrap}',
      '.mp-pg .pg-topbar{flex-wrap:wrap;gap:12px}',
      '.mp-steps{margin:0;padding-left:22px;max-width:64ch}',
      '.mp-steps li{margin:0 0 12px}',
      '.mp-hero-cta{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:18px}',
      '.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}',
      'section.back p{max-width:52ch;margin:0 auto 18px}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function patchBackBand() {
    var back = document.querySelector('section.back');
    if (!back) return;
    back.innerHTML = '<h2>Imagine this already built into your website.</h2>'
      + '<p>LeadPages gives you practical website features, real business examples and an editor designed for people who want to build attractive websites without learning code.</p>'
      + '<p class="mp-note">Many apps are included. Premium and usage-based tools are clearly marked before you use them.</p>'
      + '<div class="mp-hero-cta">'
      + '<a class="btn" href="/start-your-business">Build my LeadPages website</a>'
      + '<a class="btn" href="/partners" style="background:transparent;border:2px solid currentColor">Become a LeadPages partner</a>'
      + '</div>';
  }

  function bootFeatureV2(feature) {
    if (!v2On() || !isTrustBar(feature)) return false;
    var page = document.getElementById('page');
    if (!page) return false;
    addStyles();
    document.documentElement.setAttribute('data-mp-v2', '1');
    patchBackBand();

    loadMeta().then(function (m) {
      meta = m || {
        publicHeading: 'Give visitors a reason to trust you immediately.',
        categoryEyebrow: 'Trust and credibility',
        longDescription: feature.summary || '',
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
      // Prefetch labels then select
      var order = meta.presetOrder || [def];
      Promise.all(order.map(function (s) { return fetchPreset(s).catch(function () { return null; }); }))
        .then(function () {
          renderPresetButtons();
          return selectPreset(def);
        })
        .then(function () {
          mountHeroPreview(def);
          mountExamplePreviews();
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
    page.innerHTML = '<div class="status">Loading Trust Bar showcase…</div>';
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
