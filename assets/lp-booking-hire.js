/**
 * LeadPages Bookings — vehicle / equipment hire bar ("Check availability").
 * Layout: sections.bookingStorefront.layout = 'hire'. render.js injects the
 * section shell + this script; everything else is drawn here from site config.
 *
 * Live mode: when the site has Bookings switched on with a hire service and vehicles,
 * the date field opens a calendar showing how many vehicles are left each day, a
 * "only 1 left" line nudges visitors, and "Check availability" opens the booking
 * flow (assets/lp-booking-flow.js → /api/bookings/hire/public). Requests arrive as
 * pending for staff to approve.
 * Enquiry mode: otherwise the request is taken in the bar as a lead (/api/leads).
 *
 * Config (sections.bookingStorefront):
 *   hireHeading, icon, dateLabel, timeLabel, durationLabel, hireCtaLabel,
 *   openTime '07:30', closeTime '17:00', timeStep 30,
 *   durations [{label, days}], points [{icon, text}], rates [{label, price, unit, note}],
 *   overlapHero (default true), bg, accent
 */
(function () {
  'use strict';

  var LAST = null, BOUND = false;

  function cfgOf() { return LAST || window.__lpLiveCfg || ((typeof SITE_CONFIG !== 'undefined') ? SITE_CONFIG : null); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function txt(v) { return String(v == null ? '' : v).trim(); }
  function icon(name, cls) {
    var p = name && window.LP_ICONS && window.LP_ICONS[name];
    var t = txt(name);
    if (!p && t && t.length <= 4 && !/^[a-z0-9-]+$/i.test(t)) return '<span class="lp-ic lpl-emo" aria-hidden="true">' + esc(t) + '</span>';
    return p ? '<svg class="lp-ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>' : '';
  }
  var ARROW = '<svg class="lp-ic bkh-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
  var CHECK_CIRCLE = '<svg class="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>';
  function track(name, data) { try { if (typeof trackEvent === 'function') trackEvent(name, data || {}); } catch (e) {} }

  var DEF_DURATIONS = [
    { label: '1 Day (24 hours)', days: 1 }, { label: '2 Days', days: 2 }, { label: '3 Days', days: 3 },
    { label: '1 Week (7 days)', days: 7 }
  ];
  function durations(S) {
    var d = (Array.isArray(S.durations) ? S.durations : []).filter(function (x) { return x && x.on !== false && Number(x.days) > 0; });
    return d.length ? d : DEF_DURATIONS;
  }
  function hm(s, def) { var m = /^(\d{1,2}):(\d{2})$/.exec(txt(s)); return m ? Number(m[1]) * 60 + Number(m[2]) : def; }
  function times(S) {
    var a = hm(S.openTime, 450), b = hm(S.closeTime, 1020), step = Math.max(15, Math.min(120, Number(S.timeStep) || 30));
    if (b < a) b = a;
    var out = [];
    for (var t = a; t <= b && out.length < 96; t += step) {
      var h = Math.floor(t / 60), m = t % 60;
      var v = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
      var h12 = ((h + 11) % 12) + 1;
      out.push({ v: v, l: h12 + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? 'am' : 'pm') });
    }
    return out;
  }
  function todayYmd() {
    var d = new Date(); var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function money(cents) {
    var n = Number(cents) / 100;
    if (!isFinite(n)) return '';
    return '$' + (Math.round(n) === n ? n.toFixed(0) : n.toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function nice(ymd) {
    try { return new Date(ymd + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }); } catch (e) { return ymd; }
  }

  function render(node, C) {
    var S = (C.sections && C.sections.bookingStorefront) || {};
    var biz = txt(C.businessName || C.business || C.name);
    var heading = txt(S.hireHeading) || 'Check availability';
    var pts = (Array.isArray(S.points) ? S.points : []).filter(function (p) { return p && p.on !== false && txt(p.text); });
    var rates = (Array.isArray(S.rates) ? S.rates : []).filter(function (r) { return r && r.on !== false && (txt(r.label) || txt(r.price)); });
    var bg = /^#[0-9a-fA-F]{6}$/.test(txt(S.bg)) ? txt(S.bg) : '';
    var accent = /^#[0-9a-fA-F]{6}$/.test(txt(S.accent)) ? txt(S.accent) : '';
    if (accent) node.style.setProperty('--bkh-accent', accent); else node.style.removeProperty('--bkh-accent');
    if (bg) node.style.setProperty('--bkh-card-bg', bg); else node.style.removeProperty('--bkh-card-bg');
    node.classList.toggle('bkh-has-rates', rates.length > 0);

    var tOpts = times(S).map(function (t) { return '<option value="' + t.v + '">' + esc(t.l) + '</option>'; }).join('');
    var dOpts = durations(S).map(function (d, i) { return '<option value="' + Number(d.days) + '"' + (i === 0 ? ' selected' : '') + '>' + esc(d.label || (d.days + ' days')) + '</option>'; }).join('');

    node.innerHTML = '<div class="wrap"><div class="bkh-card">' +
      '<div class="bkh-main">' +
        '<div class="bkh-title"><span class="bkh-tic">' + (icon(txt(S.icon) || 'truck') || '') + '</span><h2 class="bkh-h">' + esc(heading) + '</h2></div>' +
        '<form class="bkh-form" novalidate>' +
          '<label class="bkh-f"><span class="bkh-l">' + esc(txt(S.dateLabel) || 'Pick up date') + '</span>' +
            '<span class="bkh-in">' + icon('calendar') + '<input name="date" type="text" inputmode="none" placeholder="Select date" autocomplete="off" required aria-label="' + esc(txt(S.dateLabel) || 'Pick up date') + '"></span></label>' +
          '<label class="bkh-f"><span class="bkh-l">' + esc(txt(S.timeLabel) || 'Pick up time') + '</span>' +
            '<span class="bkh-in">' + icon('clock') + '<select name="time" required><option value="" selected disabled>Select time</option>' + tOpts + '</select></span></label>' +
          '<label class="bkh-f"><span class="bkh-l">' + esc(txt(S.durationLabel) || 'Hire duration') + '</span>' +
            '<span class="bkh-in bkh-in-plain"><select name="days">' + dOpts + '</select></span></label>' +
          '<button type="submit" class="bkh-go">' + esc(txt(S.hireCtaLabel) || 'Check availability') + ARROW + '</button>' +
        '</form>' +
        (pts.length ? '<ul class="bkh-points">' + pts.map(function (p) {
          return '<li><span class="bkh-pic">' + (icon(p.icon) || CHECK_CIRCLE) + '</span>' + esc(p.text) + '</li>';
        }).join('') + '</ul>' : '') +
        '<p class="bkh-scarce" hidden></p>' +
        '<div class="bkh-result" aria-live="polite"></div>' +
      '</div>' +
      (rates.length ? '<div class="bkh-rates">' + rates.map(function (r) {
        return '<div class="bkh-rate">' + (txt(r.label) ? '<span class="bkh-rl">' + esc(r.label) + '</span>' : '') +
          (txt(r.price) ? '<strong class="bkh-rp">' + esc(r.price) + '</strong>' : '') +
          (txt(r.unit) ? '<span class="bkh-ru">' + esc(r.unit) + '</span>' : '') +
          (txt(r.note) ? '<small class="bkh-rn">' + esc(r.note) + '</small>' : '') + '</div>';
      }).join('') + '</div>' : '') +
    '</div></div>';
    node.setAttribute('data-bkh-biz', biz);
    wire(node, S);
  }

  function slugOf() {
    var C = cfgOf() || {};
    return txt(C.slug) || ((typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG.slug) || '');
  }

  /** Loads the booking flow script once; resolves with window.LPBookingFlow. */
  var FLOW_P = null;
  function flowScript() {
    if (window.LPBookingFlow) return Promise.resolve(window.LPBookingFlow);
    if (FLOW_P) return FLOW_P;
    FLOW_P = new Promise(function (resolve) {
      var sc = document.createElement('script');
      sc.src = '/assets/lp-booking-flow.js?v=1';
      sc.async = true;
      sc.onload = function () { resolve(window.LPBookingFlow || null); };
      sc.onerror = function () { resolve(null); };
      document.head.appendChild(sc);
    });
    return FLOW_P;
  }

  /** Live = Bookings on, a hire service and at least one vehicle. */
  function liveCalendar() {
    var slug = slugOf();
    if (!slug) return Promise.resolve(null);
    return flowScript().then(function (F) {
      if (!F) return null;
      return F.load(slug).then(function (cal) { return cal && cal.live ? { F: F, cal: cal } : null; });
    });
  }

  /** "Only 1 truck left this Saturday" — nearest nearly-full day in the next fortnight. */
  function scarcity(node, live) {
    var box = node.querySelector('.bkh-scarce');
    if (!box || !live) return;
    var cal = live.cal, days = cal.days || {}, keys = Object.keys(days).sort();
    var terms = (cal.settings && cal.settings.terms) || { singular: 'truck', plural: 'trucks' };
    var hit = null;
    for (var i = 0; i < keys.length && i < 15; i++) {
      var d = days[keys[i]];
      if (d && !d.past && !d.closed && d.total > 1 && d.free > 0 && d.free <= Math.max(1, Math.floor(d.total / 3))) { hit = { ymd: keys[i], d: d }; break; }
    }
    if (!hit) { box.hidden = true; return; }
    var label = hit.d.free === 1 ? 'Only 1 ' + terms.singular.toLowerCase() + ' left' : 'Only ' + hit.d.free + ' ' + terms.plural.toLowerCase() + ' left';
    box.innerHTML = '<span class="bkh-scarce-dot" aria-hidden="true"></span><strong>' + esc(label) + '</strong> for ' + esc(nice(hit.ymd)) + ' \u2014 ' + (hit.d.total - hit.d.free) + ' of ' + hit.d.total + ' already booked. Lock in your date now.';
    box.hidden = false;
  }

  function wire(node, S) {
    var form = node.querySelector('.bkh-form');
    var date = form.querySelector('input[name=date]');
    var LIVE = null;

    function nativeDate() {
      date.addEventListener('focus', function () {
        if (LIVE) return;
        if (date.type !== 'date') {
          date.type = 'date';
          date.min = todayYmd();
          try { if (date.showPicker) date.showPicker(); } catch (e) {}
        }
      });
      date.addEventListener('blur', function () { if (!LIVE && !date.value) date.type = 'text'; });
    }
    nativeDate();

    liveCalendar().then(function (live) {
      if (!live || !node.isConnected) return;
      LIVE = live;
      node.classList.add('bkh-live');
      date.type = 'text';
      date.readOnly = true;
      var openCal = function (e) {
        if (e) e.preventDefault();
        live.F.calendarPopover(date, date.getAttribute('data-ymd') || '', function (ymd) {
          date.setAttribute('data-ymd', ymd);
          date.value = nice(ymd);
          var info = live.F.dayInfo(ymd);
          var res = node.querySelector('.bkh-result');
          if (info && info.free === 1) res.innerHTML = '<p class="bkh-msg bkh-hot">Only one left for ' + esc(nice(ymd)) + ' \u2014 book now to lock it in.</p>';
          else res.innerHTML = '';
        });
      };
      date.addEventListener('click', openCal);
      date.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') openCal(e); });
      scarcity(node, live);
    });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var ymd = LIVE ? (date.getAttribute('data-ymd') || '') : date.value;
      var v = { date: ymd, time: form.time.value, days: Number(form.days.value) || 1,
        daysLabel: form.days.options[form.days.selectedIndex] ? form.days.options[form.days.selectedIndex].text : '' };
      var res = node.querySelector('.bkh-result');
      track('cta_click', { location: 'bookingStorefront', action: 'check_availability' });
      if (LIVE) {
        res.innerHTML = '';
        LIVE.F.open({
          date: ymd || '',
          time: v.time || '',
          days: v.days,
          durations: durations(S),
          accent: getComputedStyle(node).getPropertyValue('--bkh-a').trim() || ''
        });
        return;
      }
      if (!v.date) { res.innerHTML = '<p class="bkh-msg bkh-err">Choose a pick up date.</p>'; date.focus(); return; }
      if (v.date < todayYmd()) { res.innerHTML = '<p class="bkh-msg bkh-err">Choose a date from today onwards.</p>'; return; }
      if (!v.time) { res.innerHTML = '<p class="bkh-msg bkh-err">Choose a pick up time.</p>'; form.time.focus(); return; }
      enquiry(node, S, v);
    });
  }

  /**
   * No online hire set up for this site: take the request right here as a lead
   * (POST /api/leads, the same endpoint as the quote form) with the dates attached,
   * so it lands in the site's leads and the owner's email.
   */
  function enquiry(node, S, v) {
    var res = node.querySelector('.bkh-result');
    var C = cfgOf() || {};
    var SC = (typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG) || {};
    var line = 'Hire request \u2014 pick up ' + nice(v.date) + ' at ' + v.time + ', ' + v.daysLabel + '.';
    var phone = txt(C.phone).replace(/[^0-9+]/g, ''), phoneText = txt(C.phoneText) || txt(C.phone);
    var started = Date.now();
    res.innerHTML = '<form class="bkh-details" novalidate><p class="bkh-qhead">' + esc(nice(v.date)) + ' \u00b7 ' + esc(v.time) + ' \u00b7 ' + esc(v.daysLabel) + '</p>' +
      '<p class="bkh-msg bkh-small" style="margin:0 0 10px">Leave your details and we\u2019ll confirm availability' + (phone ? ' \u2014 or call <a href="tel:' + esc(phone) + '">' + esc(phoneText) + '</a>' : '') + '.</p>' +
      '<div class="bkh-dgrid">' +
      '<label><span>Name</span><input name="name" autocomplete="name" required></label>' +
      '<label><span>Phone</span><input name="phone" type="tel" autocomplete="tel"></label>' +
      '<label><span>Email</span><input name="email" type="email" autocomplete="email"></label>' +
      '<label class="bkh-wide"><span>Anything we should know? (optional)</span><textarea name="notes" rows="2"></textarea></label>' +
      '</div>' +
      '<input type="text" name="lp_hp" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">' +
      '<div class="bkh-dact"><button type="submit" class="bkh-go">Send hire request' + ARROW + '</button></div></form>';
    var f = res.querySelector('form');
    try { f.querySelector('input[name=name]').focus({ preventScroll: true }); } catch (e) {}
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var name = txt(f.name.value), ph = txt(f.phone.value), em = txt(f.email.value);
      var old = f.querySelector('.bkh-err'); if (old) old.parentNode.removeChild(old);
      var bad = !name ? 'Add your name.' : (!ph && !em ? 'Add a phone number or email.' : '');
      if (bad) { f.insertAdjacentHTML('beforeend', '<p class="bkh-msg bkh-err">' + esc(bad) + '</p>'); return; }
      var btn = f.querySelector('.bkh-go'); btn.disabled = true;
      var attr = {};
      try { if (window.LPAttribution && LPAttribution.leadFields) attr = LPAttribution.leadFields() || {}; } catch (e) {}
      var body = Object.assign({
        site: C.business || SC.business || '', siteId: C.siteId || SC.siteId || '', slug: C.slug || SC.slug || '',
        kind: 'trade', name: name, phone: ph, email: em,
        lp_hp: f.lp_hp.value || '', _t: started,
        details: { job: 'Hire request', detail: line + (txt(f.notes.value) ? '\n' + txt(f.notes.value) : '') }
      }, attr);
      fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .catch(function () { return null; })
        .then(function (r) {
          if (!r) {
            btn.disabled = false;
            f.insertAdjacentHTML('beforeend', '<p class="bkh-msg bkh-err">Network error \u2014 please try again' + (phone ? ' or call ' + esc(phoneText) : '') + '.</p>');
            return;
          }
          track('lead', { location: 'bookingStorefront', type: 'hire_enquiry' });
          res.innerHTML = '<div class="bkh-done">' + CHECK_CIRCLE + '<div><strong>Hire request sent</strong>' +
            '<p>We\u2019ll be in touch to confirm availability for ' + esc(nice(v.date)) + '.</p></div></div>';
        });
    });
  }

  /** Pull the bar up over the hero when it sits directly under one. */
  function overlap(node, S) {
    var want = S.overlapHero !== false;
    var parent = node.parentNode; if (!parent) return;
    var prev = null, best = -Infinity, myOrder = Number(node.style.order) || 0;
    Array.prototype.forEach.call(parent.children, function (el) {
      if (el === node || !el.getAttribute || !el.getAttribute('data-sec')) return;
      if (getComputedStyle(el).display === 'none' || !el.offsetHeight) return;
      var o = Number(el.style.order) || 0;
      if (o < myOrder && o > best) { best = o; prev = el; }
    });
    var id = prev && prev.getAttribute('data-sec');
    node.classList.toggle('bkh-overlap', !!(want && (id === 'hero' || id === 'heroSlider' || id === 'splitHero' || id === 'heroBeforeAfter')));
  }

  /**
   * Returns true when it had to create the section (editor preview where the page was
   * rendered before Bookings was switched on) so the caller can re-apply section order.
   */
  function run(cfg) {
    if (cfg) LAST = cfg;
    var C = cfgOf(); if (!C) return false;
    var S = (C.sections && C.sections.bookingStorefront) || {};
    var node = document.querySelector('section[data-sec="bookingStorefront"]');
    var created = false;
    if (S.layout !== 'hire') {
      // Editor switched back to the standard CTA: put the server-rendered CTA back.
      if (node && node.classList.contains('bk-hire')) {
        if (node.__bkhOrig != null) {
          node.innerHTML = node.__bkhOrig; node.className = node.__bkhOrigClass;
        } else {
          // Page was rendered with the hire bar: draw the standard CTA (same markup as render.js).
          var slug = txt(C.slug) || ((typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG.slug) || '');
          var ac = 'var(--bk-accent,var(--accent,#155c4a))';
          node.className = 'sec booking-storefront';
          node.innerHTML = '<div class="in" style="max-width:720px;margin:0 auto;text-align:center;padding:28px 16px">' +
            '<p class="eyebrow" style="letter-spacing:.14em;text-transform:uppercase;font-weight:700;font-size:12px;color:' + ac + '">' + esc(S.eyebrow || 'Book online') + '</p>' +
            '<h2 style="margin:10px 0 8px;font-size:clamp(28px,4vw,44px);letter-spacing:-.02em">' + esc(S.heading || 'Book an appointment') + '</h2>' +
            '<p class="intro" style="color:var(--muted,#667066);font-size:17px;line-height:1.45;margin:0 0 18px">' + esc(S.intro || 'Choose a service and a time that works for you.') + '</p>' +
            '<a class="btn" href="/book?slug=' + encodeURIComponent(slug) + '" style="display:inline-block;background:' + ac + ';color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700">' + esc(S.ctaLabel || 'Book now') + '</a></div>';
        }
        node.classList.remove('bkh-overlap'); node.__bkhKey = null;
      }
      return false;
    }
    if (!node) {
      if (S.on !== true) return false;
      var main = document.getElementById('top') || document.querySelector('main');
      if (!main) return false;
      node = document.createElement('section');
      node.setAttribute('data-sec', 'bookingStorefront');
      node.id = 'bookingStorefront';
      node.className = 'sec booking-storefront bk-hire';
      var q = main.querySelector(':scope > [data-sec="quote"]');
      main.insertBefore(node, q || null);
      created = true;
    } else if (!node.classList.contains('bk-hire')) {
      node.__bkhOrig = node.innerHTML; node.__bkhOrigClass = node.className;
      node.style.removeProperty('background');
      node.classList.add('bk-hire'); node.__bkhKey = null;
    }
    var key = JSON.stringify(S) + '|' + (C.phone || '') + '|' + (C.email || '');
    if (node.__bkhKey !== key) { node.__bkhKey = key; render(node, C); }
    overlap(node, S);
    return created;
  }
  function bind() {
    if (BOUND) return;
    var o = window.__applyTradeConfig;
    if (typeof o === 'function' && !o.__bkhWrapped) {
      var w = function (cfg) {
        var r, err = null; try { r = o.apply(this, arguments); } catch (e) { err = e; }
        try { if (run(cfg)) { try { o.apply(this, arguments); } catch (e) {} run(cfg); } } catch (e) {}
        if (err) throw err;
        return r;
      };
      w.__bkhWrapped = true; window.__applyTradeConfig = w; BOUND = true;
    }
  }
  function init() {
    bind();
    var c = window.__lpBkhCfg; window.__lpBkhCfg = null;
    var made = run(c || undefined);
    if (made && typeof window.__applyTradeConfig === 'function') { try { window.__applyTradeConfig(c || cfgOf()); } catch (e) {} }
    // Back from Stripe after saving a card: show the confirmation.
    if (/[?&]bkh_ref=/.test(location.search)) {
      flowScript().then(function (F) { if (F) F.resumeFromStripe(slugOf()); });
    }
  }
  if (document.readyState !== 'loading') init(); else document.addEventListener('DOMContentLoaded', init);
  setTimeout(bind, 0);
  window.addEventListener('load', function () { setTimeout(function () { try { run(); } catch (e) {} }, 60); });
})();
