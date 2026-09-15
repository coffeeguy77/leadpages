'use strict';

/**
 * Soft-delete (deactivate) or hard-delete order categories.
 * Soft-delete is the default so butcher "Match categories" can leave unused
 * standard categories hidden without losing the slug row.
 */

var { productCategoryIds } = require('./product-categories');

function asId(v) {
  return String(v || '').trim();
}

function countProductsUsingCategory(products, categoryId) {
  var id = asId(categoryId);
  var primary = 0;
  var additional = 0;
  (products || []).forEach(function (p) {
    if (!p) return;
    if (asId(p.category_id) === id) primary += 1;
    var ids = productCategoryIds(p);
    if (ids.indexOf(id) >= 0 && asId(p.category_id) !== id) additional += 1;
  });
  return { primary: primary, additional: additional, total: primary + additional };
}

function scrubSettingsCategoryRefs(settings, categoryId) {
  var next = Object.assign({}, settings || {});
  var id = asId(categoryId);
  var changed = false;
  var storefront = Object.assign({}, next.storefront || {});
  if (asId(storefront.default_category_id) === id) {
    storefront.default_category_id = null;
    storefront.default_category_slug = null;
    next.storefront = storefront;
    changed = true;
  }
  var gst = Object.assign({}, next.gst || {});
  var ids = Array.isArray(gst.category_ids) ? gst.category_ids.slice() : [];
  var filtered = ids.filter(function (x) {
    return asId(x) !== id;
  });
  if (filtered.length !== ids.length) {
    gst.category_ids = filtered;
    next.gst = gst;
    changed = true;
  }
  return { settings: next, changed: changed };
}

/**
 * Soft-delete a category (active=false). Products keep their category_id so
 * history stays intact; storefront/portal already hide inactive categories.
 */
async function deactivateCategory(admin, opts) {
  opts = opts || {};
  var siteId = opts.site_id;
  var systemId = opts.order_system_id;
  var categoryId = asId(opts.category_id);
  if (!siteId || !systemId || !categoryId) {
    throw Object.assign(new Error('category_id_required'), { code: 400 });
  }

  var { data: category, error: cErr } = await admin
    .from('order_categories')
    .select('*')
    .eq('id', categoryId)
    .eq('site_id', siteId)
    .eq('order_system_id', systemId)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!category) throw Object.assign(new Error('not_found'), { code: 404 });

  var { data: products, error: pErr } = await admin
    .from('order_products')
    .select('id,category_id,options')
    .eq('order_system_id', systemId)
    .eq('site_id', siteId)
    .limit(10000);
  if (pErr) throw pErr;

  var usage = countProductsUsingCategory(products, categoryId);

  if (category.active === false) {
    return { category: category, usage: usage, already_inactive: true };
  }

  var { data: updated, error: uErr } = await admin
    .from('order_categories')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', categoryId)
    .eq('site_id', siteId)
    .select('*')
    .single();
  if (uErr) throw uErr;

  // Best-effort: clear storefront default / GST refs pointing at this category.
  try {
    var { data: system } = await admin
      .from('order_systems')
      .select('id,settings')
      .eq('id', systemId)
      .maybeSingle();
    if (system) {
      var scrubbed = scrubSettingsCategoryRefs(system.settings || {}, categoryId);
      if (scrubbed.changed) {
        await admin
          .from('order_systems')
          .update({ settings: scrubbed.settings, updated_at: new Date().toISOString() })
          .eq('id', systemId);
      }
    }
  } catch (_e) {
    /* non-fatal */
  }

  return { category: updated, usage: usage, already_inactive: false };
}

/**
 * Permanently remove a category. Only allowed when no products reference it
 * (primary or additional). Prefer deactivateCategory for in-use rows.
 */
async function hardDeleteCategory(admin, opts) {
  opts = opts || {};
  var siteId = opts.site_id;
  var systemId = opts.order_system_id;
  var categoryId = asId(opts.category_id);
  if (!siteId || !systemId || !categoryId) {
    throw Object.assign(new Error('category_id_required'), { code: 400 });
  }

  var { data: category, error: cErr } = await admin
    .from('order_categories')
    .select('*')
    .eq('id', categoryId)
    .eq('site_id', siteId)
    .eq('order_system_id', systemId)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!category) throw Object.assign(new Error('not_found'), { code: 404 });

  var { data: products, error: pErr } = await admin
    .from('order_products')
    .select('id,category_id,options')
    .eq('order_system_id', systemId)
    .eq('site_id', siteId)
    .limit(10000);
  if (pErr) throw pErr;

  var usage = countProductsUsingCategory(products, categoryId);
  if (usage.total > 0) {
    throw Object.assign(
      new Error('category_in_use'),
      { code: 409, usage: usage }
    );
  }

  try {
    var { data: system } = await admin
      .from('order_systems')
      .select('id,settings')
      .eq('id', systemId)
      .maybeSingle();
    if (system) {
      var scrubbed = scrubSettingsCategoryRefs(system.settings || {}, categoryId);
      if (scrubbed.changed) {
        await admin
          .from('order_systems')
          .update({ settings: scrubbed.settings, updated_at: new Date().toISOString() })
          .eq('id', systemId);
      }
    }
  } catch (_e) {
    /* non-fatal */
  }

  var { error: dErr } = await admin
    .from('order_categories')
    .delete()
    .eq('id', categoryId)
    .eq('site_id', siteId)
    .eq('order_system_id', systemId);
  if (dErr) throw dErr;

  return { deleted: true, category: category, usage: usage };
}

async function restoreCategory(admin, opts) {
  opts = opts || {};
  var siteId = opts.site_id;
  var systemId = opts.order_system_id;
  var categoryId = asId(opts.category_id);
  if (!siteId || !systemId || !categoryId) {
    throw Object.assign(new Error('category_id_required'), { code: 400 });
  }
  var { data, error } = await admin
    .from('order_categories')
    .update({ active: true, updated_at: new Date().toISOString() })
    .eq('id', categoryId)
    .eq('site_id', siteId)
    .eq('order_system_id', systemId)
    .select('*')
    .single();
  if (error) throw error;
  return { category: data };
}

module.exports = {
  countProductsUsingCategory,
  scrubSettingsCategoryRefs,
  deactivateCategory,
  hardDeleteCategory,
  restoreCategory
};
