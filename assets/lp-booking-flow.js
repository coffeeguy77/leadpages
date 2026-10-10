/**
 * LeadPages Bookings — hire booking flow (opened from the booking bar).
 *
 * Steps (each its own card, revealed in order, like the Bean Culture lessons flow):
 *   1 When   — month calendar with live availability per day ("2 left", "Booked out"),
 *              pick-up time and hire length
 *   2 Choose — every vehicle with its price for those dates; booked ones greyed out
 *   3 Details— name, email, mobile, driver licence
 *   4 Confirm— summary, hire terms, "Request booking" (staff approve) — then Stripe to
 *              save a card when the business has Stripe connected (nothing charged)
 *   Done     — reference, add to calendar, manage link
 *
 * API: /api/bookings/hire/public (calendar / options / book / card_return).
 * Exposes window.LPBookingFlow = { load, calendarPopover, open, resumeFromStripe }.
 */
(function () {
  'use strict';
  if (window.LPBookingFlow) return;

  var API = '/api/bookings/hire/public';
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var STATES = ['ACT', 'NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'Overseas'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function txt(v) { return String(v == null ? '' : v).trim(); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymdOf(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function parts(ymd) { var p = String(ymd).split('-').map(Number); return { y: p[0], m: p[1], d: p[2] }; }
  function addDays(ymd, n) { var p = parts(ymd); var d = new Date(Date.UTC(p.y, p.m - 1, p.d + n, 12)); return ymdOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }
  function weekday(ymd) { var p = parts(ymd); return new Date(Date.UTC(p.y, p.m - 1, p.d, 12)).getUTCDay(); }
  function longDate(ymd) { var p = parts(ymd); return new Date(Date.UTC(p.y, p.m - 1, p.d, 12)).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }); }
  function shortDate(ymd) { var p = parts(ymd); return new Date(Date.UTC(p.y, p.m - 1, p.d, 12)).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }); }
  function money(cents) {
    var n = (Number(cents) || 0) / 100;
    return '$' + (Math.round(n) === n ? n.toFixed(0) : n.toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function hm12(v) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(v || '')); if (!m) return v; var h = Number(m[1]); return (((h + 11) % 12) + 1) + ':' + m[2] + (h < 12 ? 'am' : 'pm'); }
  function whenIso(iso, tz) {
    try { return new Date(iso).toLocaleString('en-AU', { timeZone: tz || 'Australia/Sydney', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); } catch (e) { return iso; }
  }
  function icon(name) {
    var p = name && window.LP_ICONS && window.LP_ICONS[name];
    return p ? '<svg class="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>' : '';
  }
  var TICK = '<svg class="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  var CLOSE = '<svg class="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  var LOCK = '<svg class="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  function track(name, data) { try { if (typeof trackEvent === 'function') trackEvent(name, data || {}); } catch (e) {} }

  function api(method, params) {
    if (method === 'GET') {
      var q = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
      return fetch(API + '?' + q, { credentials: 'omit' }).then(function (r) { return r.json().catch(function () { return { ok: false }; }).then(function (j) { j.__status = r.status; return j; }); });
    }
    return fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(params), credentials: 'omit' })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }).then(function (j) { j.__status = r.status; return j; }); });
  }

  /* ------------------------------------------------------------------ data */
  var CAL = null;       // last calendar response
  var CAL_P = null;     // promise
  var SLUG = '';

  function load(slug) {
    SLUG = slug;
    if (CAL_P) return CAL_P;
    CAL_P = api('GET', { slug: slug, action: 'calendar' }).then(function (j) {
      CAL = j && j.ok ? j : null;
      return CAL;
    }).catch(function () { return null; });
    return CAL_P;
  }
  function moreDays(fromYmd) {
    return api('GET', { slug: SLUG, action: 'calendar', from: fromYmd, to: addDays(fromYmd, 62) }).then(function (j) {
      if (j && j.ok && CAL) Object.keys(j.days || {}).forEach(function (k) { CAL.days[k] = j.days[k]; });
      return j;
    });
  }
  function dayInfo(ymd) { return (CAL && CAL.days && CAL.days[ymd]) || null; }

  /** Availability pill for a day. */
  function pill(info, compact) {
    if (!info) return { cls: 'na', label: '' };
    if (info.past) return { cls: 'na', label: '' };
    if (info.closed) return { cls: 'closed', label: 'Closed' };
    if (!info.free) return { cls: 'full', label: compact ? 'Full' : 'Booked out' };
    var showLeft = !CAL || !CAL.settings || CAL.settings.show_left !== false;
    if (info.free <= 1) return { cls: 'few', label: compact ? '1 left' : 'Last one!' };
    if (info.free <= 2 && info.total > 2) return { cls: 'few', label: info.free + ' left' };
    return { cls: 'ok', label: showLeft ? info.free + ' left' : 'Available' };
  }

  /* ------------------------------------------------------------------ month calendar */
  function monthGrid(y, m, selected, opts) {
    opts = opts || {};
    var first = new Date(Date.UTC(y, m - 1, 1, 12));
    var lead = (first.getUTCDay() + 6) % 7; // Monday first
    var dim = new Date(Date.UTC(y, m, 0, 12)).getUTCDate();
    var cells = '';
    for (var i = 0; i < lead; i++) cells += '<span class="bkf-cell bkf-blank" aria-hidden="true"></span>';
    for (var d = 1; d <= dim; d++) {
      var ymd = ymdOf(y, m, d);
      var info = dayInfo(ymd);
      var p = pill(info, true);
      var off = !info || info.past || info.closed || !info.free;
      var sel = ymd === selected;
      cells += '<button type="button" class="bkf-cell bkf-' + p.cls + (sel ? ' bkf-sel' : '') + '"' + (off ? ' disabled aria-disabled="true"' : '') +
        ' data-ymd="' + ymd + '" aria-label="' + esc(longDate(ymd) + (p.label ? ', ' + p.label : '')) + '"' + (sel ? ' aria-pressed="true"' : '') + '>' +
        '<span class="bkf-dn">' + d + '</span>' + (p.label && !info.past ? '<span class="bkf-dp">' + esc(p.label) + '</span>' : '') + '</button>';
    }
    return '<div class="bkf-month" data-y="' + y + '" data-m="' + m + '">' +
      '<div class="bkf-mhead"><button type="button" class="bkf-mnav" data-dir="-1" aria-label="Previous month">&#8249;</button>' +
      '<strong>' + MONTHS[m - 1] + ' ' + y + '</strong>' +
      '<button type="button" class="bkf-mnav" data-dir="1" aria-label="Next month">&#8250;</button></div>' +
      '<div class="bkf-wd">' + WD.map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div>' +
      '<div class="bkf-grid">' + cells + '</div>' +
      (opts.legend !== false ? '<div class="bkf-legend"><span><i class="bkf-k bkf-ok"></i>Available</span><span><i class="bkf-k bkf-few"></i>Nearly gone</span><span><i class="bkf-k bkf-full"></i>Booked out</span></div>' : '') +
      '</div>';
  }

  function wireMonth(host, state, onPick) {
    host.addEventListener('click', function (e) {
      var nav = e.target.closest && e.target.closest('.bkf-mnav');
      if (nav) {
        var mo = host.querySelector('.bkf-month');
        var y = Number(mo.getAttribute('data-y')), m = Number(mo.getAttribute('data-m')) + Number(nav.getAttribute('data-dir'));
        if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
        var todayP = parts((CAL && CAL.today) || ymdOf(new Date().getFullYear(), new Date().getMonth() + 1, 1));
        if (y < todayP.y || (y === todayP.y && m < todayP.m)) return;
        state.calY = y; state.calM = m;
        var need = ymdOf(y, m, 1);
        var paint = function () { host.innerHTML = monthGrid(y, m, state.date); };
        if (!dayInfo(ymdOf(y, m, 28)) && SLUG) { host.classList.add('bkf-loading'); moreDays(need).then(function () { host.classList.remove('bkf-loading'); paint(); }); }
        paint();
        return;
      }
      var cell = e.target.closest && e.target.closest('.bkf-cell[data-ymd]');
      if (cell && !cell.disabled) onPick(cell.getAttribute('data-ymd'));
    });
  }

  /** Small calendar dropdown under the bar's date field. */
  function calendarPopover(anchor, selected, onPick) {
    closePopover();
    var pop = document.createElement('div');
    pop.className = 'bkf-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Choose a pick up date');
    var start = parts(selected || (CAL && CAL.today) || '');
    var st = { calY: start.y || new Date().getFullYear(), calM: start.m || (new Date().getMonth() + 1), date: selected };
    pop.innerHTML = '<div class="bkf-pop-in">' + monthGrid(st.calY, st.calM, selected) + '</div>';
    document.body.appendChild(pop);
    var r = anchor.getBoundingClientRect();
    var w = Math.min(360, window.innerWidth - 24);
    pop.style.width = w + 'px';
    pop.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + window.scrollX)) + 'px';
    pop.style.top = (r.bottom + window.scrollY + 8) + 'px';
    wireMonth(pop.querySelector('.bkf-pop-in'), st, function (ymd) { closePopover(); onPick(ymd); });
    // Keep the whole calendar on screen.
    setTimeout(function () {
      var pr = pop.getBoundingClientRect();
      if (pr.bottom > window.innerHeight - 8) window.scrollBy({ top: pr.bottom - window.innerHeight + 16, behavior: 'smooth' });
    }, 0);
    setTimeout(function () {
      document.addEventListener('mousedown', outside, true);
      document.addEventListener('keydown', escKey, true);
    }, 0);
    function outside(e) { if (!pop.contains(e.target) && e.target !== anchor) closePopover(); }
    function escKey(e) { if (e.key === 'Escape') closePopover(); }
    pop.__off = function () { document.removeEventListener('mousedown', outside, true); document.removeEventListener('keydown', escKey, true); };
  }
  function closePopover() {
    var old = document.querySelector('.bkf-pop');
    if (old) { if (old.__off) old.__off(); old.parentNode.removeChild(old); }
  }

  /* ------------------------------------------------------------------ the booking panel */
  var P = null; // panel state

  function times(settings) {
    var a = toMin(settings.open_time, 450), b = toMin(settings.close_time, 1020), step = settings.time_step || 30;
    var out = [];
    for (var t = a; t <= b && out.length < 96; t += step) out.push(pad(Math.floor(t / 60)) + ':' + pad(t % 60));
    return out;
  }
  function toMin(s, d) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : d; }

  function open(init) {
    init = init || {};
    var settings = (CAL && CAL.settings) || {};
    P = {
      step: init.step || (init.date ? 2 : 1),
      date: init.date || '',
      time: init.time || '',
      days: Math.max(1, Number(init.days) || 1),
      durations: init.durations || settings.durations || [{ label: '1 Day (24 hours)', days: 1 }, { label: '2 Days', days: 2 }, { label: '3 Days', days: 3 }, { label: '1 Week', days: 7 }],
      options: null,
      choice: null,
      details: init.details || {},
      settings: settings,
      terms: (settings.terms) || { singular: 'Vehicle', plural: 'Vehicles' },
      busy: false,
      done: null,
      accent: init.accent || '',
      key: 'bkf-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    };
    if (!P.time) P.time = times(settings)[0] || '08:00';
    var root = document.createElement('div');
    root.className = 'bkf-overlay';
    root.innerHTML = '<div class="bkf-panel" role="dialog" aria-modal="true" aria-labelledby="bkf-title"' + (P.accent ? ' style="--bkh-accent:' + esc(P.accent) + '"' : '') + '>' +
      '<div class="bkf-top"><div><span class="bkf-eyebrow">' + esc((settings.business && settings.business.name) || '') + '</span>' +
      '<h2 id="bkf-title">Book a ' + esc(P.terms.singular.toLowerCase()) + '</h2></div>' +
      '<button type="button" class="bkf-x" aria-label="Close">' + CLOSE + '</button></div>' +
      '<div class="bkf-body"><div class="bkf-steps"></div><aside class="bkf-sum" aria-live="polite"></aside></div></div>';
    document.body.appendChild(root);
    document.documentElement.classList.add('bkf-open');
    root.querySelector('.bkf-x').addEventListener('click', close);
    root.addEventListener('mousedown', function (e) { if (e.target === root) close(); });
    document.addEventListener('keydown', escClose);
    P.root = root;
    paint();
    if (P.step >= 2 && P.date) fetchOptions();
    track('booking_flow_open', { step: P.step });
    setTimeout(function () { var f = root.querySelector('.bkf-step.bkf-cur button, .bkf-step.bkf-cur input'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {} }, 60);
  }
  function escClose(e) { if (e.key === 'Escape' && P && !document.querySelector('.bkf-pop')) close(); }
  function close() {
    if (!P) return;
    document.removeEventListener('keydown', escClose);
    if (P.root && P.root.parentNode) P.root.parentNode.removeChild(P.root);
    document.documentElement.classList.remove('bkf-open');
    P = null;
  }

  function stepHead(n, title, done, cur) {
    return '<div class="bkf-sh"><span class="bkf-num' + (done ? ' bkf-num-done' : '') + (cur ? ' bkf-num-cur' : '') + '">' + (done ? TICK : n) + '</span>' +
      '<h3>' + esc(title) + '</h3>' + (done && !cur ? '<button type="button" class="bkf-edit" data-go="' + n + '">Change</button>' : '') + '</div>';
  }

  function returnLabel() {
    if (!P.date || !P.time) return '';
    var end = addDays(P.date, P.days);
    var m = toMin(P.time, 480) - 5;
    if (m < 0) { m += 1440; end = addDays(end, -1); }
    return shortDate(end) + ', ' + hm12(pad(Math.floor(m / 60)) + ':' + pad(m % 60));
  }

  function paint() {
    if (!P) return;
    var host = P.root.querySelector('.bkf-steps');
    var terms = P.terms;
    if (P.done) { host.innerHTML = doneHtml(); P.root.querySelector('.bkf-sum').innerHTML = ''; P.root.querySelector('.bkf-panel').classList.add('bkf-is-done'); wireDone(host); return; }
    var h = '';

    // ---- Step 1: when
    var s1done = P.step > 1;
    h += '<section class="bkf-step' + (P.step === 1 ? ' bkf-cur' : '') + (s1done ? ' bkf-done' : '') + '">' + stepHead(1, 'When do you need it?', s1done, P.step === 1);
    if (P.step === 1) {
      var st = parts(P.date || (CAL && CAL.today) || '');
      P.calY = P.calY || st.y || new Date().getFullYear();
      P.calM = P.calM || st.m || (new Date().getMonth() + 1);
      var info = P.date ? dayInfo(P.date) : null;
      var hint = info ? pill(info, false) : null;
      h += '<div class="bkf-cal">' + monthGrid(P.calY, P.calM, P.date) + '</div>' +
        (P.date ? '<p class="bkf-picked">' + esc(longDate(P.date)) + (hint && hint.label ? ' <span class="bkf-badge bkf-' + hint.cls + '">' + esc(hint.label) + '</span>' : '') +
          (info && info.free === 1 ? '<span class="bkf-urgent">Only one ' + esc(terms.singular.toLowerCase()) + ' left that day — lock it in now.</span>' : '') + '</p>' : '<p class="bkf-hint">Pick your pick-up day. Numbers show how many ' + esc(terms.plural.toLowerCase()) + ' are still free.</p>') +
        '<div class="bkf-row2">' +
          '<label class="bkf-field"><span>Pick up time</span><select class="bkf-in" data-k="time">' + times(P.settings).map(function (t) { return '<option value="' + t + '"' + (t === P.time ? ' selected' : '') + '>' + hm12(t) + '</option>'; }).join('') + '</select></label>' +
          '<div class="bkf-field"><span>How long?</span><div class="bkf-stepper"><button type="button" data-days="-1" aria-label="One day less">−</button><output>' + P.days + ' day' + (P.days === 1 ? '' : 's') + '</output><button type="button" data-days="1" aria-label="One day more">+</button></div></div>' +
        '</div>' +
        '<div class="bkf-chips">' + P.durations.map(function (d) { return '<button type="button" class="bkf-chip' + (Number(d.days) === P.days ? ' on' : '') + '" data-setdays="' + Number(d.days) + '">' + esc(d.label) + '</button>'; }).join('') + '</div>' +
        (P.date ? '<p class="bkf-return">Return by <strong>' + esc(returnLabel()) + '</strong></p>' : '') +
        '<button type="button" class="bkf-cta" data-next="2"' + (P.date ? '' : ' disabled') + '>See available ' + esc(terms.plural.toLowerCase()) + '</button>';
    } else {
      h += '<p class="bkf-recap">' + esc(longDate(P.date)) + ' · ' + esc(hm12(P.time)) + ' · ' + P.days + ' day' + (P.days === 1 ? '' : 's') + '<br><small>Return by ' + esc(returnLabel()) + '</small></p>';
    }
    h += '</section>';

    // ---- Step 2: choose
    if (P.step >= 2) {
      var s2done = P.step > 2 && P.choice;
      h += '<section class="bkf-step' + (P.step === 2 ? ' bkf-cur' : '') + (s2done ? ' bkf-done' : '') + '">' + stepHead(2, 'Choose your ' + terms.singular.toLowerCase(), s2done, P.step === 2);
      if (P.step === 2) {
        if (!P.options) h += '<div class="bkf-wait"><span class="bkf-spin"></span>Checking what’s free…</div>';
        else if (P.options.error) h += '<p class="bkf-err">' + esc(P.options.error) + '</p>';
        else {
          var free = P.options.options.filter(function (o) { return o.available; });
          var later = P.options.options.filter(function (o) { return !o.available && o.free_from; });
          if (!free.length && later.length) {
            h += '<p class="bkf-urgent bkf-urgent-box">Everything\u2019s out at ' + esc(hm12(P.time)) + ', but ' + later.length + ' ' + esc((later.length === 1 ? terms.singular : terms.plural).toLowerCase()) + ' ' + (later.length === 1 ? 'is' : 'are') + ' back later that morning:</p>';
          } else if (!free.length) {
            h += '<div class="bkf-empty"><strong>Booked out for those dates.</strong><p>Try another day — green days on the calendar still have ' + esc(terms.plural.toLowerCase()) + ' free.</p><button type="button" class="bkf-cta bkf-ghost" data-go="1">Pick another date</button></div>';
          } else if (free.length === 1 && P.options.options.length > 1) {
            h += '<p class="bkf-urgent bkf-urgent-box">Only 1 of ' + P.options.options.length + ' ' + esc(terms.plural.toLowerCase()) + ' left for these dates — book now to lock it in.</p>';
          }
          h += '<div class="bkf-vehicles">' + P.options.options.map(vehicleCard).join('') + '</div>';
        }
      } else if (P.choice) {
        h += '<div class="bkf-recap bkf-recap-v">' + (P.choice.vehicle.image_url ? '<img src="' + esc(P.choice.vehicle.image_url) + '" alt="">' : '') + '<div><strong>' + esc(P.choice.vehicle.name) + '</strong><br><small>' + esc([P.choice.vehicle.make, P.choice.vehicle.model].filter(Boolean).join(' ')) + '</small></div></div>';
      }
      h += '</section>';
    }

    // ---- Step 3: details
    if (P.step >= 3) {
      var dd = P.details;
      var s3done = P.step > 3;
      h += '<section class="bkf-step' + (P.step === 3 ? ' bkf-cur' : '') + (s3done ? ' bkf-done' : '') + '">' + stepHead(3, 'Your details', s3done, P.step === 3);
      if (P.step === 3) {
        h += '<form class="bkf-form" novalidate>' +
          field('name', 'Full name (as on licence)', 'text', 'name', true, 'bkf-wide') +
          field('email', 'Email', 'email', 'email', true) +
          field('phone', 'Mobile', 'tel', 'tel', true) +
          field('licence_number', 'Driver licence number', 'text', 'off', false) +
          '<label class="bkf-field"><span>Licence state</span><select class="bkf-in" name="licence_state">' + STATES.map(function (s) { return '<option' + (dd.licence_state === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></label>' +
          field('licence_expiry', 'Licence expiry', 'month', 'off', false) +
          '<label class="bkf-field bkf-wide"><span>Anything we should know? <em>(optional)</em></span><textarea class="bkf-in" name="notes" rows="2" placeholder="e.g. moving house, extra driver, delivery">' + esc(dd.notes || '') + '</textarea></label>' +
          '<p class="bkf-err bkf-wide" hidden></p>' +
          '<button type="submit" class="bkf-cta bkf-wide">Continue</button></form>';
      } else {
        h += '<p class="bkf-recap">' + esc(dd.name) + '<br><small>' + esc(dd.email) + ' · ' + esc(dd.phone) + '</small></p>';
      }
      h += '</section>';
    }

    // ---- Step 4: confirm
    if (P.step >= 4) {
      var card = !!P.settings.card_saving;
      h += '<section class="bkf-step bkf-cur">' + stepHead(4, 'Confirm your request', false, true) +
        '<div class="bkf-confirm">' +
          '<p>We’ll check your request and confirm by email' + (P.settings.business && P.settings.business.phone ? ' or call you' : '') + '. ' +
          (card ? '<strong>Next you’ll save a card securely with Stripe — nothing is charged now.</strong>' : '<strong>Nothing is charged now.</strong>') + '</p>' +
          (P.settings.booking_terms ? '<details class="bkf-terms"><summary>Hire terms</summary><div>' + esc(P.settings.booking_terms).replace(/\n/g, '<br>') + '</div></details>' : '') +
          '<label class="bkf-agree"><input type="checkbox" name="agree"' + (P.agree ? ' checked' : '') + '> I accept the hire terms' + (card ? ' and authorise the business to save my card for this hire' : '') + '.</label>' +
          '<p class="bkf-err" hidden></p>' +
          '<button type="button" class="bkf-cta bkf-book">' + LOCK + (card ? 'Continue to secure card' : 'Request booking') + '</button>' +
          '<p class="bkf-fine">You’ll get a link to manage or cancel your booking.</p>' +
        '</div></section>';
    }

    host.innerHTML = h;
    P.root.querySelector('.bkf-sum').innerHTML = summaryHtml();
    wireSteps(host);
    var cur = host.querySelector('.bkf-cur');
    if (cur && P.scrollTo) { P.scrollTo = false; try { cur.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} }
  }

  function field(name, label, type, ac, req, cls) {
    var v = P.details[name] || '';
    return '<label class="bkf-field' + (cls ? ' ' + cls : '') + '"><span>' + esc(label) + (req ? '' : ' <em>(optional)</em>') + '</span>' +
      '<input class="bkf-in" name="' + name + '" type="' + type + '" autocomplete="' + ac + '" value="' + esc(v) + '"' + (req ? ' required' : '') + '></label>';
  }

  function vehicleCard(o) {
    var v = o.vehicle, q = o.quote || {};
    var on = P.choice && P.choice.vehicle.id === v.id;
    var specs = [v.licence_class, v.carrying_capacity, v.transmission].filter(Boolean).concat(v.features || []).slice(0, 5);
    var reason = o.available ? '' : (o.reason === 'min_days' ? 'Minimum ' + o.min_days + ' days' : o.reason === 'max_days' ? 'Up to ' + o.max_days + ' days' : (o.free_from ? 'Free from ' + hm12(o.free_from) : 'Booked out these dates'));
    if (!o.available && o.free_from) {
      return '<div class="bkf-v bkf-v-off bkf-v-later">' +
        '<span class="bkf-v-img">' + (v.image_url ? '<img src="' + esc(v.image_url) + '" alt="" loading="lazy">' : icon('truck')) + '</span>' +
        '<span class="bkf-v-body"><strong>' + esc(v.name) + '</strong><small>' + esc([v.year, v.make, v.model].filter(Boolean).join(' ')) + '</small>' +
        '<span class="bkf-v-km">Back from another hire \u2014 free from ' + esc(hm12(o.free_from)) + '</span></span>' +
        '<span class="bkf-v-price"><button type="button" class="bkf-chip on" data-freefrom="' + esc(o.free_from) + '">Pick up at ' + esc(hm12(o.free_from)) + '</button></span></div>';
    }
    var perDay = q.chargeable_days ? Math.round((q.total_cents || 0) / q.chargeable_days) : 0;
    return '<button type="button" class="bkf-v' + (on ? ' bkf-v-on' : '') + (o.available ? '' : ' bkf-v-off') + '" data-vid="' + esc(v.id) + '"' + (o.available ? '' : ' disabled') + '>' +
      '<span class="bkf-v-img">' + (v.image_url ? '<img src="' + esc(v.image_url) + '" alt="" loading="lazy">' : icon('truck')) + (on ? '<span class="bkf-v-tick">' + TICK + '</span>' : '') + '</span>' +
      '<span class="bkf-v-body"><strong>' + esc(v.name) + '</strong>' +
        '<small>' + esc([v.year, v.make, v.model].filter(Boolean).join(' ')) + '</small>' +
        (specs.length ? '<span class="bkf-v-specs">' + specs.map(function (x) { return '<i>' + esc(x) + '</i>'; }).join('') + '</span>' : '') +
        (v.included_km ? '<span class="bkf-v-km">' + v.included_km + 'km/day included' + (v.excess_km_rate_cents ? ', then ' + money(v.excess_km_rate_cents) + '/km' : '') + '</span>' : '') +
      '</span>' +
      '<span class="bkf-v-price">' + (o.available && q.total_cents != null ? '<b>' + money(q.total_cents) + '</b><small>' + (q.chargeable_days > 1 ? 'for ' + q.chargeable_days + ' days · ' + money(perDay) + '/day avg' : 'for the day') + '</small>' + (q.bond_cents ? '<small>+ ' + money(q.bond_cents) + ' bond</small>' : '') : '<span class="bkf-badge bkf-full">' + esc(reason) + '</span>') + '</span>' +
      '</button>';
  }

  function summaryHtml() {
    var terms = P.terms;
    var c = P.choice, q = c && c.quote;
    var lines = '';
    if (P.date) lines += '<div class="bkf-sl"><span>Pick up</span><b>' + esc(shortDate(P.date)) + ', ' + esc(hm12(P.time)) + '</b></div><div class="bkf-sl"><span>Return by</span><b>' + esc(returnLabel()) + '</b></div>';
    if (c) lines += '<div class="bkf-sl"><span>' + esc(terms.singular) + '</span><b>' + esc(c.vehicle.name) + '</b></div>';
    if (q) {
      (q.day_rates || []).slice(0, 7).forEach(function (dr) { lines += '<div class="bkf-sl bkf-sl-sm"><span>' + esc(shortDate(dr.day)) + '</span><span>' + money(dr.rate_cents) + '</span></div>'; });
      if ((q.day_rates || []).length > 7) lines += '<div class="bkf-sl bkf-sl-sm"><span>+ ' + (q.day_rates.length - 7) + ' more days</span><span></span></div>';
      lines += '<div class="bkf-sl bkf-total"><span>Hire total</span><b>' + money(q.total_cents) + '</b></div>' +
        (q.gst_cents ? '<div class="bkf-sl bkf-sl-sm"><span>Includes GST</span><span>' + money(q.gst_cents) + '</span></div>' : '') +
        (q.bond_cents ? '<div class="bkf-sl bkf-sl-sm"><span>Refundable bond (at pick up)</span><span>' + money(q.bond_cents) + '</span></div>' : '');
    }
    if (!lines) lines = '<p class="bkf-hint">Pick a date to see prices and what’s free.</p>';
    var biz = P.settings.business || {};
    return '<div class="bkf-sum-in"><h4>Your booking</h4>' + lines +
      '<p class="bkf-note">' + LOCK + 'No payment taken now — we confirm every booking.</p>' +
      (biz.phone ? '<p class="bkf-call">Prefer to talk? <a href="tel:' + esc(String(biz.phone).replace(/[^0-9+]/g, '')) + '">' + esc(biz.phone) + '</a></p>' : '') + '</div>';
  }

  function go(step) { P.step = step; P.scrollTo = true; paint(); }

  function fetchOptions() {
    P.options = null; P.choice = null;
    paint();
    var key = P.date + P.time + P.days;
    P.optKey = key;
    api('POST', { action: 'options', slug: SLUG, pickup_ymd: P.date, pickup_hm: P.time, hire_days: P.days }).then(function (j) {
      if (!P || P.optKey !== key) return;
      if (!j || !j.ok) { P.options = { error: (j && j.message) || 'We couldn’t check availability. Please try again or call us.' }; }
      else {
        j.options.sort(function (a, b) { return (b.available ? 1 : 0) - (a.available ? 1 : 0); });
        P.options = j;
        var free = j.options.filter(function (o) { return o.available; });
        if (free.length === 1) P.choice = free[0];
      }
      paint();
    });
  }

  function wireSteps(host) {
    var cal = host.querySelector('.bkf-cal');
    if (cal) wireMonth(cal, P, function (ymd) { P.date = ymd; var p = parts(ymd); P.calY = p.y; P.calM = p.m; paint(); });
    host.querySelectorAll('[data-go]').forEach(function (b) { b.addEventListener('click', function () { go(Number(b.getAttribute('data-go'))); }); });
    host.querySelectorAll('[data-next="2"]').forEach(function (b) {
      b.addEventListener('click', function () { if (!P.date) return; track('booking_flow_dates', { days: P.days }); go(2); fetchOptions(); });
    });
    var t = host.querySelector('select[data-k=time]');
    if (t) t.addEventListener('change', function () { P.time = t.value; paint(); });
    host.querySelectorAll('[data-days]').forEach(function (b) {
      b.addEventListener('click', function () { P.days = Math.max(1, Math.min((P.settings.max_days || 30), P.days + Number(b.getAttribute('data-days')))); paint(); });
    });
    host.querySelectorAll('[data-setdays]').forEach(function (b) {
      b.addEventListener('click', function () { P.days = Number(b.getAttribute('data-setdays')) || 1; paint(); });
    });
    host.querySelectorAll('[data-freefrom]').forEach(function (b) {
      b.addEventListener('click', function () { P.time = b.getAttribute('data-freefrom'); fetchOptions(); });
    });
    host.querySelectorAll('.bkf-v[data-vid]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-vid');
        P.choice = P.options.options.find(function (o) { return o.vehicle.id === id; });
        track('booking_flow_vehicle', {});
        go(3);
      });
    });
    var f = host.querySelector('.bkf-form');
    if (f) {
      f.addEventListener('input', function () {
        ['name', 'email', 'phone', 'licence_number', 'licence_expiry', 'notes'].forEach(function (k) { if (f[k]) P.details[k] = f[k].value; });
        P.details.licence_state = f.licence_state.value;
        P.root.querySelector('.bkf-sum').innerHTML = summaryHtml();
      });
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        ['name', 'email', 'phone', 'licence_number', 'licence_expiry', 'notes'].forEach(function (k) { if (f[k]) P.details[k] = txt(f[k].value); });
        P.details.licence_state = f.licence_state.value;
        var d = P.details, err = '';
        if (!d.name) err = 'Add your full name.';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email || '')) err = 'Add a valid email address.';
        else if ((d.phone || '').replace(/[^0-9]/g, '').length < 8) err = 'Add your mobile number.';
        var box = f.querySelector('.bkf-err');
        if (err) { box.textContent = err; box.hidden = false; return; }
        go(4);
      });
    }
    var agree = host.querySelector('input[name=agree]');
    if (agree) agree.addEventListener('change', function () {
      P.agree = agree.checked;
      var eb = P.root.querySelector('.bkf-confirm .bkf-err'); if (eb && P.agree) eb.hidden = true;
    });
    var bookBtn = host.querySelector('.bkf-book');
    if (bookBtn) bookBtn.addEventListener('click', function () { submit(bookBtn); });
  }

  function submit(btn) {
    var box = P.root.querySelector('.bkf-confirm .bkf-err');
    if (!P.agree) { box.textContent = 'Please accept the hire terms.'; box.hidden = false; return; }
    if (P.busy) return;
    P.busy = true; btn.disabled = true; btn.classList.add('bkf-busy');
    var d = P.details;
    var back = location.href.split('#')[0];
    api('POST', {
      action: 'book', slug: SLUG, resource_id: P.choice.vehicle.id,
      pickup_ymd: P.date, pickup_hm: P.time, hire_days: P.days,
      name: d.name, email: d.email, phone: d.phone,
      licence_number: d.licence_number || '', licence_state: d.licence_state || '', licence_expiry: d.licence_expiry || '',
      notes: d.notes || '', accept_terms: true, save_card: !!P.settings.card_saving,
      return_url: back, idempotency_key: P.key
    }).then(function (j) {
      P.busy = false; btn.disabled = false; btn.classList.remove('bkf-busy');
      if (!j || !j.ok) {
        box.textContent = (j && j.message) || 'We couldn’t send your request. Please try again or call us.';
        box.hidden = false;
        if (j && (j.error === 'vehicle_taken' || j.__status === 409)) { setTimeout(function () { if (P) { go(2); fetchOptions(); } }, 1600); }
        return;
      }
      track('lead', { location: 'bookingStorefront', type: 'hire_booking_request' });
      if (j.checkout_url) { location.href = j.checkout_url; return; }
      P.done = { reference: j.reference, pickup_at: j.pickup_at, return_at: j.return_at, total_cents: j.total_cents, bond_cents: j.bond_cents, vehicle: j.vehicle, portal_url: j.portal_url, card_saved: false };
      paint();
    }).catch(function () {
      P.busy = false; btn.disabled = false; btn.classList.remove('bkf-busy');
      box.textContent = 'Network error — please try again.'; box.hidden = false;
    });
  }

  function icsHref(done) {
    function z(iso) { return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
    var biz = (P.settings.business && P.settings.business.name) || 'Hire';
    var body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LeadPages//Bookings//EN', 'BEGIN:VEVENT',
      'UID:' + done.reference + '@leadpages', 'DTSTAMP:' + z(new Date().toISOString()), 'DTSTART:' + z(done.pickup_at), 'DTEND:' + z(done.return_at),
      'SUMMARY:' + (done.vehicle ? done.vehicle.name + ' hire' : 'Hire') + ' — ' + biz, 'DESCRIPTION:Booking ' + done.reference, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(body);
  }

  function doneHtml() {
    var d = P.done, tz = (CAL && CAL.settings && CAL.settings.timezone) || 'Australia/Sydney';
    return '<section class="bkf-step bkf-done-card">' +
      '<div class="bkf-done-ic">' + TICK + '</div>' +
      '<h3>Request received!</h3>' +
      '<p>We’ll check it and confirm by email shortly' + (d.card_saved ? '. Your card is saved securely — nothing has been charged.' : '.') + '</p>' +
      (d.card_error ? '<p class="bkf-err">Your card wasn’t saved — we’ll sort it out when we confirm.</p>' : '') +
      '<div class="bkf-receipt"><div class="bkf-sl"><span>Booking</span><b>' + esc(d.reference) + '</b></div>' +
      (d.vehicle ? '<div class="bkf-sl"><span>' + esc(P.terms.singular) + '</span><b>' + esc(d.vehicle.name) + '</b></div>' : '') +
      '<div class="bkf-sl"><span>Pick up</span><b>' + esc(whenIso(d.pickup_at, tz)) + '</b></div>' +
      '<div class="bkf-sl"><span>Return by</span><b>' + esc(whenIso(d.return_at, tz)) + '</b></div>' +
      (d.total_cents ? '<div class="bkf-sl bkf-total"><span>Hire total</span><b>' + money(d.total_cents) + '</b></div>' : '') +
      (d.bond_cents ? '<div class="bkf-sl bkf-sl-sm"><span>Bond at pick up</span><span>' + money(d.bond_cents) + '</span></div>' : '') + '</div>' +
      '<div class="bkf-actions"><a class="bkf-cta bkf-ghost" download="booking-' + esc(d.reference) + '.ics" href="' + icsHref(d) + '">Add to calendar</a>' +
      (d.portal_url ? '<a class="bkf-cta bkf-ghost" href="' + esc(d.portal_url) + '" target="_blank" rel="noopener">Manage booking</a>' : '') +
      '<button type="button" class="bkf-cta bkf-close">Done</button></div>' +
      '<p class="bkf-fine">Bring your driver’s licence when you pick up.</p></section>';
  }
  function wireDone(host) { var b = host.querySelector('.bkf-close'); if (b) b.addEventListener('click', close); }

  /** Back from Stripe (card saved or cancelled): show the confirmation. */
  function resumeFromStripe(slug) {
    var q = new URLSearchParams(location.search);
    var ref = q.get('bkh_ref'), tok = q.get('bkh_t');
    if (!ref || !tok) return false;
    SLUG = slug;
    var cs = q.get('bkh_cs'), cancelled = q.get('bkh_cancel') === '1';
    ['bkh_ref', 'bkh_t', 'bkh_cs', 'bkh_cancel'].forEach(function (k) { q.delete(k); });
    try { history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q.toString() : '') + location.hash); } catch (e) {}
    load(slug).then(function () {
      api('POST', { action: 'card_return', slug: slug, ref: ref, token: tok, session_id: cs || '', cancelled: cancelled }).then(function (j) {
        if (!j || !j.ok) return;
        open({});
        P.done = { reference: j.reference, pickup_at: j.pickup_at, return_at: j.return_at, total_cents: j.total_cents, bond_cents: j.bond_cents, vehicle: j.vehicle, portal_url: j.portal_url, card_saved: !!j.card_saved, card_error: cancelled ? 'cancelled' : j.card_error };
        paint();
      });
    });
    return true;
  }

  window.LPBookingFlow = { load: load, calendarPopover: calendarPopover, closePopover: closePopover, open: open, resumeFromStripe: resumeFromStripe, dayInfo: dayInfo, pill: pill, data: function () { return CAL; } };
})();
