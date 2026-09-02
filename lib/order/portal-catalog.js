'use strict';

const { productCategoryIds } = require('./product-categories');

function mapPortalProduct(p, questions) {
  return {
    id: p.id,
    name: p.name,
    category_ids: productCategoryIds(p),
    pricing_method: p.pricing_method,
    price_cents: p.price_cents,
    price_per_kg_cents: p.price_per_kg_cents,
    unit_label: p.unit_label,
    weight_required: p.weight_required,
    options: p.options || {},
    questions: questions || []
  };
}

/** Build category + product lists for the customer portal add-item picker. */
function buildPortalCatalog(categories, products, questionsByProduct) {
  questionsByProduct = questionsByProduct || {};
  const activeCatIds = Object.create(null);
  (categories || []).forEach(function (c) {
    if (c && c.id) activeCatIds[c.id] = true;
  });

  const mapped = (products || []).map(function (p) {
    return mapPortalProduct(p, questionsByProduct[p.id] || []);
  });

  const productCatIds = Object.create(null);
  mapped.forEach(function (p) {
    (p.category_ids || []).forEach(function (id) {
      if (id && activeCatIds[id]) productCatIds[id] = true;
    });
  });

  var visibleCategories = (categories || []).filter(function (c) {
    return productCatIds[c.id];
  });

  function productInOtherBucket(p) {
    var ids = p.category_ids || [];
    if (!ids.length) return true;
    return !ids.some(function (id) {
      return activeCatIds[id] && productCatIds[id];
    });
  }

  if (mapped.some(productInOtherBucket)) {
    visibleCategories = visibleCategories.concat([{ id: '__other__', name: 'Other', slug: 'other' }]);
  }

  return {
    categories: visibleCategories.map(function (c) {
      return { id: c.id, name: c.name, slug: c.slug || '' };
    }),
    products: mapped
  };
}

function visibleCategoryIds(catalog) {
  return (catalog.categories || [])
    .filter(function (c) {
      return c.id !== '__other__';
    })
    .map(function (c) {
      return c.id;
    });
}

function productsInCategory(catalog, categoryId) {
  if (!catalog || !categoryId) return [];
  var visibleNonOther = visibleCategoryIds(catalog);
  return (catalog.products || []).filter(function (p) {
    if (categoryId === '__other__') {
      var ids = p.category_ids || [];
      if (!ids.length) return true;
      return !ids.some(function (id) {
        return visibleNonOther.indexOf(id) >= 0;
      });
    }
    return (p.category_ids || []).indexOf(categoryId) >= 0;
  });
}

module.exports = {
  buildPortalCatalog: buildPortalCatalog,
  productsInCategory: productsInCategory,
  mapPortalProduct: mapPortalProduct
};
