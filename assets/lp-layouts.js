/**
 * LeadPages layouts v2 — extra, opt-in layouts for existing trade-template apps.
 *
 * Runs after the template's own hydration (initial load + every editor preview
 * apply via a __applyTradeConfig wrapper, same pattern as the Instagram feeds).
 * Every layout here is OFF unless its config key is set, so existing sites render
 * exactly as before. All injected nodes carry data-lpl="…" and are removed and
 * rebuilt on each run, so it is safe to run repeatedly.
 *
 * Config keys (all optional):
 *   sections.heroSlider.badges[{icon,title,text,on}]   icon row under the sub-headline
 *   sections.heroSlider.textCase = 'normal'            headline as typed (not uppercase)
 *   sections.services.mode = 'tick'                    image + title + tick cards
 *   sections.services.tickTheme = 'dark'|'light'       band colour for tick cards (default dark)
 *   sections.activityCounter.style = 'strip'           compact icon + figure strip
 *   sections.textBox.features[{icon,text,on}]          two-column icon list
 *   sections.textBox.ctaLabel / ctaHref                outline button under the text
 *   sections.textBox.eyebrowStyle = 'tag'              eyebrow as a solid label
 *   sections.reviews.summaryRating / summaryText / summaryCtaLabel / summaryCtaHref
 *                                                      rating + "view all" in the heading row
 *   sections.reviews.theme = 'dark'                    dark band, white cards
 *   sections.reviews.badge = 'google'                  Google "G" on each card
 *   sections.aboutUs.layout = 'location'               address / hours / map / photo
 *     (+ address, hours, mapQuery, features[{icon,text}], ctaLabel, image)
 *   sections.specialOffer.layout = 'banner'            photo banner (+ bgImage, ctaHref, points[].icon)
 *   sections.serviceProcess.sideImage                  photo beside the steps
 *   sections.serviceProcess.calloutTitle / calloutText / calloutLinkLabel / calloutLinkHref / calloutIcon
 *                                                      card over that photo
 *   sections.faq.columns = 2                           two-column questions
 *   sections.faq.ctaLabel / ctaHref                    "view all" button (no link = opens every answer)
 *   sections.faq.emptyAnswer                           line shown for a question with no answer
 */
