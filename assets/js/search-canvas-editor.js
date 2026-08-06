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

  function ensure(c) {
    if (!c.sections) c.sections = {};
    if (!c.sections.searchCanvas || typeof c.sections.searchCanvas !== 'object') {
      c.sections.searchCanvas = window.LP_SEARCH_CANVAS_DEFAULT
        ? deepClone(window.LP_SEARCH_CANVAS_DEFAULT)
        : { on: true, version: 1, header: { eyebrow: '', heading: '', intro: '', colours: {} }, tabs: [], style: {}, layout: {}, cta: {}, ai: {} };
    }
    var S = c.sections.searchCanvas;
    if (!S.header) S.header = { eyebrow: '', heading: '', intro: '', colours: {} };
    if (!S.header.colours) S.header.colours = {};
    if (!Array.isArray(S.tabs)) S.tabs = [];
    if (!S.style) S.style = {};
    if (!S.layout) S.layout = { preset: 'vertical-tabs-image-right', imageMode: 'per-tab', mobileMode: 'single-accordion', contentWidth: 'site' };
    if (!S.cta) S.cta = { enabled: false, style: 'strip' };
    if (!S.ai) S.ai = {};
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

  function wireColor(prefix, getSet) {
    var $ = window.$;
    var tx = $(prefix);
    var clr = $(prefix + '-clr');
    var def = $(prefix + '-def');
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
    var $ = window.$;
    var esc = window.esc || function (s) { return String(s == null ? '' : s); };
    var S = ensure(c);
    S.on = S.on === true || S.on !== false ? !!S.on : false;
    if (S.on !== true && helpers && helpers.forceOn) S.on = true;

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
        ['site', 'Site width'],
        ['narrow', 'Narrow'],
        ['wide', 'Wide']
      ]
        .map(function (o) {
          return '<option value="' + o[0] + '"' + ((S.layout.contentWidth || 'site') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        })
        .join('') +
      '</select></div></div></div>' +
      '<div class="card" style="margin-bottom:18px"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">' +
      '<div><h2 style="margin:0 0 4px">SearchCanvas tabs</h2><p class="lede" style="margin:0">Recommended 4–6. Warning after 8.</p></div>' +
      '<button type="button" class="btn sm" id="sc-add-tab">+ Add tab</button></div>' +
      '<div id="sc-tabs-host" style="margin-top:12px"></div>' +
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
      '<p class="lede" style="margin:0 0 10px">Uses OpenAI as the preferred SearchCanvas engine via Brain. Primary keyword is required.</p>' +
      '<div class="row"><div class="f"><label for="sc-ai-kw">Primary keyword <span class="hint">required</span></label><input id="sc-ai-kw" class="tin" value="' +
      esc(S.ai.primaryKeyword || c.primaryKeyword || '') +
      '"></div>' +
      '<div class="f"><label for="sc-ai-loc">Location</label><input id="sc-ai-loc" class="tin" value="' +
      esc(S.ai.location || '') +
      '"></div></div>' +
      '<div class="f"><label for="sc-ai-extra">Extra information <span class="hint">optional</span></label><textarea id="sc-ai-extra" class="tin" rows="3" placeholder="Important business-specific facts for OpenAI to incorporate…"></textarea></div>' +
      '<div class="row"><div class="f"><label>Number of tabs</label><select id="sc-ai-tabs" class="tin"><option>4</option><option selected>5</option><option>6</option></select></div>' +
      '<div class="f"><label>Generation mode</label><select id="sc-ai-mode" class="tin"><option value="preserve" selected>Preserve edited fields</option><option value="fillEmpty">Fill empty fields only</option><option value="replace">Replace all generated text</option></select></div></div>' +
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
      if (!host) return;
      var tabs = ensure(c).tabs;
      if (warn) warn.style.display = tabs.length > 8 ? '' : 'none';
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
          if (note) note.textContent = 'AI helper not ready — open SEO Command or reload.';
          return;
        }
        aiBtn.disabled = true;
        if (note) note.textContent = 'Generating with OpenAI via LeadPages Brain…';
        try {
          var call = window.lpCallSearchCanvasDraft || window._siCallSearchCanvasDraft;
          var draft = await call({
            primaryKeyword: kw,
            location: (($('sc-ai-loc') && $('sc-ai-loc').value) || '').trim(),
            extraInfo: (($('sc-ai-extra') && $('sc-ai-extra').value) || '').trim(),
            tabCount: +(($('sc-ai-tabs') && $('sc-ai-tabs').value) || 5),
            includeFaq: !!( $('sc-ai-faq') && $('sc-ai-faq').checked )
          });
          if (window.lpApplySearchCanvasDraft) {
            await window.lpApplySearchCanvasDraft(draft, {
              mode: ($('sc-ai-mode') && $('sc-ai-mode').value) || 'preserve',
              includeFaq: !!( $('sc-ai-faq') && $('sc-ai-faq').checked ),
              source: 'app-editor'
            });
          }
          if (note) note.textContent = 'Draft applied — review tabs before publishing.';
          if (window.toast) window.toast('SearchCanvas updated');
          window.lpRenderSearchCanvasEditor(c, body, helpers);
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
