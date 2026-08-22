'use strict';

/**
 * Customer portal auth — SMS OTP login, order history, reorder into cart.
 * Public endpoints (no staff bearer); gated by slug + phone OTP / session token.
 */

const { json, methodOk, readBody } = require('../../lib/order/http');
const { getAdmin } = require('../../lib/order/supabase');
const { normaliseAuPhone, phonesMatch, customerPhoneE164 } = require('../../lib/order/phone');
const {
  storeSmsOtp,
  verifySmsOtp,
  createCustomerSessionToken,
  resolveAccessToken
} = require('../../lib/order/tokens');
const { queueAndSend, twilioOtpConfigured, sendPortalOtpSms, checkPortalOtpSms } = require('../../lib/order/messaging');
const { createCart, addReorderLines } = require('../../lib/order/cart');
const { parseGstSettings } = require('../../lib/order/gst');
const { packCartResponse } = require('../../lib/order/cart-pack');

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

/**
 * Find customer by e164 — also matches spaced display phones when phone_e164 was never set.
 */
async function findCustomer(systemId, phoneE164) {
  const admin = getAdmin();
  const { data } = await admin
    .from('order_customers')
    .select('*')
    .eq('order_system_id', systemId)
    .eq('phone_e164', phoneE164)
    .maybeSingle();
  if (data) return data;

  const { data: rows } = await admin
    .from('order_customers')
    .select('*')
    .eq('order_system_id', systemId)
    .limit(20000);
  const match = (rows || []).find(function (c) {
    return phonesMatch(c.phone_e164 || c.phone, phoneE164);
  });
  if (match && !match.phone_e164) {
    await admin
      .from('order_customers')
      .update({ phone_e164: phoneE164, updated_at: new Date().toISOString() })
      .eq('id', match.id);
    match.phone_e164 = phoneE164;
  }
  return match || null;
}

/**
 * Re-link historical orders that share this phone but sit on another customer_id / null.
 * Import / manual edits can leave display phones with spaces while OTP uses digits-only.
 */
async function relinkOrdersForCustomer(admin, siteId, customer) {
  const e164 = customerPhoneE164(customer);
  if (!e164) return;

  if (customer.phone_e164 !== e164) {
    await admin
      .from('order_customers')
      .update({ phone_e164: e164, updated_at: new Date().toISOString() })
      .eq('id', customer.id);
    customer.phone_e164 = e164;
  }

  const { data: siteCustomers } = await admin
    .from('order_customers')
    .select('id, phone, phone_e164')
    .eq('site_id', siteId)
    .limit(20000);
  const twinIds = (siteCustomers || [])
    .filter(function (c) {
      return phonesMatch(c.phone_e164 || c.phone, e164);
    })
    .map(function (c) {
      return c.id;
    });
  if (twinIds.indexOf(customer.id) < 0) twinIds.push(customer.id);

  const otherTwins = twinIds.filter(function (id) {
    return id !== customer.id;
  });
  if (otherTwins.length) {
    await admin
      .from('order_orders')
      .update({ customer_id: customer.id, updated_at: new Date().toISOString() })
      .eq('site_id', siteId)
      .in('customer_id', otherTwins);
  }

  const { data: orphans } = await admin
    .from('order_orders')
    .select('id, customer_phone')
    .eq('site_id', siteId)
    .is('customer_id', null)
    .limit(5000);
  const orphanIds = (orphans || [])
    .filter(function (o) {
      return phonesMatch(o.customer_phone, e164);
    })
    .map(function (o) {
      return o.id;
    });
  if (orphanIds.length) {
    // Chunk updates to stay within PostgREST URL limits.
    for (var i = 0; i < orphanIds.length; i += 200) {
      var chunk = orphanIds.slice(i, i + 200);
      await admin
        .from('order_orders')
        .update({ customer_id: customer.id, updated_at: new Date().toISOString() })
        .in('id', chunk);
    }
  }
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

      await relinkOrdersForCustomer(admin, session.site_id, customer);

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
          .select(
            'id, order_id, product_id, product_name, quantity, requested_weight_kg, notes, price_status, unit_price_cents, line_known_cents'
          )
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
            'SMS is not configured yet. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and either TWILIO_VERIFY_SERVICE_SID (same as Quote Builder) or TWILIO_FROM / TWILIO_FROM_NUMBER.'
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
            'SMS is not configured yet. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM / TWILIO_FROM_NUMBER — or TWILIO_VERIFY_SERVICE_SID like Quote Builder.'
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

      const productIds = [];
      const seen = Object.create(null);
      (items || []).forEach(function (it) {
        if (it.product_id && !seen[it.product_id]) {
          seen[it.product_id] = true;
          productIds.push(it.product_id);
        }
      });

      var productsById = Object.create(null);
      if (productIds.length) {
        var { data: products } = await admin
          .from('order_products')
          .select('*')
          .in('id', productIds)
          .eq('active', true);
        (products || []).forEach(function (p) {
          productsById[p.id] = p;
        });
      }

      const added = [];
      const skipped = [];
      const lines = [];
      for (var i = 0; i < (items || []).length; i++) {
        var it = items[i];
        if (!it.product_id) {
          skipped.push({ name: it.product_name, reason: 'no_product_link' });
          continue;
        }
        var product = productsById[it.product_id];
        if (!product) {
          skipped.push({ name: it.product_name, reason: 'unavailable' });
          continue;
        }
        lines.push({
          product: product,
          quantity: it.quantity,
          requested_weight_kg: it.requested_weight_kg,
          notes: it.notes || null,
          sort_order: i
        });
        added.push({ name: product.name, product_id: product.id });
      }

      var packed;
      try {
        packed = await addReorderLines(cart, lines, parseGstSettings(system));
      } catch (e) {
        return json(res, 500, { error: String((e && e.message) || e) });
      }

      var clientCart = await packCartResponse(system, packed);
      return json(res, 200, Object.assign({
        ok: true,
        cart_id: cart.id,
        added: added,
        skipped: skipped,
        shop_url: '/order-shop?slug=' + encodeURIComponent(site.slug) + '&cart_id=' + encodeURIComponent(cart.id)
      }, clientCart));
    }

    return json(res, 400, { error: 'bad_action' });
  } catch (e) {
    console.error('order/portal-auth', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
