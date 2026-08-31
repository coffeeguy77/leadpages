'use strict';

/**
 * GET/POST /api/bookings/portal?t=
 * Magic-link customer portal.
 */

const { json, readBody, getAdmin } = require('../../lib/bookings/auth');
const { hashToken, transitionBooking } = require('../../lib/bookings/service');
const { canTransition } = require('../../lib/bookings/status');
const { addMinutes } = require('../../lib/bookings/time');

async function loadByToken(raw) {
  if (!raw) return null;
  const admin = getAdmin();
  const { data: tok } = await admin
    .from('booking_portal_tokens')
    .select('*')
    .eq('token_hash', hashToken(raw))
    .maybeSingle();
  if (!tok || tok.revoked_at) return null;
  if (new Date(tok.expires_at) < new Date()) return null;
  const { data: booking } = await admin.from('bookings').select('*').eq('id', tok.booking_id).maybeSingle();
  if (!booking) return null;
  const { data: service } = await admin.from('booking_services').select('id,name,duration_minutes,cancellation_hours,reschedule_hours,customer_instructions,confirmation_instructions').eq('id', booking.service_id).maybeSingle();
  const { data: system } = await admin.from('booking_systems').select('*').eq('id', booking.booking_system_id).maybeSingle();
  return { tok: tok, booking: booking, service: service, system: system };
}

module.exports = async function (req, res) {
  const url = new URL(req.url, 'https://x');
  const token = url.searchParams.get('t') || '';
  const body = req.method === 'GET' ? { t: token } : await readBody(req);
  const raw = body.t || token;
  const loaded = await loadByToken(raw);
  if (!loaded) return json(res, 401, { ok: false, error: 'invalid_or_expired_link' });

  const { booking, service, system, tok } = loaded;
  const admin = getAdmin();

  if (req.method === 'GET') {
    await admin.from('booking_portal_tokens').update({ used_at: new Date().toISOString() }).eq('id', tok.id);
    return json(res, 200, {
      ok: true,
      booking: {
        reference: booking.reference,
        status: booking.status,
        starts_at: booking.starts_at,
        ends_at: booking.ends_at,
        timezone: booking.timezone,
        customer_name: booking.customer_name,
        total_cents: booking.total_cents,
        deposit_cents: booking.deposit_cents,
        amount_paid_cents: booking.amount_paid_cents,
        payment_status: booking.payment_status,
        location_label: booking.location_label,
        service_name: service && service.name,
        instructions: (service && (service.confirmation_instructions || service.customer_instructions)) || ''
      },
      business: {
        name: system.business_name,
        phone: system.phone,
        email: system.email,
        timezone: system.timezone
      },
      policies: {
        cancellation_hours: (service && service.cancellation_hours) != null ? service.cancellation_hours : system.cancellation_hours,
        reschedule_hours: (service && service.reschedule_hours) != null ? service.reschedule_hours : system.reschedule_hours
      }
    });
  }

  if (req.method === 'POST') {
    const action = body.action;
    const hoursCancel = (service && service.cancellation_hours) != null ? service.cancellation_hours : system.cancellation_hours;
    const hoursResched = (service && service.reschedule_hours) != null ? service.reschedule_hours : system.reschedule_hours;
    const start = new Date(booking.starts_at);
    const now = new Date();

    if (action === 'cancel') {
      if (start < addMinutes(now, Number(hoursCancel || 0) * 60)) {
        return json(res, 403, { ok: false, error: 'outside_cancellation_policy' });
      }
      if (!canTransition(booking.status, 'cancelled')) {
        return json(res, 400, { ok: false, error: 'cannot_cancel' });
      }
      const result = await transitionBooking(booking, 'cancelled', { reason: body.reason || 'customer_portal' });
      return json(res, result.ok ? 200 : 409, result);
    }

    if (action === 'reschedule') {
      if (start < addMinutes(now, Number(hoursResched || 0) * 60)) {
        return json(res, 403, { ok: false, error: 'outside_reschedule_policy' });
      }
      if (!body.starts_at) return json(res, 400, { ok: false, error: 'starts_at_required' });
      // Delegate conflict check via staff reschedule path logic — inline update with availability
      const { getAvailableSlots } = require('../../lib/bookings/availability');
      const { loadAvailabilityContext } = require('../../lib/bookings/service');
      const { ymdInZone } = require('../../lib/bookings/time');
      const fullService = (await admin.from('booking_services').select('*').eq('id', booking.service_id).single()).data;
      const startsAt = new Date(body.starts_at);
      const endsAt = addMinutes(startsAt, fullService.duration_minutes || 60);
      const ctx = await loadAvailabilityContext(system, fullService, {
        from: addMinutes(startsAt, -120).toISOString(),
        to: addMinutes(endsAt, 120).toISOString(),
        teamMemberId: booking.team_member_id
      });
      ctx.existingBookings = (ctx.existingBookings || []).filter(function (b) { return b.id !== booking.id; });
      const avail = getAvailableSlots({
        system: system,
        service: fullService,
        dateYmd: ymdInZone(startsAt, system.timezone),
        businessRules: ctx.businessRules,
        serviceRules: ctx.serviceRules,
        teamRules: ctx.teamRules,
        exceptions: ctx.exceptions,
        existingBookings: ctx.existingBookings,
        holds: ctx.holds,
        teamMemberId: booking.team_member_id
      });
      const okSlot = (avail.slots || []).some(function (s) {
        return Math.abs(new Date(s.start).getTime() - startsAt.getTime()) < 60000;
      });
      if (!okSlot) return json(res, 409, { ok: false, error: 'slot_unavailable', reasons: avail.reasons });
      const { data: updated, error } = await admin.from('bookings').update({
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        updated_at: new Date().toISOString(),
        version: (booking.version || 1) + 1
      }).eq('id', booking.id).eq('version', booking.version || 1).select('*').single();
      if (error || !updated) return json(res, 409, { ok: false, error: 'version_conflict' });
      await admin.from('booking_activity').insert({
        booking_id: booking.id,
        booking_system_id: system.id,
        site_id: system.site_id,
        event_type: 'rescheduled',
        summary: 'Customer rescheduled via portal',
        meta: { starts_at: startsAt.toISOString() }
      });
      return json(res, 200, { ok: true, booking: { reference: updated.reference, starts_at: updated.starts_at, ends_at: updated.ends_at, status: updated.status } });
    }

    return json(res, 400, { ok: false, error: 'unknown_action' });
  }

  return json(res, 405, { ok: false, error: 'method_not_allowed' });
};
