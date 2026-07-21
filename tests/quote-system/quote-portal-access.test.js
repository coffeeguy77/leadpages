const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const online = fs.readFileSync(path.join(root, 'assets/lp-online-quote.js'), 'utf8');
const portalJs = fs.readFileSync(path.join(root, 'assets/lp-quote-portal.js'), 'utf8');
const portalHtml = fs.readFileSync(path.join(root, 'quote-portal.html'), 'utf8');
const accessApi = fs.readFileSync(path.join(root, 'api/quote-system/portal-access.js'), 'utf8');
const customerLib = fs.readFileSync(path.join(root, 'lib/quote-system/customer-portal.js'), 'utf8');
const emailLib = fs.readFileSync(path.join(root, 'lib/quote-system/portal-email.js'), 'utf8');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const render = fs.readFileSync(path.join(root, 'api/render.js'), 'utf8');

test('portal-access API emails a magic link without leaking account existence', function() {
  assert.match(accessApi, /resolvePortalForAccess/);
  assert.match(accessApi, /sendPortalAccessEmail/);
  assert.match(accessApi, /GENERIC_OK/);
  assert.match(accessApi, /If we have quotes for that email/);
  assert.match(customerLib, /resolvePortalForAccess/);
  assert.match(customerLib, /getCustomerPortalByEmail/);
  assert.match(customerLib, /sms_verified_at/);
  assert.match(emailLib, /sendPortalAccessEmail/);
  assert.match(emailLib, /Open my quotes portal/);
});

test('wizard exposes Access my portal email form', function() {
  assert.match(online, /portal-access-toggle/);
  assert.match(online, /portal-access-send/);
  assert.match(online, /sendPortalAccess/);
  assert.match(online, /\/portal-access/);
  assert.match(online, /Already quoted\? Access my portal/);
  assert.match(online, /renderPortalAccessBar/);
});

test('quote-portal empty state offers email access form', function() {
  assert.match(portalJs, /renderAccessForm/);
  assert.match(portalJs, /qp-access-send/);
  assert.match(portalJs, /portal-access/);
  assert.match(portalHtml, /oq-align-fields-1/);
});

test('cache-bust for portal access', function() {
  assert.match(manage, /oq-align-fields-1/);
  assert.match(render, /lp-online-quote\.js\?v=oq-align-fields-1/);
});
