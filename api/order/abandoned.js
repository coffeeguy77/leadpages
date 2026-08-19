'use strict';

const { json, methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, ensureOrderSystem } = require('../../lib/order/auth');
const { getAdmin } = require('../../lib/order/supabase');
const { formatAud } = require('../../lib/order/money');

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET'])) return;
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'auth' });
    const siteId = req.query && req.query.site_id;
    const access = await assertSiteAccess(user, siteId);
    if (!access.ok) return json(res, access.code, { error: access.error });
    const system = await ensureOrderSystem(siteId);
    const admin = getAdmin();

    const { data: carts } = await admin
      .from('order_carts')
      .select('*')
      .eq('order_system_id', system.id)
      .order('updated_at', { ascending: false })
      .limit(300);

    const { data: events } = await admin
      .from('order_abandoned_events')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(200);

    const list = carts || [];
    const created = list.length;
    const converted = list.filter(function (c) {
      return c.status === 'converted';
    }).length;
    const abandoned = list.filter(function (c) {
      return c.status === 'abandoned';
    }).length;
    const recovered = list.filter(function (c) {
      return c.status === 'recovered';
    }).length;
    const recoveredRevenue = list
      .filter(function (c) {
        return c.status === 'recovered' || (c.status === 'converted' && c.recovery_state && c.recovery_state.recovered);
      })
      .reduce(function (s, c) {
        return s + (Number(c.known_subtotal_cents) || 0);
      }, 0);

    const messagesSent = (events || []).filter(function (e) {
      return e.status === 'sent';
    }).length;

    return json(res, 200, {
      carts: list,
      events: events || [],
      analytics: {
        carts_created: created,
        converted: converted,
        abandoned: abandoned,
        recovered: recovered,
        recovery_rate: abandoned + recovered > 0 ? Math.round((recovered / (abandoned + recovered)) * 1000) / 10 : 0,
        recovered_revenue_cents: recoveredRevenue,
        recovered_revenue: formatAud(recoveredRevenue),
        messages_sent: messagesSent,
        enabled: !!system.abandoned_cart_enabled,
        delay_minutes: system.abandoned_cart_delay_minutes,
        channels: system.abandoned_cart_channels
      }
    });
  } catch (e) {
    console.error('order/abandoned', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
