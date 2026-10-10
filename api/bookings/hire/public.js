'use strict';

/**
 * Public hire booking API (the booking bar / booking flow on a LeadPages site).
 *
 * GET  ?slug=&action=calendar&from=YYYY-MM-DD&to=YYYY-MM-DD[&pickup_hm=]
 *        → per-day fleet availability for the calendar ("2 of 4 left", booked out)
 * POST { action:'options', slug, pickup_ymd, pickup_hm, hire_days }
 *        → every vehicle with its price for those dates and whether it's free
 * POST { action:'book', slug, resource_id, pickup_ymd, pickup_hm, hire_days, name,
 *        email, phone, licence_number, licence_state, licence_expiry, notes,
 *        accept_terms, save_card, return_url, idempotency_key }
 *        → creates a PENDING request (staff approve), emails customer + business,
 *          and returns a Stripe link to save a card when the business has Stripe
 * POST { action:'card_return', slug, ref, token, session_id }
 *        → records the saved card after Stripe sends the customer back
 */

const { json, readBody, getAdmin, getBookingSystemForSite } = require('../../../lib/bookings/auth');
const { issuePortalToken, hashToken } = require('../../../lib/bookings/service');
const { createHireBooking, quoteHireBooking } = require('../../../lib/bookings/hire/service');
const fleet = require('../../../lib/bookings/hire/fleet');
const { computeHireWindow } = require('../../../lib/bookings/hire/duration');
const { resolveTerminology } = require('../../../lib/bookings/hire/terminology');
const { ymdInZone } = require('../../../lib/bookings/time');
const messages = require('../../../lib/bookings/hire/messages');
const cards = require('../../../lib/bookings/hire/card-checkout');

const HITS = new Map();
function limited(ip, max) {
  const now = Date.now();
  const a = (HITS.get(ip) || []).filter(function (t) { return now - t < 60000; });
  a.push(now);
  HITS.set(ip, a);
  return a.length > (max || 60);
}

const RESOURCE_PUBLIC = 'id,name,public_name,resource_type,make,model,year_built,image_url,images_json,hire_status,active,' +
  'default_daily_rate_cents,weekend_rate_cents,public_holiday_rate_cents,bond_cents,included_km,excess_km_rate_cents,' +
  'licence_class,carrying_capacity,transmission,min_hire_days,max_hire_days,description,calendar_colour,hire_meta,' +
  'prep_buffer_minutes,cleanup_buffer_minutes,cleaning_fee_cents';

function hireSettings(system) { return (system.settings && system.settings.hire) || {}; }

