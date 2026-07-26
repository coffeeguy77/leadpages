/**
 * Public marketplace homepage V2 enhancements.
 * Activated when APP_MARKETPLACE_V2 is on (env inject, ?v2=1, or localStorage).
 */
(function () {
  'use strict';

  function flags() {
    return (window.LPMarketplaceFlags && window.LPMarketplaceFlags.getFlags())
      || window.__LP_MARKETPLACE_FLAGS__
      || {};
  }

  function v2On() {
    var f = flags();
    return !!(f.APP_MARKETPLACE_V2);
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  var GOALS = [
    { id: 'enquiries', label: 'Get more enquiries', cats: ['leads', 'forms', 'quote'] },
    { id: 'trust', label: 'Build trust', cats: ['trust', 'reviews', 'proof'] },
    { id: 'work', label: 'Show my work', cats: ['gallery', 'portfolio', 'projects'] },
    { id: 'services', label: 'Explain my services', cats: ['services', 'content'] },
    { id: 'sell', label: 'Sell products or packages', cats: ['products', 'packages', 'offer'] },
    { id: 'bookings', label: 'Take bookings', cats: ['booking', 'events'] },
    { id: 'seo', label: 'Improve local search', cats: ['seo', 'growth', 'area'] },
    { id: 'offer', label: 'Promote an offer', cats: ['promo', 'marketing', 'offer'] },
    { id: 'ease', label: 'Make my website easier to use', cats: ['nav', 'heroes', 'layout'] }
  ];

  var COLLECTIONS = [
    { title: 'Perfect for First-Time Website Builders', hint: 'Simple starting points that look finished quickly.' },
    { title: 'Popular with Trades', hint: 'Trusted layouts for service businesses on the tools.' },
    { title: 'Great for Cafés and Hospitality', hint: 'Visual menus, events and warm brand moments.' },
    { title: 'Build Trust Quickly', hint: 'Credentials, reviews and proof that calm new visitors.' },
    { title: 'Turn Visitors into Enquiries', hint: 'Forms, calls and quote paths that convert.' },
    { title: 'Show Your Work', hint: 'Galleries, projects and before-and-after proof.' },
    { title: 'Grow with Premium Tools', hint: 'Optional research and usage-based extras — clearly marked.' },
    { title: 'Partner Favourites', hint: 'Features partners install for most new client sites.' },
    { title: 'Easy Wins for Existing Websites', hint: 'Small additions that lift a live site this week.' },
    { title: 'Start a Local Business Website', hint: 'A practical stack for suburbs, services and enquiries.' }
  ];

  function accessForFeature(f) {
    var Acc = window.LPMarketplaceAccess;
    if (!Acc) return { short: 'Included', long: 'Included with your LeadPages website', type: 'included' };
    var type = Acc.accessForSection(f.section_key || f.slug);
    if (f.badge && /premium/i.test(f.badge)) type = 'premium_subscription';
    if (f.badge && /api|connect/i.test(f.badge)) type = 'requires_connection';
    return {
      type: type,
      short: Acc.publicLabel(type, 'short'),
      long: Acc.publicLabel(type, 'long')
    };
  }

  function matchesGoal(f, goalId) {
    if (!goalId || goalId === 'all') return true;
    var g = GOALS.find(function (x) { return x.id === goalId; });
    if (!g) return true;
    var hay = ((f.name || '') + ' ' + (f.tagline || '') + ' ' + (f.summary || '') + ' ' + (f.slug || '')).toLowerCase();
    return g.cats.some(function (c) { return hay.indexOf(c) >= 0; });
  }

  function matchesAccess(f, accessId) {
    if (!accessId || accessId === 'all') return true;
    return accessForFeature(f).type === accessId;
  }

  function enhanceHero() {
    var hero = document.querySelector('header.hero');
    if (!hero) return;
    hero.innerHTML = '<div class="wrap">'
      + '<span class="eyebrow">The LeadPages Marketplace</span>'
      + '<h1>See what your website could do.</h1>'
      + '<p>Explore the features available inside LeadPages. Start with real business examples, try the same editor used in the platform and see how easily each section can become your own.</p>'
      + '<p class="mp-commercial">Many apps are included with your website. Premium and usage-based tools are clearly marked before you add them.</p>'
      + '<div class="mp-hero-cta">'
      + '<a class="btn" href="#mp-catalog">Explore the marketplace</a>'
      + '<a class="btn ghost" href="/#how">See how LeadPages works</a>'
      + '</div></div>';
  }

  function enhanceBand() {
    var band = document.querySelector('section.band');
    if (!band) return;
    band.innerHTML = '<h2>Imagine these already built into your website.</h2>'
      + '<p>LeadPages gives you practical website features, real business examples and an editor designed for people who want to build attractive websites without learning code.</p>'
      + '<p class="mp-commercial">Many apps are included. Premium and usage-based tools are clearly marked before you use them.</p>'
      + '<div class="mp-hero-cta" style="justify-content:center">'
      + '<a class="btn" href="/start-your-business">Build my LeadPages website</a>'
      + '<a class="btn ghost" href="/partners">Become a LeadPages partner</a>'
      + '</div>';
  }

  function injectCollections() {
    var main = document.querySelector('main .wrap');
    if (!main || document.getElementById('mp-collections')) return;
    var el = document.createElement('section');
    el.id = 'mp-collections';
    el.className = 'mp-collections';
    el.setAttribute('aria-label', 'Curated collections');
    el.innerHTML = '<div class="mp-collections-head"><span class="eyebrow">Collections</span>'
      + '<h2>Start with a direction, not a blank page.</h2>'
      + '<p>Curated groups for first-time builders, trades, hospitality and partners.</p></div>'
      + '<div class="mp-collections-grid">'
      + COLLECTIONS.map(function (c) {
        return '<article class="mp-collection-card"><h3>' + esc(c.title) + '</h3><p>' + esc(c.hint) + '</p></article>';
      }).join('')
      + '</div>';
    main.insertBefore(el, main.firstChild);
  }

  function installV2Renderer() {
    var pills = document.getElementById('pills');
    var grid = document.getElementById('grid');
    var status = document.getElementById('status');
    if (!pills || !grid || !status) return;

    var mainWrap = document.querySelector('main .wrap');
    if (mainWrap) mainWrap.id = 'mp-catalog';

    var state = { cats: [], feats: [], cat: 'all', goal: 'all', access: 'all' };

    var filterBar = document.createElement('div');
    filterBar.className = 'mp-filters';
    filterBar.innerHTML = '<div class="mp-filter-block"><span class="mp-filter-label" id="mp-goal-label">Browse by goal</span>'
      + '<div class="pills mp-goal-pills" id="mp-goals" role="tablist" aria-labelledby="mp-goal-label"></div></div>'
      + '<div class="mp-filter-block"><span class="mp-filter-label" id="mp-access-label">Access</span>'
      + '<div class="pills mp-access-pills" id="mp-access" role="tablist" aria-labelledby="mp-access-label"></div></div>';
    pills.parentNode.insertBefore(filterBar, pills);
    pills.setAttribute('aria-label', 'Filter by category');

    function renderGoalPills() {
      var box = document.getElementById('mp-goals');
      if (!box) return;
      var html = '<button type="button" class="pill' + (state.goal === 'all' ? ' on' : '') + '" data-goal="all" role="tab" aria-selected="' + (state.goal === 'all') + '">All goals</button>';
      GOALS.forEach(function (g) {
        html += '<button type="button" class="pill' + (state.goal === g.id ? ' on' : '') + '" data-goal="' + esc(g.id) + '" role="tab" aria-selected="' + (state.goal === g.id) + '">' + esc(g.label) + '</button>';
      });
      box.innerHTML = html;
    }

    function renderAccessPills() {
      var box = document.getElementById('mp-access');
      if (!box) return;
      var Acc = window.LPMarketplaceAccess;
      var types = [
        ['all', 'All'],
        ['included', Acc ? Acc.publicLabel('included') : 'Included'],
        ['free', Acc ? Acc.publicLabel('free') : 'Free'],
        ['free_limited', Acc ? Acc.publicLabel('free_limited') : 'Free with limits'],
        ['premium_subscription', Acc ? Acc.publicLabel('premium_subscription') : 'Premium'],
        ['usage_based', Acc ? Acc.publicLabel('usage_based') : 'Usage-based'],
        ['requires_connection', Acc ? Acc.publicLabel('requires_connection') : 'Connection required']
      ];
      box.innerHTML = types.map(function (t) {
        return '<button type="button" class="pill' + (state.access === t[0] ? ' on' : '') + '" data-access="' + esc(t[0]) + '" role="tab" aria-selected="' + (state.access === t[0]) + '">' + esc(t[1]) + '</button>';
      }).join('');
    }

    function catName(id) {
      var c = state.cats.find(function (x) { return x.id === id; });
      return c ? c.name : '';
    }

    function renderPills() {
      var html = '<button type="button" class="pill' + (state.cat === 'all' ? ' on' : '') + '" data-c="all" role="tab" aria-selected="' + (state.cat === 'all') + '">All Features</button>';
      state.cats.forEach(function (c) {
        html += '<button type="button" class="pill' + (state.cat === c.id ? ' on' : '') + '" data-c="' + esc(c.id) + '" role="tab" aria-selected="' + (state.cat === c.id) + '">' + esc(c.name) + '</button>';
      });
      pills.innerHTML = html;
    }

    function renderGrid() {
      var list = state.feats.filter(function (f) {
        if (state.cat !== 'all' && f.category_id !== state.cat) return false;
        if (!matchesGoal(f, state.goal)) return false;
        if (!matchesAccess(f, state.access)) return false;
        return true;
      });
      if (!list.length) {
        grid.innerHTML = '';
        status.style.display = 'block';
        status.textContent = 'Nothing matches these filters yet — try another goal or category.';
        return;
      }
      status.style.display = 'none';
      grid.innerHTML = list.map(function (f, idx) {
        var acc = accessForFeature(f);
        var wide = idx % 7 === 0 ? ' mp-card-wide' : '';
        var thumb = f.hero_image_url
          ? '<div class="fthumb"><img src="' + esc(f.hero_image_url) + '" alt="" loading="lazy">'
          : '<div class="fthumb fthumb-fallback" aria-hidden="true">';
        thumb += '<span class="fbadge mp-access-badge" data-access="' + esc(acc.type) + '">' + esc(acc.short) + '</span></div>';
        return '<a class="fcard mp-card' + wide + '" href="/marketplace/' + esc(f.slug) + '?v2=1">'
          + thumb
          + '<div class="fbody">'
          + '<span class="fcat">' + esc(catName(f.category_id)) + '</span>'
          + '<h3>' + esc(f.name) + '</h3>'
          + (f.summary ? '<p class="fsum">' + esc(f.summary) + '</p>' : (f.tagline ? '<p class="fsum">' + esc(f.tagline) + '</p>' : ''))
          + '<span class="mp-card-meta">' + esc(acc.long) + '</span>'
          + '<span class="fdemo">Explore this feature →</span>'
          + '</div></a>';
      }).join('');
    }

    pills.addEventListener('click', function (e) {
      var b = e.target.closest('.pill'); if (!b) return;
      state.cat = b.getAttribute('data-c');
      renderPills();
      renderGrid();
    });
    document.getElementById('mp-goals').addEventListener('click', function (e) {
      var b = e.target.closest('.pill'); if (!b) return;
      state.goal = b.getAttribute('data-goal');
      renderGoalPills();
      renderGrid();
    });
    document.getElementById('mp-access').addEventListener('click', function (e) {
      var b = e.target.closest('.pill'); if (!b) return;
      state.access = b.getAttribute('data-access');
      renderAccessPills();
      renderGrid();
    });

    // Replace default fetch behaviour by intercepting after load
    var origFetch = window.fetch;
    // Re-bind after catalog loads: observe grid population, then re-fetch for V2
    fetch('/api/catalog').then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.categories) {
        status.textContent = 'The marketplace could not load. Please refresh to try again.';
        return;
      }
      state.cats = j.categories;
      state.feats = j.features || [];
      renderGoalPills();
      renderAccessPills();
      renderPills();
      renderGrid();
    }).catch(function () {
      status.textContent = 'The marketplace could not load. Please refresh to try again.';
    });

    // Prevent double-render from inline script if it runs later — clear its listeners by cloning pills
    void origFetch;
  }

  function addV2Styles() {
    if (document.getElementById('mp-v2-style')) return;
    var s = document.createElement('style');
    s.id = 'mp-v2-style';
    s.textContent = [
      '.mp-commercial{color:var(--theme-accent,#D9A0AC);font-size:15px;max-width:56ch;margin:16px auto 0}',
      'header.hero .mp-commercial{color:#D9A0AC}',
      '.mp-hero-cta{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:26px}',
      '.mp-hero-cta .btn{display:inline-flex;font-weight:700;padding:14px 28px;border-radius:999px;background:var(--theme-primary,var(--rose));color:var(--theme-primary-contrast,#fff);border:2px solid transparent}',
      '.mp-hero-cta .btn:hover{background:var(--theme-primary-hover,var(--rose-d))}',
      '.mp-hero-cta .btn.ghost{background:transparent;border-color:currentColor;color:inherit}',
      '.mp-hero-cta .btn.ghost:hover{background:rgba(255,255,255,.08)}',
      'section.band .mp-hero-cta .btn.ghost{border-color:var(--theme-text,var(--ink));color:var(--theme-text,var(--ink))}',
      'section.band .mp-hero-cta .btn.ghost:hover{background:var(--theme-text,var(--ink));color:var(--theme-page-background,var(--paper))}',
      '.mp-filters{margin-top:8px}',
      '.mp-filter-block{margin:18px 0}',
      '.mp-filter-label{display:block;font-size:12.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--theme-text-muted,var(--mut));margin-bottom:10px;text-align:center}',
      '.mp-collections{margin:8px 0 34px}',
      '.mp-collections-head{text-align:center;margin-bottom:22px}',
      '.mp-collections-head h2{font-size:clamp(26px,3.4vw,36px);margin:8px 0 10px}',
      '.mp-collections-head p{color:var(--theme-text-muted,var(--mut));max-width:52ch;margin:0 auto}',
      '.mp-collections-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}',
      '@media(max-width:1100px){.mp-collections-grid{grid-template-columns:repeat(3,1fr)}}',
      '@media(max-width:700px){.mp-collections-grid{grid-template-columns:1fr 1fr}}',
      '@media(max-width:480px){.mp-collections-grid{grid-template-columns:1fr}}',
      '.mp-collection-card{background:var(--theme-surface,#fff);border:1px solid var(--theme-border,var(--line));border-radius:var(--theme-radius-medium,16px);padding:18px 16px}',
      '.mp-collection-card h3{font-family:var(--theme-heading-font,var(--disp));font-size:18px;margin-bottom:8px}',
      '.mp-collection-card p{color:var(--theme-text-muted,var(--mut));font-size:14px}',
      '.grid{grid-template-columns:repeat(3,1fr)}',
      '.mp-card-wide{grid-column:span 2}',
      '@media(max-width:960px){.mp-card-wide{grid-column:span 1}}',
      '.mp-card-meta{font-size:13px;font-weight:600;color:var(--theme-text-muted,var(--mut))}',
      '.fthumb-fallback{background:linear-gradient(135deg,var(--theme-surface-alt,var(--shell)),var(--theme-border,var(--line)))}',
      '.mp-access-badge{background:var(--theme-secondary,var(--gum))}',
      '.mp-access-badge[data-access="premium_subscription"],.mp-access-badge[data-access="premium_plus_usage"],.mp-access-badge[data-access="usage_based"]{background:var(--theme-primary,var(--rose))}',
      '.pill:focus-visible,.mp-hero-cta .btn:focus-visible,.fcard:focus-visible{outline:3px solid var(--theme-focus,var(--rose));outline-offset:2px}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function boot() {
    if (!v2On()) return;
    document.documentElement.setAttribute('data-mp-v2', '1');
    addV2Styles();
    enhanceHero();
    enhanceBand();
    injectCollections();
    installV2Renderer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
