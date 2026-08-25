'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { isDateAvailable, enrichSlotsWithCapacity } = require('../lib/order/capacity');

test('isDateAvailable is open when capacity disabled', async function () {
  var out = await isDateAvailable({ id: 'sys', capacity_enabled: false, capacity_per_day: 10 }, '2026-12-24');
  assert.equal(out.ok, true);
  assert.equal(out.max, null);
});

test('enrichSlotsWithCapacity marks slots available when capacity off', async function () {
  var system = { id: 'sys', capacity_enabled: false, capacity_per_day: null };
  var slots = [
    { id: 'a', date: '2026-12-24', window_start: '09:00:00', window_end: '11:00:00', capacity: null },
    { id: 'b', date: '2026-12-24', window_start: '14:00:00', window_end: '16:00:00', capacity: null }
  ];
  var out = await enrichSlotsWithCapacity(system, slots);
  assert.equal(out.length, 2);
  assert.equal(out[0].available, true);
  assert.ok(out[0].capacity_info);
  assert.equal(out[0].capacity_info.ok, true);
});

test('settings UI and APIs include timezone capacity and merged cutoff', function () {
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  const storefront = fs.readFileSync(path.join(__dirname, '..', 'assets/lp-order-storefront.js'), 'utf8');
  const cart = fs.readFileSync(path.join(__dirname, '..', 'api/order/cart.js'), 'utf8');
  const sfApi = fs.readFileSync(path.join(__dirname, '..', 'api/order/storefront.js'), 'utf8');
  const capacity = fs.readFileSync(path.join(__dirname, '..', 'lib/order/capacity.js'), 'utf8');
  const cutoff = fs.readFileSync(path.join(__dirname, '..', 'lib/order/cutoff.js'), 'utf8');

  assert.match(html, /set-timezone/);
  assert.match(html, /set-capacity-enabled/);
  assert.match(html, /set-capacity-per-day/);
  assert.match(html, /set-cutoff-time/);
  assert.match(html, /pw-capacity/);
  assert.match(storefront, /window_at_capacity/);
  assert.match(storefront, /left/);
  assert.match(cart, /resolveChangeDeadline/);
  assert.match(cart, /isSlotAvailable/);
  assert.match(sfApi, /enrichSlotsWithCapacity/);
  assert.match(capacity, /locked: !!lockMap\[d\]/);
  assert.match(cutoff, /resolveChangeDeadline/);
});
