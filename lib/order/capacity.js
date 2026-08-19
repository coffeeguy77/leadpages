'use strict';

const { getAdmin } = require('./supabase');

async function countOrdersForDate(systemId, pickupDate) {
  const admin = getAdmin();
  const { count, error } = await admin
    .from('order_orders')
    .select('id', { count: 'exact', head: true })
    .eq('order_system_id', systemId)
    .eq('pickup_date', pickupDate)
    .not('status', 'in', '("cancelled","draft","refunded")');
  if (error) throw error;
  return count || 0;
}

async function isDateAvailable(system, pickupDate) {
  if (!system.capacity_enabled || !system.capacity_per_day) {
    return { ok: true, used: null, max: null };
  }
  const used = await countOrdersForDate(system.id, pickupDate);
  const max = system.capacity_per_day;
  return { ok: used < max, used: used, max: max, remaining: Math.max(0, max - used) };
}

async function calendarDayStats(systemId, fromDate, toDate) {
  const admin = getAdmin();
  let q = admin
    .from('order_orders')
    .select(
      'id,pickup_date,status,known_subtotal_cents,final_subtotal_cents,deposit_paid_cents,editing_state,has_unknown_prices'
    )
    .eq('order_system_id', systemId)
    .not('status', 'in', '("cancelled","draft")')
    .not('pickup_date', 'is', null);
  if (fromDate) q = q.gte('pickup_date', fromDate);
  if (toDate) q = q.lte('pickup_date', toDate);
  const { data, error } = await q;
  if (error) throw error;

  const { data: locks } = await admin
    .from('order_date_locks')
    .select('*')
    .eq('order_system_id', systemId);

  const lockMap = {};
  (locks || []).forEach(function (l) {
    lockMap[l.pickup_date] = l;
  });

  const byDate = {};
  (data || []).forEach(function (o) {
    const d = o.pickup_date;
    if (!byDate[d]) {
      byDate[d] = {
        date: d,
        order_count: 0,
        known_value_cents: 0,
        deposits_cents: 0,
        locked: !!(lockMap[d] && lockMap[d].locked),
        awaiting_deposit: 0,
        tbc_orders: 0
      };
    }
    const row = byDate[d];
    row.order_count += 1;
    row.known_value_cents += Number(o.final_subtotal_cents != null ? o.final_subtotal_cents : o.known_subtotal_cents) || 0;
    row.deposits_cents += Number(o.deposit_paid_cents) || 0;
    if (o.status === 'awaiting_deposit') row.awaiting_deposit += 1;
    if (o.has_unknown_prices) row.tbc_orders += 1;
    if (o.editing_state === 'locked') row.locked = true;
  });

  return Object.keys(byDate)
    .sort()
    .map(function (k) {
      return byDate[k];
    });
}

module.exports = {
  countOrdersForDate,
  isDateAvailable,
  calendarDayStats
};
