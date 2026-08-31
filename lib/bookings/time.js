'use strict';

/**
 * Timezone-aware helpers for Bookings (Australia/Sydney default).
 * Uses Intl — no external tz library.
 */

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Parts of instant in a timezone. */
function zonedParts(date, timeZone) {
  const d = date instanceof Date ? date : new Date(date);
  const fmt = new Intl.DateTimeFormat('en-AU', {
    timeZone: timeZone || 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  const parts = {};
  fmt.formatToParts(d).forEach(function (p) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  });
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: weekdayMap[parts.weekday] != null ? weekdayMap[parts.weekday] : d.getUTCDay(),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

function ymdInZone(date, timeZone) {
  const p = zonedParts(date, timeZone);
  return p.year + '-' + pad(p.month) + '-' + pad(p.day);
}

function hmInZone(date, timeZone) {
  const p = zonedParts(date, timeZone);
  return pad(p.hour) + ':' + pad(p.minute);
}

/**
 * Build a UTC Date for local wall time in timezone.
 * Approach: iterate offset guess (handles DST for AU).
 */
function wallTimeToUtc(ymd, hm, timeZone) {
  const tz = timeZone || 'Australia/Sydney';
  const [Y, M, D] = String(ymd).split('-').map(Number);
  const [h, m] = String(hm).split(':').map(Number);
  // Initial guess: treat as UTC then adjust
  let guess = Date.UTC(Y, M - 1, D, h, m, 0);
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(new Date(guess), tz);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const want = Date.UTC(Y, M - 1, D, h, m, 0);
    guess += want - asUtc;
  }
  return new Date(guess);
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + Number(minutes) * 60000);
}

function parseTimeToMinutes(t) {
  const s = String(t || '00:00').slice(0, 5);
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToHm(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return pad(h) + ':' + pad(m);
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

module.exports = {
  zonedParts,
  ymdInZone,
  hmInZone,
  wallTimeToUtc,
  addMinutes,
  parseTimeToMinutes,
  minutesToHm,
  rangesOverlap,
  pad
};
