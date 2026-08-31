'use strict';

/**
 * Central availability engine — used by public book, staff book, reschedule.
 * Pure evaluation given loaded rules/bookings (no DB I/O here).
 */

const {
  zonedParts,
  ymdInZone,
  wallTimeToUtc,
  addMinutes,
  parseTimeToMinutes,
  minutesToHm,
  rangesOverlap
} = require('./time');
const { isBlockingStatus } = require('./status');

function ruleCovers(rule, weekday) {
  return Number(rule.weekday) === Number(weekday) && rule.active !== false && !rule.is_break;
}

function breakCovers(rule, weekday) {
  return Number(rule.weekday) === Number(weekday) && rule.active !== false && !!rule.is_break;
}

/**
 * Open intervals (minutes from midnight) for a weekday from rules.
 */
function openIntervalsForDay(rules, weekday) {
  const opens = (rules || []).filter(function (r) { return ruleCovers(r, weekday); });
  const breaks = (rules || []).filter(function (r) { return breakCovers(r, weekday); });
  const intervals = opens.map(function (r) {
    return { start: parseTimeToMinutes(r.start_time), end: parseTimeToMinutes(r.end_time) };
  }).filter(function (i) { return i.end > i.start; });

  // Subtract breaks
  const out = [];
  intervals.forEach(function (iv) {
    let pieces = [iv];
    breaks.forEach(function (br) {
      const bs = parseTimeToMinutes(br.start_time);
      const be = parseTimeToMinutes(br.end_time);
      const next = [];
      pieces.forEach(function (p) {
        if (!rangesOverlap(p.start, p.end, bs, be)) {
          next.push(p);
          return;
        }
        if (p.start < bs) next.push({ start: p.start, end: Math.min(p.end, bs) });
        if (p.end > be) next.push({ start: Math.max(p.start, be), end: p.end });
      });
      pieces = next.filter(function (p) { return p.end > p.start; });
    });
    out.push.apply(out, pieces);
  });
  return out;
}

function mergeScopeRules(businessRules, scopedRules) {
  // If scoped has any open rules, use scoped; else business
  const scopedOpens = (scopedRules || []).filter(function (r) { return !r.is_break && r.active !== false; });
  if (scopedOpens.length) return scopedRules;
  return businessRules || [];
}

/**
 * @param {object} input
 * @param {object} input.system — booking_systems row
 * @param {object} input.service — booking_services row
 * @param {string} input.dateYmd — YYYY-MM-DD in business TZ
 * @param {object[]} input.businessRules
 * @param {object[]} [input.serviceRules]
 * @param {object[]} [input.teamRules]
 * @param {object[]} [input.exceptions]
 * @param {object[]} [input.existingBookings] — {starts_at,ends_at,status,team_member_id,service_id,attendee_count}
 * @param {object[]} [input.holds]
 * @param {string} [input.teamMemberId]
 * @param {Date} [input.now]
 */
