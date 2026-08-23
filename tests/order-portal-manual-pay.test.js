'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('order-portal never auto-opens Stripe checkout', function () {
  const html = fs.readFileSync(path.join(__dirname, '..', 'order-portal.html'), 'utf8');
  assert.doesNotMatch(html, /payBtn\.click\(\)/);
  assert.doesNotMatch(html, /wantPay/);
});

test('deposit SMS links omit pay=1 auto-pay flag', function () {
  const staff = fs.readFileSync(path.join(__dirname, '..', 'lib', 'order', 'staff-order-actions.js'), 'utf8');
  const orders = fs.readFileSync(path.join(__dirname, '..', 'api', 'order', 'orders.js'), 'utf8');
  assert.doesNotMatch(staff, /order-portal\?t=.*&pay=1/);
  assert.doesNotMatch(orders, /deposit_token\).*&pay=1/);
});
