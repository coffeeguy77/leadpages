const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveTierRate,
  billableShiftHours,
  normalizeCarts,
  eventBillableHours
} = require('../../lib/quote-system/pricing');
const { calculateQuote } = require('../../lib/quote-system/calculator');
const { BEAN_CULTURE_QUOTE_CONFIG } = require('../../lib/quote-system/bean-culture-config');

test('resolveTierRate — 100+ vs under 100', function() {
  var tiers = [
    { minQty: 100, perUnitCents: 300 },
    { minQty: 1, perUnitCents: 500 }
  ];
  assert.equal(resolveTierRate(tiers, 100), 300);
  assert.equal(resolveTierRate(tiers, 50), 500);
  assert.equal(resolveTierRate(tiers, 150), 300);
});

test('calculateQuote — tiered package pricing', function() {
  var config = {
    business: { gstRegistered: false },
    labour: { hourlyCents: 0, minimumHours: 1 },
    products: [],
    beverages: [{
      id: 'coffees',
      label: 'Coffee package',
      pricingMode: 'tiered',
      tiers: [
        { minQty: 100, perUnitCents: 300 },
        { minQty: 1, perUnitCents: 500 }
      ]
    }]
  };
  var at100 = calculateQuote(config, { beverageId: 'coffees', unitCount: 100 });
  assert.equal(at100.breakdown[0].totalCents, 30000);
  var at50 = calculateQuote(config, { beverageId: 'coffees', unitCount: 50 });
  assert.equal(at50.breakdown[0].totalCents, 25000);
});

test('billableShiftHours — multi-day shifts with minimum', function() {
  var hours = billableShiftHours([
    { startTime: '07:00', endTime: '11:00' },
    { startTime: '08:00', endTime: '14:00' }
  ], 3);
  assert.equal(hours, 10);
});

test('calculateQuote — shift planner labour', function() {
  var config = {
    business: { gstRegistered: false },
    labour: {
      label: 'Barista labour',
      hourlyCents: 7500,
      minimumHours: 3,
      allowShiftPlanner: true,
      minimumHoursPerShift: 3
    },
    products: [{ id: 'cart', label: 'Cart', baseCents: 0, baristasIncluded: 1 }],
    beverages: []
  };
  var result = calculateQuote(config, {
    productId: 'cart',
    labourPlanning: 'shifts',
    shifts: [
      { date: '2026-08-01', startTime: '07:00', endTime: '11:00' },
      { date: '2026-08-02', startTime: '08:00', endTime: '14:00' }
    ]
  });
  var labour = result.breakdown.find(function(r) { return r.kind === 'labour'; });
  assert.equal(labour.quantity, 10);
  assert.equal(labour.totalCents, 75000);
});

test('calculateQuote — multi-cart with extra barista per cart', function() {
  var config = {
    business: { gstRegistered: false },
    labour: {
      hourlyCents: 7500,
      minimumHours: 3,
      extraBarista: { enabled: true, hourlyCents: 7500 }
    },
    products: [
      { id: 'cart-a', label: 'Cart A', baseCents: 10000, baristasIncluded: 1 },
      { id: 'cart-b', label: 'Cart B', baseCents: 20000, baristasIncluded: 1 }
    ],
    beverages: []
  };
  var result = calculateQuote(config, {
    labourPlanning: 'hours',
    hours: 3,
    carts: [
      { productId: 'cart-a', quantity: 1, extraBaristas: 1 },
      { productId: 'cart-b', quantity: 1, extraBaristas: 0 }
    ]
  });
  var labourRows = result.breakdown.filter(function(r) { return r.kind === 'labour'; });
  assert.equal(labourRows.length, 3);
  assert.equal(labourRows[0].totalCents, 22500);
  assert.equal(labourRows[1].totalCents, 22500);
  assert.equal(labourRows[2].totalCents, 22500);
  assert.equal(result.subtotalCents, 30000 + 67500);
});

test('normalizeCarts — legacy productId fallback', function() {
  assert.deepEqual(normalizeCarts({ productId: 'cart', extraBaristas: 1 }, []), [
    { productId: 'cart', quantity: 1, extraBaristas: 1 }
  ]);
});

test('calculateQuote — coffee cart 3hr minimum labour', function() {
  const result = calculateQuote(BEAN_CULTURE_QUOTE_CONFIG, {
    productId: 'coffee-cart',
    hours: 2,
    guestCount: 80,
    beverageId: 'espresso-package',
    addonIds: ['cup-branding'],
    travelZoneId: 'greater-sydney'
  });

  assert.equal(result.breakdown.length, 5);
  const labour = result.breakdown.find(function(r) { return r.id === 'labour'; });
  assert.equal(labour.quantity, 3);
  assert.equal(labour.unitCents, 7500);
  assert.equal(labour.totalCents, 22500);

  const equipment = result.breakdown.find(function(r) { return r.id === 'coffee-cart'; });
  assert.equal(equipment.totalCents, 45000);

  const beverage = result.breakdown.find(function(r) { return r.id === 'espresso-package'; });
  assert.equal(beverage.quantity, 30);
  assert.equal(beverage.totalCents, 10500);

  assert.equal(result.subtotalCents, 101500);
  assert.equal(result.gstCents, 10150);
  assert.equal(result.totalCents, 111650);
});

test('calculateQuote — no product yields labour-only if hours set', function() {
  const result = calculateQuote(BEAN_CULTURE_QUOTE_CONFIG, { hours: 5 });
  assert.equal(result.breakdown.length, 1);
  assert.equal(result.breakdown[0].totalCents, 37500);
});
