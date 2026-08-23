'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { firstReminderDueAt, dayBeforeReminderDueAt, nextReminderStage, isBeforeLock } = require('../lib/order/deposit-reminder-schedule');
const { parseDepositReminderSettings } = require('../lib/order/deposit-reminder-settings');
const { cutoffSummary, formatCountdownMs } = require('../lib/order/cutoff-display');

const settings = parseDepositReminderSettings({ settings: { deposit_reminder: { first_delay_days: 3 } } });

test('firstReminderDueAt uses 3 days when cutoff is far', function () {
  var created = new Date('2026-01-01T10:00:00Z');
  var order = {
    created_at: created.toISOString(),
    effective_cutoff_at: new Date('2026-01-20T10:00:00Z').toISOString()
  };
  var due = firstReminderDueAt(order, settings);
  assert.equal(due, created.getTime() + 3 * 86400000);
});

test('firstReminderDueAt is sooner when cutoff is within 3 days', function () {
  var created = new Date('2026-01-01T10:00:00Z');
  var cutoff = new Date('2026-01-03T10:00:00Z');
  var order = {
    created_at: created.toISOString(),
    effective_cutoff_at: cutoff.toISOString()
  };
  var due = firstReminderDueAt(order, settings);
  assert.ok(due < created.getTime() + 3 * 86400000);
  assert.ok(due < cutoff.getTime());
});

test('dayBeforeReminderDueAt is 24h before cutoff', function () {
  var cutoff = new Date('2026-01-10T17:00:00Z');
  var order = { effective_cutoff_at: cutoff.toISOString() };
  assert.equal(dayBeforeReminderDueAt(order), cutoff.getTime() - 86400000);
});

test('nextReminderStage never due after lock', function () {
  var order = {
    status: 'awaiting_deposit',
    deposit_required_cents: 5000,
    deposit_paid_cents: 0,
    created_at: new Date('2020-01-01T10:00:00Z').toISOString(),
    effective_cutoff_at: new Date('2020-01-02T10:00:00Z').toISOString()
  };
  assert.equal(isBeforeLock(order, Date.parse('2020-01-03T10:00:00Z')), false);
  var due = nextReminderStage(order, settings, Date.parse('2020-01-03T10:00:00Z'));
  assert.equal(due, null);
});

test('cutoffSummary locked when past', function () {
  var past = new Date(Date.now() - 60000).toISOString();
  var s = cutoffSummary(past);
  assert.equal(s.state, 'locked');
  assert.equal(s.locked, true);
});

test('formatCountdownMs', function () {
  var f = formatCountdownMs(90061000);
  assert.match(f.label, /1d/);
  assert.equal(f.locked, false);
});
