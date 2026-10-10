'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fleet = require('../lib/bookings/hire/fleet');
const presets = require('../lib/bookings/presets');
const { getAvailableSlots } = require('../lib/bookings/availability');

const SYSTEM = { timezone: 'Australia/Sydney', settings: { hire: { open_time: '07:30', close_time: '17:00', time_step: 30 } }, max_daily_jobs: 10 };
const TRUCKS = [
  { id: 't1', active: true, hire_status: 'active' },
  { id: 't2', active: true, hire_status: 'active' },
  { id: 't3', active: true, hire_status: 'maintenance' }
];
const NOW = new Date('2026-10-12T00:00:00Z'); // Mon 12 Oct, 11am Sydney

test('only active vehicles count towards the fleet', () => {
  const r = fleet.fleetDays({ system: SYSTEM, resources: TRUCKS, reservations: [], blocks: [], fromYmd: '2026-10-14', toYmd: '2026-10-14', now: NOW });
  assert.equal(r.total, 2);
  assert.equal(r.days['2026-10-14'].free, 2);
});

test('a booking and a repairs block each take a truck off that day', () => {
  const reservations = [{ resource_id: 't1', status: 'pending', starts_at: '2026-10-13T20:30:00Z', ends_at: '2026-10-14T20:25:00Z' }];
  const blocks = [{ scope: 'resource', scope_id: 't2', starts_at: '2026-10-13T13:00:00Z', ends_at: '2026-10-14T13:00:00Z' }];
  const r = fleet.fleetDays({ system: SYSTEM, resources: TRUCKS, reservations: reservations, blocks: blocks, fromYmd: '2026-10-14', toYmd: '2026-10-15', now: NOW });
  assert.equal(r.days['2026-10-14'].free, 0);
  // t1 comes back 7:25am on the 15th, so it can go out again at 7:30am.
  assert.equal(r.days['2026-10-15'].free, 2);
});

test('cancelled bookings do not hold a truck; past days and closed weekdays are not bookable', () => {
  const reservations = [{ resource_id: 't1', status: 'cancelled', starts_at: '2026-10-13T20:30:00Z', ends_at: '2026-10-14T20:25:00Z' }];
  const sys = Object.assign({}, SYSTEM, { settings: { hire: Object.assign({}, SYSTEM.settings.hire, { closed_weekdays: [0] }) } });
  const r = fleet.fleetDays({ system: sys, resources: TRUCKS, reservations: reservations, blocks: [], fromYmd: '2026-10-10', toYmd: '2026-10-18', now: NOW });
  assert.equal(r.days['2026-10-14'].free, 2);
  assert.equal(r.days['2026-10-10'].past, true);
  assert.equal(r.days['2026-10-18'].closed, true);
  assert.equal(r.days['2026-10-18'].free, 0);
});

test('per-weekday rates are read from hire_meta.day_rates', () => {
  const truck = { hire_meta: { day_rates: { fri: 22000, sat: '' } } };
  assert.equal(fleet.weekdayRate(truck, '2026-10-16'), 22000); // Friday
  assert.equal(fleet.weekdayRate(truck, '2026-10-17'), null); // blank = use the normal rate
  assert.equal(fleet.weekdayRate({}, '2026-10-16'), null);
});

test('presets cover the main kinds of business and never invent prices', () => {
  const keys = presets.PRESETS.map(function (p) { return p.key; });
  ['truck_hire', 'car_hire', 'barber', 'beauty', 'trades', 'classes'].forEach(function (k) { assert.ok(keys.indexOf(k) >= 0, k); });
  presets.PRESETS.forEach(function (p) {
    p.services.forEach(function (s) { assert.equal(s.price_cents, 0, p.key + ' ' + s.name); });
  });
});

test('class slots report seats left', () => {
  const service = { id: 's1', duration_minutes: 60, capacity: 6 };
  const rules = [{ weekday: 6, start_time: '09:00', end_time: '11:00', active: true }];
  const booked = [{ service_id: 's1', status: 'confirmed', starts_at: '2026-10-16T22:00:00Z', ends_at: '2026-10-16T23:00:00Z', attendee_count: 4 }];
  const r = getAvailableSlots({ system: { timezone: 'Australia/Sydney', slot_interval_minutes: 60, min_notice_minutes: 0 }, service: service, dateYmd: '2026-10-17', businessRules: rules, existingBookings: booked, now: NOW });
  const nine = r.slots.find(function (s) { return s.localTime === '09:00'; });
  assert.equal(nine.capacity, 6);
  assert.equal(nine.remaining, 2);
});
