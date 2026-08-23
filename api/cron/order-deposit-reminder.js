'use strict';

/**
 * Deposit reminder cron — nudge customers who have not paid their deposit.
 * Auth: Authorization: Bearer <CRON_SECRET> when CRON_SECRET is set.
 *
 * Rules:
 * - Only awaiting_deposit orders with unpaid deposit
 * - Never after effective_cutoff_at (lock date)
 * - Stage 1: after first_delay_days (default 3), or sooner if cutoff is closer
 * - Stage 2: day before lock (optional, settings.deposit_reminder.day_before_lock)
 */

const { createClient } = require('@supabase/supabase-js');
const { parseDepositReminderSettings } = require('../../lib/order/deposit-reminder-settings');
const { processOrderDepositReminder } = require('../../lib/order/deposit-reminder');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async function (req, res) {
  const json = function (code, obj) {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(obj));
  };

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const h = req.headers.authorization || '';
    if (h !== 'Bearer ' + secret) return json(401, { ok: false, error: 'unauthorized' });
  }

  try {
    const { data: systems, error } = await admin
      .from('order_systems')
      .select('*')
      .eq('enabled', true)
      .limit(200);
    if (error) throw error;

    const results = [];
    const skipped = [];
    const nowMs = Date.now();

    for (const system of systems || []) {
      const settings = parseDepositReminderSettings(system);
      if (!settings.enabled) continue;

      const { data: site } = await admin
        .from('sites')
        .select('id,slug,business_name')
        .eq('id', system.site_id)
        .maybeSingle();
      if (!site) continue;

      const { data: orders } = await admin
        .from('order_orders')
        .select('*')
        .eq('order_system_id', system.id)
        .eq('status', 'awaiting_deposit')
        .limit(120);

      for (const order of orders || []) {
        var r = await processOrderDepositReminder({
          order: order,
          system: system,
          site: site,
          settings: settings,
          now: nowMs
        });
        if (r.sent) results.push(r);
        else skipped.push(r);
      }
    }

    return json(200, {
      ok: true,
      processed: results.length,
      skipped: skipped.length,
      results: results.slice(0, 50),
      skipped_detail: skipped.slice(0, 40)
    });
  } catch (e) {
    console.error('cron/order-deposit-reminder', e);
    return json(500, { ok: false, error: String((e && e.message) || e) });
  }
};
