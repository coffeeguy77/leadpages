'use strict';

/**
 * POST /api/bookings/checkout
 * Create Stripe Checkout for a booking deposit/balance.
 * Auth: portal token (t) OR staff Bearer + site_id + booking_id
 */

const { json, readBody, getAdmin, requireUser, assertSiteAccess } = require('../../lib/bookings/auth');
const { hashToken } = require('../../lib/bookings/service');
const {
  PUBLIC_BASE,
  stripePost,
  amountDueCents,
  paymentKind,
  connectOpts
} = require('../../lib/bookings/stripe');

async function loadByPortalToken(raw) {
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
  const { data: system } = await admin.from('booking_systems').select('*').eq('id', booking.booking_system_id).maybeSingle();
  return { booking: booking, system: system, portalToken: raw };
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  if (!process.env.STRIPE_SECRET_KEY) {
    return json(res, 503, { ok: false, error: 'payments_not_configured' });
  }

  try {
    const body = await readBody(req);
    const admin = getAdmin();
    let booking = null;
    let system = null;
    let portalToken = body.t || body.token || '';
    let actor = 'portal';

    if (portalToken) {
      const loaded = await loadByPortalToken(portalToken);
      if (!loaded) return json(res, 401, { ok: false, error: 'invalid_or_expired_link' });
      booking = loaded.booking;
      system = loaded.system;
    } else {
      const user = await requireUser(req);
      if (!user) return json(res, 401, { ok: false, error: 'auth' });
      const access = await assertSiteAccess(user, body.site_id);
      if (!access.ok) return json(res, access.code, { ok: false, error: access.error });
      const { data } = await admin
        .from('bookings')
        .select('*')
        .eq('id', body.booking_id)
        .eq('site_id', body.site_id)
        .maybeSingle();
      booking = data;
      if (booking) {
        const r = await admin.from('booking_systems').select('*').eq('id', booking.booking_system_id).maybeSingle();
        system = r.data;
      }
      actor = 'staff';
    }

    if (!booking || !system) return json(res, 404, { ok: false, error: 'booking_not_found' });

    const amount = amountDueCents(booking);
    if (amount <= 0) return json(res, 400, { ok: false, error: 'nothing_due' });

    const kind = paymentKind(booking, amount);
    const metaKind = kind === 'full' ? 'booking_payment' : 'booking_deposit';

    const { data: payment, error: pErr } = await admin
      .from('booking_payments')
      .insert({
        booking_id: booking.id,
        booking_system_id: booking.booking_system_id,
        site_id: booking.site_id,
        provider: 'stripe',
        kind: kind === 'full' ? 'full' : kind === 'balance' ? 'balance' : 'deposit',
        amount_cents: amount,
        currency: system.currency || 'AUD',
        status: 'pending',
        meta: { actor: actor }
      })
      .select('*')
      .single();
    if (pErr) throw pErr;

    const { data: site } = await admin.from('sites').select('id,slug,business_name').eq('id', booking.site_id).maybeSingle();
    const businessName = system.business_name || (site && site.business_name) || 'Booking';
    const slug = (site && site.slug) || '';

    const q = [];
    if (portalToken) q.push('t=' + encodeURIComponent(portalToken));
    if (slug) q.push('slug=' + encodeURIComponent(slug));
    q.push('ref=' + encodeURIComponent(booking.reference));
    const baseQ = q.join('&');
    const success = PUBLIC_BASE + '/booking-portal?paid=1&' + baseQ;
    const cancel = PUBLIC_BASE + '/booking-portal?cancelled=1&' + baseQ;

    const productName = businessName + ' — ' + (kind === 'full' ? 'Payment' : 'Deposit') + ' — ' + booking.reference;
    const currency = String(system.currency || 'AUD').toLowerCase();

    const sessionParams = {
      mode: 'payment',
      success_url: success,
      cancel_url: cancel,
      customer_email: booking.customer_email || undefined,
      client_reference_id: payment.id,
      'line_items[0][price_data][currency]': currency,
      'line_items[0][price_data][product_data][name]': productName,
      'line_items[0][price_data][product_data][description]': 'Booking ' + booking.reference,
      'line_items[0][price_data][unit_amount]': amount,
      'line_items[0][quantity]': 1,
      'metadata[booking_id]': booking.id,
      'metadata[payment_id]': payment.id,
      'metadata[kind]': metaKind,
      'metadata[site_id]': booking.site_id,
      'metadata[reference]': booking.reference
    };

    const connect = connectOpts(system);
    let stripeOpts = {};
    if (connect.accountId) {
      sessionParams['metadata[stripe_connect_account_id]'] = connect.accountId;
      if (connect.mode === 'direct') {
        stripeOpts = { stripeAccount: connect.accountId };
      } else {
        sessionParams['payment_intent_data[transfer_data][destination]'] = connect.accountId;
        sessionParams['payment_intent_data[on_behalf_of]'] = connect.accountId;
      }
    }

    const session = await stripePost('checkout/sessions', sessionParams, stripeOpts);
    if (!session.ok || !session.data || !session.data.url) {
      await admin.from('booking_payments').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', payment.id);
      return json(res, 502, { ok: false, error: 'stripe_session_failed', detail: session.data });
    }

    await admin
      .from('booking_payments')
      .update({
        provider_ref: session.data.id,
        meta: Object.assign({}, payment.meta || {}, { checkout_url: session.data.url }),
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    await admin.from('booking_activity').insert({
      booking_id: booking.id,
      booking_system_id: booking.booking_system_id,
      site_id: booking.site_id,
      event_type: 'checkout_created',
      summary: 'Stripe checkout created for ' + amount + ' cents',
      meta: { payment_id: payment.id, session_id: session.data.id, actor: actor }
    });

    return json(res, 200, {
      ok: true,
      url: session.data.url,
      payment_id: payment.id,
      amount_cents: amount,
      kind: kind,
      reference: booking.reference
    });
  } catch (e) {
    console.error('bookings/checkout', e && e.message);
    return json(res, 500, { ok: false, error: 'checkout_failed', message: String((e && e.message) || e) });
  }
};
