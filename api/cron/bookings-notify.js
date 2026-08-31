'use strict';

/**
 * GET/POST /api/cron/bookings-notify
 * Flush due booking_notifications via Resend/Twilio.
 * Auth: Authorization: Bearer <CRON_SECRET> when CRON_SECRET is set.
 */

const { flushPendingNotifications } = require('../../lib/bookings/notify');

module.exports = async function (req, res) {
  const json = function (code, obj) {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(obj));
  };

  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(405, { ok: false, error: 'method_not_allowed' });
  }

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const h = req.headers.authorization || '';
    if (h !== 'Bearer ' + secret) return json(401, { ok: false, error: 'unauthorized' });
  }

  try {
    const result = await flushPendingNotifications({ limit: 50 });
    return json(200, result);
  } catch (e) {
    console.error('cron/bookings-notify', e && e.message);
    return json(500, { ok: false, error: String((e && e.message) || e) });
  }
};
