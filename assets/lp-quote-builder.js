/**
 * LeadPages Online Quote — visual SaaS-style config builder for manage.html
 */
(function(global) {
  'use strict';

  var STEP_CATALOG = [
    { id: 'equipment', label: 'Equipment / products', icon: 'package' },
    { id: 'event', label: 'Event details', icon: 'calendar' },
    { id: 'beverages', label: 'Packages / per-head', icon: 'users' },
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

  function QuoteBuilder(root, options) {
    this.root = root;
    this.config = normalizeConfig(options && options.config);
    this.tab = 'overview';
    this.showJson = false;
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

  QuoteBuilder.prototype._renderOverview = function() {
    var c = this.config;
    var b = c.business || {};
    return '<div class="oqb-grid">'
      + this._field('Business name', '<input type="text" data-oqb-path="business.name" value="' + esc(b.name || '') + '">')
      + this._field('Tagline', '<input type="text" data-oqb-path="business.tagline" value="' + esc(b.tagline || '') + '">')
      + this._field('GST registered', '<label class="oqb-check"><input type="checkbox" data-oqb-path="business.gstRegistered"' + (b.gstRegistered !== false ? ' checked' : '') + '> Prices include 10% GST on quotes</label>')
      + '</div>'
      + '<div class="oqb-summary">'
      + '<div class="oqb-stat"><b>' + (c.products || []).length + '</b><span>Products</span></div>'
      + '<div class="oqb-stat"><b>' + (c.beverages || []).length + '</b><span>Packages</span></div>'
      + '<div class="oqb-stat"><b>' + (c.addons || []).length + '</b><span>Add-ons</span></div>'
      + '<div class="oqb-stat"><b>' + ((c.wizard && c.wizard.steps) || []).length + '</b><span>Wizard steps</span></div>'
      + '</div>'
      + '<p class="oqb-hint">Use the tabs above to add/remove options, change prices, pick icons and tune the customer journey.</p>';
  };

  QuoteBuilder.prototype._renderWizard = function() {
    var self = this;
    var w = this.config.wizard || {};
    var steps = w.steps || [];
    var layout = w.layout || 'cards';
    var labels = w.stepLabels || {};

    var stepRows = STEP_CATALOG.map(function(step) {
      var on = steps.indexOf(step.id) >= 0;
      var order = on ? (steps.indexOf(step.id) + 1) : '';
      return '<div class="oqb-step-row' + (on ? ' is-on' : '') + '">'
        + '<label class="oqb-check oqb-step-toggle"><input type="checkbox" data-oqb-step="' + step.id + '"' + (on ? ' checked' : '') + '>'
        + iconSvg(step.icon) + '<span>' + esc(step.label) + '</span></label>'
        + (on ? '<input type="text" class="oqb-step-label" placeholder="Step label on wizard" data-oqb-step-label="' + step.id + '" value="' + esc(labels[step.id] || step.label) + '">' : '')
        + (on ? '<span class="oqb-step-order">#' + order + '</span>' : '')
        + '</div>';
    }).join('');

    return '<div class="oqb-section"><h4>Layout style</h4><div class="oqb-layouts">'
      + LAYOUTS.map(function(l) {
        return '<label class="oqb-layout' + (layout === l.id ? ' is-on' : '') + '">'
          + '<input type="radio" name="oqb-layout" value="' + l.id + '"' + (layout === l.id ? ' checked' : '') + '>'
          + '<strong>' + esc(l.label) + '</strong><span>' + esc(l.hint) + '</span></label>';
      }).join('') + '</div></div>'
      + '<div class="oqb-section"><h4>Wizard steps</h4><p class="oqb-hint">Turn steps on/off and drag order with the arrows. Contact is always last.</p>'
      + '<div class="oqb-steps">' + stepRows + '</div>'
      + '<div class="oqb-step-actions">'
      + STEP_CATALOG.filter(function(s) { return steps.indexOf(s.id) < 0; }).map(function(s) {
        return '<button type="button" class="btn ghost oqb-btn-sm" data-oqb-add-step="' + s.id + '">+ ' + esc(s.label) + '</button>';
      }).join(' ')
      + '</div></div>';
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
        + self._field('Travel fee', self._money('travel.zones.' + i + '.feeCents', z.feeCents))
        + '<input type="hidden" data-oqb-path="travel.zones.' + i + '.id" value="' + esc(z.id || '') + '">'
        + '</div>';
      return self._itemCard(z.label || 'New zone', i, 'travel.zones', fields, i > 0, i < list.length - 1);
    }).join('');
    return '<p class="oqb-hint">Distance or region fees added to the quote total.</p>'
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
      });
    });

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
          self.config.travel.zones.push({ id: uid('zone'), label: 'New zone', feeCents: 0 });
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

  global.LPQuoteBuilder = {
    mount: function(el, options) {
      if (!el) return null;
      return new QuoteBuilder(el, options || {});
    },
    normalizeConfig: normalizeConfig
  };
})(window);
