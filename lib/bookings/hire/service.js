'use strict';

/**
 * Hire booking orchestration.
 * Pure engines are required eagerly; DB service is lazy-loaded.
 */

const { computeHireWindow } = require('./duration');
const { checkHireAvailability } = require('./capacity');
const { quoteHire, priceChangeDiff } = require('./pricing');
const { calculateCancellation, rescheduleFeeFloor } = require('./cancellation');
const {
  assertMutableSchedule,
  unlockPayload,
  relockPayload,
  calendarEventFlags
} = require('./lock');
const {
  resolveTerminology,
  applyTemplate,
  defaultEventTitleTemplate
} = require('./terminology');

function getBookingService() {
  return require('../service');
}

function getAdminClient(opts) {
  if (opts && opts.admin) return opts.admin;
  return require('../auth').getAdmin();
}

function hireSettings(system) {
  return (system && system.settings && system.settings.hire) || {};
}

async function loadResourceReservations(admin, systemId, resourceId, fromIso, toIso) {
  const { data: details } = await admin
    .from('booking_hire_details')
    .select('booking_id,resource_id,pickup_at,return_at,bookings!inner(id,reference,status,starts_at,ends_at)')
    .eq('booking_system_id', systemId)
    .eq('resource_id', resourceId)
    .lt('pickup_at', toIso)
    .gt('return_at', fromIso);
  return (details || []).map(function (d) {
    const b = d.bookings || {};
    return {
      booking_id: d.booking_id,
      resource_id: d.resource_id,
      reference: b.reference,
      status: b.status,
      starts_at: d.pickup_at || b.starts_at,
      ends_at: d.return_at || b.ends_at
    };
  });
}

async function loadCapacityBookings(admin, systemId, fromIso, toIso) {
  const { data } = await admin
    .from('bookings')
    .select('id,reference,status,starts_at,ends_at')
    .eq('booking_system_id', systemId)
    .lt('starts_at', toIso)
    .gt('ends_at', fromIso)
    .neq('status', 'cancelled')
    .neq('status', 'draft');
  return data || [];
}

async function quoteHireBooking(opts) {
  const system = opts.system;
  const service = opts.service;
  const resource = opts.resource || {};
  const window = computeHireWindow({
    pickupYmd: opts.pickupYmd,
    pickupHm: opts.pickupHm,
    timezone: system.timezone,
    durationMode: opts.durationMode || 'single_block',
    hireDays: opts.hireDays,
    returnYmd: opts.returnYmd,
    returnHm: opts.returnHm,
    system: system,
    service: service
  });
  if (!window.ok) return window;

  const quote = quoteHire({
    system: system,
    service: service,
    resource: resource,
    window: {
      timezone: window.timezone,
      pickup_at: window.pickup_at,
      return_at: window.return_at,
      occupied_days: window.occupied_days,
      chargeable_days: window.chargeable_days
    },
    extras: opts.extras,
    deliveryFeeCents: opts.deliveryFeeCents,
    pickupFeeCents: opts.pickupFeeCents,
    cleaningFeeCents: opts.cleaningFeeCents,
    discountCents: opts.discountCents,
    manualAdjustmentCents: opts.manualAdjustmentCents,
    manualAdjustmentReason: opts.manualAdjustmentReason,
    includeBond: opts.includeBond !== false
  });

  return { ok: true, window: window, quote: quote, terminology: resolveTerminology(system) };
}

