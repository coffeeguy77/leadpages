'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPortalCatalog, productsInCategory } = require('../lib/order/portal-catalog');

test('buildPortalCatalog exposes categories that have products', function () {
  var catalog = buildPortalCatalog(
    [
      { id: 'c1', name: 'Hams', slug: 'hams', sort_order: 0 },
      { id: 'c2', name: 'Empty', slug: 'empty', sort_order: 1 }
    ],
    [
      { id: 'p1', name: 'Leg ham', category_id: 'c1' },
      { id: 'p2', name: 'Turkey', category_id: 'c1' }
    ],
    {}
  );
  assert.equal(catalog.categories.length, 1);
  assert.equal(catalog.categories[0].name, 'Hams');
  assert.equal(productsInCategory(catalog, 'c1').length, 2);
  assert.equal(productsInCategory(catalog, 'c2').length, 0);
});

test('buildPortalCatalog adds Other for uncategorised products', function () {
  var catalog = buildPortalCatalog(
    [{ id: 'c1', name: 'Hams', slug: 'hams' }],
    [
      { id: 'p1', name: 'Leg ham', category_id: 'c1' },
      { id: 'p2', name: 'Misc', category_id: null }
    ],
    {}
  );
  assert.equal(catalog.categories.length, 2);
  assert.equal(catalog.categories[1].id, '__other__');
  assert.deepEqual(
    productsInCategory(catalog, '__other__').map(function (p) {
      return p.id;
    }),
    ['p2']
  );
});

test('productsInCategory includes orphaned products under Other', function () {
  var catalog = buildPortalCatalog(
    [{ id: 'c1', name: 'Hams', slug: 'hams' }],
    [
      { id: 'p1', name: 'Leg ham', category_id: 'c1' },
      { id: 'p2', name: 'Legacy', category_id: 'inactive-cat' }
    ],
    {}
  );
  assert.equal(catalog.categories.length, 2);
  assert.deepEqual(
    productsInCategory(catalog, '__other__').map(function (p) {
      return p.id;
    }),
    ['p2']
  );
});

test('buildPortalCatalog with no categories returns empty category list', function () {
  var catalog = buildPortalCatalog([], [{ id: 'p1', name: 'Loose item' }], {});
  assert.equal(catalog.categories.length, 1);
  assert.equal(catalog.categories[0].id, '__other__');
  assert.equal(catalog.products.length, 1);
});
