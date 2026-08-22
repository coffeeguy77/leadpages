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
        closed_dates: ['2025-12-25']
      }
    }
  });
  assert.equal(s.range_start, '2025-12-01');
  assert.equal(s.closed_weekdays[0], 0);
  assert.equal(s.closed_dates[0], '2025-12-25');
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

test('specific date overrides weekday hours for early close', function () {
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
    closed_dates: []
  };
  var slots = buildPickupSlots([satWindow, eve], '2025-12-01', 60, schedule);
  var eveSlots = slots.filter(function (s) { return s.date === '2025-12-24'; });
  assert.equal(eveSlots.length, 1);
  assert.equal(String(eveSlots[0].window_end).slice(0, 5), '12:00');
  assert.equal(eveSlots[0].is_date_override, true);
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
  assert.match(html, /pw-range-start/);
  assert.match(html, /pw-closed-days/);
  assert.match(html, /pw-save-schedule/);
  assert.match(api, /save_schedule/);
});
