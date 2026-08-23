'use strict';

const { getAdmin } = require('./supabase');
const { writeAudit } = require('./audit');
const { parseDepositReminderSettings } = require('./deposit-reminder-settings');
const { sendDepositLink } = require('./staff-order-actions');
const {
  orderNeedsDeposit,
  isBeforeLock,
  nextReminderStage
} = require('./deposit-reminder-schedule');

async function reminderStageSent(admin, orderId, stage) {
  var eventType = stage === 2 ? 'deposit_reminder_day_before' : 'deposit_reminder_sent';
  var { count } = await admin
    .from('order_audit_events')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', orderId)
    .eq('event_type', eventType);
  return (count || 0) > 0;
}

async function pickReminderStage(admin, order, settings, nowMs) {
  var due = nextReminderStage(order, settings, nowMs);
  if (!due) return null;
  var stage1Sent = await reminderStageSent(admin, order.id, 1);
  var stage2Sent = await reminderStageSent(admin, order.id, 2);

  if (due.stage1_due && !stage1Sent) return 1;
  if (due.stage2_due && !stage2Sent) return 2;
  return null;
}

async function sendDepositReminder(opts) {
  var order = opts.order;
  var system = opts.system;
  var site = opts.site;
  var actor = opts.actor || { label: 'system' };
  var stage = opts.stage || 1;
  var source = opts.source || 'system';

  var out = await sendDepositLink({
    order_id: order.id,
    site_id: site.id,
    system: system,
    site: site,
    actor: actor,
    phone: opts.phone,
    email: opts.email,
    channel: opts.channel || 'both',
    source: source,
    skip_link_audit: true,
    template_category: stage === 2 ? 'deposit_reminder_day_before' : 'deposit_reminder',
    fallback_body:
      stage === 2
        ? 'Hi {{first_name}}, your order {{order_number}} locks in 24 hours — pay your deposit of {{deposit_amount}} now: {{deposit_link}}'
        : 'Hi {{first_name}}, friendly reminder — your deposit of {{deposit_amount}} for order {{order_number}} is still due: {{deposit_link}}'
  });

  var eventType = stage === 2 ? 'deposit_reminder_day_before' : 'deposit_reminder_sent';
  await writeAudit({
    order_system_id: system.id,
    site_id: site.id,
    order_id: order.id,
    event_type: eventType,
    actor_user_id: actor.user_id || null,
    actor_label: actor.label || null,
    source: source,
    payload: {
      stage: stage,
      phone: out.phone || null,
      url: out.deposit_url,
      manual: !!opts.manual
    }
  });

  return out;
}

async function processOrderDepositReminder(opts) {
  var admin = getAdmin();
  var order = opts.order;
  var system = opts.system;
  var site = opts.site;
  var settings = opts.settings || parseDepositReminderSettings(system);
  var nowMs = opts.now != null ? opts.now : Date.now();

  if (!settings.enabled) return { order_id: order.id, skipped: true, reason: 'disabled' };
  if (!orderNeedsDeposit(order)) return { order_id: order.id, skipped: true, reason: 'deposit_paid' };
  if (!isBeforeLock(order, nowMs)) return { order_id: order.id, skipped: true, reason: 'past_lock' };

  var stage = await pickReminderStage(admin, order, settings, nowMs);
  if (!stage) return { order_id: order.id, skipped: true, reason: 'not_due' };

  var channels = settings.channels.length ? settings.channels : ['email'];
  var channelPref =
    channels.indexOf('sms') >= 0 && channels.indexOf('email') >= 0
      ? 'both'
      : channels.indexOf('sms') >= 0
        ? 'sms'
        : 'email';

  await sendDepositReminder({
    order: order,
    system: system,
    site: site,
    stage: stage,
    channel: channelPref,
    source: 'system',
    actor: { label: 'deposit reminder' }
  });

  return { order_id: order.id, stage: stage, sent: true };
}

async function sendBulkDepositReminders(opts) {
  var admin = getAdmin();
  var system = opts.system;
  var site = opts.site;
  var actor = opts.actor || {};
  var settings = opts.settings || parseDepositReminderSettings(system);
  var nowMs = Date.now();

  var q = admin
    .from('order_orders')
    .select('*')
    .eq('order_system_id', system.id)
    .eq('status', 'awaiting_deposit');
  if (opts.order_ids && opts.order_ids.length) {
    q = q.in('id', opts.order_ids);
  }
  var { data: orders, error } = await q.limit(opts.limit || 80);
  if (error) throw error;

  var sent = [];
  var skipped = [];
  for (var i = 0; i < (orders || []).length; i++) {
    var order = orders[i];
    if (!orderNeedsDeposit(order)) {
      skipped.push({ order_id: order.id, reason: 'deposit_paid' });
      continue;
    }
    if (!isBeforeLock(order, nowMs)) {
      skipped.push({ order_id: order.id, reason: 'past_lock' });
      continue;
    }
    if (opts.manual) {
      await sendDepositReminder({
        order: order,
        system: system,
        site: site,
        stage: 1,
        channel: opts.channel || 'both',
        source: 'admin',
        actor: actor,
        manual: true
      });
      sent.push({ order_id: order.id, stage: 1, manual: true });
      continue;
    }
    var r = await processOrderDepositReminder({
      order: order,
      system: system,
      site: site,
      settings: settings,
      now: nowMs
    });
    if (r.sent) sent.push(r);
    else skipped.push(r);
  }
  return { sent: sent, skipped: skipped };
}

module.exports = {
  sendDepositReminder: sendDepositReminder,
  processOrderDepositReminder: processOrderDepositReminder,
  sendBulkDepositReminders: sendBulkDepositReminders
};
