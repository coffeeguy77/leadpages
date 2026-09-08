'use strict';

/**
 * Daily fleet capacity + per-resource conflict checks for hire bookings.
 */

const { isBlockingStatus } = require('../status');
const { listOccupiedDays, rangesOverlapHalfOpen } = require('./duration');

const DEFAULT_CAPACITY_STATUSES = [
  'pending',
  'confirmed',
  'checked_in',
  'in_progress',
  'awaiting_payment'
];

function hireSettings(system) {
  return (system && system.settings && system.settings.hire) || {};
}

function maxDailyJobs(system) {
  const n = Number(hireSettings(system).max_daily_hire_jobs);
  return n > 0 ? n : 4;
}

function capacityStatuses(system) {
  const list = hireSettings(system).capacity_statuses;
  return Array.isArray(list) && list.length ? list : DEFAULT_CAPACITY_STATUSES;
}

function countsTowardCapacity(booking, system) {
  if (!booking) return false;
  if (booking.status === 'cancelled' || booking.status === 'draft' || booking.status === 'no_show') {
    return false;
  }
  const statuses = capacityStatuses(system);
  if (statuses.indexOf(booking.status) >= 0) return true;
  return isBlockingStatus(booking.status);
}

function capacityByDay(bookings, rangeStart, rangeEnd, system, excludeBookingId) {
  const tz = system.timezone || 'Australia/Sydney';
  const start = rangeStart instanceof Date ? rangeStart : new Date(rangeStart);
  const end = rangeEnd instanceof Date ? rangeEnd : new Date(rangeEnd);
  const days = listOccupiedDays(start, end, tz);
  const counts = {};
  days.forEach(function (d) {
    counts[d] = 0;
  });

  (bookings || []).forEach(function (b) {
    if (excludeBookingId && b.id === excludeBookingId) return;
    if (!countsTowardCapacity(b, system)) return;
    const bStart = new Date(b.starts_at || b.pickup_at);
    const bEnd = new Date(b.ends_at || b.return_at);
    listOccupiedDays(bStart, bEnd, tz).forEach(function (d) {
      if (counts[d] != null) counts[d] += 1;
    });
  });

  return { days: days, counts: counts, max: maxDailyJobs(system) };
}

function checkDailyCapacity(input) {
  const system = input.system || {};
  const max = maxDailyJobs(system);
  const result = capacityByDay(
    input.existingBookings || [],
    input.startsAt,
    input.endsAt,
    system,
    input.excludeBookingId
  );
  const overDays = result.days.filter(function (d) {
    return (result.counts[d] || 0) >= max;
  });
  if (overDays.length && !input.override) {
    return {
      ok: false,
      error: 'daily_capacity_reached',
      over_days: overDays,
      counts: result.counts,
      max: max,
      message: 'Maximum of ' + max + ' hire jobs already touch: ' + overDays.join(', ')
    };
  }
  return {
    ok: true,
    counts: result.counts,
    max: max,
    over_days: overDays,
    override: !!input.override
  };
}

function checkResourceConflict(input) {
  const resourceId = input.resourceId;
  if (!resourceId) return { ok: false, error: 'resource_required' };
  const start = input.startsAt instanceof Date ? input.startsAt : new Date(input.startsAt);
  const end = input.endsAt instanceof Date ? input.endsAt : new Date(input.endsAt);
  const prep = Number(input.prepMinutes) || 0;
  const cleanup = Number(input.cleanupMinutes) || 0;
  const windowStart = new Date(start.getTime() - prep * 60000);
  const windowEnd = new Date(end.getTime() + cleanup * 60000);

  const conflicts = (input.reservations || []).filter(function (r) {
    if (input.excludeBookingId && r.booking_id === input.excludeBookingId) return false;
    if (String(r.resource_id) !== String(resourceId)) return false;
    if (r.status && !countsTowardCapacity({ status: r.status }, input.system || {})) return false;
    return rangesOverlapHalfOpen(windowStart, windowEnd, new Date(r.starts_at), new Date(r.ends_at));
  });

  if (conflicts.length && !input.allowResourceOverride) {
    return {
      ok: false,
      error: 'resource_conflict',
      conflicts: conflicts.map(function (c) {
        return {
          booking_id: c.booking_id,
          reference: c.reference || null,
          starts_at: c.starts_at,
          ends_at: c.ends_at
        };
      })
    };
  }
  return { ok: true, conflicts: conflicts };
}

function checkHireAvailability(input) {
  const resource = checkResourceConflict(input);
  if (!resource.ok) return resource;
  const capacity = checkDailyCapacity(input);
  if (!capacity.ok) return capacity;
  return { ok: true, resource: resource, capacity: capacity };
}

module.exports = {
  DEFAULT_CAPACITY_STATUSES,
  maxDailyJobs,
  capacityStatuses,
  countsTowardCapacity,
  capacityByDay,
  checkDailyCapacity,
  checkResourceConflict,
  checkHireAvailability
};
