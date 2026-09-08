'use strict';

/**
 * Staff hire booking create / unlock / change-dates / cancel preview.
 * POST /api/bookings/hire/bookings
 */

const {
  requireUser,
  assertSiteAccess,
  getBookingSystemForSite,
  json,
  readBody,
  getAdmin
} = require('../../../lib/bookings/auth');
const {
  createHireBooking,
  changeHireDates,
  unlockHireBooking,
  previewHireCancellation,
  quoteHireBooking
} = require('../../../lib/bookings/hire/service');
const { generateAgreement } = require('../../../lib/bookings/hire/agreements');
const { createSetupIntent, persistPaymentMethod } = require('../../../lib/bookings/hire/card-on-file');

module.exports = async function (req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  const user = await requireUser(req);
  if (!user) return json(res, 401, { ok: false, error: 'auth' });
  const body = await readBody(req);
  const siteId = body.site_id;
  const access = await assertSiteAccess(user, siteId);
  if (!access.ok) return json(res, access.code, { ok: false, error: access.error });
  const system = await getBookingSystemForSite(siteId);
  if (!system) return json(res, 404, { ok: false, error: 'system_not_found' });
  const admin = getAdmin();
  const action = body.action || 'create';

  if (action === 'create') {
    const { data: service } = await admin
      .from('booking_services')
      .select('*')
      .eq('id', body.service_id)
      .eq('booking_system_id', system.id)
      .maybeSingle();
    const { data: resource } = await admin
      .from('booking_resources')
      .select('*')
      .eq('id', body.resource_id)
      .eq('booking_system_id', system.id)
      .maybeSingle();
    if (!service || !resource) return json(res, 404, { ok: false, error: 'service_or_resource_not_found' });

    const result = await createHireBooking({
      admin: admin,
      system: system,
      service: service,
      resource: resource,
      pickupYmd: body.pickup_ymd,
      pickupHm: body.pickup_hm,
      durationMode: body.duration_mode,
      hireDays: body.hire_days,
      returnYmd: body.return_ymd,
      returnHm: body.return_hm,
      extras: body.extras,
      customerName: body.customer_name,
      customerEmail: body.customer_email,
      customerPhone: body.customer_phone,
      customerNotes: body.customer_notes,
      internalNotes: body.internal_notes,
      driver: body.driver,
      additionalDrivers: body.additional_drivers,
      emergencyContact: body.emergency_contact,
      billingAddress: body.billing_address,
      deliveryOption: body.delivery_option,
      paymentAuthorityAccepted: body.payment_authority_accepted,
      cancellationPolicyAccepted: body.cancellation_policy_accepted,
      capacityOverride: !!body.capacity_override,
      capacityOverrideReason: body.capacity_override_reason,
      actorUserId: user.id,
      source: 'admin',
      idempotencyKey: body.idempotency_key
    });
    if (!result.ok) return json(res, 400, result);
    return json(res, 200, result);
  }

  if (action === 'unlock') {
    const { data: booking } = await admin
      .from('bookings')
      .select('*')
      .eq('id', body.booking_id)
      .eq('booking_system_id', system.id)
      .maybeSingle();
    if (!booking) return json(res, 404, { ok: false, error: 'not_found' });
    const result = await unlockHireBooking({
      admin: admin,
      system: system,
      booking: booking,
      actorUserId: user.id,
      reason: body.reason,
      minutes: body.minutes
    });
    if (!result.ok) return json(res, 400, result);
    return json(res, 200, result);
  }

  if (action === 'change_dates') {
    const { data: booking } = await admin
      .from('bookings')
      .select('*')
      .eq('id', body.booking_id)
      .eq('booking_system_id', system.id)
      .maybeSingle();
    if (!booking) return json(res, 404, { ok: false, error: 'not_found' });
    const { data: hire } = await admin
      .from('booking_hire_details')
      .select('*')
      .eq('booking_id', booking.id)
      .maybeSingle();
    const { data: resource } = await admin
      .from('booking_resources')
      .select('*')
      .eq('id', hire && hire.resource_id)
      .maybeSingle();
    const { data: service } = await admin
      .from('booking_services')
      .select('*')
      .eq('id', booking.service_id)
      .maybeSingle();
    if (!hire || !resource || !service) return json(res, 404, { ok: false, error: 'hire_not_found' });
    const result = await changeHireDates({
      admin: admin,
      system: system,
      booking: booking,
      hire: hire,
      resource: resource,
      service: service,
      pickupYmd: body.pickup_ymd,
      pickupHm: body.pickup_hm,
      durationMode: body.duration_mode,
      hireDays: body.hire_days,
      returnYmd: body.return_ymd,
      returnHm: body.return_hm,
      confirm: !!body.confirm,
      customerAcknowledged: !!body.customer_acknowledged,
      capacityOverride: !!body.capacity_override,
      forceUnlock: !!body.force_unlock,
      reason: body.reason,
      actorUserId: user.id,
      source: 'admin'
    });
    if (!result.ok) return json(res, 400, result);
    return json(res, 200, result);
  }

  if (action === 'cancel_preview') {
    const { data: booking } = await admin
      .from('bookings')
      .select('*')
      .eq('id', body.booking_id)
      .eq('booking_system_id', system.id)
      .maybeSingle();
    const { data: hire } = await admin
      .from('booking_hire_details')
      .select('*')
      .eq('booking_id', body.booking_id)
      .maybeSingle();
    if (!booking || !hire) return json(res, 404, { ok: false, error: 'not_found' });
    return json(res, 200, {
      ok: true,
      cancellation: previewHireCancellation({
        system: system,
        booking: booking,
        hire: hire,
        refundableExtrasCents: body.refundable_extras_cents,
        adminOverride: !!body.admin_override,
        overrideFeeCents: body.override_fee_cents
      })
    });
  }

  if (action === 'generate_agreement') {
    const { data: booking } = await admin
      .from('bookings')
      .select('*')
      .eq('id', body.booking_id)
      .eq('booking_system_id', system.id)
      .maybeSingle();
    const { data: hire } = await admin
      .from('booking_hire_details')
      .select('*')
      .eq('booking_id', body.booking_id)
      .maybeSingle();
    const { data: resource } = await admin
      .from('booking_resources')
      .select('*')
      .eq('id', hire && hire.resource_id)
      .maybeSingle();
    const { data: customer } = await admin
      .from('booking_customers')
      .select('*')
      .eq('id', booking && booking.customer_id)
      .maybeSingle();
    if (!booking || !hire) return json(res, 404, { ok: false, error: 'not_found' });
    const result = await generateAgreement(admin, {
      system: system,
      booking: booking,
      hire: hire,
      resource: resource,
      customer: customer || {
        name: booking.customer_name,
        email: booking.customer_email,
        phone: booking.customer_phone
      },
      quote: hire.pricing_snapshot_json,
      actorUserId: user.id
    });
    if (!result.ok) return json(res, 400, result);
    return json(res, 200, result);
  }

  if (action === 'setup_card') {
    const { data: booking } = await admin
      .from('bookings')
      .select('*')
      .eq('id', body.booking_id)
      .eq('booking_system_id', system.id)
      .maybeSingle();
    if (!booking) return json(res, 404, { ok: false, error: 'not_found' });
    let customer = null;
    if (booking.customer_id) {
      const c = await admin.from('booking_customers').select('*').eq('id', booking.customer_id).maybeSingle();
      customer = c.data;
    }
    customer = customer || {
      id: booking.customer_id,
      name: booking.customer_name,
      email: booking.customer_email,
      phone: booking.customer_phone
    };
    const result = await createSetupIntent({
      admin: admin,
      system: system,
      customer: customer,
      bookingId: booking.id
    });
    if (!result.ok) return json(res, 400, result);
    return json(res, 200, result);
  }

  if (action === 'save_card') {
    const { data: booking } = await admin
      .from('bookings')
      .select('*')
      .eq('id', body.booking_id)
      .eq('booking_system_id', system.id)
      .maybeSingle();
    if (!booking) return json(res, 404, { ok: false, error: 'not_found' });
    const { data: customer } = await admin
      .from('booking_customers')
      .select('*')
      .eq('id', booking.customer_id)
      .maybeSingle();
    const result = await persistPaymentMethod(admin, {
      system: system,
      customer: customer || {
        id: booking.customer_id,
        name: booking.customer_name,
        email: booking.customer_email,
        stripe_customer_id: body.stripe_customer_id
      },
      bookingId: booking.id,
      paymentMethodId: body.payment_method_id,
      setupIntentId: body.setup_intent_id,
      consentAccepted: !!body.consent_accepted,
      consentVersion: body.consent_version,
      consentText: body.consent_text,
      ip: req.headers['x-forwarded-for'] || '',
      userAgent: req.headers['user-agent'] || ''
    });
    if (!result.ok) return json(res, 400, result);
    return json(res, 200, result);
  }

  if (action === 'quote') {
    const { data: service } = await admin
      .from('booking_services')
      .select('*')
      .eq('id', body.service_id)
      .eq('booking_system_id', system.id)
      .maybeSingle();
    const { data: resource } = body.resource_id
      ? await admin
          .from('booking_resources')
          .select('*')
          .eq('id', body.resource_id)
          .eq('booking_system_id', system.id)
          .maybeSingle()
      : { data: null };
    const result = await quoteHireBooking({
      system: system,
      service: service,
      resource: resource || {},
      pickupYmd: body.pickup_ymd,
      pickupHm: body.pickup_hm,
      durationMode: body.duration_mode,
      hireDays: body.hire_days,
      returnYmd: body.return_ymd,
      returnHm: body.return_hm,
      extras: body.extras,
      includeBond: body.include_bond !== false
    });
    if (!result.ok) return json(res, 400, result);
    return json(res, 200, result);
  }

  return json(res, 400, { ok: false, error: 'unknown_action' });
};
