'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  earlierChangeDeadline,
  masterLockEndAt,
  isMasterLockActive
} = require('../lib/order/master-lock');
const { resolveChangeDeadline, zonedDateTime } = require('../lib/order/cutoff');
const { combinedCutoffRuleLabel } = require('../lib/order/cutoff-display');

test('earlierChangeDeadline prefers season lock when sooner than pickup lock', function () {
  var schedule = { master_lock_date: '2026-12-15' };
  var pickupCutoff = '2026-12-21T06:00:00.000Z';
  var merged = earlierChangeDeadline(
    schedule,
    pickupCutoff,
    new Date('2026-08-25T00:00:00.000Z'),
    'Australia/Sydney'
  );
  assert.equal(merged.source, 'master_lock');
  assert.ok(merged.iso);
  assert.match(merged.iso, /^2026-12-15/);
});

test('earlierChangeDeadline prefers pickup lock when sooner than season lock', function () {
  var schedule = { master_lock_date: '2026-12-24' };
  var pickupCutoff = '2026-12-10T06:00:00.000Z';
  var merged = earlierChangeDeadline(
    schedule,
    pickupCutoff,
    new Date('2026-08-25T00:00:00.000Z'),
    'Australia/Sydney'
  );
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

test('masterLockEndAt uses business timezone end of day', function () {
  var end = masterLockEndAt({ master_lock_date: '2026-12-15' }, 'Australia/Sydney');
  assert.ok(end);
  // 23:59:59 Sydney on 15 Dec 2026 = 12:59:59 UTC (AEDT UTC+11)
  assert.equal(end.toISOString(), '2026-12-15T12:59:59.000Z');
  var expected = zonedDateTime('Australia/Sydney', 2026, 12, 15, 23, 59, 59);
  assert.equal(end.getTime(), expected.getTime());
});

test('isMasterLockActive respects timezone EOD', function () {
  var schedule = { master_lock_date: '2026-12-15' };
  // Before EOD Sydney
  assert.equal(
    isMasterLockActive(schedule, new Date('2026-12-15T12:00:00.000Z'), 'Australia/Sydney'),
    false
  );
  // After EOD Sydney
  assert.equal(
    isMasterLockActive(schedule, new Date('2026-12-15T13:00:00.000Z'), 'Australia/Sydney'),
    true
  );
});

test('resolveChangeDeadline merges season lock onto stored cutoff', function () {
  var system = {
    timezone: 'Australia/Sydney',
    default_cutoff_mode: 'days_before',
    default_cutoff_value: 3,
    default_cutoff_time: '17:00:00'
  };
  // Pickup 24 Dec → pickup lock ~21 Dec 17:00 Sydney; season lock 15 Dec is sooner
  var out = resolveChangeDeadline([], system, '2026-12-24', { master_lock_date: '2026-12-15' });
  assert.equal(out.cutoff_source, 'master_lock');
  assert.match(out.cutoff_reason, /Season cutoff/);
  assert.ok(out.pickup_cutoff_at);
  assert.notEqual(out.effective_cutoff_at, out.pickup_cutoff_at);
});
