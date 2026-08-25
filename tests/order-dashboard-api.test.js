'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('order dashboard API module loads without syntax errors', function () {
  const mod = require('../api/order/dashboard');
  assert.equal(typeof mod, 'function');
});
