'use strict';

const { parseIsoDate } = require('./pickup-schedule');

function masterLockDate(schedule) {
  schedule = schedule || {};
  var d = schedule.master_lock_date;
  return d ? String(d).slice(0, 10) : null;
}

/** True when customer-facing ordering/editing should be blocked (after end of lock date). */
function isMasterLockActive(schedule, now) {
  var lock = masterLockDate(schedule);
  if (!lock) return false;
  now = now || new Date();
  var end = parseIsoDate(lock);
  if (!end) return false;
  end.setHours(23, 59, 59, 999);
  return now.getTime() > end.getTime();
}

/** Milliseconds until lock activates (end of lock date). Null if no lock or already locked. */
function msUntilMasterLock(schedule, now) {
  var lock = masterLockDate(schedule);
  if (!lock) return null;
  now = now || new Date();
  if (isMasterLockActive(schedule, now)) return 0;
  var end = parseIsoDate(lock);
  if (!end) return null;
  end.setHours(23, 59, 59, 999);
  return end.getTime() - now.getTime();
}

module.exports = {
  masterLockDate: masterLockDate,
  isMasterLockActive: isMasterLockActive,
  msUntilMasterLock: msUntilMasterLock
};
