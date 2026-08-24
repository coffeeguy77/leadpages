'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const nav = require('../assets/lp-order-admin-nav');

test('nav tree uses industry-neutral labels', function () {
  const blob = JSON.stringify(nav.NAV_TREE);
  assert.doesNotMatch(blob, /butcher|butchery|christmas|turkey|meat prep|weigh order/i);
  assert.match(blob, /Supply & Preparation/);
  assert.match(blob, /Finalise Orders/);
});

test('flattenVisibleTree hides payments when disabled', function () {
  const hidden = nav.flattenVisibleTree({ paymentsEnabled: false, depositsEnabled: false, isSuper: false });
  assert.ok(!hidden.some(function (n) { return n.id === 'payments'; }));
  const shown = nav.flattenVisibleTree({ paymentsEnabled: true, depositsEnabled: true, isSuper: false });
  assert.ok(shown.some(function (n) { return n.id === 'payments'; }));
});

test('routeMeta maps operational shortcuts to existing views', function () {
  assert.equal(nav.routeMeta('orders-finalise').view, 'orders');
  assert.equal(nav.routeMeta('orders-packing').view, 'orders');
  assert.equal(nav.routeMeta('settings-schedule').view, 'settings');
  assert.equal(nav.parentGroupForRoute('messaging-templates'), 'customers');
});

test('orders.html wires accordion navigation', function () {
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  assert.match(html, /lp-order-admin-nav\.js/);
  assert.match(html, /nav-group-btn/);
  assert.match(html, /nav-sub-wrap/);
  assert.match(html, /btn-side-collapse/);
  assert.match(html, /openNavRoute/);
  assert.doesNotMatch(html, /nav-group-label.*Settings/s);
});
