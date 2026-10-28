'use strict';

const { mulWeightRate } = require('./money');
const { applySpecial, specialSummary } = require('./specials');

/**
 * Pricing methods (product-level). Never invent a price for price_tbc / quote_required.
 */
const PRICING_METHODS = [
  'fixed',
  'per_unit',
  'per_weight',
  'estimated',
  'from_price',
  'price_tbc',
  'quote_required'
];

function isUnknownMethod(method) {
  return method === 'price_tbc' || method === 'quote_required';
}

/**
 * Compute line pricing at order time (requested values only).
 * @returns {{ priceStatus, unitPriceCents, lineKnownCents, displayLabel }}
 */
function priceLineAtOrder(product, qty, requestedWeightKg, extrasPerUnitCents, opts) {
  // A live special (product.options.special) prices the line when it is ordered.
  // Lines repriced from their stored unit price pass objects without options, so they keep that price.
  const sp = opts && opts.ignoreSpecial ? { product: product, special: null } : applySpecial(product, opts);
  const out = priceLineCore(sp.product, qty, requestedWeightKg, extrasPerUnitCents);
  if (sp.special) out.special = specialSummary(sp.special);
  return out;
}

function priceLineCore(product, qty, requestedWeightKg, extrasPerUnitCents) {
  const method = product.pricing_method || 'fixed';
  const quantity = Number(qty);
  const q = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  const weight = requestedWeightKg != null ? Number(requestedWeightKg) : null;
  // extras: cents per unit (number), or { flat, per_kg } where per_kg is charged on the weight (cooking).
  const ex = extrasPerUnitCents && typeof extrasPerUnitCents === 'object' ? extrasPerUnitCents : { flat: extrasPerUnitCents, per_kg: 0 };
  const extras = Number(ex.flat) || 0;
  const perKgExtra = Number(ex.per_kg) || 0;

  if (method === 'price_tbc' || method === 'quote_required') {
    return {
      priceStatus: method === 'quote_required' ? 'quote_required' : 'tbc',
      unitPriceCents: product.price_per_kg_cents || product.price_cents || null,
      lineKnownCents: extras > 0 ? Math.round(extras * q) : null,
      displayLabel: method === 'quote_required' ? 'Quote required' : 'Price TBC',
      extrasPerUnitCents: extras
    };
  }

  if (method === 'per_weight') {
    const rate = product.price_per_kg_cents;
    if (rate == null) {
      return {
        priceStatus: 'tbc',
        unitPriceCents: null,
        lineKnownCents: extras > 0 ? Math.round(extras * q) : null,
        displayLabel: 'Price TBC',
        extrasPerUnitCents: extras
      };
    }
    if (weight != null && Number.isFinite(weight) && weight > 0) {
      const line = mulWeightRate(weight, rate) + mulWeightRate(weight, perKgExtra) + Math.round(extras * q);
      return {
        priceStatus: 'estimated',
        unitPriceCents: rate,
        lineKnownCents: line,
        displayLabel: 'Est. from approx. weight',
        extrasPerUnitCents: extras
      };
    }
    return {
      priceStatus: 'tbc',
      unitPriceCents: rate,
      lineKnownCents: extras > 0 ? Math.round(extras * q) : null,
      displayLabel: 'Final price TBC after preparation',
      extrasPerUnitCents: extras
    };
  }

  if (method === 'per_unit' || method === 'fixed') {
    const unit = product.price_cents;
    if (unit == null) {
      return {
        priceStatus: 'tbc',
        unitPriceCents: null,
        lineKnownCents: extras > 0 ? Math.round(extras * q) : null,
        displayLabel: 'Price TBC',
        extrasPerUnitCents: extras
      };
    }
    const unitWithExtras = unit + extras;
    return {
      priceStatus: 'known',
      unitPriceCents: unitWithExtras,
      lineKnownCents: Math.round(unitWithExtras * q),
      displayLabel: extras > 0 ? 'Includes options' : null,
      extrasPerUnitCents: extras
    };
  }

  if (method === 'estimated' || method === 'from_price') {
    const unit = product.price_cents;
    const unitWithExtras = unit != null ? unit + extras : null;
    return {
      priceStatus: 'estimated',
      unitPriceCents: unitWithExtras,
      lineKnownCents: unitWithExtras != null ? Math.round(unitWithExtras * q) : null,
      displayLabel: method === 'from_price' ? 'From price' : 'Approx. price',
      extrasPerUnitCents: extras
    };
  }

  return {
    priceStatus: 'tbc',
    unitPriceCents: null,
    lineKnownCents: extras > 0 ? Math.round(extras * q) : null,
    displayLabel: 'Price TBC',
    extrasPerUnitCents: extras
  };
}

/**
 * Finalise a weight-based (or TBC) line after staff enter actual weight.
 */
function finaliseWeightLine(item, actualWeightKg, rateCentsPerKg) {
  const weight = Number(actualWeightKg);
  const rate =
    rateCentsPerKg != null ? Number(rateCentsPerKg) : Number(item.unit_price_cents);
  if (!Number.isFinite(weight) || weight < 0) {
    throw new Error('invalid_weight');
  }
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error('invalid_rate');
  }
  // Options stay on the final price: flat extras per unit (e.g. glaze) and per-kg extras (cooking).
  const { lineOptionExtras } = require('./product-options');
  const ex = lineOptionExtras(item);
  const qty = Math.max(1, Number(item.quantity) || 1);
  const line = mulWeightRate(weight, rate) + mulWeightRate(weight, ex.per_kg) + Math.round(ex.flat * qty);
  return {
    actual_weight_kg: weight,
    unit_price_cents: rate,
    line_final_cents: line,
    price_status: 'finalised'
  };
}

