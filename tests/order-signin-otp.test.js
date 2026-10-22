'use strict';

/** SMS sign-in: Verify is the action, 6 digits sign in automatically, resend locked 60 s (client + server). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('server refuses a second code within 60 seconds', () => {
  const pa = read('api/order/portal-auth.js');
  assert.match(pa, /const RESEND_SECONDS = 60;/);
  assert.match(pa, /error: 'resend_too_soon',\s*retry_after: retryAfter/);
  assert.match(pa, /\.filter\('meta->>phone_e164', 'eq', phone\)/);
});

test('shop sign-in box: Verify first, quiet resend link with countdown, auto verify at 6 digits', () => {
  const js = read('assets/lp-order-storefront.js');
  assert.match(js, /var RESEND_SECONDS = 60;/);
  assert.match(js, /if \(self\.resendWait\(\) > 0\) return; \/\/ one code per 60 s/);
  assert.match(js, /'Resend code in ' \+ wait \+ 's'/);
  assert.match(js, /digits\.length === 6 && am && !am\.busy && am\.autoTried !== digits/);
  // no big "Resend code" primary button any more
  assert.doesNotMatch(js, /\(m\.step === 'code' \? 'Resend code' : 'Send code'\)/);
});

test('order page sign-in: same behaviour', () => {
  const op = read('order-portal.html');
  assert.match(op, /id="otp-resend" disabled>Resend code in 60s/);
  assert.match(op, /if\(digits\.length === 6 && digits !== autoTried && !verify\.disabled\)/);
  assert.match(op, /send\.style\.display='none';/);
});

test('generic /order-shop forwards to the designed shop page', () => {
  const os = read('order-shop.html');
  assert.match(os, /action: 'shop_url', slug: slug/);
  assert.match(os, /if \(url && url\.indexOf\('\/order-shop'\) !== 0\) \{ location\.replace\(url\); return; \}/);
});
