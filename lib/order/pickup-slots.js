'use strict';

const {
  toDateStr,
  parseIsoDate,
  isDateClosed,
  isPickupPatternDay,
  hoursForWeekday,
  bookingDateBounds,
  hasDefaultHours,
  normaliseScheduleTime
} = require('./pickup-schedule');

function pad2(n) {
  return String(n).padStart(2, '0');
}

function parseTime(t) {
  if (!t) return null;
  const s = String(t).slice(0, 8);
  const parts = s.split(':');
  if (parts.length < 2) return null;
  return { h: Number(parts[0]), m: Number(parts[1]) || 0, s: Number(parts[2]) || 0 };
}

function formatTimeLabel(t) {
  const p = parseTime(t);
  if (!p) return String(t || '');
  var h = p.h;
  var suffix = h >= 12 ? 'pm' : 'am';
  var h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return p.m ? h12 + ':' + pad2(p.m) + suffix : h12 + suffix;
}

function formatWindowLabel(start, end) {
  return formatTimeLabel(start) + '–' + formatTimeLabel(end);
}

var WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];
var MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

function ordinalDaySuffix(day) {
  var n = Number(day);
  if (!isFinite(n)) return '';
  var mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  var mod10 = n % 10;
  if (mod10 === 1) return 'st';
  if (mod10 === 2) return 'nd';
  if (mod10 === 3) return 'rd';
  return 'th';
}

/**
 * Customer-facing long date: "Tuesday, 15th December 2026"
 * Uses local calendar parts from ISO date (business timezone handled by caller storing dates).
 */
function formatPickupDateLong(iso) {
  var d = parseIsoDate(iso);
  if (!d) return String(iso || '');
  var day = d.getDate();
  return (
    WEEKDAYS_LONG[d.getDay()] +
    ', ' +
    day +
    ordinalDaySuffix(day) +
    ' ' +
    MONTHS_LONG[d.getMonth()] +
    ' ' +
    d.getFullYear()
  );
}

/**
 * Full slot label: "Tuesday, 15th December 2026 — 7:30am–6:00pm"
 */
function formatSlotLabel(dateStr, windowStart, windowEnd) {
  var datePart = formatPickupDateLong(dateStr);
  if (!windowStart || !windowEnd) return datePart;
  return datePart + ' — ' + formatWindowLabel(windowStart, windowEnd);
}

function defaultHoursWindow(schedule) {
  var start = normaliseScheduleTime(schedule.default_window_start);
  var end = normaliseScheduleTime(schedule.default_window_end);
  if (!start || !end) return null;
  return {
    id: 'default',
    window_start: start,
    window_end: end
  };
}

function pushSlot(out, w, dateStr, isOverride) {
  const startT = String(w.window_start).slice(0, 8);
  const endT = String(w.window_end).slice(0, 8);
  out.push({
    id: (w.id || 'default') + ':' + dateStr,
    window_id: w.id && w.id !== 'default' && w.id !== 'rule' ? w.id : null,
    date: dateStr,
    window_start: startT,
    window_end: endT,
    label: formatSlotLabel(dateStr, startT, endT),
    date_label: formatPickupDateLong(dateStr),
    window_label: formatWindowLabel(startT, endT),
    capacity: w.capacity != null ? Number(w.capacity) : null,
    is_date_override: !!isOverride,
    is_default_hours: !isOverride && (!w.id || w.id === 'default' || w.id === 'rule')
  });
}

/**
 * Build bookable pickup slots for the booking range.
 * Priority per day: date override → weekly hours rule → weekday window row → schedule default hours.
 *
 * @param {object[]} windows
 * @param {string} earliestDate
 * @param {number} days horizon days
 * @param {object} schedule
 * @param {object} [opts]
 * @param {number} [opts.maxEligibleDates] — cap unique pickup dates (e.g. next 4 Fridays)
 */
function buildPickupSlots(windows, earliestDate, days, schedule, opts) {
  schedule = schedule || {};
  opts = opts || {};
  const wins = (windows || []).filter(function (w) {
    return w && w.active !== false;
  });
  const pattern = schedule.pickup_pattern || 'weekly';
  const specificOnly = pattern === 'specific_dates';
  const useDefault = !specificOnly && hasDefaultHours(schedule);
  if (!earliestDate) return [];
  if (!wins.length && !useDefault) return [];

  const bounds = bookingDateBounds(earliestDate, days, schedule);
  if (!bounds.start || !bounds.end) return [];

  const out = [];
  const specificByDate = Object.create(null);
  wins.forEach(function (w) {
    if (!w.specific_date) return;
    var d = String(w.specific_date).slice(0, 10);
    if (!specificByDate[d]) specificByDate[d] = [];
    specificByDate[d].push(w);
  });

  const defaultWin = useDefault ? defaultHoursWindow(schedule) : null;
  var eligibleDatesSeen = 0;
  var maxDates =
    opts.maxEligibleDates != null && isFinite(Number(opts.maxEligibleDates))
      ? Math.max(1, Number(opts.maxEligibleDates))
      : null;
  var lastDatePushed = null;

  for (var d = new Date(bounds.start.getTime()); d <= bounds.end; d.setDate(d.getDate() + 1)) {
    const dateStr = toDateStr(d);
    const weekday = d.getDay();
    const dateOverrides = specificByDate[dateStr] || [];

    if (specificOnly) {
      if (!dateOverrides.length) continue;
    } else {
      if (!dateOverrides.length && isDateClosed(dateStr, weekday, schedule)) continue;
      if (!dateOverrides.length && !isPickupPatternDay(dateStr, schedule)) continue;
    }

    var dayWins;
    if (dateOverrides.length) {
      dayWins = dateOverrides;
    } else {
      dayWins = hoursForWeekday(schedule, weekday);
      if (!dayWins.length) {
        dayWins = wins.filter(function (w) {
          return !w.specific_date && w.weekday != null && w.weekday !== '' && Number(w.weekday) === weekday;
        });
      }
      if (!dayWins.length && defaultWin) dayWins = [defaultWin];
    }
    if (!dayWins.length) continue;

    if (maxDates != null && dateStr !== lastDatePushed) {
      if (eligibleDatesSeen >= maxDates) break;
      eligibleDatesSeen += 1;
      lastDatePushed = dateStr;
    }

    dayWins.forEach(function (w) {
      pushSlot(out, w, dateStr, dateOverrides.length > 0);
    });
  }
  return out;
}

function findMatchingSlot(slots, pickupDate, windowStart, windowEnd) {
  return (slots || []).find(function (s) {
    return (
      s.date === pickupDate &&
      String(s.window_start).slice(0, 5) === String(windowStart || '').slice(0, 5) &&
      String(s.window_end).slice(0, 5) === String(windowEnd || '').slice(0, 5)
    );
  });
}

/** Group slots by date for date-then-window selectors. */
function groupSlotsByDate(slots) {
  var map = Object.create(null);
  var order = [];
  (slots || []).forEach(function (s) {
    if (!s || !s.date) return;
    if (!map[s.date]) {
      map[s.date] = {
        date: s.date,
        date_label: s.date_label || formatPickupDateLong(s.date),
        windows: []
      };
      order.push(s.date);
    }
    map[s.date].windows.push(s);
  });
  return order.map(function (d) {
    return map[d];
  });
}

module.exports = {
  buildPickupSlots,
  findMatchingSlot,
  formatWindowLabel,
  formatTimeLabel,
  formatPickupDateLong,
  formatSlotLabel,
  ordinalDaySuffix,
  groupSlotsByDate
};
