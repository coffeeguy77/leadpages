'use strict';

/**
 * Fleet availability for hire bookings.
 *
 * - A resource is bookable when active !== false and hire_status === 'active'.
 * - Unavailable periods are booking_schedule_exceptions rows:
 *     scope 'resource' + scope_id → that vehicle (kind 'maintenance' = repairs,
 *     'block' = private / other, title = reason), or scope 'business' kind 'closed'
 *     → the whole fleet (e.g. Christmas).
 * - Day availability = how many bookable vehicles could be picked up that day for a
 *   one-day hire at the given pickup time, capped by the daily jobs limit.
 */

const { computeHireWindow, listOccupiedDays, rangesOverlapHalfOpen } = require('./duration');
const { countsTowardCapacity, maxDailyJobs } = require('./capacity');
const { ymdInZone, hmInZone, pad } = require('../time');

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const BLOCK_KINDS = ['maintenance', 'block', 'closed', 'leave'];

function hireSettings(system) {
  return (system && system.settings && system.settings.hire) || {};
}

function isBookable(resource) {
  if (!resource) return false;
  if (resource.active === false) return false;
  return (resource.hire_status || 'active') === 'active';
}

/** Rows of booking_schedule_exceptions that block hire in [fromIso, toIso). */
async function loadBlocks(admin, systemId, fromIso, toIso) {
  const { data } = await admin
    .from('booking_schedule_exceptions')
    .select('id,scope,scope_id,starts_at,ends_at,kind,title')
    .eq('booking_system_id', systemId)
    .in('kind', BLOCK_KINDS)
    .lt('starts_at', toIso)
    .gt('ends_at', fromIso);
  return (data || []).filter(function (b) {
    return b.scope === 'resource' || (b.scope === 'business' && b.kind === 'closed');
  });
}

/** All hire reservations (any vehicle) overlapping the range, with booking status. */
async function loadAllReservations(admin, systemId, fromIso, toIso) {
  const { data } = await admin
    .from('booking_hire_details')
    .select('booking_id,resource_id,pickup_at,return_at,bookings!inner(id,reference,status,customer_name,customer_phone,customer_email,total_cents,payment_status,source)')
    .eq('booking_system_id', systemId)
    .lt('pickup_at', toIso)
    .gt('return_at', fromIso);
  return (data || []).map(function (d) {
    const b = d.bookings || {};
    return {
      booking_id: d.booking_id,
      resource_id: d.resource_id,
      reference: b.reference,
      status: b.status,
      customer_name: b.customer_name,
      customer_phone: b.customer_phone,
      customer_email: b.customer_email,
      total_cents: b.total_cents,
      payment_status: b.payment_status,
      source: b.source,
      starts_at: d.pickup_at,
      ends_at: d.return_at
    };
  });
}

/** Blocks that stop this resource being hired for [startIso, endIso). */
function blocksFor(resourceId, blocks, startIso, endIso) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  return (blocks || []).filter(function (b) {
    if (b.scope === 'resource' && String(b.scope_id) !== String(resourceId)) return false;
    return rangesOverlapHalfOpen(s, e, new Date(b.starts_at), new Date(b.ends_at));
  });
}

/** Active reservations on this resource overlapping [startIso, endIso). */
function reservationsFor(resourceId, reservations, startIso, endIso, system, excludeBookingId) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  return (reservations || []).filter(function (r) {
    if (excludeBookingId && r.booking_id === excludeBookingId) return false;
    if (String(r.resource_id) !== String(resourceId)) return false;
    if (!countsTowardCapacity({ status: r.status }, system)) return false;
    return rangesOverlapHalfOpen(s, e, new Date(r.starts_at), new Date(r.ends_at));
  });
}

/** Jobs per day (any vehicle) for the daily cap. */
function jobsByDay(reservations, system) {
  const tz = system.timezone || 'Australia/Sydney';
  const counts = {};
  (reservations || []).forEach(function (r) {
    if (!countsTowardCapacity({ status: r.status }, system)) return;
    listOccupiedDays(new Date(r.starts_at), new Date(r.ends_at), tz).forEach(function (d) {
      counts[d] = (counts[d] || 0) + 1;
    });
  });
  return counts;
}

function addDaysYmd(ymd, n) {
  const p = String(ymd).split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n, 12));
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}

/** 'Mon'..'Sun' trading days the business hires out (settings.hire.closed_weekdays = [0..6]). */
function closedWeekday(system, ymd) {
  const closed = hireSettings(system).closed_weekdays;
  if (!Array.isArray(closed) || !closed.length) return false;
  const p = String(ymd).split('-').map(Number);
  const wd = new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)).getUTCDay();
  return closed.map(Number).indexOf(wd) >= 0;
}