(function () {
  'use strict';

  var LAST = null;
  var BOUND = false;

  function cfgOf() {
    return LAST || window.__lpLiveCfg || ((typeof SITE_CONFIG !== 'undefined') ? SITE_CONFIG : null);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function txt(v) { return String(v == null ? '' : v).trim(); }
  /** LeadPages icon name → inline SVG; a short emoji / symbol typed in the editor is shown as text. */
  function icon(name, cls) {
    var p = name && window.LP_ICONS && window.LP_ICONS[name];
    if (!p) {
      var t = txt(name);
      return (t && t.length <= 4 && !/^[a-z0-9-]+$/i.test(t)) ? '<span class="lp-ic lpl-emo" aria-hidden="true">' + esc(t) + '</span>' : '';
    }
    return '<svg class="lp-ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }
  var CHECK = '<svg class="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  var ARROW = '<svg class="lp-ic lpl-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
  var GOOGLE_G = '<svg class="lpl-g" viewBox="0 0 48 48" aria-label="Google"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

  function sec(id) { return document.querySelector('[data-sec="' + id + '"]'); }
  function clear(root, key) {
    if (!root) return;
    var old = root.querySelectorAll('[data-lpl="' + key + '"]');
    for (var i = 0; i < old.length; i++) { if (old[i].parentNode) old[i].parentNode.removeChild(old[i]); }
  }
  function live(list) {
    return (Array.isArray(list) ? list : []).filter(function (it) { return it && it.on !== false; });
  }
  /** '#quote', '/page', 'https://…', 'tel:…', 'mailto:…' pass through; a bare word becomes '#word'. */
  function hrefOf(v, fallback) {
    var s = txt(v);
    if (!s) return fallback || '#quote';
    if (/^(https?:\/\/|\/|#|tel:|mailto:)/i.test(s)) return s;
    if (/^[\w-]+$/.test(s)) return '#' + s;
    return fallback || '#quote';
  }
  function shown(id) {
    var n = sec(id);
    return !!(n && getComputedStyle(n).display !== 'none');
  }
  function bookingHref() {
    return shown('bookingStorefront') ? '#bookingStorefront' : contactHref();
  }
  /** Where an enquiry button goes when no link is set: the quote form, else the
   *  booking bar, else a phone call — never a link to a section that isn't there. */
  function contactHref() {
    if (shown('quote')) return '#quote';
    if (shown('bookingStorefront')) return '#bookingStorefront';
    var C = cfgOf() || {};
    var ph = txt(C.phone).replace(/[^0-9+]/g, '');
    return ph ? 'tel:' + ph : '#quote';
  }
  function isExternal(h) { return /^https?:\/\//i.test(h); }
  function linkAttrs(h) {
    return 'href="' + esc(h) + '"' + (isExternal(h) ? ' target="_blank" rel="noopener noreferrer"' : '');
  }
  function bgUrl(u) { return txt(u).replace(/[)\s"'<>\\]/g, ''); }

  /* ---------- Hero slider: badge row + headline case ---------- */
  function heroSlider(C) {
    var node = sec('heroSlider'); if (!node) return;
    var HS = (C.sections && C.sections.heroSlider) || {};
    node.classList.toggle('hsl-case-normal', HS.textCase === 'normal');
    clear(node, 'hb');
    var items = live(HS.badges).filter(function (b) { return txt(b.title) || txt(b.text) || txt(b.icon); });
    node.classList.toggle('hsl-has-badges', items.length > 0);
    if (!items.length) return;
    var html = '<div class="hsl-badges" data-lpl="hb">' + items.map(function (b) {
      return '<div class="hsl-badge">' + (icon(b.icon) ? '<span class="hsl-bic">' + icon(b.icon) + '</span>' : '') +
        (txt(b.title) ? '<strong>' + esc(b.title) + '</strong>' : '') +
        (txt(b.text) ? '<small>' + esc(b.text) + '</small>' : '') + '</div>';
    }).join('') + '</div>';
    var wraps = node.querySelectorAll('.hsl-slide .hsl-inner .wrap');
    for (var i = 0; i < wraps.length; i++) {
      var cta = wraps[i].querySelector('.hsl-cta');
      if (cta) cta.insertAdjacentHTML('beforebegin', html); else wraps[i].insertAdjacentHTML('beforeend', html);
    }
  }

  /* ---------- Services: tick cards ---------- */
  function services(C) {
    var node = sec('services'); if (!node) return;
    var SV = (C.sections && C.sections.services) || {};
    var on = SV.mode === 'tick';
    node.classList.toggle('svcs-tick', on);
    node.classList.toggle('svcs-tick-dark', on && SV.tickTheme !== 'light');
    if (!on) return;
    var grid = node.querySelector('.svcs'); if (!grid) return;
    var items = live(C.services).filter(function (s) { return txt(s.title) || txt(s.image); });
    grid.innerHTML = items.map(function (s) {
      var img = bgUrl(s.image);
      var media = img
        ? '<div class="svt-media"><img src="' + esc(img) + '" alt="' + esc(s.title || '') + '" loading="lazy"></div>'
        : (icon(s.icon) ? '<div class="svt-media svt-ico">' + icon(s.icon) + '</div>' : '');
      return '<div class="svc svt' + (media ? '' : ' svt-nomedia') + '">' + media +
        '<div class="svt-body">' + (txt(s.title) ? '<h3>' + esc(s.title) + '</h3>' : '') +
        (txt(s.body) ? '<p>' + esc(s.body) + '</p>' : '') +
        '<span class="svt-check">' + CHECK + '</span></div></div>';
    }).join('');
  }

  /* ---------- Activity counter: compact strip ---------- */
  function activityCounter(C) {
    var node = sec('activityCounter'); if (!node) return;
    var AC = (C.sections && C.sections.activityCounter) || {};
    var strip = AC.style === 'strip';
    node.classList.toggle('ac-strip', strip);
    var noHead = strip && !txt(AC.eyebrow) && !txt(AC.heading) && !txt(AC.intro);
    node.classList.toggle('ac-nohead', noHead);
  }

  /* ---------- Text box: icon features, button, tag eyebrow ---------- */
  function textBox(C) {
    var node = sec('textBox'); if (!node) return;
    var TB = (C.sections && C.sections.textBox) || {};
    node.classList.toggle('tbx-tag', TB.eyebrowStyle === 'tag');
    clear(node, 'tbx');
    var host = node.querySelector('.tb-text'); if (!host) return;
    var feats = live(TB.features).filter(function (f) { return txt(f.text); });
    var html = '';
    if (feats.length) {
      html += '<ul class="tbx-feats" data-lpl="tbx">' + feats.map(function (f) {
        return '<li>' + (icon(f.icon) ? '<span class="tbx-fic">' + icon(f.icon) + '</span>' : '<span class="tbx-fic tbx-dot">' + CHECK + '</span>') +
          '<span>' + esc(f.text) + '</span></li>';
      }).join('') + '</ul>';
    }
    if (txt(TB.ctaLabel)) {
      html += '<a class="lpl-btn lpl-btn-outline tbx-cta" data-lpl="tbx" ' + linkAttrs(hrefOf(TB.ctaHref, contactHref())) + '>' + esc(TB.ctaLabel) + ARROW + '</a>';
    }
    node.classList.toggle('tbx-has-feats', feats.length > 0);
    if (html) host.insertAdjacentHTML('beforeend', html);
  }

  /* ---------- Reviews: summary row, dark band, Google badge ---------- */
  function reviews(C) {
    var node = sec('reviews'); if (!node) return;
    var RV = (C.sections && C.sections.reviews) || {};
    node.classList.toggle('rv-dark', RV.theme === 'dark');
    var bg = bgUrl(RV.bgImage);
    if (RV.theme === 'dark' && bg) node.style.setProperty('--rv-dark-img', 'url("' + bg + '")');
    else node.style.removeProperty('--rv-dark-img');
    clear(node, 'rv');
    var S = { rating: RV.summaryRating, text: RV.summaryText, ctaLabel: RV.summaryCtaLabel, ctaHref: RV.summaryCtaHref };
    var head = node.querySelector('.section-head');
    // "View all" needs somewhere to go (e.g. the Google reviews page); without a link it is hidden.
    var hasBtn = !!(txt(S.ctaLabel) && txt(S.ctaHref));
    var hasSum = !!(txt(S.rating) || txt(S.text) || hasBtn);
    node.classList.toggle('rv-has-summary', hasSum);
    if (head && hasSum) {
      var stars = '';
      for (var i = 0; i < 5; i++) stars += '<span class="rv-sstar">★</span>';
      var line = [txt(S.rating), txt(S.text)].filter(Boolean).join(' ');
      head.insertAdjacentHTML('beforeend', '<div class="rv-summary" data-lpl="rv">' +
        (txt(S.rating) || txt(S.text) ? '<span class="rv-sstars" aria-hidden="true">' + stars + '</span><span class="rv-stext">' + esc(line) + '</span>' : '') +
        (hasBtn ? '<a class="lpl-btn lpl-btn-ghost rv-sbtn" ' + linkAttrs(hrefOf(S.ctaHref, '#reviews')) + '>' + esc(S.ctaLabel) + ARROW + '</a>' : '') +
        '</div>');
    }
    var cards = node.querySelectorAll('.reviews .review');
    for (var c = 0; c < cards.length; c++) {
      if (RV.badge === 'google') cards[c].insertAdjacentHTML('beforeend', '<span class="rv-gbadge" data-lpl="rv">' + GOOGLE_G + '</span>');
      if (RV.theme === 'dark') {
        var who = cards[c].querySelector('.who');
        if (who) {
          var name = txt(who.textContent).replace(/^[—–-]\s*/, '');
          if (name) who.insertAdjacentHTML('afterbegin', '<span class="rv-av" data-lpl="rv" aria-hidden="true">' + esc(name.charAt(0).toUpperCase()) + '</span>');
        }
      }
    }
  }

  /* ---------- About Us: location layout ---------- */
  function aboutUs(C) {
    var node = sec('aboutUs'); if (!node) return;
    var AU = (C.sections && C.sections.aboutUs) || {};
    var on = AU.layout === 'location';
    node.classList.toggle('au-is-location', on);
    clear(node, 'au');
    if (!on) return;
    var addr = txt(AU.address);
    var hours = txt(AU.hours);
    var q = txt(AU.mapQuery) || addr.replace(/\n+/g, ', ');
    var img = bgUrl(AU.image);
    var feats = live(AU.features).filter(function (f) { return txt(f.text); });
    var lines = function (s) { return esc(s).replace(/\n/g, '<br>'); };
    var dir = q ? 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(q) : '';
    var html = '<div class="wrap aul" data-lpl="au"><div class="aul-text">' +
      (txt(AU.eyebrow) ? '<span class="eyebrow aul-eyebrow">' + esc(AU.eyebrow) + '</span>' : '') +
      (txt(AU.heading) ? '<h2 class="aul-h">' + esc(AU.heading) + '</h2>' : '') +
      (addr ? '<div class="aul-row"><span class="aul-ic">' + icon('map-pin') + '</span><p>' + lines(addr) + '</p></div>' : '') +
      (hours ? '<div class="aul-row"><span class="aul-ic">' + icon('clock') + '</span><p class="aul-hours">' + lines(hours) + '</p></div>' : '') +
      (txt(AU.intro) ? '<p class="aul-intro">' + lines(AU.intro) + '</p>' : '') +
      ((txt(AU.ctaLabel) && dir) ? '<a class="lpl-btn aul-cta" ' + linkAttrs(dir) + '>' + esc(AU.ctaLabel) + ARROW + '</a>' : '') +
      '</div>' +
      (q ? '<div class="aul-map"><iframe title="Map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=' + encodeURIComponent(q) + '&z=14&output=embed"></iframe></div>' : '') +
      ((img || feats.length) ? '<div class="aul-photo"' + (img ? ' style="background-image:url(&quot;' + esc(img) + '&quot;)"' : '') + '>' +
        (feats.length ? '<ul class="aul-feats">' + feats.map(function (f) {
          return '<li><span class="aul-fic">' + (icon(f.icon) || CHECK) + '</span>' + esc(f.text) + '</li>';
        }).join('') + '</ul>' : '') + '</div>' : '') +
      '</div>';
    node.insertAdjacentHTML('afterbegin', html);
  }

  /* ---------- Special offer: photo banner ---------- */
  function specialOffer(C) {
    var node = sec('specialOffer'); if (!node) return;
    var SO = (C.sections && C.sections.specialOffer) || {};
    var on = SO.layout === 'banner';
    node.classList.toggle('so-banner', on);
    var bg = bgUrl(SO.bgImage);
    if (on && bg) node.style.setProperty('--so-bg', 'url("' + bg + '")'); else node.style.removeProperty('--so-bg');
    var cta = node.querySelector('.so-cta');
    if (cta) {
      var want = txt(SO.ctaHref) ? hrefOf(SO.ctaHref, contactHref()) : (on ? bookingHref() : '');
      if (want) cta.setAttribute('href', want);
      if (on && !cta.querySelector('.lpl-arrow')) cta.insertAdjacentHTML('beforeend', ARROW);
    }
    if (!on) return;
    var pts = node.querySelector('.so-points');
    var items = live(SO.points).filter(function (p) { return txt(p.text); });
    if (pts && items.length) {
      pts.innerHTML = items.map(function (p) {
        return '<span class="so-pt"><span class="so-pic">' + (icon(p.icon) || CHECK) + '</span>' + esc(p.text) + '</span>';
      }).join('');
    }
  }

  /* ---------- How it works: side photo + callout ---------- */
  function serviceProcess(C) {
    var node = sec('serviceProcess'); if (!node) return;
    var SP = (C.sections && C.sections.serviceProcess) || {};
    var img = bgUrl(SP.sideImage);
    var co = { title: SP.calloutTitle, text: SP.calloutText, linkLabel: SP.calloutLinkLabel, linkHref: SP.calloutLinkHref, icon: SP.calloutIcon };
    var hasCo = !!(txt(co.title) || txt(co.text));
    node.classList.toggle('sp-has-side', !!img);
    clear(node, 'sp');
    if (!img) return;
    var wrap = node.querySelector('.wrap'); if (!wrap) return;
    wrap.insertAdjacentHTML('beforeend', '<div class="sp-side" data-lpl="sp"><img src="' + esc(img) + '" alt="" loading="lazy">' +
      (hasCo ? '<div class="sp-callout">' + (txt(co.title) ? '<strong>' + esc(co.title) + '</strong>' : '') +
        '<div class="sp-c-body">' + (icon(co.icon || 'map-pin') ? '<span class="sp-c-ic">' + icon(co.icon || 'map-pin') + '</span>' : '') +
        '<div>' + (txt(co.text) ? '<p>' + esc(co.text) + '</p>' : '') +
        (txt(co.linkLabel) ? '<a ' + linkAttrs(hrefOf(co.linkHref, contactHref())) + '>' + esc(co.linkLabel) + ARROW + '</a>' : '') +
        '</div></div></div>' : '') + '</div>');
  }

  /* ---------- FAQ: two columns + view all ---------- */
  function faq(C) {
    var node = sec('faq'); if (!node) return;
    var FQ = (C.sections && C.sections.faq) || {};
    node.classList.toggle('faq-2col', Number(FQ.columns) === 2);
    clear(node, 'fq');
    var head = node.querySelector('.section-head');
    var has = !!txt(FQ.ctaLabel);
    node.classList.toggle('faq-has-cta', has);
    if (head && has) {
      if (txt(FQ.ctaHref)) {
        head.insertAdjacentHTML('beforeend', '<a class="lpl-btn lpl-btn-outline faq-all" data-lpl="fq" ' + linkAttrs(hrefOf(FQ.ctaHref, '#faq')) + '>' + esc(FQ.ctaLabel) + ARROW + '</a>');
      } else {
        // No separate FAQ page: the button opens (and closes) every answer here.
        head.insertAdjacentHTML('beforeend', '<button type="button" class="lpl-btn lpl-btn-outline faq-all" data-lpl="fq" aria-expanded="false">' + esc(FQ.ctaLabel) + ARROW + '</button>');
        var btn = head.querySelector('button.faq-all');
        btn.addEventListener('click', function () {
          var all = node.querySelectorAll('.faq details');
          var open = btn.getAttribute('aria-expanded') !== 'true';
          for (var k = 0; k < all.length; k++) { if (open) all[k].setAttribute('open', ''); else all[k].removeAttribute('open'); }
          btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
      }
    }
    // A question saved without an answer opens to a short "ask us" line instead of
    // an empty panel (two-column layout, or when sections.faq.emptyAnswer is set).
    var fb = txt(FQ.emptyAnswer);
    if (Number(FQ.columns) === 2 || fb) {
      var ph = txt(C.phone).replace(/[^0-9+]/g, '');
      var phText = txt(C.phoneText) || txt(C.phone);
      var fbHtml = fb ? esc(fb) : (ph
        ? 'Good question \u2014 call us on <a href="tel:' + esc(ph) + '">' + esc(phText) + '</a> and we\u2019ll answer it for you.'
        : 'Good question \u2014 get in touch and we\u2019ll answer it for you.');
      var ds = node.querySelectorAll('.faq details');
      for (var i = 0; i < ds.length; i++) {
        var p = ds[i].querySelector('p');
        var empty = !p || !txt(p.textContent) || p.getAttribute('data-lpl-fb') === '1';
        ds[i].classList.toggle('faq-noans', empty);
        if (!empty) continue;
        if (!p) { p = document.createElement('p'); ds[i].appendChild(p); }
        p.setAttribute('data-lpl-fb', '1');
        p.innerHTML = fbHtml;
      }
    }
  }

  /** Bookings hire bar: render.js loads it for saved sites; this loads it in the editor
   *  preview when the layout is switched to 'hire' before the page has been re-rendered. */
  function bookingHire(C) {
    var S = C.sections && C.sections.bookingStorefront;
    if (!S || S.layout !== 'hire' || S.on !== true) return;
    if (document.querySelector('script[src^="/assets/lp-booking-hire.js"]')) return;
    if (!document.querySelector('link[href^="/assets/lp-booking-hire.css"]')) {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/assets/lp-booking-hire.css?v=2';
      document.head.appendChild(l);
    }
    window.__lpBkhCfg = C;
    var s = document.createElement('script'); s.src = '/assets/lp-booking-hire.js?v=2'; s.async = true;
    document.body.appendChild(s);
  }

  var STEPS = [heroSlider, services, activityCounter, textBox, reviews, aboutUs, specialOffer, serviceProcess, faq, bookingHire];

  function run(cfg) {
    if (cfg) LAST = cfg;
    var C = cfgOf();
    if (!C) return;
    for (var i = 0; i < STEPS.length; i++) {
      try { STEPS[i](C); } catch (e) { try { console.warn('[lp-layouts]', STEPS[i].name, e && e.message); } catch (_x) {} }
    }
  }

  function bind() {
    if (BOUND) return;
    var o = window.__applyTradeConfig;
    if (typeof o === 'function' && !o.__lplWrapped) {
      var w = function (cfg) {
        var r, err = null;
        try { r = o.apply(this, arguments); } catch (e) { err = e; }
        try { run(cfg); } catch (e) {}
        if (err) throw err;
        return r;
      };
      w.__lplWrapped = true;
      window.__applyTradeConfig = w;
      BOUND = true;
    }
  }

  window.__lpLayoutsRun = run;
  function init() { bind(); run(); }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
  setTimeout(bind, 0);
  // Other scripts (About Us, IG feeds) finish after load; run once more so our
  // nodes sit on top of their final markup.
  window.addEventListener('load', function () { setTimeout(function () { run(); }, 50); });
})();
