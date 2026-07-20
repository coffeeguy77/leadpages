/**
 * LeadPages Online Quote — visual SaaS-style config builder for manage.html
 */
(function(global) {
  'use strict';

  var STEP_CATALOG = (global.LPQuoteWizardLogic && global.LPQuoteWizardLogic.STEP_CATALOG) || [
    { id: 'equipment', label: 'Equipment / products', icon: 'package' },
    { id: 'event', label: 'Event details', icon: 'calendar' },
    { id: 'beverages', label: 'Packages / catering', icon: 'users' },
    { id: 'travel', label: 'Travel zone', icon: 'map-pin' },
    { id: 'addons', label: 'Add-ons & extras', icon: 'plus-circle' },
    { id: 'custom', label: 'Custom questions', icon: 'sparkles' },
    { id: 'contact', label: 'Contact details', icon: 'mail' }
  ];

  var CUSTOM_FIELD_TYPES = (global.LPQuoteWizardLogic && global.LPQuoteWizardLogic.CUSTOM_FIELD_TYPES) || [
    'text', 'textarea', 'email', 'tel', 'number', 'select', 'checkbox', 'date'
  ];

  var LAYOUTS = [
    { id: 'cards', label: 'Choice cards', hint: 'Large tappable cards in a row — best for 2–6 options' },
    { id: 'grid', label: 'Choice grid', hint: 'Multi-column cards with images — great for equipment' },
    { id: 'list', label: 'Compact list', hint: 'Stacked rows — good for many options' },
    { id: 'split', label: 'Split panel', hint: 'Label left, choices right — desktop-friendly' }
  ];

  var ICON_OPTIONS = [
    'coffee', 'truck', 'users', 'gift', 'map-pin', 'clock', 'star', 'shield-check',
    'zap', 'check-circle', 'package', 'calendar', 'plus-circle', 'mail', 'phone',
    'heart', 'award', 'sparkles', 'cup-soda', 'chef-hat'
  ];

  var IMAGE_SIZE_OPTIONS = (global.LPQuoteDisplay && global.LPQuoteDisplay.IMAGE_SIZE_OPTIONS) || [
    { id: 'compact', label: 'Compact (56px)' },
    { id: 'standard', label: 'Standard (80px)' },
    { id: 'large', label: 'Large (120px)' },
    { id: 'hero', label: 'Hero (180px)' }
  ];

  function displayApi() { return global.LPQuoteDisplay || {}; }

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
    if (!cfg.wizard.equipmentCards) cfg.wizard.equipmentCards = {};
    if (!cfg.wizard.ui) cfg.wizard.ui = {};
    if (cfg.wizard.allowMultiCart == null) cfg.wizard.allowMultiCart = false;
    var Wnorm = wl();
    if (Wnorm.normalizeCustomFields) {
      cfg.wizard.customFields = Wnorm.normalizeCustomFields(cfg.wizard.customFields);
    } else if (!Array.isArray(cfg.wizard.customFields)) {
      cfg.wizard.customFields = [];
    }
    if (Wnorm.ensureCustomStepInSteps) {
      cfg.wizard.steps = Wnorm.ensureCustomStepInSteps(cfg.wizard.steps, cfg.wizard.customFields);
    }
    cfg.products = Array.isArray(cfg.products) ? cfg.products : [];
    cfg.beverages = Array.isArray(cfg.beverages) ? cfg.beverages : [];
    cfg.addons = Array.isArray(cfg.addons) ? cfg.addons : [];
    if (!cfg.labour) cfg.labour = { label: 'Labour', hourlyCents: 7500, minimumHours: 3 };
    if (cfg.labour.allowShiftPlanner == null) cfg.labour.allowShiftPlanner = true;
    if (cfg.labour.minimumHoursPerShift == null) cfg.labour.minimumHoursPerShift = cfg.labour.minimumHours || 3;
    if (!cfg.labour.extraBarista) cfg.labour.extraBarista = { enabled: true, label: 'Additional barista', hourlyCents: cfg.labour.hourlyCents || 7500 };
    if (!cfg.travel) cfg.travel = { zones: [] };
    if (!Array.isArray(cfg.travel.zones)) cfg.travel.zones = [];
    if (!cfg.rules) cfg.rules = { gstRate: 0.1, quoteValidityDays: 14, minimumNoticeDays: 3 };
    cfg.products.forEach(function(p, i) {
      if (!p.id) p.id = slugify(p.label) || uid('product');
      if (!p.type) p.type = 'equipment';
      if (p.baristasIncluded == null) p.baristasIncluded = 1;
      if (p.allowExtraBarista == null) p.allowExtraBarista = true;
      if (p.allowQuantity == null) p.allowQuantity = false;
      if (p.maxQuantity != null) {
        var mq = parseInt(p.maxQuantity, 10);
        p.maxQuantity = (!isNaN(mq) && mq > 0) ? mq : null;
      }
      if (!p.imageFit) p.imageFit = 'cover';
      if (!p.imagePos) p.imagePos = 'center';
      if (p.imageAxis !== 'height' && p.imageAxis !== 'width' && p.imageAxis !== 'frame') p.imageAxis = 'frame';
      if (p.imageScale == null) p.imageScale = 100;
    });
    cfg.beverages.forEach(function(b) {
      if (!b.id) b.id = slugify(b.label) || uid('bev');
      if (!b.pricingMode) b.pricingMode = (b.tiers && b.tiers.length) ? 'tiered' : (b.packageCents && !b.perHeadCents ? 'flat' : 'per_head');
      if (!Array.isArray(b.tiers)) b.tiers = [];
      if (b.group == null && b.category) b.group = b.category;
      if (b.group == null) b.group = '';
      if (b.minQuantity != null && b.minQuantity !== '') {
        var bmin = parseInt(b.minQuantity, 10);
        b.minQuantity = (!isNaN(bmin) && bmin > 0) ? Math.min(50000, bmin) : null;
      } else {
        b.minQuantity = null;
      }
    });
    cfg.addons.forEach(function(a) { if (!a.id) a.id = slugify(a.label) || uid('addon'); });
    cfg.travel.zones.forEach(function(z) {
      if (!z.id) z.id = slugify(z.label) || uid('zone');
      if (z.badge == null) z.badge = '';
      if (z.subtitle == null) z.subtitle = '';
      if (z.description == null) z.description = '';
      if (!z.imageFit) z.imageFit = 'cover';
      if (!z.imagePos) z.imagePos = 'center';
      if (z.imageAxis !== 'height' && z.imageAxis !== 'width' && z.imageAxis !== 'frame') z.imageAxis = 'frame';
    });
    ['products', 'beverages', 'addons'].forEach(function(key) {
      (cfg[key] || []).forEach(function(item) {
        if (!item.displayMode) {
          item.displayMode = item.imageUrl ? 'image' : (item.icon ? 'icon' : 'text');
        }
        if (item.imageScale == null) item.imageScale = 100;
        if (!item.imageSize) item.imageSize = 'standard';
      });
    });
    (cfg.travel.zones || []).forEach(function(z) {
      if (!z.displayMode) z.displayMode = z.imageUrl ? 'image' : (z.icon ? 'icon' : 'text');
      if (z.imageScale == null) z.imageScale = 100;
      if (!z.imageSize) z.imageSize = 'standard';
    });
    if (!cfg.wizard.travelCards) cfg.wizard.travelCards = {};
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
    this.headRoot = (options && options.headRoot) || null;
    this.sectionRoot = (options && options.sectionRoot) || null;
    this.section = (options && options.section) || {};
    this.onSectionChange = (options && options.onSectionChange) || null;
    this.themeAccent = (options && options.themeAccent) || '';
    this.media = (options && options.media) || null;
    this.config = normalizeConfig(options && options.config);
    this.tab = (options && options.initialTab) || 'wizard';
    this.showJson = false;
    this.previewProgress = {
      productId: '', hours: 3, eventDate: '', guestCount: 50, unitCount: null,
      labourPlanning: 'hours', eventConfigMode: 'same', shifts: [], carts: [],
      beverageId: '', beverageLines: [], addonIds: [], travelZoneId: '', customAnswers: {}
    };
    this.previewStep = 0;
    this.previewZoom = 100;
    this.previewFocusCard = false;
    this.previewPinEquipment = false;
    this._render();
  }

  QuoteBuilder.prototype.getConfig = function() {
    return normalizeConfig(this.config);
  };

  QuoteBuilder.prototype.loadConfig = function(raw) {
    this.config = normalizeConfig(raw);
    this.previewStep = 0;
    this._render();
  };

  QuoteBuilder.prototype._render = function() {
    var self = this;
    var c = this.config;
    var tabs = [
      ['overview', 'Overview'],
      ['wizard', 'Wizard flow'],
      ['questions', 'Questions'],
      ['products', 'Products'],
      ['labour', 'Labour'],
      ['packages', 'Packages'],
      ['addons', 'Add-ons'],
      ['travel', 'Travel'],
      ['rules', 'Rules']
    ];
    var headHtml = '<div class="oqb-head"><div><h3 class="oqb-title">Quote builder</h3>'
      + '<p class="oqb-lede">Design your quote wizard — steps, icons, prices and scenarios. Saving creates a new live config version.</p></div>'
      + '<div class="oqb-head-actions">'
      + '<button type="button" class="btn ghost oqb-btn-sm" data-oqb="toggle-json">' + (this.showJson ? 'Visual builder' : 'Advanced JSON') + '</button>'
      + '</div></div>';

    if (this.headRoot) {
      this.headRoot.innerHTML = '<div class="oqb">' + headHtml + '</div>';
    }

    var html = '<div class="oqb">';
    if (!this.headRoot) html += headHtml;

    if (this.showJson) {
      html += '<textarea class="oqb-json" data-oqb="json">' + esc(JSON.stringify(c, null, 2)) + '</textarea>';
      if (this.sectionRoot) this.sectionRoot.innerHTML = '';
      if (this.previewRoot) this.previewRoot.innerHTML = '';
    } else {
      html += '<div class="oqb-tabs">' + tabs.map(function(t) {
        return '<button type="button" class="oqb-tab' + (self.tab === t[0] ? ' is-on' : '') + '" data-oqb-tab="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div>';
      html += '<div class="oqb-body">' + this._renderTab() + '</div>';
      // Page section / colours / container style live under Wizard colours (see _renderWizard)
      if (this.sectionRoot) this.sectionRoot.innerHTML = '';
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
      wizard: c.wizard || {},
      labour: c.labour || {}
    };
  };

  /** Preview-only shell: fill empty colour overrides with design defaults so swatches match the mock. */
  QuoteBuilder.prototype._previewShell = function() {
    var shell = this._toShell();
    var accent = this._accent();
    var w = Object.assign({}, shell.wizard || {});
    var uiIn = w.ui || {};
    var ecIn = w.equipmentCards || {};
    var ui = Object.assign({}, uiIn);
    var ec = Object.assign({}, ecIn);
    var panel = ui.panelBg || '#2e282a';
    function fill(obj, key, fb) { if (!obj[key]) obj[key] = fb; }
    fill(ui, 'panelBg', panel);
    fill(ui, 'panelBorder', accent);
    fill(ui, 'titleColor', accent);
    fill(ui, 'introColor', accent);
    fill(ui, 'mutedColor', '#a8989e');
    fill(ui, 'labelColor', accent);
    fill(ui, 'fieldText', '#ffffff');
    fill(ui, 'fieldBg', '#3a3436');
    fill(ui, 'choiceText', accent);
    fill(ui, 'choiceDesc', '#c4b4ba');
    fill(ui, 'bodyText', '#ffffff');
    fill(ui, 'progressBg', '#ffffff');
    fill(ui, 'progressText', accent);
    fill(ui, 'progressBorder', accent);
    fill(ui, 'progressActiveBg', accent);
    fill(ui, 'progressActiveText', '#ffffff');
    fill(ui, 'progressActiveBorder', accent);
    fill(ui, 'progressDoneText', accent);
    fill(ui, 'progressDoneBorder', accent);
    fill(ui, 'btnBg', accent);
    fill(ui, 'btnText', '#ffffff');
    fill(ui, 'btnGhostBg', '#ffffff');
    fill(ui, 'btnGhostText', accent);
    fill(ui, 'btnGhostBorder', accent);
    fill(ec, 'cardBg', panel);
    fill(ec, 'imageBg', '#524b4f');
    fill(ec, 'titleColor', accent);
    fill(ec, 'descColor', accent);
    fill(ec, 'qtyColor', accent);
    fill(ec, 'qtyStroke', accent);
    fill(ec, 'qtyBg', '#ffffff');
    fill(ec, 'featureColor', accent);
    fill(ec, 'strokeColor', accent);
    if (ec.strokeWidth == null || ec.strokeWidth === '') ec.strokeWidth = 1;
    var tc = Object.assign({}, w.travelCards || {});
    fill(tc, 'cardBg', tc.cardBg || ec.cardBg || panel);
    fill(tc, 'imageBg', tc.imageBg || ec.imageBg || '#524b4f');
    fill(tc, 'titleColor', tc.titleColor || ec.titleColor || accent);
    fill(tc, 'descColor', tc.descColor || ec.descColor || accent);
    fill(tc, 'featureColor', tc.featureColor || ec.featureColor || accent);
    fill(tc, 'strokeColor', tc.strokeColor || ec.strokeColor || accent);
    if (tc.strokeWidth == null || tc.strokeWidth === '') tc.strokeWidth = ec.strokeWidth != null ? ec.strokeWidth : 1;
    w.ui = ui;
    w.equipmentCards = ec;
    w.travelCards = tc;
    shell.wizard = w;
    return shell;
  };

  QuoteBuilder.prototype._ensurePreviewEquipmentStep = function() {
    this._jumpPreviewToStep('equipment') || this._jumpPreviewToStep('products');
  };

  QuoteBuilder.prototype._jumpPreviewToStep = function(stepId) {
    var shell = this._toShell();
    var W = wl();
    var tz = (shell.travelZones || []).length;
    var steps = W.resolveWizardSteps
      ? W.resolveWizardSteps(shell.wizard, this.previewProgress, tz)
      : (shell.wizard.steps || ['equipment', 'contact']);
    var idx = steps.indexOf(stepId);
    if (idx < 0 && stepId === 'custom') {
      // Fall back to event/contact if custom fields are attached there
      idx = steps.indexOf('event');
      if (idx < 0) idx = steps.indexOf('contact');
    }
    if (idx >= 0) {
      this.previewStep = idx;
      return true;
    }
    return false;
  };

  QuoteBuilder.prototype._previewNeedsEquipment = function(path) {
    if (!path) return false;
    if (path.indexOf('wizard.equipmentCards') === 0) return true;
    if (path.indexOf('wizard.ui') === 0) return true;
    if (path.indexOf('wizard.layout') === 0) return true;
    if (path.indexOf('products.') === 0) {
      return /\.(label|badge|subtitle|description|imageUrl|imageFit|imagePos|imageAxis|displayMode|imageSize|imageScale|icon)$/.test(path);
    }
    return false;
  };

  QuoteBuilder.prototype._previewNeedsTravel = function(path) {
    if (!path) return false;
    if (path.indexOf('wizard.travelCards') === 0) return true;
    if (path.indexOf('travel.zones.') === 0) {
      return /\.(label|badge|subtitle|description|imageUrl|imageFit|imagePos|imageAxis|displayMode|imageSize|imageScale|icon|feeCents)$/.test(path);
    }
    return false;
  };

  QuoteBuilder.prototype._ensurePreviewTravelStep = function() {
    this._jumpPreviewToStep('travel');
  };

  QuoteBuilder.prototype._normHex = function(v) {
    v = String(v == null ? '' : v).trim();
    if (!v) return '';
    if (v.charAt(0) !== '#') v = '#' + v;
    if (/^#[0-9a-fA-F]{3}$/.test(v)) {
      return ('#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]).toLowerCase();
    }
    return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : '';
  };

  QuoteBuilder.prototype._accent = function() {
    var a = this._normHex(this.themeAccent);
    if (a) return a;
    try {
      var raw = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      a = this._normHex(raw);
      if (a) return a;
      var m = raw.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
      if (m) {
        function hx(n) { return ('0' + Number(n).toString(16)).slice(-2); }
        return '#' + hx(m[1]) + hx(m[2]) + hx(m[3]);
      }
    } catch (e) {}
    return '#1f7a63';
  };

  /** Swatch opens the native picker; hex text is editable; Default clears override. */
  QuoteBuilder.prototype._colorField = function(path, label, stored, fallback) {
    var fb = this._normHex(fallback) || '#1a2230';
    var st = this._normHex(stored);
    var shown = st || fb;
    return this._field(label,
      '<div class="oqb-color">'
      + '<input type="color" class="oqb-color-swatch" data-oqb-path="' + esc(path) + '" value="' + esc(shown) + '" title="Pick colour" aria-label="' + esc(label) + ' swatch">'
      + '<input type="text" class="oqb-color-hex" data-oqb-color-hex="' + esc(path) + '" value="' + esc(st) + '" placeholder="' + esc(fb) + '" spellcheck="false" autocomplete="off">'
      + '<button type="button" class="btn ghost oqb-btn-sm oqb-color-def" data-oqb-color-def="' + esc(path) + '">Default</button>'
      + '</div>');
  };

  QuoteBuilder.prototype._notifySection = function() {
    if (typeof this.onSectionChange === 'function') this.onSectionChange(this.section);
  };

  QuoteBuilder.prototype._renderSectionStyle = function() {
    var sec = this.section || {};
    var ap = sec.appearance || {};
    var custom = ap.custom === true;
    var sw = ap.strokeWidth != null ? ap.strokeWidth : 2;
    var accent = this._accent();
    var DEF = {
      bg: '#f7f0f2',
      eyebrowColor: accent,
      headingColor: '#1a2230',
      introColor: '#46535f',
      containerBg: '#f7f0f2',
      strokeColor: accent
    };
    function hexRow(key, label, ph) {
      var st = sec[key] || '';
      var shown = (/^#[0-9a-fA-F]{6}$/i.test(st) ? st : '') || DEF[key];
      return '<div class="oqb-field"><span>' + esc(label) + '</span>'
        + '<div class="oqb-color">'
        + '<input type="color" class="oqb-color-swatch" data-oq-sec-clr="' + esc(key) + '" value="' + esc(shown) + '" title="Pick colour">'
        + '<input type="text" class="oqb-color-hex" data-oq-sec-hex="' + esc(key) + '" value="' + esc(/^#[0-9a-fA-F]{6}$/i.test(st) ? st : '') + '" placeholder="' + esc(DEF[key]) + '">'
        + '<button type="button" class="btn ghost oqb-btn-sm" data-oq-sec-def="' + esc(key) + '">Default</button>'
        + '</div></div>';
    }
    var tOpts = [['none', 'None (flat edge)'], ['fade', 'Fade blend'], ['wave', 'Wave'], ['angle', 'Diagonal'], ['curve', 'Soft curve']];
    function tSel(cur) {
      return tOpts.map(function(o) {
        return '<option value="' + o[0] + '"' + ((cur || 'none') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('');
    }
    return '<div class="oqb-section-style">'
      + '<div class="oqb-section"><h4>Page section (above the wizard)</h4>'
      + '<p class="oqb-hint" style="margin-top:0">Eyebrow, heading and intro shown above the live preview — same copy as the published Online Quote band.</p>'
      + '<div class="oqb-grid">'
      + this._field('Eyebrow', '<input type="text" data-oq-sec-text="eyebrow" value="' + esc(sec.eyebrow || '') + '" placeholder="Online quote">')
      + this._field('Heading', '<input type="text" data-oq-sec-text="heading" value="' + esc(sec.heading || '') + '" placeholder="Get your verified quote">')
      + '</div>'
      + this._field('Intro', '<textarea rows="2" data-oq-sec-text="intro" placeholder="Answer a few questions…">' + esc(sec.intro || '') + '</textarea>')
      + '<h4 class="oqb-sub">Section colours</h4><div class="oqb-grid">'
      + hexRow('bg', 'Section background', DEF.bg)
      + hexRow('eyebrowColor', 'Eyebrow colour', DEF.eyebrowColor)
      + hexRow('headingColor', 'Heading colour', DEF.headingColor)
      + hexRow('introColor', 'Intro text colour', DEF.introColor)
      + '</div></div>'
      + '<details class="oqb-sec-appearance"' + (custom ? ' open' : '') + '>'
      + '<summary>Section container style</summary>'
      + '<p class="oqb-hint">Full-width background colour, coloured stroke, and transitions — same controls as Page editor.</p>'
      + '<label class="oqb-check"><input type="checkbox" data-oq-sec-app="custom"' + (custom ? ' checked' : '') + '> Custom section style (otherwise theme default)</label>'
      + '<div class="oqb-sec-app-fields"' + (custom ? '' : ' hidden') + '>'
      + '<div class="oqb-grid">'
      + '<div class="oqb-field"><span>Full-width background</span><div class="oqb-color">'
      + '<input type="color" class="oqb-color-swatch" data-oq-sec-app-clr="containerBg" value="' + esc(ap.containerBg || DEF.containerBg) + '">'
      + '<input type="text" class="oqb-color-hex" data-oq-sec-app-hex="containerBg" value="' + esc(ap.containerBg || '') + '" placeholder="Theme default">'
      + '<button type="button" class="btn ghost oqb-btn-sm" data-oq-sec-app-def="containerBg">Default</button></div></div>'
      + '<div class="oqb-field"><span>Stroke colour</span><div class="oqb-color">'
      + '<input type="color" class="oqb-color-swatch" data-oq-sec-app-clr="strokeColor" value="' + esc(ap.strokeColor || DEF.strokeColor) + '">'
      + '<input type="text" class="oqb-color-hex" data-oq-sec-app-hex="strokeColor" value="' + esc(ap.strokeColor || '') + '" placeholder="None">'
      + '<button type="button" class="btn ghost oqb-btn-sm" data-oq-sec-app-def="strokeColor">Default</button></div></div>'
      + '<div class="oqb-field"><span>Stroke width</span><input type="range" min="0" max="8" step="1" data-oq-sec-app="strokeWidth" value="' + esc(sw) + '"><span class="oqb-hint" data-oq-sec-app-sw-label>' + esc(sw) + 'px</span></div>'
      + '<div class="oqb-field"><span>Stroke sides</span><select data-oq-sec-app="strokeSides">'
      + '<option value="both"' + (!ap.strokeSides || ap.strokeSides === 'both' ? ' selected' : '') + '>Top &amp; bottom</option>'
      + '<option value="top"' + (ap.strokeSides === 'top' ? ' selected' : '') + '>Top only</option>'
      + '<option value="bottom"' + (ap.strokeSides === 'bottom' ? ' selected' : '') + '>Bottom only</option>'
      + '<option value="all"' + (ap.strokeSides === 'all' ? ' selected' : '') + '>All sides</option>'
      + '</select></div>'
      + '<div class="oqb-field"><span>Transition into section (top)</span><select data-oq-sec-app="transitionTop">' + tSel(ap.transitionTop) + '</select></div>'
      + '<div class="oqb-field"><span>Transition out (bottom)</span><select data-oq-sec-app="transitionBottom">' + tSel(ap.transitionBottom) + '</select></div>'
      + '</div></div></details></div>';
  };

  QuoteBuilder.prototype._sectionBandHtml = function() {
    var sec = this.section || {};
    var ap = sec.appearance || {};
    var accent = this._accent();
    var ey = sec.eyebrow || 'Online quote';
    var hd = sec.heading || 'Get your verified quote';
    var intro = sec.intro || 'Answer a few questions — verify your email to see your total, then SMS for the full breakdown.';
    var styles = [];
    var bandBg = '';
    if (ap.custom && ap.containerBg) bandBg = ap.containerBg;
    else if (sec.bg) bandBg = sec.bg;
    if (bandBg) styles.push('background:' + bandBg);
    if (ap.custom && ap.strokeColor && (ap.strokeWidth > 0 || ap.strokeWidth === 0)) {
      var sw = Math.max(0, parseInt(ap.strokeWidth, 10) || 0);
      if (sw > 0) {
        var sides = ap.strokeSides || 'both';
        if (sides === 'all') styles.push('border:' + sw + 'px solid ' + ap.strokeColor);
        else {
          if (sides === 'both' || sides === 'top') styles.push('border-top:' + sw + 'px solid ' + ap.strokeColor);
          if (sides === 'both' || sides === 'bottom') styles.push('border-bottom:' + sw + 'px solid ' + ap.strokeColor);
        }
      }
    }
    var eySt = sec.eyebrowColor ? (' style="color:' + esc(sec.eyebrowColor) + '"') : (' style="color:' + esc(accent) + '"');
    var hdSt = sec.headingColor ? (' style="color:' + esc(sec.headingColor) + '"') : '';
    var inSt = sec.introColor ? (' style="color:' + esc(sec.introColor) + '"') : '';
    return '<div class="oqb-oq-band"' + (styles.length ? (' style="' + styles.join(';') + '"') : '') + '>'
      + '<p class="oqb-oq-ey"' + eySt + '>' + esc(ey) + '</p>'
      + '<h2 class="oqb-oq-heading"' + hdSt + '>' + esc(hd) + '</h2>'
      + (intro ? ('<p class="oqb-oq-intro"' + inSt + '>' + esc(intro) + '</p>') : '')
      + '</div>';
  };

  QuoteBuilder.prototype._previewStyleHtml = function() {
    var D = displayApi();
    var brand = 'var(--accent, var(--pipe, #1f7a63))';
    var css = (D && D.layoutCss) ? D.layoutCss(brand) : '';
    return css ? '<style class="oqb-preview-injected-css">' + css + '</style>' : '';
  };

  QuoteBuilder.prototype._applyPreviewZoom = function() {
    if (!this.previewRoot) return;
    var inner = this.previewRoot.querySelector('.oqb-preview-zoom-inner');
    var label = this.previewRoot.querySelector('[data-oqb-zoom-label]');
    var z = Math.max(50, Math.min(200, this.previewZoom || 100));
    this.previewZoom = z;
    if (inner) {
      inner.style.transform = 'scale(' + (z / 100) + ')';
      inner.style.width = (10000 / z) + '%';
    }
    if (label) label.textContent = z + '%';
  };

  QuoteBuilder.prototype._renderPreviewToolbar = function(shell) {
    var self = this;
    var layout = displayApi().wizardLayout ? displayApi().wizardLayout(shell) : (shell.wizard.layout || 'cards');
    var layoutLabel = (LAYOUTS.find(function(l) { return l.id === layout; }) || LAYOUTS[0]).label;
  var pinHint = this.previewPinEquipment ? ' · equipment step' : '';
    return '<div class="oqb-preview-head">'
      + '<div class="oqb-preview-head-top"><h4>Live preview</h4>'
      + '<div class="oqb-preview-zoom" aria-label="Preview zoom">'
      + '<button type="button" class="oqb-preview-zoom-btn" data-oqb-zoom="out" title="Zoom out">−</button>'
      + '<span class="oqb-preview-zoom-val" data-oqb-zoom-label>' + esc(this.previewZoom) + '%</span>'
      + '<button type="button" class="oqb-preview-zoom-btn" data-oqb-zoom="in" title="Zoom in">+</button>'
      + '<button type="button" class="oqb-preview-zoom-btn oqb-preview-zoom-reset" data-oqb-zoom="reset" title="Reset zoom">100%</button>'
      + '</div></div>'
      + '<p class="oqb-preview-sub">Matches the published section: title above, then the wizard. Layout: <strong>' + esc(layoutLabel) + '</strong>' + esc(pinHint) + '. Styling updates live — no publish needed.</p>'
      + '<div class="oqb-preview-tools">'
      + '<label class="oqb-preview-focus"><input type="checkbox" data-oqb-preview-focus' + (this.previewFocusCard ? ' checked' : '') + '> Focus one equipment card</label>'
      + '<button type="button" class="oqb-preview-jump" data-oqb-preview-jump="equipment">Show equipment step</button>'
      + '<button type="button" class="oqb-preview-jump" data-oqb-preview-jump="travel">Show travel step</button>'
      + '</div></div>';
  };

  QuoteBuilder.prototype._refreshPreview = function() {
    if (!this.previewRoot || this.showJson) return;
    this.previewRoot.innerHTML = '<div class="oqb-preview">' + this._renderPreview() + '</div>';
    this._applyPreviewZoom();
    this._wirePreview();
  };

  QuoteBuilder.prototype._renderPreview = function() {
    var self = this;
    var shell = this._previewShell();
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
    var layout = displayApi().wizardLayout ? displayApi().wizardLayout(shell) : (shell.wizard.layout || 'cards');
    var wrap = displayApi().wrapStepBody
      ? function(parts) { return displayApi().wrapStepBody(parts, layout); }
      : function(parts) { return (parts.intro || '') + (parts.fields || '') + (parts.choices || '') + (parts.extra || ''); };
    if (stepKey === 'event') {
      var Pe = global.LPQuotePlanning;
      var eventProds = filter(shell.products, progress);
      var eventFields = (Pe && Pe.renderLabourPlanning)
        ? Pe.renderLabourPlanning(progress, shell, eventProds)
        : '<label class="lp-oq-field"><span>Barista 1 — hours</span><input type="number" min="1" data-prev-field="hours" value="' + esc(progress.hours) + '"></label>';
      var eventStaffing = (Pe && Pe.renderStaffing)
        ? Pe.renderStaffing(progress, shell, eventProds)
        : '';
      var eventExtra = (Pe && Pe.renderCustomFieldsHtml)
        ? Pe.renderCustomFieldsHtml(
          (W.customFieldsFor ? W.customFieldsFor(shell.wizard, 'event') : []),
          progress.customAnswers || {},
          { esc: esc, attr: 'data-prev-custom' }
        )
        : '';
      body = wrap({
        intro: '<p class="lp-oq-intro">When is your event, and how many baristas do you need?</p>',
        fields: eventFields + eventStaffing + eventExtra
      });
    } else if (stepKey === 'custom' || stepKey === 'questions') {
      var Pc = global.LPQuotePlanning;
      var customFields = W.customFieldsFor ? W.customFieldsFor(shell.wizard, 'custom') : [];
      var customHtml = (Pc && Pc.renderCustomFieldsHtml)
        ? Pc.renderCustomFieldsHtml(customFields, progress.customAnswers || {}, { esc: esc, attr: 'data-prev-custom' })
        : '';
      body = wrap({
        intro: '<p class="lp-oq-intro">A few more details about your event.</p>',
        fields: customHtml || '<p class="lp-oq-muted">No custom questions yet — add some in the Questions tab.</p>'
      });
    } else if (stepKey === 'equipment' || stepKey === 'products') {
      var P = global.LPQuotePlanning;
      var prods = filter(shell.products, progress);
      if (self.previewFocusCard && prods.length && P && P.pickEquipment) {
        P.pickEquipment(progress, shell, prods, 0, prods[0].id);
      }
      var choices = '';
      if (P && P.renderCartRows) {
        choices = P.renderCartRows(progress, shell, prods, {
          esc: esc,
          iconHtml: iconSvg,
          previewFocusSingle: !!self.previewFocusCard
        });
      } else {
        choices = prods.map(function(p) {
          var sel = progress.productId === p.id ? ' is-selected' : '';
          return '<button type="button" class="lp-oq-choice' + sel + '" data-prev-pick="productId" data-val="' + esc(p.id) + '">' +
            self._choiceHtml(p) + '</button>';
        }).join('');
      }
      var eqFields = '';
      if (steps.indexOf('event') < 0) {
        eqFields = (P && P.renderLabourPlanning)
          ? P.renderLabourPlanning(progress, shell, prods)
          : '<label class="lp-oq-field"><span>Barista 1 — hours</span><input type="number" min="1" data-prev-field="hours" value="' + esc(progress.hours) + '"></label>';
      }
      body = wrap({ intro: '<p class="lp-oq-intro">What equipment would you like to hire?</p>', choices: choices });
    } else if (stepKey === 'beverages') {
      var Pq = global.LPQuotePlanning;
      var bevs = filter(shell.beverages, progress);
      var bevChoices = (Pq && Pq.renderBeverageQtyCards)
        ? Pq.renderBeverageQtyCards(progress, shell, bevs, { esc: esc, iconHtml: iconSvg })
        : bevs.map(function(b) {
          var sel = progress.beverageId === b.id ? ' is-selected' : '';
          return '<button type="button" class="lp-oq-choice' + sel + '" data-prev-pick="beverageId" data-val="' + esc(b.id) + '">' +
            self._choiceHtml(b) + '</button>';
        }).join('');
      body = wrap({
        intro: '<p class="lp-oq-intro">Set a quantity for each package or catering option you want. Leave others at 0.</p>',
        choices: bevChoices
      });
    } else if (stepKey === 'travel') {
      var Pt = global.LPQuotePlanning;
      var travelZones = shell.travelZones || [];
      var travelChoices = (Pt && Pt.renderTravelZoneRows)
        ? Pt.renderTravelZoneRows(progress, shell, travelZones, { esc: esc, iconHtml: iconSvg })
        : travelZones.map(function(z) {
          var sel = progress.travelZoneId === z.id ? ' is-selected' : '';
          return '<button type="button" class="lp-oq-choice' + sel + '" data-prev-pick="travelZoneId" data-val="' + esc(z.id) + '">' +
            self._choiceHtml(z) + '</button>';
        }).join('');
      body = wrap({
        intro: '<p class="lp-oq-intro">Where is your event?</p>',
        choices: travelChoices
      });
    } else if (stepKey === 'addons') {
      body = wrap({
        intro: '<p class="lp-oq-intro">Optional extras.</p>',
        choices: filter(shell.addons, progress).map(function(a) {
          var on = progress.addonIds.indexOf(a.id) >= 0 ? ' is-selected' : '';
          return '<button type="button" class="lp-oq-choice lp-oq-multi' + on + '" data-prev-addon="' + esc(a.id) + '">' +
            self._choiceHtml(a) + '</button>';
        }).join('')
      });
    } else {
      var Pcontact = global.LPQuotePlanning;
      var contactExtra = (Pcontact && Pcontact.renderCustomFieldsHtml)
        ? Pcontact.renderCustomFieldsHtml(
          (W.customFieldsFor ? W.customFieldsFor(shell.wizard, 'contact') : []),
          progress.customAnswers || {},
          { esc: esc, attr: 'data-prev-custom' }
        )
        : '';
      body = wrap({
        intro: '<p class="lp-oq-intro">Contact details (preview).</p>',
        fields: '<label class="lp-oq-field"><span>Name</span><input disabled placeholder="Customer name"></label>' + contactExtra
      });
    }

    var layoutCls = displayApi().layoutClass
      ? displayApi().layoutClass(shell)
      : (' lp-oq-layout-' + (shell.wizard.layout || 'cards'));
    var uiStyle = displayApi().wizardUiVars ? displayApi().wizardUiVars(shell) : '';
    return self._renderPreviewToolbar(shell)
      + self._previewStyleHtml()
      + '<div class="oqb-preview-body oqb-preview-mock"><div class="oqb-preview-zoom-outer"><div class="oqb-preview-zoom-inner">'
      + self._sectionBandHtml()
      + '<div class="lp-oq-card' + layoutCls + '"' + (uiStyle ? (' style="' + uiStyle + '"') : '') + '>' +
      '<div class="lp-oq-head"><h2 class="lp-oq-title">' + esc((shell.business && shell.business.name) || 'Your business') + '</h2>' +
      '<div class="lp-oq-steps">' + steps.map(function(s, i) {
        return '<span class="lp-oq-step' + (i === self.previewStep ? ' is-active' : (i < self.previewStep ? ' is-done' : '')) + '">' + esc(label(s)) + '</span>';
      }).join('') + '</div></div>' +
      '<div class="lp-oq-body">' + body + '</div>' +
      '<div class="lp-oq-foot">' +
      (self.previewStep > 0 ? '<button type="button" class="lp-oq-btn lp-oq-btn-ghost" data-prev-act="back">Back</button>' : '') +
      (self.previewStep < steps.length - 1 ? '<button type="button" class="lp-oq-btn" data-prev-act="next">Continue</button>' : '<button type="button" class="lp-oq-btn" disabled>Get my quote</button>') +
      '</div></div></div></div></div>';
  };

  QuoteBuilder.prototype._renderTab = function() {
    switch (this.tab) {
      case 'wizard': return this._renderWizard();
      case 'questions': return this._renderQuestions();
      case 'products': return this._renderProducts();
      case 'labour': return this._renderLabour();
      case 'packages': return this._renderPackages();
      case 'addons': return this._renderAddons();
      case 'travel': return this._renderTravel();
      case 'rules': return this._renderRules();
      default: return this._renderOverview();
    }
  };

  QuoteBuilder.prototype._ensureCustomStep = function() {
    var W = wl();
    if (!this.config.wizard) this.config.wizard = {};
    if (W.ensureCustomStepInSteps) {
      this.config.wizard.steps = W.ensureCustomStepInSteps(
        this.config.wizard.steps || [],
        this.config.wizard.customFields || []
      );
    }
  };

  QuoteBuilder.prototype._renderQuestions = function() {
    var self = this;
    var list = (this.config.wizard && this.config.wizard.customFields) || [];
    var typeOpts = CUSTOM_FIELD_TYPES.map(function(t) {
      var labels = {
        text: 'Short text',
        textarea: 'Long text / text box',
        email: 'Email',
        tel: 'Phone',
        number: 'Number',
        select: 'Dropdown',
        checkbox: 'Checkbox',
        date: 'Date'
      };
      return { id: t, label: labels[t] || t };
    });
    var cards = list.map(function(f, i) {
      var typeSelect = '<select data-oqb-path="wizard.customFields.' + i + '.type">' +
        typeOpts.map(function(t) {
          return '<option value="' + t.id + '"' + (f.type === t.id ? ' selected' : '') + '>' + esc(t.label) + '</option>';
        }).join('') + '</select>';
      var attachSelect = '<select data-oqb-path="wizard.customFields.' + i + '.attachTo">' +
        '<option value="custom"' + (f.attachTo === 'custom' || !f.attachTo ? ' selected' : '') + '>Own step (Custom questions)</option>' +
        '<option value="event"' + (f.attachTo === 'event' ? ' selected' : '') + '>Event details step</option>' +
        '<option value="contact"' + (f.attachTo === 'contact' ? ' selected' : '') + '>Contact / Your details step</option>' +
        '</select>';
      var optionsField = f.type === 'select'
        ? self._field('Dropdown options (one per line)',
          '<textarea rows="3" data-oqb-path="wizard.customFields.' + i + '.options" placeholder="Wedding&#10;Corporate&#10;Private party">' +
          esc((f.options || []).join('\n')) + '</textarea>')
        : '';
      var fields = '<div class="oqb-grid">'
        + self._field('Question / label', '<input type="text" data-oqb-path="wizard.customFields.' + i + '.label" value="' + esc(f.label || '') + '" placeholder="e.g. Venue name">')
        + self._field('Field type', typeSelect)
        + self._field('Show on', attachSelect)
        + self._field('Placeholder', '<input type="text" data-oqb-path="wizard.customFields.' + i + '.placeholder" value="' + esc(f.placeholder || '') + '" placeholder="Hint text inside the field">')
        + self._field('Help text', '<input type="text" data-oqb-path="wizard.customFields.' + i + '.helpText" value="' + esc(f.helpText || '') + '" placeholder="Optional note under the field">')
        + self._field('Required', '<label class="oqb-check"><input type="checkbox" data-oqb-path="wizard.customFields.' + i + '.required"' + (f.required ? ' checked' : '') + '> Customer must answer before continuing</label>')
        + optionsField
        + '<input type="hidden" data-oqb-path="wizard.customFields.' + i + '.id" value="' + esc(f.id || '') + '">'
        + '</div>';
      return self._itemCard(f.label || 'New question', i, 'wizard.customFields', fields, i > 0, i < list.length - 1);
    }).join('');
    return '<p class="oqb-hint">Ask anything you need — venue name, event type, parking notes, dietary requirements. Fields can sit on a dedicated <strong>Custom questions</strong> step, or append to Event details / Your details.</p>'
      + '<div class="oqb-items">' + (cards || '<p class="oqb-empty">No custom questions yet.</p>') + '</div>'
      + '<button type="button" class="btn ghost" data-oqb-add="customFields">+ Add question</button>';
  };

  QuoteBuilder.prototype._choiceHtml = function(item) {
    var D = displayApi();
    if (D.choiceVisualHtml) {
      return D.choiceVisualHtml(item, { esc: esc, iconHtml: iconSvg });
    }
    return iconSvg(item.icon) + '<strong>' + esc(item.label) + '</strong>';
  };

  QuoteBuilder.prototype._getItemAtPath = function(path) {
    var parts = path.split('.');
    var obj = this.config;
    for (var i = 0; i < parts.length; i++) {
      if (obj == null) return null;
      obj = obj[parts[i]];
    }
    return obj;
  };

  QuoteBuilder.prototype._deleteItemImage = function(item) {
    if (!item || !item.imagePid || !this.media || !this.media.delete) return;
    this.media.delete(item.imagePid);
    item.imagePid = '';
    item.imageUrl = '';
  };

  QuoteBuilder.prototype._displayBlock = function(path, item, uploadKind) {
    var self = this;
    var D = displayApi();
    var mode = D.inferDisplayMode ? D.inferDisplayMode(item) : (item.displayMode || 'text');
    var size = item.imageSize || 'standard';
    var scale = item.imageScale != null ? item.imageScale : 100;
    var px = D.displayPx ? D.displayPx(size, scale) : 80;
    var radioName = 'oqb-dm-' + path.replace(/\./g, '-');
    var canUpload = !!(this.media && this.media.upload && this.media.pick);

    var modes = '<div class="oqb-display-modes">' +
      [['text', 'Text only'], ['icon', 'Icon'], ['image', 'Uploaded image']].map(function(pair) {
        return '<label class="oqb-display-mode' + (mode === pair[0] ? ' is-on' : '') + '">' +
          '<input type="radio" name="' + esc(radioName) + '" value="' + pair[0] + '" data-oqb-display-mode="' + esc(path) + '"' +
          (mode === pair[0] ? ' checked' : '') + '> ' + esc(pair[1]) + '</label>';
      }).join('') + '</div>';

    var iconPanel = '';
    if (mode === 'icon') {
      iconPanel = '<div class="oqb-display-panel"><span class="oqb-display-panel-label">Pick an icon</span>' +
        this._iconSelect(path + '.icon', item.icon || '') + '</div>';
    }

    var imgPanel = '';
    if (mode === 'image') {
      var sizeOpts = IMAGE_SIZE_OPTIONS.map(function(s) {
        return '<option value="' + s.id + '"' + (size === s.id ? ' selected' : '') + '>' + esc(s.label) + '</option>';
      }).join('');
      var cardImgRow = '';
      if (uploadKind === 'products' || uploadKind === 'travel') {
        var fit = item.imageFit || 'cover';
        var pos = item.imagePos || 'center';
        var axis = item.imageAxis === 'height' || item.imageAxis === 'width' ? item.imageAxis : 'frame';
        var fitOpts = [['cover', 'Cover (crop to fill)'], ['contain', 'Contain (fit inside)'], ['fill', 'Stretch (fill frame)']].map(function(pair) {
          return '<option value="' + pair[0] + '"' + (fit === pair[0] ? ' selected' : '') + '>' + esc(pair[1]) + '</option>';
        }).join('');
        var posOpts = [['center', 'Centre'], ['left', 'Left'], ['right', 'Right'], ['top', 'Top'], ['bottom', 'Bottom']].map(function(pair) {
          return '<option value="' + pair[0] + '"' + (pos === pair[0] ? ' selected' : '') + '>' + esc(pair[1]) + '</option>';
        }).join('');
        var axisOpts = [['frame', 'Fill frame (use fit below)'], ['height', 'Lock to height'], ['width', 'Lock to width']].map(function(pair) {
          return '<option value="' + pair[0] + '"' + (axis === pair[0] ? ' selected' : '') + '>' + esc(pair[1]) + '</option>';
        }).join('');
        cardImgRow = '<div class="oqb-img-card-row oqb-grid">' +
          self._field('Image size mode', '<select data-oqb-path="' + esc(path) + '.imageAxis">' + axisOpts + '</select>') +
          self._field('Card image fit', '<select data-oqb-path="' + esc(path) + '.imageFit"' + (axis === 'frame' ? '' : ' disabled') + '>' + fitOpts + '</select>') +
          self._field('Card image position', '<select data-oqb-path="' + esc(path) + '.imagePos">' + posOpts + '</select>') +
          self._field('Image zoom', '<div class="oqb-scale-wrap"><input type="range" min="50" max="250" step="5" data-oqb-path="' + esc(path) + '.imageScale" value="' + esc(scale) + '">' +
          '<span class="oqb-scale-val" data-oqb-scale-for="' + esc(path) + '">' + esc(scale) + '%</span></div>') +
          '</div>';
      }
      imgPanel = '<div class="oqb-display-panel oqb-img-panel" data-oqb-img-panel="' + esc(path) + '">' +
        (item.imageUrl
          ? '<img src="' + esc(item.imageUrl) + '" class="oqb-img-preview" style="max-height:' + px + 'px" alt="">'
          : '<div class="oqb-img-empty">No image uploaded</div>') +
        '<div class="oqb-img-actions">' +
        (canUpload
          ? '<button type="button" class="btn ghost oqb-btn-sm" data-oqb-img-up="' + esc(path) + '" data-oqb-upload-kind="' + esc(uploadKind) + '">Upload image</button>'
          : '<span class="oqb-hint">Sign in to upload images</span>') +
        (item.imageUrl ? '<button type="button" class="btn ghost oqb-btn-sm" data-oqb-img-clr="' + esc(path) + '">Remove image</button>' : '') +
        '</div>' +
        '<input type="hidden" data-oqb-path="' + esc(path) + '.imageUrl" value="' + esc(item.imageUrl || '') + '">' +
        '<input type="hidden" data-oqb-path="' + esc(path) + '.imagePid" value="' + esc(item.imagePid || '') + '">' +
        (uploadKind === 'products' || uploadKind === 'travel'
          ? '<p class="oqb-hint">' + (uploadKind === 'travel'
            ? 'Upload a zone map (e.g. radius from Canberra). Customers can enlarge the image on the card to check if their venue is inside the zone.'
            : 'Use size mode + zoom to fit each equipment image in the card. Zoom is per product.') + '</p>'
          : '<div class="oqb-img-size-row">' +
            this._field('Base size', '<select data-oqb-path="' + esc(path) + '.imageSize">' + sizeOpts + '</select>') +
            this._field('Scale', '<div class="oqb-scale-wrap"><input type="range" min="50" max="250" step="5" data-oqb-path="' + esc(path) + '.imageScale" value="' + esc(scale) + '">' +
            '<span class="oqb-scale-val" data-oqb-scale-for="' + esc(path) + '">' + esc(scale) + '%</span></div>') +
            '</div>' +
            '<p class="oqb-hint">Displayed at ~' + px + 'px tall. Stored in your site Cloudinary folder.</p>') +
        cardImgRow +
        '</div>';
    }

    return '<div class="oqb-display" data-oqb-display="' + esc(path) + '">' +
      '<p class="oqb-showwhen-title">How customers see this option</p>' +
      modes + iconPanel + imgPanel +
      '<input type="hidden" data-oqb-path="' + esc(path) + '.displayMode" value="' + esc(mode) + '">' +
      '</div>';
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


  QuoteBuilder.prototype._renderWizardUiColors = function(w) {
    var ui = (w && w.ui) || {};
    var self = this;
    var accent = this._accent();
    function col(path, label, fallback) {
      return self._colorField('wizard.ui.' + path, label, ui[path] || '', fallback);
    }
    return '<div class="oqb-section"><h4>Wizard colours</h4>'
      + '<p class="oqb-hint" style="margin-top:0">Panel, progress steps (Equipment, Event details\u2026), form labels, choice cards, and Continue / Back. Swatch opens the picker; hex field edits the value. Defaults follow your site accent (' + esc(accent) + ').</p>'
      + '<div class="oqb-grid">'
      + col('panelBg', 'Panel background', '#2e282a')
      + col('panelBorder', 'Panel border', accent)
      + col('titleColor', 'Business name colour', accent)
      + col('introColor', 'Step intro text colour', accent)
      + col('mutedColor', 'Muted / hint text', '#a8989e')
      + '</div>'
      + '<h4 class="oqb-sub">Form &amp; choice text</h4>'
      + '<p class="oqb-hint" style="margin-top:0">Fixes dark-on-dark readability for labels, package/add-on cards, radios, and inputs. Set these for dark wizard panels.</p>'
      + '<div class="oqb-grid">'
      + col('labelColor', 'Field labels (Name, Email\u2026)', accent)
      + col('fieldText', 'Input text colour', '#ffffff')
      + col('fieldBg', 'Input background', '#3a3436')
      + col('choiceText', 'Choice card title', accent)
      + col('choiceDesc', 'Choice card description', '#c4b4ba')
      + col('bodyText', 'Radios / plan body text', '#ffffff')
      + '</div>'
      + '<h4 class="oqb-sub">Progress buttons</h4><div class="oqb-grid">'
      + col('progressBg', 'Progress background', '#ffffff')
      + col('progressText', 'Progress text', accent)
      + col('progressBorder', 'Progress border', accent)
      + col('progressActiveBg', 'Active progress background', accent)
      + col('progressActiveText', 'Active progress text', '#ffffff')
      + col('progressActiveBorder', 'Active progress border', accent)
      + col('progressDoneText', 'Completed progress text', accent)
      + col('progressDoneBorder', 'Completed progress border', accent)
      + '</div>'
      + '<h4 class="oqb-sub">Navigation buttons (Continue / Back)</h4><div class="oqb-grid">'
      + col('btnBg', 'Continue background', accent)
      + col('btnText', 'Continue text', '#ffffff')
      + col('btnGhostBg', 'Back background', '#ffffff')
      + col('btnGhostText', 'Back text', accent)
      + col('btnGhostBorder', 'Back border', accent)
      + '</div></div>';
  };

  QuoteBuilder.prototype._renderWizard = function() {
    var w = this.config.wizard || {};
    var layout = w.layout || 'cards';
    var ec = w.equipmentCards || {};
    var tc = w.travelCards || {};
    var accent = this._accent();
    var panel = (w.ui && w.ui.panelBg) || '#2e282a';

    return '<div class="oqb-section"><h4>Equipment card styling</h4>'
      + '<p class="oqb-hint" style="margin-top:0">Applies to all equipment cards. Swatch opens the colour picker; type a hex next to it. Defaults match a dark wizard panel with your site accent.</p>'
      + '<div class="oqb-grid">'
      + this._colorField('wizard.equipmentCards.cardBg', 'Card background (behind text)', ec.cardBg, panel)
      + this._colorField('wizard.equipmentCards.imageBg', 'Image area background', ec.imageBg, '#524b4f')
      + this._colorField('wizard.equipmentCards.titleColor', 'Equipment name colour', ec.titleColor || ec.cardText, accent)
      + this._colorField('wizard.equipmentCards.descColor', 'Description colour', ec.descColor || ec.cardText, accent)
      + this._colorField('wizard.equipmentCards.qtyColor', 'Quantity number colour', ec.qtyColor || ec.featureColor, accent)
      + this._colorField('wizard.equipmentCards.qtyStroke', 'Quantity stroke colour', ec.qtyStroke || ec.featureColor, accent)
      + this._colorField('wizard.equipmentCards.qtyBg', 'Quantity fill colour', ec.qtyBg, '#ffffff')
      + this._colorField('wizard.equipmentCards.featureColor', 'Feature colour (badge &amp; accent)', ec.featureColor, accent)
      + this._colorField('wizard.equipmentCards.strokeColor', 'Card stroke colour', ec.strokeColor, accent)
      + this._field('Stroke width (px)', '<input type="number" min="0" max="8" data-oqb-path="wizard.equipmentCards.strokeWidth" value="' + esc(ec.strokeWidth != null ? ec.strokeWidth : 1) + '">')
      + '</div></div>'
      + '<div class="oqb-section"><h4>Travel zone card styling</h4>'
      + '<p class="oqb-hint" style="margin-top:0">Same card look as equipment. Leave blank to inherit Equipment card styling. Map images include an enlarge control so customers can check their venue against the radius.</p>'
      + '<div class="oqb-grid">'
      + this._colorField('wizard.travelCards.cardBg', 'Card background', tc.cardBg, ec.cardBg || panel)
      + this._colorField('wizard.travelCards.imageBg', 'Map image background', tc.imageBg, ec.imageBg || '#524b4f')
      + this._colorField('wizard.travelCards.titleColor', 'Zone name colour', tc.titleColor || tc.cardText, ec.titleColor || accent)
      + this._colorField('wizard.travelCards.descColor', 'Description colour', tc.descColor || tc.cardText, ec.descColor || accent)
      + this._colorField('wizard.travelCards.featureColor', 'Badge &amp; accent colour', tc.featureColor, ec.featureColor || accent)
      + this._colorField('wizard.travelCards.strokeColor', 'Card stroke colour', tc.strokeColor, ec.strokeColor || accent)
      + this._field('Stroke width (px)', '<input type="number" min="0" max="8" data-oqb-path="wizard.travelCards.strokeWidth" value="' + esc(tc.strokeWidth != null ? tc.strokeWidth : (ec.strokeWidth != null ? ec.strokeWidth : 1)) + '">')
      + '</div></div>'
      + this._renderWizardUiColors(w)
      + this._renderSectionStyle()
      + '<div class="oqb-section"><h4>Layout style</h4>'
      + '<p class="oqb-hint" style="margin-top:0">Equipment and travel zone cards sit in a horizontal row. Compact list stacks them.</p>'
      + '<div class="oqb-layouts">'
      + LAYOUTS.map(function(l) {
        return '<label class="oqb-layout' + (layout === l.id ? ' is-on' : '') + '">'
          + '<input type="radio" name="oqb-layout" value="' + l.id + '"' + (layout === l.id ? ' checked' : '') + '>'
          + '<strong>' + esc(l.label) + '</strong><span>' + esc(l.hint) + '</span></label>';
      }).join('') + '</div></div>'
      + '<div class="oqb-section"><h4>Multi-line equipment</h4>'
      + this._field('Allow multiple equipment lines', '<label class="oqb-check"><input type="checkbox" data-oqb-path="wizard.allowMultiCart"' + (w.allowMultiCart ? ' checked' : '') + '> Show &ldquo;+ Add another equipment line&rdquo; on the customer wizard (for hiring multiple carts at once)</label>')
      + '</div>'
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
        + self._displayBlock('products.' + i, p, 'products')
        + self._field('Base price (ex GST line)', self._money('products.' + i + '.baseCents', p.baseCents))
        + self._field('Baristas included', '<input type="number" min="1" max="10" data-oqb-path="products.' + i + '.baristasIncluded" value="' + esc(p.baristasIncluded != null ? p.baristasIncluded : 1) + '">')
        + self._field('Allow quantity', '<label class="oqb-check"><input type="checkbox" data-oqb-path="products.' + i + '.allowQuantity"' + (p.allowQuantity ? ' checked' : '') + '> Customer can order more than one</label>')
        + (p.allowQuantity
          ? self._field('Max quantity', '<input type="number" min="1" max="999" data-oqb-path="products.' + i + '.maxQuantity" value="' + esc(p.maxQuantity != null ? p.maxQuantity : '') + '" placeholder="e.g. 3 (fleet limit)">')
          : '')
        + self._field('Extra barista', '<label class="oqb-check"><input type="checkbox" data-oqb-path="products.' + i + '.allowExtraBarista"' + (p.allowExtraBarista !== false ? ' checked' : '') + '> Allow second barista on this cart</label>')
        + self._field('Badge (on image)', '<input type="text" data-oqb-path="products.' + i + '.badge" value="' + esc(p.badge || '') + '" placeholder="e.g. Mobile van">')
        + self._field('Sub-text (under title)', '<input type="text" data-oqb-path="products.' + i + '.subtitle" value="' + esc(p.subtitle || '') + '" placeholder="e.g. Dual-group & onboard power">')
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
    var eb = l.extraBarista || {};
    var ss = eb.splitShift || {};
    return '<div class="oqb-grid">'
      + this._field('Labour label', '<input type="text" data-oqb-path="labour.label" value="' + esc(l.label || 'Labour') + '">')
      + this._field('Hourly rate', this._money('labour.hourlyCents', l.hourlyCents))
      + this._field('Minimum hours (simple mode)', '<input type="number" min="1" max="48" data-oqb-path="labour.minimumHours" value="' + esc(l.minimumHours != null ? l.minimumHours : 3) + '">')
      + this._field('Shift planner', '<label class="oqb-check"><input type="checkbox" data-oqb-path="labour.allowShiftPlanner"' + (l.allowShiftPlanner !== false ? ' checked' : '') + '> Let customers plan multi-day events with start/end per day</label>')
      + this._field('Minimum hours per shift', '<input type="number" min="1" max="24" data-oqb-path="labour.minimumHoursPerShift" value="' + esc(l.minimumHoursPerShift != null ? l.minimumHoursPerShift : (l.minimumHours || 3)) + '">')
      + '</div>'
      + '<h4 class="oqb-sub">Extra barista</h4><div class="oqb-grid">'
      + this._field('Enabled', '<label class="oqb-check"><input type="checkbox" data-oqb-path="labour.extraBarista.enabled"' + (eb.enabled !== false ? ' checked' : '') + '> Offer additional barista per cart</label>')
      + this._field('Label', '<input type="text" data-oqb-path="labour.extraBarista.label" value="' + esc(eb.label || 'Additional barista') + '">')
      + this._field('Hourly rate', this._money('labour.extraBarista.hourlyCents', eb.hourlyCents != null ? eb.hourlyCents : l.hourlyCents))
      + '</div>'
      + '<h4 class="oqb-sub">Split-shift barista (peak)</h4><div class="oqb-grid">'
      + this._field('Enabled', '<label class="oqb-check"><input type="checkbox" data-oqb-path="labour.extraBarista.splitShift.enabled"' + (ss.enabled !== false ? ' checked' : '') + '> Offer morning peak / split-shift option</label>')
      + this._field('Label', '<input type="text" data-oqb-path="labour.extraBarista.splitShift.label" value="' + esc(ss.label || 'Split-shift barista (peak)') + '">')
      + this._field('Client hourly rate', this._money('labour.extraBarista.splitShift.hourlyCents', ss.hourlyCents != null ? ss.hourlyCents : 10000))
      + this._field('Minimum hours per day', '<input type="number" min="3" max="12" data-oqb-path="labour.extraBarista.splitShift.minimumHours" value="' + esc(ss.minimumHours != null ? ss.minimumHours : 3) + '">')
      + this._field('Default peak hours', '<input type="number" min="3" max="12" data-oqb-path="labour.extraBarista.splitShift.defaultHours" value="' + esc(ss.defaultHours != null ? ss.defaultHours : 4) + '">')
      + '</div>'
      + '<p class="oqb-hint">Equipment step picks what to hire; event step sets hours and baristas per cart. + Add day copies the previous day\'s times on the next calendar date. Split-shift bills the second barista at the peak rate (e.g. $100/hr) for busy morning hours only.</p>';
  };

  QuoteBuilder.prototype._renderTierRows = function(bevIdx, tiers) {
    var self = this;
    return (tiers || []).map(function(t, ti) {
      return '<div class="oqb-tier-row" data-oqb-tier="' + bevIdx + '" data-oqb-tier-idx="' + ti + '">' +
        self._field('From qty', '<input type="number" min="1" data-oqb-path="beverages.' + bevIdx + '.tiers.' + ti + '.minQty" value="' + esc(t.minQty != null ? t.minQty : 1) + '">') +
        self._field('Per unit ($)', self._money('beverages.' + bevIdx + '.tiers.' + ti + '.perUnitCents', t.perUnitCents)) +
        (ti > 0 ? '<button type="button" class="btn ghost oqb-tier-remove" data-oqb-tier-remove="' + bevIdx + '" data-oqb-tier-idx="' + ti + '">Remove tier</button>' : '') +
        '</div>';
    }).join('');
  };

  QuoteBuilder.prototype._renderPackages = function() {
    var self = this;
    var list = this.config.beverages || [];
    var cards = list.map(function(b, i) {
      var mode = b.pricingMode || 'per_head';
      var tierBlock = mode === 'tiered'
        ? '<div class="oqb-tiers"><p class="oqb-hint">Tiers apply to the whole quantity — e.g. 100+ @ $3/unit ($300), under 100 @ $5/unit.</p>' +
          self._renderTierRows(i, b.tiers) +
          '<button type="button" class="btn ghost" data-oqb-add-tier="' + i + '">+ Add pricing tier</button></div>'
        : '';
      var fields = '<div class="oqb-grid">'
        + self._field('Option name', '<input type="text" data-oqb-path="beverages.' + i + '.label" value="' + esc(b.label || '') + '">')
        + self._displayBlock('beverages.' + i, b, 'packages')
        + self._field('Pricing mode', '<select data-oqb-path="beverages.' + i + '.pricingMode">' +
          '<option value="per_head"' + (mode === 'per_head' ? ' selected' : '') + '>Per unit (over included)</option>' +
          '<option value="tiered"' + (mode === 'tiered' ? ' selected' : '') + '>Volume tiers (per unit)</option>' +
          '<option value="flat"' + (mode === 'flat' ? ' selected' : '') + '>Flat package price</option></select>')
        + self._field('Group on Packages step', '<select data-oqb-path="beverages.' + i + '.group">' +
          '<option value=""' + (!b.group ? ' selected' : '') + '>Ungrouped</option>' +
          '<option value="drinks"' + (b.group === 'drinks' ? ' selected' : '') + '>Drinks</option>' +
          '<option value="catering"' + (b.group === 'catering' ? ' selected' : '') + '>Catering</option>' +
          '<option value="other"' + (b.group === 'other' ? ' selected' : '') + '>Other</option></select>')
        + self._field('Min quantity (optional)', '<input type="number" min="0" max="50000" data-oqb-path="beverages.' + i + '.minQuantity" value="' + esc(b.minQuantity != null ? b.minQuantity : '') + '" placeholder="e.g. 20 for catering">')
        + (mode === 'tiered'
          ? self._field('Unit label', '<input type="text" data-oqb-path="beverages.' + i + '.unitLabel" value="' + esc(b.unitLabel || 'units') + '" placeholder="e.g. coffees">') + tierBlock
          : (mode === 'flat'
            ? self._field('Flat package price', self._money('beverages.' + i + '.packageCents', b.packageCents))
              + self._field('Unit label', '<input type="text" data-oqb-path="beverages.' + i + '.unitLabel" value="' + esc(b.unitLabel || '') + '" placeholder="optional">')
            : self._field('Per unit ($)', self._money('beverages.' + i + '.perHeadCents', b.perHeadCents))
              + self._field('Units included free', '<input type="number" min="0" data-oqb-path="beverages.' + i + '.includedHeads" value="' + esc(b.includedHeads != null ? b.includedHeads : 0) + '">')
              + self._field('Unit label', '<input type="text" data-oqb-path="beverages.' + i + '.unitLabel" value="' + esc(b.unitLabel || '') + '" placeholder="e.g. coffees, trays">')))
        + self._field('Description', '<textarea rows="2" data-oqb-path="beverages.' + i + '.description">' + esc(b.description || '') + '</textarea>')
        + self._showWhenChips('beverages.' + i, b)
        + '<input type="hidden" data-oqb-path="beverages.' + i + '.id" value="' + esc(b.id || '') + '">'
        + '</div>';
      return self._itemCard(b.label || 'New option', i, 'beverages', fields, i > 0, i < list.length - 1);
    }).join('');
    return '<p class="oqb-hint">Customers set a quantity on each option (e.g. 200 hot coffees + 50 iced + catering). Use <strong>Group</strong> for Drinks vs Catering headings. Optional <strong>Min quantity</strong> is ideal for catering trays — selecting the option starts at that minimum. Qty 0 = not selected.</p>'
      + '<div class="oqb-items">' + (cards || '<p class="oqb-empty">No packages yet.</p>') + '</div>'
      + '<button type="button" class="btn ghost" data-oqb-add="packages">+ Add package / option</button>';
  };

  QuoteBuilder.prototype._renderAddons = function() {
    var self = this;
    var list = this.config.addons || [];
    var cards = list.map(function(a, i) {
      var fields = '<div class="oqb-grid">'
        + self._field('Add-on name', '<input type="text" data-oqb-path="addons.' + i + '.label" value="' + esc(a.label || '') + '">')
        + self._displayBlock('addons.' + i, a, 'addons')
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
        + self._displayBlock('travel.zones.' + i, z, 'travel')
        + self._field('Travel fee', self._money('travel.zones.' + i + '.feeCents', z.feeCents))
        + self._field('Badge (on map)', '<input type="text" data-oqb-path="travel.zones.' + i + '.badge" value="' + esc(z.badge || '') + '" placeholder="e.g. 20KM">')
        + self._field('Sub-text (under title)', '<input type="text" data-oqb-path="travel.zones.' + i + '.subtitle" value="' + esc(z.subtitle || '') + '" placeholder="e.g. Inner Canberra radius">')
        + self._field('Description', '<textarea rows="2" data-oqb-path="travel.zones.' + i + '.description" placeholder="Help customers pick the right zone…">' + esc(z.description || '') + '</textarea>')
        + '<input type="hidden" data-oqb-path="travel.zones.' + i + '.id" value="' + esc(z.id || '') + '">'
        + '</div>';
      return self._itemCard(z.label || 'New zone', i, 'travel.zones', fields, i > 0, i < list.length - 1);
    }).join('');
    return '<p class="oqb-hint">Distance or region fees shown as equipment-style cards. Upload a map image per zone — customers can enlarge it to check if their venue is inside the radius. Add the <strong>Travel zone</strong> step in Wizard flow so customers pick a zone. Card colours follow Equipment card styling (or Travel card styling if set).</p>'
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
    else if (/Cents$/.test(last) || last === 'hourlyCents' || last === 'feeCents' || last === 'fixedCents' || last === 'perHeadCents' || last === 'packageCents' || last === 'baseCents' || last === 'perUnitCents') {
      obj[last] = cents(value);
    } else if (last === 'minimumHours' || last === 'includedHeads' || last === 'quoteValidityDays' || last === 'minimumNoticeDays' || last === 'minQty' || last === 'baristasIncluded' || last === 'minimumHoursPerShift' || last === 'strokeWidth') {
      obj[last] = parseInt(value, 10) || 0;
    } else if (last === 'maxQuantity' || last === 'minQuantity') {
      if (value === '' || value == null) obj[last] = null;
      else {
        var mq = parseInt(value, 10);
        obj[last] = (!isNaN(mq) && mq > 0) ? Math.min(50000, mq) : null;
      }
    } else if (last === 'allowShiftPlanner' || last === 'allowQuantity' || last === 'allowExtraBarista' || last === 'enabled' || last === 'allowMultiCart' || last === 'required') {
      obj[last] = !!value;
    } else if (last === 'options') {
      obj[last] = String(value || '').split(/\n/).map(function(s) { return s.trim(); }).filter(Boolean);
    } else if (last === 'attachTo') {
      obj[last] = (value === 'event' || value === 'contact') ? value : 'custom';
    } else if (last === 'imageScale') {
      var sc = parseInt(value, 10);
      obj[last] = isNaN(sc) ? 100 : Math.min(250, Math.max(50, sc));
    } else if (last === 'displayMode' || last === 'imageSize' || last === 'imageUrl' || last === 'imagePid' || last === 'imageFit' || last === 'imagePos' || last === 'imageAxis') {
      obj[last] = value;
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

  QuoteBuilder.prototype._applyLayout = function(value, radio) {
    if (!this.config.wizard) this.config.wizard = {};
    this.config.wizard.layout = value;
    var self = this;
    this.root.querySelectorAll('.oqb-layout').forEach(function(lbl) {
      lbl.classList.toggle('is-on', lbl.querySelector('input[name="oqb-layout"]') === radio);
    });
    this._refreshPreview();
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
    this._ensureCustomStep();
  };

  QuoteBuilder.prototype._wire = function() {
    var self = this;
    var hosts = [this.headRoot, this.sectionRoot, this.root].filter(Boolean);
    function qsAll(sel) {
      var out = [];
      hosts.forEach(function(h) {
        h.querySelectorAll(sel).forEach(function(el) { out.push(el); });
      });
      return out;
    }

    this.root.querySelectorAll('[data-oqb-tab]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        self._syncFromDom();
        self.tab = btn.getAttribute('data-oqb-tab');
        if (self.tab === 'wizard' || self.tab === 'products') {
          self.previewPinEquipment = true;
          self._ensurePreviewEquipmentStep();
          // Keep full equipment grid visible while styling (opt-in via Focus checkbox)
        }
        if (self.tab === 'travel') {
          self.previewPinEquipment = false;
          self._ensurePreviewTravelStep();
        }
        if (self.tab === 'questions') {
          self._jumpPreviewToStep('custom');
        }
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

    this.root.querySelectorAll('input[name="oqb-layout"]').forEach(function(radio) {
      radio.addEventListener('change', function() {
        if (!radio.checked) return;
        self._applyLayout(radio.value, radio);
      });
    });

    this.root.querySelectorAll('.oqb-layout').forEach(function(lbl) {
      lbl.addEventListener('click', function() {
        var radio = lbl.querySelector('input[name="oqb-layout"]');
        if (!radio) return;
        radio.checked = true;
        self._applyLayout(radio.value, radio);
      });
    });

    this.root.querySelectorAll('[data-oqb-step-move]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        self._syncFromDom();
        self._moveWizardStep(btn.getAttribute('data-oqb-step-id'), btn.getAttribute('data-oqb-step-move'));
        self._render();
      });
    });

    qsAll('[data-oqb="toggle-json"]').forEach(function(tj) {
      tj.addEventListener('click', function() {
        if (self.showJson) {
          var ta = self.root.querySelector('[data-oqb="json"]');
          try { self.config = normalizeConfig(JSON.parse(ta.value)); } catch (e) { alert('Invalid JSON — fix before switching back.'); return; }
        } else {
          self._syncFromDom();
        }
        self.showJson = !self.showJson;
        self._render();
      });
    });

    function syncHexForPath(path, val) {
      qsAll('[data-oqb-color-hex="' + path + '"]').forEach(function(hx) {
        hx.value = val || '';
      });
      qsAll('[data-oqb-path="' + path + '"]').forEach(function(sw) {
        if (sw.type === 'color' && val) sw.value = val;
      });
    }

    this.root.querySelectorAll('[data-oqb-path]').forEach(function(el) {
      if (el.type === 'color') {
        el.addEventListener('input', function() {
          var path = el.getAttribute('data-oqb-path');
          self._setPath(path, el.value);
          syncHexForPath(path, el.value);
          if (self._previewNeedsEquipment(path)) {
            self.previewPinEquipment = true;
            self._ensurePreviewEquipmentStep();
            if (path.indexOf('wizard.ui') === 0) self.previewPinEquipment = false;
          }
          if (self._previewNeedsTravel(path)) {
            self.previewPinEquipment = false;
            self._ensurePreviewTravelStep();
          }
          self._refreshPreview();
        });
        return;
      }
      var ev = (el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'range') ? 'change' : 'input';
      el.addEventListener(ev, function() {
        var path = el.getAttribute('data-oqb-path');
        self._setPath(path, el.type === 'checkbox' ? el.checked : el.value);
        if (path && path.indexOf('.icon') >= 0) self._render();
        else {
          if (self._previewNeedsEquipment(path)) {
            self.previewPinEquipment = true;
            self._ensurePreviewEquipmentStep();
            if (path.indexOf('wizard.ui') === 0) self.previewPinEquipment = false;
          }
          if (self._previewNeedsTravel(path)) {
            self.previewPinEquipment = false;
            self._ensurePreviewTravelStep();
          }
          self._refreshPreview();
        }
      });
    });

    qsAll('[data-oqb-color-hex]').forEach(function(hx) {
      hx.addEventListener('input', function() {
        var path = hx.getAttribute('data-oqb-color-hex');
        var raw = hx.value.trim();
        if (raw === '') {
          self._setPath(path, '');
          self._refreshPreview();
          return;
        }
        var v = self._normHex(raw);
        if (!v) return;
        self._setPath(path, v);
        qsAll('[data-oqb-path="' + path + '"]').forEach(function(sw) {
          if (sw.type === 'color') sw.value = v;
        });
        if (self._previewNeedsEquipment(path)) {
          self.previewPinEquipment = true;
          self._ensurePreviewEquipmentStep();
        }
        if (self._previewNeedsTravel(path)) {
          self.previewPinEquipment = false;
          self._ensurePreviewTravelStep();
        }
        self._refreshPreview();
      });
    });

    qsAll('[data-oqb-color-def]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var path = btn.getAttribute('data-oqb-color-def');
        self._setPath(path, '');
        syncHexForPath(path, '');
        var wrap = btn.closest('.oqb-color');
        var sw = wrap && wrap.querySelector('input[type=color]');
        if (sw) {
          var ph = wrap.querySelector('.oqb-color-hex');
          var fb = self._normHex(ph && ph.getAttribute('placeholder'));
          if (fb) sw.value = fb;
        }
        if (self._previewNeedsEquipment(path)) {
          self.previewPinEquipment = true;
          self._ensurePreviewEquipmentStep();
        }
        if (self._previewNeedsTravel(path)) {
          self.previewPinEquipment = false;
          self._ensurePreviewTravelStep();
        }
        self._refreshPreview();
      });
    });

    // Page section (eyebrow / heading / colours / container style) — lives under Wizard tab
    qsAll('[data-oq-sec-text]').forEach(function(el) {
      var ev = el.tagName === 'TEXTAREA' ? 'input' : 'input';
      el.addEventListener(ev, function() {
        var key = el.getAttribute('data-oq-sec-text');
        self.section[key] = el.value;
        self._notifySection();
        self._refreshPreview();
      });
    });
    function setSecColor(key, v) {
      v = self._normHex(v);
      self.section[key] = v;
      qsAll('[data-oq-sec-hex="' + key + '"]').forEach(function(hx) { hx.value = v || ''; });
      if (v) qsAll('[data-oq-sec-clr="' + key + '"]').forEach(function(sw) { sw.value = v; });
      self._notifySection();
      self._refreshPreview();
    }
    qsAll('[data-oq-sec-clr]').forEach(function(sw) {
      sw.addEventListener('input', function() {
        setSecColor(sw.getAttribute('data-oq-sec-clr'), sw.value);
      });
    });
    qsAll('[data-oq-sec-hex]').forEach(function(hx) {
      hx.addEventListener('input', function() {
        var key = hx.getAttribute('data-oq-sec-hex');
        var raw = hx.value.trim();
        if (raw === '') { setSecColor(key, ''); return; }
        var v = self._normHex(raw);
        if (v) setSecColor(key, v);
      });
    });
    qsAll('[data-oq-sec-def]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        setSecColor(btn.getAttribute('data-oq-sec-def'), '');
      });
    });
    function ensureApp() {
      if (!self.section.appearance) self.section.appearance = {};
      return self.section.appearance;
    }
    qsAll('[data-oq-sec-app]').forEach(function(el) {
      var key = el.getAttribute('data-oq-sec-app');
      var ev = el.type === 'checkbox' || el.type === 'range' || el.tagName === 'SELECT' ? 'change' : 'input';
      if (el.type === 'range') ev = 'input';
      el.addEventListener(ev, function() {
        var app = ensureApp();
        if (key === 'custom') {
          app.custom = !!el.checked;
          var wrap = el.closest('.oqb-sec-appearance') || el.closest('.oqb-section-style');
          var fields = wrap && wrap.querySelector('.oqb-sec-app-fields');
          if (fields) fields.hidden = !el.checked;
        } else if (key === 'strokeWidth') {
          app.strokeWidth = +el.value;
          var host = el.closest('.oqb-field') || el.parentElement;
          var lab = host && host.querySelector('[data-oq-sec-app-sw-label]');
          if (lab) lab.textContent = el.value + 'px';
        } else {
          app[key] = el.value;
        }
        self._notifySection();
        self._refreshPreview();
      });
    });
    function setAppColor(key, v) {
      v = self._normHex(v);
      ensureApp()[key] = v;
      qsAll('[data-oq-sec-app-hex="' + key + '"]').forEach(function(hx) { hx.value = v || ''; });
      if (v) qsAll('[data-oq-sec-app-clr="' + key + '"]').forEach(function(sw) { sw.value = v; });
      self._notifySection();
      self._refreshPreview();
    }
    qsAll('[data-oq-sec-app-clr]').forEach(function(sw) {
      sw.addEventListener('input', function() {
        setAppColor(sw.getAttribute('data-oq-sec-app-clr'), sw.value);
      });
    });
    qsAll('[data-oq-sec-app-hex]').forEach(function(hx) {
      hx.addEventListener('input', function() {
        var key = hx.getAttribute('data-oq-sec-app-hex');
        var raw = hx.value.trim();
        if (raw === '') { setAppColor(key, ''); return; }
        var v = self._normHex(raw);
        if (v) setAppColor(key, v);
      });
    });
    qsAll('[data-oq-sec-app-def]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        setAppColor(btn.getAttribute('data-oq-sec-app-def'), '');
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
        if (kind === 'products') self.config.products.push({ id: uid('product'), label: 'New product', type: 'equipment', baseCents: 0, icon: 'package', displayMode: 'icon' });
        if (kind === 'packages') self.config.beverages.push({
          id: uid('bev'), label: 'New package', pricingMode: 'per_head', perHeadCents: 0, includedHeads: 0,
          tiers: [{ minQty: 100, perUnitCents: 300 }, { minQty: 1, perUnitCents: 500 }],
          unitLabel: 'units', icon: 'users', displayMode: 'icon'
        });
        if (kind === 'addons') self.config.addons.push({ id: uid('addon'), label: 'New add-on', fixedCents: 0, icon: 'plus-circle', displayMode: 'icon' });
        if (kind === 'customFields') {
          if (!self.config.wizard) self.config.wizard = {};
          if (!Array.isArray(self.config.wizard.customFields)) self.config.wizard.customFields = [];
          self.config.wizard.customFields.push({
            id: uid('field'),
            type: 'text',
            label: 'New question',
            placeholder: '',
            helpText: '',
            required: false,
            options: [],
            attachTo: 'custom'
          });
          self._ensureCustomStep();
        }
        if (kind === 'travel') {
          if (!self.config.travel) self.config.travel = { zones: [] };
          self.config.travel.zones.push({
            id: uid('zone'),
            label: 'New zone',
            feeCents: 0,
            icon: 'map-pin',
            displayMode: 'image',
            badge: '',
            subtitle: '',
            description: '',
            imageFit: 'cover',
            imagePos: 'center',
            imageAxis: 'frame',
            imageScale: 100
          });
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
        var removed = null;
        if (path === 'products') { removed = self.config.products[idx]; self.config.products.splice(idx, 1); }
        else if (path === 'beverages') { removed = self.config.beverages[idx]; self.config.beverages.splice(idx, 1); }
        else if (path === 'addons') { removed = self.config.addons[idx]; self.config.addons.splice(idx, 1); }
        else if (path === 'travel.zones') { removed = self.config.travel.zones[idx]; self.config.travel.zones.splice(idx, 1); }
        else if (path === 'wizard.customFields') {
          removed = self.config.wizard.customFields[idx];
          self.config.wizard.customFields.splice(idx, 1);
          self._ensureCustomStep();
        }
        if (removed) self._deleteItemImage(removed);
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
        else if (path === 'wizard.customFields') list = self.config.wizard.customFields;
        if (!list) return;
        var j = dir === 'up' ? idx - 1 : idx + 1;
        if (j < 0 || j >= list.length) return;
        var tmp = list[idx];
        list[idx] = list[j];
        list[j] = tmp;
        self._render();
      });
    });

    this.root.querySelectorAll('[data-oqb-display-mode]').forEach(function(radio) {
      radio.addEventListener('change', function() {
        if (!radio.checked) return;
        self._syncFromDom();
        var path = radio.getAttribute('data-oqb-display-mode');
        self._setPath(path + '.displayMode', radio.value);
        self._render();
      });
    });

    this.root.querySelectorAll('[data-oqb-img-up]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (!self.media || !self.media.pick || !self.media.upload) return;
        var path = btn.getAttribute('data-oqb-img-up');
        var kind = btn.getAttribute('data-oqb-upload-kind') || 'items';
        var item = self._getItemAtPath(path);
        if (!item) return;
        if (!item.id) item.id = uid(kind);
        self.media.pick(function(file) {
          btn.disabled = true;
          var oldPid = item.imagePid || '';
          self.media.upload(file, [kind, item.id]).then(function(res) {
            item.imageUrl = res.url || '';
            item.imagePid = res.publicId || '';
            item.displayMode = 'image';
            if (oldPid && oldPid !== item.imagePid && self.media.delete) self.media.delete(oldPid);
            self._render();
          }).catch(function(err) {
            if (typeof global.toast === 'function') global.toast('Upload failed: ' + ((err && err.message) || err));
            else alert('Upload failed');
          }).then(function() { btn.disabled = false; });
        });
      });
    });

    this.root.querySelectorAll('[data-oqb-img-clr]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        self._syncFromDom();
        var path = btn.getAttribute('data-oqb-img-clr');
        var item = self._getItemAtPath(path);
        if (item) self._deleteItemImage(item);
        self._render();
      });
    });

    this.root.querySelectorAll('[data-oqb-path$=".imageScale"]').forEach(function(inp) {
      inp.addEventListener('input', function() {
        self._setPath(inp.getAttribute('data-oqb-path'), inp.value);
        var path = inp.getAttribute('data-oqb-path').replace(/\.imageScale$/, '');
        var lbl = self.root.querySelector('[data-oqb-scale-for="' + path + '"]');
        if (lbl) lbl.textContent = inp.value + '%';
        var panel = inp.closest('[data-oqb-img-panel]');
        var preview = panel && panel.querySelector('.oqb-img-preview');
        if (preview) {
          var item = self._getItemAtPath(path);
          var px = displayApi().displayPx ? displayApi().displayPx(item && item.imageSize, inp.value) : 80;
          preview.style.maxHeight = px + 'px';
        }
        self._refreshPreview();
      });
    });

    this.root.querySelectorAll('[data-oqb-path$=".imageSize"]').forEach(function(sel) {
      sel.addEventListener('change', function() {
        self._setPath(sel.getAttribute('data-oqb-path'), sel.value);
        self._render();
      });
    });

    this.root.querySelectorAll('[data-oqb-add-tier]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        self._syncFromDom();
        var idx = parseInt(btn.getAttribute('data-oqb-add-tier'), 10);
        var bev = self.config.beverages[idx];
        if (!bev) return;
        if (!Array.isArray(bev.tiers)) bev.tiers = [];
        bev.tiers.push({ minQty: 1, perUnitCents: 0 });
        self._render();
      });
    });

    this.root.querySelectorAll('[data-oqb-tier-remove]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        self._syncFromDom();
        var bevIdx = parseInt(btn.getAttribute('data-oqb-tier-remove'), 10);
        var tierIdx = parseInt(btn.getAttribute('data-oqb-tier-idx'), 10);
        var bev = self.config.beverages[bevIdx];
        if (!bev || !bev.tiers) return;
        bev.tiers.splice(tierIdx, 1);
        self._render();
      });
    });

    this.root.querySelectorAll('[data-oqb-path$=".pricingMode"]').forEach(function(sel) {
      sel.addEventListener('change', function() {
        self._setPath(sel.getAttribute('data-oqb-path'), sel.value);
        var m = sel.getAttribute('data-oqb-path').match(/beverages\.(\d+)\.pricingMode/);
        if (m) {
          var bi = parseInt(m[1], 10);
          var bev = self.config.beverages[bi];
          if (bev && sel.value === 'tiered' && (!bev.tiers || !bev.tiers.length)) {
            bev.tiers = [{ minQty: 100, perUnitCents: 300 }, { minQty: 1, perUnitCents: 500 }];
            if (!bev.unitLabel) bev.unitLabel = 'units';
          }
        }
        self._render();
      });
    });

    this.root.querySelectorAll('[data-oqb-path*="wizard.customFields."][data-oqb-path$=".type"], [data-oqb-path*="wizard.customFields."][data-oqb-path$=".attachTo"]').forEach(function(sel) {
      sel.addEventListener('change', function() {
        self._syncFromDom();
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
    var bevIds = (bevs || []).map(function(b) { return b.id; });
    if (!Array.isArray(p.beverageLines)) p.beverageLines = [];
    p.beverageLines = p.beverageLines.filter(function(l) {
      return l && l.beverageId && bevIds.indexOf(l.beverageId) >= 0 && (Number(l.quantity) || 0) > 0;
    });
    if (p.beverageLines.length) {
      p.beverageId = p.beverageLines[0].beverageId;
      p.guestCount = p.beverageLines[0].quantity;
      p.unitCount = p.beverageLines[0].quantity;
    } else if (p.beverageId && bevIds.indexOf(p.beverageId) < 0) {
      p.beverageId = '';
    }
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
    var shell = this._toShell();
    var products = shell.products || [];
    var P = global.LPQuotePlanning;

    root.querySelectorAll('[data-oqb-zoom]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var act = btn.getAttribute('data-oqb-zoom');
        if (act === 'in') self.previewZoom = Math.min(200, (self.previewZoom || 100) + 10);
        else if (act === 'out') self.previewZoom = Math.max(50, (self.previewZoom || 100) - 10);
        else self.previewZoom = 100;
        self._applyPreviewZoom();
      });
    });

    var focusCb = root.querySelector('[data-oqb-preview-focus]');
    if (focusCb) focusCb.addEventListener('change', function() {
      self.previewFocusCard = !!focusCb.checked;
      self.previewPinEquipment = true;
      self._ensurePreviewEquipmentStep();
      self._refreshPreview();
    });

    root.querySelectorAll('[data-oqb-preview-jump]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var step = btn.getAttribute('data-oqb-preview-jump');
        if (step === 'travel') {
          self.previewPinEquipment = false;
          self._ensurePreviewTravelStep();
        } else {
          self.previewPinEquipment = true;
          self._ensurePreviewEquipmentStep();
        }
        self._refreshPreview();
      });
    });

    if (P && P.wireLabourPlanning) {
      P.wireLabourPlanning(root, this.previewProgress, shell, function() {
        self._reconcilePreviewSelections();
        self._refreshPreview();
      }, products);
    }
    if (P && P.wireStaffing) {
      P.wireStaffing(root, this.previewProgress, shell, products, function() {
        self._reconcilePreviewSelections();
        self._refreshPreview();
      });
    }
    if (P && P.wireCartRows) {
      P.wireCartRows(root, this.previewProgress, shell, products, function() {
        self._reconcilePreviewSelections();
        self._refreshPreview();
      });
    }
    if (P && P.wireTravelZoneRows) {
      P.wireTravelZoneRows(root, this.previewProgress, function() {
        self._reconcilePreviewSelections();
        self._refreshPreview();
      });
    }
    if (P && P.wireBeverageQty) {
      P.wireBeverageQty(root, this.previewProgress, function() {
        self._reconcilePreviewSelections();
        self._refreshPreview();
      });
    }

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
        if (f === 'hours' && P && P.setGlobalBarista1Hours) P.setGlobalBarista1Hours(self.previewProgress, v);
        else self.previewProgress[f] = v;
        if (f === 'unitCount') self.previewProgress.guestCount = v;
        self._refreshPreview();
      });
    });

    if (P && P.wireCustomFields) {
      P.wireCustomFields(root, this.previewProgress, 'data-prev-custom');
    }

    root.querySelectorAll('[data-prev-act]').forEach(function(btn) {
      btn.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return;
        e.preventDefault();
      });
      btn.addEventListener('click', function() {
        var act = btn.getAttribute('data-prev-act');
        if (P && P.syncEventFieldsFromDom) P.syncEventFieldsFromDom(root, self.previewProgress);
        if (P && P.syncBeverageQtyFromDom) P.syncBeverageQtyFromDom(root, self.previewProgress);
        if (P && P.syncCustomAnswersFromDom) {
          P.syncCustomAnswersFromDom(root, self.previewProgress, 'data-prev-custom');
        }
        var shell = self._toShell();
        var W = wl();
        var before = W.resolveWizardSteps
          ? W.resolveWizardSteps(shell.wizard, self.previewProgress, shell.travelZones.length)
          : (shell.wizard.steps || ['contact']);
        var idx = self.previewStep;
        self._reconcilePreviewSelections();
        var after = W.resolveWizardSteps
          ? W.resolveWizardSteps(shell.wizard, self.previewProgress, shell.travelZones.length)
          : before;
        var delta = act === 'back' ? -1 : 1;
        if (W.stepIndexAfterMove) {
          self.previewStep = W.stepIndexAfterMove(before, idx, delta, after);
        } else {
          self.previewStep = Math.max(0, Math.min(after.length - 1, idx + delta));
        }
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
