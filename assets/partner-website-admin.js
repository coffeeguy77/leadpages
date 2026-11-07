/**
 * Partner Website profile editor — tabs, completion score, section saves.
 */
(function(global) {
  'use strict';

  var state = {
    authHeader: null,
    partnerId: null,
    websiteProfile: null,
    platform: null,
    completion: null,
    showcaseSites: [],
    industryTabDefaults: [],
    activeTab: 'overview',
    templates: [],
    dcDraft: {},
    library: { ready: false, loaded: false, items: [], max: 9 },
    libDraft: null,
    group: null,
    dirty: false,
    loading: false
  };

  var TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'design', label: 'Design text' },
    { id: 'positioning', label: 'Hero & pitch' },
    { id: 'biography', label: 'Biography' },
    { id: 'location', label: 'Service area' },
    { id: 'services', label: 'Services' },
    { id: 'showcase', label: 'LeadPages showcase' },
    { id: 'industryDemos', label: 'Industry demos' },
    { id: 'testimonials', label: 'Testimonials' },
    { id: 'caseStudies', label: 'Case studies' },
    { id: 'faqs', label: 'FAQs' },
    { id: 'contact', label: 'Contact' },
    { id: 'social', label: 'Social' },
    { id: 'seo', label: 'SEO' },
    { id: 'visibility', label: 'Sections' }
  ];

  // Which editor tabs show under each section of the partner website page (Nov 2026).
  var TAB_GROUPS = {
    design: ['design'],
    content: ['overview', 'positioning', 'biography', 'location', 'services', 'testimonials', 'caseStudies', 'faqs', 'visibility'],
    showcase: ['showcase', 'industryDemos'],
    contact: ['contact', 'social', 'seo']
  };

  function groupTabs() {
    var ids = state.group && TAB_GROUPS[state.group];
    return ids ? TABS.filter(function(t) { return ids.indexOf(t.id) >= 0; }) : TABS;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function $(id) { return document.getElementById(id); }

  function wp() { return state.websiteProfile || {}; }

  function field(label, id, value, opts) {
    opts = opts || {};
    var type = opts.type || 'text';
    var hint = opts.hint ? '<p class="muted" style="font-size:12px;margin:6px 0 0">' + esc(opts.hint) + '</p>' : '';
    if (type === 'textarea') {
      return '<div class="field"><label for="' + id + '">' + esc(label) + '</label>'
        + '<textarea id="' + id + '" rows="' + (opts.rows || 3) + '" placeholder="' + esc(opts.placeholder || '') + '">' + esc(value || '') + '</textarea>'
        + hint + '</div>';
    }
    if (type === 'checkbox') {
      return '<div class="field" style="margin:0">'
        + '<label style="display:inline-flex;align-items:center;gap:8px;font-weight:600;margin:0">'
        + '<input type="checkbox" id="' + id + '"' + (value ? ' checked' : '') + ' style="width:auto"> '
        + esc(label) + '</label>'
        + hint + '</div>';
    }
    return '<div class="field"><label for="' + id + '">' + esc(label) + '</label>'
      + '<input id="' + id + '" type="' + type + '" value="' + esc(value || '') + '" placeholder="' + esc(opts.placeholder || '') + '">'
      + hint + '</div>';
  }

  function completionHtml() {
    var c = state.completion || { overall: 0, groups: [], actions: [] };
    var groups = (c.groups || []).map(function(g) {
      return '<div class="pwp-score-item"><span class="pwp-score-label">' + esc(g.label) + '</span>'
        + '<div class="pwp-score-bar"><span style="width:' + g.percent + '%"></span></div>'
        + '<span class="pwp-score-pct">' + g.percent + '%</span></div>';
    }).join('');
    var actions = (c.actions || []).slice(0, 5).map(function(a) {
      return '<li>' + esc(a.label) + '</li>';
    }).join('');
    return '<div class="pwp-completion">'
      + '<div class="pwp-completion-head"><strong>Profile completion</strong><span class="pwp-completion-overall">' + c.overall + '%</span></div>'
      + '<div class="pwp-score-grid">' + groups + '</div>'
      + (actions ? '<ul class="pwp-actions muted">' + actions + '</ul>' : '')
      + '</div>';
  }

  function tabNav() {
    var list = groupTabs();
    return '<nav class="pwp-tabs' + (list.length < 2 ? ' pwp-tabs-single' : '') + '" role="tablist" aria-label="Website profile sections">'
      + list.map(function(t) {
        var on = t.id === state.activeTab ? ' is-active' : '';
        return '<button type="button" class="pwp-tab' + on + '" role="tab" data-pwp-tab="' + t.id + '" aria-selected="' + (on ? 'true' : 'false') + '">' + esc(t.label) + '</button>';
      }).join('')
      + '</nav>';
  }

  function headshotField() {
    var url = (wp().identity && wp().identity.headshotUrl) || '';
    var preview = url
      ? '<img id="pwp-headshot-img" src="' + esc(url) + '" alt="Profile photo preview">'
      : '<span class="pwp-headshot-ph" id="pwp-headshot-ph">No photo</span>';
    return '<div class="field"><label>Profile photo</label>'
      + '<div class="pwp-headshot-row">'
      + '<div id="pwp-headshot-preview" class="pwp-headshot-preview"' + (url ? '' : ' data-empty="1"') + '>' + preview + '</div>'
      + '<div class="pwp-headshot-actions">'
      + '<input type="file" id="pwp-headshot-file" accept="image/*" hidden>'
      + '<button type="button" class="btn" id="pwp-headshot-upload">Upload photo</button>'
      + '<button type="button" class="btn" id="pwp-headshot-clear"' + (url ? '' : ' hidden') + '>Remove</button>'
      + '<span id="pwp-headshot-msg" class="muted" style="font-size:13px"></span>'
      + '</div></div>'
      + '<input type="hidden" id="pwp-headshot" value="' + esc(url) + '">'
      + '<p class="muted" style="font-size:12px;margin:8px 0 0">Uploaded to your partner Cloudinary folder. Shown in your biography section.</p>'
      + '</div>';
  }

  function panelOverview() {
    var c = state.completion || {};
    return '<div class="pwp-panel" data-pwp-panel="overview">'
      + '<p class="muted" style="margin:0 0 16px;font-size:14px">Personalise your public partner page — biography, services, testimonials, and enquiry form. Every design uses this same content, so it follows you when you switch design.</p>'
      + completionHtml()
      + '<div class="pwp-overview-grid">'
      + field('Agency / trading name', 'pwp-agency', wp().identity && wp().identity.agencyName, { hint: 'Shown in hero, footer, and SEO.' })
      + headshotField()
      + '</div>'
      + '</div>';
  }

  /* ---------- LeadPages showcase: real LeadPages sites on the partner's page (Nov 2026) ---------- */
  var LIB_MODES = [
    { id: 'random', title: 'Random mix', text: 'A fresh mix on every visit.' },
    { id: 'all', title: 'Show all', text: 'Every showcase site, newest first. Updates itself.' },
    { id: 'selected', title: 'Hand-picked', text: 'Only the sites you tick below.' },
    { id: 'off', title: 'Off', text: 'Show only your own sites.' }
  ];

  function libCfg() {
    if (!state.libDraft) {
      var src = wp().showcaseLibrary || {};
      var d = {
        mode: src.mode || 'random',
        count: src.count || 3,
        autoAdd: src.autoAdd !== false,
        selected: (src.selected || []).slice(),
        seen: (src.seen || []).slice(),
        title: src.title || '',
        sub: src.sub || '',
        mix: src.mix || 'theirs-first',
        starred: (src.starred || []).slice(),
        scroll: src.scroll || 'site'
      };
      // Sites added since the last save: with auto-add on they are already showing, so they start ticked.
      if (d.mode === 'selected' && d.autoAdd) {
        (state.library.items || []).forEach(function(it) {
          if (d.seen.indexOf(it.id) < 0 && d.selected.indexOf(it.id) < 0) d.selected.push(it.id);
        });
      }
      state.libDraft = d;
    }
    return state.libDraft;
  }

  function ownShowcaseCount() {
    return (state.showcaseSites || []).filter(function(x) { return x.show_on_showcase; }).length;
  }

  function libSiteCard(it, cfg) {
    var isNew = (cfg.seen || []).indexOf(it.id) < 0 && (wp().showcaseLibrary || {}).seen && (wp().showcaseLibrary.seen || []).length;
    var on = cfg.selected.indexOf(it.id) >= 0;
    var pick = cfg.mode === 'selected';
    var mark = it.logo
      ? '<img src="' + esc(it.logo) + '" alt="" loading="lazy">'
      : '<b style="color:' + esc(it.color || 'var(--accent)') + '">' + esc(String(it.name || '?').charAt(0).toUpperCase()) + '</b>';
    return '<label class="pwp-lib-site' + (pick ? '' : ' is-info') + (pick && on ? ' is-on' : '') + '"' + (it.color ? ' style="--pwp-lib-c:' + esc(it.color) + '"' : '') + '>'
      + (pick ? '<input type="checkbox" data-pwp-lib-site="' + esc(it.id) + '"' + (on ? ' checked' : '') + '>' : '')
      + '<span class="pwp-lib-logo">' + mark + '</span>'
      + '<span class="pwp-lib-txt"><strong>' + esc(it.name) + '</strong><small>' + esc(it.industry || it.host || '') + '</small></span>'
      + (it.featured ? '<span class="pwp-lib-pick">LeadPages pick</span>' : '')
      + (isNew ? '<span class="pwp-lib-new">New</span>' : '')
      + '<button type="button" class="pwp-lib-star' + (cfg.starred.indexOf(it.id) >= 0 ? ' is-on' : '') + '" data-pwp-lib-star="' + esc(it.id) + '"'
      + ' aria-pressed="' + (cfg.starred.indexOf(it.id) >= 0 ? 'true' : 'false') + '" title="Favourite: shown first, and the only ones used in Random mix" aria-label="Favourite ' + esc(it.name) + '">'
      + '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg></button>'
      + '<a class="pwp-lib-view" href="' + esc(it.url) + '" target="_blank" rel="noopener" title="Open ' + esc(it.name) + '" aria-label="Open ' + esc(it.name) + '">'
      + '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg></a>'
      + '</label>';
  }

  function panelShowcase() {
    var lib = state.library || {};
    var cfg = libCfg();
    var items = lib.items || [];
    var own = ownShowcaseCount();
    var max = lib.max || 9;
    var html = '<div class="pwp-panel" data-pwp-panel="showcase">';
    html += '<div class="pwp-lib-hero">'
      + '<div><p class="pwp-lib-kicker">Built on LeadPages</p>'
      + '<h4>Real websites, working for real businesses</h4>'
      + '<p>Building your portfolio? Show live LeadPages sites on your page while you do. Your own client sites always come first'
      + (own ? ' &mdash; you have <strong>' + own + '</strong> on show.' : '.') + ' Up to ' + max + ' sites show in total.</p></div>'
      + '<div class="pwp-lib-count"><strong>' + items.length + '</strong><span>showcase site' + (items.length === 1 ? '' : 's') + ' available</span></div>'
      + '</div>';
    if (!lib.loaded) {
      html += '<p class="muted" style="font-size:13px">Loading showcase sites…</p></div>';
      return html;
    }
    html += '<div class="pwp-lib-modes" role="radiogroup" aria-label="What to show">'
      + LIB_MODES.map(function(m) {
        var on = cfg.mode === m.id;
        return '<button type="button" class="pwp-lib-mode' + (on ? ' is-on' : '') + '" role="radio" aria-checked="' + (on ? 'true' : 'false') + '" data-pwp-lib-mode="' + m.id + '">'
          + '<strong>' + esc(m.title) + '</strong><span>' + esc(m.text) + '</span></button>';
      }).join('')
      + '</div>';
    var MIX = [
      ['theirs-first', 'My sites first, then LeadPages'],
      ['ours-first', 'LeadPages first, then my sites'],
      ['theirs', 'Only my sites'],
      ['ours', 'Only LeadPages sites']
    ];
    var SCROLL = [['site', 'As set by LeadPages'], ['all', 'Every site'], ['off', 'Never']];
    html += '<div class="pwp-lib-row2">'
      + '<div class="field"><label for="pwp-lib-mix">Which sites</label><select id="pwp-lib-mix">'
      + MIX.map(function(m) { return '<option value="' + m[0] + '"' + (cfg.mix === m[0] ? ' selected' : '') + '>' + esc(m[1]) + '</option>'; }).join('')
      + '</select><p class="muted" style="font-size:12px;margin:6px 0 0">The Culture design keeps your own sites in its industry tabs.</p></div>'
      + '<div class="field"><label for="pwp-lib-scroll">Auto-scrolling previews</label><select id="pwp-lib-scroll">'
      + SCROLL.map(function(m) { return '<option value="' + m[0] + '"' + (cfg.scroll === m[0] ? ' selected' : '') + '>' + esc(m[1]) + '</option>'; }).join('')
      + '</select><p class="muted" style="font-size:12px;margin:6px 0 0">Scrolling previews slowly move down the live site to catch the eye.</p></div>'
      + '</div>';
    if (cfg.mode === 'random') {
      var opts = '';
      for (var n = 1; n <= max; n++) opts += '<option value="' + n + '"' + (n === Number(cfg.count) ? ' selected' : '') + '>' + n + '</option>';
      html += '<div class="field pwp-lib-inline"><label for="pwp-lib-count">How many to show</label><select id="pwp-lib-count">' + opts + '</select>'
        + '<span class="muted">sites, mixed up on every visit' + (cfg.starred.length ? ' &mdash; from your <strong>' + cfg.starred.length + '</strong> starred favourite' + (cfg.starred.length === 1 ? '' : 's') : ' &mdash; star favourites below to rotate only those') + '</span></div>';
    }
    if (cfg.mode === 'selected') {
      html += '<label class="pwp-lib-switch"><input type="checkbox" id="pwp-lib-auto"' + (cfg.autoAdd ? ' checked' : '') + '>'
        + '<span><strong>Add new showcase sites automatically</strong><small>When LeadPages adds a site, it appears on your page straight away. You can untick it here at any time. Turn this off to choose each new site yourself.</small></span></label>';
    }
    if (!lib.ready) {
      html += '<p class="notice" style="margin:14px 0 0">The LeadPages showcase isn&rsquo;t switched on yet. Your page shows your own sites until it is.</p>';
    } else if (!items.length) {
      html += '<p class="notice" style="margin:14px 0 0">No LeadPages showcase sites yet. As they&rsquo;re added they&rsquo;ll appear here.</p>';
    } else {
      html += '<div class="pwp-lib-head"><h4>' + (cfg.mode === 'selected' ? 'Tick the sites to show' : 'Sites in the showcase') + ' <span class="muted" style="font-weight:400;font-size:12.5px">&middot; &#9733; favourites show first</span></h4>'
        + (cfg.mode === 'selected' ? '<span class="muted" id="pwp-lib-picked">' + cfg.selected.filter(function(id) { return items.some(function(it) { return it.id === id; }); }).length + ' ticked</span>' : '')
        + '</div>'
        + '<div class="pwp-lib-sites">' + items.map(function(it) { return libSiteCard(it, cfg); }).join('') + '</div>';
    }
    html += '<details class="pwp-dc-group pwp-lib-words"><summary>Section heading</summary><div class="pwp-dc-fields">'
      + field('Heading', 'pwp-lib-title', cfg.title, { hint: 'Leave blank for “Real websites, live right now”.' })
      + field('Text under the heading', 'pwp-lib-sub', cfg.sub, { type: 'textarea', rows: 2, hint: 'Leave blank for the standard line.' })
      + '</div></details>';
    html += '</div>';
    return html;
  }

  function rerenderShowcasePanel() {
    var old = document.querySelector('[data-pwp-panel="showcase"]');
    if (!old) return;
    var t = val('pwp-lib-title'), sub = val('pwp-lib-sub');
    if (state.libDraft) { state.libDraft.title = t; state.libDraft.sub = sub; }
    var wrap = document.createElement('div');
    wrap.innerHTML = panelShowcase();
    var fresh = wrap.firstChild;
    var hidden = old.classList.contains('hidden');
    old.parentNode.replaceChild(fresh, old);
    fresh.classList.toggle('hidden', hidden);
  }

  function collectShowcase() {
    var cfg = libCfg();
    var out = {
      mode: cfg.mode,
      count: Number(cfg.count) || 3,
      autoAdd: !!cfg.autoAdd,
      selected: cfg.selected.slice(),
      // Everything listed now counts as seen, so only sites added after this save are "new".
      seen: state.library.loaded && state.library.ready
        ? (state.library.items || []).map(function(it) { return it.id; })
        : (cfg.seen || []).slice(),
      title: $('pwp-lib-title') ? val('pwp-lib-title') : cfg.title,
      sub: $('pwp-lib-sub') ? val('pwp-lib-sub') : cfg.sub,
      mix: cfg.mix,
      starred: cfg.starred.slice(),
      scroll: cfg.scroll
    };
    return out;
  }

  async function loadLibrary() {
    try {
      var r = await fetch('/api/partner/showcase-library', { headers: await state.authHeader() });
      var j = await r.json();
      if (j && j.ok) state.library = { ready: !!j.ready, loaded: true, items: j.items || [], max: j.max || 9 };
      else state.library = { ready: false, loaded: true, items: [], max: 9 };
    } catch (_e) {
      state.library = { ready: false, loaded: true, items: [], max: 9 };
    }
    state.libDraft = null;
    rerenderShowcasePanel();
  }

  function setGroup(group) {
    state.group = TAB_GROUPS[group] ? group : null;
    var root = $('pwp-editor');
    if (!root || !state.websiteProfile) return;
    var nav = root.querySelector('.pwp-tabs');
    if (nav) {
      var wrap = document.createElement('div');
      wrap.innerHTML = tabNav();
      nav.parentNode.replaceChild(wrap.firstChild, nav);
    }
    showTab(state.activeTab);
  }

  /* ---------- Design text: words and pictures of the Studio / Studio Plus / Presence designs ---------- */
  function currentTemplateId() {
    var sel = document.getElementById('sc-template');
    var v = sel && sel.value ? String(sel.value) : '';
    if (!v) {
      var pf = state.profile || {};
      v = (pf.showcase_config && pf.showcase_config.templateKey) || 'webculture';
    }
    return v;
  }
  function templateMeta(id) {
    var list = state.templates || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function designValue(tpl, key) {
    var d = state.dcDraft[tpl];
    if (d && Object.prototype.hasOwnProperty.call(d, key)) return d[key];
    var stored = (wp().designCopy && wp().designCopy[tpl]) || {};
    var shared = (wp().designCopy && wp().designCopy.shared) || {};
    return stored[key] || shared[key] || '';
  }
  function panelDesign() {
    var tpl = currentTemplateId();
    var meta = templateMeta(tpl);
    var slots = (meta && meta.slots) || [];
    var head = '<div class="pwp-panel" data-pwp-panel="design">';
    if (!slots.length) {
      return head + '<p class="muted" style="margin:0;font-size:14px">'
        + (meta ? esc(meta.label) : 'This design') + ' is written from the other tabs (Hero &amp; pitch, Services, FAQs and so on). '
        + 'Choose <strong>Studio</strong>, <strong>Studio Plus</strong> or <strong>Presence</strong> under <strong>Page template</strong> above to edit every heading, line and picture of that design here.</p></div>';
    }
    var groups = [];
    var byGroup = {};
    slots.forEach(function(sl) {
      var g = sl.group || 'Page';
      if (!byGroup[g]) { byGroup[g] = []; groups.push(g); }
      byGroup[g].push(sl);
    });
    var html = head
      + '<p class="muted" style="margin:0 0 6px;font-size:14px">Every word and picture of the <strong>' + esc(meta.label) + '</strong> design. '
      + 'Leave a box empty to keep the design\u2019s own wording (shown faintly). <code>{firstName}</code>, <code>{region}</code>, <code>{brand}</code> and <code>{state}</code> fill in from your profile.</p>'
      + '<p class="muted" style="margin:0 0 16px;font-size:12.5px">Words you change here are shared with your other designs that have the same box. Press Enter in a larger box for a new line. Save with <strong>Save changes</strong> at the bottom of the page.</p>';
    groups.forEach(function(g) {
      html += '<details class="pwp-dc-group"' + (g === 'Hero' || groups.length === 1 ? ' open' : '') + '><summary>' + esc(g) + '</summary><div class="pwp-dc-fields">';
      byGroup[g].forEach(function(sl) {
        var id = 'pwp-dc-' + sl.k.replace(/[^a-z0-9]+/gi, '-');
        var v = designValue(tpl, sl.k);
        var attrs = ' data-pwp-dc="' + esc(sl.k) + '" placeholder="' + esc(sl.def || '') + '"';
        if (sl.type === 'image') {
          var shown = v || sl.def || '';
          html += '<div class="field pwp-dc-img"><label for="' + id + '">' + esc(sl.label) + '</label>'
            + '<div class="pwp-dc-img-row">'
            + (shown ? '<img class="pwp-dc-thumb" src="' + esc(shown) + '" alt="" data-pwp-dc-thumb="' + esc(sl.k) + '">' : '<span class="pwp-dc-thumb" data-pwp-dc-thumb="' + esc(sl.k) + '"></span>')
            + '<div style="flex:1;min-width:0"><input id="' + id + '" type="url" value="' + esc(v) + '"' + attrs + '>'
            + '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center">'
            + '<button type="button" class="btn" data-pwp-dc-upload="' + esc(sl.k) + '" style="padding:6px 12px;font-size:13px">Upload picture</button>'
            + (v ? '<button type="button" class="btn" data-pwp-dc-clear="' + esc(sl.k) + '" style="padding:6px 12px;font-size:13px">Use design picture</button>' : '')
            + '<span class="muted" data-pwp-dc-msg="' + esc(sl.k) + '" style="font-size:12.5px"></span></div></div></div></div>';
        } else if (sl.type === 'area') {
          html += '<div class="field"><label for="' + id + '">' + esc(sl.label) + '</label><textarea id="' + id + '" rows="' + (String(sl.def || '').length > 140 ? 4 : 2) + '"' + attrs + '>' + esc(v) + '</textarea></div>';
        } else {
          html += '<div class="field"><label for="' + id + '">' + esc(sl.label) + '</label><input id="' + id + '" type="text" value="' + esc(v) + '"' + attrs + '></div>';
        }
      });
      html += '</div></details>';
    });
    html += '<input type="file" id="pwp-dc-file" accept="image/*" hidden></div>';
    return html;
  }
  function rerenderDesignPanel() {
    var old = document.querySelector('[data-pwp-panel="design"]');
    if (!old) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = panelDesign();
    var fresh = wrap.firstChild;
    if (state.activeTab !== 'design') fresh.classList.add('hidden');
    old.parentNode.replaceChild(fresh, old);
  }
  // Nov 2026: words are shared by every design with the same box (designCopy.shared), so
  // switching design keeps them. Saving a box here moves it into the shared set.
  function collectDesignCopy() {
    var dc = wp().designCopy || {};
    var out = {};
    var shared = Object.assign({}, dc.shared || {});
    var drafts = state.dcDraft || {};
    Object.keys(drafts).forEach(function(t) {
      var own = Object.assign({}, dc[t] || {});
      Object.keys(drafts[t]).forEach(function(k) {
        var v = String(drafts[t][k] || '');
        delete own[k];
        if (v.trim() !== '') shared[k] = drafts[t][k]; else delete shared[k];
      });
      out[t] = own;
    });
    out.shared = shared;
    return out;
  }

  function panelPositioning() {
    var p = wp().positioning || {};
    return '<div class="pwp-panel" data-pwp-panel="positioning">'
      + '<p class="muted" style="margin:0 0 16px">Hero copy for your partner page. Headline and intro above still work as fallbacks.</p>'
      + '<div class="row2">'
      + field('Eyebrow', 'pwp-hero-eyebrow', p.heroEyebrow, { placeholder: 'LeadPages partner' })
      + field('Highlight phrase', 'pwp-hero-highlight', p.heroHighlight, { placeholder: 'e.g. that get you booked' })
      + '</div>'
      + field('Hero headline', 'pwp-hero-headline', p.heroHeadline, { placeholder: 'Websites for Canberra trades' })
      + field('Supporting text', 'pwp-hero-supporting', p.heroSupporting, { type: 'textarea', rows: 4 })
      + '<div class="row2">'
      + field('Primary CTA', 'pwp-primary-cta', p.primaryCta, { placeholder: 'Plan my website' })
      + field('Secondary CTA', 'pwp-secondary-cta', p.secondaryCta, { placeholder: 'See live demos' })
      + '</div>'
      + field('Partner promise', 'pwp-partner-promise', p.partnerPromise, { type: 'textarea', rows: 2 })
      + field('Local credibility', 'pwp-local-cred', p.localCredibilityStatement, { type: 'textarea', rows: 2 })
      + field('Platform backing', 'pwp-platform-back', p.platformBackingStatement, { type: 'textarea', rows: 3 })
      + '</div>';
  }

  function panelBiography() {
    var b = wp().biography || {};
    var e = wp().experience || {};
    return '<div class="pwp-panel hidden" data-pwp-panel="biography">'
      + field('Short intro', 'pwp-short-intro', b.shortIntro, { type: 'textarea', rows: 2, hint: 'Shown in hero and about sections (max 240 chars).' })
      + field('Full biography', 'pwp-full-bio', b.fullBio, { type: 'textarea', rows: 6 })
      + '<div class="row2">'
      + field('Years experience', 'pwp-years-exp', b.yearsExperience)
      + field('Professional background', 'pwp-prof-bg', b.professionalBackground)
      + '</div>'
      + field('Why LeadPages partner', 'pwp-why-partner', b.whyPartner, { type: 'textarea', rows: 3 })
      + field('Working style', 'pwp-working-style', b.workingStyle, { type: 'textarea', rows: 3 })
      + field('Industries worked', 'pwp-industries-worked', b.industriesWorked)
      + '<div class="row2">'
      + field('Years in business', 'pwp-years-biz', e.yearsInBusiness)
      + field('Years in web', 'pwp-years-web', e.yearsInWeb)
      + '</div>'
      + field('Industry specialisations (comma-separated)', 'pwp-specs', (e.industrySpecialisations || []).join(', '))
      + '</div>';
  }

  function panelLocation() {
    var l = wp().location || {};
    var areas = (l.serviceAreas || []).map(function(a) { return a.label; }).join('\n');
    return '<div class="pwp-panel hidden" data-pwp-panel="location">'
      + field('Service region headline', 'pwp-region-headline', l.serviceRegionHeadline, { placeholder: 'Serving Canberra & surrounds' })
      + '<div class="row2">'
      + field('Primary suburb', 'pwp-suburb', l.primarySuburb)
      + field('State', 'pwp-state', l.state)
      + '</div>'
      + field('Service areas (one per line)', 'pwp-areas', areas, { type: 'textarea', rows: 5 })
      + '<div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:12px">'
      + field('Remote available', 'pwp-remote', l.remoteAvailable, { type: 'checkbox' })
      + field('In-person available', 'pwp-inperson', l.inPersonAvailable !== false, { type: 'checkbox' })
      + '</div>'
      + '</div>';
  }

  function panelServices() {
    var selections = {};
    (wp().serviceSelections || []).forEach(function(s) { selections[s.serviceKey] = s; });
    var rows = (state.platform && state.platform.services || []).map(function(def) {
      var sel = selections[def.key] || {};
      var enabled = sel.enabled !== undefined ? sel.enabled : (def.featured !== false);
      return '<div class="pwp-service-row">'
        + '<label class="pwp-service-check"><input type="checkbox" data-pwp-svc="' + esc(def.key) + '" data-pwp-svc-field="enabled"' + (enabled ? ' checked' : '') + '> <strong>' + esc(def.name) + '</strong></label>'
        + '<p class="muted" style="margin:4px 0 8px;font-size:12.5px">' + esc(def.description) + '</p>'
        + '<input type="text" data-pwp-svc="' + esc(def.key) + '" data-pwp-svc-field="personalNote" placeholder="Personal note (optional)" value="' + esc(sel.personalNote || '') + '" style="width:100%;margin-bottom:8px">'
        + '<label style="display:inline-flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" data-pwp-svc="' + esc(def.key) + '" data-pwp-svc-field="featured"' + (sel.featured ? ' checked' : '') + ' style="width:auto"> Feature on page</label>'
        + '</div>';
    }).join('');
    return '<div class="pwp-panel hidden" data-pwp-panel="services">'
      + '<p class="muted" style="margin:0 0 16px">Choose which platform services you offer. Add a personal note to stand out.</p>'
      + '<div class="pwp-service-list">' + rows + '</div>'
      + '</div>';
  }

  function testimonialRow(t, i) {
    t = t || {};
    return '<div class="pwp-repeat" data-pwp-testimonial="' + i + '">'
      + '<div class="row2">'
      + field('Customer name', 'pwp-t-name-' + i, t.customerName)
      + field('Business', 'pwp-t-biz-' + i, t.businessName)
      + '</div>'
      + '<div class="row2">'
      + field('Role', 'pwp-t-role-' + i, t.role)
      + field('Location', 'pwp-t-loc-' + i, t.location)
      + '</div>'
      + field('Testimonial', 'pwp-t-text-' + i, t.text, { type: 'textarea', rows: 3 })
      + field('Featured', 'pwp-t-feat-' + i, t.featured, { type: 'checkbox' })
      + '<button type="button" class="btn" data-pwp-remove-testimonial="' + i + '" style="margin-top:8px;padding:6px 12px;font-size:13px">Remove</button>'
      + '</div>';
  }

  function panelTestimonials() {
    var list = wp().testimonials || [];
    if (!list.length) list = [{}];
    return '<div class="pwp-panel hidden" data-pwp-panel="testimonials">'
      + '<p class="muted" style="margin:0 0 16px">Add client testimonials. They appear once saved — platform fallbacks show until you add your own.</p>'
      + '<div id="pwp-testimonials">' + list.map(testimonialRow).join('') + '</div>'
      + '<button type="button" class="btn" id="pwp-add-testimonial" style="margin-top:12px">Add testimonial</button>'
      + '</div>';
  }

  function caseStudyRow(c, i) {
    c = c || {};
    return '<div class="pwp-repeat" data-pwp-case="' + i + '">'
      + field('Client name', 'pwp-c-name-' + i, c.clientName)
      + '<div class="row2">'
      + field('Industry', 'pwp-c-ind-' + i, c.industry)
      + field('Website URL', 'pwp-c-url-' + i, c.websiteUrl)
      + '</div>'
      + field('Challenge', 'pwp-c-chal-' + i, c.challenge, { type: 'textarea', rows: 2 })
      + field('Solution', 'pwp-c-sol-' + i, c.solution, { type: 'textarea', rows: 2 })
      + field('Result', 'pwp-c-res-' + i, c.result, { type: 'textarea', rows: 2 })
      + field('Featured', 'pwp-c-feat-' + i, c.featured, { type: 'checkbox' })
      + '<button type="button" class="btn" data-pwp-remove-case="' + i + '" style="margin-top:8px;padding:6px 12px;font-size:13px">Remove</button>'
      + '</div>';
  }

  function panelCaseStudies() {
    var list = wp().caseStudies || [];
    if (!list.length) list = [{}];
    return '<div class="pwp-panel hidden" data-pwp-panel="caseStudies">'
      + '<p class="muted" style="margin:0 0 16px">Showcase projects you have delivered for local businesses.</p>'
      + '<div id="pwp-cases">' + list.map(caseStudyRow).join('') + '</div>'
      + '<button type="button" class="btn" id="pwp-add-case" style="margin-top:12px">Add case study</button>'
      + '</div>';
  }

  function faqRow(f, i) {
    f = f || {};
    return '<div class="pwp-repeat" data-pwp-faq="' + i + '">'
      + field('Question', 'pwp-f-q-' + i, f.question)
      + field('Answer', 'pwp-f-a-' + i, f.answer, { type: 'textarea', rows: 3 })
      + field('Enabled', 'pwp-f-on-' + i, f.enabled !== false, { type: 'checkbox' })
      + '<button type="button" class="btn" data-pwp-remove-faq="' + i + '" style="margin-top:8px;padding:6px 12px;font-size:13px">Remove</button>'
      + '</div>';
  }

  function panelFaqs() {
    var list = wp().partnerFaqs || [];
    return '<div class="pwp-panel hidden" data-pwp-panel="faqs">'
      + '<p class="muted" style="margin:0 0 16px">Your own FAQs appear above platform FAQs on your page.</p>'
      + '<div id="pwp-faqs">' + (list.length ? list.map(faqRow).join('') : faqRow({}, 0)) + '</div>'
      + '<button type="button" class="btn" id="pwp-add-faq" style="margin-top:12px">Add FAQ</button>'
      + '</div>';
  }

  function panelContact() {
    var c = wp().contact || {};
    var e = wp().enquiryForm || {};
    var l = wp().leadOffer || {};
    return '<div class="pwp-panel hidden" data-pwp-panel="contact">'
      + '<h4 style="font-size:15px;margin:0 0 12px">Contact preferences</h4>'
      + '<div class="row2">'
      + field('CTA label', 'pwp-cta-label', c.ctaLabel)
      + field('Response time', 'pwp-response', c.responseTime, { placeholder: 'Usually within 24 hours' })
      + '</div>'
      + field('Contact hours', 'pwp-hours', c.contactHours)
      + field('Booking URL', 'pwp-booking', c.bookingUrl, { placeholder: 'https://calendly.com/…' })
      + '<h4 style="font-size:15px;margin:24px 0 12px">Lead offer</h4>'
      + field('Enable free review offer', 'pwp-offer-on', l.enabled, { type: 'checkbox' })
      + field('Offer title', 'pwp-offer-title', l.title)
      + field('Offer description', 'pwp-offer-desc', l.description, { type: 'textarea', rows: 2 })
      + '<h4 style="font-size:15px;margin:24px 0 12px">Enquiry form</h4>'
      + field('Show extended consultation fields', 'pwp-extended', e.showExtended !== false, { type: 'checkbox' })
      + '</div>';
  }

  function panelSocial() {
    var s = wp().social || {};
    return '<div class="pwp-panel hidden" data-pwp-panel="social">'
      + field('Google Business', 'pwp-soc-gmb', s.googleBusiness)
      + field('LinkedIn', 'pwp-soc-li', s.linkedin)
      + field('Facebook', 'pwp-soc-fb', s.facebook)
      + field('Instagram', 'pwp-soc-ig', s.instagram)
      + '</div>';
  }

  function panelSeo() {
    var s = wp().seo || {};
    return '<div class="pwp-panel hidden" data-pwp-panel="seo">'
      + field('Page title override', 'pwp-seo-title', s.titleOverride, { hint: 'Leave blank to auto-generate from your agency name and region.' })
      + field('Meta description', 'pwp-seo-desc', s.descriptionOverride, { type: 'textarea', rows: 3 })
      + field('Social share image URL', 'pwp-seo-og', s.ogImage)
      + '</div>';
  }

  function siteOptionLabel(s) {
    var kind = s.is_mockup ? 'Demo' : 'Client';
    var trade = s.trade ? ' · ' + s.trade : '';
    return (s.business_name || s.slug) + ' (' + kind + trade + ')';
  }

  function siteSelectHtml(selectedId, index, opts) {
    opts = opts || {};
    var idPrefix = opts.idPrefix || 'pwp-ind-site-';
    var dataAttr = opts.dataAttr || 'data-pwp-ind-field="siteId"';
    var selOpts = '<option value="">— Choose a site or demo —</option>';
    (state.showcaseSites || []).forEach(function(s) {
      var sel = selectedId && String(selectedId) === String(s.id) ? ' selected' : '';
      selOpts += '<option value="' + esc(s.id) + '"' + sel + '>' + esc(siteOptionLabel(s)) + '</option>';
    });
    return '<select id="' + idPrefix + index + '" ' + dataAttr + '>' + selOpts + '</select>';
  }

  function industryTabRows() {
    var showcase = (wp().industryShowcase && wp().industryShowcase.tabs) || [];
    var defaults = state.industryTabDefaults || [];
    var rows = showcase.slice();
    if (!rows.length && defaults.length) {
      rows = defaults.map(function(t, i) {
        return { key: t.key, label: t.label, siteId: '', enabled: true, sortOrder: i };
      });
    }
    if (!rows.length) {
      rows = [{ key: 'trades', label: 'Trades', siteId: '', enabled: true, sortOrder: 0 }];
    }
    return rows.map(function(t, i) {
      return '<div class="pwp-ind-row" data-pwp-ind-tab="' + i + '">'
        + '<div class="pwp-ind-row-head">'
        + field('Tab name', 'pwp-ind-label-' + i, t.label || '', { placeholder: 'e.g. Trades' })
        + '<label class="pwp-ind-on"><input type="checkbox" id="pwp-ind-on-' + i + '"' + (t.enabled !== false ? ' checked' : '') + ' style="width:auto"> Show tab</label>'
        + '</div>'
        + '<div class="field"><label for="pwp-ind-site-' + i + '">Site or demo on this tab</label>'
        + siteSelectHtml(t.siteId || '', i)
        + '<p class="muted" style="font-size:12px;margin:6px 0 0">Pick any client site or demo from your book. This is what appears in “Choose an industry / Explore a real website.”</p>'
        + '</div>'
        + '<input type="hidden" id="pwp-ind-key-' + i + '" value="' + esc(t.key || '') + '">'
        + '<button type="button" class="btn" data-pwp-remove-ind="' + i + '" style="padding:6px 12px;font-size:13px">Remove tab</button>'
        + '</div>';
    }).join('');
  }

  function panelIndustryDemos() {
    var ind = wp().industryShowcase || {};
    var hero = wp().heroShowcase || {};
    var intervalSec = Math.round((ind.intervalMs || 12000) / 1000);
    var heroIntervalSec = Math.round((hero.intervalMs || 12000) / 1000);
    var speedChoices = [8, 12, 16, 20, 30];
    if (speedChoices.indexOf(intervalSec) < 0) intervalSec = 12;
    if (speedChoices.indexOf(heroIntervalSec) < 0) heroIntervalSec = 12;
    var heroIds = (hero.siteIds && hero.siteIds.length) ? hero.siteIds.slice() : (hero.siteId ? [hero.siteId] : ['']);
    if (!heroIds.length) heroIds = [''];
    var heroRows = heroIds.map(function(id, i) {
      return '<div class="pwp-hero-site-row" data-pwp-hero-site="' + i + '">'
        + '<div class="field" style="margin:0;flex:1"><label for="pwp-hero-site-' + i + '">'
        + (i === 0 ? 'Featured site (desktop + mobile)' : 'Also rotate')
        + '</label>'
        + siteSelectHtml(id || '', i, { idPrefix: 'pwp-hero-site-', dataAttr: 'data-pwp-hero-field="siteId"' })
        + '</div>'
        + (i > 0
          ? '<button type="button" class="btn" data-pwp-remove-hero="' + i + '" style="padding:6px 12px;font-size:13px;align-self:end">Remove</button>'
          : '')
        + '</div>';
    }).join('');

    return '<div class="pwp-panel hidden" data-pwp-panel="industryDemos">'
      + '<h4 style="font-size:15px;margin:0 0 8px">Hero demo (desktop + mobile)</h4>'
      + '<p class="muted" style="margin:0 0 14px;font-size:13px">Choose which client site or demo appears in the hero visual. Add more sites to rotate; tick hide tabs to keep the hero clean with no picker labels.</p>'
      + '<div id="pwp-hero-sites" class="pwp-hero-sites">' + heroRows + '</div>'
      + '<button type="button" class="btn" id="pwp-add-hero-site" style="margin:8px 0 12px">Add hero rotation site</button>'
      + '<div class="pwp-ind-options">'
      + field('Hide hero demo tabs', 'pwp-hero-hide-tabs', !!hero.hideTabs, { type: 'checkbox' })
      + '<div class="field"><label for="pwp-hero-speed">Hero slide speed</label>'
      + '<select id="pwp-hero-speed">'
      + [['8', '8 seconds'], ['12', '12 seconds (default)'], ['16', '16 seconds'], ['20', '20 seconds'], ['30', '30 seconds']].map(function(opt) {
        return '<option value="' + opt[0] + '"' + (String(heroIntervalSec) === opt[0] ? ' selected' : '') + '>' + opt[1] + '</option>';
      }).join('')
      + '</select></div>'
      + '</div>'

      + '<h4 style="font-size:15px;margin:28px 0 8px">Industry demos scroller</h4>'
      + '<p class="muted" style="margin:0 0 16px">Control “Choose an industry / Explore a real website.” Rename tabs (including Trades), pick which client site or demo each tab shows, or add your own industry tab.</p>'
      + '<div class="pwp-ind-options" style="margin-bottom:16px">'
      + field('Hide industry tabs', 'pwp-ind-hide-tabs', !!ind.hideTabs, {
        type: 'checkbox',
        hint: 'On by default the Trades / Hospitality labels show. Tick this to hide tab names — useful when previewing a finished site without industry chrome.'
      })
      + '<div class="field"><label for="pwp-ind-speed">Industry slide speed</label>'
      + '<select id="pwp-ind-speed">'
      + [['8', '8 seconds'], ['12', '12 seconds (default)'], ['16', '16 seconds'], ['20', '20 seconds'], ['30', '30 seconds']].map(function(opt) {
        return '<option value="' + opt[0] + '"' + (String(intervalSec) === opt[0] ? ' selected' : '') + '>' + opt[1] + '</option>';
      }).join('')
      + '</select>'
      + '<p class="muted" style="font-size:12px;margin:6px 0 0">How long each industry slide stays before advancing.</p></div>'
      + '</div>'
      + '<div id="pwp-ind-tabs">' + industryTabRows() + '</div>'
      + '<button type="button" class="btn" id="pwp-add-ind-tab" style="margin-top:12px">Add industry tab</button>'
      + '<p class="muted" style="margin:14px 0 0;font-size:12.5px">Leave industry tabs empty to fall back to automatic grouping of demos marked “Show on showcase” by trade.</p>'
      + '</div>';
  }

  function panelVisibility() {
    var v = wp().visibility || {};
    var keys = [
      ['hero', 'Hero'],
      ['platformBacking', 'Connected system'],
      ['demos', 'Live demos'],
      ['services', 'Services'],
      ['biography', 'About / partner'],
      ['process', 'Process'],
      ['testimonials', 'Testimonials'],
      ['faqs', 'FAQs'],
      ['contact', 'Contact form'],
      ['serviceArea', 'Service area'],
      ['leadOffer', 'Lead offer'],
      ['caseStudies', 'Case studies']
    ];
    var checks = keys.map(function(pair) {
      var on = v[pair[0]] !== false;
      return '<label class="pwp-vis-item"><input type="checkbox" id="pwp-vis-' + pair[0] + '"' + (on ? ' checked' : '') + ' style="width:auto"> ' + esc(pair[1]) + '</label>';
    }).join('');
    return '<div class="pwp-panel hidden" data-pwp-panel="visibility">'
      + '<p class="muted" style="margin:0 0 16px">Turn Culture page sections on or off. LeadPages branding in the hero trust strip and footer stays on — it cannot be removed.</p>'
      + '<div class="pwp-vis-grid">' + checks + '</div>'
      + '<p class="muted" style="margin:16px 0 0;font-size:12.5px">Always on: navigation, final CTA, sticky contact bar, and Powered by LeadPages.</p>'
      + '</div>';
  }

  function renderEditor() {
    var root = $('pwp-editor');
    if (!root) return;
    root.innerHTML = tabNav()
      + '<div class="pwp-panels">'
      + panelOverview()
      + panelDesign()
      + panelPositioning()
      + panelBiography()
      + panelLocation()
      + panelServices()
      + panelShowcase()
      + panelIndustryDemos()
      + panelTestimonials()
      + panelCaseStudies()
      + panelFaqs()
      + panelContact()
      + panelSocial()
      + panelSeo()
      + panelVisibility()
      + '</div>';
    // Nov 2026: one Save for the whole partner website page (#sc-save in partner.html).
    showTab(state.activeTab);
    wireEditor();
  }

  function showTab(id) {
    var allowed = groupTabs().map(function(t) { return t.id; });
    if (allowed.indexOf(id) < 0) id = allowed[0] || id;
    state.activeTab = id;
    document.querySelectorAll('.pwp-tab').forEach(function(btn) {
      var on = btn.getAttribute('data-pwp-tab') === id;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.pwp-panel').forEach(function(p) {
      var on = p.getAttribute('data-pwp-panel') === id;
      p.classList.toggle('hidden', !on);
    });
  }

  function val(id) {
    var el = $(id);
    if (!el) return '';
    if (el.type === 'checkbox') return el.checked;
    return (el.value || '').trim();
  }

  function partnerLogoUrl() {
    var prev = document.getElementById('sc-logo-prev');
    var wrap = document.getElementById('sc-logo-preview');
    if (!prev || !wrap || wrap.hidden) return '';
    var src = String(prev.getAttribute('src') || '').trim();
    if (!src || /^blob:/i.test(src)) return '';
    return src;
  }

  function collectProfile() {
    var areas = String(val('pwp-areas') || '').split(/\n/).map(function(s) { return s.trim(); }).filter(Boolean)
      .map(function(label) { return { label: label }; });
    var specs = String(val('pwp-specs') || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);

    var serviceSelections = [];
    document.querySelectorAll('[data-pwp-svc][data-pwp-svc-field="enabled"]').forEach(function(cb) {
      var key = cb.getAttribute('data-pwp-svc');
      var noteEl = document.querySelector('[data-pwp-svc="' + key + '"][data-pwp-svc-field="personalNote"]');
      var featEl = document.querySelector('[data-pwp-svc="' + key + '"][data-pwp-svc-field="featured"]');
      serviceSelections.push({
        serviceKey: key,
        enabled: cb.checked,
        personalNote: noteEl ? noteEl.value.trim() : '',
        featured: featEl ? featEl.checked : false
      });
    });

    var testimonials = [];
    document.querySelectorAll('[data-pwp-testimonial]').forEach(function(row) {
      var i = row.getAttribute('data-pwp-testimonial');
      var text = val('pwp-t-text-' + i);
      if (!text) return;
      testimonials.push({
        customerName: val('pwp-t-name-' + i),
        businessName: val('pwp-t-biz-' + i),
        role: val('pwp-t-role-' + i),
        location: val('pwp-t-loc-' + i),
        text: text,
        featured: val('pwp-t-feat-' + i),
        status: 'approved'
      });
    });

    var caseStudies = [];
    document.querySelectorAll('[data-pwp-case]').forEach(function(row) {
      var i = row.getAttribute('data-pwp-case');
      var name = val('pwp-c-name-' + i);
      if (!name) return;
      caseStudies.push({
        clientName: name,
        industry: val('pwp-c-ind-' + i),
        websiteUrl: val('pwp-c-url-' + i),
        challenge: val('pwp-c-chal-' + i),
        solution: val('pwp-c-sol-' + i),
        result: val('pwp-c-res-' + i),
        featured: val('pwp-c-feat-' + i),
        status: 'approved'
      });
    });

    var partnerFaqs = [];
    document.querySelectorAll('[data-pwp-faq]').forEach(function(row) {
      var i = row.getAttribute('data-pwp-faq');
      var q = val('pwp-f-q-' + i);
      var a = val('pwp-f-a-' + i);
      if (!q || !a) return;
      partnerFaqs.push({ question: q, answer: a, enabled: val('pwp-f-on-' + i) });
    });

    var industryTabs = [];
    document.querySelectorAll('[data-pwp-ind-tab]').forEach(function(row) {
      var i = row.getAttribute('data-pwp-ind-tab');
      var label = val('pwp-ind-label-' + i);
      var siteId = val('pwp-ind-site-' + i);
      var key = val('pwp-ind-key-' + i);
      if (!label && !siteId) return;
      if (!key && label) {
        key = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
      }
      industryTabs.push({
        key: key || ('tab-' + (industryTabs.length + 1)),
        label: label || key || 'Industry',
        siteId: siteId || null,
        enabled: val('pwp-ind-on-' + i),
        sortOrder: industryTabs.length
      });
    });

    var heroSiteIds = [];
    document.querySelectorAll('[data-pwp-hero-site]').forEach(function(row) {
      var i = row.getAttribute('data-pwp-hero-site');
      var siteId = val('pwp-hero-site-' + i);
      if (siteId) heroSiteIds.push(siteId);
    });
    var indInterval = parseInt(val('pwp-ind-speed') || '12', 10) || 12;
    var heroInterval = parseInt(val('pwp-hero-speed') || '12', 10) || 12;

    var visibility = {};
    ['hero', 'trust', 'demos', 'services', 'biography', 'serviceArea', 'testimonials', 'caseStudies', 'faqs', 'leadOffer', 'contact', 'process', 'platformBacking'].forEach(function(k) {
      var el = $('pwp-vis-' + k);
      visibility[k] = el ? !!el.checked : (wp().visibility && wp().visibility[k] !== false);
    });
    // Trust chip / Powered by LeadPages always on — not partner-removable.
    visibility.trust = true;

    return {
      identity: {
        agencyName: val('pwp-agency'),
        headshotUrl: val('pwp-headshot'),
        logoUrl: partnerLogoUrl() || undefined
      },
      positioning: {
        heroEyebrow: val('pwp-hero-eyebrow'),
        heroHeadline: val('pwp-hero-headline'),
        heroHighlight: val('pwp-hero-highlight'),
        heroSupporting: val('pwp-hero-supporting'),
        primaryCta: val('pwp-primary-cta'),
        secondaryCta: val('pwp-secondary-cta'),
        partnerPromise: val('pwp-partner-promise'),
        localCredibilityStatement: val('pwp-local-cred'),
        platformBackingStatement: val('pwp-platform-back')
      },
      biography: {
        shortIntro: val('pwp-short-intro'),
        fullBio: val('pwp-full-bio'),
        yearsExperience: val('pwp-years-exp'),
        professionalBackground: val('pwp-prof-bg'),
        whyPartner: val('pwp-why-partner'),
        workingStyle: val('pwp-working-style'),
        industriesWorked: val('pwp-industries-worked')
      },
      experience: {
        yearsInBusiness: val('pwp-years-biz'),
        yearsInWeb: val('pwp-years-web'),
        industrySpecialisations: specs
      },
      location: {
        serviceRegionHeadline: val('pwp-region-headline'),
        primarySuburb: val('pwp-suburb'),
        state: val('pwp-state'),
        serviceAreas: areas,
        remoteAvailable: val('pwp-remote'),
        inPersonAvailable: val('pwp-inperson')
      },
      contact: {
        ctaLabel: val('pwp-cta-label'),
        responseTime: val('pwp-response'),
        contactHours: val('pwp-hours'),
        bookingUrl: val('pwp-booking')
      },
      leadOffer: {
        enabled: val('pwp-offer-on'),
        title: val('pwp-offer-title'),
        description: val('pwp-offer-desc')
      },
      enquiryForm: {
        showExtended: val('pwp-extended')
      },
      social: {
        googleBusiness: val('pwp-soc-gmb'),
        linkedin: val('pwp-soc-li'),
        facebook: val('pwp-soc-fb'),
        instagram: val('pwp-soc-ig')
      },
      seo: {
        titleOverride: val('pwp-seo-title'),
        descriptionOverride: val('pwp-seo-desc'),
        ogImage: val('pwp-seo-og')
      },
      visibility: visibility,
      designCopy: collectDesignCopy(),
      showcaseLibrary: collectShowcase(),
      serviceSelections: serviceSelections,
      testimonials: testimonials,
      caseStudies: caseStudies,
      partnerFaqs: partnerFaqs,
      industryShowcase: {
        tabs: industryTabs,
        hideTabs: val('pwp-ind-hide-tabs'),
        intervalMs: indInterval * 1000
      },
      heroShowcase: {
        siteId: heroSiteIds[0] || null,
        siteIds: heroSiteIds,
        hideTabs: val('pwp-hero-hide-tabs'),
        intervalMs: heroInterval * 1000
      }
    };
  }

  function setHeadshotPreview(url) {
    var preview = $('pwp-headshot-preview');
    var hidden = $('pwp-headshot');
    var clearBtn = $('pwp-headshot-clear');
    if (hidden) hidden.value = url || '';
    if (!preview) return;
    if (url) {
      preview.removeAttribute('data-empty');
      preview.innerHTML = '<img id="pwp-headshot-img" src="' + esc(url) + '" alt="Profile photo preview">';
      if (clearBtn) clearBtn.hidden = false;
    } else {
      preview.setAttribute('data-empty', '1');
      preview.innerHTML = '<span class="pwp-headshot-ph" id="pwp-headshot-ph">No photo</span>';
      if (clearBtn) clearBtn.hidden = true;
    }
  }

  async function uploadHeadshot(file, opts) {
    opts = opts || {};
    if (!state.authHeader || !state.partnerId) throw new Error('Not signed in.');
    var headers = await state.authHeader();
    var token = headers.Authorization && headers.Authorization.replace(/^Bearer\s+/i, '');
    if (!token) throw new Error('Not signed in.');
    var folder = 'leadpages/partners/' + state.partnerId + '/' + (opts.folder || 'profile');
    var pid = folder + '/' + (opts.prefix || 'headshot') + '-' + Math.random().toString(36).slice(2, 10);
    var sr = await fetch('/api/cloudinary/sign', {
      method: 'POST',
      headers: Object.assign({ 'content-type': 'application/json' }, headers),
      body: JSON.stringify({ publicId: pid, assetFolder: folder })
    });
    var sg = await sr.json();
    if (!sr.ok || !sg.signature) throw new Error(sg.error || 'Could not sign upload');
    var fd = new FormData();
    fd.append('file', file);
    fd.append('api_key', sg.apiKey);
    fd.append('timestamp', sg.timestamp);
    fd.append('public_id', sg.publicId);
    if (sg.assetFolder) fd.append('asset_folder', sg.assetFolder);
    if (sg.overwrite) fd.append('overwrite', sg.overwrite);
    fd.append('signature', sg.signature);
    var ur = await fetch('https://api.cloudinary.com/v1_1/' + (sg.cloudName || 'dzx6x1hou') + '/image/upload', { method: 'POST', body: fd });
    var uj = await ur.json();
    if (!ur.ok || !uj.secure_url) throw new Error('Upload failed');
    return uj.secure_url;
  }

  function profileUrl(path) {
    var url = path || '/api/partner/website-profile';
    if (state.partnerId) {
      url += (url.indexOf('?') >= 0 ? '&' : '?') + 'partner_id=' + encodeURIComponent(state.partnerId);
    }
    return url;
  }

  async function saveProfile() {
    var err = $('pwp-err');
    var btn = $('pwp-save');
    if (!state.authHeader || state.loading) return;
    err.classList.add('hidden');
    btn.disabled = true;
    state.loading = true;
    if (global.LPBusy) {
      global.LPBusy.show({
        title: 'Saving page content',
        message: 'Updating your partner website…',
        detail: 'Please wait — do not close this tab.'
      });
    }
    try {
      var payload = { section: 'all', websiteProfile: collectProfile() };
      if (state.partnerId) payload.partner_id = state.partnerId;
      var r = await fetch(profileUrl('/api/partner/website-profile'), {
        method: 'POST',
        headers: Object.assign({ 'content-type': 'application/json' }, await state.authHeader()),
        body: JSON.stringify(payload)
      });
      var j = await r.json();
      if (!j.ok) {
        err.textContent = j.error || 'Could not save.';
        err.classList.remove('hidden');
        return;
      }
      state.websiteProfile = j.websiteProfile;
      state.completion = j.completion;
      if (j.profile) state.profile = j.profile;
      state.dcDraft = {};
      var sv = $('pwp-saved');
      if (sv) { sv.classList.add('show'); setTimeout(function() { sv.classList.remove('show'); }, 1700); }
      renderEditor();
    } catch (_e) {
      err.textContent = 'Network error — please try again.';
      err.classList.remove('hidden');
    } finally {
      if (global.LPBusy) global.LPBusy.hide();
      btn.disabled = false;
      state.loading = false;
    }
  }

  var wired = false;
  function wireEditor() {
    if (wired) return;
    wired = true;
    var root = $('pwp-editor');
    if (!root) return;
    root.addEventListener('click', function(e) {
      var tab = e.target.closest('[data-pwp-tab]');
      if (tab) { showTab(tab.getAttribute('data-pwp-tab')); return; }
      var star = e.target.closest('[data-pwp-lib-star]');
      if (star) {
        e.preventDefault();
        var sc2 = libCfg();
        var sid = star.getAttribute('data-pwp-lib-star');
        var at2 = sc2.starred.indexOf(sid);
        if (at2 >= 0) sc2.starred.splice(at2, 1); else sc2.starred.push(sid);
        rerenderShowcasePanel();
        return;
      }
      var libMode = e.target.closest('[data-pwp-lib-mode]');
      if (libMode) {
        var lc = libCfg();
        var nm = libMode.getAttribute('data-pwp-lib-mode');
        if (nm === 'selected' && lc.mode !== 'selected' && !lc.selected.length) {
          // Start hand-picking from what is in the showcase now.
          lc.selected = (state.library.items || []).slice(0, 3).map(function(it) { return it.id; });
        }
        lc.mode = nm;
        rerenderShowcasePanel();
        return;
      }
      if (e.target.id === 'pwp-headshot-upload' || e.target.closest('#pwp-headshot-upload')) {
        var fileInput = $('pwp-headshot-file');
        if (fileInput) fileInput.click();
        return;
      }
      if (e.target.id === 'pwp-headshot-clear' || e.target.closest('#pwp-headshot-clear')) {
        setHeadshotPreview('');
        return;
      }
      if (e.target.id === 'pwp-save' || e.target.closest('#pwp-save')) { saveProfile(); return; }
      var dcUp = e.target.closest('[data-pwp-dc-upload]');
      if (dcUp) {
        var dcFile = $('pwp-dc-file');
        if (dcFile) { dcFile.setAttribute('data-key', dcUp.getAttribute('data-pwp-dc-upload')); dcFile.click(); }
        return;
      }
      var dcClear = e.target.closest('[data-pwp-dc-clear]');
      if (dcClear) {
        var ck = dcClear.getAttribute('data-pwp-dc-clear');
        var ct = currentTemplateId();
        state.dcDraft[ct] = state.dcDraft[ct] || {};
        state.dcDraft[ct][ck] = '';
        rerenderDesignPanel();
        return;
      }
      if (e.target.id === 'pwp-add-testimonial') {
        var box = $('pwp-testimonials');
        var i = box.querySelectorAll('[data-pwp-testimonial]').length;
        box.insertAdjacentHTML('beforeend', testimonialRow({}, i));
        return;
      }
      if (e.target.id === 'pwp-add-case') {
        var cbox = $('pwp-cases');
        var ci = cbox.querySelectorAll('[data-pwp-case]').length;
        cbox.insertAdjacentHTML('beforeend', caseStudyRow({}, ci));
        return;
      }
      if (e.target.id === 'pwp-add-faq') {
        var fbox = $('pwp-faqs');
        var fi = fbox.querySelectorAll('[data-pwp-faq]').length;
        fbox.insertAdjacentHTML('beforeend', faqRow({}, fi));
        return;
      }
      if (e.target.id === 'pwp-add-ind-tab' || e.target.closest('#pwp-add-ind-tab')) {
        var box = $('pwp-ind-tabs');
        if (!box) return;
        var ni = box.querySelectorAll('[data-pwp-ind-tab]').length;
        var html = '<div class="pwp-ind-row" data-pwp-ind-tab="' + ni + '">'
          + '<div class="pwp-ind-row-head">'
          + field('Tab name', 'pwp-ind-label-' + ni, '', { placeholder: 'e.g. Trades' })
          + '<label class="pwp-ind-on"><input type="checkbox" id="pwp-ind-on-' + ni + '" checked style="width:auto"> Show tab</label>'
          + '</div>'
          + '<div class="field"><label for="pwp-ind-site-' + ni + '">Site or demo on this tab</label>'
          + siteSelectHtml('', ni)
          + '<p class="muted" style="font-size:12px;margin:6px 0 0">Pick any client site or demo from your book. This is what appears in “Choose an industry / Explore a real website.”</p>'
          + '</div>'
          + '<input type="hidden" id="pwp-ind-key-' + ni + '" value="tab-' + (ni + 1) + '">'
          + '<button type="button" class="btn" data-pwp-remove-ind="' + ni + '" style="padding:6px 12px;font-size:13px">Remove tab</button>'
          + '</div>';
        box.insertAdjacentHTML('beforeend', html);
        return;
      }
      if (e.target.id === 'pwp-add-hero-site' || e.target.closest('#pwp-add-hero-site')) {
        var hbox = $('pwp-hero-sites');
        if (!hbox) return;
        var hi = hbox.querySelectorAll('[data-pwp-hero-site]').length;
        hbox.insertAdjacentHTML('beforeend',
          '<div class="pwp-hero-site-row" data-pwp-hero-site="' + hi + '">'
          + '<div class="field" style="margin:0;flex:1"><label for="pwp-hero-site-' + hi + '">Also rotate</label>'
          + siteSelectHtml('', hi, { idPrefix: 'pwp-hero-site-', dataAttr: 'data-pwp-hero-field="siteId"' })
          + '</div>'
          + '<button type="button" class="btn" data-pwp-remove-hero="' + hi + '" style="padding:6px 12px;font-size:13px;align-self:end">Remove</button>'
          + '</div>');
        return;
      }
      var rmHero = e.target.getAttribute('data-pwp-remove-hero');
      if (rmHero != null) {
        var hrow = e.target.closest('[data-pwp-hero-site]');
        if (hrow) hrow.remove();
        return;
      }
      var rmInd = e.target.getAttribute('data-pwp-remove-ind');
      if (rmInd != null) {
        var row = e.target.closest('[data-pwp-ind-tab]');
        if (row) row.remove();
        return;
      }
      var rmT = e.target.getAttribute('data-pwp-remove-testimonial');
      if (rmT != null) { var tr = e.target.closest('[data-pwp-testimonial]'); if (tr) tr.remove(); return; }
      var rmC = e.target.getAttribute('data-pwp-remove-case');
      if (rmC != null) { var cr = e.target.closest('[data-pwp-case]'); if (cr) cr.remove(); return; }
      var rmF = e.target.getAttribute('data-pwp-remove-faq');
      if (rmF != null) { var fr = e.target.closest('[data-pwp-faq]'); if (fr) fr.remove(); return; }
    });
    root.addEventListener('input', function(e) {
      var k = e.target.getAttribute && e.target.getAttribute('data-pwp-dc');
      if (!k) return;
      var t = currentTemplateId();
      state.dcDraft[t] = state.dcDraft[t] || {};
      state.dcDraft[t][k] = e.target.value;
    });
    root.addEventListener('change', function(e) {
      if (e.target.id === 'pwp-lib-count') { libCfg().count = Number(e.target.value) || 3; return; }
      if (e.target.id === 'pwp-lib-auto') { libCfg().autoAdd = !!e.target.checked; return; }
      if (e.target.id === 'pwp-lib-mix') { libCfg().mix = e.target.value; return; }
      if (e.target.id === 'pwp-lib-scroll') { libCfg().scroll = e.target.value; return; }
      var libSite = e.target.getAttribute && e.target.getAttribute('data-pwp-lib-site');
      if (libSite) {
        var sc = libCfg();
        var at = sc.selected.indexOf(libSite);
        if (e.target.checked && at < 0) sc.selected.push(libSite);
        if (!e.target.checked && at >= 0) sc.selected.splice(at, 1);
        var row = e.target.closest('.pwp-lib-site'); if (row) row.classList.toggle('is-on', !!e.target.checked);
        var pc = $('pwp-lib-picked'); if (pc) pc.textContent = sc.selected.filter(function(id) { return (state.library.items || []).some(function(it) { return it.id === id; }); }).length + ' ticked';
        return;
      }
      if (e.target.id === 'pwp-dc-file') {
        var f = e.target.files && e.target.files[0];
        var key = e.target.getAttribute('data-key');
        e.target.value = '';
        if (!f || !key) return;
        var m = document.querySelector('[data-pwp-dc-msg="' + key + '"]');
        if (m) m.textContent = 'Uploading…';
        uploadHeadshot(f, { folder: 'design', prefix: key.replace(/[^a-z0-9]+/gi, '-') }).then(function(url) {
          var t = currentTemplateId();
          state.dcDraft[t] = state.dcDraft[t] || {};
          state.dcDraft[t][key] = url;
          rerenderDesignPanel();
        }).catch(function(err) {
          if (m) m.textContent = (err && err.message) || 'Upload failed';
        });
        return;
      }
      if (e.target.id !== 'pwp-headshot-file') return;
      var file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      var msg = $('pwp-headshot-msg');
      var btn = $('pwp-headshot-upload');
      if (msg) msg.textContent = 'Uploading…';
      if (btn) btn.disabled = true;
      uploadHeadshot(file).then(function(url) {
        setHeadshotPreview(url);
        if (msg) msg.textContent = 'Uploaded ✓';
        setTimeout(function() { if (msg) msg.textContent = ''; }, 2000);
      }).catch(function(err) {
        if (msg) msg.textContent = (err && err.message) || 'Upload failed';
      }).finally(function() {
        if (btn) btn.disabled = false;
      });
    });
  }

  var wiredTemplateSelect = false;
  async function load(opts) {
    opts = opts || {};
    state.authHeader = opts.authHeader;
    state.partnerId = opts.partnerId || null;
    var root = $('pwp-editor');
    if (!root) return;
    root.innerHTML = '<p class="muted" style="font-size:13px">Loading page content editor…</p>';
    try {
      var r = await fetch(profileUrl('/api/partner/website-profile'), { headers: await state.authHeader() });
      var j = await r.json();
      if (!j.ok) {
        var msg = j.error || 'Could not load profile.';
        if (j.can_pick) msg = 'Choose a partner from Ops Command to edit their website.';
        root.innerHTML = '<p class="notice bad" style="margin:0">' + esc(msg) + '</p>';
        return;
      }
      state.websiteProfile = j.websiteProfile;
      state.profile = j.profile || state.profile || null;
      state.dcDraft = {};
      try {
        var tr = await fetch('/api/partner/template-registry');
        var tj = await tr.json();
        if (tj && tj.ok && Array.isArray(tj.templates)) state.templates = tj.templates;
      } catch (_t) { /* design text tab explains itself without the list */ }
      if (!wiredTemplateSelect) {
        wiredTemplateSelect = true;
        document.addEventListener('change', function(ev) { if (ev.target && ev.target.id === 'sc-template') rerenderDesignPanel(); });
      }
      state.platform = j.platform;
      state.completion = j.completion;
      state.showcaseSites = j.showcaseSites || [];
      state.industryTabDefaults = j.industryTabDefaults || [];
      var seedNote = document.getElementById('pwp-seed-note');
      if (seedNote) seedNote.style.display = j.seededFromCultureDemo ? '' : 'none';
      state.libDraft = null;
      renderEditor();
      loadLibrary();
    } catch (_e) {
      root.innerHTML = '<p class="notice bad" style="margin:0">Could not load page content editor.</p>';
    }
  }

  global.LPPartnerWebsiteAdmin = { load: load, collectProfile: collectProfile, setGroup: setGroup };
})(typeof window !== 'undefined' ? window : global);
