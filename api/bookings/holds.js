'use strict';

/**
 * POST /api/bookings/holds
 * Soft-lock a slot during public checkout (expires after system.hold_minutes).
 * Public (rate-limited) — body: slug, service_id, starts_at, team_member_id?, hold_key?
 */

const crypto = require('crypto');
const { json, readBody, getAdmin, getBookingSystemForSite } = require('../../lib/bookings/auth');
const { addMinutes } = require('../../lib/bookings/time');
const { getAvailableSlots } = require('../../lib/bookings/availability');
const { loadAvailabilityContext } = require('../../lib/bookings/service');
const { ymdInZone } = require('../../lib/bookings/time');

const HITS = new Map();
function limited(ip) {
  const now = Date.now();
  const a = (HITS.get(ip) || []).filter(function (t) { return now - t < 60000; });
  a.push(now);
  HITS.set(ip, a);
  return a.length > 40;
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0] || 'x';
  if (limited(ip)) return json(res, 429, { ok: false, error: 'rate_limit' });

  const body = await readBody(req);
  const admin = getAdmin();

  if (body.action === 'release' && body.hold_key && body.slug) {
    const { data: site } = await admin.from('sites').select('id').eq('slug', body.slug).maybeSingle();
    if (!site) return json(res, 404, { ok: false, error: 'not_found' });
    const system = await getBookingSystemForSite(site.id);
    if (!system) return json(res, 404, { ok: false, error: 'not_found' });
    await admin.from('booking_holds').delete().eq('booking_system_id', system.id).eq('hold_key', body.hold_key);
    return json(res, 200, { ok: true, released: true });
  }

  if (!body.slug || !body.service_id || !body.starts_at) {
    return json(res, 400, { ok: false, error: 'missing_fields' });
  }

  const { data: site } = await admin.from('sites').select('id,slug').eq('slug', body.slug).maybeSingle();
  if (!site) return json(res, 404, { ok: false, error: 'not_found' });
  const system = await getBookingSystemForSite(site.id);
  if (!system || !system.enabled) return json(res, 404, { ok: false, error: 'not_found' });

  const { data: service } = await admin
    .from('booking_services')
    .select('*')
    .eq('id', body.service_id)
    .eq('booking_system_id', system.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!service) return json(res, 404, { ok: false, error: 'service_not_found' });

  const startsAt = new Date(body.starts_at);
  const endsAt = addMinutes(startsAt, Number(service.duration_minutes) || 60);
  const holdMins = Math.max(2, Number(system.hold_minutes) || 10);

  const ctx = await loadAvailabilityContext(system, service, {
    from: addMinutes(startsAt, -120).toISOString(),
    to: addMinutes(endsAt, 120).toISOString(),
    teamMemberId: body.team_member_id || null
  });
  const avail = getAvailableSlots({
    system: system,
    service: service,
    dateYmd: ymdInZone(startsAt, system.timezone),
    businessRules: ctx.businessRules,
    serviceRules: ctx.serviceRules,
    teamRules: ctx.teamRules,
    exceptions: ctx.exceptions,
    existingBookings: ctx.existingBookings,
    holds: ctx.holds,
    teamMemberId: body.team_member_id || null
  });
  const okSlot = (avail.slots || []).some(function (s) {
    return Math.abs(new Date(s.start).getTime() - startsAt.getTime()) < 60000;
  });
  if (!okSlot) return json(res, 409, { ok: false, error: 'slot_unavailable', reasons: avail.reasons });

  const holdKey = body.hold_key || crypto.randomBytes(16).toString('hex');
  const expiresAt = addMinutes(new Date(), holdMins);

  // Upsert by hold_key
  await admin.from('booking_holds').delete().eq('booking_system_id', system.id).eq('hold_key', holdKey);
  const { data, error } = await admin
    .from('booking_holds')
    .insert({
      booking_system_id: system.id,
      site_id: system.site_id,
      service_id: service.id,
      team_member_id: body.team_member_id || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      hold_key: holdKey,
      meta: { source: 'public' }
    })
    .select('*')
    .single();
  if (error) return json(res, 400, { ok: false, error: error.message });

  return json(res, 200, {
    ok: true,
    hold_key: holdKey,
    expires_at: data.expires_at,
    starts_at: data.starts_at,
    ends_at: data.ends_at
  });
};