/** Weight range from a product name like "HAM - Half 3.5-4" or "Whole 4-4.8 kg" → { low, high } kg, or null. */
function nameWeightRangeKg(name) {
  const m = /(\d+(?:\.\d+)?)\s*(?:kg)?\s*[-–]\s*(\d+(?:\.\d+)?)\s*(?:kg)?\b/i.exec(String(name || ''));
  if (!m) return null;
  const low = Number(m[1]);
  const high = Number(m[2]);
  if (!(low > 0 && high > low && high < 40)) return null;
  return { low: low, high: high };
}

/**
 * Price range for a line not weighed yet: (rate + per-kg extras) × weight range × qty + flat extras.
 * Weight range: the product name's range per unit (e.g. 3.5–4 kg), else null (no range).
 * @param {{name, pricing_method, rate_cents, quantity, extras:{flat, per_kg}}} l
 * @returns {{low_cents, high_cents, low_kg, high_kg, per_kg_extra_low_cents, per_kg_extra_high_cents}|null}
 */
function estimateRange(l) {
  if (!l || l.pricing_method !== 'per_weight' || l.rate_cents == null) return null;
  const r = nameWeightRangeKg(l.name);
  if (!r) return null;
  const q = Math.max(1, Math.round(Number(l.quantity) || 1));
  const ex = l.extras || { flat: 0, per_kg: 0 };
  const flat = Math.round((Number(ex.flat) || 0) * q);
  const perKg = Number(ex.per_kg) || 0;
  return {
    low_kg: r.low * q,
    high_kg: r.high * q,
    low_cents: mulWeightRate(r.low * q, l.rate_cents) + mulWeightRate(r.low * q, perKg) + flat,
    high_cents: mulWeightRate(r.high * q, l.rate_cents) + mulWeightRate(r.high * q, perKg) + flat,
    per_kg_extra_low_cents: perKg ? mulWeightRate(r.low * q, perKg) : 0,
    per_kg_extra_high_cents: perKg ? mulWeightRate(r.high * q, perKg) : 0
  };
}

/** Cooking (per-kg option) cents on a line's known weight: actual, or requested when estimated. */
function lineCookingCents(item) {
  const { lineOptionExtras } = require('./product-options');
  const perKg = lineOptionExtras(item).per_kg;
  if (!perKg) return null;
  const w = item.actual_weight_kg != null ? Number(item.actual_weight_kg)
    : item.price_status === 'estimated' && item.requested_weight_kg != null ? Number(item.requested_weight_kg) : null;
  return w > 0 ? mulWeightRate(w, perKg) : null;
}

/** Range for a stored cart / order line (null once weighed or when no weight range is known). */
function lineEstimateRange(item) {
  if (!item || item.actual_weight_kg != null || item.price_status === 'finalised') return null;
  const snap = item.product_snapshot || {};
  if (snap.stock_piece) return null;
  const { lineOptionExtras } = require('./product-options');
  return estimateRange({
    name: item.product_name || snap.name,
    pricing_method: item.pricing_method || snap.pricing_method,
    rate_cents: item.unit_price_cents != null ? item.unit_price_cents : snap.price_per_kg_cents,
    quantity: item.quantity,
    extras: lineOptionExtras(item)
  });
}

/**
 * Aggregate order totals from items.
 */
function computeOrderTotals(items) {
  let known = 0;
  let estimated = 0;
  let hasUnknown = false;
  let allFinal = items.length > 0;
  let anyEstimated = false;

  (items || []).forEach(function (it) {
    const status = it.price_status || 'known';
    if (status === 'tbc' || status === 'quote_required') {
      hasUnknown = true;
      allFinal = false;
      return;
    }
    if (status === 'finalised' && it.line_final_cents != null) {
      known += Number(it.line_final_cents) || 0;
      return;
    }
    if (status === 'estimated') {
      anyEstimated = true;
      allFinal = false;
      if (it.line_known_cents != null) estimated += Number(it.line_known_cents) || 0;
      return;
    }
    if (it.line_known_cents != null) known += Number(it.line_known_cents) || 0;
    else allFinal = false;
  });

  const knownSubtotal = known;
  const estimatedSubtotal = anyEstimated ? known + estimated : null;
  let priceStatus = 'known';
  if (hasUnknown) priceStatus = knownSubtotal > 0 ? 'partial' : 'tbc';
  else if (anyEstimated) priceStatus = 'partial';
  if (allFinal && !hasUnknown && !anyEstimated) priceStatus = 'finalised';

  return {
    known_subtotal_cents: knownSubtotal,
    estimated_subtotal_cents: estimatedSubtotal,
    final_subtotal_cents: allFinal && !hasUnknown ? knownSubtotal : null,
    has_unknown_prices: hasUnknown || anyEstimated,
    price_status: priceStatus
  };
}

module.exports = {
  lineCookingCents,
  nameWeightRangeKg,
  estimateRange,
  lineEstimateRange,
  PRICING_METHODS,
  isUnknownMethod,
  priceLineAtOrder,
  finaliseWeightLine,
  computeOrderTotals
};
