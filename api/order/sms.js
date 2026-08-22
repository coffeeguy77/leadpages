'use strict';

const { json, methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, ensureOrderSystem } = require('../../lib/order/auth');
const { getAdmin } = require('../../lib/order/supabase');
const { normaliseAuPhone, displayAuPhone } = require('../../lib/order/phone');
const { smsUsageSummary } = require('../../lib/order/sms-usage');
const { renderTemplate, queueAndSend } = require('../../lib/order/messaging');
const { shopUrl } = require('../../lib/order/notify');
const { displayGivenName } = require('../../lib/order/customer-name');
const { formatAud } = require('../../lib/order/money');

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET', 'POST'])) return;
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'auth' });

    const siteId =
      (req.query && req.query.site_id) || (req.body && req.body.site_id);
    const access = await assertSiteAccess(user, siteId);
    if (!access.ok) return json(res, access.code, { error: access.error });
    const system = await ensureOrderSystem(siteId);

    if (req.method === 'GET') {
      const since = req.query && req.query.since;
      const summary = await smsUsageSummary(system.id, siteId, { since: since || null });
      return json(res, 200, { ok: true, usage: summary, system_id: system.id });
    }

    const body = req.body || {};
    const action = body.action || 'broadcast';

    if (action === 'broadcast') {
      const template = String(body.body || '').trim();
      if (!template) return json(res, 400, { error: 'body_required' });
      if (template.length > 600) return json(res, 400, { error: 'body_too_long' });

      const admin = getAdmin();
      let q = admin
        .from('order_customers')
        .select('id, name, phone, phone_e164, sms_opt_in')
        .eq('order_system_id', system.id)
        .eq('sms_opt_in', true)
        .order('name', { ascending: true })
        .limit(Math.min(Number(body.limit) || 500, 2000));

      if (body.customer_ids && Array.isArray(body.customer_ids) && body.customer_ids.length) {
        q = q.in('id', body.customer_ids.slice(0, 500));
      }

      const { data: customers, error } = await q;
      if (error) throw error;

      const shopUrl =
        body.shop_url ||
        (access.site && access.site.slug
          ? 'https://' + (process.env.LEADPAGES_PUBLIC_HOST || 'leadpages.com.au') + '/order-shop?slug=' + access.site.slug
          : '');

      const results = { sent: 0, failed: 0, skipped: 0, errors: [] };
      const list = customers || [];
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        var phone = c.phone_e164 || normaliseAuPhone(c.phone);
        if (!phone) {
          results.skipped += 1;
          continue;
        }
        var first = String(c.name || '').trim().split(/\s+/)[0] || 'there';
        var rendered = renderTemplate(template, {
          first_name: first,
          name: c.name || first,
          phone: displayAuPhone(phone) || c.phone || phone,
          shop_url: shopUrl,
          business_name: (access.site && access.site.business_name) || ''
        });
        try {
          var sent = await queueAndSend({
            order_system_id: system.id,
            site_id: siteId,
            customer_id: c.id,
            channel: 'sms',
            event_type: 'broadcast',
            sms_kind: 'broadcast',
            destination: phone,
            body: rendered
          });
          if (sent.send && sent.send.ok) results.sent += 1;
          else if (sent.send && sent.send.skipped) results.skipped += 1;
          else results.failed += 1;
        } catch (e) {
          results.failed += 1;
          if (results.errors.length < 20) {
            results.errors.push({ customer_id: c.id, error: String((e && e.message) || e) });
          }
        }
        // Soft rate limit between Twilio sends
        if (i < list.length - 1) {
          await new Promise(function (r) { setTimeout(r, 120); });
        }
      }
      return json(res, 200, { ok: true, results: results, audience: list.length });
    }

    if (action === 'broadcast_open_carts') {
      const template = String(body.body || '').trim();
      if (!template) return json(res, 400, { error: 'body_required' });
      if (template.length > 600) return json(res, 400, { error: 'body_too_long' });

      const admin = getAdmin();
      const minIdleHours = Math.max(0, Number(body.min_idle_hours) || 0);
      const idleCutoff =
        minIdleHours > 0 ? new Date(Date.now() - minIdleHours * 3600000).toISOString() : null;

      let q = admin
        .from('order_carts')
        .select('*')
        .eq('order_system_id', system.id)
        .in('status', ['active', 'abandoned'])
        .gt('item_count', 0)
        .order('last_activity_at', { ascending: false })
        .limit(Math.min(Number(body.limit) || 500, 1000));

      if (idleCutoff) q = q.lt('last_activity_at', idleCutoff);

      const { data: carts, error: cartErr } = await q;
      if (cartErr) throw cartErr;

      const byPhone = Object.create(null);
      (carts || []).forEach(function (cart) {
        var phone = normaliseAuPhone(cart.guest_phone);
        if (!phone) return;
        if (!byPhone[phone]) byPhone[phone] = cart;
      });

      const results = { sent: 0, failed: 0, skipped: 0, audience: 0, errors: [] };
      const phones = Object.keys(byPhone);
      results.audience = phones.length;

      for (var j = 0; j < phones.length; j++) {
        var phoneKey = phones[j];
        var cartRow = byPhone[phoneKey];
        var checkout = shopUrl(access.site && access.site.slug, cartRow.id);
        var first = displayGivenName(cartRow.guest_name) || 'there';
        var rendered = renderTemplate(template, {
          first_name: first,
          name: cartRow.guest_name || first,
          phone: displayAuPhone(phoneKey) || cartRow.guest_phone || phoneKey,
          shop_url: checkout,
          checkout_link: checkout,
          cart_total:
            cartRow.known_subtotal_cents != null ? formatAud(cartRow.known_subtotal_cents) : '',
          business_name: (access.site && access.site.business_name) || ''
        });
        try {
          var sentOpen = await queueAndSend({
            order_system_id: system.id,
            site_id: siteId,
            cart_id: cartRow.id,
            customer_id: cartRow.customer_id || null,
            channel: 'sms',
            event_type: 'broadcast_open_cart',
            sms_kind: 'broadcast',
            destination: phoneKey,
            body: rendered
          });
          if (sentOpen.send && sentOpen.send.ok) results.sent += 1;
          else if (sentOpen.send && sentOpen.send.skipped) results.skipped += 1;
          else results.failed += 1;
        } catch (e) {
          results.failed += 1;
          if (results.errors.length < 20) {
            results.errors.push({ cart_id: cartRow.id, error: String((e && e.message) || e) });
          }
        }
        if (j < phones.length - 1) {
          await new Promise(function (r) { setTimeout(r, 120); });
        }
      }

      return json(res, 200, { ok: true, results: results });
    }

    return json(res, 400, { error: 'bad_action' });
  } catch (e) {
    console.error('order/sms', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
