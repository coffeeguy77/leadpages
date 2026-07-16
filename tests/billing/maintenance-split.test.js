const { test } = require('node:test');
const assert = require('node:assert/strict');
const { maintenanceSplitCents } = require('../../lib/billing/maintenance-split');

test('maintenance split defaults to 70/30', function() {
  const s = maintenanceSplitCents(10000);
  assert.equal(s.partner, 7000);
  assert.equal(s.platform, 3000);
  assert.equal(s.partnerPct, 70);
});

test('maintenance split handles zero', function() {
  const s = maintenanceSplitCents(0);
  assert.equal(s.partner, 0);
  assert.equal(s.platform, 0);
});
