'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normaliseInhouseMethod,
  inhouseMethodLabel,
  INHOUSE_METHODS
} = require('../lib/order/inhouse-methods');

test('normaliseInhouseMethod accepts aliases', function () {
  assert.equal(normaliseInhouseMethod('cash'), 'cash_deposit');
  assert.equal(normaliseInhouseMethod('eftpos'), 'eftpos');
  assert.equal(normaliseInhouseMethod('DIRECT DEPOSIT'), 'direct_deposit');
  assert.equal(normaliseInhouseMethod('contra'), 'contra');
  assert.equal(normaliseInhouseMethod('invalid'), null);
});

test('inhouseMethodLabel', function () {
  assert.equal(inhouseMethodLabel('cash_deposit'), 'Cash deposit');
  assert.equal(inhouseMethodLabel('eftpos'), INHOUSE_METHODS.eftpos.label);
});

test('orders.html includes staff ops UI hooks', function () {
  const fs = require('fs');
  const path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  assert.match(html, /action: 'void_order'/);
  assert.match(html, /no-cat-pill/);
  assert.match(html, /send_invoice_link/);
  assert.match(html, /inhouse_payment/);
  assert.match(html, /deposit-phone-modal/);
  assert.match(html, /inhouse-pay-modal/);
  assert.match(html, /record_inhouse_payment/);
});

test('orders.html staff new order is always fast', function () {
  const fs = require('fs');
  const path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  assert.doesNotMatch(html, /set-staff-order-mode/);
  assert.match(html, /state\.noOrderMode = 'fast'/);
  assert.match(html, /staff_order_mode: 'fast'/);
  assert.match(html, /set-sf-shop-mode/);
});
