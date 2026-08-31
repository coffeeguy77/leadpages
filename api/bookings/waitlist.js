'use strict';

/**
 * GET/POST /api/bookings/waitlist
 * Public join + staff list/notify.
 */

const {
  requireUser,
  assertSiteAccess,
  getBookingSystemForSite,
  getAdmin,
  json,
  readBody
} = require('../../lib/bookings/auth');
const { upsertCustomer } = require('../../lib/bookings/service');
const { enqueueNotification } = require('../../lib/bookings/notify');

const HITS = new Map();
function limited(ip) {
  const now = Date.now();
  const a = (HITS.get(ip) || []).filter(function (t) { return now - t < 60000; });
  a.push(now);
  HITS.set(ip, a);
  return a.length > 20;
}

async function loadPublic(slug) {
  const admin = getAdmin();
  const { data: site } = await admin.from('sites').select('id,slug,business_name').eq('slug', slug).maybeSingle();
  if (!site) return null;
  const system = await getBookingSystemForSite(site.id);
  if (!system || !system.enabled) return null;
  return { site: site, system: system };
}

module.exports = async function (req, res) {
  const url = new URL(req.url, 'https://x');
  const admin = getAdmin();

  // Staff list
  if (req.method === 'GET' && url.searchParams.get('site_id')) {
    const user = await requireUser(req);
    if (!user) return json(res, 401, { ok: false, error: 'auth' });
    const siteId = url.searchParams.get('site_id');
    const access = await assertSiteAccess(user, siteId);
    if (!access.ok) return json(res, access.code, { ok: false, error: access.error });
    const system = await getBookingSystemForSite(siteId);
    if (!system) return json(res, 404, { ok: false, error: 'no_system' });
    const { data } = await admin
      .from('booking_waitlist')
      .select('*')
      .eq('booking_system_id', system.id)
      .order('created_at', { ascending: false })
      .limit(100);
    return json(res, 200, { ok: true, entries: data || [] });
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0] || 'x';

    // Staff: mark notified / convert / cancel
    if (body.site_id && body.action) {
      const user = await requireUser(req);
      if (!user) return json(res, 401, { ok: false, error: 'auth' });
      const access = await assertSiteAccess(user, body.site_id);
      if (!access.ok) return json(res, access.code, { ok: false, error: access.error });
      const system = await getBookingSystemForSite(body.site_id);
      if (!system) return json(res, 404, { ok: false, error: 'no_system' });
      if (!body.id) return json(res, 400, { ok: false, error: 'id_required' });

      if (body.action === 'notify') {
        const { data: entry } = await admin.from('booking_waitlist').select('*').eq('id', body.id).eq('booking_system_id', system.id).maybeSingle();
        if (!entry) return json(res, 404, { ok: false, error: 'not_found' });
        if (entry.email) {
          await enqueueNotification({
            booking_system_id: system.id,
            site_id: system.site_id,
            channel: 'email',
            template_key: 'waitlist_slot_available',
            to_address: entry.email,
            subject: 'A booking slot opened — ' + (system.business_name || ''),
            body_text: 'A time may now be available. Book here: ' + ((process.env.PUBLIC_BASE_URL || 'https://leadpages.com.au') + '/book?slug=' + (access.site && access.site.slug || '')),
            payload: { waitlist_id: entry.id }
          });
        }
        const { data } = await admin
          .from('booking_waitlist')
          .update({ status: 'notified', notified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', entry.id)
          .select('*')
          .single();
        return json(res, 200, { ok: true, entry: data });
      }

      if (body.action === 'cancel' || body.action === 'fulfilled') {
        const status = body.action === 'cancel' ? 'cancelled' : 'fulfilled';
        const { data, error } = await admin
          .from('booking_waitlist')
          .update({ status: status, updated_at: new Date().toISOString() })
          .eq('id', body.id)
          .eq('booking_system_id', system.id)
          .select('*')
          .single();
        if (error) return json(res, 400, { ok: false, error: error.message });
        return json(res, 200, { ok: true, entry: data });
      }
      return json(res, 400, { ok: false, error: 'unknown_action' });
    }

    // Public join
    if (limited(ip)) return json(res, 429, { ok: false, error: 'rate_limit' });
    const slug = body.slug;
    if (!slug) return json(res, 400, { ok: false, error: 'slug_required' });
    const pub = await loadPublic(slug);
    if (!pub) return json(res, 404, { ok: false, error: 'not_found' });
    if (!body.service_id || !body.name || (!body.email && !body.phone)) {
      return json(res, 400, { ok: false, error: 'missing_fields' });
    }

    const { data: service } = await admin
      .from('booking_services')
      .select('id,name')
      .eq('id', body.service_id)
      .eq('booking_system_id', pub.system.id)
      .eq('status', 'active')
      .maybeSingle();
    if (!service) return json(res, 404, { ok: false, error: 'service_not_found' });

    let customerId = null;
    try {
      const c = await upsertCustomer(pub.system, {
        name: body.name,
        email: body.email,
        phone: body.phone
      });
      customerId = c && c.id;
    } catch (_e) { /* non-fatal */ }

    const { data, error } = await admin
      .from('booking_waitlist')
      .insert({
        booking_system_id: pub.system.id,
        site_id: pub.system.site_id,
        service_id: service.id,
        customer_id: customerId,
        team_member_id: body.team_member_id || null,
        name: body.name,
        email: body.email || '',
        phone: body.phone || '',
        preferred_date: body.preferred_date || null,
        notes: body.notes || '',
        status: 'waiting'
      })
      .select('*')
      .single();
    if (error) return json(res, 400, { ok: false, error: error.message });
    return json(res, 200, { ok: true, entry: { id: data.id, status: data.status } });
  }

  return json(res, 405, { ok: false, error: 'method_not_allowed' });
};
