'use strict';

const { readBody, json, methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, ensureOrderSystem } = require('../../lib/order/auth');
const { calendarDayStats, isDateAvailable } = require('../../lib/order/capacity');
const { lockOrdersForDate } = require('../../lib/order/service');
const { formatAud } = require('../../lib/order/money');

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET', 'POST'])) return;
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'auth' });
    const body = req.method === 'GET' ? {} : await readBody(req);
    const siteId = (req.query && req.query.site_id) || body.site_id;
    const access = await assertSiteAccess(user, siteId);
    if (!access.ok) return json(res, access.code, { error: access.error });
    const system = await ensureOrderSystem(siteId);

    if (req.method === 'GET') {
      const from = (req.query && req.query.from) || null;
      const to = (req.query && req.query.to) || null;
      const days = await calendarDayStats(system.id, from, to);
      const enriched = [];
      for (const d of days) {
        const cap = await isDateAvailable(system, d.date);
        enriched.push(
          Object.assign({}, d, {
            capacity: cap,
            known_value: formatAud(d.known_value_cents),
            deposits: formatAud(d.deposits_cents)
          })
        );
      }
      return json(res, 200, { days: enriched, system: { capacity_enabled: system.capacity_enabled, capacity_per_day: system.capacity_per_day } });
    }

    if (body.action === 'lock_date') {
      if (!body.pickup_date) return json(res, 400, { error: 'pickup_date_required' });
      const out = await lockOrdersForDate(system, access.site, body.pickup_date, {
        user_id: user.id,
        label: user.email
      });
      return json(res, 200, out);
    }

    return json(res, 400, { error: 'unknown_action' });
  } catch (e) {
    console.error('order/calendar', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
