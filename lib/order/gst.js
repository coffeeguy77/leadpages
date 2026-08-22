'use strict';

const { productCategoryIds } = require('./product-categories');

const GST_RATE_BPS = 1000; // 10%

/**
 * GST settings stored in order_systems.settings.gst
 * @returns {{ enabled: boolean, category_ids: string[] }}
 */
function parseGstSettings(system) {
  var raw = (system && system.settings && system.settings.gst) || {};
  var ids = Array.isArray(raw.category_ids) ? raw.category_ids : [];
  return {
    enabled: raw.enabled !== false,
    category_ids: ids
      .map(function (id) {
        return String(id || '').trim();
      })
      .filter(Boolean)
  };
}

function gstCategorySet(gstSettings) {
  var set = Object.create(null);
  (gstSettings.category_ids || []).forEach(function (id) {
    set[String(id)] = true;
  });
  return set;
}

/**
 * True when product primary or additional category is marked GST-inclusive.
 */
function productHasGst(product, gstSettings) {
  if (!product || !gstSettings || gstSettings.enabled === false) return false;
  var set = gstCategorySet(gstSettings);
  if (!Object.keys(set).length) return false;
  return productCategoryIds(product).some(function (id) {
    return !!set[String(id)];
  });
}

/** GST component from a tax-inclusive AUD price (10%). */
function gstFromInclusiveCents(cents) {
  var c = Number(cents) || 0;
  if (c <= 0) return 0;
  return Math.round((c * GST_RATE_BPS) / (10000 + GST_RATE_BPS));
}

function lineGstCents(item) {
  var snap = item.product_snapshot || {};
  if (snap.includes_gst === false) return 0;
  if (snap.includes_gst !== true) return 0;
  var line =
    item.line_final_cents != null
      ? Number(item.line_final_cents)
      : item.line_known_cents != null
        ? Number(item.line_known_cents)
        : 0;
  if (!line) return 0;
  return gstFromInclusiveCents(line);
}

function orderGstSummary(items) {
  var gstTotal = 0;
  var gstLines = 0;
  (items || []).forEach(function (it) {
    var g = lineGstCents(it);
    if (g > 0) {
      gstTotal += g;
      gstLines += 1;
    }
  });
  return { gst_included_cents: gstTotal, gst_line_count: gstLines };
}

function gstPriceSuffix(hasGst) {
  return hasGst ? ' inc. GST' : '';
}

module.exports = {
  GST_RATE_BPS,
  parseGstSettings,
  productHasGst,
  gstFromInclusiveCents,
  lineGstCents,
  orderGstSummary,
  gstPriceSuffix
};
