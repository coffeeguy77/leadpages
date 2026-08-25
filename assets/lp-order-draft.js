/**
 * Shared New Order draft-order helpers — cart identity is independent of category UI.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.LpOrderDraft = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var STORAGE_PREFIX = 'lp.orders.newDraft.';

  function storageKey(siteId) {
    return STORAGE_PREFIX + String(siteId || 'site');
  }

  function emptyDraft(siteId) {
    return {
      id: 'local-' + Date.now().toString(36),
      siteId: siteId || '',
      currentStep: 'products',
      status: 'draft',
      updatedAt: new Date().toISOString(),
      noFastAdded: {},
      noFastDrafts: {},
      customerMode: 'new',
      customerId: null,
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      customerNotes: '',
      pickupDate: '',
      pickupLabel: '',
      payAction: '',
      inhouseMethod: '',
      inhouseNotes: ''
    };
  }

  /**
   * Build cart lines from added map + drafts (category-agnostic).
   * @param {{ noFastAdded: object, noFastDrafts: object, products: object[] }} input
   * @param {{ lineFromId: function }} helpers
   */
  function cartEntriesFromDraft(input, helpers) {
    input = input || {};
    helpers = helpers || {};
    var added = input.noFastAdded || {};
    var drafts = input.noFastDrafts || {};
    var products = input.products || [];
    var entries = [];
    Object.keys(added).forEach(function (productId) {
      if (!added[productId]) return;
      var product = products.find(function (p) {
        return p && p.id === productId;
      });
      if (!product) return;
      var draft = drafts[productId] || {};
      var line;
      if (typeof helpers.buildLine === 'function') {
        line = helpers.buildLine(productId, draft, product);
      } else {
        line = {
          product_id: productId,
          quantity: Number(draft.qty) > 0 ? Number(draft.qty) : 1,
          requested_weight_kg:
            draft.kg !== '' && draft.kg != null && isFinite(Number(draft.kg)) ? Number(draft.kg) : undefined,
          notes: draft.notes || undefined,
          answers: draft.answers || {}
        };
      }
      entries.push({ key: 'fast:' + productId, product: product, line: line, mode: 'fast' });
    });
    return entries;
  }

  function saveDraft(siteId, payload) {
    try {
      var data = Object.assign({}, payload || {}, { updatedAt: new Date().toISOString() });
      localStorage.setItem(storageKey(siteId), JSON.stringify(data));
      return true;
    } catch (_e) {
      return false;
    }
  }

  function loadDraft(siteId) {
    try {
      var raw = localStorage.getItem(storageKey(siteId));
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;
      return data;
    } catch (_e) {
      return null;
    }
  }

  function clearDraft(siteId) {
    try {
      localStorage.removeItem(storageKey(siteId));
    } catch (_e) {}
  }

  function stepCompleteness(draft, cartCount) {
    draft = draft || {};
    cartCount = cartCount || 0;
    return {
      products: cartCount > 0 ? cartCount + ' item' + (cartCount === 1 ? '' : 's') : 'Add items',
      customer:
        draft.customerName
          ? draft.customerName
          : 'Required',
      payment: draft.payAction ? 'Selected' : 'Not selected'
    };
  }

  return {
    STORAGE_PREFIX: STORAGE_PREFIX,
    storageKey: storageKey,
    emptyDraft: emptyDraft,
    cartEntriesFromDraft: cartEntriesFromDraft,
    saveDraft: saveDraft,
    loadDraft: loadDraft,
    clearDraft: clearDraft,
    stepCompleteness: stepCompleteness
  };
});
