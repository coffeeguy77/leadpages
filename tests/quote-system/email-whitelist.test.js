const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEmail } = require('../../lib/quote-system/email-whitelist');

test('normalizeEmail — lowercases and trims', function() {
  assert.equal(normalizeEmail('  User@Example.COM  '), 'user@example.com');
});

test('normalizeEmail — empty', function() {
  assert.equal(normalizeEmail(''), '');
  assert.equal(normalizeEmail(null), '');
});