async function createHireBooking(opts) {
  const admin = getAdminClient(opts);
  const system = opts.system;
  const service = opts.service;
  const resource = opts.resource;
  if (!resource || !resource.id) return { ok: false, error: 'resource_required' };

  const quoted = await quoteHireBooking(opts);
  if (!quoted.ok) return quoted;
  const window = quoted.window;
  const quote = quoted.quote;

  const reservations = await loadResourceReservations(
    admin,
    system.id,
    resource.id,
    window.pickup_at,
    window.return_at
  );
  const existing = await loadCapacityBookings(admin, system.id, window.pickup_at, window.return_at);
  const availability = checkHireAvailability({
    system: system,
    resourceId: resource.id,
    startsAt: window.pickup_at,
    endsAt: window.return_at,
    prepMinutes: resource.prep_buffer_minutes || 0,
    cleanupMinutes: resource.cleanup_buffer_minutes || 0,
    reservations: reservations,
    existingBookings: existing,
    override: !!opts.capacityOverride,
    allowResourceOverride: !!opts.allowResourceOverride,
    excludeBookingId: opts.excludeBookingId
  });
  if (!availability.ok) return availability;

  const { createBooking } = getBookingService();
  const created = await createBooking({
    system: system,
    service: Object.assign({}, service, {
      duration_minutes: window.elapsed_minutes,
      price_model: 'fixed',
      price_cents: quote.total_cents
    }),
    startsAt: window.pickup_at,
    endsAt: window.return_at,
    customerName: opts.customerName,
    customerEmail: opts.customerEmail,
    customerPhone: opts.customerPhone,
    customerNotes: opts.customerNotes,
    internalNotes: opts.internalNotes,
    source: opts.source || 'admin',
    status: opts.status,
    force: true,
    actorUserId: opts.actorUserId,
    idempotencyKey: opts.idempotencyKey,
    formResponses: opts.formResponses,
    amountPaidCents: opts.amountPaidCents || 0
  });
  if (!created.ok) return created;

  const booking = created.booking;
  await admin
    .from('bookings')
    .update({
      booking_type: 'resource_hire',
      starts_at: window.pickup_at,
      ends_at: window.return_at,
      subtotal_cents: quote.rental_cents,
      gst_cents: quote.gst_cents,
      total_cents: quote.total_cents,
      deposit_cents: quote.deposit_cents,
      updated_at: new Date().toISOString()
    })
    .eq('id', booking.id);

  const hireRow = {
    booking_id: booking.id,
    booking_system_id: system.id,
    site_id: system.site_id,
    resource_id: resource.id,
    duration_mode: window.duration_mode,
    hire_days: window.hire_days,
    chargeable_days: window.chargeable_days,
    default_duration_minutes: window.default_duration_minutes,
    pickup_at: window.pickup_at,
    return_at: window.return_at,
    locked: hireSettings(system).allow_calendar_drag === true ? false : true,
    capacity_override: !!opts.capacityOverride,
    capacity_override_reason: opts.capacityOverrideReason || '',
    capacity_override_by: opts.capacityOverride ? opts.actorUserId || null : null,
    capacity_override_at: opts.capacityOverride ? new Date().toISOString() : null,
    daily_rate_cents: (quote.day_rates && quote.day_rates[0] && quote.day_rates[0].rate_cents) || 0,
    bond_cents: quote.bond_cents,
    pricing_snapshot_json: quote.snapshot,
    driver_json: opts.driver || {},
    additional_drivers_json: opts.additionalDrivers || [],
    emergency_contact_json: opts.emergencyContact || {},
    billing_address_json: opts.billingAddress || {},
    delivery_option: opts.deliveryOption || 'pickup',
    delivery_fee_cents: quote.delivery_fee_cents || 0,
    extras_json: opts.extras || [],
    payment_authority_accepted: !!opts.paymentAuthorityAccepted,
    cancellation_policy_accepted: !!opts.cancellationPolicyAccepted,
    card_on_file_status: opts.cardOnFileStatus || 'none',
    protected_starts_at: window.pickup_at,
    cancellation_fee_floor_cents: 0,
    cancellation_policy_version: hireSettings(system).cancellation_policy_version || 'default',
    meta: opts.meta || {}
  };

  const { data: hire, error: hireErr } = await admin
    .from('booking_hire_details')
    .insert(hireRow)
    .select('*')
    .single();
  if (hireErr) return { ok: false, error: 'hire_details_failed', details: hireErr.message };

  await admin.from('booking_resources_reserved').upsert(
    {
      booking_id: booking.id,
      booking_system_id: system.id,
      site_id: system.site_id,
      resource_id: resource.id,
      quantity: 1
    },
    { onConflict: 'booking_id,resource_id' }
  );

  if (opts.capacityOverride) {
    for (const day of window.occupied_days || []) {
      await admin.from('booking_hire_capacity_overrides').insert({
        booking_id: booking.id,
        booking_system_id: system.id,
        site_id: system.site_id,
        day_ymd: day,
        previous_count:
          (availability.capacity && availability.capacity.counts && availability.capacity.counts[day]) || 0,
        max_capacity: (availability.capacity && availability.capacity.max) || 4,
        reason: opts.capacityOverrideReason || 'override',
        actor_user_id: opts.actorUserId || null
      });
    }
  }

  await admin.from('booking_activity').insert({
    booking_id: booking.id,
    booking_system_id: system.id,
    site_id: system.site_id,
    event_type: 'hire_booking_created',
    summary: 'Hire booking created for ' + (resource.public_name || resource.name || 'resource'),
    meta: {
      resource_id: resource.id,
      pickup_at: window.pickup_at,
      return_at: window.return_at,
      total_cents: quote.total_cents
    },
    actor_user_id: opts.actorUserId || null
  });

  const integrations = { google: null, xero: null };
  try {
    const { data: gconn } = await admin
      .from('booking_google_connections')
      .select('*')
      .eq('booking_system_id', system.id)
      .maybeSingle();
    if (gconn && gconn.calendar_enabled !== false) {
      const google = require('./google');
      integrations.google = await google.upsertGoogleEvent(
        admin,
        gconn,
        system,
        Object.assign({}, booking, {
          starts_at: window.pickup_at,
          ends_at: window.return_at,
          customer_name: opts.customerName,
          customer_email: opts.customerEmail,
          customer_phone: opts.customerPhone
        }),
        hire,
        resource,
        {
          name: opts.customerName,
          email: opts.customerEmail,
          phone: opts.customerPhone
        }
      );
    }
  } catch (e) {
    integrations.google = { ok: false, error: (e && e.message) || 'google_sync_failed' };
  }

  try {
    const { data: xconn } = await admin
      .from('booking_xero_connections')
      .select('*')
      .eq('booking_system_id', system.id)
      .maybeSingle();
    const autoOn = xconn && (xconn.auto_create_on || 'confirmed');
    const status = (opts.status || booking.status || 'confirmed').toLowerCase();
    if (xconn && autoOn && autoOn !== 'none' && autoOn !== 'manual') {
      const shouldCreate =
        autoOn === 'created' ||
        (autoOn === 'confirmed' && (status === 'confirmed' || status === 'pending' || status === 'awaiting_payment'));
      if (shouldCreate) {
        const xero = require('./xero');
        integrations.xero = await xero.createInvoiceForBooking(
          admin,
          xconn,
          system,
          booking,
          {
            id: booking.customer_id,
            name: opts.customerName || booking.customer_name,
            email: opts.customerEmail || booking.customer_email,
            phone: opts.customerPhone || booking.customer_phone
          },
          quote,
          { send: !!(xconn.auto_send || xconn.auto_email) }
        );
      }
    }
  } catch (e) {
    integrations.xero = { ok: false, error: (e && e.message) || 'xero_sync_failed' };
  }

  return {
    ok: true,
    booking: Object.assign({}, booking, {
      starts_at: window.pickup_at,
      ends_at: window.return_at,
      total_cents: quote.total_cents
    }),
    hire: hire,
    quote: quote,
    window: window,
    availability: availability,
    terminology: resolveTerminology(system),
    integrations: integrations
  };
}

