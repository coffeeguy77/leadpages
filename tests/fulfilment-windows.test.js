'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePickupSchedule, bookingDateBounds, isDateClosed, toDateStr } = require('../lib/order/pickup-schedule');
const { buildPickupSlots } = require('../lib/order/pickup-slots');

var satWindow = {
  id: 'w-sat',
  weekday: 6,
  window_start: '09:00:00',
  window_end: '16:00:00',
  active: true
};

var sunWindow = {
  id: 'w-sun',
  weekday: 0,
  window_start: '10:00:00',
  window_end: '14:00:00',
  active: true
};

test('parsePickupSchedule reads range and closed Sundays', function () {
  var s = parsePickupSchedule({
    settings: {
      pickup_schedule: {
        range_start: '2025-12-01',
        range_end: '2025-12-24',
        closed_weekdays: [0],
        closed_dates: ['2025-12-25'],
        default_window_start: '09:00',
        default_window_end: '16:00'
      }
    }
  });
  assert.equal(s.range_start, '2025-12-01');
  assert.equal(s.closed_weekdays[0], 0);
  assert.equal(s.closed_dates[0], '2025-12-25');
  assert.equal(s.default_window_start, '09:00:00');
  assert.equal(s.default_window_end, '16:00:00');
});

test('default opening hours apply to all open days without weekday rows', function () {
  var schedule = {
    range_start: '2025-12-01',
    range_end: '2025-12-07',
    closed_weekdays: [0],
    closed_dates: [],
    default_window_start: '09:00:00',
    default_window_end: '16:00:00'
  };
  var slots = buildPickupSlots([], '2025-12-01', 60, schedule);
  var dates = slots.map(function (s) { return s.date; });
  assert.ok(dates.indexOf('2025-12-01') >= 0, 'Monday uses default hours');
  assert.ok(dates.indexOf('2025-12-06') >= 0, 'Saturday uses default hours');
  assert.equal(dates.indexOf('2025-12-07'), -1, 'Sunday closed');
  assert.equal(slots[0].is_default_hours, true);
});

test('buildPickupSlots respects range and closed weekdays', function () {
  var schedule = {
    range_start: '2025-12-01',
    range_end: '2025-12-07',
    closed_weekdays: [0],
    closed_dates: []
  };
  var slots = buildPickupSlots([satWindow, sunWindow], '2025-12-01', 60, schedule);
  var dates = slots.map(function (s) { return s.date; });
  assert.ok(dates.indexOf('2025-12-06') >= 0, 'Saturday in range');
  assert.equal(dates.indexOf('2025-12-07'), -1, 'Sunday closed');
});

test('specific date overrides default hours for early close', function () {
  var eve = {
    id: 'w-eve',
    specific_date: '2025-12-24',
    window_start: '09:00:00',
    window_end: '12:00:00',
    active: true
  };
  var schedule = {
    range_start: '2025-12-01',
    range_end: '2025-12-24',
    closed_weekdays: [],
    closed_dates: [],
    default_window_start: '09:00:00',
    default_window_end: '16:00:00'
  };
  var slots = buildPickupSlots([eve], '2025-12-01', 60, schedule);
  var eveSlots = slots.filter(function (s) { return s.date === '2025-12-24'; });
  assert.equal(eveSlots.length, 1);
  assert.equal(String(eveSlots[0].window_end).slice(0, 5), '12:00');
  assert.equal(eveSlots[0].is_date_override, true);
  var monSlots = slots.filter(function (s) { return s.date === '2025-12-01'; });
  assert.equal(String(monSlots[0].window_end).slice(0, 5), '16:00');
  assert.equal(monSlots[0].is_default_hours, true);
});

test('bookingDateBounds clamps to range end', function () {
  var b = bookingDateBounds('2025-12-01', 60, {
    range_start: '2025-12-01',
    range_end: '2025-12-10',
    closed_weekdays: [],
    closed_dates: []
  });
  assert.equal(toDateStr(b.start), '2025-12-01');
  assert.equal(toDateStr(b.end), '2025-12-10');
});

test('isDateClosed checks weekdays and extra dates', function () {
  var schedule = { closed_weekdays: [0], closed_dates: ['2025-12-25'] };
  assert.equal(isDateClosed('2025-12-07', 0, schedule), true);
  assert.equal(isDateClosed('2025-12-25', 4, schedule), true);
  assert.equal(isDateClosed('2025-12-06', 6, schedule), false);
});

test('orders UI has pickup schedule controls', function () {
  const fs = require('fs');
  const path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  const api = fs.readFileSync(path.join(__dirname, '..', 'api/order/fulfilment-windows.js'), 'utf8');
  assert.match(html, /pw-master-lock/);
  assert.match(html, /pw-hours-tbody/);
  assert.match(html, /pw-pickup-pattern/);
  assert.match(html, /pw-range-start/);
  assert.match(api, /save_schedule/);
  assert.match(api, /weekly_hours/);
});

test('weekly hours apply per weekday in slot builder', function () {
  var schedule = {
    range_start: '2025-12-01',
    range_end: '2025-12-07',
    closed_weekdays: [0],
    weekly_hours: [
      { weekdays: [1, 2, 3, 4], start: '07:30:00', end: '18:00:00' },
      { weekdays: [5], start: '07:30:00', end: '17:00:00' },
      { weekdays: [6], start: '07:30:00', end: '13:30:00' }
    ]
  };
  var slots = buildPickupSlots([], '2025-12-01', 60, schedule);
  var fri = slots.filter(function (s) { return s.date === '2025-12-05'; })[0];
  var sat = slots.filter(function (s) { return s.date === '2025-12-06'; })[0];
  assert.ok(fri);
  assert.ok(sat);
  assert.equal(String(fri.window_end).slice(0, 5), '17:00');
  assert.equal(String(sat.window_end).slice(0, 5), '13:30');
});

test('pickup repeat weekdays filter slots', function () {
  var schedule = {
    range_start: '2025-12-01',
    range_end: '2025-12-14',
    closed_weekdays: [],
    pickup_pattern: 'custom',
    pickup_repeat_weekdays: [5, 6],
    weekly_hours: [{ weekdays: [0, 1, 2, 3, 4, 5, 6], start: '09:00:00', end: '16:00:00' }]
  };
  var slots = buildPickupSlots([], '2025-12-01', 60, schedule);
  var weekdays = {};
  slots.forEach(function (s) { weekdays[s.date] = true; });
  assert.ok(weekdays['2025-12-05'] || weekdays['2025-12-06']);
  assert.equal(weekdays['2025-12-01'], undefined, 'Monday excluded when only Fri/Sat selected');
});
