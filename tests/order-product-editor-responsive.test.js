'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const pe = require('../assets/lp-order-product-editor');

test('resolveDisplayMode prefers full-screen Orders + wide container', function () {
  assert.equal(
    pe.resolveDisplayMode({ isFullScreenOrders: true, containerWidth: 1440 }),
    'fullscreen'
  );
  assert.equal(
    pe.resolveDisplayMode({ isFullScreenOrders: true, containerWidth: 1040 }),
    'embedded'
  );
  assert.equal(
    pe.resolveDisplayMode({ isFullScreenOrders: false, containerWidth: 1040 }),
    'embedded'
  );
  assert.equal(
    pe.resolveDisplayMode({ isFullScreenOrders: false, containerWidth: 390 }),
    'mobile'
  );
  assert.equal(
    pe.resolveDisplayMode({
      isFullScreenOrders: false,
      containerWidth: 390,
      forceFullscreenEditor: true
    }),
    'fullscreen'
  );
});

test('section navigation helpers', function () {
  assert.equal(pe.nextSection('details'), 'pricing');
  assert.equal(pe.prevSection('pricing'), 'details');
  assert.equal(pe.nextSection('display'), 'display');
  assert.equal(pe.SECTIONS.length, 6);
  assert.equal(pe.SECTIONS[3].label, 'Options');
});

test('pricing and rules summaries', function () {
  var tbc = pe.pricingSummary({
    pricing_method: 'price_tbc',
    deposit_mode: 'fixed',
    deposit_amount_cents: 2000
  });
  assert.match(tbc, /\$20\.00/);
  assert.match(tbc, /deposit/);
  var rules = pe.rulesSummary({
    size_mode: 'variable',
    minimum_kg: 0.6,
    cutoff_mode: 'days_before',
    cutoff_value: 2
  });
  assert.match(rules, /0\.6kg/);
  assert.match(rules, /2 day/);
});

test('catalogue columns differ by mode', function () {
  assert.ok(pe.catalogueVisibleColumns('fullscreen').indexOf('category') >= 0);
  assert.ok(pe.catalogueVisibleColumns('embedded').indexOf('category') < 0);
  assert.deepEqual(pe.catalogueVisibleColumns('mobile').slice(0, 2), ['product', 'pricing']);
});

test('orders.html wires shared ProductEditor shells', function () {
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  assert.match(html, /lp-order-product-editor\.js/);
  assert.match(html, /lp-order-product-editor\.css/);
  assert.match(html, /id="prod-workspace"/);
  assert.match(html, /id="prod-side-panel"/);
  assert.match(html, /id="prod-editor-shell"/);
  assert.match(html, /product-editor-row/);
  assert.match(html, /prod-card-list/);
  assert.match(html, /resolveDisplayMode/);
  assert.match(html, /requestOpenProduct/);
  assert.match(html, /mountProdEditor/);
  assert.match(html, /ResizeObserver/);
  assert.match(html, /aria-expanded/);
  assert.match(html, /Options &amp; Variations|Options & Variations/);
  assert.match(html, /data-lpe-section="pricing"/);
  assert.match(html, /prod-forceFullscreenEditor|prodForceFullscreenEditor/);
  assert.match(html, /Unsaved changes/);
  assert.doesNotMatch(html, /id="prod-form-card"/);
});

test('existing product admin markers remain', function () {
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  assert.match(html, /id="prod-extra-cats"/);
  assert.match(html, /id="prod-min-kg"/);
  assert.match(html, /id="prod-auto-cat"/);
  assert.match(html, /id="prod-migrate-weight"/);
  assert.match(html, /id="prod-deactivate-unsized-hams"/);
  assert.match(html, /id="prod-pies-extra"/);
});
