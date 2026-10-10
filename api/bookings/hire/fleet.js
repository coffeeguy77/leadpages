'use strict';

/**
 * Staff fleet + hire desk API (Bookings → Fleet / Fleet calendar / Requests / phone bookings).
 * POST /api/bookings/hire/fleet  { site_id, action, ... }  — signed-in staff with site access.
 *
 * actions:
 *   overview        { from, to }               vehicles, blocks, hires in range, requests, settings
 *   save_vehicle    { vehicle }                 add / edit a vehicle (make, model, rego, rates…)
 *   archive_vehicle { id }
 *   add_block       { resource_id|null, from_ymd, to_ymd, kind, reason }  mark unavailable
 *   remove_block    { id }
 *   approve         { booking_id, note }        pending request → confirmed (+ email)
 *   decline         { booking_id, reason }      pending request → cancelled (+ email)
 *   set_status      { booking_id, status }      picked up (in_progress) / returned (completed) / no_show
 *   cancel          { booking_id, reason, email }
 *   phone_booking   { resource_id, pickup_ymd, pickup_hm, hire_days, name, phone, email, notes,
 *                     licence_number, licence_state, licence_expiry, status, send_email, override }
 *   options         { pickup_ymd, pickup_hm, hire_days }  vehicles + prices + free/busy for staff
 *   charge          { booking_id, amount_cents, description }  charge the saved card
 *   settings        { hire, business, stripe_connect_account_id, enabled }
 *   setup_hire      { preset }                  create the hire service + switch Bookings on
 */

const {
  requireUser,
  assertSiteAccess,
  getBookingSystemForSite,
  ensureBookingSystem,
  json,
  readBody,
  getAdmin
} = require('../../../lib/bookings/auth');
const { createHireBooking, quoteHireBooking, previewHireCancellation } = require('../../../lib/bookings/hire/service');
const { transitionBooking, issuePortalToken } = require('../../../lib/bookings/service');
const { canTransition } = require('../../../lib/bookings/status');
const fleet = require('../../../lib/bookings/hire/fleet');
const { computeHireWindow } = require('../../../lib/bookings/hire/duration');
const { maxDailyJobs } = require('../../../lib/bookings/hire/capacity');
const { resolveTerminology, PRESETS } = require('../../../lib/bookings/hire/terminology');
const { ymdInZone, wallTimeToUtc } = require('../../../lib/bookings/time');
const messages = require('../../../lib/bookings/hire/messages');
const cards = require('../../../lib/bookings/hire/card-checkout');
const { createOffSessionCharge } = require('../../../lib/bookings/hire/card-on-file');
const presets = require('../../../lib/bookings/presets');

