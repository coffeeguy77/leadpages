'use strict';

/**
 * Public Bookings API
 * GET  /api/bookings/public?slug= — catalogue
 * POST /api/bookings/public — create booking (idempotent)
 */

const { json, readBody, getAdmin, getBookingSystemForSite } = require('../../lib/bookings/auth');
const { createBooking, issuePortalToken } = require('../../lib/bookings/service');
const { quoteBooking } = require('../../lib/bookings/pricing');

const HITS = new Map();
function limited(ip) {
  const now = Date.now();
  const a = (HITS.get(ip) || []).filter(function (t) { return now - t < 60000; });
  a.push(now);
  HITS.set(ip, a);
  return a.length > 30;
}

async function loadPublic(slug) {
  const admin = getAdmin();
  const { data: site } = await admin.from('sites').select('id,slug,business_name,config').eq('slug', slug).maybeSingle();
  if (!site) return null;
  const system = await getBookingSystemForSite(site.id);
  if (!system || !system.enabled) return null;
  return { site: site, system: system };
}

module.exports = async function (req, res) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0] || 'x';
  if (limited(ip)) return json(res, 429, { ok: false, error: 'rate_limit' });

  const url = new URL(req.url, 'https://x');
  const admin = getAdmin();

  if (req.method === 'GET') {
    const slug = url.searchParams.get('slug');
    if (!slug) return json(res, 400, { ok: false, error: 'slug_required' });
    const pub = await loadPublic(slug);
    if (!pub) return json(res, 404, { ok: false, error: 'not_found' });
    const { data: services } = await admin
      .from('booking_services')
      .select('id,name,slug,short_description,description,image_url,booking_type,duration_minutes,price_model,price_cents,capacity,delivery_mode,location_label,customer_instructions,colour,category_id')
      .eq('booking_system_id', pub.system.id)
      .eq('status', 'active')
      .neq('visibility', 'private')
      .order('sort_order');
    const { data: team } = await admin
      .from('booking_team_members')
      .select('id,display_name,job_title,bio,photo_url,colour')
      .eq('booking_system_id', pub.system.id)
      .eq('active', true)
      .eq('public_visible', true);
    const { data: categories } = await admin
      .from('booking_service_categories')
      .select('id,name,slug')
      .eq('booking_system_id', pub.system.id)
      .eq('active', true)
      .order('sort_order');

    return json(res, 200, {
      ok: true,
      business: {
        name: pub.system.business_name || pub.site.business_name,
        logo_url: pub.system.logo_url,
        timezone: pub.system.timezone,
        currency: pub.system.currency,
        phone: pub.system.phone,
        email: pub.system.email
      },
      categories: categories || [],
      services: services || [],
      team: team || [],
      site: { slug: pub.site.slug }
    });
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const slug = body.slug;
    if (!slug) return json(res, 400, { ok: false, error: 'slug_required' });
    const pub = await loadPublic(slug);
    if (!pub) return json(res, 404, { ok: false, error: 'not_found' });

    if (!body.service_id || !body.starts_at || !body.customer_name) {
      return json(res, 400, { ok: false, error: 'missing_fields' });
    }
    if (!body.customer_email && !body.customer_phone) {
      return json(res, 400, { ok: false, error: 'contact_required' });
    }

    const { data: service } = await admin
      .from('booking_services')
      .select('*')
      .eq('id', body.service_id)
      .eq('booking_system_id', pub.system.id)
      .eq('status', 'active')
      .maybeSingle();
    if (!service) return json(res, 404, { ok: false, error: 'service_not_found' });

    const quote = quoteBooking({
      system: pub.system,
      service: service,
      addons: body.addons,
      attendeeCount: body.attendee_count,
      travelFeeCents: body.travel_fee_cents
    });

    // Reject client-supplied totals
    if (body.total_cents != null && Number(body.total_cents) !== quote.total_cents) {
      return json(res, 400, { ok: false, error: 'price_mismatch', quote: quote });
    }

    try {
      const result = await createBooking({
        system: pub.system,
        service: service,
        startsAt: body.starts_at,
        teamMemberId: body.team_member_id || null,
        customerName: body.customer_name,
        customerEmail: body.customer_email,
        customerPhone: body.customer_phone,
        customerNotes: body.customer_notes,
        attendeeCount: body.attendee_count,
        addons: body.addons,
        travelFeeCents: body.travel_fee_cents,
        customerAddress: body.customer_address,
        formResponses: body.form_responses,
        source: 'public',
        idempotencyKey: body.idempotency_key || null,
        force: false
      });
      if (!result.ok) return json(res, 409, result);

      // Release soft hold if client held the slot
      if (body.hold_key) {
        await admin.from('booking_holds').delete().eq('booking_system_id', pub.system.id).eq('hold_key', body.hold_key);
      }

      const portal = await issuePortalToken(result.booking, 'manage', 168);
      const out = {
        ok: true,
        booking: {
          id: result.booking.id,
          reference: result.booking.reference,
          status: result.booking.status,
          starts_at: result.booking.starts_at,
          ends_at: result.booking.ends_at,
          timezone: result.booking.timezone,
          total_cents: result.booking.total_cents,
          deposit_cents: result.booking.deposit_cents,
          payment_status: result.booking.payment_status,
          service_name: service.name,
          location_label: result.booking.location_label,
          customer_instructions: service.confirmation_instructions || service.customer_instructions
        },
        quote: quote,
        portal_token: portal.token,
        portal_url: '/booking-portal?t=' + encodeURIComponent(portal.token),
        checkout_required: result.booking.status === 'awaiting_payment' && (result.booking.deposit_cents || 0) > 0,
        manage_notice: 'Save your manage link to reschedule or cancel within policy.'
      };

      // Auto-create Stripe Checkout when deposit is due (best-effort)
      if (out.checkout_required && process.env.STRIPE_SECRET_KEY) {
        try {
          const { amountDueCents, paymentKind, stripePost, PUBLIC_BASE, connectOpts } = require('../../lib/bookings/stripe');
          const amount = amountDueCents(result.booking);
          if (amount > 0) {
            const kind = paymentKind(result.booking, amount);
            const { data: payment } = await admin.from('booking_payments').insert({
              booking_id: result.booking.id,
              booking_system_id: pub.system.id,
              site_id: pub.system.site_id,
              provider: 'stripe',
              kind: kind === 'full' ? 'full' : 'deposit',
              amount_cents: amount,
              currency: pub.system.currency || 'AUD',
              status: 'pending',
              meta: { actor: 'public' }
            }).select('*').single();

            const currency = String(pub.system.currency || 'AUD').toLowerCase();
            const success =
              PUBLIC_BASE +
              '/booking-portal?paid=1&t=' +
              encodeURIComponent(portal.token) +
              '&ref=' +
              encodeURIComponent(result.booking.reference);
            const cancel =
              PUBLIC_BASE +
              '/booking-portal?cancelled=1&t=' +
              encodeURIComponent(portal.token);

            const sessionParams = {
              mode: 'payment',
              success_url: success,
              cancel_url: cancel,
              customer_email: result.booking.customer_email || undefined,
              client_reference_id: payment.id,
              'line_items[0][price_data][currency]': currency,
              'line_items[0][price_data][product_data][name]':
                (pub.system.business_name || 'Booking') + ' — Deposit — ' + result.booking.reference,
              'line_items[0][price_data][unit_amount]': amount,
              'line_items[0][quantity]': 1,
              'metadata[booking_id]': result.booking.id,
              'metadata[payment_id]': payment.id,
              'metadata[kind]': kind === 'full' ? 'booking_payment' : 'booking_deposit',
              'metadata[site_id]': pub.system.site_id
            };
            const connect = connectOpts(pub.system);
            let stripeOpts = {};
            if (connect.accountId) {
              if (connect.mode === 'direct') stripeOpts = { stripeAccount: connect.accountId };
              else {
                sessionParams['payment_intent_data[transfer_data][destination]'] = connect.accountId;
                sessionParams['payment_intent_data[on_behalf_of]'] = connect.accountId;
              }
            }
            const session = await stripePost('checkout/sessions', sessionParams, stripeOpts);
            if (session.ok && session.data && session.data.url) {
              await admin.from('booking_payments').update({
                provider_ref: session.data.id,
                updated_at: new Date().toISOString()
              }).eq('id', payment.id);
              out.checkout_url = session.data.url;
              out.payment_id = payment.id;
            }
          }
        } catch (payErr) {
          console.warn('public book checkout', payErr && payErr.message);
        }
      }

      return json(res, 200, out);
    } catch (e) {
      console.error('public book', e && e.message);
      return json(res, 500, { ok: false, error: 'book_failed' });
    }
  }

  return json(res, 405, { ok: false, error: 'method_not_allowed' });
};
