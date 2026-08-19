'use strict';

const assert = require('assert');
const { priceLineAtOrder, computeOrderTotals, finaliseWeightLine } = require('../lib/order/pricing');
const { effectiveOrderCutoff, earliestPickupDate, editingStateFor } = require('../lib/order/cutoff');
const { resolvePaymentRule, computeDepositRequired } = require('../lib/order/deposit');
const { mulWeightRate, formatAud } = require('../lib/order/money');
const { aggregateSupply } = require('../lib/order/supply');

function testPricing() {
  const tbc = priceLineAtOrder({ pricing_method: 'price_tbc' }, 4, 1.2);
  assert.strictEqual(tbc.priceStatus, 'tbc');
  assert.strictEqual(tbc.lineKnownCents, null);

  const perKg = priceLineAtOrder({ pricing_method: 'per_weight', price_per_kg_cents: 5499 }, 4, 1.2);
  assert.strictEqual(perKg.priceStatus, 'estimated');
  assert.strictEqual(perKg.lineKnownCents, mulWeightRate(1.2, 5499));

  const fixed = priceLineAtOrder({ pricing_method: 'fixed', price_cents: 1200 }, 2);
  assert.strictEqual(fixed.lineKnownCents, 2400);

  const fin = finaliseWeightLine({ unit_price_cents: 5499 }, 1.34, 5499);
  assert.strictEqual(fin.line_final_cents, mulWeightRate(1.34, 5499));
  assert.strictEqual(fin.price_status, 'finalised');

  const totals = computeOrderTotals([
    { price_status: 'known', line_known_cents: 3500 },
    { price_status: 'tbc' },
    { price_status: 'tbc' }
  ]);
  assert.strictEqual(totals.known_subtotal_cents, 3500);
  assert.strictEqual(totals.has_unknown_prices, true);
  assert.strictEqual(totals.price_status, 'partial');
  console.log('pricing ok', formatAud(totals.known_subtotal_cents));
}

function testDeposit() {
  const system = { payment_rule: 'fixed_deposit', deposit_amount_cents: 5000, deposit_scope: 'per_order' };
  const rule = resolvePaymentRule({ system: system });
  const dep = computeDepositRequired(rule, { known_subtotal_cents: 3500, has_unknown_prices: true });
  assert.strictEqual(dep.deposit_required_cents, 5000);
  console.log('deposit ok');
}

function testCutoff() {
  const system = {
    timezone: 'Australia/Sydney',
    default_cutoff_mode: 'days_before',
    default_cutoff_value: 3,
    default_cutoff_time: '17:00'
  };
  const products = [
    { id: '1', name: 'Steak', cutoff_mode: 'days_before', cutoff_value: 1 },
    { id: '2', name: 'Whole pig', cutoff_mode: 'days_before', cutoff_value: 7 },
    { id: '3', name: 'Sauce', cutoff_mode: 'none' }
  ];
  const eff = effectiveOrderCutoff(products, system, '2026-08-29');
  assert.ok(eff.effective_cutoff_at);
  assert.ok(/Whole pig|7/.test(eff.cutoff_reason || ''));
  assert.strictEqual(editingStateFor('2000-01-01T00:00:00.000Z'), 'locked');
  const earliest = earliestPickupDate('Australia/Sydney', [
    { lead_time_mode: 'days', lead_time_value: 3 }
  ]);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(earliest));
  console.log('cutoff ok', eff.cutoff_reason, earliest);
}

function testSupply() {
  const lines = aggregateSupply([
    {
      status: 'confirmed',
      items: [
        { product_id: 'a', product_name: 'Rib Eye', quantity: 4, requested_weight_kg: 1.2 },
        { product_id: 'b', product_name: 'Sauce', quantity: 2 }
      ]
    },
    {
      status: 'awaiting_deposit',
      items: [{ product_id: 'a', product_name: 'Rib Eye', quantity: 10 }]
    },
    {
      status: 'cancelled',
      items: [{ product_id: 'a', product_name: 'Rib Eye', quantity: 99 }]
    }
  ]);
  const rib = lines.find(function (l) {
    return l.product_name === 'Rib Eye';
  });
  assert.strictEqual(rib.quantity, 4);
  console.log('supply ok');
}

testPricing();
testDeposit();
testCutoff();
testSupply();
console.log('All order engine unit tests passed');
