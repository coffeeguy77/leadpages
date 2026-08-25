'use strict';

/**
 * Pickup schedule — date range, hours, master lock (stored in order_systems.settings.pickup_schedule).
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
    var s = String(arr[i] || '').trim();
    var iso = parseFlexibleDate(s);
    if (!iso || seen[iso]) continue;
    seen[iso] = true;
    out.push(iso);
  }
  return out.sort();
}

/** Accept YYYY-MM-DD or DD/MM/YYYY */
function parseFlexibleDate(s) {
  s = String(s || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) {
    return m[3] + '-' + pad2(Number(m[2])) + '-' + pad2(Number(m[1]));
  }
  return null;
}

function normaliseScheduleTime(t) {
  if (t == null || t === '') return null;
  var s = String(t).trim();
  if (/^\d{2}:\d{2}$/.test(s)) return s + ':00';
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  return null;
}

function normaliseWeeklyHours(raw) {
  if (!Array.isArray(raw)) return [];
  var out = [];
  raw.forEach(function (row) {
    if (!row || typeof row !== 'object') return;
    var weekdays = normaliseClosedWeekdays(row.weekdays);
    var start = normaliseScheduleTime(row.start || row.window_start);
    var end = normaliseScheduleTime(row.end || row.window_end);
    if (!weekdays.length || !start || !end) return;
    out.push({ weekdays: weekdays, start: start, end: end });
  });
  return out;
}

function hasDefaultHours(schedule) {
  schedule = schedule || {};
  if (normaliseWeeklyHours(schedule.weekly_hours).length) return true;
  return !!(
    normaliseScheduleTime(schedule.default_window_start) &&
    normaliseScheduleTime(schedule.default_window_end)
  );
}

function parsePickupSchedule(system) {
  var raw = (system && system.settings && system.settings.pickup_schedule) || {};
  var masterLock = raw.master_lock_date ? String(raw.master_lock_date).slice(0, 10) : null;
  var countdownEnabled = raw.countdown_enabled;
  if (countdownEnabled === undefined || countdownEnabled === null) {
    countdownEnabled = !!masterLock;
  } else {
    countdownEnabled = countdownEnabled !== false && countdownEnabled !== '0' && countdownEnabled !== 0;
  }
  return {
    master_lock_date: masterLock,
    countdown_enabled: countdownEnabled,
    countdown_eyebrow: raw.countdown_eyebrow != null ? String(raw.countdown_eyebrow) : '',
    countdown_title: raw.countdown_title != null ? String(raw.countdown_title) : '',
    countdown_intro: raw.countdown_intro != null ? String(raw.countdown_intro) : '',
    cart_disclaimer: raw.cart_disclaimer != null ? String(raw.cart_disclaimer) : '',
    range_start: raw.range_start ? String(raw.range_start).slice(0, 10) : null,
    range_end: raw.range_end ? String(raw.range_end).slice(0, 10) : null,
    closed_weekdays: normaliseClosedWeekdays(raw.closed_weekdays),
    closed_dates: normaliseDateList(raw.closed_dates),
    default_window_start: normaliseScheduleTime(raw.default_window_start),
    default_window_end: normaliseScheduleTime(raw.default_window_end),
    weekly_hours: normaliseWeeklyHours(raw.weekly_hours),
    pickup_pattern: raw.pickup_pattern || 'weekly',
    pickup_repeat_weekdays: normaliseClosedWeekdays(raw.pickup_repeat_weekdays)
  };
}

function mergePickupScheduleSettings(existingSettings, patch) {
  var base = existingSettings && typeof existingSettings === 'object' ? existingSettings : {};
  var prev =
    base.pickup_schedule && typeof base.pickup_schedule === 'object' ? base.pickup_schedule : {};
  var next = Object.assign({}, prev);
  if (patch.master_lock_date !== undefined) {
    next.master_lock_date = patch.master_lock_date
      ? parseFlexibleDate(patch.master_lock_date) || String(patch.master_lock_date).slice(0, 10)
      : null;
  }
  if (patch.countdown_enabled !== undefined) {
    next.countdown_enabled =
      patch.countdown_enabled !== false &&
      patch.countdown_enabled !== '0' &&
      patch.countdown_enabled !== 0;
  }
  if (patch.countdown_eyebrow !== undefined) {
    next.countdown_eyebrow = String(patch.countdown_eyebrow || '').trim();
  }
  if (patch.countdown_title !== undefined) {
    next.countdown_title = String(patch.countdown_title || '').trim();
  }
  if (patch.countdown_intro !== undefined) {
    next.countdown_intro = String(patch.countdown_intro || '').trim();
  }
  if (patch.cart_disclaimer !== undefined) {
    next.cart_disclaimer = String(patch.cart_disclaimer || '').trim();
  }
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
  if (patch.weekly_hours !== undefined) {
    next.weekly_hours = normaliseWeeklyHours(patch.weekly_hours);
  }
  if (patch.pickup_pattern !== undefined) {
    var p = String(patch.pickup_pattern || 'weekly');
    next.pickup_pattern =
      p === 'fortnightly' ||
      p === 'monthly' ||
      p === 'custom' ||
      p === 'specific_dates' ||
      p === 'fixed_range'
        ? p
        : 'weekly';
  }
  if (patch.pickup_repeat_weekdays !== undefined) {
    next.pickup_repeat_weekdays = normaliseClosedWeekdays(patch.pickup_repeat_weekdays);
  }
  return Object.assign({}, base, { pickup_schedule: next });
}

