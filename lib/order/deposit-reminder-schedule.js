'use strict';

const MS_DAY = 86400000;
const MS_HOUR = 3600000;

function orderNeedsDeposit(order) {
  if (!order) return false;
  if (order.status !== 'awaiting_deposit') return false;
  var required = Number(order.deposit_required_cents) || 0;
  if (!required) return false;
  var paid = Number(order.deposit_paid_cents) || 0;
  return paid < required;
}

function isBeforeLock(order, now) {
  if (!order || !order.effective_cutoff_at) return true;
  return (now || Date.now()) < new Date(order.effective_cutoff_at).getTime();
}

function firstReminderDueAt(order, settings) {
  var created = new Date(order.created_at).getTime();
  var delayMs = (settings.first_delay_days || 3) * MS_DAY;
  var minWait = created + Math.max(delayMs, 4 * MS_HOUR);
  var cutoff = order.effective_cutoff_at ? new Date(order.effective_cutoff_at).getTime() : null;
  if (!cutoff) return minWait;
  var untilCutoff = cutoff - created;
  if (untilCutoff <= delayMs) {
    var early = created + Math.max(MS_HOUR, Math.floor(untilCutoff * 0.25));
    return Math.min(early, cutoff - MS_HOUR);
  }
  return Math.min(minWait, cutoff - MS_HOUR);
}

function dayBeforeReminderDueAt(order) {
  if (!order.effective_cutoff_at) return null;
  return new Date(order.effective_cutoff_at).getTime() - MS_DAY;
}

function nextReminderStage(order, settings, nowMs) {
  if (!settings.enabled) return null;
  if (!orderNeedsDeposit(order)) return null;
  nowMs = nowMs != null ? nowMs : Date.now();
  if (!isBeforeLock(order, nowMs)) return null;

  var firstDue = firstReminderDueAt(order, settings);
  var dayBeforeDue = settings.day_before_lock ? dayBeforeReminderDueAt(order) : null;

  return {
    stage1_due: nowMs >= firstDue,
    stage2_due: dayBeforeDue != null && nowMs >= dayBeforeDue,
    first_due_at: new Date(firstDue).toISOString(),
    day_before_due_at: dayBeforeDue != null ? new Date(dayBeforeDue).toISOString() : null
  };
}

module.exports = {
  orderNeedsDeposit: orderNeedsDeposit,
  isBeforeLock: isBeforeLock,
  firstReminderDueAt: firstReminderDueAt,
  dayBeforeReminderDueAt: dayBeforeReminderDueAt,
  nextReminderStage: nextReminderStage
};
