'use strict';

/**
 * Supply requirements aggregation — confirmed orders only by default.
 * Product Allocation groups lines by product + variation for packing checklists.
 */

function isActiveOrderStatus(st, includeAwaitingDeposit) {
  if (st === 'cancelled' || st === 'refunded' || st === 'draft') return false;
  if (st === 'awaiting_deposit' && !includeAwaitingDeposit) return false;
  return true;
}

function variationLabelFromItem(it) {
  const snap = (it && it.product_snapshot) || {};
  let opts = snap.selected_options || snap.options || null;
  if (!opts || (Array.isArray(opts) && !opts.length)) {
    const os = (it && it.options_snapshot) || {};
    opts = os.selected || os.selected_options || null;
  }
  if (!Array.isArray(opts) || !opts.length) return '';
  return opts
    .map(function (o) {
      if (!o) return '';
      if (typeof o === 'string') return String(o).trim();
      var q = o.question ? String(o.question).trim() + ': ' : '';
      var label = o.label || o.value || '';
      return (q + String(label)).trim();
    })
    .filter(Boolean)
    .join(' · ');
}

function allocationGroupKey(it) {
  const pid = it.product_id || ('name:' + (it.product_name || 'unknown'));
  const variation = variationLabelFromItem(it);
  return pid + '||' + variation;
}

function aggregateSupply(ordersWithItems, opts) {
  opts = opts || {};
  const includeAwaitingDeposit = !!opts.includeAwaitingDeposit;
  const byProduct = {};

  (ordersWithItems || []).forEach(function (ord) {
    const st = ord.status;
    if (!isActiveOrderStatus(st, includeAwaitingDeposit)) return;

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

/**
 * Per product+variation allocation with customer/order line detail for packing.
 * @returns {{ groups: object[], totals: { lines: number, packed: number, quantity: number } }}
 */
function aggregateAllocation(ordersWithItems, opts) {
  opts = opts || {};
  const includeAwaitingDeposit = !!opts.includeAwaitingDeposit;
  const byGroup = {};

  (ordersWithItems || []).forEach(function (ord) {
    if (!isActiveOrderStatus(ord.status, includeAwaitingDeposit)) return;

    (ord.items || []).forEach(function (it) {
      const key = allocationGroupKey(it);
      const variation = variationLabelFromItem(it);
      if (!byGroup[key]) {
        byGroup[key] = {
          key: key,
          product_id: it.product_id || null,
          product_name: it.product_name,
          product_sku: it.product_sku || null,
          variation_label: variation,
          unit_label: it.unit_label || null,
          quantity: 0,
          requested_weight_kg: 0,
          actual_weight_kg: 0,
          has_weight: false,
          line_count: 0,
          packed_count: 0,
          lines: []
        };
      }
      const g = byGroup[key];
      const qty = Number(it.quantity) || 0;
      g.quantity += qty;
      g.line_count += 1;
      if (it.packed) g.packed_count += 1;
      if (it.requested_weight_kg != null) {
        g.requested_weight_kg += Number(it.requested_weight_kg) || 0;
        g.has_weight = true;
      }
      if (it.actual_weight_kg != null) {
        g.actual_weight_kg += Number(it.actual_weight_kg) || 0;
        g.has_weight = true;
      }
      g.lines.push({
        order_item_id: it.id,
        order_id: ord.id,
        order_number: ord.order_number,
        customer_name: ord.customer_name || '',
        customer_phone: ord.customer_phone || '',
        status: ord.status,
        pickup_window_start: ord.pickup_window_start || null,
        pickup_window_end: ord.pickup_window_end || null,
        quantity: qty,
        requested_weight_kg: it.requested_weight_kg != null ? Number(it.requested_weight_kg) : null,
        actual_weight_kg: it.actual_weight_kg != null ? Number(it.actual_weight_kg) : null,
        notes: it.notes || null,
        customer_notes: ord.customer_notes || null,
        packed: !!it.packed,
        packed_at: it.packed_at || null,
        is_important: !!ord.is_important
      });
    });
  });

  const groups = Object.keys(byGroup)
    .map(function (k) {
      const g = byGroup[k];
      g.lines.sort(function (a, b) {
        var na = String(a.customer_name || '').toLowerCase();
        var nb = String(b.customer_name || '').toLowerCase();
        if (na !== nb) return na.localeCompare(nb);
        return String(a.order_number || '').localeCompare(String(b.order_number || ''));
      });
      return g;
    })
    .sort(function (a, b) {
      var pn = String(a.product_name).localeCompare(String(b.product_name));
      if (pn !== 0) return pn;
      return String(a.variation_label || '').localeCompare(String(b.variation_label || ''));
    });

  var totals = { lines: 0, packed: 0, quantity: 0 };
  groups.forEach(function (g) {
    totals.lines += g.line_count;
    totals.packed += g.packed_count;
    totals.quantity += g.quantity;
  });

  return { groups: groups, totals: totals };
}

module.exports = {
  aggregateSupply,
  aggregateAllocation,
  variationLabelFromItem,
  allocationGroupKey
};
