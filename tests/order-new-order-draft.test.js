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
  payload.customerName = 'Sarah Williams';
  payload.currentStep = 'payment';

  assert.equal(draft.saveDraft(siteId, payload), true);
  const loaded = draft.loadDraft(siteId);
  assert.equal(loaded.customerName, 'Sarah Williams');
  assert.equal(loaded.currentStep, 'payment');
  draft.clearDraft(siteId);
  assert.equal(draft.loadDraft(siteId), null);
});

test('resolveOrdersDisplayMode uses container width + fullscreen flag', function () {
  assert.equal(
    draft.resolveOrdersDisplayMode({ isFullScreenOrders: true, containerWidth: 1440 }),
    'fullscreen'
  );
  assert.equal(
    draft.resolveOrdersDisplayMode({ isFullScreenOrders: true, containerWidth: 1040 }),
    'embedded'
  );
  assert.equal(
    draft.resolveOrdersDisplayMode({ isFullScreenOrders: false, containerWidth: 1040 }),
    'embedded'
  );
  assert.equal(
    draft.resolveOrdersDisplayMode({ isFullScreenOrders: false, containerWidth: 768 }),
    'embedded'
  );
  assert.equal(
    draft.resolveOrdersDisplayMode({ isFullScreenOrders: false, containerWidth: 390 }),
    'mobile'
  );
});

test('miniCartPreview caps at three items', function () {
  const entries = [1, 2, 3, 4, 5, 6, 7].map(function (n) {
    return { id: n };
  });
  const preview = draft.miniCartPreview(entries, 3);
  assert.equal(preview.visible.length, 3);
  assert.equal(preview.moreCount, 4);
  assert.equal(draft.miniCartPreview(entries.slice(0, 2), 3).moreCount, 0);
});

test('stepCompleteness labels', function () {
  const empty = draft.stepCompleteness({}, 0);
  assert.equal(empty.products, 'Add items');
  assert.equal(empty.customer, 'Required');
  assert.equal(empty.payment, 'Review');

  const full = draft.stepCompleteness({
    customerName: 'Sarah Williams',
    payAction: 'send_invoice_link'
  }, 3);
  assert.equal(full.products, '3 items');
  assert.equal(full.customer, 'Sarah Williams');
  assert.equal(full.payment, 'Selected');
});

test('orders.html layout: fullscreen left-nav steps, no permanent right panel', function () {
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'assets/lp-order-new-order.css'), 'utf8');

  assert.match(html, /lp-order-draft\.js/);
  assert.match(html, /id="no-workspace"/);
  assert.match(html, /id="no-context-bar"/);
  assert.match(html, /id="no-full-cart-list"/);
  assert.match(html, /Cart &amp; Payment|Cart & Payment/);
  assert.match(html, /oanav-new-steps/);
  assert.match(html, /Add Products/);
  assert.match(html, /data-no-step="payment"/);
  assert.match(html, /id="no-mini-more"/);
  assert.match(html, /View Cart &amp; Payment|View Cart & Payment/);
  assert.match(html, /function lineFromFastDraft/);
  assert.match(html, /Object\.keys\(added\)\.forEach/);
  assert.match(html, /resolveNoDisplayMode/);
  assert.match(html, /body\.setAttribute\('data-no-mode'/);

  // Permanent right order panel beside products must be gone
  assert.doesNotMatch(html, /id="no-order-panel"/);
  assert.doesNotMatch(html, /id="no-panel-cart-list"/);

  // Fullscreen hides top tabs
  assert.match(css, /\.no-mode-fullscreen \.no-workflow-tabs/);
  assert.match(css, /display:\s*none\s*!important/);
  // Embedded/mobile show tabs
  assert.match(css, /\.no-mode-embedded \.no-workflow-tabs/);
  assert.match(css, /\.no-mode-mobile \.no-workflow-tabs/);
  // Nested left steps only in fullscreen
  assert.match(css, /body\[data-no-mode="fullscreen"\] \.oanav-new-steps/);
});

test('product editor remount parks shell before catalogue wipe', function () {
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  const idxFn = html.indexOf('function renderProductsTable()');
  assert.ok(idxFn > 0);
  const slice = html.slice(idxFn, idxFn + 500);
  assert.match(slice, /parkProdEditor\(\)/);
});
