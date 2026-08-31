'use strict';

/**
 * GET/POST/DELETE /api/bookings/exceptions
 * Blocked times / schedule exceptions (leave, maintenance, closed).
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

module.exports = async function (req, res) {
  const user = await requireUser(req);
  if (!user) return json(res, 401, { ok: false, error: 'auth' });

  const url = new URL(req.url, 'https://x');
  const body = req.method === 'GET' ? {} : await readBody(req);
  const siteId = url.searchParams.get('site_id') || body.site_id;
  const access = await assertSiteAccess(user, siteId);
  if (!access.ok) return json(res, access.code, { ok: false, error: access.error });

  let system = await getBookingSystemForSite(siteId);
  if (!system) system = await ensureBookingSystem(siteId, { site: access.site });
  const admin = getAdmin();

  if (req.method === 'GET') {
    const from = url.searchParams.get('from') || new Date().toISOString();
    const to = url.searchParams.get('to') || new Date(Date.now() + 30 * 86400000).toISOString();
    const { data, error } = await admin
      .from('booking_schedule_exceptions')
      .select('*')
      .eq('booking_system_id', system.id)
      .lt('starts_at', to)
      .gt('ends_at', from)
      .order('starts_at');
    if (error) return json(res, 400, { ok: false, error: error.message });
    return json(res, 200, { ok: true, exceptions: data || [] });
  }

  if (req.method === 'POST') {
    if (!body.starts_at || !body.ends_at) {
      return json(res, 400, { ok: false, error: 'starts_at_and_ends_at_required' });
    }
    if (new Date(body.ends_at) <= new Date(body.starts_at)) {
      return json(res, 400, { ok: false, error: 'invalid_range' });
    }
    const row = {
      booking_system_id: system.id,
      site_id: system.site_id,
      scope: body.scope || 'business',
      scope_id: body.scope_id || null,
      starts_at: new Date(body.starts_at).toISOString(),
      ends_at: new Date(body.ends_at).toISOString(),
      kind: body.kind || 'block',
      title: body.title || 'Blocked'
    };
    const { data, error } = await admin.from('booking_schedule_exceptions').insert(row).select('*').single();
    if (error) return json(res, 400, { ok: false, error: error.message });
    await admin.from('booking_audit_events').insert({
      booking_system_id: system.id,
      site_id: system.site_id,
      actor_user_id: user.id,
      action: 'exception.create',
      entity_type: 'booking_schedule_exception',
      entity_id: data.id,
      summary: 'Blocked ' + row.title
    });
    return json(res, 200, { ok: true, exception: data });
  }

  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id') || body.id;
    if (!id) return json(res, 400, { ok: false, error: 'id_required' });
    const { error } = await admin
      .from('booking_schedule_exceptions')
      .delete()
      .eq('id', id)
      .eq('booking_system_id', system.id);
    if (error) return json(res, 400, { ok: false, error: error.message });
    return json(res, 200, { ok: true });
  }

  return json(res, 405, { ok: false, error: 'method_not_allowed' });
};
