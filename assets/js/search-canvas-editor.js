/**
 * SearchCanvas editor panel for manage.html (dark control-panel patterns).
 * Expects host page globals: $, esc, persist, previewApply, toast, wireSecColorPair (optional),
 * and LP_ICONS / icon picker helpers when available.
 */
(function () {
  'use strict';

  var ICON_CHOICES = [
    '', 'check', 'leaf', 'hammer', 'brick-wall', 'house', 'wrench', 'droplet', 'map-pin', 'shield',
    'star', 'briefcase', 'scan-search', 'chart-bar', 'building', 'coffee', 'scissors', 'heart',
    'laptop', 'truck', 'calendar', 'users', 'layers', 'toolbox', 'zap'
  ];

  function deepClone(o) {
    return JSON.parse(JSON.stringify(o || {}));
  }

  function serviceTitlesFromConfig(c) {
    function titles(list) {
      if (!Array.isArray(list)) return [];
      return list
        .filter(function (s) { return s && s.on !== false; })
        .map(function (s) {
          if (typeof s === 'string') return String(s).trim();
          return String((s && (s.title || s.name || s.label || s.heading)) || '').trim();
        })
        .filter(Boolean);
    }
    var root = titles(c && c.services);
    if (root.length) return root.slice(0, 8);
    var sec = (c && c.sections && c.sections.services) || {};
    return titles(sec.items || sec.cards || sec.list || sec.services).slice(0, 8);
  }

  function isPlaceholderTabs(tabs) {
    if (!Array.isArray(tabs) || !tabs.length) return true;
    var seed = { planning: 1, delivery: 1, support: 1, maintenance: 1, consultation: 1, service: 1, 'new topic': 1 };
    var re = /add clear, customer-facing detail|describe this (service|topic) for visitors/i;
    var hits = 0;
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i] || {};
      var label = String(t.label || '').toLowerCase().trim();
      if (seed[label] || re.test(String(t.intro || ''))) hits++;
    }
    return hits >= Math.max(1, Math.ceil(tabs.length * 0.5));
  }

  function tabsFromServices(titles) {
    return titles.map(function (title) {
      var t = newTab();
      t.label = String(title).split(/\s+/).slice(0, 4).join(' ');
      t.heading = String(title);
      t.intro = '';
      t.bullets = [];
      t.link = { label: '', destination: null };
      return t;
    });
  }

  function ensure(c) {
    if (!c.sections) c.sections = {};
    if (!c.sections.searchCanvas || typeof c.sections.searchCanvas !== 'object') {
      c.sections.searchCanvas = window.LP_SEARCH_CANVAS_DEFAULT
        ? deepClone(window.LP_SEARCH_CANVAS_DEFAULT)
        : { on: true, version: 1, header: { eyebrow: 'Our expertise', heading: 'Solutions designed around your business', intro: 'Generate with AI to create service tabs for this business.', colours: {} }, tabs: [], style: {}, layout: {}, cta: {}, ai: {} };
    }
    var S = c.sections.searchCanvas;
    if (!S.header) S.header = { eyebrow: '', heading: '', intro: '', colours: {} };
    if (!S.header.colours) S.header.colours = {};
    if (!Array.isArray(S.tabs)) S.tabs = [];
    // Replace empty/placeholder Planning–Delivery with real site services when available.
    if (isPlaceholderTabs(S.tabs)) {
      var svc = serviceTitlesFromConfig(c);
      S.tabs = svc.length ? tabsFromServices(svc) : [];
      S.defaultTabId = S.tabs[0] && S.tabs[0].id;
    }
    if (!S.style) S.style = {};
    if (!S.layout) S.layout = { preset: 'vertical-tabs-image-right', imageMode: 'per-tab', mobileMode: 'single-accordion', contentWidth: 'wide' };
    if (!S.layout.contentWidth) S.layout.contentWidth = 'wide';
    if (!S.cta) S.cta = { enabled: false, style: 'strip' };
    if (!S.ai) S.ai = {};
    if (S.on !== true) S.on = true;
    return S;
  }

  function newTab() {
    var id = 'tab-' + Math.random().toString(36).slice(2, 9);
    return {
      id: id,
      label: 'New topic',
      iconKey: 'check',
      heading: 'New topic heading',
      intro: 'Describe this topic for visitors.',
      content: '',
      bullets: ['What’s included', 'How it works', 'What to expect', 'Next steps'],
      image: { url: null, publicId: null, alt: '', fit: 'cover', objectPosition: 'center' },
      link: { label: '', destination: null },
      button: { enabled: false, label: '', destination: null },
      on: true
    };
  }

  function colorRow(id, label, help) {
    return (
      '<div class="f" style="margin:0;flex:1 1 calc(50% - 6px);min-width:190px;"><label>' +
      label +
      '</label><p class="hint" style="margin:2px 0 6px;font-size:12px;">' +
      help +
      '</p>' +
      '<div style="display:flex;gap:8px;align-items:center;"><input type="color" id="' +
      id +
      '-clr" style="width:46px;height:38px;padding:2px;border:1px solid var(--line);border-radius:8px;cursor:pointer;">' +
      '<input type="text" class="tin" id="' +
      id +
      '" placeholder="Theme default" style="flex:1;min-width:0;">' +
      '<button type="button" class="btn ghost sm" id="' +
      id +
      '-def">Default</button></div></div>'
    );
  }

  function byId(id) {
    // Always use getElementById — never assume window.$ is our id helper.
    return typeof document !== 'undefined' ? document.getElementById(id) : null;
  }

  function unwrapDraft(raw) {
    if (typeof window.lpUnwrapSearchCanvasDraft === 'function') {
      return window.lpUnwrapSearchCanvasDraft(raw);
    }
    if (!raw || typeof raw !== 'object') return null;
    if (Array.isArray(raw.tabs)) return raw;
    if (raw.draft) return unwrapDraft(raw.draft);
    if (raw.data) return unwrapDraft(raw.data);
    if (raw.sections && raw.sections.searchCanvas) return unwrapDraft(raw.sections.searchCanvas);
    return raw.eyebrow || raw.heading || raw.intro ? raw : null;
  }

  function wireColor(prefix, getSet) {
    var tx = byId(prefix);
    var clr = byId(prefix + '-clr');
    var def = byId(prefix + '-def');
    var cur = getSet() || '';
    if (tx) tx.value = cur;
    if (clr && /^#[0-9a-fA-F]{6}$/.test(cur)) clr.value = cur;
    else if (clr) clr.value = '#1a2230';
    function apply(v) {
      v = String(v || '').trim();
      if (v && v[0] !== '#') v = '#' + v;
      if (v && !/^#[0-9a-fA-F]{3,8}$/.test(v)) v = '';
      getSet(v || null);
      if (tx) tx.value = v || '';
      if (clr && v && /^#[0-9a-fA-F]{6}$/.test(v)) clr.value = v;
      if (typeof window.persist === 'function') window.persist();
      if (typeof window.previewApply === 'function') window.previewApply();
    }
    if (tx) tx.addEventListener('input', function () { apply(tx.value); });
    if (clr) clr.addEventListener('input', function () { apply(clr.value); });
    if (def) def.addEventListener('click', function () { apply(''); });
  }

  function iconOptions(sel) {
    return ICON_CHOICES.map(function (k) {
      return (
        '<option value="' +
        k +
        '"' +
        (sel === k ? ' selected' : '') +
        '>' +
        (k || '— no icon —') +
        '</option>'
      );
    }).join('');
  }

  /**
   * @param {object} c site config
   * @param {HTMLElement} body host element
   * @param {{ secCard?: Function, wireSec?: Function }} helpers
   */
  window.lpRenderSearchCanvasEditor = function (c, body, helpers) {
    var $ = byId;
    var esc = typeof window.esc === 'function'
      ? window.esc
      : function (s) {
          return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        };
    var S = ensure(c);
    S.on = true;
    // Persist seeded defaults immediately so preview never paints an empty shell.
    if (typeof window.persist === 'function') window.persist();

    var h =
      (helpers && helpers.secCard
        ? helpers.secCard(c, 'searchCanvas', 'SearchCanvas', true, [])
        : '<div class="card"><h2>SearchCanvas</h2></div>') +
      '<p class="hint" style="margin:-8px 0 14px">Visual tabbed SEO section. Content stays real HTML text — not embedded in images.</p>' +
      '<div class="card" style="margin-bottom:18px"><h2 style="margin:0 0 6px">Section header</h2>' +
      '<div class="f"><label>Eyebrow</label><input class="tin" id="sc-eyebrow" value="' +
      esc(S.header.eyebrow || '') +
      '"></div>' +
      '<div class="f"><label>Main heading</label><input class="tin" id="sc-heading" value="' +
      esc(S.header.heading || '') +
      '"></div>' +
      '<div class="f"><label>Intro text</label><textarea class="tin" id="sc-intro" rows="3">' +
      esc(S.header.intro || '') +
      '</textarea></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:10px">' +
      colorRow('sc-col-eyebrow', 'Eyebrow colour', 'Theme default when blank.') +
      colorRow('sc-col-heading', 'Main heading colour', 'Theme default when blank.') +
      colorRow('sc-col-intro', 'Intro text colour', 'Theme default when blank.') +
      '</div></div>' +
      '<div class="card" style="margin-bottom:18px"><h2 style="margin:0 0 6px">Master accent colour</h2>' +
      '<p class="lede" style="margin:0 0 10px">Controls active tabs, ticks, links and CTA accents.</p>' +
      colorRow('sc-master', 'Master accent colour', 'Leave blank to use the site theme accent.') +
      '</div>' +
      '<div class="card" style="margin-bottom:18px"><h2 style="margin:0 0 6px">Layout</h2>' +
      '<div class="row"><div class="f"><label>Layout preset</label><select id="sc-preset" class="tin">' +
      [
        ['vertical-tabs-image-right', 'Vertical Tabs + Image'],
        ['vertical-tabs-image-left', 'Image + Vertical Tabs'],
        ['horizontal-tabs', 'Horizontal Tabs'],
        ['cards', 'Content Cards'],
        ['editorial-split', 'Editorial Split']
      ]
        .map(function (o) {
          return '<option value="' + o[0] + '"' + ((S.layout.preset || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        })
        .join('') +
      '</select></div>' +
      '<div class="f"><label>Image behaviour</label><select id="sc-image-mode" class="tin">' +
      [
        ['per-tab', 'Image changes with active tab'],
        ['shared', 'Single shared image'],
        ['none', 'No image']
      ]
        .map(function (o) {
          return '<option value="' + o[0] + '"' + ((S.layout.imageMode || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        })
        .join('') +
      '</select></div></div>' +
      '<div class="row"><div class="f"><label>Mobile behaviour</label><select id="sc-mobile" class="tin">' +
      '<option value="single-accordion"' +
      ((S.layout.mobileMode || 'single-accordion') === 'single-accordion' ? ' selected' : '') +
      '>Single item open</option>' +
      '<option value="multi-accordion"' +
      (S.layout.mobileMode === 'multi-accordion' ? ' selected' : '') +
      '>Multiple items open</option></select></div>' +
      '<div class="f"><label>Content width</label><select id="sc-width" class="tin">' +
      [
        ['site', 'Site width (1440px)'],
        ['narrow', 'Narrow'],
        ['wide', 'Wide (1440px)']
      ]
        .map(function (o) {
          return '<option value="' + o[0] + '"' + ((S.layout.contentWidth || 'wide') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        })
        .join('') +
      '</select></div></div></div>' +
      '<div class="card" style="margin-bottom:18px"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">' +
      '<div><h2 style="margin:0 0 4px">SearchCanvas tabs</h2><p class="lede" style="margin:0">Each tab is a service. Generate with AI to build the list from your keyword and site services.</p></div>' +
      '<button type="button" class="btn sm" id="sc-add-tab">+ Add tab</button></div>' +
      '<div id="sc-tabs-host" style="margin-top:12px"></div>' +
      '<p class="hint" id="sc-tab-empty" style="display:none">No service tabs yet — click Generate with AI (or Add tab).</p>' +
      '<p class="hint" id="sc-tab-warn" style="display:none;color:var(--warning,#b45309)">You have more than 8 tabs — keep the set focused for visitors and SEO.</p></div>' +
      '<div class="card" style="margin-bottom:18px"><h2 style="margin:0 0 6px">Closing CTA</h2>' +
      '<label class="ck" style="display:flex;gap:8px;align-items:center;font-weight:600;margin:0 0 10px"><input type="checkbox" id="sc-cta-on"' +
      (S.cta.enabled ? ' checked' : '') +
      '> Show CTA</label>' +
      '<div class="f"><label>CTA heading</label><input class="tin" id="sc-cta-heading" value="' +
      esc(S.cta.heading || '') +
      '"></div>' +
      '<div class="f"><label>CTA text</label><textarea class="tin" id="sc-cta-text" rows="2">' +
      esc(S.cta.text || '') +
      '</textarea></div>' +
      '<div class="row"><div class="f"><label>Primary button</label><input class="tin" id="sc-cta-btn" value="' +
      esc(S.cta.primaryLabel || '') +
      '"></div>' +
      '<div class="f"><label>Button destination</label><input class="tin" id="sc-cta-href" placeholder="#quote or https://…" value="' +
      esc((S.cta.primaryDestination && S.cta.primaryDestination.value) || '') +
      '"></div></div>' +
      '<div class="f"><label>CTA style</label><select id="sc-cta-style" class="tin">' +
      [
        ['strip', 'Inline strip'],
        ['panel', 'Full-width panel'],
        ['simple', 'Simple text and button']
      ]
        .map(function (o) {
          return '<option value="' + o[0] + '"' + ((S.cta.style || 'strip') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        })
        .join('') +
      '</select></div></div>' +
      '<div class="card" style="margin-bottom:18px"><h2 style="margin:0 0 6px">AI regenerate — LeadPages Brain</h2>' +
      '<p class="lede" style="margin:0 0 10px">Uses OpenAI via Brain to create <strong>service tabs</strong> for this business (not generic Planning/Delivery). Primary keyword required.</p>' +
      '<div class="row"><div class="f"><label for="sc-ai-kw">Primary keyword <span class="hint">required</span></label><input id="sc-ai-kw" class="tin" value="' +
      esc(S.ai.primaryKeyword || c.primaryKeyword || '') +
      '"></div>' +
      '<div class="f"><label for="sc-ai-loc">Location</label><input id="sc-ai-loc" class="tin" value="' +
      esc(S.ai.location || '') +
      '"></div></div>' +
      '<div class="f"><label for="sc-ai-extra">Extra information <span class="hint">optional</span></label><textarea id="sc-ai-extra" class="tin" rows="3" placeholder="Important business-specific facts for OpenAI to incorporate…"></textarea></div>' +
      '<div class="row"><div class="f"><label>Number of tabs</label><select id="sc-ai-tabs" class="tin"><option>4</option><option selected>5</option><option>6</option></select></div>' +
      '<div class="f"><label>Generation mode</label><select id="sc-ai-mode" class="tin"><option value="replace" selected>Replace all tabs with AI services</option><option value="preserve">Preserve edited fields</option><option value="fillEmpty">Fill empty fields only</option></select></div></div>' +
      '<label class="ck" style="display:flex;gap:8px;align-items:center;font-weight:600;margin:0 0 10px"><input type="checkbox" id="sc-ai-faq"> Also update homepage FAQ</label>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap"><button type="button" class="btn sm" id="sc-ai-go">Generate with AI</button><span class="hint" id="sc-ai-note"></span></div></div>';

    body.innerHTML = h;
    if (helpers && helpers.wireSec) helpers.wireSec(c, 'searchCanvas', true, []);

    function save() {
      if (typeof window.persist === 'function') window.persist();
      if (typeof window.previewApply === 'function') window.previewApply();
    }

    function bindText(id, fn) {
      var el = $(id);
      if (!el) return;
      el.addEventListener('input', function () {
        fn(el.value);
        save();
      });
    }

    bindText('sc-eyebrow', function (v) { ensure(c).header.eyebrow = v; });
    bindText('sc-heading', function (v) { ensure(c).header.heading = v; });
    bindText('sc-intro', function (v) { ensure(c).header.intro = v; });
    wireColor('sc-col-eyebrow', function (v) {
      if (arguments.length) ensure(c).header.colours.eyebrow = v;
      return ensure(c).header.colours.eyebrow;
    });
    wireColor('sc-col-heading', function (v) {
      if (arguments.length) ensure(c).header.colours.heading = v;
      return ensure(c).header.colours.heading;
    });
    wireColor('sc-col-intro', function (v) {
      if (arguments.length) ensure(c).header.colours.intro = v;
      return ensure(c).header.colours.intro;
    });
    wireColor('sc-master', function (v) {
      if (arguments.length) ensure(c).style.masterColour = v;
      return ensure(c).style.masterColour;
    });

    ['sc-preset', 'sc-image-mode', 'sc-mobile', 'sc-width'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener('change', function () {
        var S2 = ensure(c);
        if (id === 'sc-preset') S2.layout.preset = el.value;
        if (id === 'sc-image-mode') S2.layout.imageMode = el.value;
        if (id === 'sc-mobile') S2.layout.mobileMode = el.value;
        if (id === 'sc-width') S2.layout.contentWidth = el.value;
        save();
      });
    });

    bindText('sc-cta-heading', function (v) { ensure(c).cta.heading = v; });
    bindText('sc-cta-text', function (v) { ensure(c).cta.text = v; });
    bindText('sc-cta-btn', function (v) { ensure(c).cta.primaryLabel = v; });
    bindText('sc-cta-href', function (v) {
      ensure(c).cta.primaryDestination = v ? { type: v[0] === '#' ? 'section' : 'url', value: v } : null;
    });
    var ctaOn = $('sc-cta-on');
    if (ctaOn) ctaOn.addEventListener('change', function () { ensure(c).cta.enabled = !!ctaOn.checked; save(); });
    var ctaStyle = $('sc-cta-style');
    if (ctaStyle) ctaStyle.addEventListener('change', function () { ensure(c).cta.style = ctaStyle.value; save(); });

    function drawTabs() {
      var host = $('sc-tabs-host');
      var warn = $('sc-tab-warn');
      var empty = $('sc-tab-empty');
      if (!host) return;
      var tabs = ensure(c).tabs;
      if (warn && warn.style) warn.style.display = tabs.length > 8 ? '' : 'none';
      if (empty && empty.style) empty.style.display = tabs.length ? 'none' : '';
      if (!tabs.length) {
        host.innerHTML = '';
        return;
      }
      host.innerHTML = tabs
        .map(function (t, i) {
          var bullets = (t.bullets || []).join('\n');
          return (
            '<details class="sc-tab-ed" data-i="' +
            i +
            '" style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:0 0 10px"' +
            (i === 0 ? ' open' : '') +
            '>' +
            '<summary style="cursor:pointer;font-weight:700">Tab ' +
            (i + 1) +
            ': ' +
            esc(t.label || 'Untitled') +
            '</summary>' +
            '<div style="margin-top:10px;display:grid;gap:8px">' +
            '<div class="row"><div class="f"><label>Tab label</label><input class="tin sc-t-label" data-i="' +
            i +
            '" value="' +
            esc(t.label || '') +
            '"></div>' +
            '<div class="f"><label>Icon</label><select class="tin sc-t-icon" data-i="' +
            i +
            '">' +
            iconOptions(t.iconKey || '') +
            '</select></div></div>' +
            '<div class="f"><label>Tab heading</label><input class="tin sc-t-heading" data-i="' +
            i +
            '" value="' +
            esc(t.heading || '') +
            '"></div>' +
            '<div class="f"><label>Tab intro</label><textarea class="tin sc-t-intro" data-i="' +
            i +
            '" rows="3">' +
            esc(t.intro || '') +
            '</textarea></div>' +
            '<div class="f"><label>Supporting content</label><textarea class="tin sc-t-content" data-i="' +
            i +
            '" rows="3">' +
            esc(t.content || '') +
            '</textarea></div>' +
            '<div class="f"><label>Bullet points <span class="hint">one per line</span></label><textarea class="tin sc-t-bullets" data-i="' +
            i +
            '" rows="4">' +
            esc(bullets) +
            '</textarea></div>' +
            '<div class="row"><div class="f"><label>Image URL</label><input class="tin sc-t-image" data-i="' +
            i +
            '" value="' +
            esc((t.image && t.image.url) || '') +
            '"></div>' +
            '<div class="f"><label>Image alt</label><input class="tin sc-t-alt" data-i="' +
            i +
            '" value="' +
            esc((t.image && t.image.alt) || '') +
            '"></div></div>' +
            '<div class="row"><div class="f"><label>Text link label</label><input class="tin sc-t-link" data-i="' +
            i +
            '" value="' +
            esc((t.link && t.link.label) || '') +
            '"></div>' +
            '<div class="f"><label>Link destination</label><input class="tin sc-t-href" data-i="' +
            i +
            '" placeholder="#services or /page" value="' +
            esc((t.link && t.link.destination && t.link.destination.value) || '') +
            '"></div></div>' +
            '<div class="row" style="gap:8px;flex-wrap:wrap">' +
            '<button type="button" class="btn ghost sm sc-t-up" data-i="' +
            i +
            '">↑</button>' +
            '<button type="button" class="btn ghost sm sc-t-down" data-i="' +
            i +
            '">↓</button>' +
            '<button type="button" class="btn ghost sm sc-t-dup" data-i="' +
            i +
            '">Duplicate</button>' +
            '<button type="button" class="btn ghost sm sc-t-del" data-i="' +
            i +
            '">Delete</button>' +
            '<label class="ck" style="display:flex;gap:6px;align-items:center;font-weight:600;margin-left:auto"><input type="radio" name="sc-default-tab" class="sc-t-def" data-i="' +
            i +
            '"' +
            (ensure(c).defaultTabId === t.id ? ' checked' : '') +
            '> Default tab</label>' +
            '</div></div></details>'
          );
        })
        .join('');
    }

    drawTabs();

    var host = $('sc-tabs-host');
    if (host) {
      host.addEventListener('input', function (e) {
        var t = e.target;
        var i = +t.getAttribute('data-i');
        if (isNaN(i) || !ensure(c).tabs[i]) return;
        var tab = ensure(c).tabs[i];
        if (t.classList.contains('sc-t-label')) tab.label = t.value;
        else if (t.classList.contains('sc-t-heading')) tab.heading = t.value;
        else if (t.classList.contains('sc-t-intro')) tab.intro = t.value;
        else if (t.classList.contains('sc-t-content')) tab.content = t.value;
        else if (t.classList.contains('sc-t-bullets')) {
          tab.bullets = String(t.value || '')
            .split('\n')
            .map(function (x) { return x.trim(); })
            .filter(Boolean)
            .slice(0, 8);
        } else if (t.classList.contains('sc-t-image')) {
          tab.image = tab.image || {};
          tab.image.url = t.value.trim() || null;
        } else if (t.classList.contains('sc-t-alt')) {
          tab.image = tab.image || {};
          tab.image.alt = t.value;
        } else if (t.classList.contains('sc-t-link')) {
          tab.link = tab.link || { label: '', destination: null };
          tab.link.label = t.value;
        } else if (t.classList.contains('sc-t-href')) {
          tab.link = tab.link || { label: '', destination: null };
          var v = t.value.trim();
          tab.link.destination = v ? { type: v[0] === '#' ? 'section' : 'url', value: v } : null;
        }
        save();
      });
      host.addEventListener('change', function (e) {
        var t = e.target;
        var i = +t.getAttribute('data-i');
        if (t.classList.contains('sc-t-icon') && ensure(c).tabs[i]) {
          ensure(c).tabs[i].iconKey = t.value || null;
          save();
        }
        if (t.classList.contains('sc-t-def') && ensure(c).tabs[i]) {
          ensure(c).defaultTabId = ensure(c).tabs[i].id;
          save();
        }
      });
      host.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('button') : null;
        if (!btn) return;
        var i = +btn.getAttribute('data-i');
        var tabs = ensure(c).tabs;
        if (btn.classList.contains('sc-t-up') && i > 0) {
          tabs.splice(i - 1, 0, tabs.splice(i, 1)[0]);
          save();
          drawTabs();
        } else if (btn.classList.contains('sc-t-down') && i < tabs.length - 1) {
          tabs.splice(i + 1, 0, tabs.splice(i, 1)[0]);
          save();
          drawTabs();
        } else if (btn.classList.contains('sc-t-dup') && tabs[i]) {
          var copy = deepClone(tabs[i]);
          copy.id = 'tab-' + Math.random().toString(36).slice(2, 9);
          tabs.splice(i + 1, 0, copy);
          save();
          drawTabs();
        } else if (btn.classList.contains('sc-t-del')) {
          if (tabs.length <= 1) {
            if (window.toast) window.toast('Keep at least one tab');
            return;
          }
          tabs.splice(i, 1);
          save();
          drawTabs();
        }
      });
    }

    var addBtn = $('sc-add-tab');
    if (addBtn) {
      addBtn.onclick = function () {
        ensure(c).tabs.push(newTab());
        save();
        drawTabs();
      };
    }

    var aiBtn = $('sc-ai-go');
    if (aiBtn) {
      aiBtn.onclick = async function () {
        var note = $('sc-ai-note');
        var kw = (($('sc-ai-kw') && $('sc-ai-kw').value) || '').trim();
        if (!kw) {
          if (note) note.textContent = 'Primary keyword is required.';
          return;
        }
        if (!window._siCallSearchCanvasDraft && !window.lpCallSearchCanvasDraft) {
          if (note) note.textContent = 'AI helper not ready — reload manage and try again.';
          return;
        }
        aiBtn.disabled = true;
        if (note) note.textContent = 'Generating with OpenAI via LeadPages Brain (content.search_canvas_draft)…';
        try {
          var call = window.lpCallSearchCanvasDraft || window._siCallSearchCanvasDraft;
          var raw = await call({
            primaryKeyword: kw,
            location: (($('sc-ai-loc') && $('sc-ai-loc').value) || '').trim(),
            extraInfo: (($('sc-ai-extra') && $('sc-ai-extra').value) || '').trim(),
            tabCount: +(($('sc-ai-tabs') && $('sc-ai-tabs').value) || 5),
            includeFaq: !!( $('sc-ai-faq') && $('sc-ai-faq').checked )
          });
          var draft = unwrapDraft(raw);
          if (!draft || !Array.isArray(draft.tabs) || !draft.tabs.length) {
            throw new Error('Brain returned no SearchCanvas tabs. Check AI Control Centre route content.search_canvas_draft and Vercel BRAIN_SEARCH_CANVAS=1.');
          }
          var mode = ($('sc-ai-mode') && $('sc-ai-mode').value) || 'replace';
          var applied = null;
          if (typeof window.lpApplySearchCanvasDraft === 'function') {
            applied = await window.lpApplySearchCanvasDraft(draft, {
              mode: 'replace',
              forceUpdate: true,
              forcePosition: false,
              replaceTabs: true,
              config: c,
              includeFaq: !!( $('sc-ai-faq') && $('sc-ai-faq').checked ),
              source: 'app-editor'
            });
          } else {
            // Local fallback merge if host helper missing — always replace tab list with AI services
            var S2 = ensure(c);
            S2.header = S2.header || {};
            if (draft.eyebrow) S2.header.eyebrow = draft.eyebrow;
            if (draft.heading) S2.header.heading = draft.heading;
            if (draft.intro) S2.header.intro = draft.intro;
            S2.tabs = draft.tabs.map(function (t) {
              return {
                id: 'tab-' + Math.random().toString(36).slice(2, 9),
                label: String(t.label || t.heading || 'Service').trim(),
                iconKey: t.iconSuggestion || t.iconKey || 'check',
                heading: String(t.heading || t.label || '').trim(),
                intro: String(t.intro || '').trim(),
                content: Array.isArray(t.supportingParagraphs) ? t.supportingParagraphs.join('\n\n') : String(t.content || ''),
                bullets: Array.isArray(t.bullets) ? t.bullets.map(String).filter(Boolean).slice(0, 5) : [],
                image: { url: null, publicId: null, alt: String(t.imageAltText || '').trim(), fit: 'cover', objectPosition: 'center' },
                link: { label: String(t.linkLabel || '').trim(), destination: null },
                button: { enabled: false, label: '', destination: null },
                on: true
              };
            });
            S2.defaultTabId = S2.tabs[0] && S2.tabs[0].id;
            S2.on = true;
            if (!S2.layout) S2.layout = {};
            S2.layout.contentWidth = S2.layout.contentWidth || 'wide';
            S2.ai = Object.assign({}, S2.ai || {}, { primaryKeyword: kw, generatedAt: new Date().toISOString(), source: 'app-editor' });
            applied = { tabs: S2.tabs.length };
            save();
          }
          if (!applied || !(applied.tabs > 0 || (c.sections.searchCanvas && c.sections.searchCanvas.tabs && c.sections.searchCanvas.tabs.length))) {
            throw new Error('Draft did not apply into SearchCanvas tabs.');
          }
          if (note) {
            note.textContent = 'Draft applied (' + (applied.tabs || c.sections.searchCanvas.tabs.length) + ' tabs) — review before publishing.';
          }
          if (window.toast) window.toast('SearchCanvas updated');
          window.lpRenderSearchCanvasEditor(c, body, helpers);
          if (typeof window.previewApply === 'function') window.previewApply();
        } catch (err) {
          if (note) note.textContent = String((err && err.message) || err);
          if (window.toast) window.toast('SearchCanvas AI failed');
        } finally {
          aiBtn.disabled = false;
        }
      };
    }
  };
})();
