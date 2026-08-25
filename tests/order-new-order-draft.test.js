'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const draft = require('../assets/lp-order-draft');

test('cartEntriesFromDraft ignores category and keeps multi-category items', function () {
  const products = [
    { id: 'steak-1', name: 'Ribeye', category_id: 'steaks' },
    { id: 'fish-1', name: 'Trout', category_id: 'seafood' },
    { id: 'pie-1', name: 'Meat pie', category_id: 'pies' }
  ];
  const added = { 'steak-1': true, 'fish-1': true };
  const drafts = {
    'steak-1': { qty: 2, kg: '', notes: '', answers: {} },
    'fish-1': { qty: 1, kg: '1.2', notes: 'skin off', answers: {} }
  };

  const entries = draft.cartEntriesFromDraft({
    noFastAdded: added,
    noFastDrafts: drafts,
    products: products
  });

  assert.equal(entries.length, 2);
  assert.equal(entries[0].key, 'fast:steak-1');
  assert.equal(entries[1].product.name, 'Trout');
  assert.equal(entries[1].line.requested_weight_kg, 1.2);

  // Switching "visible category" must not change cart source
  const still = draft.cartEntriesFromDraft({
    noFastAdded: added,
    noFastDrafts: drafts,
    products: products.filter(function (p) { return p.category_id === 'pies'; })
  });
  // Products list filter only affects lookup — missing products drop out, but identity is still added map
  assert.equal(still.length, 0);

  const withAllProducts = draft.cartEntriesFromDraft({
    noFastAdded: Object.assign({}, added, { 'pie-1': true }),
    noFastDrafts: Object.assign({}, drafts, { 'pie-1': { qty: 3 } }),
    products: products
  });
  assert.equal(withAllProducts.length, 3);
});

test('draft save/load/clear round-trip', function () {
  const mem = Object.create(null);
  global.localStorage = {
    getItem: function (k) { return mem[k] != null ? mem[k] : null; },
    setItem: function (k, v) { mem[k] = String(v); },
    removeItem: function (k) { delete mem[k]; }
  };

  const siteId = 'test-site-draft-' + Date.now();
  const payload = draft.emptyDraft(siteId);
  payload.noFastAdded = { a: true };
  payload.noFastDrafts = { a: { qty: 1, kg: '0.5', notes: 'note' } };
  payload.customerName = 'Sarah Williams';
  payload.currentStep = 'customer';

  assert.equal(draft.saveDraft(siteId, payload), true);
  const loaded = draft.loadDraft(siteId);
  assert.ok(loaded);
  assert.equal(loaded.customerName, 'Sarah Williams');
  assert.equal(loaded.noFastAdded.a, true);
  assert.equal(loaded.currentStep, 'customer');
  assert.ok(loaded.updatedAt);

  draft.clearDraft(siteId);
  assert.equal(draft.loadDraft(siteId), null);
});

test('stepCompleteness labels', function () {
  const empty = draft.stepCompleteness({}, 0);
  assert.equal(empty.products, 'Add items');
  assert.equal(empty.customer, 'Required');
  assert.equal(empty.payment, 'Not selected');

  const full = draft.stepCompleteness({
    customerName: 'Sarah Williams',
    payAction: 'send_invoice_link'
  }, 3);
  assert.equal(full.products, '3 items');
  assert.equal(full.customer, 'Sarah Williams');
  assert.equal(full.payment, 'Selected');
});

test('orders.html New Order markers and cart root-cause fix', function () {
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  assert.match(html, /lp-order-draft\.js/);
  assert.match(html, /lp-order-new-order\.css/);
  assert.match(html, /id="no-workspace"/);
  assert.match(html, /data-no-step="products"/);
  assert.match(html, /data-no-step="customer"/);
  assert.match(html, /data-no-step="payment"/);
  assert.match(html, /id="no-order-panel"/);
  assert.match(html, /id="no-cust-summary"/);
  assert.match(html, /id="no-panel-cart-list"/);
  assert.match(html, /id="no-mobile-bar"/);
  assert.match(html, /id="no-mobile-sheet"/);
  assert.match(html, /function lineFromFastDraft/);
  assert.match(html, /Object\.keys\(added\)\.forEach/);
  assert.match(html, /scheduleNoDraftPersist/);
  assert.match(html, /maybeRestoreNoDraft/);
  assert.match(html, /ensureNoWorkspaceObserver/);
  assert.match(html, /resolveNoDisplayMode/);
  assert.match(html, /All products/);
  assert.match(html, /parkProdEditor\(\)/);
  // Must not wipe cart on every New Order view load
  assert.doesNotMatch(
    html,
    /v === 'new'\) \{\s*state\.noSelectedCat = '';\s*state\.noFastDrafts = \{\};\s*state\.noFastPanelOpen = \{\};\s*state\.noFastAdded = \{\};/
  );
});

test('product editor remount parks shell before catalogue wipe', function () {
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  const idxFn = html.indexOf('function renderProductsTable()');
  assert.ok(idxFn > 0);
  const slice = html.slice(idxFn, idxFn + 500);
  assert.match(slice, /parkProdEditor\(\)/);
  assert.match(html, /mountProdEditor\('embedded'/);
  assert.match(html, /prod-mode-embedded/);
});
