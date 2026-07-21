const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  resolveBeverageLines,
  beverageMinQuantity,
  clampBeverageQuantity
} = require('../../lib/quote-system/pricing');
const { normalizeQuoteConfig } = require('../../lib/quote-system/normalize-quote-config');
const { publicProductLabels } = require('../../lib/quote-system/serializers');
const { calculateQuote } = require('../../lib/quote-system/calculator');

const root = path.join(__dirname, '../..');

test('beverageMinQuantity / clampBeverageQuantity', function() {
  assert.equal(beverageMinQuantity({ minQuantity: 20 }), 20);
  assert.equal(beverageMinQuantity({ minQuantity: 0 }), 0);
  assert.equal(beverageMinQuantity({}), 0);
  assert.equal(clampBeverageQuantity({ minQuantity: 20 }, 5), 20);
  assert.equal(clampBeverageQuantity({ minQuantity: 20 }, 0), 0);
  assert.equal(clampBeverageQuantity({ minQuantity: 20 }, 25), 25);
});

test('resolveBeverageLines enforces minQuantity when beverages provided', function() {
  const bevs = [
    { id: 'tray', label: 'Sandwich tray', minQuantity: 20 },
    { id: 'hot', label: 'Hot coffee', minQuantity: null }
  ];
  assert.deepEqual(
    resolveBeverageLines({
      beverageLines: [
        { beverageId: 'tray', quantity: 8 },
        { beverageId: 'hot', quantity: 50 }
      ]
    }, bevs),
    [
      { beverageId: 'tray', quantity: 20 },
      { beverageId: 'hot', quantity: 50 }
    ]
  );
});

test('normalizeQuoteConfig + public shell expose minQuantity', function() {
  const cfg = normalizeQuoteConfig({
    beverages: [{ label: 'Catering tray', minQuantity: '12', pricingMode: 'per_head', perHeadCents: 800 }]
  });
  assert.equal(cfg.beverages[0].minQuantity, 12);
  const shell = publicProductLabels(cfg);
  assert.equal(shell.beverages[0].minQuantity, 12);
});

test('calculateQuote prices at min quantity when under-min line submitted', function() {
  const cfg = normalizeQuoteConfig({
    business: { gstRegistered: true },
    products: [{ id: 'cart', label: 'Cart', baseCents: 0, type: 'equipment' }],
    beverages: [{
      id: 'tray',
      label: 'Sandwich tray',
      pricingMode: 'per_head',
      perHeadCents: 1000,
      minQuantity: 10
    }],
    labour: { hourlyCents: 0, minimumHours: 0 },
    travel: { zones: [] },
    addons: []
  });
  const calc = calculateQuote(cfg, {
    productId: 'cart',
    hours: 3,
    beverageLines: [{ beverageId: 'tray', quantity: 4 }]
  });
  assert.equal(calc.inputs.beverageLines[0].quantity, 10);
  // 10 × $10 = $100 ex GST → $110 inc
  assert.equal(calc.subtotalCents, 10000);
});

test('builder + planning include min quantity UX', function() {
  const builder = fs.readFileSync(path.join(root, 'assets/lp-quote-builder.js'), 'utf8');
  const planning = fs.readFileSync(path.join(root, 'assets/lp-quote-planning.js'), 'utf8');
  const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
  assert.match(builder, /Min quantity \(optional\)/);
  assert.match(builder, /beverages\.\s*'\s*\+\s*i\s*\+\s*'\.minQuantity|minQuantity/);
  assert.match(planning, /beverageMinQty/);
  assert.match(planning, /defaultBeverageStartQty/);
  assert.match(planning, /data-bev-min/);
  assert.match(planning, /Min /);
  assert.match(manage, /oq-verify-portal-3/);
});
