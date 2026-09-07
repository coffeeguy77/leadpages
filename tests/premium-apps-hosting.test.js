'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  PREMIUM_APPS,
  subscriptionIsActive,
  findPremiumDef
} = require('../lib/premium-apps');

test('PREMIUM_APPS covers Orders, Quote Builder, Bookings', function () {
  var slugs = PREMIUM_APPS.map(function (a) {
    return a.slug;
  });
  assert.deepEqual(slugs.sort(), ['bookings', 'online-quote', 'order-storefront'].sort());
  assert.ok(PREMIUM_APPS.every(function (a) {
    return a.nav_key && a.section_key && a.name;
  }));
});

test('findPremiumDef resolves slug, section_key, and nav_key', function () {
  assert.equal(findPremiumDef('order-storefront').nav_key, 'orders');
  assert.equal(findPremiumDef('orderStorefront').slug, 'order-storefront');
  assert.equal(findPremiumDef('orders').slug, 'order-storefront');
  assert.equal(findPremiumDef('onlinequotes').slug, 'online-quote');
  assert.equal(findPremiumDef('bookings').section_key, 'bookingStorefront');
  assert.equal(findPremiumDef('nope'), null);
});

test('subscriptionIsActive treats active / trialing / past_due / access_until', function () {
  assert.equal(subscriptionIsActive({ status: 'active' }), true);
  assert.equal(subscriptionIsActive({ status: 'trialing' }), true);
  assert.equal(subscriptionIsActive({ status: 'past_due' }), true);
  assert.equal(subscriptionIsActive({ status: 'cancelled' }), false);
  var future = new Date(Date.now() + 86400000).toISOString();
  assert.equal(subscriptionIsActive({ status: 'cancelled', access_until: future }), true);
  var past = new Date(Date.now() - 86400000).toISOString();
  assert.equal(subscriptionIsActive({ status: 'cancelled', access_until: past }), false);
  assert.equal(subscriptionIsActive(null), false);
});

test('premium-apps and start-hosting API files exist', function () {
  assert.ok(fs.existsSync(path.join(__dirname, '../api/billing/premium-apps.js')));
  assert.ok(fs.existsSync(path.join(__dirname, '../api/billing/start-hosting.js')));
  assert.ok(fs.existsSync(path.join(__dirname, '../lib/premium-apps.js')));
  var startSrc = fs.readFileSync(path.join(__dirname, '../api/billing/start-hosting.js'), 'utf8');
  assert.match(startSrc, /findOrCreateUser/);
  assert.match(startSrc, /checkout/);
  var premiumSrc = fs.readFileSync(path.join(__dirname, '../api/billing/premium-apps.js'), 'utf8');
  assert.match(premiumSrc, /listPremiumEntitlements/);
  assert.match(premiumSrc, /activatePremiumApp/);
});

test('manage.html gates premium nav for non-super roles', function () {
  var html = fs.readFileSync(path.join(__dirname, '../manage.html'), 'utf8');
  assert.match(html, /lpLoadPremiumEntitlements/);
  assert.match(html, /_premiumEntitledNav/);
  assert.match(html, /PREMIUM_NAV=\['onlinequotes','orders','bookings'\]/);
  assert.match(html, /\/api\/billing\/premium-apps/);
  assert.match(html, /lpc-order-desk/);
  assert.match(html, /showOrders=currentRole==='super'/);
});

test('billing-admin has Hosting manager and Premium apps panels', function () {
  var html = fs.readFileSync(path.join(__dirname, '../billing-admin.html'), 'utf8');
  assert.match(html, /data-tab="hosting"/);
  assert.match(html, /data-tab="premium"/);
  assert.match(html, /\/api\/billing\/start-hosting/);
  assert.match(html, /\/api\/billing\/premium-apps/);
  assert.match(html, /Start Stripe billing/);
});

test('command.html Accounting hint mentions hosting manager', function () {
  var html = fs.readFileSync(path.join(__dirname, '../command.html'), 'utf8');
  assert.match(html, /Hosting manager/);
});
