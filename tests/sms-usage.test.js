'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeSmsKind,
  estimateSegments
} = require('../lib/order/sms-kind');

test('normalizeSmsKind maps event types to allowed usage kinds', function () {
  assert.equal(normalizeSmsKind('transactional'), 'transactional');
  assert.equal(normalizeSmsKind('otp'), 'otp');
  assert.equal(normalizeSmsKind('broadcast'), 'broadcast');
  assert.equal(normalizeSmsKind('abandoned_cart'), 'abandoned');
  assert.equal(normalizeSmsKind('abandoned_cart_2'), 'abandoned');
  assert.equal(normalizeSmsKind('deposit_required'), 'transactional');
  assert.equal(normalizeSmsKind('deposit_reminder'), 'transactional');
  assert.equal(normalizeSmsKind('broadcast_open_cart'), 'broadcast');
  assert.equal(normalizeSmsKind('import_notice'), 'import_notice');
});

test('estimateSegments uses GSM single and multipart rules', function () {
  assert.equal(estimateSegments(''), 1);
  assert.equal(estimateSegments('x'.repeat(160)), 1);
  assert.equal(estimateSegments('x'.repeat(161)), 2);
});

test('orders.html nests Import and Messaging under Settings nav group', function () {
  const fs = require('fs');
  const path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  assert.match(html, /NAV_SETTINGS/);
  assert.match(html, /nav-group-label.*Settings/s);
  assert.match(html, /nav-sub/);
  assert.match(html, /id: 'import', label: 'Import'/);
  assert.match(html, /id: 'messaging', label: 'Messaging'/);
  assert.doesNotMatch(html, /id: 'import', label: 'Import'[\s\S]*id: 'payments'/);
});

test('messaging records normalized SMS kind', function () {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib/order/messaging.js'), 'utf8');
  assert.match(src, /normalizeSmsKind/);
  assert.match(src, /sms-kind/);
});

test('portal-auth records Twilio Verify OTP usage', function () {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'api/order/portal-auth.js'), 'utf8');
  assert.match(src, /recordSmsUsage/);
  assert.match(src, /twilio_verify/);
});
