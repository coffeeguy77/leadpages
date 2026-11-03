/**
 * Product Explorer app (sections.productExplorer) — choose a category, filter by type,
 * pick a model, then see its floor plan / elevations / photos, details and an enquiry
 * button that preselects the model in the quote form. General purpose: cabins, house
 * plans, vehicles, equipment … anything with a short list of models.
 *
 * Section keys (all optional):
 *   eyebrow, heading, intro            heading block (heading left, intro right)
 *   tone ('' | 'soft' | 'dark'), darkColor, panelColor, accentColor
 *   step1Label, step2Label, step3Label  labels over the category / type / model pickers
 *   allLabel                            type filter "All" chip text
 *   enquireLabel ("Enquire About {name}"), detailsLabel, enquireHref (default #quote)
 *   unit ("m²"), placeholderText
 *   helpTitle, helpText, helpCtaLabel, helpCtaHref   "Not sure which suits?" note
 *   note                                small print under the actions (e.g. approvals)
 *   cardsOn, cardsCtaLabel ("Explore {count} models")   category photo cards under the explorer
 *   fillQuote (default true)            quote form's job list = the models; selected on Enquire
 *   categories[] {on, label, image, blurb}
 *   items[] {on, name, category, group, bedrooms, bathrooms, area, dimensions, description,
 *            link, floorPlan, elev1..elev4, photo1..photo3, alt}
 *
 * Deep links: ?pe-cat=<category>&pe-model=<model> (kept in the address as you browse, so Back
 * and shared links reopen the same model). Never shows one model's images for another: a
 * model with no floor plan shows the placeholder.
 */
