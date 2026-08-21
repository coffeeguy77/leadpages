'use strict';

/**
 * Customer portal auth — SMS OTP login, order history, reorder into cart.
 * Public endpoints (no staff bearer); gated by slug + phone OTP / session token.
 */

const { json, methodOk, readBody } = require('../../lib/order/http');
const { getAdmin } = require('../../lib/order/supabase');
const { normaliseAuPhone } = require('../../lib/order/phone');
const {
  storeSmsOtp,
  verifySmsOtp,
  createCustomerSessionToken,
  resolveAccessToken
} = require('../../lib/order/tokens');
const { queueAndSend, twilioOtpConfigured, sendPortalOtpSms, checkPortalOtpSms } = require('../../lib/order/messaging');
const { createCart, addOrUpdateItem } = require('../../lib/order/cart');

function sixDigitCode() {
  return String(100000 + Math.floor(Math.random() * 900000));
}

async function siteBySlug(slug) {
  const admin = getAdmin();
  const { data } = await admin
    .from('sites')
    .select('id, slug, business_name')
    .eq('slug', slug)
    .maybeSingle();
  return data;
}

async function systemForSite(siteId) {
  const admin = getAdmin();
  const { data } = await admin.from('order_systems').select('*').eq('site_id', siteId).maybeSingle();
  return data;
}

