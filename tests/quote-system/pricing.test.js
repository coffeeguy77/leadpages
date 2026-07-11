const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveTierRate,
  billableShiftHours,
  normalizeCarts,
  eventBillableHours,
  cartEventHours
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

test('normalizeCarts — clamps quantity to product maxQuantity', function() {
  var products = [{ id: 'cart', allowQuantity: true, maxQuantity: 3, baristasIncluded: 1 }];
  assert.deepEqual(normalizeCarts({
    carts: [{ productId: 'cart', quantity: 10 }]
  }, products), [
    { productId: 'cart', quantity: 3, hours: null, baristas: 1, extraBaristaMode: 'none', splitHours: 4, extraBaristas: 0 }
  ]);
});

test('cartEventHours — custom per-cart hours in simple mode', function() {
  var labour = { minimumHours: 3, allowShiftPlanner: true };
  var inp = { labourPlanning: 'hours', hours: 6, eventConfigMode: 'custom' };
  assert.equal(cartEventHours({ hours: 4 }, inp, labour), 4);
  assert.equal(cartEventHours({ hours: 2 }, inp, labour), 3);
  assert.equal(cartEventHours({ hours: 8 }, { labourPlanning: 'hours', hours: 6, eventConfigMode: 'same' }, labour), 6);
});

test('calculateQuote — custom per-cart barista 1 hours', function() {
  var config = {
    business: { gstRegistered: false },
    labour: {
      hourlyCents: 7500,
      minimumHours: 3,
      extraBarista: { enabled: true, hourlyCents: 7500 }
    },
    products: [
      { id: 'cart-a', label: 'Cart A', baseCents: 0, baristasIncluded: 1 },
      { id: 'cart-b', label: 'Cart B', baseCents: 0, baristasIncluded: 1 }
    ],
    beverages: []
  };
  var result = calculateQuote(config, {
    labourPlanning: 'hours',
    hours: 6,
    eventConfigMode: 'custom',
    carts: [
      { productId: 'cart-a', quantity: 1, hours: 6, baristas: 1 },
      { productId: 'cart-b', quantity: 1, hours: 3, baristas: 1 }
    ]
  });
  var labourRows = result.breakdown.filter(function(r) { return r.kind === 'labour'; });
  assert.equal(labourRows.length, 2);
  assert.equal(labourRows.find(function(r) { return r.productId === 'cart-a'; }).quantity, 6);
  assert.equal(labourRows.find(function(r) { return r.productId === 'cart-b'; }).quantity, 3);
});

test('normalizeCarts — legacy productId fallback', function() {
  assert.deepEqual(normalizeCarts({ productId: 'cart', extraBaristas: 1 }, []), [
    { productId: 'cart', quantity: 1, hours: null, baristas: 2, extraBaristaMode: 'full', splitHours: 4, extraBaristas: 1 }
  ]);
});

test('calculateQuote — split-shift extra barista at $100/hr', function() {
  var config = {
    business: { gstRegistered: false },
    labour: {
      hourlyCents: 7500,
      minimumHours: 3,
      extraBarista: {
        enabled: true,
        hourlyCents: 7500,
        splitShift: { enabled: true, hourlyCents: 10000, minimumHours: 3, defaultHours: 4 }
      }
    },
    products: [{ id: 'cart', label: 'Cart', baseCents: 0, baristasIncluded: 1 }],
    beverages: []
  };
  var result = calculateQuote(config, {
    labourPlanning: 'hours',
    hours: 6,
    carts: [{ productId: 'cart', quantity: 1, baristas: 2, extraBaristaMode: 'split', splitHours: 4 }]
  });
  var base = result.breakdown.find(function(r) { return r.baristaRole === 'base'; });
  var split = result.breakdown.find(function(r) { return r.extraBaristaMode === 'split'; });
  assert.equal(base.quantity, 6);
  assert.equal(base.unitCents, 7500);
  assert.equal(split.quantity, 4);
  assert.equal(split.unitCents, 10000);
  assert.equal(split.totalCents, 40000);
});

test('nextShiftFromPrevious — copies hours on next calendar day', function() {
  var shifts = [{ date: '2026-08-01', startTime: '07:00', endTime: '15:00' }];
  var next = (function(shifts) {
    function nextCalendarDay(dateStr) {
      if (!dateStr) return '';
      var d = new Date(dateStr + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    }
    var prev = shifts[shifts.length - 1];
    return { date: nextCalendarDay(prev.date), startTime: prev.startTime, endTime: prev.endTime };
  })(shifts);
  assert.equal(next.date, '2026-08-02');
  assert.equal(next.startTime, '07:00');
  assert.equal(next.endTime, '15:00');
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
