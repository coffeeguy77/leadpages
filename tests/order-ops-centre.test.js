'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { formatPickupDateLong, formatSlotLabel, buildPickupSlots } = require('../lib/order/pickup-slots');
const { parsePickupSchedule, isPickupPatternDay, mergePickupScheduleSettings } = require('../lib/order/pickup-schedule');

test('formatPickupDateLong uses Tuesday 15th December 2026 form', function () {
  assert.equal(formatPickupDateLong('2026-12-15'), 'Tuesday, 15th December 2026');
  assert.equal(
    formatSlotLabel('2026-12-15', '07:30:00', '18:00:00'),
    'Tuesday, 15th December 2026 — 7:30am–6pm'
  );
});

test('specific_dates pattern only emits override rows', function () {
  var schedule = {
    pickup_pattern: 'specific_dates',
    range_start: '2026-12-01',
    range_end: '2026-12-31',
    closed_weekdays: [],
    closed_dates: [],
    default_window_start: '09:00:00',
    default_window_end: '17:00:00'
  };
  var wins = [
    {
      id: 'x',
      specific_date: '2026-12-20',
      window_start: '09:00:00',
      window_end: '12:00:00',
      active: true
    }
  ];
  var slots = buildPickupSlots(wins, '2026-12-01', 90, schedule);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].date, '2026-12-20');
  assert.match(slots[0].label, /Sunday, 20th December 2026/);
});

test('maxEligibleDates caps unique pickup dates', function () {
  var schedule = {
    pickup_pattern: 'weekly',
    pickup_repeat_weekdays: [5],
    range_start: '2026-12-01',
    range_end: '2027-03-01',
    closed_weekdays: [],
    closed_dates: [],
    default_window_start: '09:00:00',
    default_window_end: '17:00:00'
  };
  var slots = buildPickupSlots([], '2026-12-01', 120, schedule, { maxEligibleDates: 4 });
  var dates = [];
  slots.forEach(function (s) {
    if (dates.indexOf(s.date) < 0) dates.push(s.date);
  });
  assert.equal(dates.length, 4);
});

test('mergePickupScheduleSettings accepts specific_dates and fixed_range', function () {
  var s = mergePickupScheduleSettings({}, { pickup_pattern: 'specific_dates' });
  assert.equal(s.pickup_schedule.pickup_pattern, 'specific_dates');
  s = mergePickupScheduleSettings({}, { pickup_pattern: 'fixed_range' });
  assert.equal(s.pickup_schedule.pickup_pattern, 'fixed_range');
});

test('ops nav and pickup day view exist', function () {
  const nav = fs.readFileSync(path.join(__dirname, '..', 'assets/lp-order-admin-nav.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  assert.match(nav, /Order Operations/);
  assert.match(nav, /pickup-day/);
  assert.match(nav, /Production Summary/);
  assert.match(html, /view-pickup-day/);
  assert.match(html, /loadPickupDay/);
  assert.match(html, /toggle-important/);
  assert.match(html, /specific_dates/);
});

test('storefront uses date-then-window selector without free calendar when slots exist', function () {
  const js = fs.readFileSync(path.join(__dirname, '..', 'assets/lp-order-storefront.js'), 'utf8');
  assert.match(js, /oe-pickup-date/);
  assert.match(js, /No pickup times are available/);
  assert.match(js, /date_label \+ ' \(' \+ hours/);
});
