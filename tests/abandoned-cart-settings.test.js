'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseAbandonedCartSettings,
  secondDelayMs,
  templateCategoryForStage
} = require('../lib/order/abandoned-cart-settings');
const { cartStage } = require('../lib/order/abandoned-cart-recovery');

test('parseAbandonedCartSettings reads nested caps and second delay', function () {
  var s = parseAbandonedCartSettings({
    abandoned_cart_enabled: true,
    abandoned_cart_delay_minutes: 120,
    abandoned_cart_channels: ['sms'],
    settings: {
      abandoned_cart: {
        max_per_customer: 2,
        messages_per_cart: 2,
        second_delay_value: 3,
        second_delay_unit: 'days',
        customer_lookback_days: 30
      }
    }
  });
  assert.equal(s.enabled, true);
  assert.equal(s.delay_minutes, 120);
  assert.equal(s.max_per_customer, 2);
  assert.equal(s.messages_per_cart, 2);
  assert.equal(secondDelayMs(s), 3 * 24 * 60 * 60 * 1000);
});

test('templateCategoryForStage maps follow-up template', function () {
  assert.equal(templateCategoryForStage(1), 'abandoned_cart');
  assert.equal(templateCategoryForStage(2), 'abandoned_cart_2');
});

test('cartStage reads recovery_state', function () {
  assert.equal(cartStage({ recovery_state: { stage: 2 } }), 2);
  assert.equal(cartStage({ recovery_state: { reminder_sent: true } }), 1);
  assert.equal(cartStage({}), 0);
});

test('orders UI exposes abandoned cart controls and open-cart SMS', function () {
  const fs = require('fs');
  const path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  const sms = fs.readFileSync(path.join(__dirname, '..', 'api/order/sms.js'), 'utf8');
  const cron = fs.readFileSync(path.join(__dirname, '..', 'api/cron/order-abandoned.js'), 'utf8');
  assert.match(html, /set-abd-max-customer/);
  assert.match(html, /set-abd-stages/);
  assert.match(html, /sms-open-send/);
  assert.match(html, /abandoned_cart_2/);
  assert.match(sms, /broadcast_open_carts/);
  assert.match(cron, /customerUnderMessageCap/);
  assert.match(cron, /messages_per_cart/);
});