(function () {
  'use strict';

  var STATE = { cat: '', group: '', model: '', tab: '', idx: 0, init: false };
  var LAST = null;

  function cfgOf() { return LAST || window.__lpLiveCfg || ((typeof SITE_CONFIG !== 'undefined') ? SITE_CONFIG : null); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function txt(v) { return String(v == null ? '' : v).trim(); }
  function slug(s) { return txt(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function hexOk(v) { v = txt(v); return /^#[0-9a-fA-F]{6}$/.test(v) ? v : ''; }
  function url(v) { return txt(v).replace(/[\s"'<>\\]/g, ''); }
  function icon(name) {
    var p = window.LP_ICONS && window.LP_ICONS[name];
    return p ? '<svg class="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>' : '';
  }
  var SVG = function (d) { return '<svg class="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
  var I_PREV = SVG('<path d="m15 18-6-6 6-6"/>');
  var I_NEXT = SVG('<path d="m9 18 6-6-6-6"/>');
  var I_ARROW = SVG('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>');
  var I_OUT = SVG('<path d="M7 17 17 7"/><path d="M7 7h10v10"/>');
  var I_FULL = SVG('<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>');
  var I_ZOOM = SVG('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/>');
  var I_X = SVG('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>');
  var I_PLAN = SVG('<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 12h7v9"/><path d="M14 3v6h7"/>');

  function sec() { return document.querySelector('[data-sec="productExplorer"]'); }
  function S() { var C = cfgOf() || {}; return (C.sections && C.sections.productExplorer) || {}; }

  function models(M) {
    return (Array.isArray(M.items) ? M.items : []).map(function (it, i) { return { it: it || {}, i: i }; })
      .filter(function (x) { return x.it.on !== false && txt(x.it.name); });
  }
  function categories(M, list) {
    var out = [], seen = {};
    (Array.isArray(M.categories) ? M.categories : []).forEach(function (c, i) {
      if (!c || c.on === false || !txt(c.label) || seen[slug(c.label)]) return;
      seen[slug(c.label)] = 1;
      out.push({ key: slug(c.label), label: txt(c.label), image: url(c.image), blurb: txt(c.blurb), i: i });
    });
    list.forEach(function (x) {
      var k = slug(x.it.category);
      if (k && !seen[k]) { seen[k] = 1; out.push({ key: k, label: txt(x.it.category), image: '', blurb: '', i: -1 }); }
    });
    return out.map(function (c) {
      c.count = list.filter(function (x) { return slug(x.it.category) === c.key; }).length;
      return c;
    }).filter(function (c) { return c.count > 0; });
  }
  function groupsIn(list) {
    var out = [], seen = {};
    list.forEach(function (x) {
      var g = txt(x.it.group); var k = slug(g);
      if (!k) return;
      if (!seen[k]) { seen[k] = { key: k, label: g, count: 0 }; out.push(seen[k]); }
      seen[k].count++;
    });
    return out;
  }
  function imagesOf(it) {
    var plan = url(it.floorPlan);
    var elev = ['elev1', 'elev2', 'elev3', 'elev4'].map(function (k) { return url(it[k]); }).filter(Boolean);
    var photo = ['photo1', 'photo2', 'photo3'].map(function (k) { return url(it[k]); }).filter(Boolean);
    return { plan: plan ? [plan] : [], elev: elev, photo: photo };
  }
  function unitOf(M) { return txt(M.unit) || 'm²'; }
  function fill(tpl, it, extra) {
    return String(tpl || '').replace(/\{name\}/g, txt(it && it.name)).replace(/\{count\}/g, extra != null ? extra : '');
  }

  /* ---------- Address state (?pe-cat=&pe-model=) ---------- */
  function readUrl() {
    try {
      var q = new URLSearchParams(location.search);
      return { cat: slug(q.get('pe-cat')), model: slug(q.get('pe-model')) };
    } catch (e) { return { cat: '', model: '' }; }
  }
  function writeUrl() {
    try {
      var u = new URL(location.href);
      if (STATE.cat) u.searchParams.set('pe-cat', STATE.cat); else u.searchParams.delete('pe-cat');
      if (STATE.model) u.searchParams.set('pe-model', STATE.model); else u.searchParams.delete('pe-model');
      var next = u.pathname + u.search + u.hash;
      if (next !== location.pathname + location.search + location.hash) history.replaceState(history.state, '', next);
    } catch (e) {}
  }

  /* ---------- Choosing ---------- */
  function resolve(M) {
    var list = models(M);
    var cats = categories(M, list);
    if (!cats.length) return { list: list, cats: cats, inCat: [], groups: [], shown: [], cur: null };
    if (!cats.some(function (c) { return c.key === STATE.cat; })) {
      var fromModel = list.filter(function (x) { return slug(x.it.name) === STATE.model; })[0];
      STATE.cat = fromModel ? slug(fromModel.it.category) : cats[0].key;
    }
    var inCat = list.filter(function (x) { return slug(x.it.category) === STATE.cat; });
    var groups = groupsIn(inCat);
    if (STATE.group && !groups.some(function (g) { return g.key === STATE.group; })) STATE.group = '';
    var shown = STATE.group ? inCat.filter(function (x) { return slug(x.it.group) === STATE.group; }) : inCat;
    var cur = shown.filter(function (x) { return slug(x.it.name) === STATE.model; })[0] ||
      inCat.filter(function (x) { return slug(x.it.name) === STATE.model; })[0] || shown[0] || null;
    if (cur && slug(cur.it.group) && STATE.group && slug(cur.it.group) !== STATE.group) STATE.group = '';
    STATE.model = cur ? slug(cur.it.name) : '';
    return { list: list, cats: cats, inCat: inCat, groups: groups, shown: shown, cur: cur };
  }

  /* ---------- Drawing ---------- */
  function specsHtml(it, M) {
    var out = [];
    var b = txt(it.bedrooms), ba = txt(it.bathrooms), a = txt(it.area), d = txt(it.dimensions);
    if (b !== '') out.push('<li>' + icon('bed-double') + '<span>' + esc(b === '0' ? 'Studio' : b + (b === '1' ? ' Bedroom' : ' Bedrooms')) + '</span></li>');
    if (ba !== '') out.push('<li>' + icon('bath') + '<span>' + esc(ba + (ba === '1' ? ' Bathroom' : ' Bathrooms')) + '</span></li>');
    if (a !== '') out.push('<li>' + icon('maximize') + '<span>' + esc(a) + ' ' + esc(unitOf(M)) + '</span></li>');
    if (d !== '') out.push('<li>' + icon('ruler') + '<span>' + esc(d) + '</span></li>');
    return out.length ? '<ul class="pe-specs">' + out.join('') + '</ul>' : '';
  }
  function metaLine(it, M) {
    var bits = [];
    if (txt(it.area)) bits.push(esc(txt(it.area)) + ' ' + esc(unitOf(M)));
    var b = txt(it.bedrooms);
    if (b !== '') bits.push(b === '0' ? 'Studio' : esc(b) + ' Bed');
    if (txt(it.bathrooms)) bits.push(esc(txt(it.bathrooms)) + ' Bath');
    if (!bits.length && txt(it.group)) bits.push(esc(txt(it.group)));
    return bits.join('<i aria-hidden="true">|</i>');
  }
  function thumbOf(it) {
    var im = imagesOf(it);
    var src = im.photo[0] || im.plan[0] || im.elev[0];
    return src ? '<img src="' + esc(src) + '" alt="" loading="lazy">' : '<span class="pe-thumb-ph">' + I_PLAN + '</span>';
  }

  function viewerHtml(it, M) {
    var im = imagesOf(it);
    var tabs = [['plan', 'Floor plan', im.plan.length], ['elev', 'Elevations', im.elev.length], ['photo', 'Photos', im.photo.length]];
    if (!STATE.tab || !im[STATE.tab] || (STATE.tab !== 'plan' && !im[STATE.tab].length)) {
      STATE.tab = im.plan.length ? 'plan' : (im.photo.length ? 'photo' : (im.elev.length ? 'elev' : 'plan'));
      STATE.idx = 0;
    }
    var set = im[STATE.tab] || [];
    if (STATE.idx >= set.length) STATE.idx = 0;
    var src = set[STATE.idx];
    var alt = txt(it.alt) || (txt(it.name) + ' — ' + (STATE.tab === 'plan' ? 'floor plan' : STATE.tab === 'elev' ? 'elevation ' + (STATE.idx + 1) : 'photo ' + (STATE.idx + 1)));
    var tabBar = '<div class="pe-tabs" role="tablist">' + tabs.filter(function (t) { return t[0] === 'plan' || t[2] > 0; }).map(function (t) {
      return '<button type="button" role="tab" class="pe-tab' + (STATE.tab === t[0] ? ' is-on' : '') + '" aria-selected="' + (STATE.tab === t[0]) + '" data-pe-tab="' + t[0] + '">' +
        esc(t[1]) + (t[2] > 1 ? ' <small>' + t[2] + '</small>' : '') + '</button>';
    }).join('') + '</div>';
    var stage = src
      ? '<button type="button" class="pe-stage-img" data-pe-full aria-label="Open ' + esc(alt) + ' full screen"><img src="' + esc(src) + '" alt="' + esc(alt) + '"></button>' +
        '<span class="pe-stage-tools">' + I_ZOOM + '<span>Click to enlarge</span></span>'
      : '<div class="pe-ph">' + I_PLAN + '<strong>' + esc(txt(M.placeholderText) || 'Official floor plan coming soon') + '</strong>' +
        (txt(it.link) ? '<a href="' + esc(url(it.link)) + '" target="_blank" rel="noopener">See the plan on the manufacturer’s site ' + I_OUT + '</a>' : '') + '</div>';
    var nav = set.length > 1
      ? '<button type="button" class="pe-nav pe-prev" data-pe-step="-1" aria-label="Previous image">' + I_PREV + '</button>' +
        '<button type="button" class="pe-nav pe-next" data-pe-step="1" aria-label="Next image">' + I_NEXT + '</button>' +
        '<div class="pe-dots" aria-hidden="true">' + set.map(function (_s, i) { return '<i' + (i === STATE.idx ? ' class="is-on"' : '') + '></i>'; }).join('') + '</div>'
      : '';
    var tag = '<span class="pe-tag">' + esc(txt(it.category)) + (txt(it.group) ? '<i aria-hidden="true">|</i>' + esc(txt(it.group)) : '') + '</span>';
    return tabBar + '<div class="pe-stage pe-stage-' + STATE.tab + (src ? '' : ' is-empty') + '">' + stage + nav + tag + '</div>';
  }

  function detailHtml(it, M) {
    var enq = fill(txt(M.enquireLabel) || 'Enquire About {name}', it);
    var det = txt(M.detailsLabel) || 'View full details';
    var link = url(it.link);
    return '<div class="pe-detail-body">' +
      '<div class="pe-info">' +
        '<h3 class="pe-name" data-lpe="list:productExplorerItems:' + STATE.curIndex + ':name">' + esc(txt(it.name)) + '</h3>' +
        (txt(it.description) ? '<p class="pe-desc">' + esc(txt(it.description)) + '</p>' : '') +
        specsHtml(it, M) +
      '</div>' +
      '<div class="pe-actions">' +
        '<a class="lpl-btn pe-btn pe-enq" href="' + esc(txt(M.enquireHref) || '#quote') + '" data-pe-enquire>' + esc(enq) + I_ARROW + '</a>' +
        (link ? '<a class="lpl-btn pe-btn pe-out" href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(det) + I_OUT + '</a>' : '') +
        (txt(M.note) ? '<p class="pe-note" data-lpe="note">' + esc(txt(M.note)) + '</p>' : '') +
      '</div>' +
    '</div>';
  }

  function render(C) {
    var node = sec(); if (!node) return;
    if (C) LAST = C;
    var M = S();
    var old = node.querySelector('[data-lpl="pe"]');
    if (M.on !== true) { if (old) old.parentNode.removeChild(old); return; }
    if (!STATE.init) {
      var u = readUrl();
      if (u.cat) STATE.cat = u.cat;
      if (u.model) STATE.model = u.model;
      STATE.init = true;
    }
    var tone = ({ soft: 1, dark: 1 })[M.tone] ? M.tone : '';
    node.classList.add('pe-sec');
    node.classList.toggle('pe-dark', tone === 'dark');
    node.classList.toggle('pe-soft', tone === 'soft');
    [['--pe-band', hexOk(M.darkColor)], ['--pe-panel', hexOk(M.panelColor)], ['--pe-accent', hexOk(M.accentColor)]].forEach(function (v) {
      if (v[1]) node.style.setProperty(v[0], v[1]); else node.style.removeProperty(v[0]);
    });

    var R = resolve(M);
    STATE.curIndex = R.cur ? R.cur.i : -1;
    var head = (txt(M.eyebrow) || txt(M.heading) || txt(M.intro))
      ? '<div class="pe-head"><div class="pe-head-l">' +
          (txt(M.eyebrow) ? '<span class="eyebrow pe-eyebrow" data-lpe="eyebrow">' + esc(M.eyebrow) + '</span>' : '') +
          (txt(M.heading) ? '<h2 class="pe-h" data-lpe="heading">' + esc(M.heading).replace(/\n/g, '<br>') + '</h2>' : '') +
        '</div>' + (txt(M.intro) ? '<p class="pe-intro" data-lpe="intro">' + esc(M.intro) + '</p>' : '') + '</div>'
      : '';

    var body;
    if (!R.list.length) {
      body = '<div class="pe-panel"><p class="pe-empty">Add models under <b>Models</b> in the editor.</p></div>';
    } else {
      var catBtns = R.cats.map(function (c) {
        return '<button type="button" class="pe-cat' + (c.key === STATE.cat ? ' is-on' : '') + '" data-pe-cat="' + esc(c.key) + '" aria-pressed="' + (c.key === STATE.cat) + '">' +
          '<span class="pe-cat-ic">' + icon(/flat|house|home|dwelling/i.test(c.label) ? 'house' : 'home') + '</span>' +
          '<span><b>' + esc(c.label) + '</b><small>' + c.count + ' model' + (c.count === 1 ? '' : 's') + '</small></span></button>';
      }).join('');
      var grpBtns = R.groups.length > 1
        ? '<button type="button" class="pe-chip' + (!STATE.group ? ' is-on' : '') + '" data-pe-group="" aria-pressed="' + (!STATE.group) + '">' + esc(txt(M.allLabel) || 'All') + ' (' + R.inCat.length + ')</button>' +
          R.groups.map(function (g) {
            return '<button type="button" class="pe-chip' + (g.key === STATE.group ? ' is-on' : '') + '" data-pe-group="' + esc(g.key) + '" aria-pressed="' + (g.key === STATE.group) + '">' + esc(g.label) + ' (' + g.count + ')</button>';
          }).join('')
        : '';
      var listHtml = R.shown.map(function (x) {
        var on = R.cur && x.i === R.cur.i;
        return '<li><button type="button" class="pe-model' + (on ? ' is-on' : '') + '" data-pe-model="' + esc(slug(x.it.name)) + '" aria-current="' + (on ? 'true' : 'false') + '" data-lpe="list:productExplorerItems:' + x.i + ':name">' +
          '<span class="pe-thumb">' + thumbOf(x.it) + '</span>' +
          '<span class="pe-mtext"><b>' + esc(txt(x.it.name)) + '</b><small>' + metaLine(x.it, M) + '</small></span>' + I_NEXT + '</button></li>';
      }).join('');
      var help = txt(M.helpTitle)
        ? '<div class="pe-help"><b data-lpe="helpTitle">' + esc(M.helpTitle) + '</b>' + (txt(M.helpText) ? '<p data-lpe="helpText">' + esc(M.helpText) + '</p>' : '') +
          (txt(M.helpCtaLabel) ? '<a class="lpl-link pe-help-cta" href="' + esc(txt(M.helpCtaHref) || '#quote') + '">' + esc(M.helpCtaLabel) + I_ARROW + '</a>' : '') + '</div>'
        : '';
      body = '<div class="pe-panel">' +
        '<div class="pe-side">' +
          (R.cats.length > 1 ? '<div class="pe-step"><span class="pe-step-l">' + esc(txt(M.step1Label) || '1. Choose a category') + '</span><div class="pe-cats">' + catBtns + '</div></div>' : '') +
          (grpBtns ? '<div class="pe-step"><span class="pe-step-l">' + esc(txt(M.step2Label) || '2. Type') + '</span><div class="pe-chips">' + grpBtns + '</div></div>' : '') +
          '<div class="pe-step pe-step-list"><span class="pe-step-l">' + esc(txt(M.step3Label) || '3. Select a model') + '</span><ul class="pe-models">' + listHtml + '</ul></div>' +
          help +
        '</div>' +
        '<div class="pe-detail" aria-live="polite">' + (R.cur ? '<div class="pe-view">' + viewerHtml(R.cur.it, M) + '</div>' + detailHtml(R.cur.it, M) : '') + '</div>' +
      '</div>';
    }

    var cards = '';
    if (M.cardsOn === true && R.cats.length) {
      cards = '<div class="pe-cards">' + R.cats.map(function (c) {
        return '<button type="button" class="pe-card" data-pe-card="' + esc(c.key) + '"' + (c.image ? ' style="--pe-card-img:url(&quot;' + esc(c.image) + '&quot;)"' : '') + '>' +
          '<span class="pe-card-in"><b>' + esc(c.label) + '</b>' + (c.blurb ? '<span>' + esc(c.blurb) + '</span>' : '') +
          '<span class="lpl-btn pe-card-btn">' + esc(fill(txt(M.cardsCtaLabel) || 'Explore {count} models', null, c.count)) + I_ARROW + '</span></span></button>';
      }).join('') + '</div>';
    }

    var html = '<div class="wrap pe" data-lpl="pe">' + head + body + cards + '</div>';
    if (old) old.outerHTML = html; else node.insertAdjacentHTML('afterbegin', html);
    var listEl = node.querySelector('.pe-models .is-on');
    if (listEl && listEl.scrollIntoView && STATE.scrollList) {
      try { listEl.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
    }
    STATE.scrollList = false;
    fillQuote(M, R);
    writeUrl();
  }

  /* ---------- Quote form: the job list becomes the models; Enquire selects one ---------- */
  function labelFor(x) { return txt(x.it.name) + (txt(x.it.category) ? ' — ' + txt(x.it.category) : ''); }
  function fillQuote(M, R) {
    if (M.fillQuote === false) return;
    var sel = document.getElementById('job'); if (!sel || !R.list.length) return;
    var want = [txt(M.notSureLabel) || 'Not sure yet'].concat(R.list.map(labelFor));
    var have = Array.prototype.map.call(sel.options, function (o) { return o.text; });
    if (have.join('\n') !== want.join('\n')) {
      var keep = sel.value;
      sel.innerHTML = want.map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('');
      sel.value = want.indexOf(keep) >= 0 ? keep : want[0];
    }
    var pre = null;
    try { pre = sessionStorage.getItem('lp_pe_enquiry'); } catch (e) {}
    if (pre && want.indexOf(pre) >= 0 && !sel.__peTouched) sel.value = pre;
    if (!sel.__peBound) {
      sel.__peBound = true;
      sel.addEventListener('change', function () { sel.__peTouched = true; try { sessionStorage.setItem('lp_pe_enquiry', sel.value); } catch (e) {} });
    }
  }
  function enquire(href) {
    var M = S(); var R = resolve(M);
    if (R.cur) {
      var label = labelFor(R.cur);
      try { sessionStorage.setItem('lp_pe_enquiry', label); } catch (e) {}
      var sel = document.getElementById('job');
      if (sel && M.fillQuote !== false) {
        fillQuote(M, R);
        sel.value = label; sel.__peTouched = false;
        try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
      }
    }
    var id = String(href || '#quote').replace(/^#/, '');
    var t = document.getElementById(id) || document.querySelector('[data-sec="' + id + '"]');
    if (t) {
      try { t.scrollIntoView({ behavior: smooth(), block: 'start' }); } catch (e) { t.scrollIntoView(); }
      var first = document.getElementById('name');
      if (first && id === 'quote') setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (e) {} }, 500);
      return true;
    }
    return false;
  }
  function smooth() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'; } catch (e) { return 'smooth'; } }

  /* ---------- Full-screen viewer with zoom ---------- */
  function openFull() {
    var M = S(); var R = resolve(M); if (!R.cur) return;
    var im = imagesOf(R.cur.it); var set = im[STATE.tab] || []; if (!set.length) return;
    var box = document.createElement('div');
    box.className = 'pe-lb'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', txt(R.cur.it.name));
    var i = STATE.idx;
    function paint() {
      box.innerHTML = '<div class="pe-lb-bar"><b>' + esc(txt(R.cur.it.name)) + '</b><span>' + (set.length > 1 ? (i + 1) + ' / ' + set.length : '') + '</span>' +
        '<button type="button" data-lb="zoom" aria-pressed="false">' + I_ZOOM + '<span>Zoom</span></button>' +
        '<button type="button" data-lb="close" aria-label="Close">' + I_X + '</button></div>' +
        '<div class="pe-lb-stage"><img src="' + esc(set[i]) + '" alt="' + esc(txt(R.cur.it.name)) + '"></div>' +
        (set.length > 1 ? '<button type="button" class="pe-nav pe-prev" data-lb="-1" aria-label="Previous image">' + I_PREV + '</button><button type="button" class="pe-nav pe-next" data-lb="1" aria-label="Next image">' + I_NEXT + '</button>' : '');
    }
    function close() { document.removeEventListener('keydown', key); box.parentNode && box.parentNode.removeChild(box); document.documentElement.classList.remove('pe-lb-open'); }
    function zoom() {
      var on = !box.classList.contains('is-zoom'); box.classList.toggle('is-zoom', on);
      var b = box.querySelector('[data-lb="zoom"]'); if (b) b.setAttribute('aria-pressed', String(on));
    }
    function key(e) {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight' && set.length > 1) { i = (i + 1) % set.length; paint(); }
      else if (e.key === 'ArrowLeft' && set.length > 1) { i = (i - 1 + set.length) % set.length; paint(); }
    }
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-lb]');
      if (b) {
        var a = b.getAttribute('data-lb');
        if (a === 'close') close(); else if (a === 'zoom') zoom();
        else { i = (i + Number(a) + set.length) % set.length; paint(); }
        return;
      }
      if (e.target.tagName === 'IMG') zoom();
      else if (e.target === box || e.target.classList.contains('pe-lb-stage')) close();
    });
    paint();
    document.body.appendChild(box);
    document.documentElement.classList.add('pe-lb-open');
    document.addEventListener('keydown', key);
    var c = box.querySelector('[data-lb="close"]'); if (c) c.focus();
  }

  /* ---------- Events ---------- */
  function swap() {
    var d = document.querySelector('[data-sec="productExplorer"] .pe-detail');
    if (d) { d.classList.remove('pe-in'); void d.offsetWidth; d.classList.add('pe-in'); }
  }
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target : null; if (!t) return;
    var root = t.closest('[data-sec="productExplorer"]'); if (!root) return;
    var b;
    if ((b = t.closest('[data-pe-cat]'))) { STATE.cat = b.getAttribute('data-pe-cat'); STATE.group = ''; STATE.model = ''; STATE.tab = ''; render(); swap(); return; }
    if ((b = t.closest('[data-pe-group]'))) { STATE.group = b.getAttribute('data-pe-group'); STATE.model = ''; STATE.tab = ''; render(); swap(); return; }
    if ((b = t.closest('[data-pe-model]'))) { STATE.model = b.getAttribute('data-pe-model'); STATE.tab = ''; STATE.idx = 0; STATE.scrollList = true; render(); swap(); return; }
    if ((b = t.closest('[data-pe-tab]'))) { STATE.tab = b.getAttribute('data-pe-tab'); STATE.idx = 0; render(); return; }
    if ((b = t.closest('[data-pe-step]'))) {
      var M = S(); var R = resolve(M); if (!R.cur) return;
      var n = (imagesOf(R.cur.it)[STATE.tab] || []).length; if (n < 2) return;
      STATE.idx = (STATE.idx + Number(b.getAttribute('data-pe-step')) + n) % n; render(); return;
    }
    if (t.closest('[data-pe-full]')) { openFull(); return; }
    if ((b = t.closest('[data-pe-enquire]'))) { if (enquire(b.getAttribute('href'))) e.preventDefault(); return; }
    if ((b = t.closest('[data-pe-card]'))) {
      STATE.cat = b.getAttribute('data-pe-card'); STATE.group = ''; STATE.model = ''; STATE.tab = ''; render();
      var p = root.querySelector('.pe-panel') || root;
      try { p.scrollIntoView({ behavior: smooth(), block: 'start' }); } catch (_s) { p.scrollIntoView(); }
    }
  });
  // Links anywhere on the page to "?pe-cat=…" open that category in place.
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href*="pe-cat="],a[href*="pe-model="]') : null; if (!a) return;
    var node = sec(); if (!node || S().on !== true) return;
    var u; try { u = new URL(a.getAttribute('href'), location.href); } catch (_e) { return; }
    if (u.origin !== location.origin || u.pathname.replace(/\/+$/, '') !== location.pathname.replace(/\/+$/, '')) return;
    e.preventDefault();
    STATE.cat = slug(u.searchParams.get('pe-cat')) || STATE.cat; STATE.model = slug(u.searchParams.get('pe-model')); STATE.group = ''; STATE.tab = '';
    render();
    try { node.scrollIntoView({ behavior: smooth(), block: 'start' }); } catch (_s) { node.scrollIntoView(); }
  });

  window.LPProductExplorer = { render: render, state: STATE };

  var BOUND = false;
  function bind() {
    if (BOUND) return;
    var o = window.__applyTradeConfig;
    if (typeof o === 'function' && !o.__peWrapped) {
      var w = function (c) {
        var r, err = null;
        try { r = o.apply(this, arguments); } catch (x) { err = x; }
        try { render(c); } catch (x) { try { console.warn('[product explorer]', x && x.message); } catch (_y) {} }
        if (err) throw err;
        return r;
      };
      w.__peWrapped = true;
      for (var k in o) { if (Object.prototype.hasOwnProperty.call(o, k) && !(k in w)) w[k] = o[k]; }
      window.__applyTradeConfig = w;
      BOUND = true;
    }
  }
  function init() { bind(); try { render(); } catch (e) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.addEventListener('load', function () { bind(); try { render(); } catch (e) {} });
})();
