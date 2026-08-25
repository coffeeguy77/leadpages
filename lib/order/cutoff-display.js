'use strict';

const { editingStateFor } = require('./cutoff');

function formatCountdownMs(ms) {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) {
    return { label: 'Locked', locked: true, closing_soon: false };
  }
  var days = Math.floor(ms / 86400000);
  var hours = Math.floor((ms % 86400000) / 3600000);
  var mins = Math.floor((ms % 3600000) / 60000);
  var parts = [];
  if (days) parts.push(days + 'd');
  if (hours || days) parts.push(hours + 'h');
  parts.push(mins + 'm');
  return {
    label: parts.join(' '),
    locked: false,
    closing_soon: ms <= 8 * 3600000
  };
}

function cutoffSummary(cutoffIso, now) {
  if (!cutoffIso) {
    return { state: 'open', label: null, ms: null, at: null, locked: false };
  }
  var at = new Date(cutoffIso).getTime();
  var t = (now || new Date()).getTime();
  var ms = at - t;
  if (ms <= 0) {
    return { state: 'locked', label: 'Locked', ms: 0, at: cutoffIso, locked: true };
  }
  var fmt = formatCountdownMs(ms);
  return {
    state: fmt.closing_soon ? 'closing_soon' : 'open',
    label: fmt.label,
    ms: ms,
    at: cutoffIso,
    locked: false,
    closing_soon: fmt.closing_soon
  };
}

function formatCutoffDateTime(iso, tz) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-AU', {
      timeZone: tz || 'Australia/Sydney',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch (_e) {
    return new Date(iso).toLocaleString();
  }
}

function storeCutoffRuleLabel(system) {
  var s = system || {};
  var mode = s.default_cutoff_mode || 'days_before';
  if (mode === 'none') return 'No pickup lock — changes follow the season cutoff if set';
  var value = s.default_cutoff_value != null ? Number(s.default_cutoff_value) : 3;
  var time = String(s.default_cutoff_time || '17:00').slice(0, 5);
  if (mode === 'hours_before') {
    return 'Orders lock ' + value + ' hour(s) before pickup';
  }
  if (mode === 'weekday_rule') {
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var dow = days[s.default_cutoff_weekday != null ? Number(s.default_cutoff_weekday) : 3] || 'Wed';
    return 'Orders lock on ' + dow + ' at ' + time + ' before pickup week';
  }
  return 'Orders lock ' + value + ' day(s) before pickup at ' + time;
}

/** Explain combined season + pickup lock: whichever is sooner wins. */
function combinedCutoffRuleLabel(system, masterLockDateStr) {
  var pickupRule = storeCutoffRuleLabel(system);
  var lock = masterLockDateStr ? String(masterLockDateStr).slice(0, 10) : '';
  if (!lock) return pickupRule;
  var parts = lock.split('-');
  var au = parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : lock;
  if ((system && system.default_cutoff_mode) === 'none') {
    return 'No changes after the season cutoff (' + au + ') — that is your final chance to change your order.';
  }
  return (
    pickupRule +
    '. No changes after the season cutoff (' +
    au +
    ') either — whichever is sooner is your final chance to change your order.'
  );
}

function nearestFutureCutoff(orders, now) {
  var t = (now || new Date()).getTime();
  var best = null;
  (orders || []).forEach(function (o) {
    if (!o || !o.effective_cutoff_at) return;
    var at = new Date(o.effective_cutoff_at).getTime();
    if (at <= t) return;
    if (!best || at < best.at) {
      best = { at: at, iso: o.effective_cutoff_at, order_id: o.id, order_number: o.order_number };
    }
  });
  if (!best) return null;
  var summary = cutoffSummary(best.iso, now);
  return Object.assign({ order_id: best.order_id, order_number: best.order_number }, summary);
}

module.exports = {
  formatCountdownMs: formatCountdownMs,
  cutoffSummary: cutoffSummary,
  formatCutoffDateTime: formatCutoffDateTime,
  storeCutoffRuleLabel: storeCutoffRuleLabel,
  combinedCutoffRuleLabel: combinedCutoffRuleLabel,
  nearestFutureCutoff: nearestFutureCutoff,
  editingStateFor: editingStateFor
};
