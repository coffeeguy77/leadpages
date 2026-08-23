'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseLockCountdownSettings,
  computeLockCountdownDeadline,
  buildLockCountdownPayload
} = require('../lib/order/lock-countdown-settings');

test('parseLockCountdownSettings defaults', function () {
  var cfg = parseLockCountdownSettings({});
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.mode, 'master_date');
  assert.equal(cfg.master_month, 12);
  assert.equal(cfg.master_day, 15);
});

test('master date rolls to next year after deadline', function () {
  var cfg = parseLockCountdownSettings({
    enabled: true,
    mode: 'master_date',
    master_month: 12,
    master_day: 15,
    lock_time: '17:00'
  });
  var now = new Date('2025-12-16T08:00:00+11:00');
  var at = computeLockCountdownDeadline(cfg, 'Australia/Sydney', now);
  assert.ok(at);
  assert.equal(at.getFullYear(), 2026);
  assert.equal(at.getMonth(), 11);
  assert.equal(at.getDate(), 15);
});

test('weekly recurring finds next weekday', function () {
  var cfg = parseLockCountdownSettings({
    enabled: true,
    mode: 'recurring',
    recurring_interval: 'weekly',
    recurring_weekday: 3,
    lock_time: '17:00'
  });
  // Wed 10 Dec 2025 morning Sydney
  var now = new Date('2025-12-10T02:00:00+11:00');
  var at = computeLockCountdownDeadline(cfg, 'Australia/Sydney', now);
  assert.ok(at);
  var parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    weekday: 'short',
    day: 'numeric',
    month: 'numeric'
  }).format(at);
  assert.match(parts, /Wed/);
});

test('buildLockCountdownPayload includes custom copy', function () {
  var payload = buildLockCountdownPayload(
    {
      enabled: true,
      title: 'Christmas Countdown',
      message: 'Get your order in by',
      master_month: 12,
      master_day: 25,
      lock_time: '17:00'
    },
    { timezone: 'Australia/Sydney' },
    new Date('2025-12-01T00:00:00+11:00')
  );
  assert.equal(payload.enabled, true);
  assert.equal(payload.title, 'Christmas Countdown');
  assert.equal(payload.message, 'Get your order in by');
  assert.ok(payload.deadline_at);
});
