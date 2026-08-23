'use strict';

const { priceLineAtOrder } = require('./pricing');
const { optionExtrasPerUnitCents, resolveRequestedWeightKg } = require('./product-options');
const { minimumKg, defaultWeightKg } = require('./product-weight');
const { productHasGst } = require('./gst');

const BLOCKED_STATUSES = ['cancelled', 'archived', 'completed', 'refunded'];

function assertOrderItemsEditable(order) {
  if (!order) throw Object.assign(new Error('not_found'), { code: 404 });
  if (BLOCKED_STATUSES.indexOf(order.status) >= 0) {
    throw Object.assign(new Error('order_not_editable'), { code: 400 });
  }
}

function buildOrderItemRow(line, product, site, gstSettings, questionsByProduct, sortOrder) {
  const snapProduct = product || {
    name: line.product_name || 'Custom item',
    pricing_method: line.pricing_method || 'fixed',
    price_cents: line.unit_price_cents,
    price_per_kg_cents: line.unit_price_cents,
    sku: line.sku || null,
    unit_label: line.unit_label || null
  };
  const qty = line.quantity != null ? line.quantity : 1;
  let reqWeight = line.requested_weight_kg;
  if (product && (reqWeight == null || reqWeight === '')) {
    const minK = minimumKg(product) || defaultWeightKg(product);
    if (minK != null) reqWeight = minK;
  }
  if (product) {
    reqWeight = resolveRequestedWeightKg(product, qty, reqWeight);
  }
  const lineQuestions = product ? questionsByProduct[product.id] || [] : [];
  const extras = optionExtrasPerUnitCents(lineQuestions, line.answers || {});
  const priced = priceLineAtOrder(snapProduct, qty, reqWeight, extras.extra_cents);
  const includesGst = product ? productHasGst(product, gstSettings) : false;
  return {
    site_id: site.id,
    product_id: product ? product.id : null,
    product_name: snapProduct.name || (product && product.name),
    product_sku: snapProduct.sku || (product && product.sku) || null,
    pricing_method: snapProduct.pricing_method || (product && product.pricing_method) || 'fixed',
    unit_label: snapProduct.unit_label || (product && product.unit_label) || null,
    quantity: qty,
    requested_weight_kg: reqWeight != null ? reqWeight : null,
    unit_price_cents: priced.unitPriceCents,
    line_known_cents: priced.lineKnownCents,
    price_status: priced.priceStatus,
    notes: line.notes || null,
    options_snapshot: line.options || { selected: extras.selected },
    product_snapshot: product
      ? {
          id: product.id,
          name: product.name,
          sku: product.sku,
          pricing_method: product.pricing_method,
          price_cents: product.price_cents,
          price_per_kg_cents: product.price_per_kg_cents,
          cutoff_mode: product.cutoff_mode,
          lead_time_mode: product.lead_time_mode,
          lead_time_value: product.lead_time_value,
          category_id: product.category_id,
          options: product.options || {},
          selected_options: extras.selected,
          includes_gst: includesGst
        }
      : { custom: true, name: snapProduct.name, includes_gst: false },
    sort_order: sortOrder
  };
}

module.exports = {
  BLOCKED_STATUSES,
  assertOrderItemsEditable,
  buildOrderItemRow
};
