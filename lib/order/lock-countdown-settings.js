'use strict';

const { zonedDateTime, parseYmd } = require('./cutoff');
const { cutoffSummary, formatCutoffDateTime } = require('./cutoff-display');

function parseTimeHm(t) {
  if (!t) return { h: 17, m: 0 };
  var m = /^(\d{1,2}):(\d{2})/.exec(String(t));
  if (m) return { h: +m[1], m: +m[2] };
  return { h: 17, m: 0 };
}

function localPartsInTz(tz, date) {
  var fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  });
  var map = {};
  fmt.formatToParts(date || new Date()).forEach(function (p) {
    if (p.type !== 'literal') map[p.type] = p.value;
  });
  var dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    y: +map.year,
    mo: +map.month,
    d: +map.day,
    dow: dowMap[map.weekday] != null ? dowMap[map.weekday] : 0
  };
}

function daysInMonth(y, mo) {
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

function clampDay(y, mo, d) {
  return Math.min(Math.max(1, d), daysInMonth(y, mo));
}

function parseLockCountdownSettings(raw) {
  raw = raw && typeof raw === 'object' ? raw : {};
  var mode = raw.mode === 'recurring' ? 'recurring' : 'master_date';
  var interval = raw.recurring_interval || 'weekly';
  if (['weekly', 'fortnightly', 'monthly'].indexOf(interval) < 0) interval = 'weekly';
  return {
    enabled: raw.enabled === true,
    mode: mode,
    master_month: raw.master_month != null ? Number(raw.master_month) : 12,
    master_day: raw.master_day != null ? Number(raw.master_day) : 15,
    lock_time: raw.lock_time || '17:00',
    recurring_interval: interval,
    recurring_weekday: raw.recurring_weekday != null ? Number(raw.recurring_weekday) : 3,
    recurring_day_of_month: raw.recurring_day_of_month != null ? Number(raw.recurring_day_of_month) : 15,
    recurring_anchor: raw.recurring_anchor || null,
    title: String(raw.title || 'Order countdown').trim() || 'Order countdown',
    message: String(raw.message || 'Get your order in by').trim() || 'Get your order in by',
    locked_message:
      String(raw.locked_message || 'Ordering is closed until the next countdown window opens.').trim() ||
      'Ordering is closed until the next countdown window opens.',
    show_on_shop: raw.show_on_shop !== false
  };
}

function nextMasterDateDeadline(cfg, tz, now) {
  var parts = localPartsInTz(tz, now);
  var hm = parseTimeHm(cfg.lock_time);
  var mo = Math.min(12, Math.max(1, cfg.master_month || 12));
  var day = clampDay(parts.y, mo, cfg.master_day || 15);
  var candidate = zonedDateTime(tz, parts.y, mo, day, hm.h, hm.m, 0);
  if (candidate.getTime() <= now.getTime()) {
    var nextY = parts.y + 1;
    day = clampDay(nextY, mo, cfg.master_day || 15);
    candidate = zonedDateTime(tz, nextY, mo, day, hm.h, hm.m, 0);
  }
  return candidate;
}

function nextWeeklyDeadline(cfg, tz, now) {
  var targetDow = cfg.recurring_weekday != null ? Number(cfg.recurring_weekday) : 3;
  var hm = parseTimeHm(cfg.lock_time);
  var cursor = new Date(now.getTime());
  for (var i = 0; i < 14; i++) {
    var parts = localPartsInTz(tz, cursor);
    if (parts.dow === targetDow) {
      var at = zonedDateTime(tz, parts.y, parts.mo, parts.d, hm.h, hm.m, 0);
      if (at.getTime() > now.getTime()) return at;
    }
    cursor = new Date(cursor.getTime() + 86400000);
  }
  return null;
}

function nextFortnightlyDeadline(cfg, tz, now) {
  var anchor = parseYmd(cfg.recurring_anchor);
  if (!anchor) return nextWeeklyDeadline(cfg, tz, now);
  var hm = parseTimeHm(cfg.lock_time);
  var anchorAt = zonedDateTime(tz, anchor.y, anchor.mo, anchor.d, hm.h, hm.m, 0);
  if (anchorAt.getTime() > now.getTime()) return anchorAt;
  var ms = now.getTime() - anchorAt.getTime();
  var periods = Math.floor(ms / (14 * 86400000)) + 1;
  return new Date(anchorAt.getTime() + periods * 14 * 86400000);
}

function nextMonthlyDeadline(cfg, tz, now) {
  var hm = parseTimeHm(cfg.lock_time);
  var dom = Math.min(28, Math.max(1, cfg.recurring_day_of_month || 15));
  var parts = localPartsInTz(tz, now);
  for (var add = 0; add < 14; add++) {
    var y = parts.y;
    var mo = parts.mo + add;
    while (mo > 12) {
      mo -= 12;
      y += 1;
    }
    var day = clampDay(y, mo, dom);
    var at = zonedDateTime(tz, y, mo, day, hm.h, hm.m, 0);
    if (at.getTime() > now.getTime()) return at;
  }
  return null;
}

function computeLockCountdownDeadline(cfg, tz, now) {
  cfg = parseLockCountdownSettings(cfg);
  now = now || new Date();
  if (!cfg.enabled) return null;
  if (cfg.mode === 'master_date') return nextMasterDateDeadline(cfg, tz, now);
  if (cfg.recurring_interval === 'fortnightly') return nextFortnightlyDeadline(cfg, tz, now);
  if (cfg.recurring_interval === 'monthly') return nextMonthlyDeadline(cfg, tz, now);
  return nextWeeklyDeadline(cfg, tz, now);
}

function buildLockCountdownPayload(raw, system, now) {
  var cfg = parseLockCountdownSettings(raw);
  if (!cfg.enabled) {
    return { enabled: false, show_on_shop: cfg.show_on_shop };
  }
  var tz = (system && system.timezone) || 'Australia/Sydney';
  var deadline = computeLockCountdownDeadline(cfg, tz, now);
  if (!deadline) {
    return { enabled: true, show_on_shop: cfg.show_on_shop, title: cfg.title, message: cfg.message, locked_message: cfg.locked_message, locked: true };
  }
  var iso = deadline.toISOString();
  var summary = cutoffSummary(iso, now);
  return {
    enabled: true,
    show_on_shop: cfg.show_on_shop,
    mode: cfg.mode,
    recurring_interval: cfg.recurring_interval,
    title: cfg.title,
    message: cfg.message,
    locked_message: cfg.locked_message,
    deadline_at: iso,
    display_at: formatCutoffDateTime(iso, tz),
    countdown_label: summary.label,
    locked: summary.locked,
    closing_soon: summary.closing_soon,
    ms_remaining: summary.ms
  };
}

module.exports = {
  parseLockCountdownSettings,
  computeLockCountdownDeadline,
  buildLockCountdownPayload
};
