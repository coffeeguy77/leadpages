const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveWizardSteps,
  filterByShowWhen,
  matchesWhen,
  normalizeWizardSteps,
  stepIndexAfterMove
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

test('normalizeWizardSteps — event and equipment stay separate', function() {
  assert.deepEqual(
    normalizeWizardSteps(['event', 'equipment', 'beverages', 'contact']),
    ['event', 'equipment', 'beverages', 'contact']
  );
});

test('matchesWhen — wildcard', function() {
  assert.equal(matchesWhen({ field: 'productId', values: ['*'] }, {}), true);
});

test('stepIndexAfterMove — packages to travel stays on travel when list shifts', function() {
  const before = ['equipment', 'event', 'beverages', 'travel', 'addons', 'contact'];
  // travel temporarily drops out of the resolved list after reconcile
  const afterMissingTravel = ['equipment', 'event', 'beverages', 'addons', 'contact'];
  assert.equal(stepIndexAfterMove(before, 2, 1, before), 3); // beverages → travel
  assert.equal(stepIndexAfterMove(before, 2, 1, afterMissingTravel), 3); // land on addons (next available after beverages)
  assert.equal(afterMissingTravel[stepIndexAfterMove(before, 2, 1, afterMissingTravel)], 'addons');
});

test('stepIndexAfterMove — does not skip travel when steps unchanged', function() {
  const steps = ['equipment', 'event', 'beverages', 'travel', 'addons', 'contact'];
  assert.equal(steps[stepIndexAfterMove(steps, 2, 1, steps)], 'travel');
  assert.equal(steps[stepIndexAfterMove(steps, 3, 1, steps)], 'addons');
  assert.equal(steps[stepIndexAfterMove(steps, 3, -1, steps)], 'beverages');
});
