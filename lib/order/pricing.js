'use strict';

const { mulWeightRate } = require('./money');

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
function priceLineAtOrder(product, qty, requestedWeightKg) {
  const method = product.pricing_method || 'fixed';
  const quantity = Number(qty);
  const q = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  const weight = requestedWeightKg != null ? Number(requestedWeightKg) : null;

  if (method === 'price_tbc' || method === 'quote_required') {
    return {
      priceStatus: method === 'quote_required' ? 'quote_required' : 'tbc',
      unitPriceCents: product.price_per_kg_cents || product.price_cents || null,
      lineKnownCents: null,
      displayLabel: method === 'quote_required' ? 'Quote required' : 'Price TBC'
    };
  }

  if (method === 'per_weight') {
    const rate = product.price_per_kg_cents;
    if (rate == null) {
      return { priceStatus: 'tbc', unitPriceCents: null, lineKnownCents: null, displayLabel: 'Price TBC' };
    }
    if (weight != null && Number.isFinite(weight) && weight > 0) {
      const line = mulWeightRate(weight, rate);
      return {
        priceStatus: 'estimated',
        unitPriceCents: rate,
        lineKnownCents: line,
        displayLabel: 'Est. from approx. weight'
      };
    }
    return {
      priceStatus: 'tbc',
      unitPriceCents: rate,
      lineKnownCents: null,
      displayLabel: 'Final price TBC after preparation'
    };
  }

  if (method === 'per_unit' || method === 'fixed') {
    const unit = product.price_cents;
    if (unit == null) {
      return { priceStatus: 'tbc', unitPriceCents: null, lineKnownCents: null, displayLabel: 'Price TBC' };
    }
    return {
      priceStatus: 'known',
      unitPriceCents: unit,
      lineKnownCents: Math.round(unit * q),
      displayLabel: null
    };
  }

  if (method === 'estimated' || method === 'from_price') {
    const unit = product.price_cents;
    return {
      priceStatus: 'estimated',
      unitPriceCents: unit,
      lineKnownCents: unit != null ? Math.round(unit * q) : null,
      displayLabel: method === 'from_price' ? 'From price' : 'Approx. price'
    };
  }

  return { priceStatus: 'tbc', unitPriceCents: null, lineKnownCents: null, displayLabel: 'Price TBC' };
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
  const line = mulWeightRate(weight, rate);
  return {
    actual_weight_kg: weight,
    unit_price_cents: rate,
    line_final_cents: line,
    price_status: 'finalised'
  };
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
  PRICING_METHODS,
  isUnknownMethod,
  priceLineAtOrder,
  finaliseWeightLine,
  computeOrderTotals
};
