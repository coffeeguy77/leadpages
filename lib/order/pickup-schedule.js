'use strict';

/**
 * Pickup schedule — date range, closed weekdays/dates (stored in order_systems.settings.pickup_schedule).
 */

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toDateStr(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function parseIsoDate(s) {
  var p = String(s || '').slice(0, 10).split('-');
  if (p.length !== 3) return null;
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normaliseClosedWeekdays(raw) {
  var arr = Array.isArray(raw) ? raw : raw != null && raw !== '' ? [raw] : [];
  var out = [];
  var seen = Object.create(null);
  for (var i = 0; i < arr.length; i++) {
    var n = parseInt(String(arr[i]), 10);
    if (!Number.isFinite(n) || n < 0 || n > 6) continue;
    if (seen[n]) continue;
    seen[n] = true;
    out.push(n);
  }
  return out.sort();
}

function normaliseDateList(raw) {
  var arr = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[\s,;]+/)
      : [];
  var out = [];
  var seen = Object.create(null);
  for (var i = 0; i < arr.length; i++) {
    var s = String(arr[i] || '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || seen[s]) continue;
    seen[s] = true;
    out.push(s);
  }
  return out.sort();
}

function normaliseScheduleTime(t) {
  if (t == null || t === '') return null;
  var s = String(t).trim();
  if (/^\d{2}:\d{2}$/.test(s)) return s + ':00';
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  return null;
}

function hasDefaultHours(schedule) {
  schedule = schedule || {};
  return !!(
    normaliseScheduleTime(schedule.default_window_start) &&
    normaliseScheduleTime(schedule.default_window_end)
  );
}

function parsePickupSchedule(system) {
  var raw = (system && system.settings && system.settings.pickup_schedule) || {};
  return {
    range_start: raw.range_start ? String(raw.range_start).slice(0, 10) : null,
    range_end: raw.range_end ? String(raw.range_end).slice(0, 10) : null,
    closed_weekdays: normaliseClosedWeekdays(raw.closed_weekdays),
    closed_dates: normaliseDateList(raw.closed_dates),
    default_window_start: normaliseScheduleTime(raw.default_window_start),
    default_window_end: normaliseScheduleTime(raw.default_window_end)
  };
}

function mergePickupScheduleSettings(existingSettings, patch) {
  var base = existingSettings && typeof existingSettings === 'object' ? existingSettings : {};
  var prev =
    base.pickup_schedule && typeof base.pickup_schedule === 'object' ? base.pickup_schedule : {};
  var next = Object.assign({}, prev);
  if (patch.range_start !== undefined) {
    next.range_start = patch.range_start ? String(patch.range_start).slice(0, 10) : null;
  }
  if (patch.range_end !== undefined) {
    next.range_end = patch.range_end ? String(patch.range_end).slice(0, 10) : null;
  }
  if (patch.closed_weekdays !== undefined) {
    next.closed_weekdays = normaliseClosedWeekdays(patch.closed_weekdays);
  }
  if (patch.closed_dates !== undefined) {
    next.closed_dates = normaliseDateList(patch.closed_dates);
  }
  if (patch.default_window_start !== undefined) {
    next.default_window_start = normaliseScheduleTime(patch.default_window_start);
  }
  if (patch.default_window_end !== undefined) {
    next.default_window_end = normaliseScheduleTime(patch.default_window_end);
  }
  return Object.assign({}, base, { pickup_schedule: next });
}

function isDateClosed(dateStr, weekday, schedule) {
  schedule = schedule || {};
  if (schedule.closed_dates && schedule.closed_dates.indexOf(dateStr) >= 0) return true;
  if (schedule.closed_weekdays && schedule.closed_weekdays.indexOf(weekday) >= 0) return true;
  return false;
}

/** Inclusive booking range for slot generation. */
function bookingDateBounds(earliestDate, days, schedule) {
  schedule = schedule || {};
  var earliest = parseIsoDate(earliestDate);
  if (!earliest) return { start: null, end: null };

  var start = new Date(earliest.getTime());
  var rangeStart = schedule.range_start ? parseIsoDate(schedule.range_start) : null;
  var rangeEnd = schedule.range_end ? parseIsoDate(schedule.range_end) : null;
  if (rangeStart && rangeStart > start) start = rangeStart;

  var horizon = Math.max(1, Math.min(Number(days) || 28, 90));
  var end = new Date(start.getTime());
  end.setDate(start.getDate() + horizon - 1);
  if (rangeEnd && rangeEnd < end) end = rangeEnd;

  if (end < start) return { start: null, end: null };
  return { start: start, end: end };
}

module.exports = {
  pad2: pad2,
  toDateStr: toDateStr,
  parseIsoDate: parseIsoDate,
  normaliseClosedWeekdays: normaliseClosedWeekdays,
  normaliseDateList: normaliseDateList,
  parsePickupSchedule: parsePickupSchedule,
  mergePickupScheduleSettings: mergePickupScheduleSettings,
  isDateClosed: isDateClosed,
  bookingDateBounds: bookingDateBounds,
  normaliseScheduleTime: normaliseScheduleTime,
  hasDefaultHours: hasDefaultHours
};
