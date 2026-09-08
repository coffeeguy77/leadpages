'use strict';

/**
 * GET /api/bookings/hire/fleet-calendar
 * Resource-row calendar feed for hire bookings.
 */

const {
  requireUser,
  assertSiteAccess,
  getBookingSystemForSite,
  json,
  getAdmin
} = require('../../../lib/bookings/auth');
const { fleetEventDto } = require('../../../lib/bookings/hire/service');
const { resolveTerminology } = require('../../../lib/bookings/hire/terminology');

module.exports = async function (req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  const user = await requireUser(req);
  if (!user) return json(res, 401, { ok: false, error: 'auth' });

  const url = new URL(req.url, 'https://x');
  const siteId = url.searchParams.get('site_id');
  const access = await assertSiteAccess(user, siteId);
  if (!access.ok) return json(res, access.code, { ok: false, error: access.error });
  const system = await getBookingSystemForSite(siteId);
  if (!system) return json(res, 404, { ok: false, error: 'system_not_found' });

  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (!from || !to) return json(res, 400, { ok: false, error: 'from_to_required' });

  const admin = getAdmin();
  const terms = resolveTerminology(system);

  let resourceQuery = admin
    .from('booking_resources')
    .select('*')
    .eq('booking_system_id', system.id)
    .neq('hire_status', 'archived')
    .order('name');
  const resourceType = url.searchParams.get('resource_type');
  const resourceId = url.searchParams.get('resource_id');
  if (resourceType) resourceQuery = resourceQuery.eq('resource_type', resourceType);
  if (resourceId) resourceQuery = resourceQuery.eq('id', resourceId);
  const { data: resources } = await resourceQuery;

  let hireQuery = admin
    .from('booking_hire_details')
    .select('*, bookings!inner(*)')
    .eq('booking_system_id', system.id)
    .lt('pickup_at', to)
    .gt('return_at', from);
  const status = url.searchParams.get('status');
  if (status) hireQuery = hireQuery.eq('bookings.status', status);
  const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
  const { data: hireRows } = await hireQuery;

  const resourceMap = {};
  (resources || []).forEach(function (r) {
    resourceMap[r.id] = r;
  });

  const events = [];
  (hireRows || []).forEach(function (row) {
    const booking = row.bookings || row;
    if (q) {
      const blob = [
        booking.customer_name,
        booking.customer_phone,
        booking.reference,
        resourceMap[row.resource_id] && resourceMap[row.resource_id].name
      ]
        .join(' ')
        .toLowerCase();
      if (blob.indexOf(q) < 0) return;
    }
    events.push(
      fleetEventDto(booking, row, resourceMap[row.resource_id] || { id: row.resource_id }, system)
    );
  });

  return json(res, 200, {
    ok: true,
    terminology: terms,
    resources: (resources || []).map(function (r) {
      return {
        id: r.id,
        title: r.public_name || r.name,
        eventColor: r.calendar_colour || r.calendar_color || '#155c4a',
        hire_status: r.hire_status || (r.active === false ? 'unavailable' : 'active'),
        registration_number: r.registration_number || '',
        resource_type: r.resource_type
      };
    }),
    events: events,
    settings: {
      allow_calendar_drag: !!(system.settings && system.settings.hire && system.settings.hire.allow_calendar_drag),
      max_daily_hire_jobs:
        (system.settings && system.settings.hire && system.settings.hire.max_daily_hire_jobs) || 4,
      default_duration_minutes:
        (system.settings && system.settings.hire && system.settings.hire.default_duration_minutes) || 1435
    }
  });
};
