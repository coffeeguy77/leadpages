const { test } = require('node:test');
const assert = require('node:assert/strict');

test('verify-email handler module loads with VERIFY_CHANNEL import', function() {
  assert.doesNotThrow(function() {
    require('../../api/quote-system/verify-email');
  });
});
