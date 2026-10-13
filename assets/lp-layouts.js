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
 *   sections.heroSlider.textCase = 'normal'|'lower'|'upper'  headline as typed / lowercase / capitals
 *   sections.{heroSlider,hero,splitHero}.eyebrowCase = 'normal'|'lower'   eyebrow as typed / lowercase
 *   sections.{heroSlider,hero,splitHero}.eyebrowPos = 'below'          eyebrow under the headline
 *   sections.{hero,splitHero}.textCase                   same headline case options as the slider
 *   sections.header.btnShape = 'rect' / btnArrow = true  header button: square outline + arrow
 *   sections.navMenu.textStyle = 'caps'                  menu links in small spaced capitals
 *   logo.tint / sections.footer.logoTint = '#rrggbb'     paint an image logo one colour (keeps its transparency)
 *   sections.serviceProcess.steps[].image                step image instead of its icon
 *   sections.heroSlider.layout = 'half'                  half-height banner: eyebrow + title only
 *   buttonShape = 'square'|'rounded'|'pill'              every button on the site (Branding default)
 *   sections.<app>.btnShape / sections.header.btnShape   one app's buttons (overrides the default)
 *   sections.footer.layout = 'minimal'                   logo | text, right: LeadPages logo / button / nothing
 *     (+ minimalText, minimalRight 'button'|'none', minimalBtnLabel, minimalBtnHref)
 *   sections.orderStorefront.layout = 'editorial'        Order shop editorial look (lp-order-storefront.js)
 *     (+ stepImageSize px — scaled by iconScale; default follows the number size —
 *      stepImageTint '#rrggbb' paints transparent images one colour)
 *   sections.services.mode = 'story'                     eyebrow, heading, text and link beside a photo
 *     (+ storyImage, storyLinkLabel, storyLinkHref, storyTone soft|tint|dark, storySide 'left')
 *   sections.serviceProcess.layout = 'journey'           heading + link left, icon steps with arrows right
 *     (+ journeyTone soft|tint|dark; link = calloutLinkLabel / calloutLinkHref)
 *   sections.featuredProjects.layout = 'cards'           photo cards: title + arrow, short text
 *     (+ projects[].link makes the whole card a link)
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
 *
 * Apps drawn entirely here (empty <section> placeholders in the template):
 *   sections.mapHours  — Map & Hours: eyebrow, heading, intro, address, mapQuery (pin "lat,lng"
 *                        from the editor's address lookup), mapZoom, rows[{label,value}],
 *                        showPhone, ctaLabel (directions), mapSide 'left', tone 'dark',
 *                        addressTitle / hoursTitle / phoneTitle
 *   sections.ctaBanner — CTA Banner: eyebrow, heading, text, tone brand|dark|light|photo,
 *                        bgImage, align 'center', btn1/btn2 Label + Action
 *                        (booking|call|quote|section|link) + Target (section) / Url (link)
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
    if (/^\/(?!\/)/.test(s)) return withBase(s);
    if (/^(https?:\/\/|\/|#|tel:|mailto:)/i.test(s)) return s;
    if (/^[\w-]+$/.test(s)) return '#' + s;
    return fallback || '#quote';
  }
  /** The site's own path prefix ("/griffithbutchery" on the LeadPages address, "" on a custom
   *  domain) — the template's _siteBase(), same as the menu uses. */
  function siteBase() {
    // Mirrors the template's _siteBase(): the current path, minus a trailing landing-page slug
    // (or the built-in /order and /orders pages).
    try {
      var path = location.pathname.replace(/\/+$/, '');
      var seg = (path.split('/').pop() || '').toLowerCase();
      var C = cfgOf() || {};
      var pages = Array.isArray(C.pages) ? C.pages : [];
      var onPage = seg === 'order' || seg === 'orders' || pages.some(function (p) { return p && String(p.slug || '').toLowerCase() === seg; });
      return (onPage ? path.slice(0, path.length - seg.length) : path).replace(/\/+$/, '');
    } catch (e) { return ''; }
  }
  /** "/page" → "<site base>/page" (left alone when it already starts with the base). */
  function withBase(path) {
    var b = siteBase();
    if (!b || path === b || path.indexOf(b + '/') === 0) return path;
    return (b + '/' + path.replace(/^\/+/, '')).replace(/\/{2,}/g, '/');
  }
  /** Link to the Order shop page, opened on one category (by slug or name). */
  function orderCatHref(cat) {
    var c = txt(cat);
    return withBase('/order') + (c ? '?cat=' + encodeURIComponent(c) : '');
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
    node.classList.toggle('hsl-half', HS.layout === 'half');
    // Half banner: choose which text shows (eyebrow, title and intro all on by default).
    var half = HS.layout === 'half';
    node.classList.toggle('hsl-half-noeb', half && HS.halfEyebrow === false);
    node.classList.toggle('hsl-half-noh', half && HS.halfTitle === false);
    node.classList.toggle('hsl-half-intro', half && HS.halfIntro !== false);
    heroText(node, HS, '.hsl-h', '.hsl-eyebrow');
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


  /* ---------- Hero text: headline / eyebrow case and eyebrow above or below ---------- */
  var CASES = { normal: 1, lower: 1, upper: 1 };
  function heroText(node, S, hSel, eSel) {
    var hc = CASES[S.textCase] ? S.textCase : '', ec = (S.eyebrowCase === 'normal' || S.eyebrowCase === 'lower') ? S.eyebrowCase : '';
    ['normal', 'lower', 'upper'].forEach(function (k) {
      node.classList.toggle('lpl-hcase-' + k, hc === k);
      node.classList.toggle('lpl-ecase-' + k, ec === k);
    });
    var below = S.eyebrowPos === 'below';
    node.classList.toggle('lpl-eb-below', below);
    var hs = node.querySelectorAll(hSel);
    for (var i = 0; i < hs.length; i++) {
      var h = hs[i], par = h.parentNode, e = null;
      for (var j = 0; j < par.children.length; j++) { if (par.children[j].matches(eSel)) { e = par.children[j]; break; } }
      if (!e) continue;
      var after = !!(h.compareDocumentPosition(e) & 4);
      if (below && !after) par.insertBefore(e, h.nextSibling);
      else if (!below && after) par.insertBefore(e, h);
    }
  }
  function heroBanners(C) {
    var S = C.sections || {};
    var h = sec('hero'); if (h) heroText(h, S.hero || {}, 'h1', '.eyebrow');
    var sp = sec('splitHero'); if (sp) heroText(sp, S.splitHero || {}, '.sph-h', '.sph-eyebrow');
  }

  /* ---------- Header button: square outline + arrow; menu in spaced capitals ---------- */
  function headerCta(C) {
    var H = (C.sections && C.sections.header) || {};
    var hc = document.getElementById('headCall');
    if (hc) {
      hc.classList.toggle('lpl-cta-rect', H.btnShape === 'rect');
      clear(hc, 'hca');
      if (H.btnArrow === true) hc.insertAdjacentHTML('beforeend', '<span class="lpl-cta-arrow" data-lpl="hca">' + ARROW + '</span>');
    }
    var NM = (C.sections && C.sections.navMenu) || {};
    document.documentElement.classList.toggle('lpl-nav-caps', NM.textStyle === 'caps');
  }



  /* ---------- How it works: an uploaded image per step (in place of its icon) ---------- */
  function stepImages(node, SP) {
    clear(node, 'spi');
    var vis = (Array.isArray(SP.steps) ? SP.steps : []).filter(function (st) {
      return st && st.on !== false && (txt(st.title) || txt(st.text) || txt(st.icon));
    });
    var els = node.querySelectorAll('.sp-steps > .sp-step');
    // Step images follow "Number & icon size": by default they're a multiple of the number
    // badge size (CSS), and a chosen image size is scaled by the same slider.
    var px = parseInt(SP.stepImageSize, 10);
    var sc = parseInt(SP.iconScale, 10); if (isNaN(sc)) sc = 100; sc = Math.max(50, Math.min(250, sc));
    if (px >= 24 && px <= 240) node.style.setProperty('--sp-img-size', Math.round(px * sc / 100) + 'px'); else node.style.removeProperty('--sp-img-size');
    var tint = hexOk(SP.stepImageTint);
    for (var i = 0; i < els.length; i++) {
      var u = bgUrl(vis[i] && vis[i].image);
      els[i].classList.toggle('sp-has-img', !!u);
      if (!u) continue;
      var media = els[i].querySelector('.sp-media');
      if (!media) { els[i].insertAdjacentHTML('afterbegin', '<div class="sp-media" data-lpl="spi"></div>'); media = els[i].querySelector('.sp-media'); }
      media.insertAdjacentHTML('beforeend', '<div class="sp-img" data-lpl="spi"><img src="' + esc(u) + '" alt="' + esc((vis[i] && vis[i].title) || '') + '" loading="lazy"' + (tint ? ' class="lpl-tint-s"' : '') + '></div>');
    }
  }


  /* ---------- Button corners: a site default (Branding) and per-app overrides ---------- */
  var BTN_RADIUS = { square: '0px', rounded: '10px', pill: '999px' };
  function setShape(el, key) {
    if (!el) return;
    var r = BTN_RADIUS[key];
    el.classList.toggle('lpl-btn-own', !!r);
    if (r) el.style.setProperty('--lp-btn-radius', r); else el.style.removeProperty('--lp-btn-radius');
  }
  function buttonShapes(C) {
    var root = document.documentElement, g = BTN_RADIUS[C.buttonShape];
    root.classList.toggle('lpl-btn-shape', !!g);
    if (g) root.style.setProperty('--lp-btn-radius', g); else root.style.removeProperty('--lp-btn-radius');
    var S = C.sections || {};
    var secs = document.querySelectorAll('[data-sec]');
    for (var i = 0; i < secs.length; i++) {
      var id = secs[i].getAttribute('data-sec');
      setShape(secs[i], S[id] && S[id].btnShape);
    }
    setShape(document.querySelector('header.site'), S.header && S.header.btnShape);
  }

  /* ---------- Footer: minimal bar (logo | text, LeadPages logo / button / nothing) ---------- */
  function minimalFooter(C) {
    var ft = document.querySelector('footer.site[data-sec="footer"], footer[data-sec="footer"]');
    var F = (C.sections && C.sections.footer) || {};
    var on = !!ft && F.layout === 'minimal';
    document.documentElement.classList.remove('lpl-ftm-lp');
    if (!ft) return;
    ft.classList.toggle('ftm-on', on);
    clear(ft, 'ftm');
    if (!on) return;
    var right = F.minimalRight === 'button' || F.minimalRight === 'none' ? F.minimalRight : 'leadpages';
    var wrap = ft.querySelector('.wrap-wide') || ft;
    var brand = ft.querySelector('.footer-top .foot-logo-link, .footer-top .brand');
    var logo = brand ? brand.cloneNode(true) : null;
    var text = txt(F.minimalText);
    var html = '<div class="ftm" data-lpl="ftm"><div class="ftm-l">' + '<span class="ftm-logo"></span>' +
      (text ? '<span class="ftm-div" aria-hidden="true"></span><p class="ftm-text" data-lpe="minimalText">' + esc(text) + '</p>' : '') + '</div>';
    if (right === 'button' && txt(F.minimalBtnLabel)) {
      html += '<a class="lpl-btn lpl-btn-outline ftm-btn" data-lpe="minimalBtnLabel" ' + linkAttrs(hrefOf(F.minimalBtnHref, contactHref())) + '>' + esc(F.minimalBtnLabel) + ARROW + '</a>';
    } else if (right === 'leadpages') {
      html += '<a class="ftm-lp" href="https://www.leadpages.com.au" target="_blank" rel="noopener noreferrer" aria-label="LeadPages"><img class="lp-foot-logo" alt="LeadPages" src="/assets/leadpages-logo.svg" data-lp-logo="auto" data-lp-logo-pulse></a>';
    }
    html += '</div>';
    wrap.insertAdjacentHTML('beforeend', html);
    var slot = wrap.querySelector('[data-lpl="ftm"] .ftm-logo');
    if (slot && logo) { logo.removeAttribute('id'); slot.appendChild(logo); }
    // The LeadPages logo sits in the bar, so the usual strip underneath is not repeated.
    if (right === 'leadpages') {
      document.documentElement.classList.add('lpl-ftm-lp');
      ftmLeadPagesLogo(ft, wrap.querySelector('[data-lpl="ftm"] .ftm-lp'), C);
    }
  }

  /* The LeadPages logo in the minimal footer uses the LeadPages footer settings (feature
     colour, logo text colour, size) and keeps its animated pulse — same as the strip it replaces. */
  function bgOf(el) {
    while (el && el.nodeType === 1) {
      var m = (getComputedStyle(el).backgroundColor || '').match(/rgba?\(([^)]+)\)/);
      if (m) {
        var p = m[1].split(',').map(function (x) { return parseFloat(x); });
        if (p.length < 4 || p[3] > 0.5) return p;
      }
      el = el.parentElement;
    }
    return [255, 255, 255];
  }
  function ftmLeadPagesLogo(ft, host, C) {
    if (!host) return;
    var L = (C.sections && C.sections.lpFooter) || {};
    var T = C.theme || {};
    var accent = hexOk(L.accent) || hexOk(T.hivis) || hexOk(T.pipe) || '#ff6a1f';
    var rgb = bgOf(ft);
    var light = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 > 0.62;
    var ink = hexOk(L.ink) || (light ? '#13161b' : '#ffffff');
    var size = +L.size; if (!size || isNaN(size)) size = 30; size = Math.max(10, Math.min(120, size));
    var paint = function (el) {
      if (!el) return;
      el.classList.add('lp-foot-logo');
      el.setAttribute('data-lp-logo-accent', accent);
      el.setAttribute('data-lp-logo-ink', 'custom');
      el.style.setProperty('--lp-logo-accent', accent, 'important');
      el.style.setProperty('--lp-logo-ink', ink, 'important');
      el.style.height = size + 'px'; el.style.width = 'auto'; el.style.maxHeight = size + 'px';
    };
    var logo = host.querySelector('.lp-foot-logo');
    paint(logo);
    if (window.LPLogo && window.LPLogo.mountLogo) {
      try {
        window.LPLogo.mountLogo(logo, { pulse: true, ink: ink, accent: accent }).then(function (w) {
          paint(w || host.querySelector('.lp-logo-wrap, .lp-foot-logo'));
        });
      } catch (e) {}
    }
  }

  /* ---------- Order Storefront: editorial layout switch (live in the editor preview) ---------- */
  function orderLayout(C) {
    var node = sec('orderStorefront'); if (!node) return;
    var OS = (C.sections && C.sections.orderStorefront) || {};
    var ed = OS.layout === 'editorial';
    var was = node.classList.contains('os-editorial');
    node.classList.toggle('os-editorial', ed);
    var mount = node.querySelector('#lp-order-storefront');
    if (mount) {
      if (ed) mount.setAttribute('data-layout', 'editorial'); else mount.removeAttribute('data-layout');
      [['catIntro', 'data-cat-intro'], ['searchPlaceholder', 'data-search-ph'], ['cartTitle', 'data-cart-title']].forEach(function (a) {
        if (txt(OS[a[0]])) mount.setAttribute(a[1], OS[a[0]]); else mount.removeAttribute(a[1]);
      });
      var app = mount.__lpOeApp;
      if (app && app.state && app.state.catalogue && was !== ed && typeof app.render === 'function') {
        try { app.render(); } catch (e) {}
      }
    }
  }

  /* ---------- Logo colour override: one transparent logo, any background ---------- */
  function hexOk(v) { v = txt(v); return /^#[0-9a-fA-F]{6}$/.test(v) ? v : ''; }
  function logoTint(C) {
    var head = hexOk(C.logo && C.logo.tint), foot = hexOk(C.sections && C.sections.footer && C.sections.footer.logoTint);
    var step = hexOk(C.sections && C.sections.serviceProcess && C.sections.serviceProcess.stepImageTint);
    var defs = document.getElementById('lpl-tint-defs');
    if (!head && !foot && !step && !defs) return;
    var f = function (id, col) {
      return col ? '<filter id="' + id + '" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feFlood flood-color="' + col + '"/><feComposite in2="SourceAlpha" operator="in"/></filter>' : '';
    };
    var html = f('lpl-tint-h', head) + f('lpl-tint-f', foot) + f('lpl-tint-s', step);
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      defs.id = 'lpl-tint-defs'; defs.setAttribute('width', '0'); defs.setAttribute('height', '0'); defs.setAttribute('aria-hidden', 'true');
      defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      document.body.appendChild(defs);
    }
    if (defs.getAttribute('data-k') !== html) { defs.innerHTML = '<defs>' + html + '</defs>'; defs.setAttribute('data-k', html); }
    var hi = document.querySelectorAll('header.site img.lp-logo');
    for (var i = 0; i < hi.length; i++) hi[i].classList.toggle('lpl-tint-h', !!head);
    var fi = document.querySelectorAll('footer img.foot-logo-img');
    for (var j = 0; j < fi.length; j++) fi[j].classList.toggle('lpl-tint-f', !!foot);
  }

  /* ---------- Project portfolio: feature cards ---------- */
  function featuredProjects(C) {
    var node = sec('featuredProjects'); if (!node) return;
    var FP = (C.sections && C.sections.featuredProjects) || {};
    var shop = FP.layout === 'shop';
    node.classList.toggle('fp-shop', shop);
    clear(node, 'fps');
    if (shop) { projectsShop(node, FP); }
    var on = FP.layout === 'cards';
    node.classList.toggle('fp-feature', on);
    clear(node, 'fpf');
    if (!on) return;
    var list = (Array.isArray(FP.projects) ? FP.projects : []).filter(function (p) { return p && p.on !== false; });
    var cards = node.querySelectorAll('.fp-grid > .fp-card');
    for (var i = 0; i < cards.length; i++) {
      var t = cards[i].querySelector('.fp-title');
      if (t) t.insertAdjacentHTML('beforeend', '<span class="fpf-arrow" data-lpl="fpf">' + ARROW + '</span>');
      var link = txt(list[i] && list[i].link);
      if (link) cards[i].insertAdjacentHTML('beforeend', '<a class="fpf-link" data-lpl="fpf" ' + linkAttrs(hrefOf(link)) + ' aria-label="' + esc((list[i] && list[i].title) || 'Open') + '"></a>');
    }
  }

  /* ---------- Project portfolio: "Product cards" — photo, title, outline button ---------- */
  function projectsShop(node, FP) {
    var grid = node.querySelector('.fp-grid'); if (!grid) return;
    var list = liveIdx(FP.projects).filter(function (x) { return txt(x.it.title) || txt(x.it.image); });
    if (!list.length) return;
    var html = '<div class="fps" data-lpl="fps" style="--fps-n:' + Math.min(list.length, 4) + '">' + list.map(function (x) {
      var p = x.it, img = bgUrl(p.image);
      var href = txt(p.orderCategory) ? orderCatHref(p.orderCategory) : (txt(p.link) ? hrefOf(p.link) : '');
      var lab = txt(p.btnLabel) || (href ? 'Explore' : '');
      var fit = p.imageFit === 'contain' ? 'contain' : 'cover';
      return '<div class="fps-card" data-lpe="list:featuredProjects:' + x.i + ':title">' +
        (img ? (href ? '<a class="fps-img" ' + linkAttrs(href) + ' tabindex="-1" aria-hidden="true">' : '<div class="fps-img">') +
          '<img src="' + esc(img) + '" alt="' + esc(p.title || '') + '" loading="lazy" style="object-fit:' + fit + ';object-position:' + esc(p.imagePos || 'center') + '">' + (href ? '</a>' : '</div>') : '') +
        (txt(p.title) ? '<h3 class="fps-t">' + esc(p.title) + '</h3>' : '') +
        (txt(p.description) && FP.shopShowText === true ? '<p class="fps-p">' + esc(p.description) + '</p>' : '') +
        (href && lab ? '<a class="lpl-btn lpl-btn-outline fps-btn" ' + linkAttrs(href) + '>' + esc(lab) + ARROW + '</a>' : '') +
        '</div>';
    }).join('') + '</div>';
    grid.insertAdjacentHTML('beforebegin', html);
  }

  /* ---------- Services: tick cards ---------- */
  function services(C) {
    var node = sec('services'); if (!node) return;
    var SV = (C.sections && C.sections.services) || {};
    var feature = SV.mode === 'feature';
    node.classList.toggle('svcs-feature', feature);
    node.classList.toggle('svf-right', feature && SV.featureSide === 'right');
    clear(node, 'svf');
    if (feature) {
      ['svcs-story', 'svst-left', 'svcs-tick', 'svcs-tick-dark', 'svcs-iconrow', 'svcs-band-brand', 'svcs-band-dark', 'svcs-band-light', 'lpl-tone-tint', 'lpl-tone-dark'].forEach(function (k) { node.classList.remove(k); });
      ['soft', 'tint', 'dark'].forEach(function (t) { node.classList.toggle('lpl-tone-' + t, SV.featureTone === t); });
      clear(node, 'svst');
      servicesFeature(node, C, SV);
      return;
    }
    var story = SV.mode === 'story';
    node.classList.toggle('svcs-story', story);
    ['soft', 'tint', 'dark'].forEach(function (t) { node.classList.toggle('lpl-tone-' + t, story && SV.storyTone === t); });
    node.classList.toggle('svst-left', story && SV.storySide === 'left');
    clear(node, 'svst');
    if (story) {
      ['svcs-tick', 'svcs-tick-dark', 'svcs-iconrow', 'svcs-band-brand', 'svcs-band-dark', 'svcs-band-light'].forEach(function (k) { node.classList.remove(k); });
      var head = node.querySelector('.section-head'), wrapS = node.querySelector('.wrap');
      var lab = txt(SV.storyLinkLabel);
      if (head && lab) head.insertAdjacentHTML('beforeend', '<a class="lpl-link" data-lpl="svst" data-lpe="storyLinkLabel" ' + linkAttrs(hrefOf(SV.storyLinkHref, contactHref())) + '>' + esc(lab) + ARROW + '</a>');
      var first = live(C.services).filter(function (x) { return txt(x.image); })[0];
      var pic = bgUrl(SV.storyImage) || bgUrl(first && first.image);
      if (wrapS) wrapS.insertAdjacentHTML('beforeend', '<div class="svst-media" data-lpl="svst">' + (pic ? '<img src="' + esc(pic) + '" alt="" loading="lazy">' : '') + '</div>');
      return;
    }
    var on = SV.mode === 'tick';
    var row = SV.mode === 'iconrow';
    var band = ({ brand: 1, light: 1 })[SV.tickTheme] ? SV.tickTheme : 'dark';
    node.classList.toggle('svcs-tick', on);
    node.classList.toggle('svcs-tick-dark', on && SV.tickTheme !== 'light');
    node.classList.toggle('svcs-iconrow', row);
    ['brand', 'dark', 'light'].forEach(function (t) { node.classList.toggle('svcs-band-' + t, row && band === t); });
    if (!row) node.style.removeProperty('--svr-size');
    if (!on && !row) return;
    var grid = node.querySelector('.svcs'); if (!grid) return;
    var items = live(C.services).filter(function (s) { return txt(s.title) || txt(s.image); });
    if (row) {
      // Icon row: icon, title and a short line per item (e.g. "Included with every hire").
      // Size applies to both icons and images (sections.services.iconRowSize, px).
      var rsz = Math.max(20, Math.min(160, Math.round(Number(SV.iconRowSize) || 40)));
      node.style.setProperty('--svr-size', rsz + 'px');
      grid.innerHTML = items.map(function (s) {
        var im = bgUrl(s.image);
        // Per-card size (the card's "Image + icon size" presets and % slider): Compact /
        // Large / Hero set the base, Standard uses the section size, the % scales it.
        var PRE = { compact: 56, large: 120, hero: 180 };
        var base = PRE[s.mediaSize] || rsz;
        var pct = parseInt(s.mediaScale, 10); if (isNaN(pct)) pct = 100;
        var px = Math.round(base * Math.max(50, Math.min(250, pct)) / 100);
        var st = px !== rsz ? ' style="--svr-size:' + px + 'px"' : '';
        var media = im ? '<span class="svr-ic svr-media"' + st + '><img class="svr-img" src="' + esc(im) + '" alt="' + esc(s.title || '') + '" loading="lazy"></span>'
          : '<span class="svr-ic"' + st + '>' + (icon(s.icon) || CHECK) + '</span>';
        return '<div class="svc svr">' + media +
          (txt(s.title) ? '<h3>' + esc(s.title) + '</h3>' : '') + (txt(s.body) ? '<p>' + esc(s.body) + '</p>' : '') + '</div>';
      }).join('');
      return;
    }
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

  /* ---------- Services: big photo beside a heading, intro and icon points ---------- */
  function servicesFeature(node, C, SV) {
    var wrap = node.querySelector('.wrap'); if (!wrap) return;
    // This page's own points (sections.services.featureItems); otherwise the service list.
    var own = live(SV.featureItems).filter(function (x) { return txt(x.title) || txt(x.text); });
    var items = own.length ? own.map(function (x) { return { icon: x.icon, image: x.image, title: x.title, body: x.text }; })
      : live(C.services).filter(function (x) { return txt(x.title); }).map(function (x) { return { icon: x.icon, image: '', title: x.title, body: x.body }; });
    var pic = bgUrl(SV.featureImage);
    var cap = txt(SV.featureCaption);
    wrap.insertAdjacentHTML('afterbegin', '<figure class="svf-media" data-lpl="svf" data-lpe="featureImage">' +
      (pic ? '<img src="' + esc(pic) + '" alt="" loading="lazy">' : '<span class="svf-ph"></span>') +
      (cap ? '<figcaption>' + esc(cap) + '</figcaption>' : '') + '</figure>');
    if (!items.length) return;
    var listKey = own.length ? 'servicesFeatureItems' : '';
    wrap.insertAdjacentHTML('beforeend', '<ul class="svf-list" data-lpl="svf">' + items.map(function (it, i) {
      var im = bgUrl(it.image);
      var media = im ? '<img src="' + esc(im) + '" alt="" loading="lazy">' : (icon(it.icon) || CHECK);
      return '<li' + (listKey ? ' data-lpe="list:' + listKey + ':' + i + ':title"' : '') + '><span class="svf-ic">' + media + '</span><div>' +
        (txt(it.title) ? '<h3>' + esc(it.title) + '</h3>' : '') + (txt(it.body) ? '<p>' + esc(it.body) + '</p>' : '') + '</div></li>';
    }).join('') + '</ul>');
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
    clear(node, 'tbb');
    var bandOn = TB.layout === 'band';
    node.classList.toggle('tbx-band', bandOn);
    node.classList.toggle('tbx-band-dark', bandOn && TB.bandTone === 'dark');
    if (bandOn) { textBand(node, C, TB); return; }
    var bleed = TB.layout === 'bleed';
    node.classList.toggle('tbx-bleed', bleed);
    node.classList.toggle('tbl-left', bleed && TB.imageSide === 'left');
    ['soft', 'tint', 'dark'].forEach(function (t) { node.classList.toggle('lpl-tone-' + t, bleed && TB.bleedTone === t); });
    if (bleed) { textBleed(node, C, TB); return; }
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

  /* ---------- Text box: brand band (spec rows, ticks, photo or box drawing) ---------- */
  /** "GVM: 4.5 tonne" or "GVM — 4.5 tonne" → spec row; anything else → tick item. */
  function specOf(t) {
    var m = /^(.{1,40}?)\s*(?::|\u2014|\u2013|\s-\s)\s*(.+)$/.exec(txt(t));
    return m ? { label: m[1], value: m[2] } : null;
  }
  function boxFigure(L, W, H, lift) {
    L = esc(txt(L)); W = esc(txt(W)); H = esc(txt(H)); lift = esc(txt(lift));
    return '<svg class="tbb-box" viewBox="0 0 640 400" role="img" aria-label="' + [L && L + ' long', W && W + ' wide', H && H + ' high'].filter(Boolean).join(', ') + '">' +
      '<g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"><path d="M60 140 L380 140 L380 320 L60 320 Z"/><path d="M60 140 L160 80 L480 80 L380 140"/><path d="M480 80 L480 260 L380 320"/></g>' +
      '<g fill="none" stroke="currentColor" stroke-opacity=".55" stroke-width="1.5" stroke-dasharray="5 5"><path d="M60 320 L160 260 L480 260"/><path d="M160 80 L160 260"/></g>' +
      (lift ? '<path d="M380 320 L480 260 L480 300 L380 360 Z" fill="#000" opacity=".3"/>' : '') +
      '<g fill="currentColor" font-weight="800" font-size="22">' +
      (L ? '<path d="M60 350 L380 350 M60 343 v14 M380 343 v14" stroke="currentColor" stroke-width="1.5"/><text x="220" y="380" text-anchor="middle">' + L + ' long</text>' : '') +
      (H ? '<path d="M30 140 L30 320 M23 140 h14 M23 320 h14" stroke="currentColor" stroke-width="1.5"/><text x="-230" y="20" transform="rotate(-90)" text-anchor="middle">' + H + ' high</text>' : '') +
      // Width runs along the box's top-left depth edge, offset outwards, with end ticks.
      (W ? '<path d="M52 126 L152 66 M49 121 L55 131 M149 61 L155 71" stroke="currentColor" stroke-width="1.5"/><text x="94" y="82" text-anchor="middle" transform="rotate(-31 94 82)">' + W + ' wide</text>' : '') +
      (lift ? '<text x="500" y="300" font-size="15" font-weight="700">' + lift + '</text>' : '') +
      '</g><text x="630" y="40" text-anchor="end" font-size="14" fill="currentColor" fill-opacity=".75">Dimensions are approximate</text></svg>';
  }
  function textBand(node, C, TB) {
    var feats = liveIdx(TB.features).filter(function (x) { return txt(x.it.text); });
    var specs = [], ticks = [];
    feats.forEach(function (x) { var sp = specOf(x.it.text); if (sp) specs.push({ sp: sp, i: x.i }); else ticks.push(x); });
    var hasBox = !!(txt(TB.dimLength) || txt(TB.dimWidth) || txt(TB.dimHeight));
    var img = bgUrl(TB.image);
    var lines = function (v) { return esc(v).replace(/\n/g, '<br>'); };
    var html = '<div class="wrap tbb" data-lpl="tbb"><div class="tbb-text">' +
      (txt(TB.eyebrow) ? '<span class="tbb-eyebrow" data-lpe="eyebrow">' + esc(TB.eyebrow) + '</span>' : '') +
      (txt(TB.heading) ? '<h2 class="tbb-h" data-lpe="heading">' + esc(TB.heading) + '</h2>' : '') +
      (txt(TB.intro) ? '<p class="tbb-intro" data-lpe="intro">' + lines(TB.intro) + '</p>' : '') +
      (txt(TB.content) ? '<div class="tbb-content" data-lpe="content">' + lines(TB.content) + '</div>' : '') +
      (specs.length ? '<dl class="tbb-specs">' + specs.map(function (x) {
        return '<div data-lpe="list:textBoxFeatures:' + x.i + ':text"><dt>' + esc(x.sp.label) + '</dt><dd>' + esc(x.sp.value) + '</dd></div>';
      }).join('') + '</dl>' : '') +
      (ticks.length ? '<ul class="tbb-ticks">' + ticks.map(function (x) {
        return '<li data-lpe="list:textBoxFeatures:' + x.i + ':text">' + (icon(x.it.icon) || CHECK) + '<span>' + esc(x.it.text) + '</span></li>';
      }).join('') + '</ul>' : '') +
      (txt(TB.ctaLabel) ? '<a class="lpl-btn tbb-cta" data-lpe="ctaLabel" ' + linkAttrs(hrefOf(TB.ctaHref, contactHref())) + '>' + esc(TB.ctaLabel) + ARROW + '</a>' : '') +
      '</div>' +
      (hasBox ? '<div class="tbb-fig" data-lpe="dimLength">' + boxFigure(TB.dimLength, TB.dimWidth, TB.dimHeight, TB.dimLift) + '</div>'
        : (img ? '<div class="tbb-fig tbb-photo" data-lpe="image"><img src="' + esc(img) + '" alt="' + esc(TB.imageAlt || '') + '" loading="lazy"></div>' : '')) +
      '</div>';
    node.insertAdjacentHTML('afterbegin', html);
  }

  /* ---------- Text box: split with a photo that runs to the page edge ---------- */
  function textBleed(node, C, TB) {
    var img = bgUrl(TB.image);
    var lines = function (v) { return esc(v).replace(/\n/g, '<br>'); };
    var feats = live(TB.features).filter(function (f) { return txt(f.text); });
    node.insertAdjacentHTML('afterbegin', '<div class="tbl" data-lpl="tbb"><div class="tbl-text"><div class="tbl-in">' +
      (txt(TB.eyebrow) ? '<span class="eyebrow tbl-eyebrow" data-lpe="eyebrow">' + esc(TB.eyebrow) + '</span>' : '') +
      (txt(TB.heading) ? '<h2 class="tbl-h" data-lpe="heading">' + lines(TB.heading) + '</h2>' : '') +
      (txt(TB.intro) ? '<p class="tbl-intro" data-lpe="intro">' + lines(TB.intro) + '</p>' : '') +
      (txt(TB.content) ? '<div class="tbl-content" data-lpe="content">' + lines(TB.content) + '</div>' : '') +
      (feats.length ? '<ul class="tbx-feats">' + feats.map(function (f) {
        return '<li>' + (icon(f.icon) ? '<span class="tbx-fic">' + icon(f.icon) + '</span>' : '<span class="tbx-fic tbx-dot">' + CHECK + '</span>') + '<span>' + esc(f.text) + '</span></li>';
      }).join('') + '</ul>' : '') +
      (txt(TB.ctaLabel) ? '<a class="lpl-btn lpl-btn-outline tbx-cta" data-lpe="ctaLabel" ' + linkAttrs(hrefOf(TB.ctaHref, contactHref())) + '>' + esc(TB.ctaLabel) + ARROW + '</a>' : '') +
      '</div></div>' +
      '<div class="tbl-media" data-lpe="image">' + (img ? '<img src="' + esc(img) + '" alt="' + esc(TB.imageAlt || '') + '" loading="lazy">' : '') + '</div></div>');
  }

  /* ---------- Reviews: summary row, dark band, Google badge ---------- */
  function reviews(C) {
    var node = sec('reviews'); if (!node) return;
    var RV = (C.sections && C.sections.reviews) || {};
    node.classList.toggle('rv-quotes', RV.layout === 'quotes');
    node.classList.toggle('rv-qstars', RV.layout === 'quotes' && RV.quoteStars === true);
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
    var numbered = SP.layout === 'numbered';
    var journey = SP.layout === 'journey';
    var milestone = SP.layout === 'milestone';
    node.classList.toggle('sp-numbered', numbered);
    node.classList.toggle('sp-journey', journey);
    node.classList.toggle('sp-milestone', milestone);
    ['soft', 'tint', 'dark'].forEach(function (t) { node.classList.toggle('lpl-tone-' + t, (journey || milestone) && SP.journeyTone === t); });
    node.classList.toggle('sp-has-side', !!img && !numbered && !journey);
    clear(node, 'sp');
    stepImages(node, SP);
    if (milestone) { spMilestone(node, SP, co); return; }
    if (journey) {
      var jh = node.querySelector('.section-head');
      if (jh && txt(co.linkLabel)) jh.insertAdjacentHTML('beforeend', '<a class="lpl-link" data-lpl="sp" data-lpe="calloutLinkLabel" ' + linkAttrs(hrefOf(co.linkHref, contactHref())) + '>' + esc(co.linkLabel) + ARROW + '</a>');
      return;
    }
    if (numbered) {
      // Callout panel under the steps; the button calls the business unless a link is set.
      if (!hasCo) return;
      var wrapN = node.querySelector('.wrap'); if (!wrapN) return;
      var ph = phoneOf(C);
      var btn = txt(co.linkLabel)
        ? '<a class="lpl-btn lpl-btn-outline sp-co-btn" data-lpe="calloutLinkLabel" ' + linkAttrs(hrefOf(co.linkHref, contactHref())) + '>' + esc(co.linkLabel) + ARROW + '</a>'
        : (ph ? '<a class="lpl-btn lpl-btn-outline sp-co-btn" data-lpe="calloutLinkLabel" href="' + esc(ph.href) + '">' + icon('phone') + 'Call ' + esc(ph.text) + '</a>' : '');
      wrapN.insertAdjacentHTML('beforeend', '<div class="sp-co" data-lpl="sp"><div>' +
        (txt(co.title) ? '<h3 data-lpe="calloutTitle">' + esc(co.title) + '</h3>' : '') +
        (txt(co.text) ? '<p data-lpe="calloutText">' + esc(co.text) + '</p>' : '') + '</div>' + btn + '</div>');
      return;
    }
    if (!img) return;
    var wrap = node.querySelector('.wrap'); if (!wrap) return;
    wrap.insertAdjacentHTML('beforeend', '<div class="sp-side" data-lpl="sp"><img src="' + esc(img) + '" alt="" loading="lazy">' +
      (hasCo ? '<div class="sp-callout">' + (txt(co.title) ? '<strong>' + esc(co.title) + '</strong>' : '') +
        '<div class="sp-c-body">' + (icon(co.icon || 'map-pin') ? '<span class="sp-c-ic">' + icon(co.icon || 'map-pin') + '</span>' : '') +
        '<div>' + (txt(co.text) ? '<p>' + esc(co.text) + '</p>' : '') +
        (txt(co.linkLabel) ? '<a ' + linkAttrs(hrefOf(co.linkHref, contactHref())) + '>' + esc(co.linkLabel) + ARROW + '</a>' : '') +
        '</div></div></div>' : '') + '</div>');
  }

  /* ---------- How it works: "Milestone" — big figure | heading, intro, link + watermark ---------- */
  function spMilestone(node, SP, co) {
    var wrap = node.querySelector('.wrap'); if (!wrap) return;
    var fig = txt(SP.msFigure);
    if (fig) wrap.insertAdjacentHTML('afterbegin', '<div class="spm-fig" data-lpl="sp" data-lpe="msFigure">' + esc(fig) + '</div>');
    var head = node.querySelector('.section-head');
    if (head && txt(co.linkLabel)) head.insertAdjacentHTML('beforeend', '<a class="spm-link" data-lpl="sp" data-lpe="calloutLinkLabel" ' + linkAttrs(hrefOf(co.linkHref, contactHref())) + '>' + esc(co.linkLabel) + ARROW + '</a>');
    var wm = bgUrl(SP.msWatermark);
    node.classList.toggle('spm-has-wm', !!wm);
    if (wm) {
      var op = parseInt(SP.msWatermarkOpacity, 10); if (isNaN(op)) op = 35; op = Math.max(5, Math.min(100, op));
      node.insertAdjacentHTML('afterbegin', '<div class="spm-wm" data-lpl="sp" aria-hidden="true" style="background-image:url(&quot;' + esc(wm) + '&quot;);opacity:' + (op / 100) + '"></div>');
    }
  }

  /* ---------- FAQ: two columns + view all ---------- */
  function faq(C) {
    var node = sec('faq'); if (!node) return;
    var FQ = (C.sections && C.sections.faq) || {};
    var split = FQ.layout === 'split';
    node.classList.toggle('faq-split', split);
    node.classList.toggle('faq-2col', Number(FQ.columns) === 2 && !split);
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
    if (Number(FQ.columns) === 2 || split || fb) {
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

  function phoneOf(C) {
    var ph = txt(C.phone).replace(/[^0-9+]/g, '');
    return ph ? { href: 'tel:' + ph, text: txt(C.phoneText) || txt(C.phone) } : null;
  }
  /** List items with their index in the saved list (so the editor can find the row). */
  function liveIdx(list) {
    return (Array.isArray(list) ? list : []).map(function (it, i) { return { it: it, i: i }; })
      .filter(function (x) { return x.it && x.it.on !== false; });
  }

  /* ---------- Map & Hours app (sections.mapHours) ---------- */
  function mapHours(C) {
    var node = sec('mapHours'); if (!node) return;
    var M = (C.sections && C.sections.mapHours) || {};
    node.classList.toggle('mh-map-left', M.mapSide === 'left');
    node.classList.toggle('mh-dark', M.tone === 'dark');
    node.classList.toggle('mh-grey', M.tone === 'grey');
    node.classList.toggle('mh-mapgrey', M.mapStyle === 'grey');
    node.classList.toggle('mh-bleed', M.layout === 'bleed');
    if (M.on !== true) { clear(node, 'mh'); return; }
    var addr = txt(M.address);
    var pin = txt(M.mapQuery);
    var q = pin || addr.replace(/\s*\n+\s*/g, ', ');
    var zoom = Math.min(20, Math.max(3, Math.round(Number(M.mapZoom) || 15)));
    var rows = liveIdx(M.rows).filter(function (x) { return txt(x.it.label) || txt(x.it.value); });
    var ph = M.showPhone === false ? null : phoneOf(C);
    var dir = q ? 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(q) : '';
    var lines = function (s) { return esc(s).replace(/\n/g, '<br>'); };
    var block = function (ic, title, body, lpe) {
      return '<div class="mh-block"' + (lpe ? ' data-lpe="' + lpe + '"' : '') + '><span class="mh-ic">' + icon(ic) + '</span><div class="mh-bbody">' +
        (title ? '<strong class="mh-bt">' + esc(title) + '</strong>' : '') + body + '</div></div>';
    };
    var text = (txt(M.eyebrow) ? '<span class="eyebrow mh-eyebrow" data-lpe="eyebrow">' + esc(M.eyebrow) + '</span>' : '') +
      (txt(M.heading) ? '<h2 class="mh-h" data-lpe="heading">' + esc(M.heading) + '</h2>' : '') +
      (txt(M.intro) ? '<p class="mh-intro" data-lpe="intro">' + lines(M.intro) + '</p>' : '') +
      '<div class="mh-blocks">' +
      (addr ? block('map-pin', txt(M.addressTitle) || 'Address', '<p class="mh-addr">' + lines(addr) + '</p>', 'address') : '') +
      (rows.length ? block('clock', txt(M.hoursTitle) || 'Opening hours', '<dl class="mh-hours">' + rows.map(function (x) {
        return '<div class="mh-row"><dt data-lpe="list:mapHoursRows:' + x.i + ':label">' + esc(x.it.label) + '</dt>' +
          '<dd data-lpe="list:mapHoursRows:' + x.i + ':value">' + esc(x.it.value) + '</dd></div>';
      }).join('') + '</dl>', '') : '') +
      (ph ? block('phone', txt(M.phoneTitle) || 'Phone', '<a class="mh-phone" href="' + esc(ph.href) + '">' + esc(ph.text) + '</a>', 'showPhone') : '') +
      '</div>' +
      ((txt(M.ctaLabel) && dir) ? '<a class="lpl-btn mh-cta" data-lpe="ctaLabel" ' + linkAttrs(dir) + '>' + icon('navigation') + esc(M.ctaLabel) + '</a>' : '');
    var box = node.querySelector('[data-lpl="mh"]');
    if (!box) {
      node.insertAdjacentHTML('afterbegin', '<div class="wrap mh" data-lpl="mh"><div class="mh-text"></div><div class="mh-map"></div></div>');
      box = node.querySelector('[data-lpl="mh"]');
    }
    box.querySelector('.mh-text').innerHTML = text;
    node.classList.toggle('mh-nomap', !q);
    // The map is only redrawn when its address changes (and not on every keystroke),
    // so editing other fields never reloads it.
    var map = box.querySelector('.mh-map');
    var src = q ? 'https://maps.google.com/maps?q=' + encodeURIComponent(q) + '&z=' + zoom + '&output=embed' : '';
    if (map.getAttribute('data-src') === src && map.firstChild) return;
    var draw = function () {
      map.setAttribute('data-src', src);
      map.classList.toggle('mh-map-empty', !src);
      if (src) {
        map.removeAttribute('data-lpe');
        map.innerHTML = '<iframe title="Map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="' + esc(src) + '"></iframe>' +
          '<div class="lp-as-shield" data-lpe="address" aria-hidden="true"></div>';
      } else {
        map.setAttribute('data-lpe', 'address');
        map.innerHTML = '<span>' + icon('map-pin') + 'Add an address to show the map</span>';
      }
    };
    clearTimeout(node.__mhT);
    if (!map.firstChild) draw(); else node.__mhT = setTimeout(draw, 700);
  }

  /* ---------- CTA Banner app (sections.ctaBanner) ---------- */
  var FLOW_P = null;
  function flowScript() {
    if (window.LPBookingFlow) return Promise.resolve(window.LPBookingFlow);
    if (FLOW_P) return FLOW_P;
    if (!document.querySelector('link[href^="/assets/lp-booking-hire.css"]')) {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/assets/lp-booking-hire.css?v=3';
      document.head.appendChild(l);
    }
    FLOW_P = new Promise(function (resolve) {
      var sc = document.createElement('script');
      sc.src = '/assets/lp-booking-flow.js?v=1'; sc.async = true;
      sc.onload = function () { resolve(window.LPBookingFlow || null); };
      sc.onerror = function () { FLOW_P = null; resolve(null); };
      document.head.appendChild(sc);
    });
    return FLOW_P;
  }
  function goTo(href) {
    if (!href) return;
    if (href.charAt(0) === '#') {
      var t = document.getElementById(href.slice(1)) || sec(href.slice(1));
      if (t) { try { t.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { t.scrollIntoView(); } return; }
    }
    window.location.href = href;
  }
  /** "Open the booking calendar": the live hire calendar when Bookings is set up,
   *  otherwise the booking bar, the quote form or a phone call. */
  function openBooking() {
    var C = cfgOf() || {};
    var slug = txt(C.slug) || ((typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG && SITE_CONFIG.slug) || '');
    var fallback = function () { goTo(bookingHref()); };
    if (!slug) { fallback(); return; }
    flowScript().then(function (F) {
      if (!F) return fallback();
      return F.load(slug).then(function (cal) {
        if (!cal || !cal.live) return fallback();
        var accent = '';
        try { accent = getComputedStyle(document.documentElement).getPropertyValue('--hivis').trim(); } catch (e) {}
        F.open({ accent: accent });
      });
    }).catch(fallback);
  }
  function ctaBtn(C, M, n) {
    var label = txt(M['btn' + n + 'Label']);
    if (!label) return '';
    var act = M['btn' + n + 'Action'] || (n === 1 ? 'quote' : 'call');
    var cls = 'lpl-btn cb-btn ' + (n === 1 ? 'cb-btn1' : 'cb-btn2');
    var lpe = ' data-lpe="btn' + n + 'Label"';
    if (act === 'booking') {
      return '<button type="button" class="' + cls + '" data-cb-act="booking"' + lpe + '>' + icon('calendar-days') + esc(label) + '</button>';
    }
    var href, ic = '';
    if (act === 'call') { var ph = phoneOf(C); href = ph ? ph.href : contactHref(); ic = icon('phone'); }
    else if (act === 'section') { var t = txt(M['btn' + n + 'Target']).replace(/[^\w-]/g, ''); href = t ? '#' + t : contactHref(); }
    else if (act === 'link') { href = hrefOf(M['btn' + n + 'Url'], contactHref()); }
    else { href = contactHref(); }
    return '<a class="' + cls + '"' + lpe + ' ' + linkAttrs(href) + '>' + ic + esc(label) + (ic ? '' : ARROW) + '</a>';
  }
  function ctaBanner(C) {
    var node = sec('ctaBanner'); if (!node) return;
    var M = (C.sections && C.sections.ctaBanner) || {};
    clear(node, 'cb');
    var tone = ({ brand: 1, dark: 1, light: 1, photo: 1 })[M.tone] ? M.tone : 'brand';
    ['brand', 'dark', 'light', 'photo'].forEach(function (t) { node.classList.toggle('cb-tone-' + t, t === tone); });
    node.classList.toggle('cb-center', M.align === 'center');
    node.classList.toggle('cb-full', M.width === 'full');
    var bg = bgUrl(M.bgImage);
    if (tone === 'photo' && bg) node.style.setProperty('--cb-bg', 'url("' + bg + '")'); else node.style.removeProperty('--cb-bg');
    if (M.on !== true) return;
    var boxesOn = M.layout === 'boxes';
    node.classList.toggle('cb-boxes', boxesOn);
    if (boxesOn) { ctaBoxes(node, C, M); return; }
    var btns = ctaBtn(C, M, 1) + ctaBtn(C, M, 2);
    node.insertAdjacentHTML('afterbegin', '<div class="wrap cb-wrap" data-lpl="cb"><div class="cb"><div class="cb-text">' +
      (txt(M.eyebrow) ? '<span class="cb-eyebrow" data-lpe="eyebrow">' + esc(M.eyebrow) + '</span>' : '') +
      (txt(M.heading) ? '<h2 class="cb-h" data-lpe="heading">' + esc(M.heading) + '</h2>' : '') +
      (txt(M.text) ? '<p class="cb-p" data-lpe="text">' + esc(M.text).replace(/\n/g, '<br>') + '</p>' : '') +
      '</div>' + (btns ? '<div class="cb-btns">' + btns + '</div>' : '') + '</div></div>');
    if (!node.__cbBound) {
      node.__cbBound = true;
      node.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('[data-cb-act="booking"]') : null;
        if (!b || e.defaultPrevented) return;
        e.preventDefault();
        openBooking();
      });
    }
  }

  /* ---------- CTA banner: title + outlined boxes (icon, title, text) ---------- */
  function ctaBoxes(node, C, M) {
    var boxes = liveIdx(M.boxes).filter(function (x) { return txt(x.it.title) || txt(x.it.text); });
    var btns = M.boxesButtons === true ? (ctaBtn(C, M, 1) + ctaBtn(C, M, 2)) : '';
    var lines = function (v) { return esc(v).replace(/\n/g, '<br>'); };
    node.insertAdjacentHTML('afterbegin', '<div class="wrap cb-wrap" data-lpl="cb"><div class="cb cbx">' +
      '<div class="cbx-text">' +
      (txt(M.eyebrow) ? '<span class="cb-eyebrow" data-lpe="eyebrow">' + esc(M.eyebrow) + '</span>' : '') +
      (txt(M.heading) ? '<h2 class="cb-h" data-lpe="heading">' + lines(M.heading) + '</h2>' : '') +
      (txt(M.text) ? '<p class="cb-p" data-lpe="text">' + lines(M.text) + '</p>' : '') +
      (btns ? '<div class="cb-btns">' + btns + '</div>' : '') + '</div>' +
      (boxes.length ? '<div class="cbx-grid" style="--cbx-n:' + Math.min(boxes.length, 4) + '">' + boxes.map(function (x) {
        var im = bgUrl(x.it.image);
        var media = im ? '<img class="cbx-img" src="' + esc(im) + '" alt="" loading="lazy">' : icon(x.it.icon);
        var inner = (media ? '<span class="cbx-ic">' + media + '</span>' : '') +
          (txt(x.it.title) ? '<h3 class="cbx-t">' + lines(x.it.title) + '</h3>' : '') +
          (txt(x.it.text) ? '<p class="cbx-p">' + lines(x.it.text) + '</p>' : '');
        var href = txt(x.it.link) ? hrefOf(x.it.link) : '';
        return href ? '<a class="cbx-box" data-lpe="list:ctaBannerBoxes:' + x.i + ':title" ' + linkAttrs(href) + '>' + inner + '</a>'
          : '<div class="cbx-box" data-lpe="list:ctaBannerBoxes:' + x.i + ':title">' + inner + '</div>';
      }).join('') + '</div>' : '') + '</div></div>');
  }

  /* ---------- Shared: a week of prices from the Bookings rate cards ---------- */
  var DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  /** Rate cards labelled by day ("Mon – Thu", "Friday", "Weekends & Public Holidays") → 7 days,
   *  each { price, unit, i } (i = the rate card's row). null when the labels don't cover every day. */
  function weekFromRates(rates) {
    var out = [null, null, null, null, null, null, null];
    var idx = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
    liveIdx(rates).forEach(function (x) {
      var l = txt(x.it.label).toLowerCase(), p = txt(x.it.price);
      if (!p) return;
      var cell = { price: p, unit: txt(x.it.unit), i: x.i };
      var put = function (d) { if (!out[d]) out[d] = cell; };
      if (/weekend/.test(l)) { put(5); put(6); }
      if (/weekday/.test(l)) { for (var w = 0; w < 5; w++) put(w); }
      var range = l.match(/(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s*(?:-|–|—|to)\s*(mon|tue|wed|thu|fri|sat|sun)/);
      if (range) { for (var i = idx[range[1]]; i <= idx[range[2]]; i++) put(i); return; }
      Object.keys(idx).forEach(function (k) { if (new RegExp('\\b' + k).test(l)) put(idx[k]); });
    });
    return out.every(Boolean) ? out : null;
  }
  function centsOf(s) { var n = Number(String(s || '').replace(/[^0-9.]/g, '')); return isFinite(n) && n > 0 ? Math.round(n * 100) : 0; }
  function money(c) { return '$' + (c / 100).toFixed(c % 100 ? 2 : 0).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function slugOfCfg(C) { return txt(C && C.slug) || ((typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG && SITE_CONFIG.slug) || ''); }

  /* ---------- Bookings: "Price week" layout ---------- */
  function bookingWeek(C) {
    var node = sec('bookingStorefront'); if (!node) return;
    var S = (C.sections && C.sections.bookingStorefront) || {};
    var on = S.layout === 'priceweek';
    node.classList.toggle('bkw-on', on);
    clear(node, 'bkw');
    if (!on) return;
    var week = weekFromRates(S.rates);
    var cards = liveIdx(S.rates).filter(function (x) { return txt(x.it.label) || txt(x.it.price); });
    var notes = liveIdx(S.points).filter(function (x) { return txt(x.it.text); });
    var base = week ? week[0].price : '';
    var cells = week
      ? week.map(function (c, d) {
        var cls = c.price === base ? '' : (d >= 5 && c.price === week[5].price ? ' we' : ' mid');
        return '<div class="bkw-d' + cls + '" data-lpe="list:bookingRates:' + c.i + ':price"><span class="bkw-day">' + DAY_NAMES[d] + '</span>' +
          '<span class="bkw-amt">' + esc(c.price) + '</span>' + (c.unit ? '<span class="bkw-u">' + esc(c.unit) + '</span>' : '') + '</div>';
      }).join('')
      : cards.map(function (x) {
        return '<div class="bkw-d" data-lpe="list:bookingRates:' + x.i + ':price"><span class="bkw-day">' + esc(x.it.label) + '</span>' +
          '<span class="bkw-amt">' + esc(x.it.price) + '</span>' + (txt(x.it.unit) ? '<span class="bkw-u">' + esc(x.it.unit) + '</span>' : '') + '</div>';
      }).join('');
    var head = txt(S.weekHeading), intro = txt(S.weekIntro);
    node.insertAdjacentHTML('afterbegin', '<div class="wrap bkw" data-lpl="bkw">' +
      ((head || intro) ? '<div class="bkw-head">' + (head ? '<h2 class="bkw-h" data-lpe="weekHeading">' + esc(head) + '</h2>' : '') +
        (intro ? '<p data-lpe="weekIntro">' + esc(intro) + '</p>' : '') + '</div>' : '') +
      (cells ? '<div class="bkw-week' + (week ? ' bkw-7' : '') + '" style="--bkw-n:' + (week ? 7 : Math.max(1, cards.length)) + '">' + cells + '</div>'
        : '<p class="bkw-empty" data-lpe="list:bookingRates:0:price">Add rate cards in Bookings to show prices here.</p>') +
      (notes.length ? '<p class="bkw-notes">' + notes.map(function (x) {
        return '<span data-lpe="list:bookingPoints:' + x.i + ':text">' + (icon(x.it.icon) || CHECK) + esc(x.it.text) + '</span>';
      }).join('') + '</p>' : '') + '</div>');
  }

  /* ---------- Hero slider: "Booking card" layout (headline, photo, live calendar) ---------- */
  var HB = { month: '', sel: '', end: '', today: '', live: false, settings: null, days: {}, fetched: {}, total: 0, slug: '', week: null, bound: false };
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function addDays(ymd, n) { var p = ymd.split('-').map(Number); var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n, 12)); return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); }
  function dow(ymd) { var p = ymd.split('-').map(Number); return (new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)).getUTCDay() + 6) % 7; }
  function localToday() { var d = new Date(); try { return d.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }); } catch (e) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); } }
  function niceDay(ymd) { var p = ymd.split('-').map(Number); return DAY_SHORT[dow(ymd)] + ' ' + p[2] + ' ' + MONTHS[p[1] - 1].slice(0, 3); }
  function hm12(hm) { var p = hm.split(':').map(Number); return (p[0] % 12 || 12) + (p[1] ? ':' + pad2(p[1]) : '') + (p[0] < 12 ? 'am' : 'pm'); }
  function hq(k) { return document.querySelector('[data-lpl="hbk"] [data-hb="' + k + '"]'); }
  function hbPrice(ymd) {
    var d = HB.days[ymd];
    if (d && d.from_cents) return d.from_cents;
    return HB.week ? centsOf(HB.week[dow(ymd)].price) : 0;
  }
  /** Range picking (like an accommodation calendar): tap a start day, then an end day.
   *  sections.heroSlider.bookRange === false turns it off (single day + duration list). */
  function hbRangeOn() { return HS0().bookRange !== false; }
  function hbBlocked(ymd) {
    var firstOk = addDays(HB.today, (HB.settings && HB.settings.min_notice_days) || 0);
    if (ymd < firstOk) return true;
    var dd = HB.days[ymd];
    return !!(HB.live && dd && (dd.closed || !dd.free));
  }
  function hbSpan(a, b) { var n = 0, d = a; while (d <= b && n < 400) { n++; d = addDays(d, 1); } return n; }
  /** Number of hire days: the picked range, else the duration list, else 1. */
  function hbDays() {
    if (HB.sel && HB.end) return hbSpan(HB.sel, HB.end);
    return Number((hq('len') || {}).value) || 1;
  }
  function hbPickDay(ymd) {
    if (!hbRangeOn() || !HB.sel || HB.end || ymd <= HB.sel) { HB.sel = ymd; HB.end = ''; return; }
    var span = hbSpan(HB.sel, ymd);
    // A booked-out / closed day inside the range (or a range longer than the longest hire) starts again from this day.
    for (var d = HB.sel, i = 0; i < span; i++, d = addDays(d, 1)) { if (hbBlocked(d)) { HB.sel = ymd; HB.end = ''; return; } }
    if (span > ((HB.settings && Number(HB.settings.max_days)) || 60)) { HB.sel = ymd; HB.end = ''; return; }
    HB.end = ymd;
  }
  function hbHover(ymd) {
    var host = hq('days'); if (!host) return;
    var on = hbRangeOn() && HB.sel && !HB.end && ymd && ymd > HB.sel;
    var btns = host.querySelectorAll('.hbk-day[data-ymd]');
    for (var i = 0; i < btns.length; i++) {
      var y = btns[i].getAttribute('data-ymd');
      btns[i].classList.toggle('hov', !!(on && y > HB.sel && y <= ymd));
    }
  }
  function hbFetch(from, to) {
    var key = from + '|' + to;
    if (HB.fetched[key]) return HB.fetched[key];
    HB.fetched[key] = fetch('/api/bookings/hire/public?slug=' + encodeURIComponent(HB.slug) + '&action=calendar&from=' + from + '&to=' + to, { credentials: 'omit' })
      .then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.ok) return null;
        Object.keys(j.days || {}).forEach(function (k) { HB.days[k] = j.days[k]; });
        HB.live = !!j.live; HB.settings = j.settings || HB.settings; HB.today = j.today || HB.today; HB.total = j.fleet_total || 0;
        return j;
      }).catch(function () { return null; });
    return HB.fetched[key];
  }
  function hbPaint() {
    var host = hq('days'); if (!host) return;
    var ym = HB.month, y = Number(ym.slice(0, 4)), mo = Number(ym.slice(5, 7));
    var mn = hq('mname'); if (mn) mn.textContent = MONTHS[mo - 1] + ' ' + y;
    var lead = dow(ym + '-01'), dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    var firstOk = addDays(HB.today, (HB.settings && HB.settings.min_notice_days) || 0);
    var h = '';
    for (var b = 0; b < lead; b++) h += '<span class="hbk-day blank"></span>';
    for (var d = 1; d <= dim; d++) {
      var ymd = ym + '-' + pad2(d), past = ymd < firstOk, dd = HB.days[ymd], price = hbPrice(ymd), cls = 'hbk-day', state = '';
      if (past) cls += ' past';
      else if (HB.live && dd) {
        if (dd.closed) { cls += ' full'; state = 'Closed'; }
        else if (!dd.free) { cls += ' full'; state = 'Full'; }
        else if (dd.free <= 2) cls += ' few';
        else cls += ' free';
      }
      if (ymd === HB.sel) cls += ' sel' + (HB.end ? ' rs' : '');
      if (HB.end && ymd === HB.end) cls += ' sel re';
      if (HB.end && ymd > HB.sel && ymd < HB.end) cls += ' rng';
      var off = past || / full/.test(cls);
      h += '<button type="button" class="' + cls + '" data-ymd="' + ymd + '"' + (off ? ' disabled' : '') + ' aria-label="' + esc(niceDay(ymd) + (state ? ', ' + state : (price ? ', ' + money(price) : ''))) + '">' +
        '<span class="n">' + d + '</span>' + (past ? '' : '<span class="p">' + (state || (price ? money(price) : '')) + '</span>') + '<span class="l"></span></button>';
    }
    host.innerHTML = h;
    var lg = hq('legend'); if (lg) lg.hidden = !HB.live;
    var pv = hq('prev'); if (pv) pv.disabled = ym <= HB.today.slice(0, 7);
  }
  function hbPick() {
    var s = HB.settings || {}, t = hq('time'), l = hq('len'), pk = hq('pick');
    if (!t || !l || !pk) return;
    if (!t.options.length) {
      var o = String(s.open_time || '07:30').split(':').map(Number), c = String(s.close_time || '17:00').split(':').map(Number), st = Number(s.time_step) || 30;
      for (var m = o[0] * 60 + (o[1] || 0); m <= c[0] * 60 + (c[1] || 0); m += st) { var hm = pad2(Math.floor(m / 60)) + ':' + pad2(m % 60); t.insertAdjacentHTML('beforeend', '<option value="' + hm + '">' + hm12(hm) + '</option>'); }
      var ds = Array.isArray(s.durations) && s.durations.length ? s.durations : [{ label: '1 day (24 hours)', days: 1 }, { label: '2 days', days: 2 }, { label: '3 days', days: 3 }, { label: '1 week', days: 7 }];
      ds.forEach(function (x) { l.insertAdjacentHTML('beforeend', '<option value="' + Number(x.days) + '">' + esc(x.label) + '</option>'); });
    }
    pk.hidden = false;
  }
  function hbQuote() {
    var when = hq('qwhen'), amt = hq('qamt'), left = hq('left');
    if (!when) return;
    hbLen();
    if (!HB.sel) { when.textContent = hbRangeOn() ? 'Choose a start day' : 'Choose a day'; amt.textContent = ''; left.textContent = ''; return; }
    var n = hbDays(), sum = 0, all = true, minFree = null;
    for (var i = 0; i < n; i++) {
      var dy = addDays(HB.sel, i), p = hbPrice(dy), dd = HB.days[dy];
      if (!p) all = false; sum += p;
      if (dd && dd.free != null && (minFree === null || dd.free < minFree)) minFree = dd.free;
    }
    var len = n === 1 ? '1 day' : n === 7 ? '1 week' : n + ' days';
    when.textContent = (HB.end ? niceDay(HB.sel) + ' \u2013 ' + niceDay(HB.end) : niceDay(HB.sel)) + ' · ' + len;
    amt.textContent = sum && all ? ((HB.days[HB.sel] && HB.days[HB.sel].from_cents) ? 'from ' : '') + money(sum) : '';
    left.textContent = HB.live && minFree && minFree <= 2
      ? (minFree === 1 ? 'Only 1' : 'Only ' + minFree) + (HB.total ? ' of ' + HB.total : '') + ' left ' + (n > 1 ? 'for those days.' : 'that day.')
      : (hbRangeOn() && !HB.end ? 'Tap another day for a longer hire.' : '');
  }
  /** With a range picked, the duration list shows it and is locked; one day frees it again. */
  function hbLen() {
    var l = hq('len'); if (!l) return;
    var x = l.querySelector('option[data-range]');
    if (HB.sel && HB.end) {
      var n = hbSpan(HB.sel, HB.end);
      if (!x) { x = document.createElement('option'); x.setAttribute('data-range', '1'); l.insertBefore(x, l.firstChild); }
      x.value = String(n); x.textContent = n + ' days (picked on the calendar)';
      l.value = String(n); x.selected = true; l.disabled = true;
    } else {
      if (x) { l.removeChild(x); l.selectedIndex = 0; }
      l.disabled = false;
    }
  }
  function HS0() { var C = cfgOf() || {}; return (C.sections && C.sections.heroSlider) || {}; }
  /** The card button reads "Continue" when online booking is live, "Call to book" until then. */
  function hbLabel(go, key, label) {
    if (go.textContent !== label) go.textContent = label;
    go.setAttribute('data-lpe', key);
  }
  function hbState(C) {
    var go = hq('go'), sub = hq('sub'), fine = hq('fine'), ph = phoneOf(C);
    if (!go) return;
    if (HB.live) {
      if (sub) sub.textContent = 'Each day shows its price. The dot shows what’s free.' + (hbRangeOn() ? ' Tap a start and end day for a longer hire.' : '');
      hbPick();
      go.removeAttribute('data-call');
      hbLabel(go, 'bookCta', txt(HS0().bookCta) || 'Continue');
    } else {
      if (sub) sub.textContent = (HB.week ? 'Each day shows its price.' : '') + (hbRangeOn() ? ' Tap a start and end day for a longer hire.' : '');
      go.setAttribute('data-call', '1');
      hbLabel(go, 'bookCtaCall', txt(HS0().bookCtaCall) || (ph ? 'Call to book' : 'Get in touch'));
      if (fine && ph && !fine.getAttribute('data-set')) fine.innerHTML = 'Prefer to talk? Call <a href="' + esc(ph.href) + '">' + esc(ph.text) + '</a>.';
    }
  }
  function hbMonth(ym, C) {
    HB.month = ym;
    var y = Number(ym.slice(0, 4)), mo = Number(ym.slice(5, 7));
    var from = ym + '-01', to = ym + '-' + pad2(new Date(Date.UTC(y, mo, 0)).getUTCDate());
    if (from < HB.today) from = HB.today;
    hbPaint(); hbState(C);
    if (!HB.slug) return;
    var host = hq('days'); if (host) host.classList.add('loading');
    hbFetch(from, to).then(function () {
      var h2 = hq('days'); if (h2) h2.classList.remove('loading');
      hbState(cfgOf() || C); hbPaint(); hbQuote();
    });
  }
  function hbBind() {
    if (HB.bound) return; HB.bound = true;
    document.addEventListener('click', function (e) {
      var root = document.querySelector('[data-lpl="hbk"]'); if (!root || !root.contains(e.target) || e.defaultPrevented) return;
      var C = cfgOf() || {};
      var day = e.target.closest('.hbk-day[data-ymd]');
      if (day && !day.disabled) { hbPickDay(day.getAttribute('data-ymd')); hbPaint(); hbQuote(); return; }
      if (e.target.closest('[data-hb="prev"]')) { var p = HB.month.split('-').map(Number); hbMonth(p[1] === 1 ? (p[0] - 1) + '-12' : p[0] + '-' + pad2(p[1] - 1), C); return; }
      if (e.target.closest('[data-hb="next"]')) { var n = HB.month.split('-').map(Number); hbMonth(n[1] === 12 ? (n[0] + 1) + '-01' : n[0] + '-' + pad2(n[1] + 1), C); return; }
      var go = e.target.closest('[data-hb="go"]');
      if (!go) return;
      var ph = phoneOf(C);
      if (go.getAttribute('data-call') === '1' || !HB.live) { goTo(ph ? ph.href : contactHref()); return; }
      go.disabled = true;
      flowScript().then(function (F) {
        go.disabled = false;
        if (!F) { goTo(ph ? ph.href : contactHref()); return; }
        F.load(HB.slug).then(function () {
          var accent = ''; try { accent = getComputedStyle(document.documentElement).getPropertyValue('--hivis').trim(); } catch (x) {}
          F.open({ date: HB.sel, time: (hq('time') || {}).value, days: hbDays(), accent: accent });
        });
      });
    });
    document.addEventListener('mouseover', function (e) {
      var day = e.target && e.target.closest ? e.target.closest('[data-lpl="hbk"] .hbk-day[data-ymd]') : null;
      if (day) hbHover(day.getAttribute('data-ymd'));
    });
    document.addEventListener('mouseout', function (e) {
      var host = hq('days'); if (host && e.target && host.contains(e.target) && !(e.relatedTarget && host.contains(e.relatedTarget))) hbHover('');
    });
    document.addEventListener('change', function (e) {
      var k = e.target && e.target.getAttribute && e.target.getAttribute('data-hb');
      if (k === 'len' || k === 'time') hbQuote();
    });
  }
  function heroBooking(C) {
    var node = sec('heroSlider'); if (!node) return;
    var HS = (C.sections && C.sections.heroSlider) || {};
    var on = HS.layout === 'booking';
    node.classList.toggle('hbk-on', on);
    var old = node.querySelector('[data-lpl="hbk"]');
    if (!on) { if (old) old.parentNode.removeChild(old); return; }
    var slides = liveIdx(HS.slides);
    var s0 = slides.length ? slides[0] : { it: {}, i: 0 };
    var S = s0.it, si = s0.i;
    var badges = liveIdx(HS.badges).filter(function (x) { return txt(x.it.title) || txt(x.it.text); });
    var BS = (C.sections && C.sections.bookingStorefront) || {};
    var img = bgUrl(S.imageUrl);
    var L = function (k) { return 'list:heroSlides:' + si + ':' + k; };
    var intro = '<div class="hbk-intro">' +
      (txt(S.eyebrow) ? '<span class="eyebrow hbk-eyebrow" data-lpe="' + L('eyebrow') + '">' + esc(S.eyebrow) + '</span>' : '') +
      '<h1 class="hbk-h">' + (txt(S.heading) ? '<span data-lpe="' + L('heading') + '">' + esc(S.heading) + '</span>' : '') +
      (txt(S.highlightText) ? ' <span class="hl" data-lpe="' + L('highlightText') + '">' + esc(S.highlightText) + '</span>' : '') + '</h1>' +
      (txt(S.subText) ? '<p class="hbk-sub" data-lpe="' + L('subText') + '">' + esc(S.subText) + '</p>' : '') +
      (badges.length ? '<ul class="hbk-facts">' + badges.map(function (x) {
        return '<li data-lpe="list:heroSliderBadges:' + x.i + ':title">' + (icon(x.it.icon) || CHECK) + '<span>' + esc(txt(x.it.title) || txt(x.it.text)) + '</span></li>';
      }).join('') + '</ul>' : '') + '</div>';
    var photo = img ? '<figure class="hbk-photo" data-lpe="' + L('imageUrl') + '"><img src="' + esc(img) + '" alt="' + esc(txt(HS.imageCaption) || txt(S.heading)) + '">' +
      (txt(HS.imageCaption) ? '<figcaption data-lpe="imageCaption">' + esc(HS.imageCaption) + '</figcaption>' : '') + '</figure>' : '';
    var card = '<aside class="hbk-card" aria-label="' + esc(txt(HS.bookTitle) || 'Pick your day') + '">' +
      '<h2 data-lpe="bookTitle">' + esc(txt(HS.bookTitle) || 'Pick your day') + '</h2><p class="hbk-csub" data-hb="sub"></p>' +
      '<div class="hbk-mhead"><button type="button" class="hbk-mnav" data-hb="prev" aria-label="Previous month">‹</button><strong data-hb="mname"></strong><button type="button" class="hbk-mnav" data-hb="next" aria-label="Next month">›</button></div>' +
      '<div class="hbk-wd" aria-hidden="true">' + DAY_SHORT.map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div>' +
      '<div class="hbk-days" data-hb="days"></div>' +
      '<div class="hbk-legend" data-hb="legend" hidden><span><i class="free"></i>Free</span><span><i class="few"></i>1–2 left</span><span><i class="out"></i>Booked out</span></div>' +
      '<div class="hbk-pick" data-hb="pick" hidden><label>' + esc(txt(BS.timeLabel) || 'Pick-up time') + '<select data-hb="time"></select></label><label>' + esc(txt(BS.durationLabel) || 'How long') + '<select data-hb="len"></select></label></div>' +
      '<div class="hbk-quote"><span data-hb="qwhen">Choose a day</span><b data-hb="qamt"></b></div><p class="hbk-left" data-hb="left" aria-live="polite"></p>' +
      '<button type="button" class="lpl-btn hbk-go" data-hb="go" data-lpe="bookCta">' + esc(txt(HS.bookCta) || 'Continue') + '</button>' +
      '<p class="hbk-fine" data-hb="fine"' + (txt(HS.bookNote) ? ' data-set="1" data-lpe="bookNote">' + esc(HS.bookNote) : '>') + '</p></aside>';
    var key = JSON.stringify([HS.layout, S.eyebrow, S.heading, S.highlightText, S.subText, S.imageUrl, HS.badges, HS.bookTitle, HS.bookCta, HS.bookNote, HS.imageCaption, BS.rates, BS.timeLabel, BS.durationLabel, C.phone, C.phoneText]);
    if (old && old.__key === key) return;
    var html = '<div class="hbk" data-lpl="hbk"><div class="wrap hbk-grid">' + intro + photo + card + '</div></div>';
    if (old) old.outerHTML = html; else node.insertAdjacentHTML('afterbegin', html);
    node.querySelector('[data-lpl="hbk"]').__key = key;
    HB.slug = slugOfCfg(C);
    HB.week = weekFromRates(BS.rates);
    HB.today = HB.today || localToday();
    if (HB.sel && HB.sel < HB.today) HB.sel = '';
    hbBind();
    hbMonth(HB.month || HB.today.slice(0, 7), C);
    hbQuote();
  }

  /* ---------- Font set (config.fontSet): render.js sets it for saved sites; this switches it
   *  live in the editor preview. Definitions: /assets/lp-fonts.js ---------- */
  var FONTS_P = null;
  function fontSet(C) {
    var key = txt(C.fontSet);
    var has = !!document.getElementById('lp-fontset');
    if (!key && !has) return;
    var go = function () { if (window.LP_FONTS) window.LP_FONTS.apply(document, key); };
    if (window.LP_FONTS) { go(); return; }
    if (!FONTS_P) {
      FONTS_P = new Promise(function (resolve) {
        var sc = document.createElement('script'); sc.src = '/assets/lp-fonts.js?v=2'; sc.async = true;
        sc.onload = resolve; sc.onerror = function () { FONTS_P = null; resolve(); };
        document.head.appendChild(sc);
      });
    }
    FONTS_P.then(function () { var C2 = cfgOf() || C; key = txt(C2.fontSet); go(); });
  }

  /** Bookings hire bar: render.js loads it for saved sites; this loads it in the editor
   *  preview when the layout is switched to 'hire' before the page has been re-rendered. */
  function bookingHire(C) {
    var S = C.sections && C.sections.bookingStorefront;
    if (!S || S.layout !== 'hire' || S.on !== true) return;
    if (document.querySelector('script[src^="/assets/lp-booking-hire.js"]')) return;
    if (!document.querySelector('link[href^="/assets/lp-booking-hire.css"]')) {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/assets/lp-booking-hire.css?v=3';
      document.head.appendChild(l);
    }
    window.__lpBkhCfg = C;
    var s = document.createElement('script'); s.src = '/assets/lp-booking-hire.js?v=2'; s.async = true;
    document.body.appendChild(s);
  }

  /* ---------- Trust bar: "Icons above, text below" — icon row with dividers ---------- */
  function trustBar(C) {
    var node = sec('trustBar'); if (!node) return;
    var TB = (C.sections && C.sections.trustBar) || {};
    var on = TB.mode === 'stacked';
    node.classList.toggle('tb-stacked', on);
    node.classList.toggle('tbs-nodiv', on && TB.stackDividers === false);
    node.classList.toggle('tbs-nocaps', on && TB.stackCaps === false);
    ['soft', 'tint', 'dark'].forEach(function (t) { node.classList.toggle('lpl-tone-' + t, on && TB.stackTone === t); });
    clear(node, 'tbs');
    if (!on) { node.style.removeProperty('--tbs-ic'); return; }
    var px = parseInt(TB.stackIconSize, 10); if (!(px >= 20 && px <= 120)) px = 44;
    node.style.setProperty('--tbs-ic', px + 'px');
    var items = liveIdx(TB.badges).filter(function (x) { return txt(x.it.label) || txt(x.it.icon) || txt(x.it.image); });
    ['compact', 'roomy'].forEach(function (k) { node.classList.toggle('tbs-sp-' + k, TB.stackSpacing === k); });
    if (!items.length) return;
    // Items per row: all on one line by default (or a set number); phones 2 unless set.
    var per = parseInt(TB.stackPerRow, 10); if (!(per >= 1 && per <= 12)) per = items.length;
    // Phones by default: 2 per row for up to 4 items, otherwise balanced rows of up to 4.
    var perM = parseInt(TB.stackPerRowMobile, 10); if (!(perM >= 1 && perM <= 6)) perM = items.length <= 4 ? 2 : Math.ceil(items.length / Math.ceil(items.length / 4));
    per = Math.min(per, items.length); perM = Math.min(perM, items.length);
    node.insertAdjacentHTML('afterbegin', '<div class="wrap tbs" data-lpl="tbs" style="--tbs-n:' + per + ';--tbs-nm:' + perM + '">' + items.map(function (x, k) {
      var b = x.it, im = bgUrl(b.image);
      var media = im ? '<img src="' + esc(im) + '" alt="" loading="lazy">' : icon(b.icon);
      var inner = (media ? '<span class="tbs-ic">' + media + '</span>' : '') + (txt(b.label) ? '<span class="tbs-t">' + esc(b.label).replace(/\n/g, '<br>') + '</span>' : '');
      var act = b.linkAction, href = '';
      if (act === 'page' && txt(b.linkPage)) href = withBase('/' + txt(b.linkPage).replace(/^\/+/, ''));
      else if (act === 'url' && txt(b.linkUrl)) href = hrefOf(b.linkUrl);
      else if (act === 'scroll' && txt(b.linkTarget)) href = '#' + txt(b.linkTarget).replace(/^#/, '');
      // Row starts (no divider before them) for the desktop and phone column counts.
      var cls = 'tbs-item' + (k % per === 0 ? ' tbs-rs' : '') + (k % perM === 0 ? ' tbs-rsm' : '');
      return href ? '<a class="' + cls + '" data-lpe="list:trustBar:' + x.i + ':label" ' + linkAttrs(href) + '>' + inner + '</a>'
        : '<div class="' + cls + '" data-lpe="list:trustBar:' + x.i + ':label">' + inner + '</div>';
    }).join('') + '</div>');
  }

  /* ---------- Phones: room under the footer for the fixed call / directions bar ----------
     The bar sits over the bottom of the page, so the last footer gets a spacer the bar's
     height (in the footer's own colour) and nothing ends up hidden behind it. */
  var MBAR_BOUND = false;
  function mobileBarSpace() {
    var old = document.querySelectorAll('[data-lpl="mbs"]');
    for (var i = 0; i < old.length; i++) old[i].parentNode.removeChild(old[i]);
    var bar = document.querySelector('.mobile-call');
    if (!MBAR_BOUND) { MBAR_BOUND = true; window.addEventListener('resize', function () { try { mobileBarSpace(); } catch (e) {} }); }
    if (!bar || document.querySelector('.lpbuy-bar')) return;
    var cs = getComputedStyle(bar);
    var h = (cs.display !== 'none' && cs.position === 'fixed') ? bar.offsetHeight : 0;
    if (!h) return;
    var shown = function (el) { return el && getComputedStyle(el).display !== 'none' && el.offsetHeight > 0; };
    var lpf = document.getElementById('lpFooter');
    var site = document.querySelector('footer.site[data-sec="footer"], footer[data-sec="footer"]');
    var host = shown(lpf) ? lpf : (shown(site) ? site : null);
    var html = '<div class="lpl-mbar-space" data-lpl="mbs" aria-hidden="true" style="height:' + h + 'px"></div>';
    if (host) host.insertAdjacentHTML('beforeend', html); else document.body.insertAdjacentHTML('beforeend', html);
  }

  var STEPS = [heroSlider, heroBanners, headerCta, minimalFooter, logoTint, buttonShapes, orderLayout, featuredProjects, services, activityCounter, textBox, reviews, aboutUs, specialOffer, serviceProcess, faq, trustBar, mapHours, ctaBanner, bookingWeek, heroBooking, bookingHire, fontSet, mobileBarSpace];

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
        // Scripts wrapped around this one (e.g. the Bookings bar) can redraw a section after us.
        setTimeout(function () { try { run(); } catch (e) {} }, 0);
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
