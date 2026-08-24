'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isMasterLockActive, msUntilMasterLock } = require('../lib/order/master-lock');

test('master lock activates after end of lock date', function () {
  var schedule = { master_lock_date: '2026-12-15' };
  var before = new Date('2026-12-15T12:00:00');
  var after = new Date('2026-12-16T00:00:01');
  assert.equal(isMasterLockActive(schedule, before), false);
  assert.equal(isMasterLockActive(schedule, after), true);
  assert.ok(msUntilMasterLock(schedule, before) > 0);
  assert.equal(msUntilMasterLock(schedule, after), 0);
});
