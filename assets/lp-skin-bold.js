/**
 * LeadPages "Bold" design — an opt-in page design for trade/hire sites.
 *
 * Switched on per site with config.design = 'bold'. Sites without it are never touched.
 * The page is drawn from the site's existing content (hero, rates, specs, included items,
 * steps, FAQ, location, footer). Optional overrides live in config.bold:
 *
 *   bold.brand          brand colour (default theme.hivis / #CD1F21)
 *   bold.logoLight      white logo for the coloured header (default: normal logo on a white chip)
 *   bold.heroTitle      headline; "\n" starts a new line (default hero slide heading + highlight)
 *   bold.heroSub        line under the headline (default hero slide sub text)
 *   bold.heroFacts      ["…"] ticks under the headline (default hero badge titles)
 *   bold.heroImage / heroCaption
 *   bold.week           ["$150","$150","$150","$150","$220","$250","$250"]  Monday → Sunday
 *   bold.weekTitle / weekIntro / weekNotes ["…"]
 *   bold.truckTitle / truckIntro
 *   bold.specs          [{label,value}]  (default activity counter figures + text box features)
 *   bold.box            {length,width,height,lift}  cargo box drawing
 *   bold.includedTitle / stepsTitle / faqTitle / findTitle / closeTitle
 *   bold.hideReviews    true = leave the reviews out
 *
 * Runs on the server (render.js → render(cfg, {icons})) so the first paint and search
 * engines get the real page, and in the browser for the editor preview and the live
 * hire calendar (/api/bookings/hire/public?action=calendar).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LPSkinBold = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_BRAND = '#CD1F21';
  var DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function txt(v) { return String(v == null ? '' : v).trim(); }
  function on(list) { return (Array.isArray(list) ? list : []).filter(function (x) { return x && x.on !== false; }); }
  function hex(v) { return /^#[0-9a-fA-F]{6}$/.test(txt(v)) ? txt(v) : ''; }
  function url(v) { var u = txt(v); return /^(https?:)?\/\//i.test(u) || /^\/[^/]/.test(u) || /^data:image\//.test(u) ? u : ''; }
  function digits(v) { return txt(v).replace(/[^0-9+]/g, ''); }

  /* ------------------------------------------------------------ content */
  function model(cfg) {
    cfg = cfg || {};
    var S = cfg.sections || {};
    var B = cfg.bold || {};
    var hs = S.heroSlider || {}, slide = on(hs.slides)[0] || {};
    var hero = S.hero || {};
    var bk = S.bookingStorefront || {};
    var tb = S.textBox || {}, ac = S.activityCounter || {}, sv = S.services || {}, sp = S.serviceProcess || {};
    var fq = S.faq || {}, au = S.aboutUs || {}, so = S.specialOffer || {}, rv = S.reviews || {}, ft = S.footer || {};
    var name = txt(cfg.businessName || cfg.business || cfg.name);
    var heroTitle = txt(B.heroTitle) || [txt(slide.heading || hero.title), txt(slide.highlightText || hero.titleHl)].filter(Boolean).join(' ') || name;
    var specs = Array.isArray(B.specs) && B.specs.length ? B.specs.filter(function (x) { return x && (txt(x.label) || txt(x.value)); }) : null;
    if (!specs) {
      specs = (ac.on === true ? on(ac.stats) : []).map(function (s) { return { label: s.label, value: s.value }; });
    }
    // Text box feature ticks show when the design has no spec list of its own.
    var feats = tb.on === true && !(Array.isArray(B.specs) && B.specs.length) ? on(tb.features).map(function (f) { return txt(f.text); }).filter(Boolean) : [];
    var week = Array.isArray(B.week) && B.week.length === 7 && B.week.every(function (w) { return txt(w); }) ? B.week.map(txt) : null;
    var hours = txt(au.hours).split('\n').map(function (l) {
      var p = l.trim().split(/\s{2,}|\t/);
      return p.length > 1 ? { label: p[0], value: p.slice(1).join(' ') } : (l.trim() ? { label: '', value: l.trim() } : null);
    }).filter(Boolean);
    return {
      name: name,
      slug: txt(cfg.slug),
      brand: hex(B.brand) || hex(cfg.theme && cfg.theme.hivis) || DEFAULT_BRAND,
      logo: url(cfg.logo && cfg.logo.mode === 'image' ? cfg.logo.imageUrl : ''),
      logoLight: url(B.logoLight),
      phone: digits(cfg.phone),
      phoneText: txt(cfg.phoneText) || txt(cfg.phone),
      heroTitle: heroTitle,
      heroSub: txt(B.heroSub) || txt(slide.subText || hero.sub),
      heroFacts: (Array.isArray(B.heroFacts) ? B.heroFacts.map(txt) : on(hs.badges).map(function (b) { return txt(b.title); })).filter(Boolean).slice(0, 4),
      heroImage: url(B.heroImage) || url(slide.imageUrl),
      heroCaption: txt(B.heroCaption),
      hire: bk.on === true && bk.layout === 'hire',
      bookTitle: txt(B.bookTitle) || 'Pick your pick-up day',
      week: week,
      weekTitle: txt(B.weekTitle) || 'The price depends on the day.',
      weekIntro: txt(B.weekIntro),
      weekNotes: (Array.isArray(B.weekNotes) ? B.weekNotes : []).map(txt).filter(Boolean),
      rateCards: on(bk.rates).filter(function (r) { return txt(r.price); }),
      truckTitle: txt(B.truckTitle) || txt(tb.heading),
      truckIntro: txt(B.truckIntro) || txt(tb.intro),
      truckImage: url(tb.image),
      specs: specs,
      feats: feats,
      box: B.box && (txt(B.box.length) || txt(B.box.width) || txt(B.box.height)) ? B.box : null,
      includedTitle: txt(B.includedTitle) || txt(sv.heading),
      included: sv.on === true ? on(cfg.services).filter(function (s) { return txt(s.title); }) : [],
      stepsTitle: txt(B.stepsTitle) || txt(sp.heading),
      steps: sp.on === true ? on(sp.steps).filter(function (s) { return txt(s.title); }) : [],
      callout: sp.on === true && txt(sp.calloutTitle) ? { title: txt(sp.calloutTitle), text: txt(sp.calloutText) } : null,
      faqTitle: txt(B.faqTitle) || txt(fq.heading),
      faq: fq.on === true ? on(fq.items).filter(function (q) { return txt(q.q); }) : [],
      reviews: rv.on === true && B.hideReviews !== true ? on(rv.items).filter(function (r) { return txt(r.text); }) : [],
      reviewsTitle: txt(rv.heading) || 'What customers say',
      findTitle: txt(B.findTitle) || 'Find us.',
      address: txt(au.address),
      hours: hours,
      closeTitle: txt(B.closeTitle) || txt(so.heading) || 'Book now.',
      blurb: txt(ft.blurb)
    };
  }

  /* ------------------------------------------------------------ icons */
  var ICON_FALLBACK = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    pin: '<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>'
  };
  function svg(inner, cls) {
    return '<svg class="' + (cls || 'lpb-ic') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }
  function icon(name, icons) {
    var lib = icons || (typeof window !== 'undefined' && window.LP_ICONS) || {};
    var inner = lib[name] || ICON_FALLBACK[name] || '';
    return inner ? svg(inner) : '';
  }

  /* ------------------------------------------------------------ html */
  function headline(t) {
    // "\n" in the text starts a new line; otherwise the browser wraps it.
    return t.split('\n').map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('');
  }
  function boxFigure(b) {
    var L = esc(txt(b.length)), W = esc(txt(b.width)), H = esc(txt(b.height)), lift = esc(txt(b.lift));
    return '<svg class="lpb-box" viewBox="0 0 640 400" role="img" aria-label="Cargo box ' + [L && L + ' long', W && W + ' wide', H && H + ' high'].filter(Boolean).join(', ') + '">' +
      '<g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"><path d="M60 140 L380 140 L380 320 L60 320 Z"/><path d="M60 140 L160 80 L480 80 L380 140"/><path d="M480 80 L480 260 L380 320"/></g>' +
      '<g fill="none" stroke="currentColor" stroke-opacity=".55" stroke-width="1.5" stroke-dasharray="5 5"><path d="M60 320 L160 260 L480 260"/><path d="M160 80 L160 260"/></g>' +
      (lift ? '<path d="M380 320 L480 260 L480 300 L380 360 Z" fill="#000" opacity=".3"/>' : '') +
      '<g fill="currentColor" font-weight="800" font-size="22">' +
      (L ? '<path d="M60 350 L380 350 M60 343 v14 M380 343 v14" stroke="currentColor" stroke-width="1.5"/><text x="220" y="380" text-anchor="middle">' + L + ' long</text>' : '') +
      (H ? '<path d="M30 140 L30 320 M23 140 h14 M23 320 h14" stroke="currentColor" stroke-width="1.5"/><text x="-230" y="20" transform="rotate(-90)" text-anchor="middle">' + H + ' high</text>' : '') +
      (W ? '<path d="M398 132 L498 72" stroke="currentColor" stroke-width="1.5"/><text x="502" y="112">' + W + ' wide</text>' : '') +
      (lift ? '<text x="500" y="300" font-size="15" font-weight="700">' + lift + '</text>' : '') +
      '</g><text x="64" y="40" font-size="14" fill="currentColor" fill-opacity=".75">Box dimensions are approximate</text></svg>';
  }

  /** Days the rates apply to, from the editor rate cards ("Mon – Thu", "Friday", "Weekends & Public Holidays"). */
  function weekFromRates(cards) {
    var out = [null, null, null, null, null, null, null];
    var idx = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
    cards.forEach(function (r) {
      var l = txt(r.label).toLowerCase(), p = txt(r.price);
      if (/weekend/.test(l)) { out[5] = out[5] || p; out[6] = out[6] || p; }
      var range = l.match(/(mon|tue|wed|thu|fri|sat|sun)[a-z]*\s*[-–—to]+\s*(mon|tue|wed|thu|fri|sat|sun)/);
      if (range) { for (var i = idx[range[1]]; i <= idx[range[2]]; i++) out[i] = out[i] || p; return; }
      Object.keys(idx).forEach(function (k) { if (new RegExp('\\b' + k).test(l)) out[idx[k]] = out[idx[k]] || p; });
    });
    return out.every(Boolean) ? out : null;
  }

  function render(cfg, ctx) {
    ctx = ctx || {};
    var m = model(cfg);
    var I = function (n) { return icon(n, ctx.icons); };
    var tel = m.phone ? 'tel:' + esc(m.phone) : '';
    var week = m.week || weekFromRates(m.rateCards);
    var h = '';

    // header
    var logo = m.logoLight
      ? '<img src="' + esc(m.logoLight) + '" alt="' + esc(m.name) + '">'
      : (m.logo ? '<span class="lpb-chip"><img src="' + esc(m.logo) + '" alt="' + esc(m.name) + '"></span>' : '<strong>' + esc(m.name) + '</strong>');
    var nav = [];
    if (week) nav.push(['#lpb-rates', 'Rates']);
    if (m.truckTitle || m.specs.length) nav.push(['#lpb-truck', 'The ' + (ctx.noun || 'truck')]);
    if (m.steps.length) nav.push(['#lpb-how', 'How it works']);
    if (m.faq.length) nav.push(['#lpb-faq', 'Questions']);
    if (m.address) nav.push(['#lpb-find', 'Find us']);
    h += '<header class="lpb-top"><div class="lpb-wrap"><a class="lpb-logo" href="#lpb-top" aria-label="' + esc(m.name) + ' home">' + logo + '</a>' +
      '<nav class="lpb-nav" aria-label="Main">' + nav.map(function (n) { return '<a href="' + n[0] + '">' + esc(n[1]) + '</a>'; }).join('') + '</nav>' +
      (tel ? '<a class="lpb-phone" href="' + tel + '">' + esc(m.phoneText) + '</a>' : '') +
      '<a class="lpb-btn lpb-btn-light" href="#lpb-book">' + (m.hire ? 'Book a ' + esc(ctx.noun || 'truck') : 'Get in touch') + '</a></div></header>';

    // hero
    h += '<section class="lpb-hero" id="lpb-top"><div class="lpb-wrap">' +
      '<div class="lpb-intro"><h1 class="lpb-display">' + headline(m.heroTitle) + '</h1>' +
      (m.heroSub ? '<p class="lpb-lede">' + esc(m.heroSub) + '</p>' : '') +
      (m.heroFacts.length ? '<ul class="lpb-facts">' + m.heroFacts.map(function (f) { return '<li>' + svg(ICON_FALLBACK.check) + esc(f) + '</li>'; }).join('') + '</ul>' : '') + '</div>' +
      (m.heroImage ? '<figure class="lpb-photo"><img src="' + esc(m.heroImage) + '" alt="' + esc(m.heroCaption || m.name) + '">' + (m.heroCaption ? '<figcaption>' + esc(m.heroCaption) + '</figcaption>' : '') + '</figure>' : '') +
      '<aside class="lpb-book" id="lpb-book" aria-labelledby="lpb-book-h"><h2 id="lpb-book-h">' + esc(m.bookTitle) + '</h2>' +
      '<p class="lpb-sub" data-lpb="book-sub">' + (week ? 'Each day shows its price.' : '') + '</p>' +
      '<div class="lpb-cal" data-lpb="cal"' + (week ? ' data-week="' + esc(JSON.stringify(week)) + '"' : '') + '>' + calendarShell() + '</div>' +
      '<div class="lpb-pick" data-lpb="pick" hidden><label>Pick-up time<select data-lpb="time"></select></label><label>How long<select data-lpb="len"></select></label></div>' +
      '<div class="lpb-quote"><span data-lpb="qwhen">Choose a day</span><b data-lpb="qamt"></b></div>' +
      '<p class="lpb-left" data-lpb="left" aria-live="polite"></p>' +
      '<button type="button" class="lpb-btn lpb-btn-brand lpb-go" data-lpb="go" disabled>Choose a ' + esc(ctx.noun || 'truck') + '</button>' +
      '<p class="lpb-fine" data-lpb="fine">' + (tel ? 'Prefer to talk? Call <a href="' + tel + '">' + esc(m.phoneText) + '</a>.' : '') + '</p>' +
      '</aside></div></section>';

    // week of prices
    if (week) {
      var cls = function (i) { return week[i] === week[0] ? '' : (i >= 5 && week[i] === week[5] ? ' we' : ' mid'); };
      h += '<section class="lpb-rates" id="lpb-rates" aria-labelledby="lpb-rates-h"><div class="lpb-wrap"><div class="lpb-head">' +
        '<h2 id="lpb-rates-h" class="lpb-display lpb-h2">' + headline(m.weekTitle) + '</h2>' + (m.weekIntro ? '<p>' + esc(m.weekIntro) + '</p>' : '') + '</div>' +
        '<div class="lpb-week">' + week.map(function (p, i) {
          return '<div class="lpb-wk' + cls(i) + '"><span class="d">' + DAY_NAMES[i] + '</span><span class="amt">' + esc(p) + '</span><span class="u">per 24 hours</span></div>';
        }).join('') + '</div>' +
        (m.weekNotes.length ? '<p class="lpb-notes">' + m.weekNotes.map(function (n) { return '<span>' + esc(n) + '</span>'; }).join('') + '</p>' : '') +
        '</div></section>';
    }

    // the truck
    if (m.truckTitle || m.specs.length || m.included.length) {
      var specRows = m.specs.map(function (s) { return '<div><dt>' + esc(s.label) + '</dt><dd>' + esc(s.value) + '</dd></div>'; }).join('');
      h += '<section class="lpb-truck" id="lpb-truck" aria-labelledby="lpb-truck-h"><div class="lpb-wrap"><div class="lpb-truck-text">' +
        (m.truckTitle ? '<h2 id="lpb-truck-h" class="lpb-display lpb-h2">' + headline(m.truckTitle) + '</h2>' : '') +
        (m.truckIntro ? '<p class="lpb-lede">' + esc(m.truckIntro) + '</p>' : '') +
        (specRows ? '<dl class="lpb-specs">' + specRows + '</dl>' : '') +
        (m.feats.length ? '<ul class="lpb-feats">' + m.feats.map(function (f) { return '<li>' + svg(ICON_FALLBACK.check) + esc(f) + '</li>'; }).join('') + '</ul>' : '') + '</div>' +
        (m.box ? '<div class="lpb-fig">' + boxFigure(m.box) + '</div>' : (m.truckImage ? '<div class="lpb-fig"><img src="' + esc(m.truckImage) + '" alt=""></div>' : '')) +
        (m.included.length ? '<div class="lpb-inc"><h3 class="lpb-display">' + esc(m.includedTitle || 'Included') + '</h3><ul>' + m.included.map(function (s) {
          return '<li>' + (I(s.icon) || svg(ICON_FALLBACK.check)) + '<b>' + esc(s.title) + '</b>' + (txt(s.body) ? '<small>' + esc(s.body) + '</small>' : '') + '</li>';
        }).join('') + '</ul></div>' : '') +
        '</div></section>';
    }

    // steps
    if (m.steps.length) {
      h += '<section class="lpb-steps" id="lpb-how" aria-labelledby="lpb-how-h"><div class="lpb-wrap">' +
        (m.stepsTitle ? '<h2 id="lpb-how-h" class="lpb-display lpb-h2">' + headline(m.stepsTitle) + '</h2>' : '') +
        '<ol>' + m.steps.map(function (s, i) { return '<li><span class="num">' + (i + 1) + '</span><h3>' + esc(s.title) + '</h3>' + (txt(s.text) ? '<p>' + esc(s.text) + '</p>' : '') + '</li>'; }).join('') + '</ol>' +
        (m.callout ? '<div class="lpb-callout"><div><h3>' + esc(m.callout.title) + '</h3>' + (m.callout.text ? '<p>' + esc(m.callout.text) + '</p>' : '') + '</div>' + (tel ? '<a class="lpb-btn lpb-btn-line" href="' + tel + '">Call ' + esc(m.phoneText) + '</a>' : '') + '</div>' : '') +
        '</div></section>';
    }

    // reviews
    if (m.reviews.length) {
      h += '<section class="lpb-reviews" aria-labelledby="lpb-rv-h"><div class="lpb-wrap"><h2 id="lpb-rv-h" class="lpb-display lpb-h2">' + esc(m.reviewsTitle) + '</h2><div class="lpb-rv">' +
        m.reviews.map(function (r) { return '<figure><blockquote>' + esc(txt(r.text).replace(/^["“]|["”]$/g, '')) + '</blockquote>' + (txt(r.who) ? '<figcaption>' + esc(r.who) + '</figcaption>' : '') + '</figure>'; }).join('') +
        '</div></div></section>';
    }

    // FAQ
    if (m.faq.length) {
      h += '<section class="lpb-faq" id="lpb-faq" aria-labelledby="lpb-faq-h"><div class="lpb-wrap">' +
        '<h2 id="lpb-faq-h" class="lpb-display lpb-h2">' + headline(m.faqTitle || 'Questions') + '</h2><div>' +
        m.faq.map(function (q, i) {
          var a = txt(q.a);
          return '<details' + (i === 0 ? ' open' : '') + '><summary>' + esc(q.q) + '</summary>' +
            (a ? '<p>' + esc(a) + '</p>' : '<p class="lpb-ask">Good question — ' + (tel ? 'call us on <a href="' + tel + '">' + esc(m.phoneText) + '</a>' : 'get in touch') + ' and we’ll answer it for you.</p>') + '</details>';
        }).join('') + '</div></div></section>';
    }

    // find us
    if (m.address) {
      var q = encodeURIComponent(m.address);
      h += '<section class="lpb-find" id="lpb-find" aria-labelledby="lpb-find-h"><div class="lpb-find-in"><div class="lpb-info">' +
        '<h2 id="lpb-find-h" class="lpb-display lpb-h2">' + esc(m.findTitle) + '</h2><address>' + esc(m.address) + '</address>' +
        (m.hours.length ? '<div class="lpb-hours">' + m.hours.map(function (r) { return '<div>' + (r.label ? '<span>' + esc(r.label) + '</span>' : '') + '<b>' + esc(r.value) + '</b></div>'; }).join('') + '</div>' : '') +
        '<a class="lpb-btn lpb-btn-line" href="https://www.google.com/maps/dir/?api=1&amp;destination=' + q + '" target="_blank" rel="noopener">Get directions</a></div>' +
        '<div class="lpb-map"><iframe title="Map: ' + esc(m.address) + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=' + q + '&amp;z=15&amp;output=embed"></iframe></div></div></section>';
    }

    // close + footer
    h += '<section class="lpb-close" aria-labelledby="lpb-close-h"><div class="lpb-wrap"><h2 id="lpb-close-h" class="lpb-display">' + headline(m.closeTitle) + '</h2><div class="lpb-acts">' +
      '<a class="lpb-btn lpb-btn-light" href="#lpb-book">' + (m.hire ? 'Pick a day' : 'Get in touch') + '</a>' + (tel ? '<a class="lpb-btn lpb-btn-line" href="' + tel + '">Call ' + esc(m.phoneText) + '</a>' : '') + '</div></div></section>';
    h += '<footer class="lpb-foot"><div class="lpb-wrap"><div>' + (m.blurb ? '<p>' + esc(m.blurb) + '</p>' : '<p><b>' + esc(m.name) + '</b>' + (m.address ? ' — ' + esc(m.address) : '') + '</p>') + '</div>' +
      (tel ? '<a href="' + tel + '">' + esc(m.phoneText) + '</a>' : '') + '</div></footer>';

    // mobile actions
    h += '<nav class="lpb-mbar" aria-label="Quick actions">' + (tel ? '<a href="' + tel + '">' + svg(ICON_FALLBACK.phone) + 'Call</a>' : '') +
      (m.address ? '<a href="#lpb-find">' + svg(ICON_FALLBACK.pin) + 'Find us</a>' : '') +
      '<a class="go" href="#lpb-book">' + (m.hire ? 'Book a ' + esc(ctx.noun || 'truck') : 'Get in touch') + '</a></nav>';

    return '<div id="lpb-root" class="lpb" style="--lpb-brand:' + m.brand + '">' + h + '</div>';
  }

  function calendarShell() {
    return '<div class="lpb-mhead"><button type="button" class="lpb-mnav" data-lpb="prev" aria-label="Previous month">‹</button><strong data-lpb="mname"></strong><button type="button" class="lpb-mnav" data-lpb="next" aria-label="Next month">›</button></div>' +
      '<div class="lpb-wd" aria-hidden="true">' + DAY_SHORT.map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div>' +
      '<div class="lpb-days" data-lpb="days"></div>' +
      '<div class="lpb-legend" data-lpb="legend" hidden><span><i class="free"></i>Free</span><span><i class="few"></i>1–2 left</span><span><i class="out"></i>Booked out</span></div>';
  }

  /* ------------------------------------------------------------ browser */
  var B = {};
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    B = (function () {
      var ST = { cfg: null, cal: null, month: '', sel: '', today: '', live: false, settings: null, fetched: {} };
      function pad(n) { return (n < 10 ? '0' : '') + n; }
      function addDays(ymd, n) { var p = ymd.split('-').map(Number); var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n, 12)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
      function dow(ymd) { var p = ymd.split('-').map(Number); return (new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)).getUTCDay() + 6) % 7; } // Mon=0
      function localToday() { var d = new Date(); try { return d.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }); } catch (e) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); } }
      function money(c) { return '$' + (c / 100).toFixed(c % 100 ? 2 : 0); }
      function priceNum(s) { var n = Number(String(s || '').replace(/[^0-9.]/g, '')); return isFinite(n) && n > 0 ? Math.round(n * 100) : 0; }
      function q(sel) { var r = document.getElementById('lpb-root'); return r ? r.querySelector('[data-lpb="' + sel + '"]') : null; }
      function nice(ymd) { var p = ymd.split('-').map(Number); return DAY_SHORT[dow(ymd)] + ' ' + p[2] + ' ' + MONTHS[p[1] - 1].slice(0, 3); }
      function hm12(hm) { var p = hm.split(':').map(Number); return (p[0] % 12 || 12) + (p[1] ? ':' + pad(p[1]) : '') + (p[0] < 12 ? 'am' : 'pm'); }

      function weekPrices() {
        var el = q('cal'); if (!el) return null;
        try { return JSON.parse(el.getAttribute('data-week') || 'null'); } catch (e) { return null; }
      }
      function dayData(ymd) { return (ST.cal && ST.cal.days && ST.cal.days[ymd]) || null; }
      function priceFor(ymd) {
        var d = dayData(ymd);
        if (d && d.from_cents) return d.from_cents;
        var w = weekPrices(); return w ? priceNum(w[dow(ymd)]) : 0;
      }

      function fetchRange(from, to) {
        var key = from + '|' + to;
        if (ST.fetched[key]) return ST.fetched[key];
        ST.fetched[key] = fetch('/api/bookings/hire/public?slug=' + encodeURIComponent(ST.cfg.slug || '') + '&action=calendar&from=' + from + '&to=' + to, { credentials: 'omit' })
          .then(function (r) { return r.json(); }).then(function (j) {
            if (!j || !j.ok) return null;
            if (!ST.cal) ST.cal = { days: {} };
            Object.keys(j.days || {}).forEach(function (k) { ST.cal.days[k] = j.days[k]; });
            ST.live = !!j.live; ST.settings = j.settings || ST.settings; ST.today = j.today || ST.today; ST.total = j.fleet_total;
            return j;
          }).catch(function () { return null; });
        return ST.fetched[key];
      }

      function paintMonth() {
        var host = q('days'); if (!host) return;
        var ym = ST.month, y = Number(ym.slice(0, 4)), mo = Number(ym.slice(5, 7));
        q('mname').textContent = MONTHS[mo - 1] + ' ' + y;
        var first = ym + '-01', lead = dow(first), dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
        var html = '';
        for (var b = 0; b < lead; b++) html += '<span class="lpb-day blank"></span>';
        var minNotice = (ST.settings && ST.settings.min_notice_days) || 0;
        var firstOk = addDays(ST.today, minNotice);
        for (var d = 1; d <= dim; d++) {
          var ymd = ym + '-' + pad(d), past = ymd < firstOk, dd = dayData(ymd), price = priceFor(ymd);
          var cls = 'lpb-day', state = '';
          if (past) cls += ' past';
          else if (ST.live && dd) {
            if (dd.closed) { cls += ' full'; state = 'Closed'; }
            else if (!dd.free) { cls += ' full'; state = 'Full'; }
            else if (dd.free <= 2) cls += ' few';
            else cls += ' free';
          }
          if (ymd === ST.sel) cls += ' sel';
          var off = past || /full/.test(cls);
          var label = nice(ymd) + (state ? ', ' + state.toLowerCase() : (price ? ', ' + money(price) : '')) + (ST.live && dd && dd.free && !off ? ', ' + dd.free + ' free' : '');
          html += '<button type="button" class="' + cls + '" data-ymd="' + ymd + '"' + (off ? ' disabled' : '') + ' aria-label="' + esc(label) + '"><span class="n">' + d + '</span>' +
            (past ? '' : '<span class="p">' + (state || (price ? money(price) : '')) + '</span>') + '<span class="l"></span></button>';
        }
        host.innerHTML = html;
        var lg = q('legend'); if (lg) lg.hidden = !ST.live;
        var prev = q('prev'); if (prev) prev.disabled = ym <= ST.today.slice(0, 7);
      }

      function fillPick() {
        var s = ST.settings || {};
        var t = q('time'), l = q('len'); if (!t || !l) return;
        if (!t.options.length) {
          var open = String(s.open_time || '07:30').split(':').map(Number), close = String(s.close_time || '17:00').split(':').map(Number), step = Number(s.time_step) || 30;
          for (var m = open[0] * 60 + (open[1] || 0); m <= close[0] * 60 + (close[1] || 0); m += step) {
            var hm = pad(Math.floor(m / 60)) + ':' + pad(m % 60);
            t.insertAdjacentHTML('beforeend', '<option value="' + hm + '">' + hm12(hm) + '</option>');
          }
          var durs = Array.isArray(s.durations) && s.durations.length ? s.durations : [{ label: '1 day (24 hours)', days: 1 }, { label: '2 days', days: 2 }, { label: '3 days', days: 3 }, { label: '1 week', days: 7 }];
          durs.forEach(function (x) { l.insertAdjacentHTML('beforeend', '<option value="' + Number(x.days) + '">' + esc(x.label) + '</option>'); });
        }
        q('pick').hidden = false;
      }

      function quote() {
        var go = q('go'), when = q('qwhen'), amt = q('qamt'), left = q('left');
        if (!ST.sel) { when.textContent = 'Choose a day'; amt.textContent = ''; left.textContent = ''; if (go) go.disabled = !ST.live && go.getAttribute('data-call') !== '1'; return; }
        var n = Number((q('len') || {}).value) || 1, sum = 0, all = true;
        for (var i = 0; i < n; i++) { var p = priceFor(addDays(ST.sel, i)); if (!p) all = false; sum += p; }
        when.textContent = nice(ST.sel) + ' · ' + (n === 1 ? '1 day' : n === 7 ? '1 week' : n + ' days');
        amt.textContent = sum && all ? (ST.cal && dayData(ST.sel) && dayData(ST.sel).from_cents ? 'from ' : '') + money(sum) : '';
        var dd = dayData(ST.sel);
        left.textContent = ST.live && dd && dd.free && dd.free <= 2 ? (dd.free === 1 ? 'Only 1' : 'Only ' + dd.free) + (ST.total ? ' of ' + ST.total : '') + ' left that day.' : '';
        if (go) go.disabled = !ST.live && go.getAttribute('data-call') !== '1';
      }

      function setLiveState() {
        var sub = q('book-sub'), go = q('go'), fine = q('fine');
        if (ST.live) {
          if (sub) sub.textContent = 'Each day shows its price. The dot shows whether ' + ((ST.settings && ST.settings.terms && ST.settings.terms.plural) || 'trucks').toLowerCase() + ' are free.';
          fillPick();
        } else if (go) {
          go.textContent = 'Call to book';
          go.disabled = false;
          go.setAttribute('data-call', '1');
          if (fine) fine.textContent = 'Online booking opens soon.';
        }
      }

      function month(ym) {
        ST.month = ym;
        var y = Number(ym.slice(0, 4)), mo = Number(ym.slice(5, 7));
        var from = ym + '-01', to = ym + '-' + pad(new Date(Date.UTC(y, mo, 0)).getUTCDate());
        if (from < ST.today) from = ST.today;
        paintMonth();
        if (!ST.cfg.slug || !ST.hire) return;
        var host = q('days'); if (host) host.classList.add('loading');
        fetchRange(from, to).then(function () {
          var h2 = q('days'); if (h2) h2.classList.remove('loading');
          setLiveState(); paintMonth(); quote();
        });
      }

      function loadFlow() {
        if (window.LPBookingFlow) return Promise.resolve(window.LPBookingFlow);
        return new Promise(function (resolve) {
          if (!document.querySelector('link[href^="/assets/lp-booking-hire.css"]')) {
            var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/assets/lp-booking-hire.css?v=2'; document.head.appendChild(l);
          }
          var ex = document.querySelector('script[src^="/assets/lp-booking-flow.js"]');
          var s = ex || document.createElement('script');
          var done = function () { resolve(window.LPBookingFlow || null); };
          if (ex) { if (window.LPBookingFlow) done(); else ex.addEventListener('load', done); return; }
          s.src = '/assets/lp-booking-flow.js?v=1'; s.async = true; s.onload = done; s.onerror = done; document.body.appendChild(s);
        });
      }

      function onClick(e) {
        var root = document.getElementById('lpb-root'); if (!root || !root.contains(e.target)) return;
        var t = e.target;
        var day = t.closest('.lpb-day[data-ymd]');
        if (day && !day.disabled) { ST.sel = day.getAttribute('data-ymd'); paintMonth(); quote(); return; }
        if (t.closest('[data-lpb="prev"]')) { var p = ST.month.split('-').map(Number); month(p[1] === 1 ? (p[0] - 1) + '-12' : p[0] + '-' + pad(p[1] - 1)); return; }
        if (t.closest('[data-lpb="next"]')) { var n = ST.month.split('-').map(Number); month(n[1] === 12 ? (n[0] + 1) + '-01' : n[0] + '-' + pad(n[1] + 1)); return; }
        var go = t.closest('[data-lpb="go"]');
        if (go) {
          var m = model(ST.cfg);
          if (go.getAttribute('data-call') === '1' || !ST.live) { if (m.phone) location.href = 'tel:' + m.phone; return; }
          go.disabled = true;
          loadFlow().then(function (F) {
            go.disabled = false;
            if (!F) { if (m.phone) location.href = 'tel:' + m.phone; return; }
            F.load(ST.cfg.slug).then(function () {
              F.open({ date: ST.sel, time: (q('time') || {}).value, days: Number((q('len') || {}).value) || 1, accent: m.brand });
            });
          });
        }
      }
      function onChange(e) {
        var root = document.getElementById('lpb-root'); if (!root || !root.contains(e.target)) return;
        if (e.target.getAttribute('data-lpb') === 'len' || e.target.getAttribute('data-lpb') === 'time') quote();
      }

      function mount(cfg) {
        ST.cfg = cfg || {};
        var want = ST.cfg.design === 'bold';
        var html = document.documentElement;
        var root = document.getElementById('lpb-root');
        if (!want) { if (root) root.parentNode.removeChild(root); html.classList.remove('lpb-on'); return; }
        var fresh = render(ST.cfg, { icons: window.LP_ICONS, noun: nounOf(ST.cfg) });
        if (root) root.outerHTML = fresh; else document.body.insertAdjacentHTML('afterbegin', fresh);
        html.classList.add('lpb-on');
        ST.hire = model(ST.cfg).hire;
        ST.today = ST.today || localToday();
        ST.sel = ''; ST.fetched = {};
        month(ST.today.slice(0, 7));
        quote();
      }
      function nounOf(cfg) { return txt(cfg && cfg.bold && cfg.bold.noun) || 'truck'; }

      function bind() {
        if (bind.done) return; bind.done = true;
        document.addEventListener('click', onClick);
        document.addEventListener('change', onChange);
        var o = window.__applyTradeConfig;
        if (typeof o === 'function' && !o.__lpbWrapped) {
          var w = function (cfg) {
            var r, err = null;
            try { r = o.apply(this, arguments); } catch (x) { err = x; }
            try { mount(cfg); } catch (x2) {}
            if (err) throw err;
            return r;
          };
          w.__lpbWrapped = true; w.__lplWrapped = o.__lplWrapped;
          window.__applyTradeConfig = w;
        }
      }
      function init() {
        var cfg = window.__lpLiveCfg || (typeof SITE_CONFIG !== 'undefined' ? SITE_CONFIG : null); // eslint-disable-line no-undef
        bind();
        if (cfg) mount(cfg);
      }
      if (document.readyState !== 'loading') init(); else document.addEventListener('DOMContentLoaded', init);
      return { mount: mount };
    })();
  }

  return { render: render, model: model, weekFromRates: weekFromRates, mount: B.mount };
});
