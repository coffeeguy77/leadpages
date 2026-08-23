'use strict';

function asInt(v, def, min, max) {
  var n = parseInt(String(v == null ? '' : v), 10);
  if (!Number.isFinite(n)) n = def;
  if (min != null) n = Math.max(min, n);
  if (max != null) n = Math.min(max, n);
  return n;
}

function parseDepositReminderSettings(system) {
  var nested = (system && system.settings && system.settings.deposit_reminder) || {};
  return {
    enabled: nested.enabled !== false,
    first_delay_days: asInt(nested.first_delay_days, 3, 1, 14),
    day_before_lock: nested.day_before_lock !== false,
    channels: Array.isArray(nested.channels) ? nested.channels.slice() : ['sms', 'email']
  };
}

function mergeDepositReminderSettings(existingSettings, patch) {
  var base = existingSettings && typeof existingSettings === 'object' ? existingSettings : {};
  var prev = base.deposit_reminder && typeof base.deposit_reminder === 'object' ? base.deposit_reminder : {};
  var next = Object.assign({}, prev);
  if (patch.enabled != null) next.enabled = !!patch.enabled;
  if (patch.first_delay_days != null) next.first_delay_days = asInt(patch.first_delay_days, 3, 1, 14);
  if (patch.day_before_lock != null) next.day_before_lock = !!patch.day_before_lock;
  if (patch.channels != null) {
    next.channels = Array.isArray(patch.channels) ? patch.channels.slice() : ['sms', 'email'];
  }
  return Object.assign({}, base, { deposit_reminder: next });
}

module.exports = {
  parseDepositReminderSettings: parseDepositReminderSettings,
  mergeDepositReminderSettings: mergeDepositReminderSettings
};
