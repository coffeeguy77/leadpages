'use strict';

/**
 * Price display setting: "Show kg prices only (no estimates)".
 *
 *   order_systems.settings.price_display.kg_only = true
 *
 * When on, a per-kg line that hasn't been weighed shows its $/kg rate instead of an
 * estimated dollar amount or range, everywhere (shop, customer page, staff screens, prints).
 * Display only: prices, totals and deposits are calculated exactly as before. Known totals
 * already leave estimated lines out, so nothing else changes.
 */

function kgPricesOnly(system) {
  const s = (system && system.settings) || {};
  return !!(s.price_display && s.price_display.kg_only === true);
}

/** True when this line's dollar amount is only an estimate (not weighed / not final). */
function isEstimateOnlyLine(item) {
  if (!item) return false;
  if (item.line_final_cents != null || item.actual_weight_kg != null) return false;
  if (item.price_status === 'finalised' || item.price_status === 'final') return false;
  if (item.price_status === 'estimated' || item.est_range) return true;
  // A per-kg line with no weight yet ("TBC") also just shows its $/kg.
  const method = item.pricing_method || (item.product_snapshot && item.product_snapshot.pricing_method);
  return method === 'per_weight' && item.unit_price_cents != null &&
    (item.price_status === 'tbc' || item.price_status === 'pending_weight');
}

/**
 * Strip estimate figures from a line for kg-only display. Weighed / known lines are unchanged.
 * Adds `kg_only_rate: true` so screens know to show the $/kg rate in the amount column.
 */
function stripEstimate(item) {
  if (!item) return item;
  const est = isEstimateOnlyLine(item);
  const out = Object.assign({}, item, { est_range: null });
  if (est) {
    out.kg_only_rate = true;
    out.cooking_cents = null;
  }
  return out;
}

function applyKgOnly(system, items) {
  if (!kgPricesOnly(system)) return items;
  return (items || []).map(stripEstimate);
}

module.exports = { kgPricesOnly, isEstimateOnlyLine, stripEstimate, applyKgOnly };
