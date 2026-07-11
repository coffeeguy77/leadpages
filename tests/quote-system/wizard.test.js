const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveWizardSteps,
  filterByShowWhen,
  matchesWhen,
  normalizeWizardSteps
} = require('../../lib/quote-system/wizard');

test('resolveWizardSteps — skips travel when no zones', function() {
  const steps = resolveWizardSteps(
    { steps: ['equipment', 'travel', 'contact'] },
    { productId: 'coffee-cart' },
    0
  );
  assert.deepEqual(steps, ['equipment', 'contact']);
});

test('resolveWizardSteps — conditional beverages step', function() {
  const wizard = {
    steps: ['equipment', 'beverages', 'addons', 'contact'],
    conditions: [
      { step: 'beverages', when: { field: 'productId', values: ['coffee-cart'] } }
    ]
  };
  assert.deepEqual(
    resolveWizardSteps(wizard, { productId: 'coffee-cart' }, 0),
    ['equipment', 'beverages', 'addons', 'contact']
  );
  assert.deepEqual(
    resolveWizardSteps(wizard, { productId: 'coffee-van' }, 0),
    ['equipment', 'addons', 'contact']
  );
});

test('filterByShowWhen — package visibility', function() {
  const items = [
    { id: 'a', label: 'A', showWhen: { field: 'productId', values: ['coffee-cart'] } },
    { id: 'b', label: 'B' }
  ];
  assert.equal(filterByShowWhen(items, { productId: 'coffee-cart' }).length, 2);
  assert.equal(filterByShowWhen(items, { productId: 'coffee-van' }).length, 1);
  assert.equal(filterByShowWhen(items, { productId: 'coffee-van' })[0].id, 'b');
});

test('normalizeWizardSteps — contact always last', function() {
  assert.deepEqual(
    normalizeWizardSteps(['contact', 'equipment', 'beverages']),
    ['equipment', 'beverages', 'contact']
  );
});

test('matchesWhen — wildcard', function() {
  assert.equal(matchesWhen({ field: 'productId', values: ['*'] }, {}), true);
});
