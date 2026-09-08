'use strict';

/**
 * POST /api/bookings/hire/quote
 * GET-ish quote for vehicle/equipment hire (staff + public with site slug).
 */

const {
  requireUser,
  assertSiteAccess,
  getBookingSystemForSite,
  json,
  readBody,
  getAdmin
} = require('../../../lib/bookings/auth');
const { quoteHireBooking } = require('../../../lib/bookings/hire/service');
const { checkHireAvailability } = require('../../../lib/bookings/hire/capacity');
const {
  loadResourceReservations,
  loadCapacityBookings
} = require('../../../lib/bookings/hire/service');

module.exports = async function (req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  const body = await readBody(req);
  const siteId = body.site_id;
  if (!siteId) return json(res, 400, { ok: false, error: 'site_id_required' });

  let system;
  if (body.public) {
    const admin = getAdmin();
    const { data } = await admin.from('booking_systems').select('*').eq('site_id', siteId).maybeSingle();
    system = data;
    if (!system || !system.enabled) return json(res, 404, { ok: false, error: 'not_found' });
  } else {
    const user = await requireUser(req);
    if (!user) return json(res, 401, { ok: false, error: 'auth' });
    const access = await assertSiteAccess(user, siteId);
    if (!access.ok) return json(res, access.code, { ok: false, error: access.error });
    system = await getBookingSystemForSite(siteId);
  }
  if (!system) return json(res, 404, { ok: false, error: 'system_not_found' });

  const admin = getAdmin();
  const { data: service } = await admin
    .from('booking_services')
    .select('*')
    .eq('id', body.service_id)
    .eq('booking_system_id', system.id)
    .maybeSingle();
  if (!service) return json(res, 404, { ok: false, error: 'service_not_found' });

  let resource = null;
  if (body.resource_id) {
    const r = await admin
      .from('booking_resources')
      .select('*')
      .eq('id', body.resource_id)
      .eq('booking_system_id', system.id)
      .maybeSingle();
    resource = r.data;
    if (!resource) return json(res, 404, { ok: false, error: 'resource_not_found' });
  }

  const quoted = await quoteHireBooking({
    system: system,
    service: service,
    resource: resource || {},
    pickupYmd: body.pickup_ymd,
    pickupHm: body.pickup_hm,
    durationMode: body.duration_mode,
    hireDays: body.hire_days,
    returnYmd: body.return_ymd,
    returnHm: body.return_hm,
    extras: body.extras,
    deliveryFeeCents: body.delivery_fee_cents,
    pickupFeeCents: body.pickup_fee_cents,
    cleaningFeeCents: body.cleaning_fee_cents,
    discountCents: body.discount_cents,
    includeBond: body.include_bond !== false
  });
  if (!quoted.ok) return json(res, 400, quoted);

  let availability = { ok: true, skipped: true };
  if (resource) {
    const reservations = await loadResourceReservations(
      admin,
      system.id,
      resource.id,
      quoted.window.pickup_at,
      quoted.window.return_at
    );
    const existing = await loadCapacityBookings(
      admin,
      system.id,
      quoted.window.pickup_at,
      quoted.window.return_at
    );
    availability = checkHireAvailability({
      system: system,
      resourceId: resource.id,
      startsAt: quoted.window.pickup_at,
      endsAt: quoted.window.return_at,
      reservations: reservations,
      existingBookings: existing,
      override: !!body.capacity_override && !body.public,
      excludeBookingId: body.exclude_booking_id
    });
  }

  return json(res, 200, {
    ok: true,
    window: quoted.window,
    quote: quoted.quote,
    terminology: quoted.terminology,
    availability: availability
  });
};
