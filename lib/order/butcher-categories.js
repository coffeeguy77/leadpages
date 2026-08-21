'use strict';

/**
 * Butcher catalogue categories — Griffith-style names like "BEEF - Brisket".
 * Pure helpers (no DB) plus ensure/apply helpers used by import + admin.
 */

var BUTCHER_CATEGORIES = [
  { slug: 'beef', name: 'Beef' },
  { slug: 'veal', name: 'Veal' },
  { slug: 'lamb', name: 'Lamb' },
  { slug: 'pork', name: 'Pork' },
  { slug: 'ham', name: 'Ham' },
  { slug: 'bacon', name: 'Bacon' },
  { slug: 'chicken', name: 'Chicken' },
  { slug: 'duck', name: 'Duck' },
  { slug: 'turkey', name: 'Turkey' },
  { slug: 'goose', name: 'Goose' },
  { slug: 'seafood', name: 'Seafood' },
  { slug: 'sausages', name: 'Sausages' },
  { slug: 'smallgoods', name: 'Smallgoods' },
  { slug: 'game', name: 'Game' },
  { slug: 'offal', name: 'Offal' },
  { slug: 'extras', name: 'Sauces & Extras' }
];

/** Map normalised head token → category slug */
var HEAD_TO_SLUG = {
  beef: 'beef',
  veal: 'veal',
  lamb: 'lamb',
  mutton: 'lamb',
  pork: 'pork',
  pig: 'pork',
  ham: 'ham',
  bacon: 'bacon',
  chicken: 'chicken',
  chook: 'chicken',
  duck: 'duck',
  turkey: 'turkey',
  goose: 'goose',
  seafood: 'seafood',
  fish: 'seafood',
  prawn: 'seafood',
  prawns: 'seafood',
  oyster: 'seafood',
  oysters: 'seafood',
  salmon: 'seafood',
  sausage: 'sausages',
  sausages: 'sausages',
  snag: 'sausages',
  snags: 'sausages',
  smallgoods: 'smallgoods',
  salami: 'smallgoods',
  prosciutto: 'smallgoods',
  game: 'game',
  venison: 'game',
  kangaroo: 'game',
  rabbit: 'game',
  offal: 'offal',
  liver: 'offal',
  kidney: 'offal',
  sauce: 'extras',
  sauces: 'extras',
  gravy: 'extras',
  stuffing: 'extras',
  glaze: 'extras',
  marinade: 'extras',
  seasoning: 'extras'
};

function normaliseHeadToken(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

/**
 * Extract leading meat/type token from product names.
 * "BEEF - Brisket" → "beef"; "Chicken Maryland" → "chicken"
 */
function extractProductHead(name) {
  var s = String(name || '').trim();
  if (!s) return '';
  var dash = s.match(/^([A-Za-z][A-Za-z0-9 &\/']+?)\s*[-–—:]\s+/);
  if (dash) return dash[1].trim();
  var word = s.match(/^([A-Za-z]+)/);
  return word ? word[1] : '';
}

function guessButcherCategorySlug(name) {
  var head = extractProductHead(name);
  var key = normaliseHeadToken(head);
  if (key && HEAD_TO_SLUG[key]) return HEAD_TO_SLUG[key];

  // Fallback: scan known tokens anywhere near the start of the name
  var lower = String(name || '').toLowerCase();
  var tokens = Object.keys(HEAD_TO_SLUG).sort(function (a, b) {
    return b.length - a.length;
  });
  for (var i = 0; i < tokens.length; i++) {
    var t = tokens[i];
    var re = new RegExp('\\b' + t + '\\b', 'i');
    if (re.test(lower.slice(0, 48))) return HEAD_TO_SLUG[t];
  }
  return null;
}

function categoryMetaForSlug(slug) {
  for (var i = 0; i < BUTCHER_CATEGORIES.length; i++) {
    if (BUTCHER_CATEGORIES[i].slug === slug) return BUTCHER_CATEGORIES[i];
  }
  return null;
}

/**
 * Ensure standard butcher categories exist for a system.
 * Returns map slug → category row (id, name, slug, …).
 */
async function ensureButcherCategories(admin, system, site) {
  var { data: existing } = await admin
    .from('order_categories')
    .select('*')
    .eq('order_system_id', system.id)
    .limit(500);
  var bySlug = Object.create(null);
  (existing || []).forEach(function (c) {
    if (c && c.slug) bySlug[String(c.slug).toLowerCase()] = c;
  });

  for (var i = 0; i < BUTCHER_CATEGORIES.length; i++) {
    var meta = BUTCHER_CATEGORIES[i];
    if (bySlug[meta.slug]) continue;
    // Match by name if slug differs (e.g. manual "Beef")
    var byName = (existing || []).find(function (c) {
      return c && String(c.name || '').toLowerCase() === meta.name.toLowerCase();
    });
    if (byName) {
      bySlug[meta.slug] = byName;
      continue;
    }
    var { data: created, error } = await admin
      .from('order_categories')
      .insert({
        order_system_id: system.id,
        site_id: site.id,
        name: meta.name,
        slug: meta.slug,
        sort_order: i,
        active: true
      })
      .select('*')
      .single();
    if (error) {
      // Race / unique — re-fetch
      var { data: again } = await admin
        .from('order_categories')
        .select('*')
        .eq('order_system_id', system.id)
        .eq('slug', meta.slug)
        .maybeSingle();
      if (again) bySlug[meta.slug] = again;
      continue;
    }
    bySlug[meta.slug] = created;
  }
  return bySlug;
}

/**
 * Assign category_id from product name when guess succeeds.
 * @param {object} opts
 * @param {boolean} [opts.onlyUncategorised=true]
 */
async function autoCategoriseProducts(admin, system, site, opts) {
  opts = opts || {};
  var onlyUncategorised = opts.onlyUncategorised !== false;
  var bySlug = await ensureButcherCategories(admin, system, site);
  var { data: products, error } = await admin
    .from('order_products')
    .select('id,name,category_id')
    .eq('order_system_id', system.id)
    .limit(10000);
  if (error) throw error;

  var stats = { updated: 0, skipped: 0, unmatched: 0, categories: Object.keys(bySlug).length };
  for (var i = 0; i < (products || []).length; i++) {
    var p = products[i];
    if (onlyUncategorised && p.category_id) {
      stats.skipped += 1;
      continue;
    }
    var slug = guessButcherCategorySlug(p.name);
    if (!slug || !bySlug[slug]) {
      stats.unmatched += 1;
      continue;
    }
    var catId = bySlug[slug].id;
    if (p.category_id === catId) {
      stats.skipped += 1;
      continue;
    }
    var { error: uErr } = await admin
      .from('order_products')
      .update({ category_id: catId, updated_at: new Date().toISOString() })
      .eq('id', p.id)
      .eq('order_system_id', system.id);
    if (uErr) throw uErr;
    stats.updated += 1;
  }
  return { stats: stats, categories: bySlug };
}

module.exports = {
  BUTCHER_CATEGORIES,
  HEAD_TO_SLUG,
  extractProductHead,
  guessButcherCategorySlug,
  categoryMetaForSlug,
  ensureButcherCategories,
  autoCategoriseProducts
};
