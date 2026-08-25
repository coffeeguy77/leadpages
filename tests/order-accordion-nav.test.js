'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const nav = require('../assets/lp-order-admin-nav');

test('nav tree uses industry-neutral labels', function () {
  const blob = JSON.stringify(nav.NAV_TREE);
  assert.doesNotMatch(blob, /butcher|butchery|christmas|turkey|meat prep|weigh order/i);
  assert.match(blob, /Production Summary|Order Operations|Pickup Day View/);
  assert.doesNotMatch(blob, /Catalogue|Message Templates|Product Options/);
});

test('flattenVisibleTree hides payments when disabled', function () {
  const hidden = nav.flattenVisibleTree({ paymentsEnabled: false, depositsEnabled: false, isSuper: false });
  assert.ok(!hidden.some(function (n) { return n.route === 'payments'; }));
  const shown = nav.flattenVisibleTree({ paymentsEnabled: true, depositsEnabled: true, isSuper: false });
  assert.ok(shown.some(function (n) { return n.route === 'payments'; }));
});

test('operations group includes pickup day production allocation labels and calendar', function () {
  const tree = nav.flattenVisibleTree({ paymentsEnabled: true, depositsEnabled: true, isSuper: false });
  const ops = tree.find(function (n) { return n.group === 'operations'; });
  assert.ok(ops);
  const childRoutes = (ops.children || []).map(function (c) { return c.route; });
  assert.ok(childRoutes.indexOf('pickup-day') >= 0);
  assert.ok(childRoutes.indexOf('supply') >= 0);
  assert.ok(childRoutes.indexOf('allocation') >= 0);
  assert.ok(childRoutes.indexOf('labels') >= 0);
  assert.ok(childRoutes.indexOf('calendar') >= 0);
  assert.equal(nav.parentGroupForRoute('pickup-day'), 'operations');
  assert.equal(nav.parentGroupForRoute('supply'), 'operations');
  assert.equal(nav.parentGroupForRoute('allocation'), 'operations');
  assert.equal(nav.parentGroupForRoute('labels'), 'operations');
});

test('top-level routes for products and customers', function () {
  const tree = nav.flattenVisibleTree({ paymentsEnabled: true, depositsEnabled: true, isSuper: false });
  const routes = tree.filter(function (n) { return n.route; }).map(function (n) { return n.route; });
  assert.ok(routes.indexOf('products') >= 0);
  assert.ok(routes.indexOf('customers') >= 0);
});

test('settings group includes messaging and abandoned carts', function () {
  const settings = nav.NAV_TREE.find(function (n) { return n.id === 'settings'; });
  assert.ok(settings);
  assert.ok(settings.children.some(function (c) { return c.route === 'messaging'; }));
  assert.ok(settings.children.some(function (c) { return c.route === 'abandoned'; }));
  assert.ok(settings.children.some(function (c) { return c.route === 'import'; }));
  assert.equal(nav.parentGroupForRoute('messaging'), 'settings');
  assert.equal(nav.parentGroupForRoute('abandoned'), 'settings');
});

test('settings routes map to distinct sections', function () {
  assert.equal(nav.routeMeta('settings-cart').settingsSection, 'menu-layouts');
  assert.equal(nav.routeMeta('settings-schedule').settingsSection, 'schedule');
  assert.equal(nav.routeMeta('settings-store').settingsSection, 'store');
});

test('orders.html wires accordion navigation', function () {
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  assert.match(html, /lp-order-admin-nav\.js/);
  assert.match(html, /lp-order-admin-nav\.css/);
  assert.match(html, /class="oanav"/);
  assert.match(html, /oanav-group-head/);
  assert.match(html, /oanav-sub-panel/);
  assert.match(html, /btn-side-collapse/);
  assert.match(html, /openNavRoute/);
  assert.match(html, /applySettingsSection/);
  assert.match(html, /pay-tab/);
  assert.doesNotMatch(html, /class="mark"/);
  assert.doesNotMatch(html, /if \(activeParent\) expanded = activeParent/);
});