function isDateClosed(dateStr, weekday, schedule) {
  schedule = schedule || {};
  if (schedule.closed_dates && schedule.closed_dates.indexOf(dateStr) >= 0) return true;
  if (schedule.closed_weekdays && schedule.closed_weekdays.indexOf(weekday) >= 0) return true;
  return false;
}

function weekIndexFromAnchor(dateStr, anchorStr) {
  var d = parseIsoDate(dateStr);
  var a = parseIsoDate(anchorStr);
  if (!d || !a) return 0;
  var diffDays = Math.floor((d.getTime() - a.getTime()) / 86400000);
  return Math.floor(diffDays / 7);
}

function isPickupPatternDay(dateStr, schedule) {
  schedule = schedule || {};
  var pattern = schedule.pickup_pattern || 'weekly';
  var repeat = schedule.pickup_repeat_weekdays || [];
  var d = parseIsoDate(dateStr);
  if (!d) return false;
  var wd = d.getDay();
  /* specific_dates: only override rows (handled in buildPickupSlots) */
  if (pattern === 'specific_dates') return false;
  if (repeat.length && repeat.indexOf(wd) < 0) return false;
  if (pattern === 'weekly' || pattern === 'fixed_range') return true;
  if (pattern === 'custom') return repeat.length > 0;
  var anchor = schedule.range_start;
  if (!anchor) return true;
  if (pattern === 'fortnightly') return weekIndexFromAnchor(dateStr, anchor) % 2 === 0;
  if (pattern === 'monthly') {
    /* Final matching weekday in the month when repeat weekdays set; else same day-of-month as anchor. */
    if (repeat.length) {
      var last = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12, 0, 0, 0);
      while (repeat.indexOf(last.getDay()) < 0) {
        last.setDate(last.getDate() - 1);
      }
      return toDateStr(last) === dateStr;
    }
    var a = parseIsoDate(anchor);
    return a ? d.getDate() === a.getDate() : true;
  }
  return true;
}

/** Hours windows for a weekday from weekly_hours rules. */
function hoursForWeekday(schedule, weekday) {
  schedule = schedule || {};
  var rules = normaliseWeeklyHours(schedule.weekly_hours);
  var out = [];
  rules.forEach(function (r) {
    if (r.weekdays.indexOf(weekday) >= 0) {
      out.push({ window_start: r.start, window_end: r.end, id: 'rule' });
    }
  });
  if (out.length) return out;
  var start = normaliseScheduleTime(schedule.default_window_start);
  var end = normaliseScheduleTime(schedule.default_window_end);
  if (start && end) return [{ window_start: start, window_end: end, id: 'default' }];
  return [];
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
  end.setDate(end.getDate() + horizon - 1);
  if (rangeEnd && rangeEnd < end) end = rangeEnd;

  if (end < start) return { start: null, end: null };
  return { start: start, end: end };
}

module.exports = {
  pad2: pad2,
  toDateStr: toDateStr,
  parseIsoDate: parseIsoDate,
  parseFlexibleDate: parseFlexibleDate,
  normaliseClosedWeekdays: normaliseClosedWeekdays,
  normaliseDateList: normaliseDateList,
  normaliseWeeklyHours: normaliseWeeklyHours,
  parsePickupSchedule: parsePickupSchedule,
  mergePickupScheduleSettings: mergePickupScheduleSettings,
  isDateClosed: isDateClosed,
  isPickupPatternDay: isPickupPatternDay,
  hoursForWeekday: hoursForWeekday,
  bookingDateBounds: bookingDateBounds,
  normaliseScheduleTime: normaliseScheduleTime,
  hasDefaultHours: hasDefaultHours
};
