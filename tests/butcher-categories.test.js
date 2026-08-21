'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  guessButcherCategorySlug,
  extractProductHead,
  BUTCHER_CATEGORIES
} = require('../lib/order/butcher-categories');

test('extractProductHead reads Griffith-style prefixes', function () {
  assert.equal(extractProductHead('BEEF - Brisket'), 'BEEF');
  assert.equal(extractProductHead('HAM - Rolled Half'), 'HAM');
  assert.equal(extractProductHead('Chicken Maryland'), 'Chicken');
});

test('guessButcherCategorySlug maps meat types', function () {
  assert.equal(guessButcherCategorySlug('BEEF - Brisket'), 'beef');
  assert.equal(guessButcherCategorySlug('BEEF - Scotch Fillet (Roast)'), 'beef');
  assert.equal(guessButcherCategorySlug('HAM - Rolled Half'), 'ham');
  assert.equal(guessButcherCategorySlug('CHICKEN - Maryland'), 'chicken');
  assert.equal(guessButcherCategorySlug('DUCK - Whole'), 'duck');
  assert.equal(guessButcherCategorySlug('LAMB - Leg'), 'lamb');
  assert.equal(guessButcherCategorySlug('PORK - Belly'), 'pork');
  assert.equal(guessButcherCategorySlug('BACON - Streaky'), 'bacon');
  assert.equal(guessButcherCategorySlug('SAUSAGES - Mixed'), 'sausages');
  assert.equal(guessButcherCategorySlug('SAUCE - BBQ'), 'extras');
  assert.equal(guessButcherCategorySlug('Mystery Item XYZ'), null);
});

test('butcher category list includes core meats', function () {
  var slugs = BUTCHER_CATEGORIES.map(function (c) {
    return c.slug;
  });
  ['beef', 'chicken', 'duck', 'ham', 'lamb', 'pork'].forEach(function (s) {
    assert.ok(slugs.indexOf(s) >= 0, s);
  });
});

test('products API exposes auto_categorise action', function () {
  const fs = require('fs');
  const path = require('path');
  const api = fs.readFileSync(path.join(__dirname, '..', 'api/order/products.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  assert.match(api, /auto_categorise/);
  assert.match(html, /prod-auto-cat/);
  assert.match(html, /Match categories/);
});
