/**
 * LeadPages Online Quote — visual SaaS-style config builder for manage.html
 */
(function(global) {
  'use strict';

  var STEP_CATALOG = (global.LPQuoteWizardLogic && global.LPQuoteWizardLogic.STEP_CATALOG) || [
    { id: 'equipment', label: 'Equipment / products', icon: 'package' },
    { id: 'event', label: 'Event details', icon: 'calendar' },
    { id: 'beverages', label: 'Packages / per-head', icon: 'users' },
    { id: 'travel', label: 'Travel zone', icon: 'map-pin' },
    { id: 'addons', label: 'Add-ons & extras', icon: 'plus-circle' },
    { id: 'contact', label: 'Contact details', icon: 'mail' }
  ];

  var LAYOUTS = [
    { id: 'cards', label: 'Choice cards', hint: 'Large tappable cards — best for 2–6 options' },
    { id: 'list', label: 'Compact list', hint: 'Stacked rows — good for many options' },
    { id: 'split', label: 'Split panel', hint: 'Label left, choices right — desktop-friendly' }
  ];

  var ICON_OPTIONS = [
    'coffee', 'truck', 'users', 'gift', 'map-pin', 'clock', 'star', 'shield-check',
    'zap', 'check-circle', 'package', 'calendar', 'plus-circle', 'mail', 'phone',
    'heart', 'award', 'sparkles', 'cup-soda', 'chef-hat'
  ];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function uid(prefix) {
    return (prefix || 'item') + '-' + Math.random().toString(36).slice(2, 9);
  }

  function slugify(text) {
    return String(text || '').toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || uid('item');
  }

  function dollars(cents) {
    if (cents == null || isNaN(cents)) return '';
    return (Math.round(cents) / 100).toFixed(2);
  }

  function cents(val) {
    var n = parseFloat(String(val || '').replace(/[^0-9.]/g, ''));
    return isNaN(n) ? 0 : Math.round(n * 100);
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj || {}));
  }

  function normalizeConfig(raw) {
    var cfg = clone(raw);
    if (!cfg.business) cfg.business = {};
    if (!cfg.wizard) cfg.wizard = {};
    if (!Array.isArray(cfg.wizard.steps) || !cfg.wizard.steps.length) {
      cfg.wizard.steps = ['equipment', 'beverages', 'addons', 'contact'];
    }
    if (!cfg.wizard.layout) cfg.wizard.layout = 'cards';
    if (!cfg.wizard.stepLabels) cfg.wizard.stepLabels = {};
    if (!Array.isArray(cfg.wizard.conditions)) cfg.wizard.conditions = [];
    cfg.products = Array.isArray(cfg.products) ? cfg.products : [];
    cfg.beverages = Array.isArray(cfg.beverages) ? cfg.beverages : [];
    cfg.addons = Array.isArray(cfg.addons) ? cfg.addons : [];
    if (!cfg.labour) cfg.labour = { label: 'Labour', hourlyCents: 7500, minimumHours: 3 };
    if (!cfg.travel) cfg.travel = { zones: [] };
    if (!Array.isArray(cfg.travel.zones)) cfg.travel.zones = [];
    if (!cfg.rules) cfg.rules = { gstRate: 0.1, quoteValidityDays: 14, minimumNoticeDays: 3 };
    cfg.products.forEach(function(p, i) {
      if (!p.id) p.id = slugify(p.label) || uid('product');
      if (!p.type) p.type = 'equipment';
    });
    cfg.beverages.forEach(function(b) { if (!b.id) b.id = slugify(b.label) || uid('bev'); });
    cfg.addons.forEach(function(a) { if (!a.id) a.id = slugify(a.label) || uid('addon'); });
    cfg.travel.zones.forEach(function(z) { if (!z.id) z.id = slugify(z.label) || uid('zone'); });
    return cfg;
  }

  function iconSvg(name) {
    var ic = global.LP_ICONS && global.LP_ICONS[name];
    if (!ic) return '';
    return '<svg class="oqb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' + ic + '</svg>';
  }

  function wl() { return global.LPQuoteWizardLogic || {}; }

  function QuoteBuilder(root, options) {
    this.root = root;
    this.previewRoot = (options && options.previewRoot) || null;
    this.config = normalizeConfig(options && options.config);
    this.tab = (options && options.initialTab) || 'wizard';
    this.showJson = false;
    this.previewProgress = { productId: '', hours: 3, guestCount: 50, beverageId: '', addonIds: [], travelZoneId: '' };
    this.previewStep = 0;
    this._render();
  }

  QuoteBuilder.prototype.getConfig = function() {
    return normalizeConfig(this.config);
  };

  QuoteBuilder.prototype._render = function() {
    var self = this;
    var c = this.config;
    var tabs = [
      ['overview', 'Overview'],
      ['wizard', 'Wizard flow'],
      ['products', 'Products'],
      ['labour', 'Labour'],
      ['packages', 'Packages'],
      ['addons', 'Add-ons'],
      ['travel', 'Travel'],
      ['rules', 'Rules']
    ];
    var html = '<div class="oqb">'
      + '<div class="oqb-head"><div><h3 class="oqb-title">Quote builder</h3>'
      + '<p class="oqb-lede">Design your quote wizard — steps, icons, prices and scenarios. Saving creates a new live config version.</p></div>'
      + '<div class="oqb-head-actions">'
      + '<button type="button" class="btn ghost oqb-btn-sm" data-oqb="toggle-json">' + (this.showJson ? 'Visual builder' : 'Advanced JSON') + '</button>'
      + '</div></div>';

    if (this.showJson) {
      html += '<textarea class="oqb-json" data-oqb="json">' + esc(JSON.stringify(c, null, 2)) + '</textarea>';
    } else {
      html += '<div class="oqb-tabs">' + tabs.map(function(t) {
        return '<button type="button" class="oqb-tab' + (self.tab === t[0] ? ' is-on' : '') + '" data-oqb-tab="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div>';
      html += '<div class="oqb-body">' + this._renderTab() + '</div>';
    }
    html += '</div>';
    this.root.innerHTML = html;
    this._wire();
    this._refreshPreview();
  };

  QuoteBuilder.prototype._toShell = function() {
    var c = this.config;
    return {
      business: c.business || {},
      products: c.products || [],
      beverages: c.beverages || [],
      addons: c.addons || [],
      travelZones: (c.travel && c.travel.zones) || [],
      wizard: c.wizard || {}
    };
  };

  QuoteBuilder.prototype._refreshPreview = function() {
    if (!this.previewRoot || this.showJson) return;
    this.previewRoot.innerHTML = '<div class="oqb-preview">' + this._renderPreview() + '</div>';
    this._wirePreview();
  };

  QuoteBuilder.prototype._renderPreview = function() {
    var self = this;
    var shell = this._toShell();
    var W = wl();
    var tz = shell.travelZones.length;
    var steps = W.resolveWizardSteps
      ? W.resolveWizardSteps(shell.wizard, this.previewProgress, tz)
      : (shell.wizard.steps || ['equipment', 'contact']);
    if (this.previewStep >= steps.length) this.previewStep = Math.max(0, steps.length - 1);
    var stepKey = steps[this.previewStep] || 'contact';
    var labels = shell.wizard.stepLabels || {};
    var label = function(k) { return labels[k] || (W.catalogLabel ? W.catalogLabel(k) : k); };
    var progress = this.previewProgress;
    var filter = W.filterByShowWhen || function(items) { return items || []; };

    var body = '';
    if (stepKey === 'equipment' || stepKey === 'event') {
      body = '<p class="lp-oq-intro">Choose your setup.</p>' +
        filter(shell.products, progress).map(function(p) {
          var sel = progress.productId === p.id ? ' is-selected' : '';
          return '<button type="button" class="lp-oq-choice' + sel + '" data-prev-pick="productId" data-val="' + esc(p.id) + '">' +
            iconSvg(p.icon) + '<strong>' + esc(p.label) + '</strong></button>';
        }).join('') +
        '<label class="lp-oq-field"><span>Hours</span><input type="number" min="1" data-prev-field="hours" value="' + esc(progress.hours) + '"></label>';
    } else if (stepKey === 'beverages') {
      body = '<p class="lp-oq-intro">Guest count &amp; package.</p>' +
        '<label class="lp-oq-field"><span>Guests</span><input type="number" data-prev-field="guestCount" value="' + esc(progress.guestCount) + '"></label>' +
        filter(shell.beverages, progress).map(function(b) {
          var sel = progress.beverageId === b.id ? ' is-selected' : '';
          return '<button type="button" class="lp-oq-choice' + sel + '" data-prev-pick="beverageId" data-val="' + esc(b.id) + '">' +
            iconSvg(b.icon) + '<strong>' + esc(b.label) + '</strong></button>';
        }).join('');
    } else if (stepKey === 'travel') {
      body = '<p class="lp-oq-intro">Where is your event?</p>' +
        shell.travelZones.map(function(z) {
          var sel = progress.travelZoneId === z.id ? ' is-selected' : '';
          return '<button type="button" class="lp-oq-choice' + sel + '" data-prev-pick="travelZoneId" data-val="' + esc(z.id) + '">' +
            iconSvg(z.icon || 'map-pin') + '<strong>' + esc(z.label) + '</strong></button>';
        }).join('');
    } else if (stepKey === 'addons') {
      body = '<p class="lp-oq-intro">Optional extras.</p>' +
        filter(shell.addons, progress).map(function(a) {
          var on = progress.addonIds.indexOf(a.id) >= 0 ? ' is-selected' : '';
          return '<button type="button" class="lp-oq-choice lp-oq-multi' + on + '" data-prev-addon="' + esc(a.id) + '">' +
            iconSvg(a.icon) + '<strong>' + esc(a.label) + '</strong></button>';
        }).join('');
    } else {
      body = '<p class="lp-oq-intro">Contact details (preview).</p>' +
        '<label class="lp-oq-field"><span>Name</span><input disabled placeholder="Customer name"></label>';
    }

    return '<div class="oqb-preview-head"><h4>Live preview</h4><p>Test conditional steps — pick a product to see the flow change.</p></div>' +
      '<div class="oqb-preview-body oqb-preview-mock"><div class="lp-oq-card' + (shell.wizard.layout === 'list' ? ' lp-oq-layout-list' : shell.wizard.layout === 'split' ? ' lp-oq-layout-split' : '') + '">' +
      '<div class="lp-oq-head"><h2 class="lp-oq-title">' + esc((shell.business && shell.business.name) || 'Your business') + '</h2>' +
      '<div class="lp-oq-steps">' + steps.map(function(s, i) {
        return '<span class="lp-oq-step' + (i === self.previewStep ? ' is-active' : (i < self.previewStep ? ' is-done' : '')) + '">' + esc(label(s)) + '</span>';
      }).join('') + '</div></div>' +
      '<div class="lp-oq-body">' + body + '</div>' +
      '<div class="lp-oq-foot">' +
      (self.previewStep > 0 ? '<button type="button" class="lp-oq-btn lp-oq-btn-ghost" data-prev-act="back">Back</button>' : '') +
      (self.previewStep < steps.length - 1 ? '<button type="button" class="lp-oq-btn" data-prev-act="next">Continue</button>' : '<button type="button" class="lp-oq-btn" disabled>Get my quote</button>') +
      '</div></div></div>';
  };

  QuoteBuilder.prototype._renderTab = function() {
    switch (this.tab) {
      case 'wizard': return this._renderWizard();
      case 'products': return this._renderProducts();
      case 'labour': return this._renderLabour();
      case 'packages': return this._renderPackages();
      case 'addons': return this._renderAddons();
      case 'travel': return this._renderTravel();
      case 'rules': return this._renderRules();
      default: return this._renderOverview();
    }
  };

  QuoteBuilder.prototype._field = function(label, inner) {
    return '<label class="oqb-field"><span>' + esc(label) + '</span>' + inner + '</label>';
  };

  QuoteBuilder.prototype._money = function(path, val) {
    return '<div class="oqb-money"><span class="oqb-money-sym">$</span><input type="text" inputmode="decimal" data-oqb-path="' + esc(path) + '" value="' + esc(dollars(val)) + '"></div>';
  };

  QuoteBuilder.prototype._iconSelect = function(path, val) {
    var opts = '<option value="">No icon</option>' + ICON_OPTIONS.map(function(ic) {
      return '<option value="' + ic + '"' + (val === ic ? ' selected' : '') + '>' + ic + '</option>';
    }).join('');
    return '<div class="oqb-iconpick"><select data-oqb-path="' + esc(path) + '">' + opts + '</select>'
      + (val ? '<span class="oqb-icon-preview">' + iconSvg(val) + '</span>' : '')
      + '</div>';
  };

  QuoteBuilder.prototype._stepCatalogMap = function() {
    var catalog = {};
    STEP_CATALOG.forEach(function(s) { catalog[s.id] = s; });
    return catalog;
  };

  QuoteBuilder.prototype._editableSteps = function() {
    var w = this.config.wizard || {};
    return (wl().normalizeWizardSteps ? wl().normalizeWizardSteps(w.steps || []) : (w.steps || []))
      .filter(function(s) { return s !== 'contact'; });
  };

  QuoteBuilder.prototype._renderStepRows = function() {
    var self = this;
    var steps = this._editableSteps();
    var labels = (this.config.wizard && this.config.wizard.stepLabels) || {};
    var catalog = this._stepCatalogMap();

    var rows = steps.map(function(stepId, idx) {
      var meta = catalog[stepId] || { id: stepId, label: stepId, icon: 'package' };
      var condVal = self._stepConditionValue(stepId);
      var condOpts = '<option value="">Always show</option><option value="any"' + (condVal === 'any' ? ' selected' : '') + '>When any product selected</option>' +
        (self.config.products || []).map(function(p) {
          return '<option value="product:' + esc(p.id) + '"' + (condVal === 'product:' + p.id ? ' selected' : '') + '>When ' + esc(p.label) + '</option>';
        }).join('');
      return '<div class="oqb-step-row is-on" draggable="true" data-oqb-step-id="' + esc(stepId) + '" data-oqb-step-idx="' + idx + '">'
        + '<span class="oqb-drag" title="Drag to reorder" aria-hidden="true">⠿</span>'
        + '<span class="oqb-step-num">' + (idx + 1) + '</span>'
        + iconSvg(meta.icon)
        + '<span class="oqb-step-type">' + esc(meta.label) + '</span>'
        + '<input type="text" class="oqb-step-label" placeholder="Customer-facing label" data-oqb-step-label="' + esc(stepId) + '" value="' + esc(labels[stepId] || meta.label) + '" aria-label="Label for ' + esc(meta.label) + ' step">'
        + '<div class="oqb-step-cond"><select data-oqb-step-cond="' + esc(stepId) + '" aria-label="When to show ' + esc(meta.label) + '">' + condOpts + '</select></div>'
        + '<div class="oqb-step-tools">'
        + (idx > 0 ? '<button type="button" class="oqb-iconbtn" data-oqb-step-move="up" data-oqb-step-id="' + esc(stepId) + '" title="Move up">↑</button>' : '')
        + (idx < steps.length - 1 ? '<button type="button" class="oqb-iconbtn" data-oqb-step-move="down" data-oqb-step-id="' + esc(stepId) + '" title="Move down">↓</button>' : '')
        + '<button type="button" class="oqb-iconbtn oqb-danger" data-oqb-step-remove="' + esc(stepId) + '" title="Remove step">×</button>'
        + '</div></div>';
    }).join('');

    var contactMeta = catalog.contact || { label: 'Contact details', icon: 'mail' };
    var contactRow = '<div class="oqb-step-row is-locked" data-oqb-step-locked="contact">'
      + '<span class="oqb-step-num">✓</span>'
      + iconSvg(contactMeta.icon)
      + '<span class="oqb-step-type">' + esc(contactMeta.label) + '</span>'
      + '<input type="text" class="oqb-step-label" placeholder="Customer-facing label" data-oqb-step-label="contact" value="' + esc(labels.contact || contactMeta.label) + '" aria-label="Contact step label">'
      + '<span class="oqb-step-lock">Always last · cannot remove</span>'
      + '</div>';

    return rows + contactRow;
  };

  QuoteBuilder.prototype._renderStepActions = function() {
    var steps = this._editableSteps();
    var inactive = STEP_CATALOG.filter(function(s) {
      return s.id !== 'contact' && steps.indexOf(s.id) < 0;
    });
    if (!inactive.length) return '<p class="oqb-hint">All step types are in your flow.</p>';
    return inactive.map(function(s) {
      return '<button type="button" class="btn ghost oqb-btn-sm" data-oqb-add-step="' + s.id + '">+ Add ' + esc(s.label) + '</button>';
    }).join(' ');
  };

  QuoteBuilder.prototype._moveWizardStep = function(stepId, dir) {
    var steps = this._editableSteps();
    var idx = steps.indexOf(stepId);
    if (idx < 0) return;
    var j = dir === 'up' ? idx - 1 : idx + 1;
    if (j < 0 || j >= steps.length) return;
    var tmp = steps[idx];
    steps[idx] = steps[j];
    steps[j] = tmp;
    this.config.wizard.steps = steps.concat(['contact']);
  };

  QuoteBuilder.prototype._renderOverview = function() {
    var c = this.config;
    var b = c.business || {};
    return '<div class="oqb-grid">'
      + this._field('Business name', '<input type="text" data-oqb-path="business.name" value="' + esc(b.name || '') + '">')
      + this._field('Tagline', '<input type="text" data-oqb-path="business.tagline" value="' + esc(b.tagline || '') + '">')
      + this._field('GST registered', '<label class="oqb-check"><input type="checkbox" data-oqb-path="business.gstRegistered"' + (b.gstRegistered !== false ? ' checked' : '') + '> Prices include 10% GST on quotes</label>')
      + '</div>'
      + '<div class="oqb-section oqb-journey"><div class="oqb-section-head">'
      + '<h4>Customer journey — wizard steps</h4>'
      + '<button type="button" class="btn ghost oqb-btn-sm" data-oqb-tab="wizard">Layout &amp; conditions</button>'
      + '</div>'
      + '<p class="oqb-hint" style="margin-top:0">Drag to reorder, edit labels, set visibility rules, or remove steps. Contact is always the final step.</p>'
      + '<div class="oqb-steps" data-oqb-sortable="1">' + this._renderStepRows() + '</div>'
      + '<div class="oqb-step-actions">' + this._renderStepActions() + '</div></div>'
      + '<div class="oqb-summary">'
      + '<div class="oqb-stat"><b>' + (c.products || []).length + '</b><span>Products</span></div>'
      + '<div class="oqb-stat"><b>' + (c.beverages || []).length + '</b><span>Packages</span></div>'
      + '<div class="oqb-stat"><b>' + (c.addons || []).length + '</b><span>Add-ons</span></div>'
      + '<div class="oqb-stat"><b>' + this._editableSteps().length + 1 + '</b><span>Wizard steps</span></div>'
      + '</div>';
  };

  QuoteBuilder.prototype._stepConditionValue = function(stepId) {
    var W = wl();
    var norm = W.normalizeStepId ? W.normalizeStepId(stepId) : stepId;
    var conds = (this.config.wizard.conditions) || [];
    for (var i = 0; i < conds.length; i++) {
      if ((W.normalizeStepId ? W.normalizeStepId(conds[i].step) : conds[i].step) !== norm) continue;
      var when = conds[i].when;
      if (!when) return '';
      if (when.values && when.values.indexOf('*') >= 0) return 'any';
      if (when.field === 'productId' && when.values && when.values.length === 1) return 'product:' + when.values[0];
      if (when.field === 'productId' && when.values && when.values.length > 1) return 'products';
      return '';
    }
    return '';
  };

  QuoteBuilder.prototype._setStepCondition = function(stepId, value) {
    var W = wl();
    var norm = W.normalizeStepId ? W.normalizeStepId(stepId) : stepId;
    var conds = (this.config.wizard.conditions || []).filter(function(c) {
      return (W.normalizeStepId ? W.normalizeStepId(c.step) : c.step) !== norm;
    });
    if (value === 'any') conds.push({ step: norm, when: { field: 'productId', values: ['*'] } });
    else if (value && value.indexOf('product:') === 0) {
      conds.push({ step: norm, when: { field: 'productId', values: [value.slice(8)] } });
    }
    this.config.wizard.conditions = conds;
  };

  QuoteBuilder.prototype._showWhenChips = function(itemPath, item) {
    var self = this;
    var products = this.config.products || [];
    if (!products.length) return '';
    var selected = (item.showWhen && item.showWhen.field === 'productId' && item.showWhen.values) ? item.showWhen.values.slice() : [];
    var always = !item.showWhen;
    return '<div class="oqb-showwhen"><p class="oqb-showwhen-title">Show when product</p><div class="oqb-chips">' +
      '<label class="oqb-chip' + (always ? ' is-on' : '') + '"><input type="checkbox" data-oqb-showwhen-all="' + esc(itemPath) + '"' + (always ? ' checked' : '') + '> Any product</label>' +
      products.map(function(p) {
        var on = !always && selected.indexOf(p.id) >= 0;
        return '<label class="oqb-chip' + (on ? ' is-on' : '') + '"><input type="checkbox" data-oqb-showwhen-val="' + esc(itemPath) + '" value="' + esc(p.id) + '"' + (on ? ' checked' : '') + '> ' + esc(p.label) + '</label>';
      }).join('') + '</div></div>';
  };

  QuoteBuilder.prototype._renderWizard = function() {
    var w = this.config.wizard || {};
    var layout = w.layout || 'cards';

    return '<div class="oqb-section"><h4>Layout style</h4><div class="oqb-layouts">'
      + LAYOUTS.map(function(l) {
        return '<label class="oqb-layout' + (layout === l.id ? ' is-on' : '') + '">'
          + '<input type="radio" name="oqb-layout" value="' + l.id + '"' + (layout === l.id ? ' checked' : '') + '>'
          + '<strong>' + esc(l.label) + '</strong><span>' + esc(l.hint) + '</span></label>';
      }).join('') + '</div></div>'
      + '<div class="oqb-section"><h4>Wizard steps</h4>'
      + '<p class="oqb-hint" style="margin-top:0">Each step is editable: rename the customer-facing label, drag or use arrows to reorder, set when it appears, or remove it. Contact is locked as the final step.</p>'
      + '<div class="oqb-steps" data-oqb-sortable="1">' + this._renderStepRows() + '</div>'
      + '<div class="oqb-step-actions">' + this._renderStepActions() + '</div></div>';
  };

  QuoteBuilder.prototype._itemCard = function(title, idx, path, fieldsHtml, moveUp, moveDown) {
    return '<div class="oqb-item" data-oqb-item="' + esc(path) + '" data-oqb-idx="' + idx + '">'
      + '<div class="oqb-item-head"><strong>' + esc(title) + '</strong>'
      + '<div class="oqb-item-tools">'
      + (moveUp ? '<button type="button" class="oqb-iconbtn" data-oqb-move="up" title="Move up">↑</button>' : '')
      + (moveDown ? '<button type="button" class="oqb-iconbtn" data-oqb-move="down" title="Move down">↓</button>' : '')
      + '<button type="button" class="oqb-iconbtn oqb-danger" data-oqb-remove title="Remove">×</button>'
      + '</div></div>'
      + '<div class="oqb-item-body">' + fieldsHtml + '</div></div>';
  };

  QuoteBuilder.prototype._renderProducts = function() {
    var self = this;
    var list = this.config.products || [];
    var cards = list.map(function(p, i) {
      var fields = '<div class="oqb-grid">'
        + self._field('Name', '<input type="text" data-oqb-path="products.' + i + '.label" value="' + esc(p.label || '') + '">')
        + self._field('Icon', self._iconSelect('products.' + i + '.icon', p.icon || ''))
        + self._field('Base price (ex GST line)', self._money('products.' + i + '.baseCents', p.baseCents))
        + self._field('Description', '<textarea rows="2" data-oqb-path="products.' + i + '.description">' + esc(p.description || '') + '</textarea>')
        + '<input type="hidden" data-oqb-path="products.' + i + '.id" value="' + esc(p.id || '') + '">'
        + '<input type="hidden" data-oqb-path="products.' + i + '.type" value="' + esc(p.type || 'equipment') + '">'
        + '</div>';
      return self._itemCard(p.label || 'New product', i, 'products', fields, i > 0, i < list.length - 1);
    }).join('');
    return '<p class="oqb-hint">Equipment or service lines the customer picks first. Each has a base price plus labour/packages.</p>'
      + '<div class="oqb-items">' + (cards || '<p class="oqb-empty">No products yet.</p>') + '</div>'
      + '<button type="button" class="btn ghost" data-oqb-add="products">+ Add product</button>';
  };

  QuoteBuilder.prototype._renderLabour = function() {
    var l = this.config.labour || {};
    return '<div class="oqb-grid">'
      + this._field('Labour label', '<input type="text" data-oqb-path="labour.label" value="' + esc(l.label || 'Labour') + '">')
      + this._field('Hourly rate', this._money('labour.hourlyCents', l.hourlyCents))
      + this._field('Minimum hours', '<input type="number" min="1" max="24" data-oqb-path="labour.minimumHours" value="' + esc(l.minimumHours != null ? l.minimumHours : 3) + '">')
      + '</div>'
      + '<p class="oqb-hint">Labour is multiplied by event duration. Shorter events still bill the minimum hours.</p>';
  };

  QuoteBuilder.prototype._renderPackages = function() {
    var self = this;
    var list = this.config.beverages || [];
    var cards = list.map(function(b, i) {
      var fields = '<div class="oqb-grid">'
        + self._field('Package name', '<input type="text" data-oqb-path="beverages.' + i + '.label" value="' + esc(b.label || '') + '">')
        + self._field('Icon', self._iconSelect('beverages.' + i + '.icon', b.icon || ''))
        + self._field('Per guest over included ($)', self._money('beverages.' + i + '.perHeadCents', b.perHeadCents))
        + self._field('Guests included free', '<input type="number" min="0" data-oqb-path="beverages.' + i + '.includedHeads" value="' + esc(b.includedHeads != null ? b.includedHeads : 0) + '">')
        + self._field('Flat package price (optional)', self._money('beverages.' + i + '.packageCents', b.packageCents))
        + self._field('Description', '<textarea rows="2" data-oqb-path="beverages.' + i + '.description">' + esc(b.description || '') + '</textarea>')
        + self._showWhenChips('beverages.' + i, b)
        + '<input type="hidden" data-oqb-path="beverages.' + i + '.id" value="' + esc(b.id || '') + '">'
        + '</div>';
      return self._itemCard(b.label || 'New package', i, 'beverages', fields, i > 0, i < list.length - 1);
    }).join('');
    return '<p class="oqb-hint">Per-head beverage or catering packages. Leave empty if not applicable.</p>'
      + '<div class="oqb-items">' + (cards || '<p class="oqb-empty">No packages yet.</p>') + '</div>'
      + '<button type="button" class="btn ghost" data-oqb-add="packages">+ Add package</button>';
  };

  QuoteBuilder.prototype._renderAddons = function() {
    var self = this;
    var list = this.config.addons || [];
    var cards = list.map(function(a, i) {
      var fields = '<div class="oqb-grid">'
        + self._field('Add-on name', '<input type="text" data-oqb-path="addons.' + i + '.label" value="' + esc(a.label || '') + '">')
        + self._field('Icon', self._iconSelect('addons.' + i + '.icon', a.icon || ''))
        + self._field('Fixed price', self._money('addons.' + i + '.fixedCents', a.fixedCents))
        + self._field('Description', '<textarea rows="2" data-oqb-path="addons.' + i + '.description">' + esc(a.description || '') + '</textarea>')
        + self._showWhenChips('addons.' + i, a)
        + '<input type="hidden" data-oqb-path="addons.' + i + '.id" value="' + esc(a.id || '') + '">'
        + '</div>';
      return self._itemCard(a.label || 'New add-on', i, 'addons', fields, i > 0, i < list.length - 1);
    }).join('');
    return '<p class="oqb-hint">Optional extras the customer can toggle on — branding, upgrades, additional staff, etc.</p>'
      + '<div class="oqb-items">' + (cards || '<p class="oqb-empty">No add-ons yet.</p>') + '</div>'
      + '<button type="button" class="btn ghost" data-oqb-add="addons">+ Add add-on</button>';
  };

  QuoteBuilder.prototype._renderTravel = function() {
    var self = this;
    var list = (this.config.travel && this.config.travel.zones) || [];
    var cards = list.map(function(z, i) {
      var fields = '<div class="oqb-grid">'
        + self._field('Zone name', '<input type="text" data-oqb-path="travel.zones.' + i + '.label" value="' + esc(z.label || '') + '">')
        + self._field('Icon', self._iconSelect('travel.zones.' + i + '.icon', z.icon || 'map-pin'))
        + self._field('Travel fee', self._money('travel.zones.' + i + '.feeCents', z.feeCents))
        + '<input type="hidden" data-oqb-path="travel.zones.' + i + '.id" value="' + esc(z.id || '') + '">'
        + '</div>';
      return self._itemCard(z.label || 'New zone', i, 'travel.zones', fields, i > 0, i < list.length - 1);
    }).join('');
    return '<p class="oqb-hint">Distance or region fees. Add the <strong>Travel zone</strong> step in Wizard flow so customers pick a zone.</p>'
      + '<div class="oqb-items">' + (cards || '<p class="oqb-empty">No travel zones — all areas free.</p>') + '</div>'
      + '<button type="button" class="btn ghost" data-oqb-add="travel">+ Add travel zone</button>';
  };

  QuoteBuilder.prototype._renderRules = function() {
    var r = this.config.rules || {};
    return '<div class="oqb-grid">'
      + this._field('Quote valid (days)', '<input type="number" min="1" data-oqb-path="rules.quoteValidityDays" value="' + esc(r.quoteValidityDays != null ? r.quoteValidityDays : 14) + '">')
      + this._field('Minimum notice (days)', '<input type="number" min="0" data-oqb-path="rules.minimumNoticeDays" value="' + esc(r.minimumNoticeDays != null ? r.minimumNoticeDays : 3) + '">')
      + '</div>';
  };

  QuoteBuilder.prototype._setPath = function(path, value) {
    var parts = path.split('.');
    var obj = this.config;
    for (var i = 0; i < parts.length - 1; i++) {
      var key = parts[i];
      if (obj[key] == null) obj[key] = /^\d+$/.test(parts[i + 1]) ? [] : {};
      obj = obj[key];
    }
    var last = parts[parts.length - 1];
    if (last === 'gstRegistered') obj[last] = !!value;
    else if (/Cents$/.test(last) || last === 'hourlyCents' || last === 'feeCents' || last === 'fixedCents' || last === 'perHeadCents' || last === 'packageCents' || last === 'baseCents') {
      obj[last] = cents(value);
    } else if (last === 'minimumHours' || last === 'includedHeads' || last === 'quoteValidityDays' || last === 'minimumNoticeDays') {
      obj[last] = parseInt(value, 10) || 0;
    } else {
      obj[last] = value;
    }
    if (path.match(/\.label$/) && path.indexOf('products.') >= 0) {
      var m = path.match(/products\.(\d+)\.label/);
      if (m) {
        var pi = parseInt(m[1], 10);
        if (this.config.products[pi] && !this.config.products[pi].id) {
          this.config.products[pi].id = slugify(value);
        }
      }
    }
  };

  QuoteBuilder.prototype._syncFromDom = function() {
    var self = this;
    this.root.querySelectorAll('[data-oqb-path]').forEach(function(el) {
      var path = el.getAttribute('data-oqb-path');
      var val;
      if (el.type === 'checkbox') val = el.checked;
      else val = el.value;
      self._setPath(path, val);
    });
    this.root.querySelectorAll('[data-oqb-step-label]').forEach(function(el) {
      var step = el.getAttribute('data-oqb-step-label');
      if (!self.config.wizard.stepLabels) self.config.wizard.stepLabels = {};
      self.config.wizard.stepLabels[step] = el.value;
    });
    var layout = this.root.querySelector('input[name="oqb-layout"]:checked');
    if (layout) this.config.wizard.layout = layout.value;
  };

  QuoteBuilder.prototype._wire = function() {
    var self = this;

    this.root.querySelectorAll('[data-oqb-tab]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        self._syncFromDom();
        self.tab = btn.getAttribute('data-oqb-tab');
        self._render();
      });
    });

    this.root.querySelectorAll('[data-oqb-step-label]').forEach(function(inp) {
      inp.addEventListener('input', function() {
        var step = inp.getAttribute('data-oqb-step-label');
        if (!self.config.wizard.stepLabels) self.config.wizard.stepLabels = {};
        self.config.wizard.stepLabels[step] = inp.value;
        self._refreshPreview();
      });
    });

    this.root.querySelectorAll('[data-oqb-step-move]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        self._syncFromDom();
        self._moveWizardStep(btn.getAttribute('data-oqb-step-id'), btn.getAttribute('data-oqb-step-move'));
        self._render();
      });
    });

    var tj = this.root.querySelector('[data-oqb="toggle-json"]');
    if (tj) tj.addEventListener('click', function() {
      if (self.showJson) {
        var ta = self.root.querySelector('[data-oqb="json"]');
        try { self.config = normalizeConfig(JSON.parse(ta.value)); } catch (e) { alert('Invalid JSON — fix before switching back.'); return; }
      } else {
        self._syncFromDom();
      }
      self.showJson = !self.showJson;
      self._render();
    });

    this.root.querySelectorAll('[data-oqb-path]').forEach(function(el) {
      var ev = (el.tagName === 'SELECT' || el.type === 'checkbox') ? 'change' : 'input';
      el.addEventListener(ev, function() {
        self._setPath(el.getAttribute('data-oqb-path'), el.type === 'checkbox' ? el.checked : el.value);
        if (el.getAttribute('data-oqb-path').indexOf('.icon') >= 0) self._render();
        else self._refreshPreview();
      });
    });

    this.root.querySelectorAll('[data-oqb-step-cond]').forEach(function(sel) {
      sel.addEventListener('change', function() {
        self._syncFromDom();
        self._setStepCondition(sel.getAttribute('data-oqb-step-cond'), sel.value);
        self._refreshPreview();
      });
    });

    this.root.querySelectorAll('[data-oqb-step-remove]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        self._syncFromDom();
        var stepId = btn.getAttribute('data-oqb-step-remove');
        self.config.wizard.steps = (self.config.wizard.steps || []).filter(function(s) { return s !== stepId; });
        if (self.config.wizard.steps.indexOf('contact') < 0) self.config.wizard.steps.push('contact');
        self._render();
      });
    });

    this.root.querySelectorAll('[data-oqb-showwhen-all]').forEach(function(cb) {
      cb.addEventListener('change', function() {
        self._syncFromDom();
        var path = cb.getAttribute('data-oqb-showwhen-all');
        self._setShowWhen(path, cb.checked ? null : { field: 'productId', values: [] });
        self._render();
      });
    });

    this.root.querySelectorAll('[data-oqb-showwhen-val]').forEach(function(cb) {
      cb.addEventListener('change', function() {
        self._syncFromDom();
        var path = cb.getAttribute('data-oqb-showwhen-val');
        var card = cb.closest('.oqb-item');
        if (!card) return;
        var vals = [];
        card.querySelectorAll('[data-oqb-showwhen-val]:checked').forEach(function(c) { vals.push(c.value); });
        var allCb = card.querySelector('[data-oqb-showwhen-all]');
        if (allCb) allCb.checked = vals.length === 0;
        self._setShowWhen(path, vals.length ? { field: 'productId', values: vals } : null);
        self._refreshPreview();
      });
    });

    var sortable = this.root.querySelector('[data-oqb-sortable]');
    if (sortable) {
      var dragIdx = null;
      sortable.querySelectorAll('.oqb-step-row[draggable="true"]').forEach(function(row) {
        row.addEventListener('dragstart', function(e) {
          dragIdx = parseInt(row.getAttribute('data-oqb-step-idx'), 10);
          row.classList.add('is-dragging');
          if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
        });
        row.addEventListener('dragend', function() {
          row.classList.remove('is-dragging');
          sortable.querySelectorAll('.oqb-step-row').forEach(function(r) { r.classList.remove('is-dragover'); });
          dragIdx = null;
        });
        row.addEventListener('dragenter', function(e) {
          e.preventDefault();
          sortable.querySelectorAll('.oqb-step-row').forEach(function(r) { r.classList.remove('is-dragover'); });
          row.classList.add('is-dragover');
        });
        row.addEventListener('dragleave', function() {
          row.classList.remove('is-dragover');
        });
        row.addEventListener('dragover', function(e) {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        });
        row.addEventListener('drop', function(e) {
          e.preventDefault();
          row.classList.remove('is-dragover');
          if (dragIdx == null) return;
          var dropIdx = parseInt(row.getAttribute('data-oqb-step-idx'), 10);
          if (isNaN(dropIdx) || dragIdx === dropIdx) return;
          self._syncFromDom();
          var steps = self._editableSteps();
          var moved = steps.splice(dragIdx, 1)[0];
          steps.splice(dropIdx, 0, moved);
          self.config.wizard.steps = steps.concat(['contact']);
          self._render();
        });
      });
    }

    this.root.querySelectorAll('[data-oqb-step]').forEach(function(cb) {
      cb.addEventListener('change', function() {
        self._syncFromDom();
        var step = cb.getAttribute('data-oqb-step');
        var steps = (self.config.wizard.steps || []).slice();
        if (cb.checked) {
          if (step !== 'contact' && steps.indexOf('contact') >= 0) {
            steps.splice(steps.indexOf('contact'), 1);
            steps.push(step);
            steps.push('contact');
          } else if (steps.indexOf(step) < 0) steps.push(step);
        } else if (step !== 'contact') {
          steps = steps.filter(function(s) { return s !== step; });
        }
        if (steps.indexOf('contact') < 0) steps.push('contact');
        self.config.wizard.steps = steps;
        self._render();
      });
    });

    this.root.querySelectorAll('[data-oqb-add-step]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        self._syncFromDom();
        var step = btn.getAttribute('data-oqb-add-step');
        var steps = (self.config.wizard.steps || []).slice();
        if (steps.indexOf('contact') >= 0) steps.splice(steps.indexOf('contact'), 1);
        if (steps.indexOf(step) < 0) steps.push(step);
        steps.push('contact');
        self.config.wizard.steps = steps;
        self._render();
      });
    });

    this.root.querySelectorAll('[data-oqb-add]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        self._syncFromDom();
        var kind = btn.getAttribute('data-oqb-add');
        if (kind === 'products') self.config.products.push({ id: uid('product'), label: 'New product', type: 'equipment', baseCents: 0, icon: 'package' });
        if (kind === 'packages') self.config.beverages.push({ id: uid('bev'), label: 'New package', perHeadCents: 0, includedHeads: 0, icon: 'users' });
        if (kind === 'addons') self.config.addons.push({ id: uid('addon'), label: 'New add-on', fixedCents: 0, icon: 'plus-circle' });
        if (kind === 'travel') {
          if (!self.config.travel) self.config.travel = { zones: [] };
          self.config.travel.zones.push({ id: uid('zone'), label: 'New zone', feeCents: 0, icon: 'map-pin' });
          var wsteps = (self.config.wizard.steps || []).slice();
          if (wsteps.indexOf('travel') < 0) {
            if (wsteps.indexOf('contact') >= 0) wsteps.splice(wsteps.indexOf('contact'), 0, 'travel');
            else wsteps.push('travel');
            self.config.wizard.steps = wsteps;
          }
        }
        self._render();
      });
    });

    this.root.querySelectorAll('[data-oqb-remove]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        self._syncFromDom();
        var card = btn.closest('[data-oqb-item]');
        if (!card) return;
        var path = card.getAttribute('data-oqb-item');
        var idx = parseInt(card.getAttribute('data-oqb-idx'), 10);
        if (path === 'products') self.config.products.splice(idx, 1);
        else if (path === 'beverages') self.config.beverages.splice(idx, 1);
        else if (path === 'addons') self.config.addons.splice(idx, 1);
        else if (path === 'travel.zones') self.config.travel.zones.splice(idx, 1);
        self._render();
      });
    });

    this.root.querySelectorAll('[data-oqb-move]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        self._syncFromDom();
        var card = btn.closest('[data-oqb-item]');
        if (!card) return;
        var path = card.getAttribute('data-oqb-item');
        var idx = parseInt(card.getAttribute('data-oqb-idx'), 10);
        var dir = btn.getAttribute('data-oqb-move');
        var list;
        if (path === 'products') list = self.config.products;
        else if (path === 'beverages') list = self.config.beverages;
        else if (path === 'addons') list = self.config.addons;
        else if (path === 'travel.zones') list = self.config.travel.zones;
        if (!list) return;
        var j = dir === 'up' ? idx - 1 : idx + 1;
        if (j < 0 || j >= list.length) return;
        var tmp = list[idx];
        list[idx] = list[j];
        list[j] = tmp;
        self._render();
      });
    });
  };

  QuoteBuilder.prototype._setShowWhen = function(path, when) {
    var parts = path.split('.');
    var list = this.config[parts[0]];
    var idx = parseInt(parts[1], 10);
    if (!list || !list[idx]) return;
    if (!when) delete list[idx].showWhen;
    else list[idx].showWhen = when;
  };

  QuoteBuilder.prototype._reconcilePreviewSelections = function() {
    var shell = this._toShell();
    var p = this.previewProgress;
    var W = wl();
    var bevs = W.filterByShowWhen ? W.filterByShowWhen(shell.beverages, p) : shell.beverages;
    if (p.beverageId && !bevs.some(function(b) { return b.id === p.beverageId; })) p.beverageId = '';
    var addons = W.filterByShowWhen ? W.filterByShowWhen(shell.addons, p) : shell.addons;
    var ids = addons.map(function(a) { return a.id; });
    p.addonIds = (p.addonIds || []).filter(function(id) { return ids.indexOf(id) >= 0; });
  };

  QuoteBuilder.prototype._clampPreviewStep = function() {
    var shell = this._toShell();
    var W = wl();
    var steps = W.resolveWizardSteps
      ? W.resolveWizardSteps(shell.wizard, this.previewProgress, shell.travelZones.length)
      : (shell.wizard.steps || ['contact']);
    if (this.previewStep >= steps.length) this.previewStep = Math.max(0, steps.length - 1);
  };

  QuoteBuilder.prototype._wirePreview = function() {
    var self = this;
    if (!this.previewRoot) return;
    var root = this.previewRoot;

    root.querySelectorAll('[data-prev-pick]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var key = btn.getAttribute('data-prev-pick');
        self.previewProgress[key] = btn.getAttribute('data-val');
        if (key === 'productId') self._reconcilePreviewSelections();
        self._clampPreviewStep();
        self._refreshPreview();
      });
    });

    root.querySelectorAll('[data-prev-addon]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-prev-addon');
        var idx = self.previewProgress.addonIds.indexOf(id);
        if (idx >= 0) self.previewProgress.addonIds.splice(idx, 1);
        else self.previewProgress.addonIds.push(id);
        self._refreshPreview();
      });
    });

    root.querySelectorAll('[data-prev-field]').forEach(function(inp) {
      inp.addEventListener('change', function() {
        var f = inp.getAttribute('data-prev-field');
        var v = parseInt(inp.value, 10) || 0;
        self.previewProgress[f] = v;
        self._refreshPreview();
      });
    });

    root.querySelectorAll('[data-prev-act]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var act = btn.getAttribute('data-prev-act');
        var shell = self._toShell();
        var W = wl();
        var steps = W.resolveWizardSteps
          ? W.resolveWizardSteps(shell.wizard, self.previewProgress, shell.travelZones.length)
          : (shell.wizard.steps || ['contact']);
        if (act === 'back') self.previewStep = Math.max(0, self.previewStep - 1);
        else if (act === 'next') self.previewStep = Math.min(steps.length - 1, self.previewStep + 1);
        self._refreshPreview();
      });
    });
  };

  global.LPQuoteBuilder = {
    mount: function(el, options) {
      if (!el) return null;
      return new QuoteBuilder(el, options || {});
    },
    normalizeConfig: normalizeConfig
  };
})(window);
