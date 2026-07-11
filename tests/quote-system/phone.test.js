const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normaliseAuPhone } = require('../../lib/quote-system/phone');

test('normaliseAuPhone — mobile with leading 0', function() {
  assert.equal(normaliseAuPhone('0414631463'), '+61414631463');
});

test('normaliseAuPhone — spaced and formatted', function() {
  assert.equal(normaliseAuPhone('0414 631 463'), '+61414631463');
  assert.equal(normaliseAuPhone('(04) 1463-1463'), '+61414631463');
});

test('normaliseAuPhone — already international', function() {
  assert.equal(normaliseAuPhone('+61414631463'), '+61414631463');
  assert.equal(normaliseAuPhone('61414631463'), '+61414631463');
});

test('normaliseAuPhone — landline', function() {
  assert.equal(normaliseAuPhone('0298765432'), '+61298765432');
});

test('normaliseAuPhone — empty', function() {
  assert.equal(normaliseAuPhone(''), '');
  assert.equal(normaliseAuPhone(null), '');
});