function txt(v, n) { return String(v == null ? '' : v).trim().slice(0, n || 200); }
function cents(v) { if (v === '' || v == null) return null; const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 ? n : null; }
function int(v) { if (v === '' || v == null) return null; const n = Math.round(Number(v)); return Number.isFinite(n) ? n : null; }
function okYmd(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
function okHm(s) { return /^\d{2}:\d{2}$/.test(String(s || '')); }
function dateOrNull(v) { return okYmd(v) ? v : null; }

const VEHICLE_TYPES = ['vehicle', 'equipment', 'machine', 'cart', 'room', 'venue', 'chair', 'station', 'other'];
const STATUSES = ['active', 'maintenance', 'unavailable'];

async function hireService(admin, system) {
  const { data } = await admin
    .from('booking_services')
    .select('*')
    .eq('booking_system_id', system.id)
    .eq('booking_type', 'resource_hire')
    .neq('status', 'archived')
    .order('sort_order', { ascending: true })
    .limit(1);
  return (data && data[0]) || null;
}

async function loadHireBooking(admin, system, bookingId) {
  const { data: booking } = await admin.from('bookings').select('*').eq('id', bookingId).eq('booking_system_id', system.id).maybeSingle();
  if (!booking) return null;
  const { data: hire } = await admin.from('booking_hire_details').select('*').eq('booking_id', booking.id).maybeSingle();
  const { data: resource } = hire ? await admin.from('booking_resources').select('*').eq('id', hire.resource_id).maybeSingle() : { data: null };
  return { booking: booking, hire: hire, resource: resource };
}

function vehicleRow(v, system) {
  const row = {
    name: txt(v.name, 120) || [txt(v.make, 60), txt(v.model, 60)].filter(Boolean).join(' ') || 'Vehicle',
    public_name: txt(v.public_name, 120),
    resource_type: VEHICLE_TYPES.indexOf(v.resource_type) >= 0 ? v.resource_type : 'vehicle',
    make: txt(v.make, 60),
    model: txt(v.model, 60),
    year_built: int(v.year_built),
    registration_number: txt(v.registration_number, 20).toUpperCase(),
    fleet_number: txt(v.fleet_number, 30),
    vin_or_serial: txt(v.vin_or_serial, 40),
    calendar_colour: /^#[0-9a-fA-F]{6}$/.test(String(v.calendar_colour || '')) ? v.calendar_colour : '#155c4a',
    image_url: txt(v.image_url, 600) || null,
    description: txt(v.description, 2000),
    default_daily_rate_cents: cents(v.default_daily_rate_cents) || 0,
    weekend_rate_cents: cents(v.weekend_rate_cents),
    public_holiday_rate_cents: cents(v.public_holiday_rate_cents),
    bond_cents: cents(v.bond_cents) || 0,
    included_km: int(v.included_km),
    excess_km_rate_cents: cents(v.excess_km_rate_cents),
    cleaning_fee_cents: cents(v.cleaning_fee_cents) || 0,
    licence_class: txt(v.licence_class, 40),
    carrying_capacity: txt(v.carrying_capacity, 80),
    transmission: txt(v.transmission, 40),
    min_hire_days: Math.max(1, int(v.min_hire_days) || 1),
    max_hire_days: int(v.max_hire_days) || null,
    odometer_km: int(v.odometer_km),
    registration_expires_on: dateOrNull(v.registration_expires_on),
    insurance_expires_on: dateOrNull(v.insurance_expires_on),
    service_due_on: dateOrNull(v.service_due_on),
    current_location: txt(v.current_location, 120),
    hire_status: STATUSES.indexOf(v.hire_status) >= 0 ? v.hire_status : 'active',
    active: true,
    updated_at: new Date().toISOString()
  };
  const dayRates = {};
  const dr = v.day_rates || {};
  fleet.DAY_KEYS.forEach(function (k) { const c = cents(dr[k]); if (c != null) dayRates[k] = c; });
  row.hire_meta = {
    day_rates: dayRates,
    features: (Array.isArray(v.features) ? v.features : String(v.features || '').split('\n'))
      .map(function (f) { return txt(f, 80); }).filter(Boolean).slice(0, 12),
    staff_notes: txt(v.staff_notes, 2000)
  };
  return row;
}

/**
 * The card saved for a booking. A returning customer who reuses the same card
 * moves that card row to their newest booking, so fall back to the customer's
 * default (or newest) attached card.
 */
async function cardForBooking(admin, system, booking) {
  const { data: own } = await admin.from('booking_payment_methods').select('*')
    .eq('booking_system_id', system.id).eq('booking_id', booking.id)
    .order('created_at', { ascending: false }).limit(1);
  if (own && own[0]) return own[0];
  if (!booking.customer_id) return null;
  const { data: theirs } = await admin.from('booking_payment_methods').select('*')
    .eq('booking_system_id', system.id).eq('customer_id', booking.customer_id).eq('provider_status', 'attached')
    .order('is_default', { ascending: false }).order('created_at', { ascending: false }).limit(1);
  return (theirs && theirs[0]) || null;
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  const user = await requireUser(req);
  if (!user) return json(res, 401, { ok: false, error: 'auth' });
  const body = await readBody(req);
  const access = await assertSiteAccess(user, body.site_id);
  if (!access.ok) return json(res, access.code, { ok: false, error: access.error });
  const admin = getAdmin();
  let system = await getBookingSystemForSite(body.site_id);
  if (!system) {
    const { data: site } = await admin.from('sites').select('id,business_name,config').eq('id', body.site_id).maybeSingle();
    system = await ensureBookingSystem(body.site_id, { site: site });
  }
  if (!system) return json(res, 404, { ok: false, error: 'system_not_found' });
  const tz = system.timezone || 'Australia/Sydney';
  const action = body.action || 'overview';

  // ---------------------------------------------------------------- overview
  if (action === 'overview') {
    const today = ymdInZone(new Date(), tz);
    const from = okYmd(body.from) ? body.from : today;
    const to = okYmd(body.to) && body.to >= from ? body.to : fleet.addDaysYmd(from, 13);
    const fromIso = wallTimeToUtc(from, '00:00', tz).toISOString();
    const toIso = wallTimeToUtc(fleet.addDaysYmd(to, 1), '00:00', tz).toISOString();
    const [{ data: vehicles }, reservations, blocks, service, { data: pendingRows }] = await Promise.all([
      admin.from('booking_resources').select('*').eq('booking_system_id', system.id).neq('hire_status', 'archived').order('name'),
      fleet.loadAllReservations(admin, system.id, fromIso, toIso),
      fleet.loadBlocks(admin, system.id, fromIso, toIso),
      hireService(admin, system),
      admin.from('bookings').select('id,reference,status,customer_name,customer_phone,customer_email,customer_notes,starts_at,ends_at,total_cents,created_at,source')
        .eq('booking_system_id', system.id).eq('booking_type', 'resource_hire').eq('status', 'pending').order('starts_at').limit(100)
    ]);
    const pendingIds = (pendingRows || []).map(function (b) { return b.id; });
    const { data: pendingHire } = pendingIds.length
      ? await admin.from('booking_hire_details').select('booking_id,resource_id,pickup_at,return_at,bond_cents,card_on_file_status,driver_json,hire_days').in('booking_id', pendingIds)
      : { data: [] };
    const hireBy = {};
    (pendingHire || []).forEach(function (h) { hireBy[h.booking_id] = h; });
    const { data: upcoming } = await admin.from('booking_hire_details')
      .select('booking_id,resource_id,pickup_at,return_at,card_on_file_status,bookings!inner(id,reference,status,customer_name,customer_phone,total_cents,payment_status)')
      .eq('booking_system_id', system.id)
      .gte('return_at', new Date(Date.now() - 86400000).toISOString())
      .lte('pickup_at', new Date(Date.now() + 8 * 86400000).toISOString())
      .order('pickup_at');
    return json(res, 200, {
      ok: true,
      today: today,
      from: from,
      to: to,
      timezone: tz,
      terms: resolveTerminology(system),
      system: {
        enabled: !!system.enabled,
        business_name: system.business_name || '',
        phone: system.phone || '',
        email: system.email || '',
        stripe_connect_account_id: system.stripe_connect_account_id || '',
        card_saving: cards.cardSavingAvailable(system),
        hire: (system.settings && system.settings.hire) || {},
        max_daily_jobs: maxDailyJobs(system)
      },
      service: service ? { id: service.id, name: service.name, status: service.status } : null,
      vehicles: vehicles || [],
      reservations: reservations,
      blocks: blocks,
      requests: (pendingRows || []).map(function (b) { return Object.assign({}, b, { hire: hireBy[b.id] || null }); }),
      movements: (upcoming || []).map(function (u) { return Object.assign({ resource_id: u.resource_id, pickup_at: u.pickup_at, return_at: u.return_at, card_on_file_status: u.card_on_file_status }, u.bookings || {}); })
        .filter(function (m) { return ['pending', 'confirmed', 'checked_in', 'in_progress'].indexOf(m.status) >= 0; })
    });
  }

  // ---------------------------------------------------------------- vehicles
  if (action === 'save_vehicle') {
    const v = body.vehicle || {};
    const row = vehicleRow(v, system);
    if (v.id) {
      const { data: cur } = await admin.from('booking_resources').select('id,hire_meta').eq('id', v.id).eq('booking_system_id', system.id).maybeSingle();
      if (!cur) return json(res, 404, { ok: false, error: 'not_found' });
      row.hire_meta = Object.assign({}, cur.hire_meta || {}, row.hire_meta);
      const { data, error } = await admin.from('booking_resources').update(row).eq('id', v.id).eq('booking_system_id', system.id).select('*').single();
      if (error) return json(res, 400, { ok: false, error: error.message });
      return json(res, 200, { ok: true, vehicle: data });
    }
    const { data, error } = await admin.from('booking_resources').insert(Object.assign(row, {
      booking_system_id: system.id,
      site_id: system.site_id,
      quantity: 1
    })).select('*').single();
    if (error) return json(res, 400, { ok: false, error: error.message });
    return json(res, 200, { ok: true, vehicle: data });
  }

  if (action === 'archive_vehicle') {
    const { error } = await admin.from('booking_resources').update({ hire_status: 'archived', active: false, updated_at: new Date().toISOString() })
      .eq('id', body.id).eq('booking_system_id', system.id);
    if (error) return json(res, 400, { ok: false, error: error.message });
    return json(res, 200, { ok: true });
  }

  // ---------------------------------------------------------------- unavailable periods
  if (action === 'add_block') {
    if (!okYmd(body.from_ymd)) return json(res, 400, { ok: false, error: 'from_required' });
    const toYmd = okYmd(body.to_ymd) && body.to_ymd >= body.from_ymd ? body.to_ymd : body.from_ymd;
    const kind = ['maintenance', 'block', 'closed'].indexOf(body.kind) >= 0 ? body.kind : 'block';
    const startsAt = wallTimeToUtc(body.from_ymd, okHm(body.from_hm) ? body.from_hm : '00:00', tz).toISOString();
    const endsAt = okHm(body.to_hm)
      ? wallTimeToUtc(toYmd, body.to_hm, tz).toISOString()
      : wallTimeToUtc(fleet.addDaysYmd(toYmd, 1), '00:00', tz).toISOString();
    if (body.resource_id) {
      const { data: r } = await admin.from('booking_resources').select('id').eq('id', body.resource_id).eq('booking_system_id', system.id).maybeSingle();
      if (!r) return json(res, 404, { ok: false, error: 'vehicle_not_found' });
    }
    const row = {
      booking_system_id: system.id,
      site_id: system.site_id,
      scope: body.resource_id ? 'resource' : 'business',
      scope_id: body.resource_id || null,
      kind: body.resource_id ? kind : 'closed',
      title: txt(body.reason, 200) || (kind === 'maintenance' ? 'Repairs' : 'Unavailable'),
      starts_at: startsAt,
      ends_at: endsAt
    };
    const { data, error } = await admin.from('booking_schedule_exceptions').insert(row).select('*').single();
    if (error) return json(res, 400, { ok: false, error: error.message });
    // Warn about hires already booked in that period.
    const res2 = await fleet.loadAllReservations(admin, system.id, startsAt, endsAt);
    const clashes = res2.filter(function (r) {
      return (!body.resource_id || String(r.resource_id) === String(body.resource_id)) &&
        ['pending', 'confirmed', 'checked_in', 'in_progress'].indexOf(r.status) >= 0;
    });
    return json(res, 200, { ok: true, block: data, clashes: clashes });
  }

  if (action === 'remove_block') {
    const { error } = await admin.from('booking_schedule_exceptions').delete().eq('id', body.id).eq('booking_system_id', system.id);
    if (error) return json(res, 400, { ok: false, error: error.message });
    return json(res, 200, { ok: true });
  }

  // ---------------------------------------------------------------- one booking (staff panel)
  if (action === 'booking') {
    const found = await loadHireBooking(admin, system, body.booking_id);
    if (!found) return json(res, 404, { ok: false, error: 'not_found' });
    const savedCard = await cardForBooking(admin, system, found.booking);
    const pms = savedCard ? [{ brand: savedCard.brand, last4: savedCard.last4, exp_month: savedCard.exp_month, exp_year: savedCard.exp_year, created_at: savedCard.created_at }] : [];
    const { data: activity } = await admin.from('booking_activity').select('summary,created_at').eq('booking_id', found.booking.id).order('created_at', { ascending: false }).limit(20);
    let cancellation = null;
    if (found.hire && ['pending', 'confirmed'].indexOf(found.booking.status) >= 0) {
      try { cancellation = previewHireCancellation({ system: system, hire: found.hire, booking: found.booking }); } catch (_e) { cancellation = null; }
    }
    return json(res, 200, { ok: true, booking: found.booking, hire: found.hire, vehicle: found.resource, card: (pms && pms[0]) || null, activity: activity || [], cancellation: cancellation, can_charge: cards.cardSavingAvailable(system) && !!(pms && pms[0]) });
  }

  // ---------------------------------------------------------------- requests + statuses
  if (action === 'approve' || action === 'decline' || action === 'cancel' || action === 'set_status') {
    const found = await loadHireBooking(admin, system, body.booking_id);
    if (!found) return json(res, 404, { ok: false, error: 'not_found' });
    const b = found.booking;
    const to = action === 'approve' ? 'confirmed'
      : (action === 'decline' || action === 'cancel') ? 'cancelled'
        : String(body.status || '');
    if (['confirmed', 'cancelled', 'in_progress', 'completed', 'no_show'].indexOf(to) < 0) return json(res, 400, { ok: false, error: 'bad_status' });
    if (!canTransition(b.status, to)) return json(res, 400, { ok: false, error: 'invalid_status_transition', from: b.status, to: to });
    let fee = null;
    if (action === 'cancel' && found.hire) {
      try { fee = previewHireCancellation({ system: system, hire: found.hire, booking: b }); } catch (_e) { fee = null; }
    }
    const r = await transitionBooking(b, to, { actorUserId: user.id, reason: txt(body.reason || body.note, 500) || action });
    if (!r.ok) return json(res, 409, r);
    if (action === 'set_status' && found.hire) {
      // Returned early: free the vehicle from now.
      if (to === 'completed' && new Date(found.hire.return_at) > new Date()) {
        await admin.from('booking_hire_details').update({ meta: Object.assign({}, found.hire.meta || {}, { returned_at: new Date().toISOString() }), updated_at: new Date().toISOString() }).eq('booking_id', b.id);
      }
      if (to === 'in_progress') {
        await admin.from('booking_hire_details').update({ meta: Object.assign({}, found.hire.meta || {}, { picked_up_at: new Date().toISOString() }), updated_at: new Date().toISOString() }).eq('booking_id', b.id);
      }
    }
    const portal = (action === 'approve') ? await issuePortalToken(r.booking, 'manage', 24 * 120) : null;
    if (action === 'approve' && body.email !== false) await messages.confirmed(system, r.booking, found.hire, found.resource, { note: txt(body.note, 500), portalUrl: portal ? '/booking-portal?t=' + encodeURIComponent(portal.token) : '' });
    if (action === 'decline' && body.email !== false) await messages.declined(system, r.booking, found.hire, found.resource, { reason: txt(body.reason, 500) });
    if (action === 'cancel' && body.email) await messages.cancelled(system, r.booking, found.hire, found.resource, { reason: txt(body.reason, 500) });
    return json(res, 200, { ok: true, booking: r.booking, cancellation: fee });
  }

  // ---------------------------------------------------------------- staff options + phone bookings
  if (action === 'options' || action === 'phone_booking') {
    if (!okYmd(body.pickup_ymd) || !okHm(body.pickup_hm)) return json(res, 400, { ok: false, error: 'pickup_required' });
    const days = Math.max(1, Math.min(365, Math.round(Number(body.hire_days) || 1)));
    const service = await hireService(admin, system);
    if (!service) return json(res, 409, { ok: false, error: 'hire_not_set_up', message: 'Set up hire first (Fleet → Set up).' });
    const win = computeHireWindow({ pickupYmd: body.pickup_ymd, pickupHm: body.pickup_hm, timezone: tz, durationMode: 'multi_day', hireDays: days, system: system, service: service });
    if (!win.ok) return json(res, 400, win);

    if (action === 'options') {
      const { data: vehicles } = await admin.from('booking_resources').select('*').eq('booking_system_id', system.id).neq('hire_status', 'archived').order('name');
      const pad = 3 * 86400000;
      const fromIso = new Date(Date.parse(win.pickup_at) - pad).toISOString();
      const toIso = new Date(Date.parse(win.return_at) + pad).toISOString();
      const [reservations, blocks] = await Promise.all([
        fleet.loadAllReservations(admin, system.id, fromIso, toIso),
        fleet.loadBlocks(admin, system.id, fromIso, toIso)
      ]);
      const out = [];
      for (const v of vehicles || []) {
        const busy = fleet.reservationsFor(v.id, reservations, win.pickup_at, win.return_at, system);
        const blocked = fleet.blocksFor(v.id, blocks, win.pickup_at, win.return_at);
        const q = await quoteHireBooking({ system: system, service: service, resource: v, pickupYmd: body.pickup_ymd, pickupHm: body.pickup_hm, durationMode: 'multi_day', hireDays: days });
        out.push({
          vehicle: v,
          available: fleet.isBookable(v) && !busy.length && !blocked.length,
          off_road: !fleet.isBookable(v),
          busy: busy.map(function (x) { return { reference: x.reference, customer_name: x.customer_name, starts_at: x.starts_at, ends_at: x.ends_at, status: x.status }; }),
          blocked: blocked.map(function (x) { return { title: x.title, kind: x.kind, starts_at: x.starts_at, ends_at: x.ends_at }; }),
          quote: q.ok ? q.quote : null
        });
      }
      return json(res, 200, { ok: true, window: win, options: out });
    }

    const { data: resource } = await admin.from('booking_resources').select('*').eq('id', body.resource_id).eq('booking_system_id', system.id).maybeSingle();
    if (!resource) return json(res, 404, { ok: false, error: 'vehicle_not_found' });
    const name = txt(body.name, 120);
    if (!name) return json(res, 400, { ok: false, error: 'name_required', message: 'Add the customer’s name.' });
    if (!txt(body.phone) && !txt(body.email)) return json(res, 400, { ok: false, error: 'contact_required', message: 'Add a phone number or email.' });
    const status = body.status === 'pending' ? 'pending' : 'confirmed';
    const result = await createHireBooking({
      admin: admin,
      system: system,
      service: service,
      resource: resource,
      pickupYmd: body.pickup_ymd,
      pickupHm: body.pickup_hm,
      durationMode: 'multi_day',
      hireDays: days,
      customerName: name,
      customerEmail: txt(body.email, 160).toLowerCase(),
      customerPhone: txt(body.phone, 40),
      customerNotes: txt(body.notes, 1500),
      internalNotes: txt(body.internal_notes, 1500),
      driver: { name: name, licence_number: txt(body.licence_number, 40), licence_state: txt(body.licence_state, 20), licence_expiry: txt(body.licence_expiry, 20) },
      source: 'admin',
      status: status,
      skipNotify: true,
      capacityOverride: !!body.override,
      capacityOverrideReason: body.override ? 'Booked by staff' : '',
      allowResourceOverride: !!body.override,
      allowUnavailable: !!body.override,
      actorUserId: user.id,
      manualAdjustmentCents: int(body.adjustment_cents) || 0,
      manualAdjustmentReason: txt(body.adjustment_reason, 120),
      idempotencyKey: txt(body.idempotency_key, 120) || null
    });
    if (!result.ok) return json(res, 409, result);
    if (body.send_email && result.booking.customer_email && !result.reused) {
      const portal = await issuePortalToken(result.booking, 'manage', 24 * 120);
      const pu = '/booking-portal?t=' + encodeURIComponent(portal.token);
      if (status === 'confirmed') await messages.confirmed(system, result.booking, result.hire, resource, { portalUrl: pu });
      else await messages.requestReceived(system, result.booking, result.hire, resource, { portalUrl: pu });
    }
    return json(res, 200, { ok: true, booking: result.booking, hire: result.hire, quote: result.quote });
  }

  // ---------------------------------------------------------------- charge the saved card
  if (action === 'charge') {
    const found = await loadHireBooking(admin, system, body.booking_id);
    if (!found) return json(res, 404, { ok: false, error: 'not_found' });
    const amount = cents(body.amount_cents);
    if (!amount || amount < 50) return json(res, 400, { ok: false, error: 'amount_required' });
    if (!cards.cardSavingAvailable(system)) return json(res, 409, { ok: false, error: 'stripe_not_connected' });
    const pm = await cardForBooking(admin, system, found.booking);
    if (!pm) return json(res, 409, { ok: false, error: 'no_card', message: 'No saved card on this booking.' });
    const charge = await createOffSessionCharge({ system: system, paymentMethod: pm, amountCents: amount, bookingId: found.booking.id, purpose: txt(body.description, 60) || 'hire_charge' });
    if (!charge.ok) return json(res, 402, { ok: false, error: charge.error, message: charge.error === 'authentication_required' ? 'The bank wants the customer to approve this payment — take payment in person or send a payment link.' : 'The card was declined.' });
    const paid = (Number(found.booking.amount_paid_cents) || 0) + amount;
    await admin.from('bookings').update({
      amount_paid_cents: paid,
      payment_status: paid >= (Number(found.booking.total_cents) || 0) ? 'paid' : 'deposit_paid',
      updated_at: new Date().toISOString()
    }).eq('id', found.booking.id);
    await admin.from('booking_activity').insert({
      booking_id: found.booking.id,
      booking_system_id: system.id,
      site_id: system.site_id,
      event_type: 'card_charged',
      summary: 'Card charged ' + messages.money(amount) + (body.description ? ' — ' + txt(body.description, 80) : ''),
      meta: { payment_intent: charge.payment_intent && charge.payment_intent.id, amount_cents: amount },
      actor_user_id: user.id
    });
    return json(res, 200, { ok: true, amount_paid_cents: paid });
  }

  // ---------------------------------------------------------------- settings + set-up
  if (action === 'settings') {
    const cur = (system.settings && system.settings.hire) || {};
    const h = body.hire || {};
    const next = Object.assign({}, cur);
    if (h.open_time !== undefined) next.open_time = okHm(h.open_time) ? h.open_time : '07:30';
    if (h.close_time !== undefined) next.close_time = okHm(h.close_time) ? h.close_time : '17:00';
    if (h.time_step !== undefined) next.time_step = Math.max(15, Math.min(120, int(h.time_step) || 30));
    if (h.min_notice_days !== undefined) next.min_notice_days = Math.max(0, Math.min(30, int(h.min_notice_days) || 0));
    if (h.max_public_days !== undefined) next.max_public_days = Math.max(1, Math.min(60, int(h.max_public_days) || 30));
    if (h.max_daily_hire_jobs !== undefined) next.max_daily_hire_jobs = Math.max(1, Math.min(500, int(h.max_daily_hire_jobs) || 4));
    if (h.closed_weekdays !== undefined) next.closed_weekdays = (Array.isArray(h.closed_weekdays) ? h.closed_weekdays : []).map(Number).filter(function (n) { return n >= 0 && n <= 6; });
    if (h.public_holidays !== undefined) next.public_holidays = (Array.isArray(h.public_holidays) ? h.public_holidays : String(h.public_holidays || '').split(/[\s,]+/)).filter(okYmd).slice(0, 60);
    if (h.public_holiday_rate_cents !== undefined) next.public_holiday_rate_cents = cents(h.public_holiday_rate_cents);
    if (h.booking_terms !== undefined) next.booking_terms = txt(h.booking_terms, 4000);
    if (h.show_left !== undefined) next.show_left = h.show_left !== false;
    if (h.durations !== undefined) next.durations = (Array.isArray(h.durations) ? h.durations : []).map(function (d) { return { label: txt(d.label, 40), days: Math.max(1, Math.min(60, int(d.days) || 1)) }; }).filter(function (d) { return d.label; }).slice(0, 12);
    if (h.terminology !== undefined && h.terminology && PRESETS[h.terminology]) next.terminology = { preset: h.terminology };
    const patch = { settings: Object.assign({}, system.settings || {}, { hire: next }), updated_at: new Date().toISOString() };
    const bz = body.business || {};
    if (bz.business_name !== undefined) patch.business_name = txt(bz.business_name, 120);
    if (bz.phone !== undefined) patch.phone = txt(bz.phone, 40);
    if (bz.email !== undefined) patch.email = txt(bz.email, 160);
    if (body.stripe_connect_account_id !== undefined) {
      const acct = txt(body.stripe_connect_account_id, 60);
      if (acct && !/^acct_[A-Za-z0-9]+$/.test(acct)) return json(res, 400, { ok: false, error: 'bad_stripe_account', message: 'Stripe account IDs start with acct_.' });
      patch.stripe_connect_account_id = acct || null;
    }
    if (body.enabled !== undefined) patch.enabled = !!body.enabled;
    const { data, error } = await admin.from('booking_systems').update(patch).eq('id', system.id).select('*').single();
    if (error) return json(res, 400, { ok: false, error: error.message });
    return json(res, 200, { ok: true, system: data });
  }

  if (action === 'presets') {
    return json(res, 200, { ok: true, presets: presets.list(), current: (system.settings && system.settings.preset) || null });
  }

  if (action === 'setup_hire' || action === 'apply_preset') {
    const preset = presets.get(body.preset || 'truck_hire');
    if (!preset) return json(res, 400, { ok: false, error: 'bad_preset' });
    if (action === 'setup_hire' && preset.kind !== 'hire') return json(res, 400, { ok: false, error: 'bad_preset' });
    // Hire presets switch Bookings on straight away (nothing shows until vehicles are added);
    // slot/class presets wait for prices + hours to be checked.
    const out = await presets.apply(admin, system, preset, { enable: preset.kind === 'hire' || !!body.enable });
    return json(res, out.ok ? 200 : 400, out);
  }

  return json(res, 400, { ok: false, error: 'unknown_action' });
};
