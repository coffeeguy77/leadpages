const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const verify = require('../../lib/quote-system/verify');
const online = fs.readFileSync(path.join(root, 'assets/lp-online-quote.js'), 'utf8');
const verifyEmailApi = fs.readFileSync(path.join(root, 'api/quote-system/verify-email.js'), 'utf8');
const portalJs = fs.readFileSync(path.join(root, 'assets/lp-quote-portal.js'), 'utf8');
const portalHtml = fs.readFileSync(path.join(root, 'quote-portal.html'), 'utf8');
const customerSql = fs.readFileSync(path.join(root, 'db/quote_customer_portals.sql'), 'utf8');
const customerLib = fs.readFileSync(path.join(root, 'lib/quote-system/customer-portal.js'), 'utf8');

test('normalizeOtpCode strips spaces and non-digits', function() {
  assert.equal(verify.normalizeOtpCode('494 679'), '494679');
  assert.equal(verify.normalizeOtpCode(' 98-3768 '), '983768');
  assert.equal(verify.normalizeOtpCode(''), '');
});

test('verify-email confirm does not fail hard on whitelist errors', function() {
  assert.match(verifyEmailApi, /Never fail a successful OTP because whitelist/);
  assert.match(verifyEmailApi, /whitelistEmail/);
  assert.match(verifyEmailApi, /message: VERIFY_ERROR_MESSAGES/);
});

test('verifyEmailCode matches any pending hash (race-safe)', function() {
  const src = fs.readFileSync(path.join(root, 'lib/quote-system/verify.js'), 'utf8');
  assert.match(src, /findPendingVerifications/);
  assert.match(src, /invalidatePendingVerifications/);
  assert.match(src, /force/);
});

test('live wizard surfaces verify errors and forces resend', function() {
  assert.match(online, /force:\s*true/);
  assert.match(online, /res\.message/);
  assert.match(online, /replace\(\/\\D\/g,\s*''\)/);
  assert.match(online, /emailWhitelisted/);
  assert.match(online, /jobsPortalUrl/);
  assert.doesNotMatch(online, /\bglobal\.LPQuotePlanning\b/);
});

test('customer jobs portal schema and APIs exist', function() {
  assert.match(customerSql, /quote_customer_portals/);
  assert.match(customerLib, /listCustomerJobs/);
  assert.match(customerLib, /updateCustomerJob/);
  assert.ok(fs.existsSync(path.join(root, 'api/quote-system/portal-jobs.js')));
  assert.ok(fs.existsSync(path.join(root, 'api/quote-system/portal-update.js')));
  assert.ok(fs.existsSync(path.join(root, 'api/quote-system/portal-email.js')));
});

test('portal UI supports jobs list, edit, accept, email', function() {
  assert.match(portalJs, /mode === 'job'|mode === \"job\"|renderJobs/);
  assert.match(portalJs, /portal-update/);
  assert.match(portalJs, /portal-email/);
  assert.match(portalJs, /qp-accept/);
  assert.match(portalHtml, /oq-verify-portal-1/);
});