async function changeHireDates(opts) {
  const admin = getAdminClient(opts);
  const system = opts.system;
  const booking = opts.booking;
  const hire = opts.hire;
  const resource = opts.resource;
  const service = opts.service;

  const mut = assertMutableSchedule(hire, system, { forceUnlock: !!opts.forceUnlock });
  if (!mut.ok) return mut;

  const quoted = await quoteHireBooking({
    system: system,
    service: service,
    resource: resource,
    pickupYmd: opts.pickupYmd,
    pickupHm: opts.pickupHm,
    durationMode: opts.durationMode || hire.duration_mode,
    hireDays: opts.hireDays,
    returnYmd: opts.returnYmd,
    returnHm: opts.returnHm,
    extras: hire.extras_json || [],
    deliveryFeeCents: hire.delivery_fee_cents,
    includeBond: true
  });
  if (!quoted.ok) return quoted;

  const floorPreview = rescheduleFeeFloor({
    system: system,
    now: opts.now || new Date(),
    protectedStartsAt: hire.protected_starts_at || hire.pickup_at,
    rentalCents: (hire.pricing_snapshot_json && hire.pricing_snapshot_json.total_cents) || booking.total_cents,
    bondCents: hire.bond_cents,
    amountPaidCents: booking.amount_paid_cents || 0,
    feeFloorCents: hire.cancellation_fee_floor_cents || 0
  });

  if (!opts.confirm) {
    return {
      ok: true,
      requires_confirmation: true,
      window: quoted.window,
      quote: quoted.quote,
      price_diff: priceChangeDiff(
        hire.pricing_snapshot_json || { total_cents: booking.total_cents, bond_cents: hire.bond_cents },
        quoted.quote
      ),
      cancellation_floor: floorPreview,
      acknowledgement_required: floorPreview.acknowledgement_required
    };
  }

  if (floorPreview.acknowledgement_required && !opts.customerAcknowledged && opts.source === 'portal') {
    return { ok: false, error: 'acknowledgement_required', cancellation_floor: floorPreview };
  }

  const reservations = await loadResourceReservations(
    admin,
    system.id,
    resource.id,
    quoted.window.pickup_at,
    quoted.window.return_at
  );
  const existing = await loadCapacityBookings(admin, system.id, quoted.window.pickup_at, quoted.window.return_at);
  const availability = checkHireAvailability({
    system: system,
    resourceId: resource.id,
    startsAt: quoted.window.pickup_at,
    endsAt: quoted.window.return_at,
    reservations: reservations,
    existingBookings: existing,
    excludeBookingId: booking.id,
    override: !!opts.capacityOverride
  });
  if (!availability.ok) return availability;

  await admin.from('booking_hire_reschedule_history').insert({
    booking_id: booking.id,
    booking_system_id: system.id,
    site_id: system.site_id,
    actor_user_id: opts.actorUserId || null,
    actor_role: opts.source === 'portal' ? 'customer' : 'staff',
    reason: opts.reason || '',
    previous_pickup_at: hire.pickup_at,
    previous_return_at: hire.return_at,
    new_pickup_at: quoted.window.pickup_at,
    new_return_at: quoted.window.return_at,
    previous_total_cents: booking.total_cents,
    new_total_cents: quoted.quote.total_cents,
    previous_fee_floor_cents: hire.cancellation_fee_floor_cents || 0,
    new_fee_floor_cents: floorPreview.new_fee_floor_cents,
    customer_acknowledged: !!opts.customerAcknowledged
  });

  await admin
    .from('bookings')
    .update({
      starts_at: quoted.window.pickup_at,
      ends_at: quoted.window.return_at,
      subtotal_cents: quoted.quote.rental_cents,
      gst_cents: quoted.quote.gst_cents,
      total_cents: quoted.quote.total_cents,
      deposit_cents: quoted.quote.deposit_cents,
      updated_at: new Date().toISOString()
    })
    .eq('id', booking.id);

  const relock = relockPayload();
  await admin
    .from('booking_hire_details')
    .update({
      duration_mode: quoted.window.duration_mode,
      hire_days: quoted.window.hire_days,
      chargeable_days: quoted.window.chargeable_days,
      pickup_at: quoted.window.pickup_at,
      return_at: quoted.window.return_at,
      pricing_snapshot_json: quoted.quote.snapshot,
      bond_cents: quoted.quote.bond_cents,
      cancellation_fee_floor_cents: floorPreview.new_fee_floor_cents,
      locked: relock.locked,
      unlocked_until: relock.unlocked_until,
      unlocked_by: relock.unlocked_by,
      unlock_reason: relock.unlock_reason || '',
      updated_at: new Date().toISOString()
    })
    .eq('booking_id', booking.id);

  await admin.from('booking_hire_lock_events').insert({
    booking_id: booking.id,
    booking_system_id: system.id,
    site_id: system.site_id,
    action: 'relock',
    actor_user_id: opts.actorUserId || null,
    reason: opts.reason || 'dates_changed',
    previous_values: { pickup_at: hire.pickup_at, return_at: hire.return_at },
    new_values: { pickup_at: quoted.window.pickup_at, return_at: quoted.window.return_at }
  });

  return {
    ok: true,
    window: quoted.window,
    quote: quoted.quote,
    cancellation_floor: floorPreview,
    calendar: calendarEventFlags(Object.assign({}, hire, relock), system)
  };
}

