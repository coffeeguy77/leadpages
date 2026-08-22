'use strict';

const { toDateStr, isDateClosed, bookingDateBounds } = require('./pickup-schedule');

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

/**
 * Build bookable pickup slots from fulfilment windows for the booking range.
 */
function buildPickupSlots(windows, earliestDate, days, schedule) {
  const wins = (windows || []).filter(function (w) {
    return w && w.active !== false;
  });
  if (!wins.length || !earliestDate) return [];

  schedule = schedule || {};
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

  for (var d = new Date(bounds.start.getTime()); d <= bounds.end; d.setDate(d.getDate() + 1)) {
    const dateStr = toDateStr(d);
    const weekday = d.getDay();
    const dateOverrides = specificByDate[dateStr] || [];

    if (!dateOverrides.length && isDateClosed(dateStr, weekday, schedule)) continue;

    const dayWins = dateOverrides.length
      ? dateOverrides
      : wins.filter(function (w) {
          return !w.specific_date && w.weekday != null && w.weekday !== '' && Number(w.weekday) === weekday;
        });

    dayWins.forEach(function (w) {
      const startT = String(w.window_start).slice(0, 8);
      const endT = String(w.window_end).slice(0, 8);
      out.push({
        id: w.id + ':' + dateStr,
        window_id: w.id,
        date: dateStr,
        window_start: startT,
        window_end: endT,
        label: dateStr + ' · ' + formatWindowLabel(startT, endT),
        capacity: w.capacity != null ? Number(w.capacity) : null,
        is_date_override: dateOverrides.length > 0
      });
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

module.exports = {
  buildPickupSlots,
  findMatchingSlot,
  formatWindowLabel,
  formatTimeLabel
};