async function findCustomer(systemId, phoneE164) {
  const admin = getAdmin();
  const { data } = await admin
    .from('order_customers')
    .select('*')
    .eq('order_system_id', systemId)
    .eq('phone_e164', phoneE164)
    .maybeSingle();
  return data;
}

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET', 'POST'])) return;
    const admin = getAdmin();

    if (req.method === 'GET') {
      const token = (req.query && (req.query.token || req.query.t)) || '';
      const session = await resolveAccessToken(token);
      if (!session || session.purpose !== 'portal_customer' || !session.customer_id) {
        return json(res, 401, { error: 'auth' });
      }
      const { data: customer } = await admin
        .from('order_customers')
        .select('id, name, phone, phone_e164, email')
        .eq('id', session.customer_id)
        .maybeSingle();
      if (!customer) return json(res, 404, { error: 'customer_not_found' });

      const { data: orders } = await admin
        .from('order_orders')
        .select(
          'id, order_number, status, pickup_date, known_subtotal_cents, deposit_paid_cents, has_unknown_prices, price_status, created_at, customer_name'
        )
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(50);

      const orderIds = (orders || []).map(function (o) {
        return o.id;
      });
      let itemsByOrder = {};
      if (orderIds.length) {
        const { data: items } = await admin
          .from('order_items')
          .select('id, order_id, product_id, product_name, quantity, notes, price_status, unit_price_cents, line_known_cents')
          .in('order_id', orderIds);
        (items || []).forEach(function (it) {
          if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
          itemsByOrder[it.order_id].push(it);
        });
      }

      const packed = (orders || []).map(function (o) {
        return Object.assign({}, o, { items: itemsByOrder[o.id] || [] });
      });

      return json(res, 200, {
        ok: true,
        customer: customer,
        orders: packed,
        site_id: session.site_id
      });
    }

    const body = await readBody(req);
    const action = body.action || 'send_code';
    const slug = String(body.slug || '').trim();
    if (!slug) return json(res, 400, { error: 'slug_required' });
    const site = await siteBySlug(slug);
    if (!site) return json(res, 404, { error: 'site_not_found' });
    const system = await systemForSite(site.id);
    if (!system || !system.enabled) return json(res, 404, { error: 'ordering_disabled' });

    if (action === 'send_code') {
      const phone = normaliseAuPhone(body.phone);
      if (!phone || phone.length < 11) return json(res, 400, { error: 'bad_phone' });
      if (!twilioOtpConfigured()) {
        return json(res, 503, {
          error: 'sms_not_configured',
          message:
            'SMS is not configured yet. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and either TWILIO_VERIFY_SERVICE_SID (same as Quote Builder) or TWILIO_FROM_NUMBER.'
        });
      }
      const customer = await findCustomer(system.id, phone);
      if (!customer) {
        // Privacy: do not reveal whether the phone exists.
        return json(res, 200, {
          ok: true,
          sent: true,
          message: 'If we have orders for that number, a code is on its way.'
        });
      }

      const useVerify = !!process.env.TWILIO_VERIFY_SERVICE_SID;
      const code = sixDigitCode();
      // Always store a local OTP row for audit / fallback Messages path.
      await storeSmsOtp({
        site_id: site.id,
        order_system_id: system.id,
        customer_id: customer.id,
        phone_e164: phone,
        code: useVerify ? 'VERIFY' : code
      });

      const otpBody =
        'Your ' +
        (site.business_name || 'order') +
        ' login code is ' +
        code +
        '. It expires in 10 minutes.';

      if (useVerify) {
        const sent = await sendPortalOtpSms({ to: phone, body: otpBody });
        if (sent && sent.skipped) {
          return json(res, 503, {
            error: 'sms_not_configured',
            message:
              'SMS is not configured yet. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID (same as Quote Builder).'
          });
        }
        if (!sent || sent.ok === false) {
          return json(res, 502, {
            error: 'sms_failed',
            message: 'Could not send the SMS code. Please try again in a moment.'
          });
        }
        return json(res, 200, { ok: true, sent: true, provider: 'twilio_verify' });
      }

      const sent = await queueAndSend({
        order_system_id: system.id,
        site_id: site.id,
        customer_id: customer.id,
        channel: 'sms',
        event_type: 'otp',
        sms_kind: 'otp',
        destination: phone,
        body: otpBody
      });
      if (sent && sent.send && sent.send.skipped) {
        return json(res, 503, {
          error: 'sms_not_configured',
          message:
            'SMS is not configured yet. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER — or TWILIO_VERIFY_SERVICE_SID like Quote Builder.'
        });
      }
      if (sent && sent.send && sent.send.ok === false) {
        return json(res, 502, {
          error: 'sms_failed',
          message: 'Could not send the SMS code. Please try again in a moment.'
        });
      }
      return json(res, 200, { ok: true, sent: true, provider: 'twilio_messages' });
    }

    if (action === 'verify_code') {
      const phone = normaliseAuPhone(body.phone);
      const code = String(body.code || '').trim();
      if (!phone || !code) return json(res, 400, { error: 'bad_input' });

      let customerId = null;
      if (process.env.TWILIO_VERIFY_SERVICE_SID) {
        const check = await checkPortalOtpSms({ to: phone, code: code });
        if (!check || !check.ok) return json(res, 401, { error: 'invalid_code' });
        const customer = await findCustomer(system.id, phone);
        if (!customer) return json(res, 404, { error: 'customer_not_found' });
        customerId = customer.id;
      } else {
        const otp = await verifySmsOtp({ site_id: site.id, phone_e164: phone, code: code });
        if (!otp) return json(res, 401, { error: 'invalid_code' });
        customerId = otp.customer_id;
        if (!customerId) {
          const customer = await findCustomer(system.id, phone);
          if (!customer) return json(res, 404, { error: 'customer_not_found' });
          customerId = customer.id;
        }
      }

      const session = await createCustomerSessionToken({
        site_id: site.id,
        order_system_id: system.id,
        customer_id: customerId,
        meta: { phone_e164: phone }
      });
      return json(res, 200, {
        ok: true,
        token: session.token,
        expires_at: session.record.expires_at,
        customer_id: customerId
      });
    }

    if (action === 'reorder') {
      const token = body.token || '';
      const session = await resolveAccessToken(token);
      if (!session || session.purpose !== 'portal_customer' || !session.customer_id) {
        return json(res, 401, { error: 'auth' });
      }
      const orderId = body.order_id;
      if (!orderId) return json(res, 400, { error: 'order_id_required' });
      const { data: order } = await admin
        .from('order_orders')
        .select('*')
        .eq('id', orderId)
        .eq('customer_id', session.customer_id)
        .maybeSingle();
      if (!order) return json(res, 404, { error: 'order_not_found' });

      const { data: items } = await admin
        .from('order_items')
        .select('*')
        .eq('order_id', order.id)
        .order('sort_order', { ascending: true });

      const cart = await createCart(system, site.id, {
        name: order.customer_name,
        phone: order.customer_phone,
        email: order.customer_email
      });
      await admin
        .from('order_carts')
        .update({ customer_id: session.customer_id })
        .eq('id', cart.id);

      const added = [];
      const skipped = [];
      for (var i = 0; i < (items || []).length; i++) {
        var it = items[i];
        if (!it.product_id) {
          skipped.push({ name: it.product_name, reason: 'no_product_link' });
          continue;
        }
        var { data: product } = await admin
          .from('order_products')
          .select('*')
          .eq('id', it.product_id)
          .eq('active', true)
          .maybeSingle();
        if (!product) {
          skipped.push({ name: it.product_name, reason: 'unavailable' });
          continue;
        }
        try {
          await addOrUpdateItem(cart, product, {
            quantity: it.quantity,
            requested_weight_kg: it.requested_weight_kg,
            notes: it.notes || null
          });
          added.push({ name: product.name, product_id: product.id });
        } catch (e) {
          skipped.push({ name: it.product_name, reason: String((e && e.message) || e) });
        }
      }

      return json(res, 200, {
        ok: true,
        cart_id: cart.id,
        added: added,
        skipped: skipped,
        shop_url: '/order-shop?slug=' + encodeURIComponent(site.slug) + '&cart_id=' + encodeURIComponent(cart.id)
      });
    }

    return json(res, 400, { error: 'bad_action' });
  } catch (e) {
    console.error('order/portal-auth', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