async function unlockHireBooking(opts) {
  const admin = getAdminClient(opts);
  if (!opts.reason) return { ok: false, error: 'reason_required' };
  const patch = unlockPayload(opts.actorUserId, opts.reason, opts.minutes || 15);
  await admin
    .from('booking_hire_details')
    .update(Object.assign({}, patch, { updated_at: new Date().toISOString() }))
    .eq('booking_id', opts.booking.id);
  await admin.from('booking_hire_lock_events').insert({
    booking_id: opts.booking.id,
    booking_system_id: opts.system.id,
    site_id: opts.system.site_id,
    action: 'unlock',
    actor_user_id: opts.actorUserId || null,
    reason: opts.reason,
    previous_values: { locked: true },
    new_values: patch
  });
  return { ok: true, unlock: patch };
}

function previewHireCancellation(opts) {
  return calculateCancellation({
    system: opts.system,
    policy: opts.policy,
    now: opts.now || new Date(),
    protectedStartsAt: opts.hire.protected_starts_at || opts.hire.pickup_at,
    rentalCents:
      (opts.hire.pricing_snapshot_json && opts.hire.pricing_snapshot_json.total_cents) ||
      opts.booking.total_cents,
    bondCents: opts.hire.bond_cents,
    refundableExtrasCents: opts.refundableExtrasCents || 0,
    amountPaidCents: opts.booking.amount_paid_cents || 0,
    feeFloorCents: opts.hire.cancellation_fee_floor_cents || 0,
    adminOverride: !!opts.adminOverride,
    overrideFeeCents: opts.overrideFeeCents
  });
}

