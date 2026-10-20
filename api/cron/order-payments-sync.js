'use strict';

/**
 * Order payments sweep — records Stripe deposit payments the webhook missed.
 * Asks Stripe about every pending deposit checkout from the last 35 days.
 * Auth: Authorization: Bearer <CRON_SECRET> when CRON_SECRET is set.
 */

const { syncPendingPayments } = require('../../lib/order/stripe-pay');

module.exports = async function (req, res) {
  const json = function (code, obj) {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(obj));
  };
  const secret = process.env.CRON_SECRET;
  if (secret && (req.headers.authorization || '') !== 'Bearer ' + secret) {
    return json(401, { ok: false, error: 'unauthorized' });
  }
  try {
    const out = await syncPendingPayments({ limit: 200 });
    if (out.recorded) console.log('cron/order-payments-sync recorded', out.recorded, 'of', out.checked);
    return json(200, { ok: true, checked: out.checked, recorded: out.recorded });
  } catch (e) {
    console.error('cron/order-payments-sync', e);
    return json(500, { ok: false, error: String((e && e.message) || e) });
  }
};
