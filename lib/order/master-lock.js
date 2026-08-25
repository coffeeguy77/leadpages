'use strict';

const { parseIsoDate } = require('./pickup-schedule');

function masterLockDate(schedule) {
  schedule = schedule || {};
  var d = schedule.master_lock_date;
  return d ? String(d).slice(0, 10) : null;
}

/** End of master-lock calendar day (business local date treated as local midnight→EOD). */
function masterLockEndAt(schedule) {
  var lock = masterLockDate(schedule);
  if (!lock) return null;
  var end = parseIsoDate(lock);
  if (!end) return null;
  end.setHours(23, 59, 59, 999);
  return end;
}

/** True when customer-facing ordering/editing should be blocked (after end of lock date). */
function isMasterLockActive(schedule, now) {
  var end = masterLockEndAt(schedule);
  if (!end) return false;
  now = now || new Date();
  return now.getTime() > end.getTime();
}

/** Milliseconds until lock activates (end of lock date). Null if no lock or already locked. */
function msUntilMasterLock(schedule, now) {
  var end = masterLockEndAt(schedule);
  if (!end) return null;
  now = now || new Date();
  var ms = end.getTime() - now.getTime();
  return ms <= 0 ? 0 : ms;
}

/**
 * Whichever closes first: season/master lock or pickup-based order cutoff.
 * @returns {{ at: Date|null, iso: string|null, source: 'master_lock'|'pickup_rule'|null }}
 */
function earlierChangeDeadline(schedule, orderCutoffIso, now) {
  now = now || new Date();
  var candidates = [];
  var masterEnd = masterLockEndAt(schedule);
  if (masterEnd) {
    candidates.push({ at: masterEnd, source: 'master_lock' });
  }
  if (orderCutoffIso) {
    var oc = new Date(orderCutoffIso);
    if (!Number.isNaN(oc.getTime())) {
      candidates.push({ at: oc, source: 'pickup_rule' });
    }
  }
  if (!candidates.length) return { at: null, iso: null, source: null };
  candidates.sort(function (a, b) {
    return a.at.getTime() - b.at.getTime();
  });
  var best = candidates[0];
  return { at: best.at, iso: best.at.toISOString(), source: best.source };
}

module.exports = {
  masterLockDate: masterLockDate,
  masterLockEndAt: masterLockEndAt,
  isMasterLockActive: isMasterLockActive,
  msUntilMasterLock: msUntilMasterLock,
  earlierChangeDeadline: earlierChangeDeadline
};
