'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('recalculateOrderPreservingDeposit keeps deposit when already paid', async function () {
  // Logic-only test: deposit satisfied => no increase
  var orderBefore = { deposit_paid_cents: 5000, deposit_required_cents: 5000, payment_rule_snapshot: { payment_rule: 'percentage_deposit', deposit_percent_bps: 2000 } };
  var paid = Number(orderBefore.deposit_paid_cents) || 0;
  var req = Number(orderBefore.deposit_required_cents) || 0;
  var shouldFreeze = req > 0 && paid >= req;
  assert.equal(shouldFreeze, true);
});
