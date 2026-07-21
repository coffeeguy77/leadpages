const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const online = fs.readFileSync(path.join(root, 'assets/lp-online-quote.js'), 'utf8');
const planning = fs.readFileSync(path.join(root, 'assets/lp-quote-planning.js'), 'utf8');
const builderCss = fs.readFileSync(path.join(root, 'assets/lp-quote-builder.css'), 'utf8');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const render = fs.readFileSync(path.join(root, 'api/render.js'), 'utf8');
const whitelistLib = require('../../lib/quote-system/email-whitelist');
const whitelistApi = fs.readFileSync(path.join(root, 'api/quote-system/admin/whitelist.js'), 'utf8');
const accountsSql = fs.readFileSync(path.join(root, 'db/quote_verified_emails_accounts.sql'), 'utf8');
const verifyEmail = fs.readFileSync(path.join(root, 'api/quote-system/verify-email.js'), 'utf8');
const verifySms = fs.readFileSync(path.join(root, 'api/quote-system/verify-sms.js'), 'utf8');

test('cache-bust bumped for ux + whitelist', function() {
  assert.match(manage, /oq-portal-access-1/);
  assert.match(render, /lp-online-quote\.js\?v=oq-portal-access-1/);
  assert.doesNotMatch(manage, /oq-verify-portal-3/);
});

test('Your Quote panel only renders on contact step', function() {
  assert.match(online, /contactSelf\.renderQuotePanel\(\)/);
  // Must not append quote below every step after calculate.
  assert.doesNotMatch(online, /stepKey\s*!==\s*['"]contact['"]/);
  assert.match(online, /Stay on Your Details so verification UI does not leak/);
  assert.match(online, /lp-oq-col-aside/);
});

test('calendar is compact (~50% smaller)', function() {
  assert.match(online, /max-width:220px/);
  assert.match(builderCss, /max-width:\s*220px/);
  assert.match(online, /\.lp-oq-cal-day\{[^}]*font-size:11px/);
});

test('global readable type scale for quote builder', function() {
  assert.match(online, /--lp-oq-fs-lead:16px/);
  assert.match(online, /\.lp-oq-intro,\.lp-oq-lead,\.lp-oq-plan p/);
  assert.match(online, /font-size:var\(--lp-oq-fs-lead\)!important/);
  assert.doesNotMatch(planning, /font-size:12px/);
});

test('section padding keeps ONLINE QUOTE off the edges', function() {
  assert.match(online, /\.online-quote\{padding-top:clamp\(48px/);
  assert.match(online, /padding-bottom:clamp\(52px/);
});

test('Your Details aside has no bordered Event Info box', function() {
  assert.match(online, /\.lp-oq-cols-contact \.lp-oq-col-aside\{padding:0;border:none;background:transparent/);
  assert.doesNotMatch(online, /lp-oq-col-quote/);
  assert.match(builderCss, /\.lp-oq-cols-contact \.lp-oq-col-aside/);
  assert.doesNotMatch(builderCss, /lp-oq-col-quote/);
});

test('email confirm uses ensureSession and passes email', function() {
  assert.match(online, /OnlineQuoteWidget\.prototype\.confirmEmail/);
  assert.match(online, /ensureSession\(\)\.then/);
  assert.match(online, /action:\s*'confirm'/);
  assert.match(online, /email:\s*email/);
  assert.match(verifyEmail, /body\.email/);
  assert.match(verifyEmail, /Never fail a successful OTP because whitelist/);
});

test('whitelist accounts merge name aliases and retain phone', function() {
  assert.deepEqual(
    whitelistLib.mergeNameAliases(['Robert'], 'Robert', 'Rob'),
    ['Robert', 'Rob']
  );
  assert.deepEqual(
    whitelistLib.mergeNameAliases(['rob'], 'Robert', 'ROB'),
    ['Robert', 'rob']
  );
  assert.match(accountsSql, /name_aliases/);
  assert.match(accountsSql, /primary_name/);
  assert.match(accountsSql, /phone text/);
  assert.match(verifySms, /whitelistEmail/);
  assert.match(verifySms, /phone:\s*phone/);
});

test('admin whitelist API + manage UI with Add', function() {
  assert.match(whitelistApi, /listWhitelistedEmails/);
  assert.match(whitelistApi, /whitelistEmail/);
  assert.match(whitelistApi, /removeWhitelistedEmail/);
  assert.match(manage, /oq-wl-add/);
  assert.match(manage, /Verified email whitelist/);
  assert.match(manage, /\/api\/quote-system\/admin\/whitelist/);
  assert.match(manage, /oq-wl-remove/);
});
