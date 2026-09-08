'use strict';

/**
 * Calendar lock helpers for hire bookings.
 * Drag/resize is off by default; unlock is temporary + audited.
 */

function hireSettings(system) {
  return (system && system.settings && system.settings.hire) || {};
}

function calendarDragAllowed(system) {
  return hireSettings(system).allow_calendar_drag === true;
}

function isHireBookingLocked(hireDetails, system) {
  if (calendarDragAllowed(system)) return false;
  if (!hireDetails) return true;
  if (hireDetails.locked === false) {
    if (hireDetails.unlocked_until) {
      return new Date(hireDetails.unlocked_until).getTime() <= Date.now();
    }
    return false;
  }
  return hireDetails.locked !== false;
}

function assertMutableSchedule(hireDetails, system, opts) {
  opts = opts || {};
  if (opts.forceUnlock) {
    return { ok: true, unlocked: true, forced: true };
  }
  if (!isHireBookingLocked(hireDetails, system)) {
    return { ok: true, unlocked: true };
  }
  return {
    ok: false,
    error: 'booking_locked',
    message:
      'This hire booking is locked. Use Change dates / Unlock to reschedule. Calendar drag is disabled.'
  };
}

function unlockPayload(actorUserId, reason, minutes) {
  const mins = Math.max(1, Number(minutes) || 15);
  return {
    locked: false,
    unlocked_until: new Date(Date.now() + mins * 60000).toISOString(),
    unlocked_by: actorUserId || null,
    unlock_reason: String(reason || '').trim() || 'temporary_unlock'
  };
}

function relockPayload() {
  return {
    locked: true,
    unlocked_until: null,
    unlocked_by: null,
    unlock_reason: ''
  };
}

function calendarEventFlags(hireDetails, system) {
  const locked = isHireBookingLocked(hireDetails, system);
  return {
    locked: locked,
    editable: !locked,
    startEditable: !locked && calendarDragAllowed(system),
    durationEditable: !locked && calendarDragAllowed(system),
    resourceEditable: !locked && calendarDragAllowed(system),
    lock_indicator: locked
  };
}

module.exports = {
  calendarDragAllowed,
  isHireBookingLocked,
  assertMutableSchedule,
  unlockPayload,
  relockPayload,
  calendarEventFlags
};
