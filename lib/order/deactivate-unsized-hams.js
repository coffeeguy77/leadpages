'use strict';

/**
 * Deactivate duplicate ham products that have no size/weight in the name or short description.
 * Keeps sized SKUs like "HAM - HALF 3.5-4". Safe for reorders: inactive products are skipped
 * but past order line items still show the original product_name snapshot.
 */

const { parseSizeWeightKg } = require('./import-parse');

/** True when text includes a weight range, kg value, or numeric size band (e.g. 3.5-4). */
function textHasSizeOrWeight(text) {
  var hay = String(text || '').trim();
  if (!hay) return false;
  if (parseSizeWeightKg(hay) != null) return true;
  if (/\d+(?:\.\d+)?\s*[-–—]\s*\d+(?:\.\d+)?(?:\s*(?:kg|kgs?))?\b/i.test(hay)) return true;
  if (/\bsize\s*\d{2,3}\b/i.test(hay)) return true;
  return false;
}

function productHasSizeOrWeight(product) {
  if (!product) return false;
  return textHasSizeOrWeight(product.name) || textHasSizeOrWeight(product.short_description);
}

function isHamProduct(product) {
  return /\bham\b/i.test(String((product && product.name) || ''));
}

/** Active ham products with no size/weight — candidates for deactivation. */
function isUnsizedHamCandidate(product) {
  if (!product || product.active === false) return false;
  if (!isHamProduct(product)) return false;
  return !productHasSizeOrWeight(product);
}

async function deactivateUnsizedHamProducts(opts) {
  opts = opts || {};
  const { getAdmin } = require('./supabase');
  const admin = getAdmin();
  const siteId = opts.site_id;
  const systemId = opts.order_system_id;
  const dryRun = !!opts.dry_run;

  var query = admin
    .from('order_products')
    .select('id,name,short_description,active,category_id')
    .eq('active', true)
    .limit(10000);
  if (siteId) query = query.eq('site_id', siteId);
  if (systemId) query = query.eq('order_system_id', systemId);

  var { data: products, error } = await query;
  if (error) throw error;

  var stats = {
    scanned: 0,
    ham_total: 0,
    candidates: 0,
    deactivated: 0,
    kept_sized: 0,
    samples: []
  };

  for (var i = 0; i < (products || []).length; i++) {
    var p = products[i];
    stats.scanned += 1;
    if (!isHamProduct(p)) continue;
    stats.ham_total += 1;
    if (!isUnsizedHamCandidate(p)) {
      stats.kept_sized += 1;
      continue;
    }
    stats.candidates += 1;
    if (stats.samples.length < 20) {
      stats.samples.push({ id: p.id, name: p.name, short_description: p.short_description || null });
    }
    if (dryRun) continue;
    var { error: uErr } = await admin
      .from('order_products')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', p.id);
    if (uErr) throw uErr;
    stats.deactivated += 1;
  }

  return stats;
}

module.exports = {
  textHasSizeOrWeight: textHasSizeOrWeight,
  productHasSizeOrWeight: productHasSizeOrWeight,
  isHamProduct: isHamProduct,
  isUnsizedHamCandidate: isUnsizedHamCandidate,
  deactivateUnsizedHamProducts: deactivateUnsizedHamProducts
};