function txt(v, n) { return String(v == null ? '' : v).trim().slice(0, n || 200); }
function okYmd(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
function okHm(s) { return /^\d{2}:\d{2}$/.test(String(s || '')); }

async function loadSiteSystem(slug) {
  const admin = getAdmin();
  const { data: site } = await admin.from('sites').select('id,slug,business_name,custom_domain').eq('slug', slug).maybeSingle();
  if (!site) return null;
  const system = await getBookingSystemForSite(site.id);
  if (!system || !system.enabled) return null;
  return { site: site, system: system };
}

async function hireService(admin, system) {
  const { data } = await admin
    .from('booking_services')
    .select('*')
    .eq('booking_system_id', system.id)
    .eq('booking_type', 'resource_hire')
    .eq('status', 'active')
    .neq('visibility', 'private')
    .order('sort_order', { ascending: true })
    .limit(1);
  return (data && data[0]) || null;
}

async function loadFleet(admin, system) {
  const { data } = await admin
    .from('booking_resources')
    .select(RESOURCE_PUBLIC)
    .eq('booking_system_id', system.id)
    .neq('hire_status', 'archived')
    .order('name');
  return data || [];
}

/** The parts of a vehicle a customer may see (no rego, VIN or internal notes). */
function publicVehicle(r) {
  const meta = r.hire_meta || {};
  return {
    id: r.id,
    name: r.public_name || r.name,
    make: r.make || '',
    model: r.model || '',
    year: r.year_built || null,
    image_url: r.image_url || (Array.isArray(r.images_json) && r.images_json[0] && (r.images_json[0].url || r.images_json[0])) || '',
    description: r.description || '',
    features: Array.isArray(meta.features) ? meta.features.slice(0, 8) : [],
    licence_class: r.licence_class || '',
    carrying_capacity: r.carrying_capacity || '',
    transmission: r.transmission || '',
    included_km: r.included_km || null,
    excess_km_rate_cents: r.excess_km_rate_cents || null,
    bond_cents: r.bond_cents || 0
  };
}

function publicSettings(system, site) {
  const h = hireSettings(system);
  const terms = resolveTerminology(system);
  return {
    business: { name: system.business_name || site.business_name, phone: system.phone || '', email: system.email || '' },
    timezone: system.timezone || 'Australia/Sydney',
    terms: terms,
    open_time: okHm(h.open_time) ? h.open_time : '07:30',
    close_time: okHm(h.close_time) ? h.close_time : '17:00',
    time_step: Math.max(15, Math.min(120, Number(h.time_step) || 30)),
    durations: Array.isArray(h.durations) && h.durations.length ? h.durations : null,
    max_days: Math.max(1, Math.min(60, Number(h.max_public_days) || 30)),
    min_notice_days: Math.max(0, Number(h.min_notice_days) || 0),
    show_left: h.show_left !== false,
    booking_terms: txt(h.booking_terms, 4000),
    card_saving: cards.cardSavingAvailable(system),
    approval: true
  };
}

function sameHostReturn(req, url, site) {
  try {
    const u = new URL(String(url || ''));
    if (u.protocol !== 'https:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') return '';
    const reqHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase().replace(/:\d+$/, '');
    const allowed = [reqHost, 'leadpages.com.au', 'www.leadpages.com.au'];
    if (site.custom_domain) allowed.push(String(site.custom_domain).toLowerCase().replace(/^www\./, ''), 'www.' + String(site.custom_domain).toLowerCase().replace(/^www\./, ''));
    if (allowed.indexOf(u.hostname.toLowerCase()) < 0 && !/\.leadpages\.com\.au$/.test(u.hostname)) return '';
    ['bkh_ref', 'bkh_t', 'bkh_cs', 'bkh_cancel'].forEach(function (k) { u.searchParams.delete(k); });
    u.hash = '';
    return u.toString();
  } catch (_e) { return ''; }
}

async function bookingByToken(admin, system, ref, token) {
  if (!token) return null;
  const { data: tok } = await admin
    .from('booking_portal_tokens')
    .select('booking_id,expires_at,revoked_at')
    .eq('token_hash', hashToken(token))
    .eq('booking_system_id', system.id)
    .maybeSingle();
  if (!tok || tok.revoked_at || new Date(tok.expires_at) < new Date()) return null;
  const { data: booking } = await admin.from('bookings').select('*').eq('id', tok.booking_id).maybeSingle();
  if (!booking || (ref && booking.reference !== ref)) return null;
  return booking;
}

module.exports = async function (req, res) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  const admin = getAdmin();
  const url = new URL(req.url, 'https://x');

  if (req.method === 'GET') {
    if (limited(ip, 120)) return json(res, 429, { ok: false, error: 'rate_limit' });
    const slug = url.searchParams.get('slug');
    if (!slug) return json(res, 400, { ok: false, error: 'slug_required' });
    const pub = await loadSiteSystem(slug);
    if (!pub) return json(res, 404, { ok: false, error: 'not_found' });
    const system = pub.system;
    const tz = system.timezone || 'Australia/Sydney';
    const today = ymdInZone(new Date(), tz);
    const from = okYmd(url.searchParams.get('from')) ? url.searchParams.get('from') : today;
    let to = okYmd(url.searchParams.get('to')) ? url.searchParams.get('to') : fleet.addDaysYmd(from, 62);
    if (to < from) to = from;
    if (to > fleet.addDaysYmd(from, 120)) to = fleet.addDaysYmd(from, 120);
    const service = await hireService(admin, system);
    const resources = service ? await loadFleet(admin, system) : [];
    const fromIso = new Date(Date.parse(from + 'T00:00:00Z') - 2 * 86400000).toISOString();
    const toIso = new Date(Date.parse(to + 'T00:00:00Z') + 3 * 86400000).toISOString();
    const [reservations, blocks] = await Promise.all([
      fleet.loadAllReservations(admin, system.id, fromIso, toIso),
      fleet.loadBlocks(admin, system.id, fromIso, toIso)
    ]);
    const settings = publicSettings(system, pub.site);
    const pickupHm = okHm(url.searchParams.get('pickup_hm')) ? url.searchParams.get('pickup_hm') : settings.open_time;
    const days = fleet.fleetDays({ system: system, resources: resources, reservations: reservations, blocks: blocks, fromYmd: from, toYmd: to, pickupHm: pickupHm });
    return json(res, 200, {
      ok: true,
      live: !!service && days.total > 0,
      settings: settings,
      today: today,
      from: from,
      to: to,
      fleet_total: days.total,
      days: days.days
    });
  }

  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  const body = await readBody(req);
  const action = body.action;
  if (limited(ip, action === 'book' ? 12 : 60)) return json(res, 429, { ok: false, error: 'rate_limit' });
  const pub = body.slug ? await loadSiteSystem(String(body.slug)) : null;
  if (!pub) return json(res, 404, { ok: false, error: 'not_found' });
  const system = pub.system;
  const tz = system.timezone || 'Australia/Sydney';

  if (action === 'options' || action === 'book') {
    if (!okYmd(body.pickup_ymd) || !okHm(body.pickup_hm)) return json(res, 400, { ok: false, error: 'pickup_required' });
    const days = Math.max(1, Math.min(60, Math.round(Number(body.hire_days) || 1)));
    const today = ymdInZone(new Date(), tz);
    const settings = publicSettings(system, pub.site);
    if (body.pickup_ymd < fleet.addDaysYmd(today, settings.min_notice_days)) return json(res, 400, { ok: false, error: 'too_soon', message: 'Choose a later pick up date.' });
    if (days > settings.max_days) return json(res, 400, { ok: false, error: 'too_long', message: 'For hires over ' + settings.max_days + ' days, please call us.' });
    if (fleet.closedWeekday(system, body.pickup_ymd)) return json(res, 400, { ok: false, error: 'closed_day', message: 'We’re closed for pick ups that day.' });
    const service = await hireService(admin, system);
    if (!service) return json(res, 409, { ok: false, error: 'hire_not_set_up' });
    const resources = await loadFleet(admin, system);
    const win = computeHireWindow({ pickupYmd: body.pickup_ymd, pickupHm: body.pickup_hm, timezone: tz, durationMode: 'multi_day', hireDays: days, system: system, service: service });
    if (!win.ok) return json(res, 400, win);
    if (new Date(win.pickup_at) < new Date(Date.now() - 15 * 60000)) return json(res, 400, { ok: false, error: 'in_past', message: 'That pick up time has passed \u2014 choose a later time.' });

    // A repeat of a request we already took (double click / retry) gets the same answer.
    if (action === 'book' && txt(body.idempotency_key, 120)) {
      const { data: prior } = await admin.from('bookings').select('*').eq('booking_system_id', system.id).eq('idempotency_key', txt(body.idempotency_key, 120)).maybeSingle();
      if (prior) {
        const { data: ph } = await admin.from('booking_hire_details').select('*').eq('booking_id', prior.id).maybeSingle();
        return json(res, 200, { ok: true, reused: true, reference: prior.reference, status: prior.status, pickup_at: ph ? ph.pickup_at : prior.starts_at, return_at: ph ? ph.return_at : prior.ends_at, total_cents: prior.total_cents, bond_cents: ph ? ph.bond_cents : 0, checkout_url: null, portal_url: null });
      }
    }
    const pad = 3 * 86400000;
    const fromIso = new Date(Date.parse(win.pickup_at) - pad).toISOString();
    const toIso = new Date(Date.parse(win.return_at) + pad).toISOString();
    const [reservations, blocks] = await Promise.all([
      fleet.loadAllReservations(admin, system.id, fromIso, toIso),
      fleet.loadBlocks(admin, system.id, fromIso, toIso)
    ]);
    const jobs = fleet.jobsByDay(reservations, system);
    const maxJobs = require('../../../lib/bookings/hire/capacity').maxDailyJobs(system);
    const capFull = (win.occupied_days || []).some(function (d) { return (jobs[d] || 0) >= maxJobs; });

    const rows = [];
    for (const r of resources) {
      if (!fleet.isBookable(r)) continue;
      const minD = Number(r.min_hire_days) || 1;
      const maxD = Number(r.max_hire_days) || 0;
      const fitsLength = days >= minD && (!maxD || days <= maxD);
      const busyRows = fleet.reservationsFor(r.id, reservations, win.pickup_at, win.return_at, system);
      const busy = busyRows.length > 0;
      const blocked = fleet.blocksFor(r.id, blocks, win.pickup_at, win.return_at).length > 0;
      // Booked only because the last hire comes back later that morning? Offer that time.
      let freeFrom = '';
      if (busy && !blocked) {
        const alt = fleet.freeSomeTime(r, body.pickup_ymd, { reservations: reservations, blocks: blocks }, system, tz, body.pickup_hm);
        if (alt && alt > body.pickup_hm) {
          const altWin = computeHireWindow({ pickupYmd: body.pickup_ymd, pickupHm: alt, timezone: tz, durationMode: 'multi_day', hireDays: days, system: system, service: service });
          if (altWin.ok && !fleet.reservationsFor(r.id, reservations, altWin.pickup_at, altWin.return_at, system).length && !fleet.blocksFor(r.id, blocks, altWin.pickup_at, altWin.return_at).length) freeFrom = alt;
        }
      }
      const q = await quoteHireBooking({ system: system, service: service, resource: r, pickupYmd: body.pickup_ymd, pickupHm: body.pickup_hm, durationMode: 'multi_day', hireDays: days });
      rows.push({
        vehicle: publicVehicle(r),
        available: !busy && !blocked && !capFull && fitsLength,
        reason: busy || blocked || capFull ? 'booked' : (!fitsLength ? (days < minD ? 'min_days' : 'max_days') : ''),
        free_from: freeFrom || null,
        min_days: minD,
        max_days: maxD || null,
        quote: q.ok ? {
          total_cents: q.quote.total_cents,
          bond_cents: q.quote.bond_cents,
          gst_cents: q.quote.gst_cents,
          gst_mode: q.quote.gst_mode,
          day_rates: q.quote.day_rates,
          chargeable_days: q.quote.chargeable_days
        } : null
      });
    }
    const left = rows.filter(function (x) { return x.available; }).length;

    if (action === 'options') {
      return json(res, 200, {
        ok: true,
        window: { pickup_at: win.pickup_at, return_at: win.return_at, hire_days: win.hire_days, occupied_days: win.occupied_days },
        left: left,
        total: rows.length,
        options: rows
      });
    }

    // ---- book ----
    const pick = rows.find(function (x) { return x.vehicle.id === body.resource_id; });
    if (!pick) return json(res, 404, { ok: false, error: 'vehicle_not_found' });
    if (!pick.available) return json(res, 409, { ok: false, error: 'vehicle_taken', message: 'Sorry — that one has just been booked for those dates. Please choose another.' });
    const name = txt(body.name, 120), email = txt(body.email, 160).toLowerCase(), phone = txt(body.phone, 40);
    if (!name) return json(res, 400, { ok: false, error: 'name_required', message: 'Add your name.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { ok: false, error: 'email_required', message: 'Add a valid email.' });
    if (phone.replace(/[^0-9]/g, '').length < 8) return json(res, 400, { ok: false, error: 'phone_required', message: 'Add a mobile number.' });
    if (!body.accept_terms) return json(res, 400, { ok: false, error: 'terms_required', message: 'Please accept the hire terms.' });
    const resource = resources.find(function (r) { return r.id === body.resource_id; });
    const { data: fullResource } = await admin.from('booking_resources').select('*').eq('id', resource.id).maybeSingle();
    const driver = {
      name: name,
      licence_number: txt(body.licence_number, 40),
      licence_state: txt(body.licence_state, 20),
      licence_expiry: txt(body.licence_expiry, 20)
    };

    const result = await createHireBooking({
      admin: admin,
      system: system,
      service: service,
      resource: fullResource || resource,
      pickupYmd: body.pickup_ymd,
      pickupHm: body.pickup_hm,
      durationMode: 'multi_day',
      hireDays: days,
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
      customerNotes: txt(body.notes, 1500),
      driver: driver,
      cancellationPolicyAccepted: true,
      paymentAuthorityAccepted: !!body.save_card,
      source: 'public',
      status: 'pending',
      skipNotify: true,
      idempotencyKey: txt(body.idempotency_key, 120) || null
    });
    if (!result.ok) {
      const taken = result.error === 'resource_conflict' || result.error === 'daily_capacity_reached' || result.error === 'resource_blocked';
      return json(res, taken ? 409 : 400, { ok: false, error: result.error, message: taken ? 'Sorry — that one has just been booked for those dates. Please choose another.' : (result.message || 'We couldn’t take the booking online. Please call us.') });
    }
    const booking = result.booking;
    const portal = await issuePortalToken(booking, 'manage', 24 * 120);
    const portalUrl = '/booking-portal?t=' + encodeURIComponent(portal.token);

    let checkoutUrl = '';
    const wantsCard = !!body.save_card && cards.cardSavingAvailable(system);
    const back = wantsCard ? sameHostReturn(req, body.return_url, pub.site) : '';
    if (wantsCard && back && !result.reused) {
      const c = await cards.startCardCheckout({ admin: admin, system: system, booking: booking, portalToken: portal.token, returnUrl: back });
      if (c.ok) checkoutUrl = c.url;
    }
    if (!checkoutUrl && !result.reused) {
      // No card step: send the emails now. With a card step they go after Stripe returns.
      await messages.requestReceived(system, booking, result.hire, fullResource || resource, { portalUrl: portalUrl });
    }
    return json(res, 200, {
      ok: true,
      reference: booking.reference,
      status: booking.status,
      token: portal.token,
      portal_url: portalUrl,
      checkout_url: checkoutUrl || null,
      pickup_at: result.window.pickup_at,
      return_at: result.window.return_at,
      total_cents: booking.total_cents,
      bond_cents: (result.hire && result.hire.bond_cents) || 0,
      vehicle: publicVehicle(fullResource || resource)
    });
  }

  if (action === 'card_return') {
    const booking = await bookingByToken(admin, system, txt(body.ref, 40), txt(body.token, 200));
    if (!booking) return json(res, 404, { ok: false, error: 'not_found' });
    const { data: hire } = await admin.from('booking_hire_details').select('*').eq('booking_id', booking.id).maybeSingle();
    const { data: resource } = hire ? await admin.from('booking_resources').select('*').eq('id', hire.resource_id).maybeSingle() : { data: null };
    let cardSaved = false;
    let error = null;
    if (body.session_id && !body.cancelled) {
      const done = await cards.finishCardCheckout({ admin: admin, system: system, booking: booking, sessionId: body.session_id, ip: ip, userAgent: String(req.headers['user-agent'] || '').slice(0, 300) });
      cardSaved = !!(done && done.ok);
      if (!cardSaved) error = (done && done.error) || 'card_not_saved';
    }
    // Emails go once, on the first return from Stripe.
    const { data: sentAlready } = await admin.from('booking_notifications').select('id').eq('booking_id', booking.id).eq('template_key', 'hire_request_received').limit(1);
    if (!sentAlready || !sentAlready.length) {
      await messages.requestReceived(system, booking, hire, resource, { cardSaved: cardSaved, portalUrl: '/booking-portal?t=' + encodeURIComponent(body.token) });
    }
    return json(res, 200, {
      ok: true,
      reference: booking.reference,
      status: booking.status,
      card_saved: cardSaved,
      card_error: error,
      pickup_at: hire ? hire.pickup_at : booking.starts_at,
      return_at: hire ? hire.return_at : booking.ends_at,
      total_cents: booking.total_cents,
      bond_cents: hire ? hire.bond_cents : 0,
      vehicle: resource ? publicVehicle(resource) : null,
      portal_url: '/booking-portal?t=' + encodeURIComponent(body.token)
    });
  }

  return json(res, 400, { ok: false, error: 'unknown_action' });
};
