'use strict';

/**
 * Abandoned cart recovery settings — columns on order_systems plus settings.abandoned_cart JSON.
 */

function asInt(v, def, min, max) {
  var n = parseInt(String(v == null ? '' : v), 10);
  if (!Number.isFinite(n)) n = def;
  if (min != null) n = Math.max(min, n);
  if (max != null) n = Math.min(max, n);
  return n;
}

function parseAbandonedCartSettings(system) {
  var s = system || {};
  var nested = (s.settings && s.settings.abandoned_cart) || {};
  var messagesPerCart = asInt(nested.messages_per_cart, 1, 1, 2);
  return {
    enabled: s.abandoned_cart_enabled === true,
    delay_minutes: asInt(s.abandoned_cart_delay_minutes, 60, 5, 10080),
    channels: Array.isArray(s.abandoned_cart_channels) ? s.abandoned_cart_channels.slice() : ['email'],
    max_per_customer: asInt(nested.max_per_customer, 1, 0, 20),
    messages_per_cart: messagesPerCart,
    second_delay_value: asInt(nested.second_delay_value, 48, 1, 365),
    second_delay_unit: nested.second_delay_unit === 'days' ? 'days' : 'hours',
    customer_lookback_days: asInt(nested.customer_lookback_days, 90, 1, 365)
  };
}

function secondDelayMs(settings) {
  var v = settings.second_delay_value;
  if (settings.second_delay_unit === 'days') return v * 24 * 60 * 60 * 1000;
  return v * 60 * 60 * 1000;
}

function templateCategoryForStage(stage) {
  if (stage === 2) return 'abandoned_cart_2';
  return 'abandoned_cart';
}

function mergeAbandonedCartSettings(existingSettings, patch) {
  var base = existingSettings && typeof existingSettings === 'object' ? existingSettings : {};
  var prev = base.abandoned_cart && typeof base.abandoned_cart === 'object' ? base.abandoned_cart : {};
  var next = Object.assign({}, prev);
  if (patch.max_per_customer != null) next.max_per_customer = asInt(patch.max_per_customer, 1, 0, 20);
  if (patch.messages_per_cart != null) next.messages_per_cart = asInt(patch.messages_per_cart, 1, 1, 2);
  if (patch.second_delay_value != null) next.second_delay_value = asInt(patch.second_delay_value, 48, 1, 365);
  if (patch.second_delay_unit != null) {
    next.second_delay_unit = patch.second_delay_unit === 'days' ? 'days' : 'hours';
  }
  if (patch.customer_lookback_days != null) {
    next.customer_lookback_days = asInt(patch.customer_lookback_days, 90, 1, 365);
  }
  return Object.assign({}, base, { abandoned_cart: next });
}

module.exports = {
  parseAbandonedCartSettings: parseAbandonedCartSettings,
  secondDelayMs: secondDelayMs,
  templateCategoryForStage: templateCategoryForStage,
  mergeAbandonedCartSettings: mergeAbandonedCartSettings
};
