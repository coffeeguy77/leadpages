/**
 * LeadPages Bookings — vehicle / equipment hire bar ("Check availability").
 * Layout: sections.bookingStorefront.layout = 'hire'. render.js injects the
 * section shell + this script; everything else is drawn here from site config.
 *
 * Live mode: when the site has Bookings enabled with a resource_hire service and
 * hire resources, "Check availability" quotes each vehicle through
 * /api/bookings/hire/quote, shows price + availability, and books through
 * POST /api/bookings/public (status pending — staff confirm in Bookings).
 * Enquiry mode: otherwise the request is passed to the quote form (prefilled)
 * or, with no form on the page, the visitor is shown the phone number.
 *
 * Config (sections.bookingStorefront):
 *   hireHeading, icon, dateLabel, timeLabel, durationLabel, hireCtaLabel,
 *   openTime '07:30', closeTime '17:00', timeStep 30,
 *   durations [{label, days}], points [{icon, text}], rates [{label, price, unit, note}],
 *   overlapHero (default true), bg, accent
 */
(function () {
  'use strict';

  var LAST = null, BOUND = false, PUB = null, STATE = { quotes: null, picked: null, done: null };

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

  function wire(node, S) {
    var form = node.querySelector('.bkh-form');
    var date = form.querySelector('input[name=date]');
    date.addEventListener('focus', function () {
      if (date.type !== 'date') {
        date.type = 'date';
        date.min = todayYmd();
        try { if (date.showPicker) date.showPicker(); } catch (e) {}
      }
    });
    date.addEventListener('blur', function () { if (!date.value) date.type = 'text'; });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var v = { date: date.value, time: form.time.value, days: Number(form.days.value) || 1,
        daysLabel: form.days.options[form.days.selectedIndex] ? form.days.options[form.days.selectedIndex].text : '' };
      var res = node.querySelector('.bkh-result');
      if (!v.date) { res.innerHTML = '<p class="bkh-msg bkh-err">Choose a pick up date.</p>'; date.focus(); return; }
      if (v.date < todayYmd()) { res.innerHTML = '<p class="bkh-msg bkh-err">Choose a date from today onwards.</p>'; return; }
      if (!v.time) { res.innerHTML = '<p class="bkh-msg bkh-err">Choose a pick up time.</p>'; form.time.focus(); return; }
      track('cta_click', { location: 'bookingStorefront', action: 'check_availability' });
      check(node, S, v);
    });
  }

  function loadPublic() {
    if (PUB) return PUB;
    var C = cfgOf() || {};
    var slug = txt(C.slug) || ((typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG.slug) || '');
    PUB = fetch('/api/bookings/public?slug=' + encodeURIComponent(slug), { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
    return PUB;
  }

  function check(node, S, v) {
    var res = node.querySelector('.bkh-result');
    var btn = node.querySelector('.bkh-go');
    btn.disabled = true;
    res.innerHTML = '<p class="bkh-msg">Checking availability…</p>';
    loadPublic().then(function (pub) {
      var svc = pub && pub.ok && (pub.services || []).filter(function (s) { return s.booking_type === 'resource_hire'; })[0];
      var resources = pub && pub.ok ? (pub.hire_resources || []).filter(function (r) { return r.hire_status !== 'unavailable'; }) : [];
      if (!svc || !resources.length) { btn.disabled = false; return enquiry(node, S, v); }
      var C = cfgOf() || {};
      var siteId = C.siteId || ((typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG.siteId) || '');
      var tasks = resources.slice(0, 8).map(function (r) {
        return fetch('/api/bookings/hire/quote', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ public: true, site_id: siteId, service_id: svc.id, resource_id: r.id, pickup_ymd: v.date, pickup_hm: v.time, duration_mode: 'multi_day', hire_days: v.days })
        }).then(function (x) { return x.json().catch(function () { return null; }); })
          .then(function (j) { return { r: r, q: j }; })
          .catch(function () { return { r: r, q: null }; });
      });
      Promise.all(tasks).then(function (rows) {
        btn.disabled = false;
        var ok = rows.filter(function (x) { return x.q && x.q.ok; });
        if (!ok.length) return enquiry(node, S, v);
        STATE.quotes = { svc: svc, v: v, rows: ok };
        showQuotes(node, S);
      });
    });
  }

  function showQuotes(node, S) {
    var res = node.querySelector('.bkh-result');
    var Q = STATE.quotes;
    var any = Q.rows.some(function (x) { return x.q.availability && x.q.availability.ok !== false; });
    res.innerHTML = '<div class="bkh-quotes"><p class="bkh-qhead">' + esc(nice(Q.v.date)) + ' · ' + esc(Q.v.daysLabel) + '</p>' +
      Q.rows.map(function (x, i) {
        var free = !x.q.availability || x.q.availability.ok !== false;
        var q = x.q.quote || {};
        var name = x.r.public_name || x.r.name;
        return '<div class="bkh-q' + (free ? '' : ' bkh-q-off') + '">' +
          (x.r.image_url ? '<img src="' + esc(x.r.image_url) + '" alt="" loading="lazy">' : '<span class="bkh-qic">' + icon('truck') + '</span>') +
          '<div class="bkh-qtx"><strong>' + esc(name) + '</strong>' +
            (q.total_cents != null ? '<span>' + money(q.total_cents) + ' total' + (q.bond_cents ? ' + ' + money(q.bond_cents) + ' bond' : '') + '</span>' : '') + '</div>' +
          (free ? '<button type="button" class="bkh-pick" data-i="' + i + '">Book</button>' : '<span class="bkh-full">Booked out</span>') + '</div>';
      }).join('') +
      (any ? '' : '<p class="bkh-msg">Nothing free for those dates — try another day or call us.</p>') + '</div>';
    Array.prototype.forEach.call(res.querySelectorAll('.bkh-pick'), function (b) {
      b.addEventListener('click', function () { STATE.picked = Q.rows[Number(b.getAttribute('data-i'))]; showDetails(node, S); });
    });
  }

  function showDetails(node, S) {
    var res = node.querySelector('.bkh-result');
    var P = STATE.picked, Q = STATE.quotes;
    res.innerHTML = '<form class="bkh-details" novalidate><p class="bkh-qhead">' + esc(P.r.public_name || P.r.name) + ' · ' + esc(nice(Q.v.date)) + ' · ' + esc(Q.v.daysLabel) + '</p>' +
      '<div class="bkh-dgrid">' +
      '<label><span>Name</span><input name="name" autocomplete="name" required></label>' +
      '<label><span>Phone</span><input name="phone" type="tel" autocomplete="tel"></label>' +
      '<label><span>Email</span><input name="email" type="email" autocomplete="email"></label>' +
      '<label class="bkh-wide"><span>Anything we should know? (optional)</span><textarea name="notes" rows="2"></textarea></label>' +
      '</div>' +
      '<label class="bkh-agree"><input type="checkbox" name="agree"> I accept the hire terms and cancellation policy</label>' +
      '<div class="bkh-dact"><button type="submit" class="bkh-go">Request booking' + ARROW + '</button><button type="button" class="bkh-back">Back</button></div>' +
      '<p class="bkh-msg bkh-small">We’ll confirm your booking by phone or email.</p></form>';
    var f = res.querySelector('form');
    f.querySelector('.bkh-back').addEventListener('click', function () { showQuotes(node, S); });
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var name = txt(f.name.value), phone = txt(f.phone.value), email = txt(f.email.value);
      var err = !name ? 'Add your name.' : (!phone && !email ? 'Add a phone number or email.' : (!f.agree.checked ? 'Please accept the hire terms.' : ''));
      var old = f.querySelector('.bkh-err'); if (old) old.parentNode.removeChild(old);
      if (err) { f.insertAdjacentHTML('beforeend', '<p class="bkh-msg bkh-err">' + esc(err) + '</p>'); return; }
      var btn = f.querySelector('.bkh-go'); btn.disabled = true;
      var C = cfgOf() || {};
      var slug = txt(C.slug) || ((typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG.slug) || '');
      fetch('/api/bookings/public', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: slug, service_id: Q.svc.id, resource_id: P.r.id, booking_type: 'resource_hire',
          pickup_ymd: Q.v.date, pickup_hm: Q.v.time, duration_mode: 'multi_day', hire_days: Q.v.days,
          customer_name: name, customer_phone: phone, customer_email: email, customer_notes: txt(f.notes.value),
          cancellation_policy_accepted: true,
          idempotency_key: 'bkh-' + slug + '-' + P.r.id + '-' + Q.v.date + '-' + Q.v.time + '-' + (email || phone)
        })
      }).then(function (r) { return r.json().catch(function () { return { ok: false }; }); }).then(function (j) {
        btn.disabled = false;
        if (!j || !j.ok) {
          var why = j && (j.error === 'capacity_full' || j.error === 'resource_unavailable' || j.error === 'conflict') ? 'That vehicle was just booked — pick another or another date.' : 'We couldn’t take the booking online. Please call us.';
          f.insertAdjacentHTML('beforeend', '<p class="bkh-msg bkh-err">' + esc(why) + '</p>');
          return;
        }
        track('lead', { location: 'bookingStorefront', type: 'hire_booking' });
        res.innerHTML = '<div class="bkh-done">' + CHECK_CIRCLE + '<div><strong>Booking request received' + (j.booking && j.booking.reference ? ' — ' + esc(j.booking.reference) : '') + '</strong>' +
          '<p>We’ll be in touch to confirm. ' + (j.portal_url ? '<a href="' + esc(j.portal_url) + '">Manage your booking</a>' : '') + '</p></div></div>';
      }).catch(function () {
        btn.disabled = false;
        f.insertAdjacentHTML('beforeend', '<p class="bkh-msg bkh-err">Network error — please try again.</p>');
      });
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
    if (node.__bkhKey !== key) { node.__bkhKey = key; STATE.quotes = null; render(node, C); }
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
  function init() { bind(); var c = window.__lpBkhCfg; window.__lpBkhCfg = null; var made = run(c || undefined); if (made && typeof window.__applyTradeConfig === 'function') { try { window.__applyTradeConfig(c || cfgOf()); } catch (e) {} } }
  if (document.readyState !== 'loading') init(); else document.addEventListener('DOMContentLoaded', init);
  setTimeout(bind, 0);
  window.addEventListener('load', function () { setTimeout(function () { try { run(); } catch (e) {} }, 60); });
})();
