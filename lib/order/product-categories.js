'use strict';

/**
 * Multi-category helpers for order products.
 * Primary: order_products.category_id
 * Extra: order_products.options.additional_category_ids (uuid[])
 */

function productOptions(product) {
  var o = (product && product.options) || {};
  return o && typeof o === 'object' ? o : {};
}

function normaliseUuidList(raw) {
  var arr = Array.isArray(raw) ? raw : raw != null && raw !== '' ? [raw] : [];
  var out = [];
  var seen = Object.create(null);
  for (var i = 0; i < arr.length; i++) {
    var s = String(arr[i] == null ? '' : arr[i]).trim();
    if (!s || seen[s]) continue;
    seen[s] = true;
    out.push(s);
  }
  return out.slice(0, 40);
}

/** All category ids for a product (primary first, then extras). */
function productCategoryIds(product) {
  var primary = product && product.category_id ? String(product.category_id) : '';
  var o = productOptions(product);
  var extra = normaliseUuidList(
    product && product.additional_category_ids != null
      ? product.additional_category_ids
      : o.additional_category_ids
  );
  var out = [];
  if (primary) out.push(primary);
  for (var i = 0; i < extra.length; i++) {
    if (extra[i] !== primary) out.push(extra[i]);
  }
  return out;
}

function productInCategory(product, categoryId) {
  if (!categoryId) return true;
  var want = String(categoryId);
  return productCategoryIds(product).indexOf(want) >= 0;
}

function additionalCategoryIds(product) {
  var primary = product && product.category_id ? String(product.category_id) : '';
  return productCategoryIds(product).filter(function (id) {
    return id !== primary;
  });
}

/**
 * Merge additional_category_ids into options patch.
 * Excludes the primary category_id when provided.
 */
function applyAdditionalCategoriesToOptions(options, body) {
  var prev = options && typeof options === 'object' ? Object.assign({}, options) : {};
  if (body == null || body.additional_category_ids === undefined) return prev;
  var primary =
    body.category_id != null && body.category_id !== ''
      ? String(body.category_id)
      : '';
  var ids = normaliseUuidList(body.additional_category_ids).filter(function (id) {
    return id !== primary;
  });
  if (ids.length) prev.additional_category_ids = ids;
  else delete prev.additional_category_ids;
  return prev;
}

function nameMatchesNeedle(name, needle) {
  var n = String(name || '').toLowerCase();
  var want = String(needle || '')
    .toLowerCase()
    .trim();
  if (!want) return false;
  return n.indexOf(want) >= 0;
}

/**
 * Ensure a category exists (by name/slug), then add it as an additional category
 * on every product whose name contains the match string — without changing primary.
 */
async function assignAdditionalCategoryByNameMatch(admin, system, site, opts) {
  opts = opts || {};
  var categoryName = String(opts.category_name || '').trim();
  var nameContains = String(opts.name_contains || categoryName || '').trim();
  if (!categoryName) throw Object.assign(new Error('category_name_required'), { code: 400 });
  if (!nameContains) throw Object.assign(new Error('name_contains_required'), { code: 400 });

  var slug =
    opts.slug ||
    categoryName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) ||
    'category';

  var { data: existingCats, error: catErr } = await admin
    .from('order_categories')
    .select('*')
    .eq('order_system_id', system.id)
    .limit(500);
  if (catErr) throw catErr;

  var category =
    (existingCats || []).find(function (c) {
      return c && String(c.slug || '').toLowerCase() === slug;
    }) ||
    (existingCats || []).find(function (c) {
      return c && String(c.name || '').toLowerCase() === categoryName.toLowerCase();
    });

  var created = false;
  if (!category) {
    var sortOrder = (existingCats || []).length;
    var { data: createdRow, error: insErr } = await admin
      .from('order_categories')
      .insert({
        order_system_id: system.id,
        site_id: site.id,
        name: categoryName,
        slug: slug,
        sort_order: sortOrder,
        active: true
      })
      .select('*')
      .single();
    if (insErr) {
      var { data: again } = await admin
        .from('order_categories')
        .select('*')
        .eq('order_system_id', system.id)
        .eq('slug', slug)
        .maybeSingle();
      if (!again) throw insErr;
      category = again;
    } else {
      category = createdRow;
      created = true;
    }
  }

  var catId = String(category.id);
  var { data: products, error: pErr } = await admin
    .from('order_products')
    .select('id,name,category_id,options')
    .eq('order_system_id', system.id)
    .limit(10000);
  if (pErr) throw pErr;

  var stats = {
    category_id: catId,
    category_name: category.name,
    category_created: created,
    matched: 0,
    updated: 0,
    skipped: 0,
    already: 0
  };

  for (var i = 0; i < (products || []).length; i++) {
    var p = products[i];
    if (!nameMatchesNeedle(p.name, nameContains)) {
      stats.skipped += 1;
      continue;
    }
    stats.matched += 1;
    if (String(p.category_id || '') === catId) {
      stats.already += 1;
      continue;
    }
    var optsObj = productOptions(p);
    var extra = normaliseUuidList(optsObj.additional_category_ids);
    if (extra.indexOf(catId) >= 0) {
      stats.already += 1;
      continue;
    }
    extra.push(catId);
    var nextOptions = Object.assign({}, optsObj, { additional_category_ids: extra });
    var { error: uErr } = await admin
      .from('order_products')
      .update({ options: nextOptions, updated_at: new Date().toISOString() })
      .eq('id', p.id)
      .eq('order_system_id', system.id);
    if (uErr) throw uErr;
    stats.updated += 1;
  }

  return { category: category, stats: stats };
}

module.exports = {
  normaliseUuidList: normaliseUuidList,
  productCategoryIds: productCategoryIds,
  productInCategory: productInCategory,
  additionalCategoryIds: additionalCategoryIds,
  applyAdditionalCategoriesToOptions: applyAdditionalCategoriesToOptions,
  nameMatchesNeedle: nameMatchesNeedle,
  assignAdditionalCategoryByNameMatch: assignAdditionalCategoryByNameMatch
};
