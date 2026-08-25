'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { earlierChangeDeadline, masterLockEndAt } = require('../lib/order/master-lock');
const { combinedCutoffRuleLabel } = require('../lib/order/cutoff-display');

test('earlierChangeDeadline prefers season lock when sooner than pickup lock', function () {
  var schedule = { master_lock_date: '2026-12-15' };
  // Pickup lock would be 21 Dec 17:00 for a 24 Dec pickup — later than season lock
  var pickupCutoff = '2026-12-21T06:00:00.000Z'; // ~17:00 Sydney
  var merged = earlierChangeDeadline(schedule, pickupCutoff, new Date('2026-08-25T00:00:00.000Z'));
  assert.equal(merged.source, 'master_lock');
  assert.equal(merged.at.toISOString().slice(0, 10), '2026-12-15');
});

test('earlierChangeDeadline prefers pickup lock when sooner than season lock', function () {
  var schedule = { master_lock_date: '2026-12-24' };
  var pickupCutoff = '2026-12-10T06:00:00.000Z';
  var merged = earlierChangeDeadline(schedule, pickupCutoff, new Date('2026-08-25T00:00:00.000Z'));
  assert.equal(merged.source, 'pickup_rule');
  assert.equal(merged.iso, pickupCutoff);
});

test('combinedCutoffRuleLabel mentions whichever is sooner', function () {
  var label = combinedCutoffRuleLabel(
    { default_cutoff_mode: 'days_before', default_cutoff_value: 3, default_cutoff_time: '17:00' },
    '2026-12-15'
  );
  assert.match(label, /3 day/);
  assert.match(label, /15\/12\/2026/);
  assert.match(label, /whichever is sooner/i);
});

test('masterLockEndAt is end of lock date', function () {
  var end = masterLockEndAt({ master_lock_date: '2026-12-15' });
  assert.ok(end);
  assert.equal(end.getHours(), 23);
  assert.equal(end.getDate(), 15);
});
