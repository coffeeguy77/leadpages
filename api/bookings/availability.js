'use strict';

/**
 * GET/POST /api/bookings/availability
 * Staff + public slot lookup and “why unavailable” explainer.
 */

const {
  requireUser,
  assertSiteAccess,
  getBookingSystemForSite,
  ensureBookingSystem,
  json,
  readBody,
  getAdmin
} = require('../../lib/bookings/auth');
const { getAvailableSlots, explainUnavailable } = require('../../lib/bookings/availability');
const { loadAvailabilityContext } = require('../../lib/bookings/service');
const { addMinutes, ymdInZone } = require('../../lib/bookings/time');

async function resolveSystemPublic(slug) {
  const admin = getAdmin();
  const { data: site } = await admin.from('sites').select('id,slug,business_name').eq('slug', slug).maybeSingle();
  if (!site) return null;
  let system = await getBookingSystemForSite(site.id);
  if (!system || !system.enabled) return null;
  return { site: site, system: system };
}

module.exports = async function (req, res) {
  const url = new URL(req.url, 'https://x');
  const body = req.method === 'GET' ? {} : await readBody(req);
  const admin = getAdmin();

  // Public path: ?slug=&service_id=&date=
  const slug = url.searchParams.get('slug') || body.slug;
  let system;
  let site;
  let actorUserId = null;

  if (slug) {
    const pub = await resolveSystemPublic(slug);
    if (!pub) return json(res, 404, { ok: false, error: 'not_found' });
    system = pub.system;
    site = pub.site;
  } else {
    const user = await requireUser(req);
    if (!user) return json(res, 401, { ok: false, error: 'auth' });
    const siteId = url.searchParams.get('site_id') || body.site_id;
    const access = await assertSiteAccess(user, siteId);
    if (!access.ok) return json(res, access.code, { ok: false, error: access.error });
    system = await getBookingSystemForSite(siteId);
    if (!system) system = await ensureBookingSystem(siteId, { site: access.site });
    site = access.site;
    actorUserId = user.id;
  }

  const serviceId = url.searchParams.get('service_id') || body.service_id;
  if (!serviceId) return json(res, 400, { ok: false, error: 'service_id_required' });
  const { data: service } = await admin
    .from('booking_services')
    .select('*')
    .eq('id', serviceId)
    .eq('booking_system_id', system.id)
    .maybeSingle();
  if (!service || (slug && (service.status !== 'active' || service.visibility === 'private'))) {
    return json(res, 404, { ok: false, error: 'service_not_found' });
  }

  const dateYmd = url.searchParams.get('date') || body.date;
  const teamMemberId = url.searchParams.get('team_member_id') || body.team_member_id || null;
  const explain = url.searchParams.get('explain') === '1' || body.explain === true;

  if (explain) {
    const startsAt = body.starts_at || url.searchParams.get('starts_at');
    if (!startsAt) return json(res, 400, { ok: false, error: 'starts_at_required' });
    const start = new Date(startsAt);
    const ctx = await loadAvailabilityContext(system, service, {
      from: addMinutes(start, -180).toISOString(),
      to: addMinutes(start, 180).toISOString(),
      teamMemberId: teamMemberId
    });
    const result = explainUnavailable({
      system: system,
      service: service,
      startsAt: startsAt,
      businessRules: ctx.businessRules,
      serviceRules: ctx.serviceRules,
      teamRules: ctx.teamRules,
      exceptions: ctx.exceptions,
      existingBookings: ctx.existingBookings,
      holds: ctx.holds,
      teamMemberId: teamMemberId
    });
    return json(res, 200, Object.assign({ ok: true }, result));
  }

  // Month view: ?month=YYYY-MM → per-day counts for the booking calendar.
  const month = url.searchParams.get('month') || body.month;
  if (month && !dateYmd) {
    if (!/^\d{4}-\d{2}$/.test(String(month))) return json(res, 400, { ok: false, error: 'bad_month' });
    const y = Number(month.slice(0, 4));
    const m = Number(month.slice(5, 7));
    const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const first = month + '-01T00:00:00.000Z';
    const mctx = await loadAvailabilityContext(system, service, {
      from: addMinutes(new Date(first), -24 * 60).toISOString(),
      to: addMinutes(new Date(first), (daysIn + 2) * 24 * 60).toISOString(),
      teamMemberId: teamMemberId
    });
    const days = {};
    for (let d = 1; d <= daysIn; d++) {
      const ymd = month + '-' + (d < 10 ? '0' : '') + d;
      const r = getAvailableSlots({
        system: system,
        service: service,
        dateYmd: ymd,
        businessRules: mctx.businessRules,
        serviceRules: mctx.serviceRules,
        teamRules: mctx.teamRules,
        exceptions: mctx.exceptions,
        existingBookings: mctx.existingBookings,
        holds: mctx.holds,
        teamMemberId: teamMemberId
      });
      const slots = r.slots || [];
      days[ymd] = {
        slots: slots.length,
        spots: slots.reduce(function (n, x) { return n + (Number(x.remaining) || 0); }, 0),
        best: slots.reduce(function (n, x) { return Math.max(n, Number(x.remaining) || 0); }, 0),
        closed: !slots.length && (r.reasons || []).some(function (x) { return x.code !== 'no_slots'; })
      };
    }
    return json(res, 200, {
      ok: true,
      month: month,
      timezone: system.timezone,
      today: ymdInZone(new Date(), system.timezone || 'Australia/Sydney'),
      capacity: Number(service.capacity) || 1,
      days: days
    });
  }

  if (!dateYmd) return json(res, 400, { ok: false, error: 'date_required' });

  const dayStart = dateYmd + 'T00:00:00.000Z';
  const ctx = await loadAvailabilityContext(system, service, {
    from: addMinutes(new Date(dayStart), -24 * 60).toISOString(),
    to: addMinutes(new Date(dayStart), 48 * 60).toISOString(),
    teamMemberId: teamMemberId
  });
  const result = getAvailableSlots({
    system: system,
    service: service,
    dateYmd: dateYmd,
    businessRules: ctx.businessRules,
    serviceRules: ctx.serviceRules,
    teamRules: ctx.teamRules,
    exceptions: ctx.exceptions,
    existingBookings: ctx.existingBookings,
    holds: ctx.holds,
    teamMemberId: teamMemberId
  });

  void actorUserId;
  return json(res, 200, {
    ok: true,
    date: dateYmd,
    timezone: system.timezone,
    service: { id: service.id, name: service.name, duration_minutes: service.duration_minutes },
    slots: result.slots,
    reasons: result.reasons,
    site: { slug: site.slug, business_name: site.business_name || system.business_name }
  });
};
