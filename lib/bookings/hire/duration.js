'use strict';

/**
 * Hire duration engine — pickup/return timestamps for vehicle & equipment hire.
 * Default single-day block: 23h 55m (1435 minutes). Configurable to 23h 59m.
 * Half-open intervals [start, end) for overlap / capacity.
 */

const { wallTimeToUtc, addMinutes, ymdInZone, zonedParts, pad } = require('../time');

const DEFAULT_SINGLE_BLOCK_MINUTES = 1435; // 23:55
const ALLOWED_SINGLE_BLOCKS = [1435, 1439]; // 23:55 or 23:59

function resolveSingleBlockMinutes(system, service) {
  const hire = (system && system.settings && system.settings.hire) || {};
  const svc = (service && service.settings && service.settings.hire) || {};
  const raw = Number(
    svc.default_duration_minutes != null
      ? svc.default_duration_minutes
      : hire.default_duration_minutes != null
        ? hire.default_duration_minutes
        : DEFAULT_SINGLE_BLOCK_MINUTES
  );
  if (ALLOWED_SINGLE_BLOCKS.indexOf(raw) >= 0) return raw;
  if (raw > 0 && raw < 24 * 60) return raw;
  return DEFAULT_SINGLE_BLOCK_MINUTES;
}

/**
 * @param {object} input
 * @param {string} input.pickupYmd
 * @param {string} input.pickupHm
 * @param {string} [input.timezone]
 * @param {'single_block'|'multi_day'|'custom_return'} [input.durationMode]
 * @param {number} [input.hireDays]
 * @param {string} [input.returnYmd]
 * @param {string} [input.returnHm]
 * @param {object} [input.system]
 * @param {object} [input.service]
 * @param {number} [input.singleBlockMinutes]
 */
function computeHireWindow(input) {
  const tz = input.timezone || (input.system && input.system.timezone) || 'Australia/Sydney';
  const mode = input.durationMode || 'single_block';
  const blockMins =
    input.singleBlockMinutes != null
      ? Number(input.singleBlockMinutes)
      : resolveSingleBlockMinutes(input.system, input.service);

  const pickupAt = wallTimeToUtc(input.pickupYmd, input.pickupHm || '09:00', tz);
  if (!(pickupAt instanceof Date) || Number.isNaN(pickupAt.getTime())) {
    return { ok: false, error: 'invalid_pickup' };
  }

  let returnAt;
  let hireDays = 1;
  let chargeableDays = 1;

  if (mode === 'custom_return') {
    if (!input.returnYmd) return { ok: false, error: 'return_required' };
    returnAt = wallTimeToUtc(input.returnYmd, input.returnHm || input.pickupHm || '09:00', tz);
    if (!(returnAt instanceof Date) || Number.isNaN(returnAt.getTime()) || returnAt <= pickupAt) {
      return { ok: false, error: 'invalid_return' };
    }
    hireDays = countOccupiedDays(pickupAt, returnAt, tz);
    chargeableDays = Math.max(1, hireDays);
  } else if (mode === 'multi_day') {
    hireDays = Math.max(1, Math.round(Number(input.hireDays) || 1));
    const totalMinutes = (hireDays - 1) * 24 * 60 + blockMins;
    returnAt = addMinutes(pickupAt, totalMinutes);
    chargeableDays = hireDays;
  } else {
    hireDays = 1;
    chargeableDays = 1;
    returnAt = addMinutes(pickupAt, blockMins);
  }

  const elapsedMinutes = Math.round((returnAt.getTime() - pickupAt.getTime()) / 60000);
  const occupiedDays = listOccupiedDays(pickupAt, returnAt, tz);

  return {
    ok: true,
    duration_mode: mode,
    timezone: tz,
    pickup_at: pickupAt.toISOString(),
    return_at: returnAt.toISOString(),
    hire_days: hireDays,
    chargeable_days: chargeableDays,
    default_duration_minutes: blockMins,
    elapsed_minutes: elapsedMinutes,
    occupied_days: occupiedDays,
    google_event: {
      all_day: false,
      start: { dateTime: pickupAt.toISOString(), timeZone: tz },
      end: { dateTime: returnAt.toISOString(), timeZone: tz }
    }
  };
}

/** Half-open [start, end): day of exact return instant is NOT occupied. */
function listOccupiedDays(start, end, timeZone) {
  const days = [];
  const endMs = end.getTime();
  let cursor = new Date(start.getTime());
  for (let i = 0; i < 400; i++) {
    if (cursor.getTime() >= endMs) break;
    const ymd = ymdInZone(cursor, timeZone);
    if (!days.length || days[days.length - 1] !== ymd) days.push(ymd);
    const p = zonedParts(cursor, timeZone);
    let nextDay = p.day + 1;
    let nextMonth = p.month;
    let nextYear = p.year;
    const dim = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
    if (nextDay > dim) {
      nextDay = 1;
      nextMonth += 1;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }
    }
    cursor = wallTimeToUtc(
      nextYear + '-' + pad(nextMonth) + '-' + pad(nextDay),
      '12:00',
      timeZone
    );
  }
  return days;
}

function countOccupiedDays(start, end, timeZone) {
  return listOccupiedDays(start, end, timeZone).length;
}

function rangesOverlapHalfOpen(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

module.exports = {
  DEFAULT_SINGLE_BLOCK_MINUTES,
  ALLOWED_SINGLE_BLOCKS,
  resolveSingleBlockMinutes,
  computeHireWindow,
  listOccupiedDays,
  countOccupiedDays,
  rangesOverlapHalfOpen
};
