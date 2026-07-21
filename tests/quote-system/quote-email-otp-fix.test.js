const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const sessionApi = fs.readFileSync(path.join(root, 'api/quote-system/session.js'), 'utf8');
const calculateApi = fs.readFileSync(path.join(root, 'api/quote-system/calculate.js'), 'utf8');
const verifyLib = fs.readFileSync(path.join(root, 'lib/quote-system/verify.js'), 'utf8');
const online = fs.readFileSync(path.join(root, 'assets/lp-online-quote.js'), 'utf8');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const render = fs.readFileSync(path.join(root, 'api/render.js'), 'utf8');

test('session create persists contact email (root cause of missing OTP mail)', function() {
  assert.match(sessionApi, /First create used to drop contact/);
  assert.match(sessionApi, /createPatch\.contact_email/);
  assert.match(sessionApi, /updateSession\(session\.id, createPatch\)/);
});

test('session POST still reads body.token before update-vs-create branch', function() {
  // Regression: OTP contact patch dropped `const token = clean(body.token, …)`
  // so `if (token)` threw ReferenceError → every Get my quote failed.
  assert.match(sessionApi, /const token = clean\(body\.token/);
  const tokenDecl = sessionApi.indexOf('const token = clean(body.token');
  const tokenBranch = sessionApi.indexOf('if (token)');
  assert.ok(tokenDecl > 0 && tokenBranch > tokenDecl, 'body.token must be bound before if (token)');
});

test('calculate force-sends OTP and accepts contact on the request', function() {
  assert.match(calculateApi, /body\.contact/);
  assert.match(calculateApi, /force:\s*true/);
  assert.match(calculateApi, /emailVerification\.reason/);
  assert.match(calculateApi, /no contact_email on session/);
});

test('failed Resend does not leave a fake already-pending success', function() {
  assert.match(verifyLib, /already_pending/);
  assert.match(verifyLib, /sent: false, alreadyPending: true/);
  assert.match(verifyLib, /invalidatePendingVerifications/);
  assert.match(verifyLib, /RESEND_API_KEY missing/);
});

test('wizard always offers Send\/Resend code and passes contact on calculate', function() {
  assert.match(online, /contact:\s*\{/);
  assert.match(online, /data-act="send-email"/);
  assert.match(online, /Send code/);
  assert.match(online, /sendEmail\(\{ quiet: true \}\)/);
  assert.match(online, /emailSendReason/);
});

test('cache-bust for email OTP fix', function() {
  assert.match(manage, /oq-portal-style-1/);
  assert.match(render, /lp-online-quote\.js\?v=oq-session-token-1/);
});
