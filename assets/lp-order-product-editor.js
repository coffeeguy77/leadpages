/**
 * Shared Orders product editor helpers — mode resolution, sections, summaries.
 * Used by orders.html; presentation shells relocate one DOM form (no duplicate forms).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.LpOrderProductEditor = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SECTIONS = [
    { id: 'details', label: 'Details' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'stock', label: 'Stock' },
    { id: 'options', label: 'Options' },
    { id: 'rules', label: 'Rules' },
    { id: 'display', label: 'Display' }
  ];

  var FULLSCREEN_MIN = 1100;
  var MOBILE_MAX = 680;

  /**
   * @param {{ isFullScreenOrders?: boolean, containerWidth?: number, forceFullscreenEditor?: boolean }} opts
   * @returns {'fullscreen'|'embedded'|'mobile'}
   */
  function resolveDisplayMode(opts) {
    opts = opts || {};
    var w = Number(opts.containerWidth);
    if (!isFinite(w) || w <= 0) w = 1200;
    if (opts.forceFullscreenEditor) return 'fullscreen';
    if (opts.isFullScreenOrders && w >= FULLSCREEN_MIN) return 'fullscreen';
    if (w < MOBILE_MAX) return 'mobile';
    return 'embedded';
  }

  function sectionIndex(id) {
    for (var i = 0; i < SECTIONS.length; i++) {
      if (SECTIONS[i].id === id) return i;
    }
    return 0;
  }

  function nextSection(id) {
    var i = sectionIndex(id);
    return SECTIONS[Math.min(SECTIONS.length - 1, i + 1)].id;
  }

  function prevSection(id) {
    var i = sectionIndex(id);
    return SECTIONS[Math.max(0, i - 1)].id;
  }

  function formatAudCents(cents) {
    if (cents == null || cents === '') return null;
    var n = Number(cents);
    if (!isFinite(n)) return null;
    return (n / 100).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
  }

  /**
   * Plain-language pricing summary for Price confirmed later / deposits.
   */
  function pricingSummary(state) {
    state = state || {};
    var method = state.pricing_method || 'fixed';
    if (method === 'fixed') {
      var fixed = formatAudCents(state.price_cents);
      return fixed ? 'Customers pay ' + fixed + ' at checkout (fixed price).' : 'Set a fixed price for this product.';
    }
    if (method === 'per_weight') {
      var perkg = formatAudCents(state.price_per_kg_cents);
      return perkg
        ? 'Customers pay ' + perkg + ' per kilogram based on the weight entered.'
        : 'Set a per-kilogram price.';
    }
    // price_tbc
    var depositMode = state.deposit_mode || 'none';
    var depositLabel = null;
    if (depositMode === 'fixed' && state.deposit_amount_cents != null) {
      depositLabel = formatAudCents(state.deposit_amount_cents);
    } else if (depositMode === 'percent' && state.deposit_percent != null) {
      depositLabel = Number(state.deposit_percent) + '%';
    }
    if (depositLabel) {
      return (
        'Customers pay a ' +
        depositLabel +
        ' deposit today. The final balance is calculated after the actual weight is entered.'
      );
    }
    return 'Price is confirmed later. No deposit is collected today; the final balance is calculated after preparation.';
  }

  function rulesSummary(state) {
    state = state || {};
    var lines = [];
    var minKg = state.minimum_kg != null && state.minimum_kg !== '' ? Number(state.minimum_kg) : null;
    var sizeMode = state.size_mode || 'variable';
    if (sizeMode === 'variable' && minKg != null && isFinite(minKg) && minKg > 0) {
      lines.push('Customers can order from ' + minKg + 'kg.');
    }
    if (sizeMode === 'each') {
      lines.push('Sold as individual items (quantity only).');
    }
    if (sizeMode === 'pack') {
      var pack =
        state.pack_label ||
        (state.pack_weight_kg != null ? Math.round(Number(state.pack_weight_kg) * 1000) + 'g packs' : 'fixed packs');
      lines.push('Sold as ' + pack + '.');
    }
    var cutoff = state.cutoff_mode || 'store_default';
    if (cutoff === 'days_before' && state.cutoff_value != null) {
      lines.push('Orders close ' + state.cutoff_value + ' day(s) before pickup.');
    } else if (cutoff === 'hours_before' && state.cutoff_value != null) {
      lines.push('Orders close ' + state.cutoff_value + ' hour(s) before pickup.');
    } else if (cutoff === 'none') {
      lines.push('No product-specific cutoff (store default may still apply).');
    } else {
      lines.push('Uses the store cutoff default.');
    }
    if (state.lead_time_mode === 'days' && state.lead_time_value) {
      lines.push('Lead time: ' + state.lead_time_value + ' day(s).');
    } else if (state.lead_time_mode === 'hours' && state.lead_time_value) {
      lines.push('Lead time: ' + state.lead_time_value + ' hour(s).');
    }
    return lines.join(' ');
  }

  function pricingLabel(product) {
    if (!product) return '—';
    var m = product.pricing_method || 'fixed';
    if (m === 'per_weight') {
      var kg = formatAudCents(product.price_per_kg_cents);
      return 'per kg · ' + (kg || 'TBC');
    }
    if (m === 'price_tbc') return 'price_tbc · TBC';
    var fixed = formatAudCents(product.price_cents);
    return 'fixed · ' + (fixed || '—');
  }

  function stockLabel(product) {
    var m = (product && product.stock_method) || 'unlimited';
    if (m === 'tracked') return 'track quantity';
    if (m === 'allocation') return 'seasonal / allocation';
    return String(m).replace(/_/g, ' ');
  }

  /**
   * Snapshot serialisable form values for dirty checking (exclude file inputs).
   */
  function snapshotForm(form) {
    if (!form) return '';
    var data = {};
    var els = form.querySelectorAll('input, select, textarea');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el.name && !el.id) continue;
      if (el.type === 'file') continue;
      var key = el.id || el.name;
      if (el.type === 'checkbox' || el.type === 'radio') {
        if (el.type === 'radio' && !el.checked) continue;
        data[key + (el.type === 'checkbox' ? ':' + el.value : '')] =
          el.type === 'checkbox' ? !!el.checked : el.value;
      } else {
        data[key] = el.value;
      }
    }
    var optHost = form.querySelector('#prod-options-list');
    if (optHost) data.__options_html = optHost.innerHTML.length;
    return JSON.stringify(data);
  }

  function catalogueVisibleColumns(mode) {
    if (mode === 'mobile') return ['product', 'pricing', 'status', 'expand'];
    if (mode === 'embedded') return ['select', 'product', 'pricing', 'status', 'expand'];
    return ['select', 'product', 'category', 'pricing', 'stock', 'cutoff', 'status', 'actions'];
  }

  return {
    SECTIONS: SECTIONS,
    FULLSCREEN_MIN: FULLSCREEN_MIN,
    MOBILE_MAX: MOBILE_MAX,
    resolveDisplayMode: resolveDisplayMode,
    sectionIndex: sectionIndex,
    nextSection: nextSection,
    prevSection: prevSection,
    pricingSummary: pricingSummary,
    rulesSummary: rulesSummary,
    pricingLabel: pricingLabel,
    stockLabel: stockLabel,
    formatAudCents: formatAudCents,
    snapshotForm: snapshotForm,
    catalogueVisibleColumns: catalogueVisibleColumns
  };
});
