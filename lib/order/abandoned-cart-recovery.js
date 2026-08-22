'use strict';

const { normaliseAuPhone } = require('./phone');

function cartContactPhone(cart) {
  if (!cart) return '';
  return normaliseAuPhone(cart.guest_phone || '');
}

function cartStage(cart) {
  var rs = (cart && cart.recovery_state) || {};
  var stage = Number(rs.stage);
  if (Number.isFinite(stage) && stage > 0) return stage;
  if (rs.reminder_sent) return 1;
  return 0;
}

function lastMessageAt(cart) {
  var rs = (cart && cart.recovery_state) || {};
  return rs.last_message_at || null;
}

/**
 * Count abandoned-cart recovery messages sent to a phone in the lookback window.
 */
async function countCustomerAbandonedMessages(admin, systemId, phone, opts) {
  opts = opts || {};
  if (!phone) return 0;
  var lookbackDays = opts.lookback_days != null ? opts.lookback_days : 90;
  var since = new Date(Date.now() - lookbackDays * 86400000).toISOString();
  var q = admin
    .from('order_messages')
    .select('id', { count: 'exact', head: true })
    .eq('order_system_id', systemId)
    .eq('event_type', 'abandoned_cart')
    .eq('destination', phone)
    .eq('status', 'sent')
    .gte('sent_at', since);
  if (opts.channel) q = q.eq('channel', opts.channel);
  var { count, error } = await q;
  if (error) throw error;
  return count || 0;
}

async function customerUnderMessageCap(admin, systemId, cart, settings) {
  var phone = cartContactPhone(cart);
  if (!phone || settings.max_per_customer <= 0) return { ok: true, phone: phone, used: 0 };
  var used = await countCustomerAbandonedMessages(admin, systemId, phone, {
    lookback_days: settings.customer_lookback_days
  });
  if (used >= settings.max_per_customer) {
    return { ok: false, phone: phone, reason: 'customer_cap', used: used };
  }
  return { ok: true, phone: phone, used: used };
}

module.exports = {
  cartContactPhone: cartContactPhone,
  cartStage: cartStage,
  lastMessageAt: lastMessageAt,
  countCustomerAbandonedMessages: countCustomerAbandonedMessages,
  customerUnderMessageCap: customerUnderMessageCap
};
