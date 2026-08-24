'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('orders admin page avoids blocking external font and favicon loads', function () {
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  assert.match(html, /data-lp-admin-page="orders"/);
  assert.equal(html.indexOf('fonts.googleapis.com'), -1);
  assert.equal(html.indexOf('res.cloudinary.com'), -1);
  assert.match(html, /state\.session/);
  assert.match(html, /stopDashCutoffTimer/);
  assert.match(html, /var ms = new Date\(state\.dashCutoffAt\)/);
});

test('lp-logo skips boot when no logo markup on admin pages', function () {
  const js = fs.readFileSync(path.join(__dirname, '..', 'assets', 'lp-logo.js'), 'utf8');
  assert.match(js, /command\|admin\|orders/);
  assert.match(js, /hasLogo/);
});
