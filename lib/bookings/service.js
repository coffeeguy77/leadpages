'use strict';

const crypto = require('crypto');
const { getAdmin } = require('./auth');
const { quoteBooking } = require('./pricing');
const { assertTransition, isBlockingStatus } = require('./status');
const { getAvailableSlots } = require('./availability');
const { addMinutes, ymdInZone } = require('./time');

function normEmail(e) {
  return String(e || '').trim().toLowerCase();
}

function normPhone(p) {
  let s = String(p || '').replace(/[^\d+]/g, '');
  if (s.indexOf('+') === 0) return s;
  if (s.indexOf('0') === 0 && s.length === 10) return '+61' + s.slice(1);
  if (s.indexOf('61') === 0) return '+' + s;
  return s;
}

async function nextReference(system) {
  const admin = getAdmin();
  const { data, error } = await admin
    .from('booking_systems')
    .update({ next_booking_seq: (system.next_booking_seq || 1) + 1, updated_at: new Date().toISOString() })
    .eq('id', system.id)
    .select('next_booking_seq')
    .single();
  if (error) throw error;
  const n = (data && data.next_booking_seq ? data.next_booking_seq : system.next_booking_seq || 1) - 1;
  return 'BK-' + String(n).padStart(5, '0');
}

async function upsertCustomer(system, payload) {
  const admin = getAdmin();
  const email_norm = normEmail(payload.email);
  const phone_e164 = normPhone(payload.phone);
  let existing = null;
  if (email_norm) {
    const r = await admin
      .from('booking_customers')
      .select('*')
      .eq('booking_system_id', system.id)
      .eq('email_norm', email_norm)
      .maybeSingle();
    existing = r.data;
  }
  if (!existing && phone_e164) {
    const r = await admin
      .from('booking_customers')
      .select('*')
      .eq('booking_system_id', system.id)
      .eq('phone_e164', phone_e164)
      .maybeSingle();
    existing = r.data;
  }
  if (existing) {
    const { data } = await admin
      .from('booking_customers')
      .update({
        name: payload.name || existing.name,
        email: payload.email || existing.email,
        email_norm: email_norm || existing.email_norm,
        phone: payload.phone || existing.phone,
        phone_e164: phone_e164 || existing.phone_e164,
        notes: payload.notes != null ? payload.notes : existing.notes,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select('*')
      .single();
    return data || existing;
  }
  const { data, error } = await admin
    .from('booking_customers')
    .insert({
      booking_system_id: system.id,
      site_id: system.site_id,
      name: payload.name || 'Customer',
      email: payload.email || '',
      email_norm: email_norm,
      phone: payload.phone || '',
      phone_e164: phone_e164,
      notes: payload.notes || '',
      last_activity_at: new Date().toISOString()
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function loadAvailabilityContext(system, service, opts) {
  const admin = getAdmin();
  const from = opts.from;
  const to = opts.to;
  const [rulesBiz, rulesSvc, rulesTeam, exceptions, bookings, holds] = await Promise.all([
    admin.from('booking_availability_rules').select('*').eq('booking_system_id', system.id).eq('scope', 'business').eq('active', true),
    admin.from('booking_availability_rules').select('*').eq('booking_system_id', system.id).eq('scope', 'service').eq('scope_id', service.id).eq('active', true),
    opts.teamMemberId
      ? admin.from('booking_availability_rules').select('*').eq('booking_system_id', system.id).eq('scope', 'team').eq('scope_id', opts.teamMemberId).eq('active', true)
      : Promise.resolve({ data: [] }),
    admin.from('booking_schedule_exceptions').select('*').eq('booking_system_id', system.id).lt('starts_at', to).gt('ends_at', from),
    admin.from('bookings').select('id,reference,starts_at,ends_at,status,team_member_id,service_id,attendee_count')
      .eq('booking_system_id', system.id)
      .lt('starts_at', to)
      .gt('ends_at', from)
      .neq('status', 'cancelled')
      .neq('status', 'draft'),
    admin.from('booking_holds').select('*').eq('booking_system_id', system.id).gt('expires_at', new Date().toISOString())
  ]);
  return {
    businessRules: rulesBiz.data || [],
    serviceRules: rulesSvc.data || [],
    teamRules: rulesTeam.data || [],
    exceptions: exceptions.data || [],
    existingBookings: bookings.data || [],
    holds: holds.data || []
  };
}

async function createBooking(opts) {
  const admin = getAdmin();
  const system = opts.system;
  const service = opts.service;
  const startsAt = new Date(opts.startsAt);
  const duration = Number(service.duration_minutes) || 60;
  const endsAt = opts.endsAt ? new Date(opts.endsAt) : addMinutes(startsAt, duration);
  const tz = system.timezone || 'Australia/Sydney';

  if (opts.idempotencyKey) {
    const { data: existing } = await admin
      .from('bookings')
      .select('*')
      .eq('booking_system_id', system.id)
      .eq('idempotency_key', opts.idempotencyKey)
      .maybeSingle();
    if (existing) return { ok: true, booking: existing, reused: true };
  }

  // Conflict revalidation
  const ctx = await loadAvailabilityContext(system, service, {
    from: addMinutes(startsAt, -120).toISOString(),
    to: addMinutes(endsAt, 120).toISOString(),
    teamMemberId: opts.teamMemberId || null
  });
  const dateYmd = ymdInZone(startsAt, tz);
  const avail = getAvailableSlots({
    system: system,
    service: service,
    dateYmd: dateYmd,
    businessRules: ctx.businessRules,
    serviceRules: ctx.serviceRules,
    teamRules: ctx.teamRules,
    exceptions: ctx.exceptions,
    existingBookings: ctx.existingBookings,
    holds: ctx.holds,
    teamMemberId: opts.teamMemberId || null,
    now: opts.now || new Date()
  });
  const okSlot = (avail.slots || []).some(function (s) {
    return Math.abs(new Date(s.start).getTime() - startsAt.getTime()) < 60000;
  });
  // Staff may force override
  if (!okSlot && !opts.force) {
    return { ok: false, error: 'slot_unavailable', reasons: avail.reasons || [], slotsHint: avail.slots };
  }

  const quote = quoteBooking({
    system: system,
    service: service,
    addons: opts.addons || [],
    attendeeCount: opts.attendeeCount,
    travelFeeCents: opts.travelFeeCents,
    discountCents: opts.discountCents
  });

  let status = opts.status || 'confirmed';
  if (quote.deposit_cents > 0 && opts.source === 'public' && !opts.paymentCollected) {
    status = 'awaiting_payment';
  }
  if (opts.source === 'public' && system.settings && system.settings.require_approval) {
    status = status === 'awaiting_payment' ? status : 'pending';
  }

  const customer = await upsertCustomer(system, {
    name: opts.customerName,
    email: opts.customerEmail,
    phone: opts.customerPhone,
    notes: opts.customerNotes
  });

  const reference = await nextReference(system);
  const row = {
    booking_system_id: system.id,
    site_id: system.site_id,
    reference: reference,
    service_id: service.id,
    customer_id: customer.id,
    team_member_id: opts.teamMemberId || null,
    booking_type: service.booking_type || 'appointment',
    status: status,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    timezone: tz,
    attendee_count: Math.max(1, Number(opts.attendeeCount) || 1),
    location_label: opts.locationLabel || service.location_label || '',
    delivery_mode: service.delivery_mode || 'at_business',
    customer_address_json: opts.customerAddress || {},
    source: opts.source || 'admin',
    idempotency_key: opts.idempotencyKey || null,
    subtotal_cents: quote.subtotal_cents,
    addons_cents: quote.addons_cents,
    discount_cents: quote.discount_cents,
    travel_fee_cents: quote.travel_fee_cents,
    gst_cents: quote.gst_cents,
    total_cents: quote.total_cents,
    deposit_cents: quote.deposit_cents,
    amount_paid_cents: opts.amountPaidCents || 0,
    payment_status: opts.amountPaidCents > 0 ? (opts.amountPaidCents >= quote.total_cents ? 'paid' : 'deposit_paid') : (quote.deposit_cents > 0 ? 'unpaid' : 'none'),
    customer_name: opts.customerName || customer.name,
    customer_email: opts.customerEmail || customer.email,
    customer_phone: opts.customerPhone || customer.phone,
    internal_notes: opts.internalNotes || '',
    customer_notes: opts.customerNotes || '',
    addon_selections: opts.addons || [],
    form_responses: opts.formResponses || {},
    created_by: opts.actorUserId || null,
    updated_by: opts.actorUserId || null
  };

  const { data: booking, error } = await admin.from('bookings').insert(row).select('*').single();
  if (error) {
    if (String(error.message || '').includes('idempotency') || error.code === '23505') {
      const { data: again } = await admin
        .from('bookings')
        .select('*')
        .eq('booking_system_id', system.id)
        .eq('idempotency_key', opts.idempotencyKey)
        .maybeSingle();
      if (again) return { ok: true, booking: again, reused: true };
    }
    throw error;
  }

  await admin.from('booking_status_history').insert({
    booking_id: booking.id,
    booking_system_id: system.id,
    site_id: system.site_id,
    from_status: null,
    to_status: status,
    actor_user_id: opts.actorUserId || null,
    reason: 'created'
  });
  await admin.from('booking_activity').insert({
    booking_id: booking.id,
    booking_system_id: system.id,
    site_id: system.site_id,
    event_type: 'booking_created',
    summary: 'Booking ' + reference + ' created',
    meta: { source: row.source, status: status },
    actor_user_id: opts.actorUserId || null
  });
  await admin.from('booking_audit_events').insert({
    booking_system_id: system.id,
    site_id: system.site_id,
    actor_user_id: opts.actorUserId || null,
    action: 'booking.create',
    entity_type: 'booking',
    entity_id: booking.id,
    summary: 'Created ' + reference
  });

  await admin
    .from('booking_customers')
    .update({
      booking_count: (customer.booking_count || 0) + 1,
      last_activity_at: new Date().toISOString()
    })
    .eq('id', customer.id);

  try {
    const { enqueueBookingCreated } = require('./notify');
    await enqueueBookingCreated(system, booking, service);
  } catch (e) {
    console.warn('bookings notify', e && e.message);
  }

  return { ok: true, booking: booking, quote: quote, customer: customer };
}

async function transitionBooking(booking, toStatus, opts) {
  opts = opts || {};
  assertTransition(booking.status, toStatus);
  const admin = getAdmin();
  const { data, error } = await admin
    .from('bookings')
    .update({
      status: toStatus,
      updated_at: new Date().toISOString(),
      updated_by: opts.actorUserId || null,
      cancelled_at: toStatus === 'cancelled' ? new Date().toISOString() : booking.cancelled_at,
      cancel_reason: toStatus === 'cancelled' ? (opts.reason || '') : booking.cancel_reason,
      version: (booking.version || 1) + 1
    })
    .eq('id', booking.id)
    .eq('version', booking.version || 1)
    .select('*')
    .single();
  if (error || !data) {
    return { ok: false, error: 'version_conflict' };
  }
  await admin.from('booking_status_history').insert({
    booking_id: booking.id,
    booking_system_id: booking.booking_system_id,
    site_id: booking.site_id,
    from_status: booking.status,
    to_status: toStatus,
    actor_user_id: opts.actorUserId || null,
    reason: opts.reason || ''
  });
  await admin.from('booking_activity').insert({
    booking_id: booking.id,
    booking_system_id: booking.booking_system_id,
    site_id: booking.site_id,
    event_type: 'status_changed',
    summary: 'Status ' + booking.status + ' → ' + toStatus,
    meta: { from: booking.status, to: toStatus },
    actor_user_id: opts.actorUserId || null
  });
  return { ok: true, booking: data };
}

function createPortalToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

async function issuePortalToken(booking, purpose, ttlHours) {
  const admin = getAdmin();
  const token = createPortalToken();
  const expires = new Date(Date.now() + (ttlHours || 72) * 3600 * 1000);
  await admin.from('booking_portal_tokens').insert({
    booking_system_id: booking.booking_system_id,
    site_id: booking.site_id,
    booking_id: booking.id,
    token_hash: hashToken(token),
    purpose: purpose || 'manage',
    expires_at: expires.toISOString()
  });
  return { token: token, expiresAt: expires.toISOString() };
}

module.exports = {
  normEmail,
  normPhone,
  upsertCustomer,
  createBooking,
  transitionBooking,
  loadAvailabilityContext,
  issuePortalToken,
  hashToken,
  isBlockingStatus
};