function fleetEventDto(booking, hire, resource, system) {
  const terms = resolveTerminology(system);
  const title = applyTemplate(defaultEventTitleTemplate(system), {
    resource_name: (resource && (resource.public_name || resource.name)) || terms.singular,
    customer_name: booking.customer_name || '',
    booking_reference: booking.reference || ''
  });
  const flags = calendarEventFlags(hire, system);
  return {
    id: booking.id,
    title: title,
    start: hire.pickup_at || booking.starts_at,
    end: hire.return_at || booking.ends_at,
    allDay: false,
    backgroundColor: (resource && (resource.calendar_colour || resource.calendar_color)) || '#155c4a',
    borderColor: (resource && resource.calendar_colour) || '#155c4a',
    textColor: (resource && resource.text_colour) || '#ffffff',
    editable: flags.editable,
    startEditable: flags.startEditable,
    durationEditable: flags.durationEditable,
    resourceIds: resource && resource.id ? [resource.id] : [],
    extendedProps: {
      booking_reference: booking.reference,
      customer_name: booking.customer_name,
      resource_name: resource && (resource.public_name || resource.name),
      status: booking.status,
      payment_status: booking.payment_status,
      agreement_status: hire.agreement_status,
      locked: flags.locked,
      lock_indicator: flags.lock_indicator,
      hire_days: hire.hire_days,
      capacity_override: !!hire.capacity_override,
      terminology: terms
    }
  };
}

module.exports = {
  quoteHireBooking,
  createHireBooking,
  changeHireDates,
  unlockHireBooking,
  previewHireCancellation,
  fleetEventDto,
  loadResourceReservations,
  loadCapacityBookings
};
