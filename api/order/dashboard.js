'use strict';

const { json, methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, ensureOrderSystem } = require('../../lib/order/auth');
const { getAdmin } = require('../../lib/order/supabase');
const { formatAud } = require('../../lib/order/money');
const { storeCutoffRuleLabel, nearestFutureCutoff, cutoffSummary } = require('../../lib/order/cutoff-display');
const { parseDepositReminderSettings } = require('../../lib/order/deposit-reminder-settings');

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

    const today = new Date();
    const tz = system.timezone || 'Australia/Sydney';
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    const todayStr = fmt.format(today);
    const tomorrow = new Date(today.getTime() + 86400000);
    const tomorrowStr = fmt.format(tomorrow);

    async function countWhere(builder) {
      const { count, error } = await builder;
      if (error) throw error;
      return count || 0;
    }

    const base = function () {
      return admin.from('order_orders').select('id', { count: 'exact', head: true }).eq('order_system_id', system.id);
    };

    const [
      todayPickups,
      tomorrowPickups,
      awaitingDeposit,
      locked,
      ready,
      unknownPrices,
      abandonedCarts,
      customersCount,
      ordersActive,
      ordersNew,
      ordersArchived
    ] = await Promise.all([
      countWhere(base().eq('pickup_date', todayStr).not('status', 'in', '("cancelled","draft","archived","completed")')),
      countWhere(base().eq('pickup_date', tomorrowStr).not('status', 'in', '("cancelled","draft","archived","completed")')),
      countWhere(base().eq('status', 'awaiting_deposit')),
      countWhere(base().eq('editing_state', 'locked').not('status', 'in', '("cancelled","draft","archived","completed")')),
      countWhere(base().eq('status', 'ready')),
      countWhere(base().eq('has_unknown_prices', true).not('status', 'in', '("cancelled","completed","archived","draft")')),
      admin
        .from('order_carts')
        .select('id', { count: 'exact', head: true })
        .eq('order_system_id', system.id)
        .eq('status', 'abandoned')
        .then(function (r) {
          if (r.error) throw r.error;
          return r.count || 0;
        }),
      admin
        .from('order_customers')
        .select('id', { count: 'exact', head: true })
        .eq('order_system_id', system.id)
        .then(function (r) {
          if (r.error) throw r.error;
          return r.count || 0;
        }),
      countWhere(base().not('status', 'in', '("cancelled","draft","archived","completed","refunded")')),
      countWhere(base().in('status', ['awaiting_deposit', 'confirmed'])),
      countWhere(base().in('status', ['archived', 'completed']))
    ]);

    const { data: recent } = await admin
      .from('order_orders')
      .select('id, order_number, customer_name, status, pickup_date, known_subtotal_cents, deposit_paid_cents, has_unknown_prices, editing_state, created_at')
      .eq('order_system_id', system.id)
      .order('created_at', { ascending: false })
      .limit(12);

    const { data: depositPaidRows } = await admin
      .from('order_payments')
      .select('amount_cents')
      .eq('site_id', siteId)
      .eq('kind', 'deposit')
      .eq('status', 'paid');
    const depositsReceived = (depositPaidRows || []).reduce(function (s, r) {
      return s + (Number(r.amount_cents) || 0);
    }, 0);

    const { data: depositAwaiting } = await admin
      .from('order_orders')
      .select('id,order_number,effective_cutoff_at,status,deposit_required_cents,deposit_paid_cents')
      .eq('order_system_id', system.id)
      .eq('status', 'awaiting_deposit')
      .not('effective_cutoff_at', 'is', null)
      .order('effective_cutoff_at', { ascending: true })
      .limit(80);

    const nearestCutoff = nearestFutureCutoff(depositAwaiting || [], new Date());
    const reminderSettings = parseDepositReminderSettings(system);

    return json(res, 200, {
      system: {
        id: system.id,
        enabled: system.enabled,
        industry_preset: system.industry_preset,
        payment_rule: system.payment_rule,
        deposit_amount_cents: system.deposit_amount_cents,
        default_cutoff_mode: system.default_cutoff_mode,
        default_cutoff_value: system.default_cutoff_value,
        default_cutoff_time: system.default_cutoff_time,
        timezone: system.timezone
      },
      kpis: {
        today_pickups: todayPickups,
        tomorrow_pickups: tomorrowPickups,
        awaiting_deposit: awaitingDeposit,
        locked_orders: locked,
        ready_for_collection: ready,
        price_tbc_open: unknownPrices,
        abandoned_carts: abandonedCarts,
        deposits_received_cents: depositsReceived,
        deposits_received_label: formatAud(depositsReceived)
      },
      nav_counts: {
        customers: customersCount,
        orders_active: ordersActive,
        orders_new: ordersNew,
        orders_archived: ordersArchived
      },
      recent: recent || [],
      today: todayStr,
      tomorrow: tomorrowStr,
      cutoff: {
        rule_label: storeCutoffRuleLabel(system),
        nearest: nearestCutoff,
        awaiting_deposit_unpaid: awaitingDeposit
      },
      deposit_reminder: reminderSettings
    });
  } catch (e) {
    console.error('order/dashboard', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
