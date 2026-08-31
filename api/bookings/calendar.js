'use strict';

/**
 * GET /api/bookings/calendar?site_id=&from=&to=
 * Staff calendar feed + overview metrics.
 */

const {
  requireUser,
  assertSiteAccess,
  getBookingSystemForSite,
  ensureBookingSystem,
  json,
  getAdmin
} = require('../../lib/bookings/auth');

module.exports = async function (req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  const user = await requireUser(req);
  if (!user) return json(res, 401, { ok: false, error: 'auth' });

  const url = new URL(req.url, 'https://x');
  const siteId = url.searchParams.get('site_id');
  const access = await assertSiteAccess(user, siteId);
  if (!access.ok) return json(res, access.code, { ok: false, error: access.error });

  let system = await getBookingSystemForSite(siteId);
  if (!system) system = await ensureBookingSystem(siteId, { site: access.site });
  const admin = getAdmin();

  const from = url.searchParams.get('from') || new Date().toISOString();
  const to = url.searchParams.get('to') || new Date(Date.now() + 7 * 86400000).toISOString();
  const view = url.searchParams.get('view') || 'calendar';

  if (view === 'overview') {
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(startToday);
    endToday.setDate(endToday.getDate() + 1);
    const weekEnd = new Date(startToday);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const monthEnd = new Date(startToday);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    const { data: today } = await admin
      .from('bookings')
      .select('*')
      .eq('booking_system_id', system.id)
      .gte('starts_at', startToday.toISOString())
      .lt('starts_at', endToday.toISOString())
      .order('starts_at');

    const { data: pending } = await admin
      .from('bookings')
      .select('id', { count: 'exact' })
      .eq('booking_system_id', system.id)
      .in('status', ['pending', 'awaiting_payment']);

    const { data: weekBookings } = await admin
      .from('bookings')
      .select('total_cents,amount_paid_cents,status')
      .eq('booking_system_id', system.id)
      .gte('starts_at', startToday.toISOString())
      .lt('starts_at', weekEnd.toISOString())
      .neq('status', 'cancelled');

    const { data: monthBookings } = await admin
      .from('bookings')
      .select('amount_paid_cents,status')
      .eq('booking_system_id', system.id)
      .gte('starts_at', startToday.toISOString())
      .lt('starts_at', monthEnd.toISOString())
      .neq('status', 'cancelled');

    const { data: activity } = await admin
      .from('booking_activity')
      .select('*')
      .eq('booking_system_id', system.id)
      .order('created_at', { ascending: false })
      .limit(20);

    const sumPaid = function (rows) {
      return (rows || []).reduce(function (a, b) { return a + (Number(b.amount_paid_cents) || 0); }, 0);
    };

    const todayList = today || [];
    const next = todayList.find(function (b) {
      return new Date(b.starts_at) >= new Date() && b.status !== 'cancelled';
    }) || null;

    return json(res, 200, {
      ok: true,
      overview: {
        today_count: todayList.length,
        today: todayList,
        next: next,
        pending_count: (pending && pending.length) || 0,
        revenue_today_cents: sumPaid(todayList),
        revenue_week_cents: sumPaid(weekBookings),
        revenue_month_cents: sumPaid(monthBookings),
        awaiting_payment: (todayList.concat(weekBookings || [])).filter(function (b) { return b.status === 'awaiting_payment'; }).length
      },
      activity: activity || []
    });
  }

  const { data: bookings } = await admin
    .from('bookings')
    .select('id,reference,service_id,team_member_id,customer_name,starts_at,ends_at,status,booking_type,colour:service_id,total_cents,payment_status')
    .eq('booking_system_id', system.id)
    .gte('starts_at', from)
    .lt('starts_at', to)
    .order('starts_at');

  const { data: services } = await admin
    .from('booking_services')
    .select('id,name,colour,duration_minutes')
    .eq('booking_system_id', system.id);

  const { data: team } = await admin
    .from('booking_team_members')
    .select('id,display_name,colour')
    .eq('booking_system_id', system.id);

  const { data: exceptions } = await admin
    .from('booking_schedule_exceptions')
    .select('*')
    .eq('booking_system_id', system.id)
    .lt('starts_at', to)
    .gt('ends_at', from)
    .order('starts_at');

  const svcMap = {};
  (services || []).forEach(function (s) { svcMap[s.id] = s; });

  const events = (bookings || []).map(function (b) {
    const svc = svcMap[b.service_id] || {};
    return {
      id: b.id,
      title: (svc.name || 'Booking') + ' — ' + (b.customer_name || 'Customer'),
      reference: b.reference,
      start: b.starts_at,
      end: b.ends_at,
      status: b.status,
      team_member_id: b.team_member_id,
      service_id: b.service_id,
      colour: svc.colour || '#155c4a',
      total_cents: b.total_cents,
      payment_status: b.payment_status,
      kind: 'booking'
    };
  });

  (exceptions || []).forEach(function (ex) {
    events.push({
      id: 'ex-' + ex.id,
      exception_id: ex.id,
      title: ex.title || ex.kind || 'Blocked',
      start: ex.starts_at,
      end: ex.ends_at,
      status: ex.kind,
      team_member_id: ex.scope === 'team' ? ex.scope_id : null,
      colour: '#6b7280',
      kind: 'exception'
    });
  });

  events.sort(function (a, b) {
    return new Date(a.start) - new Date(b.start);
  });

  return json(res, 200, {
    ok: true,
    from: from,
    to: to,
    events: events,
    exceptions: exceptions || [],
    services: services || [],
    team: team || [],
    timezone: system.timezone
  });
};