/**
 * Per-day availability for the public calendar.
 * @returns {{ total:number, days: Record<string,{free:number,total:number,closed:boolean,past:boolean}> }}
 */
function fleetDays(input) {
  const system = input.system || {};
  const tz = system.timezone || 'Australia/Sydney';
  const resources = (input.resources || []).filter(isBookable);
  const total = resources.length;
  const max = maxDailyJobs(system);
  const jobs = jobsByDay(input.reservations, system);
  const today = ymdInZone(input.now || new Date(), tz);
  const pickupHm = input.pickupHm || hireSettings(system).open_time || '08:00';
  const minNoticeDays = Math.max(0, Number(hireSettings(system).min_notice_days) || 0);
  const firstBookable = addDaysYmd(today, minNoticeDays);
  const days = {};
  let ymd = input.fromYmd;
  for (let i = 0; i < 400 && ymd <= input.toYmd; i++) {
    const past = ymd < firstBookable;
    const closed = closedWeekday(system, ymd);
    let free = 0;
    if (!past && !closed && total) {
      resources.forEach(function (r) {
        if (freeSomeTime(r, ymd, input, system, tz, pickupHm)) free += 1;
      });
      {
        const capLeft = Math.max(0, max - (jobs[ymd] || 0));
        free = Math.min(free, capLeft);
      }
    }
    days[ymd] = { free: free, total: total, closed: closed, past: past };
    ymd = addDaysYmd(ymd, 1);
  }
  return { total: total, days: days };
}

function hmAdd(hm, mins) {
  const p = String(hm).split(':').map(Number);
  const t = p[0] * 60 + p[1] + mins;
  return pad(Math.floor(t / 60)) + ':' + pad(t % 60);
}
function hmToMin(hm) { const p = String(hm || '').split(':').map(Number); return p[0] * 60 + (p[1] || 0); }

/**
 * Could this vehicle be picked up at some time on `ymd` for a one-day hire?
 * Tries the opening time, then the moment each earlier hire comes back that day
 * (rounded up to the booking time step), up to closing time.
 */
function freeSomeTime(r, ymd, input, system, tz, openHm) {
  const h = hireSettings(system);
  const step = Math.max(15, Number(h.time_step) || 30);
  const closeHm = /^\d{2}:\d{2}$/.test(String(h.close_time || '')) ? h.close_time : '17:00';
  const candidates = [openHm];
  (input.reservations || []).forEach(function (x) {
    if (String(x.resource_id) !== String(r.id)) return;
    if (!countsTowardCapacity({ status: x.status }, system)) return;
    const end = new Date(x.ends_at);
    if (ymdInZone(end, tz) !== ymd) return;
    let m = hmToMin(hmInZone(end, tz));
    m = Math.ceil(m / step) * step;
    const hm = pad(Math.floor(m / 60)) + ':' + pad(m % 60);
    if (m > hmToMin(openHm) && m <= hmToMin(closeHm)) candidates.push(hm);
  });
  for (const hm of candidates) {
    const win = computeHireWindow({ pickupYmd: ymd, pickupHm: hm, timezone: tz, durationMode: 'single_block', system: system });
    if (!win.ok) continue;
    if (blocksFor(r.id, input.blocks, win.pickup_at, win.return_at).length) continue;
    if (reservationsFor(r.id, input.reservations, win.pickup_at, win.return_at, system).length) continue;
    return hm;
  }
  return '';
}

/** Daily rate for a day, honouring per-weekday rates in resource.hire_meta.day_rates (cents). */
function weekdayRate(resource, ymd) {
  const rates = ((resource && resource.hire_meta) || {}).day_rates || {};
  const p = String(ymd).split('-').map(Number);
  if (p.length !== 3 || p.some(function (n) { return !Number.isFinite(n); })) return null;
  const wd = new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)).getUTCDay();
  const v = rates[DAY_KEYS[wd]];
  return v == null || v === '' ? null : Math.max(0, Math.round(Number(v) || 0));
}

module.exports = {
  DAY_KEYS,
  BLOCK_KINDS,
  isBookable,
  loadBlocks,
  loadAllReservations,
  blocksFor,
  reservationsFor,
  jobsByDay,
  fleetDays,
  addDaysYmd,
  closedWeekday,
  freeSomeTime,
  hmAdd,
  weekdayRate
};
