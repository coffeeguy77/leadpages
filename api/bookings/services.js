'use strict';

/**
 * GET/POST/PATCH /api/bookings/services
 * List/create/update services and categories.
 */

const {
  requireUser,
  assertSiteAccess,
  ensureBookingSystem,
  getBookingSystemForSite,
  json,
  readBody,
  getAdmin
} = require('../../lib/bookings/auth');

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'service';
}

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
    const [cats, services, team, resources] = await Promise.all([
      admin.from('booking_service_categories').select('*').eq('booking_system_id', system.id).order('sort_order'),
      admin.from('booking_services').select('*').eq('booking_system_id', system.id).order('sort_order'),
      admin.from('booking_team_members').select('*').eq('booking_system_id', system.id).order('display_name'),
      admin.from('booking_resources').select('*').eq('booking_system_id', system.id).order('name')
    ]);
    return json(res, 200, {
      ok: true,
      categories: cats.data || [],
      services: services.data || [],
      team: team.data || [],
      resources: resources.data || []
    });
  }

  if (req.method === 'POST') {
    const kind = body.kind || 'service';
    if (kind === 'category') {
      const name = String(body.name || '').trim();
      if (!name) return json(res, 400, { ok: false, error: 'name_required' });
      const { data, error } = await admin.from('booking_service_categories').insert({
        booking_system_id: system.id,
        site_id: system.site_id,
        name: name,
        slug: slugify(body.slug || name),
        description: body.description || '',
        sort_order: Number(body.sort_order) || 0
      }).select('*').single();
      if (error) return json(res, 400, { ok: false, error: error.message });
      return json(res, 200, { ok: true, category: data });
    }
    if (kind === 'team') {
      const name = String(body.display_name || body.name || '').trim();
      if (!name) return json(res, 400, { ok: false, error: 'name_required' });
      const { data, error } = await admin.from('booking_team_members').insert({
        booking_system_id: system.id,
        site_id: system.site_id,
        display_name: name,
        job_title: body.job_title || '',
        bio: body.bio || '',
        email: body.email || '',
        phone: body.phone || '',
        colour: body.colour || '#2563eb',
        public_visible: body.public_visible !== false
      }).select('*').single();
      if (error) return json(res, 400, { ok: false, error: error.message });
      if (Array.isArray(body.service_ids) && body.service_ids.length) {
        await admin.from('booking_staff_services').insert(
          body.service_ids.map(function (sid) {
            return {
              booking_system_id: system.id,
              site_id: system.site_id,
              team_member_id: data.id,
              service_id: sid
            };
          })
        );
      }
      return json(res, 200, { ok: true, team_member: data });
    }
    if (kind === 'resource') {
      const name = String(body.name || '').trim();
      if (!name) return json(res, 400, { ok: false, error: 'name_required' });
      const { data, error } = await admin.from('booking_resources').insert({
        booking_system_id: system.id,
        site_id: system.site_id,
        name: name,
        resource_type: body.resource_type || 'room',
        description: body.description || '',
        quantity: Math.max(1, Number(body.quantity) || 1)
      }).select('*').single();
      if (error) return json(res, 400, { ok: false, error: error.message });
      return json(res, 200, { ok: true, resource: data });
    }

    // service
    const name = String(body.name || '').trim();
    if (!name) return json(res, 400, { ok: false, error: 'name_required' });
    const { data, error } = await admin.from('booking_services').insert({
      booking_system_id: system.id,
      site_id: system.site_id,
      category_id: body.category_id || null,
      name: name,
      internal_name: body.internal_name || '',
      slug: slugify(body.slug || name),
      description: body.description || '',
      short_description: body.short_description || '',
      image_url: body.image_url || null,
      booking_type: body.booking_type || 'appointment',
      duration_minutes: Math.max(5, Number(body.duration_minutes) || 60),
      prep_minutes: Math.max(0, Number(body.prep_minutes) || 0),
      cleanup_minutes: Math.max(0, Number(body.cleanup_minutes) || 0),
      price_model: body.price_model || 'fixed',
      price_cents: Math.max(0, Number(body.price_cents) || 0),
      capacity: Math.max(1, Number(body.capacity) || 1),
      delivery_mode: body.delivery_mode || 'at_business',
      location_label: body.location_label || '',
      customer_instructions: body.customer_instructions || '',
      colour: body.colour || '#155c4a',
      status: body.status || 'active',
      visibility: body.visibility || 'public'
    }).select('*').single();
    if (error) return json(res, 400, { ok: false, error: error.message });
    return json(res, 200, { ok: true, service: data });
  }

  if (req.method === 'PATCH') {
    const id = body.id;
    const table = body.kind === 'team'
      ? 'booking_team_members'
      : body.kind === 'resource'
        ? 'booking_resources'
        : body.kind === 'category'
          ? 'booking_service_categories'
          : 'booking_services';
    if (!id) return json(res, 400, { ok: false, error: 'id_required' });
    const patch = Object.assign({}, body);
    delete patch.id;
    delete patch.kind;
    delete patch.site_id;
    patch.updated_at = new Date().toISOString();
    const { data, error } = await admin.from(table).update(patch).eq('id', id).eq('booking_system_id', system.id).select('*').single();
    if (error) return json(res, 400, { ok: false, error: error.message });
    return json(res, 200, { ok: true, row: data });
  }

  return json(res, 405, { ok: false, error: 'method_not_allowed' });
};
