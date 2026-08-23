/**
 * SearchCanvas editor panel for manage.html (dark control-panel patterns).
 * Expects host page globals: $, esc, persist, previewApply, toast, wireSecColorPair (optional),
 * and LP_ICONS / icon picker helpers when available.
 */
(function () {
  'use strict';

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
    if (!S.style.bulletIconKey) S.style.bulletIconKey = 'check';
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
      bulletIconKey: null,
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

  function iconBtnInner(key) {
    if (typeof window.iconBtnInner === 'function') return window.iconBtnInner(key);
    if (key && window.LP_ICONS && window.LP_ICONS[key]) {
      return (
        '<svg class="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        window.LP_ICONS[key] +
        '</svg>'
      );
    }
    return '<span style="opacity:.35;">\uFF0B</span>';
  }

  function iconPickerHtml(inputClass, dataI, cur, clearable) {
    var v = cur || '';
    var extra = dataI != null ? ' data-i="' + dataI + '"' : '';
    return (
      '<div class="iconctl" style="display:flex;align-items:center;gap:8px;">' +
      '<button type="button" class="icon-pick" tabindex="-1" title="Choose an icon">' +
      iconBtnInner(v) +
      '</button>' +
      '<input type="hidden" class="icon-input ' +
      inputClass +
      '"' +
      extra +
      ' value="' +
      String(v).replace(/"/g, '&quot;') +
      '">' +
      (clearable
        ? '<button type="button" class="btn ghost sm sc-icon-clear" data-for="' +
          inputClass +
          '"' +
          extra +
          ' title="Use section default">Default</button>'
        : '') +
      '</div>'
    );
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
      if (typeof window.lpAutosave === 'function') window.lpAutosave();
    }
    if (tx) tx.addEventListener('input', function () { apply(tx.value); });
    if (clr) clr.addEventListener('input', function () { apply(clr.value); });
    if (def) def.addEventListener('click', function () { apply(''); });
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
      '<div class="f" style="margin-top:12px"><label>Bullet icon</label>' +
      '<p class="hint" style="margin:2px 0 8px;font-size:12px;">Stroke tick from the icon library (one bullet per line). Override per tab below if needed.</p>' +
      iconPickerHtml('sc-bullet-icon', null, S.style.bulletIconKey || 'check', false) +
      '</div></div>' +
      '<div class="card" style="margin-bottom:18px"><h2 style="margin:0 0 6px">Colours &amp; surfaces</h2>' +
      '<p class="lede" style="margin:0 0 10px">Customise the box, stroke, headings and body text. Leave blank for theme defaults.</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:12px">' +
      colorRow('sc-col-section', 'Section background', 'Behind the whole SearchCanvas block.') +
      colorRow('sc-col-panel', 'Box / panel background', 'Content card and tab panel fill.') +
      colorRow('sc-col-border', 'Stroke / border', 'Panel edges, dividers and tab rails.') +
      colorRow('sc-col-tab', 'Tab background', 'Inactive tab chips.') +
      colorRow('sc-col-tab-active', 'Active tab background', 'Selected tab chip.') +
      colorRow('sc-col-headings', 'Headings colour', 'Tab titles and panel headings.') +
      colorRow('sc-col-body', 'Body text colour', 'Main paragraph copy.') +
      colorRow('sc-col-muted', 'Muted text colour', 'Supporting / secondary text.') +
      '</div>' +
      '<div class="row" style="margin-top:12px"><div class="f"><label>Corner radius</label><select id="sc-radius" class="tin">' +
      [
        ['none', 'None'],
        ['small', 'Small'],
        ['medium', 'Medium'],
        ['large', 'Large']
      ]
        .map(function (o) {
          return '<option value="' + o[0] + '"' + ((S.style.radius || 'medium') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        })
        .join('') +
      '</select></div>' +
      '<div class="f"><label>Shadow</label><select id="sc-shadow" class="tin">' +
      [
        ['none', 'None'],
        ['soft', 'Soft'],
        ['medium', 'Medium']
      ]
        .map(function (o) {
          return '<option value="' + o[0] + '"' + ((S.style.shadow || 'soft') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        })
        .join('') +
      '</select></div></div></div>' +
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
      '<p class="hint" id="sc-tab-warn" style="display:none;color:var(--warning,#b45309)">You have more than 12 tabs — keep the set focused for visitors and SEO.</p></div>' +
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
      esc(S.cta.primaryLabel || 'Get a Free Quote') +
      '"></div>' +
      '<div class="f"><label>Button action</label><select id="sc-cta-action" class="tin">' +
      [
        ['quote', 'Quote form (#quote)'],
        ['call', 'Call phone'],
        ['custom', 'Custom URL / section']
      ]
        .map(function (o) {
          var curAct = S.cta.action || (/^tel:/i.test((S.cta.primaryDestination && S.cta.primaryDestination.value) || '') ? 'call' : 'quote');
          return '<option value="' + o[0] + '"' + (curAct === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        })
        .join('') +
      '</select></div></div>' +
      '<div class="f" id="sc-cta-custom-wrap"><label>Custom destination</label><input class="tin" id="sc-cta-href" placeholder="#quote, tel:… or https://…" value="' +
      esc((S.cta.primaryDestination && S.cta.primaryDestination.value) || '#quote') +
      '"></div>' +
      '<p class="hint" style="margin:6px 0 0">Quote form scrolls to the homepage form. Call uses the site phone. Clicks are tracked as <code>searchcanvas_cta_click</code>.</p>' +
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
      '<p class="lede" style="margin:0 0 10px">Creates <strong>service tabs</strong> from your keyword, site services, and anything you list below. Primary keyword required.</p>' +
      '<div class="row"><div class="f"><label for="sc-ai-kw">Primary keyword <span class="hint">required</span></label><input id="sc-ai-kw" class="tin" value="' +
      esc(S.ai.primaryKeyword || c.primaryKeyword || '') +
      '"></div>' +
      '<div class="f"><label for="sc-ai-loc">Location</label><input id="sc-ai-loc" class="tin" value="' +
      esc(S.ai.location || '') +
      '"></div></div>' +
      '<div class="f"><label for="sc-ai-must">Must-include services <span class="hint">one per line — each becomes a tab</span></label><textarea id="sc-ai-must" class="tin" rows="3" placeholder="Water Tanks&#10;Retaining Walls&#10;Garden Maintenance">' +
      esc((S.ai.mustIncludeServices || []).join('\n')) +
      '</textarea></div>' +
      '<div class="f"><label for="sc-ai-extra">Extra information for AI <span class="hint">paste category copy — AI creates one tab per section (Beef, Lamb, etc.)</span></label><textarea id="sc-ai-extra" class="tin" rows="6" placeholder="Beef&#10;&#10;Free-range grass-fed beef from whole carcass…&#10;&#10;Lamb&#10;&#10;Grass-fed lamb from…">' +
      esc(S.ai.extraInfo || '') +
      '</textarea></div>' +
      '<div class="row"><div class="f"><label>Number of tabs</label><select id="sc-ai-tabs" class="tin">' +
      [4, 5, 6, 7, 8, 9, 10, 11, 12]
        .map(function (n) {
          return '<option value="' + n + '"' + (n === 5 ? ' selected' : '') + '>' + n + '</option>';
        })
        .join('') +
      '</select></div>' +
      '<div class="f"><label>Generation mode</label><select id="sc-ai-mode" class="tin"><option value="replace" selected>Replace all tabs with AI services</option><option value="preserve">Preserve edited fields</option><option value="fillEmpty">Fill empty fields only</option></select></div></div>' +
      '<label class="ck" style="display:flex;gap:8px;align-items:center;font-weight:600;margin:0 0 6px"><input type="checkbox" id="sc-ai-faq"> Also update homepage FAQ (placed under SearchCanvas)</label>' +
      '<label class="ck" style="display:flex;gap:8px;align-items:center;font-weight:600;margin:0 0 10px;margin-left:22px"><input type="checkbox" id="sc-ai-faq-keep" checked> Keep existing FAQ items (append new questions)</label>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap"><button type="button" class="btn sm" id="sc-ai-go">Generate with AI</button><span class="hint" id="sc-ai-note"></span></div></div>';

    body.innerHTML = h;
    if (helpers && helpers.wireSec) helpers.wireSec(c, 'searchCanvas', true, []);

    function save() {
      if (typeof window.persist === 'function') window.persist();
      if (typeof window.previewApply === 'function') window.previewApply();
      if (typeof window.lpAutosave === 'function') window.lpAutosave();
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
    function styleColour(key) {
      return function (v) {
        if (arguments.length) ensure(c).style[key] = v;
        return ensure(c).style[key];
      };
    }
    wireColor('sc-col-section', styleColour('sectionBackground'));
    wireColor('sc-col-panel', styleColour('panelBackground'));
    wireColor('sc-col-border', styleColour('borderColour'));
    wireColor('sc-col-tab', styleColour('tabBackground'));
    wireColor('sc-col-tab-active', styleColour('activeTabBackground'));
    wireColor('sc-col-headings', styleColour('headingColour'));
    wireColor('sc-col-body', styleColour('bodyColour'));
    wireColor('sc-col-muted', styleColour('mutedColour'));
    var radiusEl = $('sc-radius');
    if (radiusEl) {
      radiusEl.addEventListener('change', function () {
        ensure(c).style.radius = radiusEl.value || 'medium';
        save();
      });
    }
    var shadowEl = $('sc-shadow');
    if (shadowEl) {
      shadowEl.addEventListener('change', function () {
        ensure(c).style.shadow = shadowEl.value || 'soft';
        save();
      });
    }

    var bulletIconInp = body.querySelector('.sc-bullet-icon');
    if (bulletIconInp) {
      bulletIconInp.addEventListener('input', function () {
        ensure(c).style.bulletIconKey = bulletIconInp.value || 'check';
        save();
      });
    }

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

    function sitePhone() {
      return String(c.phoneText || c.phone || c.tel || '').trim();
    }
    function applyCtaAction(action, customVal) {
      var S2 = ensure(c);
      S2.cta = S2.cta || {};
      S2.cta.action = action || 'quote';
      if (action === 'quote') {
        S2.cta.primaryDestination = { type: 'section', value: '#quote' };
        if (!S2.cta.primaryLabel) S2.cta.primaryLabel = 'Get a Free Quote';
      } else if (action === 'call') {
        var ph = sitePhone();
        S2.cta.primaryDestination = {
          type: 'phone',
          value: ph ? 'tel:' + ph.replace(/\s+/g, '') : 'tel:'
        };
        if (!S2.cta.primaryLabel || /quote/i.test(S2.cta.primaryLabel)) S2.cta.primaryLabel = 'Call Now';
      } else {
        var v = String(customVal != null ? customVal : (($('sc-cta-href') && $('sc-cta-href').value) || '')).trim();
        if (!v) v = '#quote';
        var type = v.indexOf('tel:') === 0 ? 'phone' : v[0] === '#' ? 'section' : 'url';
        S2.cta.primaryDestination = { type: type, value: v };
      }
      var wrap = $('sc-cta-custom-wrap');
      if (wrap) wrap.style.display = action === 'custom' ? '' : 'none';
      var href = $('sc-cta-href');
      if (href && action !== 'custom') {
        href.value = (S2.cta.primaryDestination && S2.cta.primaryDestination.value) || '';
      }
    }
    var ctaAction = $('sc-cta-action');
    if (ctaAction) {
      applyCtaAction(ctaAction.value);
      ctaAction.addEventListener('change', function () {
        applyCtaAction(ctaAction.value);
        save();
      });
    }
    bindText('sc-cta-href', function (v) {
      var act = ($('sc-cta-action') && $('sc-cta-action').value) || 'custom';
      if (act !== 'custom') {
        if ($('sc-cta-action')) $('sc-cta-action').value = 'custom';
        act = 'custom';
      }
      applyCtaAction(act, v);
    });
    var ctaOn = $('sc-cta-on');
    if (ctaOn) {
      ctaOn.addEventListener('change', function () {
        var S2 = ensure(c);
        S2.cta.enabled = !!ctaOn.checked;
        if (S2.cta.enabled) {
          if (!S2.cta.primaryLabel) S2.cta.primaryLabel = 'Get a Free Quote';
          if (!S2.cta.action) S2.cta.action = 'quote';
          if (!S2.cta.primaryDestination || !S2.cta.primaryDestination.value) {
            S2.cta.primaryDestination = { type: 'section', value: '#quote' };
          }
        }
        save();
      });
    }
    var ctaStyle = $('sc-cta-style');
    if (ctaStyle) ctaStyle.addEventListener('change', function () { ensure(c).cta.style = ctaStyle.value; save(); });

    function drawTabs() {
      var host = $('sc-tabs-host');
      var warn = $('sc-tab-warn');
      var empty = $('sc-tab-empty');
      if (!host) return;
      var tabs = ensure(c).tabs;
      if (warn && warn.style) warn.style.display = tabs.length > 12 ? '' : 'none';
      if (empty && empty.style) empty.style.display = tabs.length ? 'none' : '';
      if (!tabs.length) {
        host.innerHTML = '';
        return;
      }
      host.innerHTML = tabs
        .map(function (t, i) {
          var bullets = (t.bullets || []).join('\n');
          return (
            '<details class="sc-tab-ed" draggable="true" data-i="' +
            i +
            '" style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:0 0 10px;background:#fff"' +
            (i === 0 ? ' open' : '') +
            '>' +
            '<summary style="cursor:pointer;font-weight:700;display:flex;align-items:center;gap:8px;list-style:none">' +
            '<span class="sc-tab-grip" title="Drag to reorder" aria-hidden="true" style="cursor:grab;user-select:none;opacity:.55;padding:0 4px;font-size:14px;letter-spacing:-1px;flex:0 0 auto;">\u22ee\u22ee</span>' +
            '<span style="flex:1;min-width:0">Tab ' +
            (i + 1) +
            ': ' +
            esc(t.label || 'Untitled') +
            '</span>' +
            '<span class="sc-tab-sort" style="display:inline-flex;gap:4px;flex:0 0 auto">' +
            '<button type="button" class="btn ghost sm sc-t-up" data-i="' +
            i +
            '" title="Move up" aria-label="Move tab up">↑</button>' +
            '<button type="button" class="btn ghost sm sc-t-down" data-i="' +
            i +
            '" title="Move down" aria-label="Move tab down">↓</button>' +
            '</span></summary>' +
            '<div style="margin-top:10px;display:grid;gap:8px">' +
            '<div class="row"><div class="f" style="flex:1 1 auto"><label>Tab label</label><input class="tin sc-t-label" data-i="' +
            i +
            '" value="' +
            esc(t.label || '') +
            '"></div>' +
            '<div class="f" style="flex:0 0 auto"><label>Icon</label>' +
            iconPickerHtml('sc-t-icon', i, t.iconKey || '', false) +
            '</div></div>' +
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
            '<div class="f"><label>Supporting heading <span class="hint">bold, like the tab heading</span></label><textarea class="tin sc-t-content" data-i="' +
            i +
            '" rows="2">' +
            esc(t.content || '') +
            '</textarea></div>' +
            '<div class="f"><label>Bullet points <span class="hint">one per line</span></label><textarea class="tin sc-t-bullets" data-i="' +
            i +
            '" rows="4">' +
            esc(bullets) +
            '</textarea></div>' +
            '<div class="f"><label>Bullet icon override <span class="hint">optional — blank uses section default</span></label>' +
            iconPickerHtml('sc-t-bullet-icon', i, t.bulletIconKey || '', true) +
            '</div>' +
            '<div class="f" style="flex:1 1 100%"><label>Tab image (Cloudinary)</label>' +
            (typeof window.cwImgHTML === 'function'
              ? window.cwImgHTML('class="tin sc-t-image" data-i="' + i + '"', 'Upload or paste Cloudinary URL', 'Shown beside this service tab')
              : '<input class="tin sc-t-image" data-i="' + i + '" value="' + esc((t.image && t.image.url) || '') + '">') +
            '<input type="hidden" class="sc-t-pid" data-i="' + i + '" value="' + esc((t.image && t.image.publicId) || '') + '">' +
            '</div>' +
            '<div class="f"><label>Image alt</label><input class="tin sc-t-alt" data-i="' +
            i +
            '" value="' +
            esc((t.image && t.image.alt) || '') +
            '"></div>' +
            '<div class="row"><div class="f"><label>Image fit</label><select class="tin sc-t-fit" data-i="' +
            i +
            '">' +
            [
              ['cover', 'Cover (fill frame, crop)'],
              ['contain', 'Contain (fit inside)'],
              ['fill', 'Stretch (fill frame)'],
              ['none', 'None (natural size)'],
              ['scale-down', 'Scale down']
            ]
              .map(function (o) {
                var cur = String(((t.image && t.image.fit) || 'cover')).toLowerCase();
                if (cur === 'stretch') cur = 'fill';
                return '<option value="' + o[0] + '"' + (cur === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
              })
              .join('') +
            '</select></div>' +
            '<div class="f"><label>Image position</label><select class="tin sc-t-pos" data-i="' +
            i +
            '">' +
            [
              ['center', 'Centre'],
              ['top', 'Top'],
              ['bottom', 'Bottom'],
              ['left', 'Left'],
              ['right', 'Right'],
              ['top left', 'Top left'],
              ['top right', 'Top right'],
              ['bottom left', 'Bottom left'],
              ['bottom right', 'Bottom right']
            ]
              .map(function (o) {
                var cur = String(((t.image && t.image.objectPosition) || 'center')).toLowerCase();
                return '<option value="' + o[0] + '"' + (cur === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
              })
              .join('') +
            '</select></div></div>' +
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
      // Populate Cloudinary image fields after HTML insert
      tabs.forEach(function (t, i) {
        var imgEl = host.querySelector('.sc-t-image[data-i="' + i + '"]');
        var pidEl = host.querySelector('.sc-t-pid[data-i="' + i + '"]');
        if (imgEl) imgEl.value = (t.image && t.image.url) || '';
        if (pidEl) pidEl.value = (t.image && t.image.publicId) || '';
      });
      if (typeof window.refreshIconBtns === 'function') {
        try { window.refreshIconBtns(host); } catch (_) {}
      }
    }

    drawTabs();

    var host = $('sc-tabs-host');
    if (host) {
      host.addEventListener('input', function (e) {
        var t = e.target;
        if (t.classList.contains('sc-bullet-icon')) return;
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
        } else if (t.classList.contains('sc-t-icon')) {
          tab.iconKey = t.value || null;
        } else if (t.classList.contains('sc-t-bullet-icon')) {
          tab.bulletIconKey = t.value || null;
        } else if (t.classList.contains('sc-t-image')) {
          tab.image = tab.image || {};
          tab.image.url = t.value.trim() || null;
        } else if (t.classList.contains('sc-t-alt')) {
          tab.image = tab.image || {};
          tab.image.alt = t.value;
        } else if (t.classList.contains('sc-t-fit')) {
          tab.image = tab.image || {};
          tab.image.fit = t.value || 'cover';
        } else if (t.classList.contains('sc-t-pos')) {
          tab.image = tab.image || {};
          tab.image.objectPosition = t.value || 'center';
        } else if (t.classList.contains('sc-t-link')) {
          tab.link = tab.link || { label: '', destination: null };
          tab.link.label = t.value;
        } else if (t.classList.contains('sc-t-href')) {
          tab.link = tab.link || { label: '', destination: null };
          var v = t.value.trim();
          tab.link.destination = v ? { type: v[0] === '#' ? 'section' : 'url', value: v } : null;
        } else {
          return;
        }
        save();
      });
      host.addEventListener('change', function (e) {
        var t = e.target;
        var i = +t.getAttribute('data-i');
        if (t.classList.contains('sc-t-def') && ensure(c).tabs[i]) {
          ensure(c).defaultTabId = ensure(c).tabs[i].id;
          save();
        } else if ((t.classList.contains('sc-t-fit') || t.classList.contains('sc-t-pos')) && ensure(c).tabs[i]) {
          var tab = ensure(c).tabs[i];
          tab.image = tab.image || {};
          if (t.classList.contains('sc-t-fit')) tab.image.fit = t.value || 'cover';
          if (t.classList.contains('sc-t-pos')) tab.image.objectPosition = t.value || 'center';
          save();
        }
      });
      var dragIdx = null;
      host.addEventListener('dragstart', function (e) {
        var row = e.target.closest && e.target.closest('.sc-tab-ed');
        if (!row || !e.target.closest('.sc-tab-grip') || e.target.closest('input,textarea,select,button,a,label')) {
          e.preventDefault();
          return;
        }
        dragIdx = +row.getAttribute('data-i');
        try {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(dragIdx));
        } catch (_e) {}
        row.classList.add('sc-dragging');
      });
      host.addEventListener('dragend', function () {
        dragIdx = null;
        host.querySelectorAll('.sc-tab-ed').forEach(function (r) {
          r.classList.remove('sc-dragging', 'sc-drop-before', 'sc-drop-after');
        });
      });
      host.addEventListener('dragover', function (e) {
        e.preventDefault();
        var row = e.target.closest && e.target.closest('.sc-tab-ed');
        if (!row) return;
        var rc = row.getBoundingClientRect();
        var after = e.clientY - rc.top > rc.height / 2;
        host.querySelectorAll('.sc-tab-ed').forEach(function (r) {
          r.classList.remove('sc-drop-before', 'sc-drop-after');
        });
        row.classList.add(after ? 'sc-drop-after' : 'sc-drop-before');
      });
      host.addEventListener('drop', function (e) {
        e.preventDefault();
        var row = e.target.closest && e.target.closest('.sc-tab-ed');
        if (!row || dragIdx == null) return;
        var to = +row.getAttribute('data-i');
        var rc = row.getBoundingClientRect();
        var after = e.clientY - rc.top > rc.height / 2;
        if (after) to += 1;
        var from = dragIdx;
        if (to > from) to -= 1;
        var tabs = ensure(c).tabs;
        if (from === to || from < 0 || to < 0 || from >= tabs.length || to > tabs.length) return;
        tabs.splice(to, 0, tabs.splice(from, 1)[0]);
        save();
        drawTabs();
      });
      host.addEventListener('click', function (e) {
        var clearBtn = e.target.closest ? e.target.closest('.sc-icon-clear') : null;
        if (clearBtn) {
          e.preventDefault();
          e.stopPropagation();
          var ci = +clearBtn.getAttribute('data-i');
          var forCls = clearBtn.getAttribute('data-for') || '';
          if (!isNaN(ci) && ensure(c).tabs[ci] && forCls.indexOf('sc-t-bullet-icon') >= 0) {
            ensure(c).tabs[ci].bulletIconKey = null;
            var ctl = clearBtn.closest('.iconctl');
            var inp = ctl && ctl.querySelector('.icon-input');
            var pick = ctl && ctl.querySelector('.icon-pick');
            if (inp) inp.value = '';
            if (pick) pick.innerHTML = iconBtnInner('');
            save();
          }
          return;
        }
        var up = e.target.closest ? e.target.closest('.cw-up') : null;
        var clr = e.target.closest ? e.target.closest('.cw-clr') : null;
        if (up || clr) {
          var row = (up || clr).closest('.f') || (up || clr).parentNode;
          var imgInp = row && row.querySelector('.sc-t-image');
          var pidInp = row && row.querySelector('.sc-t-pid');
          var i = imgInp ? +imgInp.getAttribute('data-i') : NaN;
          if (isNaN(i) || !ensure(c).tabs[i]) return;
          var tab = ensure(c).tabs[i];
          tab.image = tab.image || {};
          if (clr) {
            var prevPid = tab.image.publicId || (pidInp && pidInp.value);
            if (prevPid && typeof window.cwDelete === 'function') window.cwDelete(prevPid);
            tab.image.url = null;
            tab.image.publicId = null;
            if (imgInp) imgInp.value = '';
            if (pidInp) pidInp.value = '';
            save();
            return;
          }
          if (up && typeof window.cwPick === 'function' && typeof window.cwUpload === 'function') {
            window.cwPick(function (file) {
              if (typeof window.cwBusy === 'function') window.cwBusy(up, true);
              window
                .cwUpload(file, ['searchCanvas', 'tab', String(tab.id || i)])
                .then(function (r) {
                  var oldPid = tab.image.publicId;
                  tab.image.url = r.url;
                  tab.image.publicId = r.publicId;
                  if (imgInp) imgInp.value = r.url;
                  if (pidInp) pidInp.value = r.publicId || '';
                  save();
                  if (oldPid && oldPid !== r.publicId && typeof window.cwDelete === 'function') {
                    window.cwDelete(oldPid);
                  }
                  if (window.toast) window.toast('Image uploaded');
                })
                .catch(function (err) {
                  if (window.toast) window.toast('Upload failed: ' + ((err && err.message) || err));
                })
                .then(function () {
                  if (typeof window.cwBusy === 'function') window.cwBusy(up, false);
                });
            });
          }
          return;
        }
        var btn = e.target.closest ? e.target.closest('button') : null;
        if (!btn || btn.classList.contains('cw-up') || btn.classList.contains('cw-clr') || btn.classList.contains('icon-pick')) return;
        var bi = +btn.getAttribute('data-i');
        var tabs = ensure(c).tabs;
        if (btn.classList.contains('sc-t-up') || btn.classList.contains('sc-t-down')) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (btn.classList.contains('sc-t-up') && bi > 0) {
          tabs.splice(bi - 1, 0, tabs.splice(bi, 1)[0]);
          save();
          drawTabs();
        } else if (btn.classList.contains('sc-t-down') && bi < tabs.length - 1) {
          tabs.splice(bi + 1, 0, tabs.splice(bi, 1)[0]);
          save();
          drawTabs();
        } else if (btn.classList.contains('sc-t-dup') && tabs[bi]) {
          if (tabs.length >= 12) {
            if (window.toast) window.toast('Maximum 12 tabs');
            return;
          }
          var copy = deepClone(tabs[bi]);
          copy.id = 'tab-' + Math.random().toString(36).slice(2, 9);
          tabs.splice(bi + 1, 0, copy);
          save();
          drawTabs();
        } else if (btn.classList.contains('sc-t-del')) {
          if (tabs.length <= 1) {
            if (window.toast) window.toast('Keep at least one tab');
            return;
          }
          tabs.splice(bi, 1);
          save();
          drawTabs();
        }
      });
    }

    var addBtn = $('sc-add-tab');
    if (addBtn) {
      addBtn.onclick = function () {
        if (ensure(c).tabs.length >= 12) {
          if (window.toast) window.toast('Maximum 12 tabs');
          return;
        }
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
        if (note) note.textContent = 'Generating service tabs with LeadPages Brain…';
        try {
          var mustRaw = (($('sc-ai-must') && $('sc-ai-must').value) || '').trim();
          var mustList = mustRaw
            ? mustRaw.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean)
            : [];
          var extra = (($('sc-ai-extra') && $('sc-ai-extra').value) || '').trim();
          ensure(c).ai.mustIncludeServices = mustList.slice();
          ensure(c).ai.extraInfo = extra;
          var call = window.lpCallSearchCanvasDraft || window._siCallSearchCanvasDraft;
          var raw = await call({
            primaryKeyword: kw,
            location: (($('sc-ai-loc') && $('sc-ai-loc').value) || '').trim(),
            extraInfo: extra,
            mustIncludeServices: mustList,
            tabCount: +(($('sc-ai-tabs') && $('sc-ai-tabs').value) || 5),
            includeFaq: !!( $('sc-ai-faq') && $('sc-ai-faq').checked ),
            includeCta: true
          });
          var draft = unwrapDraft(raw);
          if (!draft || !Array.isArray(draft.tabs) || !draft.tabs.length) {
            throw new Error('Brain returned no SearchCanvas tabs. Check AI Control Centre route content.search_canvas_draft.');
          }
          // Ensure must-include services appear even if the model skipped one
          mustList.forEach(function (svc) {
            var hit = draft.tabs.some(function (t) {
              return new RegExp(svc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(String((t && (t.label || t.heading)) || ''));
            });
            if (!hit) {
              draft.tabs.unshift({
                label: svc.split(/\s+/).slice(0, 4).join(' '),
                iconSuggestion: 'check',
                heading: svc,
                intro: 'We provide ' + svc.toLowerCase() + ' with clear communication and careful workmanship tailored to your property and budget.',
                bullets: ['Clear scope of work', 'Practical options', 'Quality materials', 'Local follow-through'],
                linkLabel: 'View ' + svc,
                imageSearchQuery: svc.toLowerCase(),
                imageAltText: svc
              });
            }
          });
          draft.tabs = draft.tabs.slice(0, 12);
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
            throw new Error('Apply helper missing — reload manage.');
          }
          if ($('sc-ai-faq') && $('sc-ai-faq').checked && draft.faqQuestions && draft.faqQuestions.length) {
            try {
              if (typeof window._siApplyFaqsToHomepageFaq === 'function') {
                var keepFaq = !($('sc-ai-faq-keep') && !$('sc-ai-faq-keep').checked);
                await window._siApplyFaqsToHomepageFaq(
                  draft.faqQuestions.map(function (f) {
                    return { q: f.question || f.q, a: f.answer || f.a };
                  }),
                  { mode: keepFaq ? 'merge' : 'replace' }
                );
              }
            } catch (_faq) {}
          }
          if (!applied || !(applied.tabs > 0 || (c.sections.searchCanvas && c.sections.searchCanvas.tabs && c.sections.searchCanvas.tabs.length))) {
            throw new Error('Draft did not apply into SearchCanvas tabs.');
          }
          // Default CTA to quote form after AI
          var S3 = ensure(c);
          if (!S3.cta) S3.cta = {};
          if (draft.cta) {
            S3.cta.enabled = true;
            if (draft.cta.heading) S3.cta.heading = draft.cta.heading;
            if (draft.cta.text) S3.cta.text = draft.cta.text;
            S3.cta.primaryLabel = draft.cta.buttonLabel || S3.cta.primaryLabel || 'Get a Free Quote';
          }
          S3.cta.action = S3.cta.action || 'quote';
          S3.cta.primaryDestination = S3.cta.primaryDestination || { type: 'section', value: '#quote' };
          if (!S3.cta.primaryDestination.value) S3.cta.primaryDestination = { type: 'section', value: '#quote' };
          save();
          if (note) {
            note.textContent = 'Draft applied (' + (applied.tabs || c.sections.searchCanvas.tabs.length) + ' service tabs) — preview updated.';
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
