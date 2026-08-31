'use strict';

/**
 * GET/POST /api/bookings/customers
 * Staff customer list, search, and notes update.
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
const { upsertCustomer, normEmail, normPhone } = require('../../lib/bookings/service');

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
    const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
    const id = url.searchParams.get('id');
    if (id) {
      const { data: customer } = await admin
        .from('booking_customers')
        .select('*')
        .eq('id', id)
        .eq('booking_system_id', system.id)
        .maybeSingle();
      if (!customer) return json(res, 404, { ok: false, error: 'not_found' });
      const { data: bookings } = await admin
        .from('bookings')
        .select('id,reference,starts_at,status,total_cents,service_id')
        .eq('customer_id', customer.id)
        .order('starts_at', { ascending: false })
        .limit(50);
      return json(res, 200, { ok: true, customer: customer, bookings: bookings || [] });
    }

    let query = admin
      .from('booking_customers')
      .select('*')
      .eq('booking_system_id', system.id)
      .order('last_activity_at', { ascending: false, nullsFirst: false })
      .limit(100);
    const { data, error } = await query;
    if (error) return json(res, 400, { ok: false, error: error.message });
    let rows = data || [];
    if (q) {
      rows = rows.filter(function (c) {
        return (
          String(c.name || '').toLowerCase().indexOf(q) >= 0 ||
          String(c.email_norm || '').indexOf(q) >= 0 ||
          String(c.phone_e164 || '').indexOf(q) >= 0 ||
          String(c.phone || '').indexOf(q) >= 0
        );
      });
    }
    return json(res, 200, { ok: true, customers: rows });
  }

  if (req.method === 'POST') {
    if (body.action === 'upsert' || body.name) {
      const customer = await upsertCustomer(system, {
        name: body.name,
        email: body.email,
        phone: body.phone,
        notes: body.notes
      });
      return json(res, 200, { ok: true, customer: customer });
    }
    if (body.action === 'update' && body.id) {
      const patch = { updated_at: new Date().toISOString() };
      if (body.name != null) patch.name = body.name;
      if (body.notes != null) patch.notes = body.notes;
      if (body.email != null) {
        patch.email = body.email;
        patch.email_norm = normEmail(body.email);
      }
      if (body.phone != null) {
        patch.phone = body.phone;
        patch.phone_e164 = normPhone(body.phone);
      }
      if (body.tags != null) patch.tags = body.tags;
      if (body.marketing_consent != null) patch.marketing_consent = !!body.marketing_consent;
      const { data, error } = await admin
        .from('booking_customers')
        .update(patch)
        .eq('id', body.id)
        .eq('booking_system_id', system.id)
        .select('*')
        .single();
      if (error) return json(res, 400, { ok: false, error: error.message });
      return json(res, 200, { ok: true, customer: data });
    }
    return json(res, 400, { ok: false, error: 'unknown_action' });
  }

  return json(res, 405, { ok: false, error: 'method_not_allowed' });
};
