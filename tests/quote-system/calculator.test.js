const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateQuote } = require('../../lib/quote-system/calculator');
const { BEAN_CULTURE_QUOTE_CONFIG } = require('../../lib/quote-system/bean-culture-config');
const { serializeQuoteResult } = require('../../lib/quote-system/serializers');
const { RESPONSE_LEVEL } = require('../../lib/quote-system/constants');

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

test('serializeQuoteResult — public hides totals', function() {
  const calc = { totalCents: 111650, subtotalCents: 101500, gstCents: 10150, breakdown: [] };
  const pub = serializeQuoteResult(calc, RESPONSE_LEVEL.PUBLIC_PROGRESS);
  assert.equal(pub.hasQuote, true);
  assert.equal(pub.totalCents, undefined);

  const email = serializeQuoteResult(calc, RESPONSE_LEVEL.EMAIL_VERIFIED_TOTAL);
  assert.equal(email.totalCents, 111650);
  assert.equal(email.breakdown, undefined);

  const full = serializeQuoteResult(calc, RESPONSE_LEVEL.FULLY_VERIFIED_QUOTE);
  assert.equal(full.breakdown, calc.breakdown);
  assert.equal(full.totalCents, 111650);
});

test('bean culture config has three equipment types', function() {
  assert.equal(BEAN_CULTURE_QUOTE_CONFIG.products.length, 3);
  assert.equal(BEAN_CULTURE_QUOTE_CONFIG.labour.minimumHours, 3);
  assert.equal(BEAN_CULTURE_QUOTE_CONFIG.labour.hourlyCents, 7500);
});
