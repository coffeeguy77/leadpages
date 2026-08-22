'use strict';

/**
 * Migrate product weight settings from short descriptions:
 * - Variable-weight items: short desc "1.3 kg" → options.minimum_kg
 * - Whole turkeys/chickens with size codes → qty-based (each) + plain-English size copy
 */

const { getAdmin } = require('./supabase');
const { isPackSize } = require('./product-options');
const {
  isPoultryWholeBirdProduct,
  buildPoultryWholeBirdCopy,
  parseMinimumKgFromText,
  isWeightOnlyText,
  stripWeightFromText
} = require('./product-weight');

function needsVariableWeight(product) {
  if (!product) return false;
  if (isPackSize(product)) return false;
  var o = (product.options && typeof product.options === 'object' ? product.options : {}) || {};
  if (o.size_mode === 'each' || o.size_mode === 'unit' || o.size_mode === 'individual') return false;
  return !!(
    product.weight_required ||
    product.pricing_method === 'per_weight' ||
    product.pricing_method === 'price_tbc'
  );
}

async function backfillProductWeightSettings(opts) {
  opts = opts || {};
  const admin = getAdmin();
  const siteId = opts.site_id;
  const systemId = opts.order_system_id;
  const dryRun = !!opts.dry_run;

  var query = admin
    .from('order_products')
    .select('id,name,short_description,pricing_method,weight_required,options')
    .limit(10000);
  if (siteId) query = query.eq('site_id', siteId);
  if (systemId) query = query.eq('order_system_id', systemId);

  var { data: products, error } = await query;
  if (error) throw error;

  var stats = {
    scanned: 0,
    poultry_each: 0,
    min_kg_set: 0,
    short_cleared: 0,
    skipped: 0,
    unchanged: 0,
    samples: []
  };

  for (var i = 0; i < (products || []).length; i++) {
    var p = products[i];
    stats.scanned += 1;
    var optsObj = p.options && typeof p.options === 'object' ? Object.assign({}, p.options) : {};
    var patch = {};
    var touched = false;

    if (isPoultryWholeBirdProduct(p)) {
      var copy = buildPoultryWholeBirdCopy(p);
      optsObj.size_mode = 'each';
      delete optsObj.pack_weight_kg;
      delete optsObj.pack_label;
      delete optsObj.minimum_kg;
      optsObj.quantity_prompt = copy.quantity_prompt;
      patch.short_description = copy.short_description;
      patch.weight_required = false;
      patch.options = optsObj;
      touched = true;
      stats.poultry_each += 1;
    } else if (needsVariableWeight(p)) {
      var minFromShort = parseMinimumKgFromText(p.short_description);
      var minFromName = minFromShort == null ? parseMinimumKgFromText(p.name) : null;
      var minKg = minFromShort != null ? minFromShort : minFromName;
      if (minKg != null && optsObj.minimum_kg == null) {
        optsObj.minimum_kg = minKg;
        patch.options = optsObj;
        touched = true;
        stats.min_kg_set += 1;
      }
      if (p.short_description && (isWeightOnlyText(p.short_description) || minFromShort != null)) {
        var nextShort = stripWeightFromText(p.short_description);
        if (nextShort !== (p.short_description || '')) {
          patch.short_description = nextShort || null;
          touched = true;
          stats.short_cleared += 1;
        }
      }
    } else {
      stats.skipped += 1;
    }

    if (!touched) {
      stats.unchanged += 1;
      continue;
    }

    if (stats.samples.length < 12) {
      stats.samples.push({
        id: p.id,
        name: p.name,
        minimum_kg: patch.options && patch.options.minimum_kg,
        size_mode: patch.options && patch.options.size_mode,
        short_description: patch.short_description
      });
    }

    if (dryRun) continue;

    patch.updated_at = new Date().toISOString();
    var { error: uErr } = await admin.from('order_products').update(patch).eq('id', p.id);
    if (uErr) throw uErr;
  }

  return stats;
}

module.exports = {
  backfillProductWeightSettings: backfillProductWeightSettings,
  needsVariableWeight: needsVariableWeight
};
