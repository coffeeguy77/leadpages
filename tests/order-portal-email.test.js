'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('portal-auth save_email and needs_email for mobile sign-in', function () {
  const api = fs.readFileSync(path.join(__dirname, '..', 'api/order/portal-auth.js'), 'utf8');
  assert.match(api, /action === 'save_email'/);
  assert.match(api, /needs_email/);
  assert.match(api, /looksLikeEmail/);
  assert.match(api, /packCustomerPublic/);
});

test('storefront prompts for email after SMS login when missing', function () {
  const js = fs.readFileSync(path.join(__dirname, '..', 'assets/lp-order-storefront.js'), 'utf8');
  assert.match(js, /maybePromptForEmail/);
  assert.match(js, /auth-save-email/);
  assert.match(js, /auth-skip-email/);
  assert.match(js, /Add your email/);
  assert.match(js, /step === 'email'/);
});
