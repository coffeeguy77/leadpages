/**
 * Shared categorised trade picker (manage + partner console).
 * Labels humanise slugs; DB packs can extend via LPTradePicker.registerPack().
 * registerPack / selectPack refresh any live pickers so new trades appear immediately.
 */
(function (global) {
  'use strict';

  var PACKS = {};
  var INSTANCES = [];

  function injectStyles() {
    if (document.getElementById('lp-tp2-style')) return;
    var st = document.createElement('style');
    st.id = 'lp-tp2-style';
    st.textContent = [
      '.cs-picked{margin-top:8px;display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text,var(--ink));flex-wrap:wrap}',
      '.cs-picked-lbl{font-weight:700}.cs-picked-cat{color:var(--text-soft,var(--ink-soft))}.cs-picked-cat:before{content:"in ";color:var(--muted,var(--ink-faint));font-weight:400}',
      '.tp2-wrap{display:flex;border:1px solid var(--border,var(--line));border-radius:12px;overflow:hidden;background:var(--panel);margin-top:8px;height:300px}',
      '.tp2-cats{width:40%;min-width:150px;max-width:250px;border-right:1px solid var(--border,var(--line));overflow:auto;background:color-mix(in srgb,var(--accent) 5%,var(--panel));-webkit-overflow-scrolling:touch}',
      '.tp2-cat{padding:11px 14px;font-size:13px;cursor:pointer;border-bottom:1px solid var(--border,var(--line));display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--text-soft,var(--ink-soft));line-height:1.25;background:transparent}',
      '.tp2-cat:hover{background:var(--accent-soft)}',
      '.tp2-cat.on{background:var(--accent-soft);color:var(--accent-hover,var(--accent));font-weight:600;box-shadow:inset 3px 0 0 var(--accent)}',
      '.tp2-count{font-size:11px;color:var(--muted,var(--ink-faint));font-weight:500;flex:none}',
      '.tp2-list{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;background:var(--panel)}',
      '.tp2-trow{padding:10px 14px;font-size:14px;cursor:pointer;border-bottom:1px solid var(--border,var(--line));display:flex;align-items:center;line-height:1.25;color:var(--text,var(--ink));background:transparent}',
      '.tp2-trow:hover{background:var(--accent-soft)}',
      '.tp2-trow.on{background:var(--accent-soft);color:var(--accent-hover,var(--accent));font-weight:600}',
      '.tp2-trow.on:after{content:"\\2713";margin-left:auto;color:var(--accent);font-weight:700}',
      '.tp2-empty{padding:18px 14px;color:var(--text-soft,var(--ink-soft));font-size:13px}',
      '@media(max-width:560px){.tp2-wrap{height:auto;flex-direction:column}.tp2-cats{width:auto;max-width:none;max-height:150px;border-right:0;border-bottom:1px solid var(--border,var(--line))}.tp2-list{max-height:240px}}'
    ].join('');
    document.head.appendChild(st);
  }

  function humanize(slug) {
    if (!slug) return '';
    if (slug === 'plumber') return 'Plumber';
    return String(slug).split('-').map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
  }

  var TRADE_CATS = [["Plumbing & Drains",["plumber","gas-fitter","hot-water","blocked-drains","leak-detection","roof-plumbing","waterproofing","bore-drilling"]],["Electrical, Solar & Data",["electrician","solar","solar-battery","ev-charger","data-cabling","security","antenna","home-automation","solar-panel-cleaning"]],["Heating, Cooling & Insulation",["aircon","insulation","duct-cleaning","chimney-sweep"]],["Building & Structural",["builder","bricklayer","carpenter","concreter","excavation","steel-fixing","welding","scaffolding","underpinning","stonemason","asphalt","polished-concrete","building-inspection"]],["Renovations & Interiors",["bathroom-reno","kitchen-reno","tiler","painter","plasterer","renderer","flooring","epoxy-flooring","splashbacks","cabinet-maker","wardrobes","staircases","ceilings","soundproofing","shopfitting","resurfacing","balustrading"]],["Roofing & Exteriors",["roofer","roof-restoration","metal-roofing","guttering","roof-ventilation","skylights","cladding","gutter-guards"]],["Doors, Windows & Locks",["garage-doors","automatic-gates","glazier","locksmith","blinds-awnings"]],["Landscaping & Outdoor",["landscaper","gardener","lawn-mowing","hedge-trimming","arborist","stump-grinding","irrigation","turf","synthetic-turf","paving","decking","pergolas","fencing","retaining-walls","kerbing","water-features","outdoor-kitchens","shade-sails","carports-sheds"]],["Pools",["pool-building","pool-maintenance","glass-pool-fencing"]],["Cleaning",["house-cleaning","carpet-cleaning","window-cleaning","end-of-lease-cleaning","oven-cleaning","tile-grout-cleaning","pressure-washing","gutter-cleaning"]],["Pest, Restoration & Hazard",["pest-control","mould-removal","water-damage","fire-restoration","storm-damage","asbestos-removal","asbestos-roof"]],["Waste, Removals & Demolition",["rubbish-removal","skip-bin-hire","removalists","demolition"]],["Hire & Events",["party-hire","equipment-hire","arcade-amusements","traffic-control"]],["Other & Specialist",["handyman","appliance-repair","pool-table-restoration","mobile-mechanic","mobile-tyres"]],["Small Business",["cafe","bakery","restaurant","hair-salon","barber","beauty-salon","gym-fitness","childcare","real-estate","accounting"]]];

  function tradeLabel(slug) {
    var p = PACKS[slug];
    if (p && p.label) return p.label;
    return humanize(slug);
  }

  function tradeType(slug) {
    var p = PACKS[slug];
    if (p && p.tradeType) return p.tradeType;
    return tradeLabel(slug);
  }

  function tradeCat(slug) {
    for (var i = 0; i < TRADE_CATS.length; i++) {
      if (TRADE_CATS[i][1].indexOf(slug) > -1) return TRADE_CATS[i][0];
    }
    return '';
  }

  function catIndexForSlug(slug) {
    for (var i = 0; i < TRADE_CATS.length; i++) {
      if (TRADE_CATS[i][1].indexOf(slug) > -1) return i;
    }
    return -1;
  }

  function registerPack(slug, cat, pack, opts) {
    if (!slug) return;
    PACKS[slug] = pack || PACKS[slug] || {};
    for (var i = 0; i < TRADE_CATS.length; i++) {
      var idx = TRADE_CATS[i][1].indexOf(slug);
      if (idx > -1) TRADE_CATS[i][1].splice(idx, 1);
    }
    var found = false;
    for (var j = 0; j < TRADE_CATS.length; j++) {
      if (TRADE_CATS[j][0] === cat) {
        TRADE_CATS[j][1].push(slug);
        found = true;
        break;
      }
    }
    if (!found) TRADE_CATS.push([cat || 'Other & Specialist', [slug]]);
    if (!(opts && opts.silent)) refreshAll();
  }

  function refreshAll() {
    for (var i = 0; i < INSTANCES.length; i++) {
      if (INSTANCES[i] && typeof INSTANCES[i].refresh === 'function') INSTANCES[i].refresh();
    }
  }

  function selectPack(slug, opts) {
    if (!slug) return false;
    var ok = false;
    for (var i = 0; i < INSTANCES.length; i++) {
      if (INSTANCES[i] && typeof INSTANCES[i].select === 'function') {
        if (INSTANCES[i].select(slug, opts)) ok = true;
      }
    }
    return ok;
  }

  function pruneInstances() {
    INSTANCES = INSTANCES.filter(function (inst) {
      return inst && inst.isLive && inst.isLive();
    });
  }

  function init2(o) {
    injectStyles();
    pruneInstances();
    var catsEl = document.getElementById(o.cats);
    var listEl = document.getElementById(o.list);
    var packEl = document.getElementById(o.hidden);
    var searchEl = document.getElementById(o.search);
    var pickedEl = document.getElementById(o.picked);
    if (!catsEl || !listEl || !packEl) return;

    // Re-bind if the same picker mounts again (settings reopen, panel remount).
    for (var ii = INSTANCES.length - 1; ii >= 0; ii--) {
      if (INSTANCES[ii] && INSTANCES[ii].packId === o.hidden) INSTANCES.splice(ii, 1);
    }

    if (o.defaultSlug && !packEl.value) packEl.value = o.defaultSlug;

    var active = 0;
    (function () {
      var s = packEl.value;
      var ci = catIndexForSlug(s);
      if (ci > -1) active = ci;
    })();

    function esc(t) {
      return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function hay(s) { return (tradeLabel(s) + ' ' + tradeType(s) + ' ' + s).toLowerCase(); }
    function matchSlugs(ci, q) {
      var out = [];
      var slugs = TRADE_CATS[ci] ? TRADE_CATS[ci][1] : [];
      for (var j = 0; j < slugs.length; j++) {
        var s = slugs[j];
        if (!q || hay(s).indexOf(q) > -1) out.push(s);
      }
      out.sort(function (a, b) {
        var la = tradeLabel(a).toLowerCase();
        var lb = tradeLabel(b).toLowerCase();
        return la < lb ? -1 : (la > lb ? 1 : 0);
      });
      return out;
    }
    function curQ() { return searchEl ? searchEl.value.trim().toLowerCase() : ''; }
    function paintPicked() {
      if (!pickedEl) return;
      var s = packEl.value;
      pickedEl.innerHTML = '<span class="cs-picked-lbl">' + esc(tradeLabel(s)) + '</span>'
        + '<span class="cs-picked-cat">' + esc(tradeCat(s)) + '</span>';
    }
    function setPick(s) {
      packEl.value = s;
      paintPicked();
      var rows = listEl.querySelectorAll('.tp2-trow');
      for (var i = 0; i < rows.length; i++) {
        rows[i].classList.toggle('on', rows[i].getAttribute('data-pack') === s);
      }
    }
    function renderList(q) {
      if (active < 0 || active >= TRADE_CATS.length) active = 0;
      var slugs = matchSlugs(active, q);
      var html = '';
      for (var j = 0; j < slugs.length; j++) {
        var s = slugs[j];
        html += '<div class="tp2-trow' + (packEl.value === s ? ' on' : '') + '" data-pack="' + s + '">' + esc(tradeLabel(s)) + '</div>';
      }
      if (!html) html = '<div class="tp2-empty">No trades here match. Try another category or search term.</div>';
      listEl.innerHTML = html;
      var rows = listEl.querySelectorAll('.tp2-trow');
      for (var k = 0; k < rows.length; k++) {
        rows[k].addEventListener('click', function () { setPick(this.getAttribute('data-pack')); });
      }
    }
    function renderCats(q) {
      var html = '';
      for (var i = 0; i < TRADE_CATS.length; i++) {
        var c = matchSlugs(i, q).length;
        if (q && c === 0) continue;
        html += '<div class="tp2-cat' + (i === active ? ' on' : '') + '" data-ci="' + i + '"><span>' + esc(TRADE_CATS[i][0]) + '</span><span class="tp2-count">' + c + '</span></div>';
      }
      catsEl.innerHTML = html;
      var rows = catsEl.querySelectorAll('.tp2-cat');
      for (var k = 0; k < rows.length; k++) {
        rows[k].addEventListener('click', function () {
          active = parseInt(this.getAttribute('data-ci'), 10);
          renderCats(curQ());
          renderList(curQ());
        });
      }
    }
    function ensureActiveHasMatches(q) {
      if (matchSlugs(active, q).length > 0) return;
      for (var i = 0; i < TRADE_CATS.length; i++) {
        if (matchSlugs(i, q).length > 0) { active = i; return; }
      }
    }
    function renderAll() {
      var q = curQ();
      ensureActiveHasMatches(q);
      renderCats(q);
      renderList(q);
    }
    function scrollSelectedIntoView() {
      var row = listEl.querySelector('.tp2-trow.on');
      if (row && typeof row.scrollIntoView === 'function') {
        try { row.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_e) { row.scrollIntoView(false); }
      }
      var cat = catsEl.querySelector('.tp2-cat.on');
      if (cat && typeof cat.scrollIntoView === 'function') {
        try { cat.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_e2) { cat.scrollIntoView(false); }
      }
    }
    function select(slug, opts) {
      if (!slug) return false;
      opts = opts || {};
      if (catIndexForSlug(slug) < 0) return false;
      if (!(opts.keepSearch) && searchEl) searchEl.value = '';
      var ci = catIndexForSlug(slug);
      if (ci > -1) active = ci;
      setPick(slug);
      renderAll();
      scrollSelectedIntoView();
      return true;
    }
    function refresh() {
      if (!catsEl.isConnected || !listEl.isConnected || !packEl.isConnected) return;
      var s = packEl.value;
      var ci = catIndexForSlug(s);
      if (ci > -1) active = ci;
      if (active >= TRADE_CATS.length) active = Math.max(0, TRADE_CATS.length - 1);
      renderAll();
      paintPicked();
    }

    if (searchEl && !searchEl.__lpTp2Wired) {
      searchEl.__lpTp2Wired = true;
      searchEl.addEventListener('input', renderAll);
    }
    renderAll();
    paintPicked();

    INSTANCES.push({
      packId: o.hidden,
      refresh: refresh,
      select: select,
      isLive: function () {
        return !!(catsEl.isConnected && listEl.isConnected && packEl.isConnected);
      }
    });
  }

  global.LPTradePicker = {
    init2: init2,
    registerPack: registerPack,
    selectPack: selectPack,
    refresh: refreshAll,
    tradeLabel: tradeLabel,
    tradeType: tradeType,
    tradeCat: tradeCat,
    cats: TRADE_CATS
  };
})(typeof window !== 'undefined' ? window : globalThis);
