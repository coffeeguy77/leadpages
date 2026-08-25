'use strict';

const { getAdmin } = require('./supabase');

function normaliseWindowTime(t) {
  if (t == null || t === '') return null;
  var s = String(t);
  if (/^\d{2}:\d{2}$/.test(s)) return s + ':00';
  if (/^\d{2}:\d{2}:\d{2}/.test(s)) return s.slice(0, 8);
  return s;
}

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

async function countOrdersForWindow(systemId, pickupDate, windowStart, windowEnd) {
  const admin = getAdmin();
  const start = normaliseWindowTime(windowStart);
  const end = normaliseWindowTime(windowEnd);
  let q = admin
    .from('order_orders')
    .select('id', { count: 'exact', head: true })
    .eq('order_system_id', systemId)
    .eq('pickup_date', pickupDate)
    .not('status', 'in', '("cancelled","draft","refunded")');
  if (start) q = q.eq('pickup_window_start', start);
  if (end) q = q.eq('pickup_window_end', end);
  const { count, error } = await q;
  if (error) throw error;
  return count || 0;
}

async function isDateAvailable(system, pickupDate) {
  if (!system.capacity_enabled || !system.capacity_per_day) {
    return { ok: true, used: null, max: null, remaining: null, scope: 'day' };
  }
  const used = await countOrdersForDate(system.id, pickupDate);
  const max = Number(system.capacity_per_day) || 0;
  return {
    ok: used < max,
    used: used,
    max: max,
    remaining: Math.max(0, max - used),
    scope: 'day'
  };
}

/**
 * Day capacity plus optional per-window max (whichever is tighter).
 */
async function isSlotAvailable(system, pickupDate, windowStart, windowEnd, windowCapacity) {
  const day = await isDateAvailable(system, pickupDate);
  if (!day.ok) return day;

  const winMax = windowCapacity != null && windowCapacity !== '' ? Number(windowCapacity) : null;
  if (winMax == null || !Number.isFinite(winMax) || winMax <= 0) {
    return day;
  }

  const used = await countOrdersForWindow(system.id, pickupDate, windowStart, windowEnd);
  const win = {
    ok: used < winMax,
    used: used,
    max: winMax,
    remaining: Math.max(0, winMax - used),
    scope: 'window'
  };
  if (!win.ok) return win;
  // Prefer the tighter remaining for display when day cap is also on
  if (day.max != null && day.remaining != null && day.remaining < win.remaining) {
    return Object.assign({}, day, { window: win });
  }
  return Object.assign({}, win, { day: day.max != null ? day : null });
}

/**
 * Batch day-capacity for unique dates. Returns map date -> capacity info.
 */
async function capacityByDates(system, dates) {
  const unique = [];
  const seen = {};
  (dates || []).forEach(function (d) {
    if (!d || seen[d]) return;
    seen[d] = true;
    unique.push(d);
  });
  const map = {};
  for (var i = 0; i < unique.length; i++) {
    map[unique[i]] = await isDateAvailable(system, unique[i]);
  }
  return map;
}

/**
 * Enrich pickup slots with capacity { used, max, remaining, ok, scope }.
 * Marks slots full when day or window capacity is exhausted.
 */
async function enrichSlotsWithCapacity(system, slots) {
  const list = slots || [];
  if (!list.length) return list;

  const dayMap = await capacityByDates(
    system,
    list.map(function (s) {
      return s.date;
    })
  );

  const out = [];
  for (var i = 0; i < list.length; i++) {
    const s = list[i];
    const dayCap = dayMap[s.date] || { ok: true, used: null, max: null, remaining: null, scope: 'day' };
    let cap = dayCap;
    if (s.capacity != null && Number(s.capacity) > 0) {
      const winUsed = await countOrdersForWindow(system.id, s.date, s.window_start, s.window_end);
      const winMax = Number(s.capacity);
      const winCap = {
        ok: winUsed < winMax,
        used: winUsed,
        max: winMax,
        remaining: Math.max(0, winMax - winUsed),
        scope: 'window'
      };
      if (!dayCap.ok) cap = dayCap;
      else if (!winCap.ok) cap = winCap;
      else if (dayCap.max != null && dayCap.remaining != null && dayCap.remaining <= winCap.remaining) {
        cap = dayCap;
      } else {
        cap = winCap;
      }
    }
    out.push(
      Object.assign({}, s, {
        capacity_info: cap,
        available: cap.ok !== false
      })
    );
  }
  return out;
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
        locked: !!lockMap[d],
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

  // Include locked dates with zero orders so calendar shows lock state
  Object.keys(lockMap).forEach(function (d) {
    if (fromDate && d < fromDate) return;
    if (toDate && d > toDate) return;
    if (!byDate[d]) {
      byDate[d] = {
        date: d,
        order_count: 0,
        known_value_cents: 0,
        deposits_cents: 0,
        locked: true,
        awaiting_deposit: 0,
        tbc_orders: 0
      };
    } else {
      byDate[d].locked = true;
    }
  });

  return Object.keys(byDate)
    .sort()
    .map(function (k) {
      return byDate[k];
    });
}

module.exports = {
  countOrdersForDate,
  countOrdersForWindow,
  isDateAvailable,
  isSlotAvailable,
  capacityByDates,
  enrichSlotsWithCapacity,
  calendarDayStats
};