function getAvailableSlots(input) {
  const system = input.system || {};
  const service = input.service || {};
  const tz = system.timezone || 'Australia/Sydney';
  const now = input.now || new Date();
  const duration = Number(service.duration_minutes) || 60;
  const prep = Number(service.prep_minutes) || 0;
  const cleanup = Number(service.cleanup_minutes) || 0;
  const travel = Number(service.travel_buffer_minutes) || 0;
  const blockMins = duration + prep + cleanup + travel;
  const interval = Number(system.slot_interval_minutes) || 15;
  const minNotice = service.min_notice_minutes != null
    ? Number(service.min_notice_minutes)
    : Number(system.min_notice_minutes) || 60;
  const maxAdvance = service.max_advance_days != null
    ? Number(service.max_advance_days)
    : Number(system.max_advance_days) || 90;
  const capacity = Number(service.capacity) || 1;

  const reasons = [];
  const dayStart = wallTimeToUtc(input.dateYmd, '00:00', tz);
  const dayEnd = addMinutes(dayStart, 24 * 60);
  const horizon = addMinutes(now, maxAdvance * 24 * 60);
  if (dayStart > horizon) {
    return { ok: true, slots: [], reasons: [{ code: 'beyond_horizon', message: 'Date is beyond the maximum booking window.' }] };
  }

  // Exceptions: closed day?
  const exceptions = input.exceptions || [];
  const closed = exceptions.some(function (ex) {
    if (ex.kind !== 'closed' && ex.kind !== 'leave' && ex.kind !== 'maintenance' && ex.kind !== 'block') return false;
    const s = new Date(ex.starts_at);
    const e = new Date(ex.ends_at);
    return rangesOverlap(dayStart, dayEnd, s, e) && (!ex.scope_id || ex.scope === 'business');
  });
  if (closed) {
    return { ok: true, slots: [], reasons: [{ code: 'closed', message: 'Business is closed on this date.' }] };
  }

  const sample = wallTimeToUtc(input.dateYmd, '12:00', tz);
  const weekday = zonedParts(sample, tz).weekday;
  const rules = mergeScopeRules(
    input.businessRules,
    input.teamMemberId ? input.teamRules : input.serviceRules
  );
  const intervals = openIntervalsForDay(rules, weekday);
  if (!intervals.length) {
    return { ok: true, slots: [], reasons: [{ code: 'no_hours', message: 'No opening hours for this day.' }] };
  }

  const bookings = (input.existingBookings || []).filter(function (b) {
    return isBlockingStatus(b.status);
  });
  const holds = (input.holds || []).filter(function (h) {
    return new Date(h.expires_at) > now;
  });

  const slots = [];
  intervals.forEach(function (iv) {
    for (let m = iv.start; m + duration <= iv.end; m += interval) {
      const hm = minutesToHm(m);
      const start = wallTimeToUtc(input.dateYmd, hm, tz);
      const end = addMinutes(start, duration);
      const blockStart = addMinutes(start, -prep - travel);
      const blockEnd = addMinutes(end, cleanup + travel);

      if (start < addMinutes(now, minNotice)) {
        continue;
      }

      const blockers = [];

      // Capacity / team conflict
      let used = 0;
      bookings.forEach(function (b) {
        const bs = new Date(b.starts_at);
        const be = new Date(b.ends_at);
        // Expand booking with buffers if present on service — approximate using same prep/cleanup
        const bStart = addMinutes(bs, -(Number(b.prep_minutes) || prep));
        const bEnd = addMinutes(be, Number(b.cleanup_minutes) || cleanup);
        if (!rangesOverlap(blockStart, blockEnd, bStart, bEnd)) return;
        if (input.teamMemberId && b.team_member_id && String(b.team_member_id) !== String(input.teamMemberId)) {
          return;
        }
        if (input.teamMemberId && b.team_member_id && String(b.team_member_id) === String(input.teamMemberId)) {
          blockers.push({ code: 'team_busy', message: 'Team member already booked.', bookingId: b.id });
        }
        if (String(b.service_id) === String(service.id) || capacity === 1) {
          used += Number(b.attendee_count) || 1;
        }
      });
      if (used >= capacity) {
        blockers.push({ code: 'capacity', message: 'Service is at capacity for this time.' });
      }

      holds.forEach(function (h) {
        const hs = new Date(h.starts_at);
        const he = new Date(h.ends_at);
        if (!rangesOverlap(blockStart, blockEnd, hs, he)) return;
        if (input.teamMemberId && h.team_member_id && String(h.team_member_id) !== String(input.teamMemberId)) return;
        blockers.push({ code: 'hold', message: 'Time is temporarily held for another checkout.' });
      });

      if (!blockers.length) {
        slots.push({
          start: start.toISOString(),
          end: end.toISOString(),
          localDate: input.dateYmd,
          localTime: hm,
          timezone: tz
        });
      }
    }
  });

  if (!slots.length && !reasons.length) {
    reasons.push({ code: 'no_slots', message: 'No available times on this date.' });
  }

  return { ok: true, slots: slots, reasons: reasons, meta: { duration: duration, blockMins: blockMins, weekday: weekday } };
}

/**
 * Explain why a specific time is unavailable (admin tool).
 */
function explainUnavailable(input) {
  const tz = (input.system && input.system.timezone) || 'Australia/Sydney';
  const start = new Date(input.startsAt);
  const dateYmd = ymdInZone(start, tz);
  const probe = getAvailableSlots(Object.assign({}, input, { dateYmd: dateYmd }));
  const match = (probe.slots || []).some(function (s) {
    return Math.abs(new Date(s.start).getTime() - start.getTime()) < 60000;
  });
  if (match) {
    return { ok: true, available: true, checks: [{ code: 'ok', message: 'This time is available.' }] };
  }

  // Re-run with detailed checks for this exact start
  const detail = [];
  const service = input.service || {};
  const duration = Number(service.duration_minutes) || 60;
  const end = addMinutes(start, duration);
  const now = input.now || new Date();
  const minNotice = Number((input.system && input.system.min_notice_minutes) || 60);
  if (start < addMinutes(now, minNotice)) {
    detail.push({ code: 'min_notice', message: 'Starts sooner than minimum notice (' + minNotice + ' minutes).', blocking: true });
  }
  const weekday = zonedParts(start, tz).weekday;
  const rules = mergeScopeRules(input.businessRules, input.teamRules || input.serviceRules);
  const intervals = openIntervalsForDay(rules, weekday);
  const startMins = zonedParts(start, tz).hour * 60 + zonedParts(start, tz).minute;
  const endMins = startMins + duration;
  const inHours = intervals.some(function (iv) { return startMins >= iv.start && endMins <= iv.end; });
  detail.push({
    code: 'hours',
    message: inHours ? 'Within opening hours.' : 'Outside opening hours for this day.',
    blocking: !inHours,
    intervals: intervals
  });

  (input.existingBookings || []).filter(function (b) { return isBlockingStatus(b.status); }).forEach(function (b) {
    if (rangesOverlap(start, end, new Date(b.starts_at), new Date(b.ends_at))) {
      detail.push({
        code: 'conflict',
        message: 'Overlaps existing booking ' + (b.reference || b.id),
        blocking: true,
        bookingId: b.id
      });
    }
  });

  return {
    ok: true,
    available: false,
    checks: detail.length ? detail : probe.reasons.map(function (r) {
      return Object.assign({ blocking: true }, r);
    })
  };
}

module.exports = {
  getAvailableSlots,
  explainUnavailable,
  openIntervalsForDay,
  mergeScopeRules
};
