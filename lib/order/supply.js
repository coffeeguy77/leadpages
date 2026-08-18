'use strict';

/**
 * Supply requirements aggregation — confirmed orders only by default.
 */

function aggregateSupply(ordersWithItems, opts) {
  opts = opts || {};
  const includeAwaitingDeposit = !!opts.includeAwaitingDeposit;
  const byProduct = {};

  (ordersWithItems || []).forEach(function (ord) {
    const st = ord.status;
    if (st === 'cancelled' || st === 'refunded' || st === 'draft') return;
    if (st === 'awaiting_deposit' && !includeAwaitingDeposit) return;
    if (!includeAwaitingDeposit && st !== 'confirmed' && st !== 'changes_open' && st !== 'locked' &&
        st !== 'in_preparation' && st !== 'ready' && st !== 'collected' && st !== 'completed') {
      // still allow confirmed-ish statuses above; skip unknown
    }

    (ord.items || []).forEach(function (it) {
      const key = it.product_id || ('name:' + (it.product_name || 'unknown'));
      if (!byProduct[key]) {
        byProduct[key] = {
          product_id: it.product_id || null,
          product_name: it.product_name,
          product_sku: it.product_sku || null,
          unit_label: it.unit_label || null,
          quantity: 0,
          requested_weight_kg: 0,
          actual_weight_kg: 0,
          order_count: 0,
          has_weight: false
        };
      }
      const row = byProduct[key];
      row.quantity += Number(it.quantity) || 0;
      if (it.requested_weight_kg != null) {
        row.requested_weight_kg += Number(it.requested_weight_kg) || 0;
        row.has_weight = true;
      }
      if (it.actual_weight_kg != null) {
        row.actual_weight_kg += Number(it.actual_weight_kg) || 0;
        row.has_weight = true;
      }
      row.order_count += 1;
    });
  });

  return Object.keys(byProduct)
    .map(function (k) {
      return byProduct[k];
    })
    .sort(function (a, b) {
      return String(a.product_name).localeCompare(String(b.product_name));
    });
}

module.exports = { aggregateSupply };
