/**
 * LeadPages Order Engine — customer storefront mount.
 * Mount: <div id="lp-order-storefront" data-slug="site-slug"></div>
 * Or open /order-shop?slug=…
 */
(function () {
  'use strict';

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(c) {
    if (c == null) return 'TBC';
    return '$' + (Number(c) / 100).toFixed(2);
  }
  function qtyTotal(items) {
    var n = 0;
    (items || []).forEach(function (it) {
      n += Number(it.quantity) || 0;
    });
    return n;
  }

  async function api(path, opts) {
    opts = opts || {};
    var r = await fetch(path, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'content-type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    var j = null;
    try {
      j = await r.json();
    } catch (e) {
      j = {};
    }
    if (!r.ok) throw Object.assign(new Error((j && (j.message || j.error)) || 'request_failed'), { status: r.status, data: j });
    return j;
  }

  function cartKey(slug) {
    return 'lp.order.cart.' + slug;
  }

  function OrderStorefront(root) {
    this.root = root;
    this.slug = root.getAttribute('data-slug') || '';
    this.mode = root.getAttribute('data-mode') || 'embedded';
    this.showPortal = root.getAttribute('data-show-portal') !== '0';
    this.portalLabel =
      root.getAttribute('data-portal-label') || 'Sign in to your orders';
    this.state = {
      catalogue: null,
      cartId: localStorage.getItem(cartKey(this.slug)) || '',
      cart: null,
      items: [],
      pickupSlots: [],
      view: 'shop',
      listMode: (localStorage.getItem('lp.order.listMode.' + this.slug) === '1'),
      activeCategoryId: '',
      selected: null,
      busy: false,
      msg: '',
      mobileShowCart: false,
      notesOpen: {},
      fastDrafts: {},
      checkoutDraft: {
        name: '',
        phone: '',
        email: '',
        date: '',
        slotId: '',
        notes: ''
      }
    };
  }

  OrderStorefront.prototype.isFastMode = function () {
    return this.storefrontCfg().shop_mode === 'fast';
  };

  OrderStorefront.prototype.needsWeight = function (p) {
    if (!p) return false;
    if (this.isPackSize(p)) return false;
    return !!(p.weight_required || p.pricing_method === 'per_weight' || p.pricing_method === 'price_tbc');
  };

  OrderStorefront.prototype.isPackSize = function (p) {
    var o = (p && p.options) || {};
    return o.size_mode === 'pack' || o.size_mode === 'fixed' || !!p.is_pack_size;
  };

  OrderStorefront.prototype.packLabel = function (p) {
    if (p && p.pack_label) return String(p.pack_label);
    var o = (p && p.options) || {};
    if (o.pack_label) return String(o.pack_label);
    var w = Number(o.pack_weight_kg);
    if (!Number.isFinite(w) || w <= 0) return '';
    if (w >= 1) return w + ' kg';
    return Math.round(w * 1000) + 'g';
  };

  OrderStorefront.prototype.stepperHtml = function (opts) {
    opts = opts || {};
    var step = opts.step != null ? opts.step : 1;
    var min = opts.min != null ? opts.min : 1;
    var val = opts.value != null ? opts.value : min;
    var idAttr = opts.id ? ' id="' + esc(opts.id) + '"' : '';
    var dataAttr = opts.dataAttr || '';
    return (
      '<div class="lp-oe-stepper" data-step="' +
      esc(step) +
      '" data-min="' +
      esc(min) +
      '">' +
      '<button type="button" class="lp-oe-stepper-btn" data-stepper-dir="-1" aria-label="Decrease">−</button>' +
      '<input type="number" min="' +
      esc(min) +
      '" step="' +
      esc(step) +
      '" inputmode="decimal" value="' +
      esc(val) +
      '"' +
      idAttr +
      ' ' +
      dataAttr +
      '>' +
      '<button type="button" class="lp-oe-stepper-btn" data-stepper-dir="1" aria-label="Increase">+</button>' +
      '</div>'
    );
  };

  OrderStorefront.prototype.captureFastDrafts = function () {
    var self = this;
    if (!this.root) return;
    this.root.querySelectorAll('[data-fast-row]').forEach(function (row) {
      var id = row.getAttribute('data-fast-row');
      if (!id) return;
      var qty = row.querySelector('[data-fast-qty]');
      var kg = row.querySelector('[data-fast-kg]');
      var notes = row.querySelector('[data-fast-notes]');
      var draft = self.state.fastDrafts[id] || (self.state.fastDrafts[id] = {});
      if (qty) draft.qty = qty.value;
      if (kg) draft.kg = kg.value;
      if (notes) draft.notes = notes.value;
      var collected = self.collectAnswers(row);
      draft.answers = {};
      Object.keys(collected).forEach(function (k) {
        draft.answers[k] = collected[k].value;
      });
    });
  };

  OrderStorefront.prototype.portalUrl = function () {
    return '/order-portal?slug=' + encodeURIComponent(this.slug || '');
  };

  OrderStorefront.prototype.rememberSlug = function () {
    if (!this.slug) return;
    try {
      localStorage.setItem('lp.order.lastSlug', this.slug);
    } catch (_e) {}
  };

  OrderStorefront.prototype.applyPacked = function (packed) {
    if (!packed) return;
    this.state.cart = packed.cart || this.state.cart;
    this.state.items = packed.items || [];
    if (packed.deposit) this.state.deposit = packed.deposit;
    if (packed.display) this.state.display = packed.display;
    if (packed.earliest_pickup_date) this.state.earliest = packed.earliest_pickup_date;
    if (packed.pickup_slots) this.state.pickupSlots = packed.pickup_slots;
  };

  OrderStorefront.prototype.storefrontCfg = function () {
    var sys = this.state.catalogue && this.state.catalogue.system;
    return (sys && sys.storefront) || {};
  };

  OrderStorefront.prototype.visibleCategories = function () {
    return (this.state.catalogue && this.state.catalogue.categories) || [];
  };

  OrderStorefront.prototype.resolveDefaultCategory = function () {
    var cats = this.visibleCategories();
    if (!cats.length) return '';
    var cfg = this.storefrontCfg();
    var wantId = cfg.default_category_id || '';
    var wantSlug = String(cfg.default_category_slug || '').toLowerCase();
    if (wantId && cats.some(function (c) { return c.id === wantId; })) return wantId;
    if (wantSlug) {
      var bySlug = cats.find(function (c) {
        return String(c.slug || '').toLowerCase() === wantSlug;
      });
      if (bySlug) return bySlug.id;
    }
    return cats[0].id;
  };

  OrderStorefront.prototype.applyAppearance = function () {
    var cfg = this.storefrontCfg();
    var a = cfg.appearance || {};
    var el = this.root.querySelector('.lp-oe');
    if (!el) return;
    var map = {
      '--lp-oe-maxw': a.max_width ? (Number(a.max_width) + 'px') : '',
      '--lp-oe-pad': a.padding != null && a.padding !== '' ? (Number(a.padding) + 'px') : '',
      '--lp-oe-radius': a.radius != null && a.radius !== '' ? (Number(a.radius) + 'px') : '',
      '--lp-oe-accent': a.accent || '',
      '--lp-oe-card': a.card_bg || '',
      '--lp-oe-line': a.card_border || '',
      '--lp-oe-ink': a.text || '',
      '--lp-oe-muted': a.muted || '',
      '--lp-oe-btn-bg': a.btn_bg || '',
      '--lp-oe-btn-text': a.btn_text || '',
      '--lp-oe-input-bg': a.input_bg || '',
      '--lp-oe-input-border': a.input_border || '',
      '--lp-oe-page-bg': a.page_bg || ''
    };
    Object.keys(map).forEach(function (k) {
      if (map[k]) el.style.setProperty(k, map[k]);
      else el.style.removeProperty(k);
    });
  };

  OrderStorefront.prototype.init = async function () {
    try {
      this.rememberSlug();
      this.state.catalogue = await api('/api/order/storefront?slug=' + encodeURIComponent(this.slug));
      this.state.pickupSlots = this.state.catalogue.pickup_slots || [];
      this.state.earliest = this.state.catalogue.earliest_pickup_date;
      var cfg = this.storefrontCfg();
      // Default: category view only (no "All") — start on default / first category.
      if (cfg.show_all_categories) {
        this.state.activeCategoryId = '';
      } else {
        this.state.activeCategoryId = this.resolveDefaultCategory();
      }
      // Recover cart from reorder deep-link
      try {
        var params = new URLSearchParams(location.search);
        var qCart = params.get('cart_id') || params.get('cart');
        if (qCart) {
          this.state.cartId = qCart;
          localStorage.setItem(cartKey(this.slug), qCart);
        }
      } catch (_e) {}
      if (this.state.cartId) {
        try {
          var packed = await api(
            '/api/order/cart?slug=' +
              encodeURIComponent(this.slug) +
              '&cart_id=' +
              encodeURIComponent(this.state.cartId)
          );
          this.applyPacked(packed);
        } catch (e) {
          this.state.cartId = '';
          localStorage.removeItem(cartKey(this.slug));
        }
      }
      this.render();
    } catch (e) {
      this.root.innerHTML =
        '<div class="lp-oe-empty"><p>Online ordering is not available right now.</p><p class="muted">' +
        esc(e.message) +
        '</p></div>';
    }
  };

  OrderStorefront.prototype.ensureCart = async function () {
    if (this.state.cartId) return this.state.cartId;
    var r = await api('/api/order/cart', {
      method: 'POST',
      body: { action: 'create', slug: this.slug }
    });
    this.state.cartId = r.cart.id;
    this.state.cart = r.cart;
    localStorage.setItem(cartKey(this.slug), this.state.cartId);
    return this.state.cartId;
  };

  OrderStorefront.prototype.refreshCart = async function () {
    if (!this.state.cartId) return;
    var packed = await api(
      '/api/order/cart?slug=' +
        encodeURIComponent(this.slug) +
        '&cart_id=' +
        encodeURIComponent(this.state.cartId)
    );
    this.applyPacked(packed);
  };

  OrderStorefront.prototype.captureCheckoutDraft = function () {
    var d = this.state.checkoutDraft || (this.state.checkoutDraft = {});
    var name = $('#oe-name', this.root);
    var phone = $('#oe-phone', this.root);
    var email = $('#oe-email', this.root);
    var date = $('#oe-date', this.root);
    var slot = $('#oe-slot', this.root);
    var notes = $('#oe-cnotes', this.root);
    if (name) d.name = name.value;
    if (phone) d.phone = phone.value;
    if (email) d.email = email.value;
    if (date) d.date = date.value;
    if (slot) d.slotId = slot.value;
    if (notes) d.notes = notes.value;
  };

  OrderStorefront.prototype.render = function () {
    var c = this.state.catalogue;
    var biz = (c && c.site && c.site.business_name) || 'Order';
    var html = '';
    html += '<div class="lp-oe' + (this.mode === 'embedded' ? ' lp-oe-embedded' : '') + '">';
    if (this.mode === 'embedded') {
      html += '<div class="lp-oe-head lp-oe-head-compact">';
      html += '<div class="lp-oe-head-actions">';
      if (this.showPortal && this.slug) {
        html +=
          '<a class="lp-oe-portal" href="' +
          esc(this.portalUrl()) +
          '">' +
          esc(this.portalLabel) +
          '</a>';
      }
      html +=
        '<button type="button" class="lp-oe-cart-btn lp-oe-mobile-cart" data-act="toggle-cart">Cart (' +
        qtyTotal(this.state.items) +
        ')</button>';
      html += '</div></div>';
    } else {
      html +=
        '<header class="lp-oe-head"><div><p class="lp-oe-ey">Order online</p><h2 class="lp-oe-brand">' +
        esc(biz) +
        '</h2><p class="lp-oe-sub">Browse the menu, adjust your cart, and checkout on one page.</p></div>';
      html += '<div class="lp-oe-head-actions">';
      if (this.showPortal && this.slug) {
        html +=
          '<a class="lp-oe-portal" href="' +
          esc(this.portalUrl()) +
          '">' +
          esc(this.portalLabel) +
          '</a>';
      }
      html +=
        '<button type="button" class="lp-oe-cart-btn lp-oe-mobile-cart" data-act="toggle-cart">Cart (' +
        qtyTotal(this.state.items) +
        ')</button>';
      html += '</div></header>';
    }

    if (this.state.msg) html += '<p class="lp-oe-msg">' + esc(this.state.msg) + '</p>';

    html += '<div class="lp-oe-layout">';
    html += '<div class="lp-oe-main">';
    if (!this.isFastMode() && this.state.view === 'product' && this.state.selected) {
      html += this.renderProduct(this.state.selected);
    } else {
      html += this.renderShopToolbar();
      if (this.isFastMode()) {
        html += this.renderFastMenu();
      } else {
        var sysMode = (c && c.system && c.system.storefront_display_mode) || 'compact_cards';
        // Cards toggle must never fall back to product_list (that mode is List only).
        var gridMode = this.state.listMode
          ? 'product_list'
          : sysMode === 'product_list'
            ? 'compact_cards'
            : sysMode;
        html += this.renderGrid(gridMode);
      }
    }
    html += '</div>';
    html +=
      '<aside class="lp-oe-aside" id="oe-aside"' +
      (this.state.mobileShowCart ? '' : '') +
      '>' +
      this.renderLiveCart() +
      '</aside>';
    html += '</div></div>';
    this.root.innerHTML = html;
    this.applyAppearance();
    this.bind();
  };

  OrderStorefront.prototype.renderShopToolbar = function () {
    var self = this;
    var cfg = this.storefrontCfg();
    var cats = this.visibleCategories();
    var showAll = !!cfg.show_all_categories;
    var html = '<div class="lp-oe-toolbar">';
    html += '<div class="lp-oe-filters" role="tablist" aria-label="Categories">';
    if (showAll) {
      html +=
        '<button type="button" class="' +
        (!self.state.activeCategoryId ? 'on' : '') +
        '" data-act="cat" data-cat="">All</button>';
    }
    cats.forEach(function (cat) {
      html +=
        '<button type="button" class="' +
        (self.state.activeCategoryId === cat.id ? 'on' : '') +
        '" data-act="cat" data-cat="' +
        esc(cat.id) +
        '">' +
        esc(cat.name) +
        '</button>';
    });
    html += '</div>';
    if (!this.isFastMode()) {
      html += '<div class="lp-oe-view-toggle" role="group" aria-label="Layout">';
      html +=
        '<button type="button" class="lp-oe-view-btn' +
        (!this.state.listMode ? ' on' : '') +
        '" data-act="view-grid">Cards</button>';
      html +=
        '<button type="button" class="lp-oe-view-btn' +
        (this.state.listMode ? ' on' : '') +
        '" data-act="view-list">List</button>';
      html += '</div>';
    }
    html += '</div>';
    return html;
  };

  OrderStorefront.prototype.renderFastMenu = function () {
    var self = this;
    var products = (this.state.catalogue && this.state.catalogue.products) || [];
    var active = this.state.activeCategoryId;
    if (active) {
      products = products.filter(function (p) {
        return p.category_id === active;
      });
    }
    var html = '<div class="lp-oe-fast" role="list">';
    if (!products.length) {
      html += '<p class="lp-oe-empty">No products in this category yet.</p>';
    } else {
      products.forEach(function (p) {
        html += self.renderFastRow(p);
      });
    }
    html += '</div>';
    var dep = this.state.catalogue && this.state.catalogue.deposit;
    if (dep && dep.preview_cents > 0) {
      html +=
        '<p class="lp-oe-note">Deposit today: <strong>' +
        esc(dep.preview_label) +
        '</strong>. Final order price will be confirmed after items are prepared/weighed where needed.</p>';
    }
    return html;
  };

  OrderStorefront.prototype.choiceLabel = function (o) {
    if (typeof o === 'string') return o;
    var label = o.label || o.value || '';
    var price = Number(o.price_cents) || 0;
    if (price > 0) return label + ' (+' + money(price) + ')';
    if (price === 0 && (o.price_cents === 0 || o.price_cents === '0')) return label;
    return label;
  };

  OrderStorefront.prototype.renderQuestionFields = function (questions, answers) {
    var self = this;
    var html = '';
    answers = answers || {};
    (questions || []).forEach(function (q) {
      if (q.staff_only) return;
      var qv = answers[q.key] != null ? answers[q.key] : '';
      var selected = Array.isArray(qv)
        ? qv
        : String(qv || '')
            .split(',')
            .map(function (x) {
              return x.trim();
            })
            .filter(Boolean);
      html += '<div class="lp-oe-option-group">';
      html += '<p class="lp-oe-option-title">' + esc(q.label) + (q.required ? ' *' : '') + '</p>';
      if (q.field_type === 'checkboxes') {
        html += '<div class="lp-oe-option-list" data-q-multi="' + esc(q.key) + '">';
        (q.options || []).forEach(function (o) {
          var v = typeof o === 'string' ? o : o.value || o.label;
          var on = selected.indexOf(String(v)) >= 0;
          html +=
            '<label class="lp-oe-option-chip' +
            (on ? ' on' : '') +
            '"><input type="checkbox" data-q-check="' +
            esc(q.key) +
            '" value="' +
            esc(v) +
            '"' +
            (on ? ' checked' : '') +
            '> <span>' +
            esc(self.choiceLabel(o)) +
            '</span></label>';
        });
        html += '</div>';
      } else if (q.field_type === 'dropdown' || q.field_type === 'radio') {
        html += '<div class="lp-oe-option-list">';
        (q.options || []).forEach(function (o) {
          var v = typeof o === 'string' ? o : o.value || o.label;
          var on = String(qv) === String(v);
          html +=
            '<label class="lp-oe-option-chip' +
            (on ? ' on' : '') +
            '"><input type="radio" name="q-' +
            esc(q.key) +
            '" data-q="' +
            esc(q.key) +
            '" value="' +
            esc(v) +
            '"' +
            (on ? ' checked' : '') +
            '> <span>' +
            esc(self.choiceLabel(o)) +
            '</span></label>';
        });
        html += '</div>';
      } else if (q.field_type === 'long_text') {
        html +=
          '<textarea data-q="' +
          esc(q.key) +
          '" rows="1" class="lp-oe-notes-grow">' +
          esc(qv) +
          '</textarea>';
      } else {
        html += '<input data-q="' + esc(q.key) + '" value="' + esc(qv) + '">';
      }
      html += '</div>';
    });
    return html;
  };

  OrderStorefront.prototype.collectAnswers = function (scope) {
    var answers = {};
    var root = scope || this.root;
    root.querySelectorAll('[data-q]').forEach(function (inp) {
      if (inp.type === 'radio' && !inp.checked) return;
      answers[inp.getAttribute('data-q')] = {
        value: inp.value,
        label: inp.getAttribute('data-q')
      };
    });
    var multiKeys = {};
    root.querySelectorAll('[data-q-check]').forEach(function (inp) {
      var key = inp.getAttribute('data-q-check');
      if (!multiKeys[key]) multiKeys[key] = [];
      if (inp.checked) multiKeys[key].push(inp.value);
    });
    Object.keys(multiKeys).forEach(function (key) {
      answers[key] = { value: multiKeys[key], label: key };
    });
    return answers;
  };

  OrderStorefront.prototype.renderFastRow = function (p) {
    var id = p.id;
    var draft = this.state.fastDrafts[id] || {};
    var notesOpen = !!this.state.notesOpen[id];
    var needsW = this.needsWeight(p);
    var pack = this.packLabel(p);
    var hasQs = (p.questions || []).length > 0;
    var qtyVal = draft.qty != null && draft.qty !== '' ? draft.qty : '1';
    var kgVal = draft.kg != null ? draft.kg : '';
    var notesVal = draft.notes || '';
    var hasImg = !!p.image_url;
    var html = '';
    html +=
      '<article class="lp-oe-fast-row' +
      (notesOpen ? ' is-notes-open' : '') +
      (hasImg ? '' : ' no-img') +
      '" data-fast-row="' +
      esc(id) +
      '" role="listitem">';
    html += '<div class="lp-oe-fast-main' + (hasImg ? '' : ' no-img') + '">';
    if (hasImg) {
      html +=
        '<div class="lp-oe-fast-img" style="background-image:url(\'' +
        esc(p.image_url) +
        '\')"></div>';
    }
    html += '<div class="lp-oe-fast-info">';
    html += '<h3>' + esc(p.name) + '</h3>';
    if (pack) html += '<p class="lp-oe-pack">' + esc(pack) + ' pack</p>';
    if (p.short_description) html += '<p class="lp-oe-fast-desc">' + esc(p.short_description) + '</p>';
    html += '<div class="lp-oe-price">' + esc(p.display_price) + '</div>';
    html += '</div>';
    html += '<div class="lp-oe-fast-controls">';
    html += '<label class="lp-oe-fast-field">Qty' + this.stepperHtml({ min: 1, step: 1, value: qtyVal, dataAttr: 'data-fast-qty' }) + '</label>';
    if (needsW) {
      html +=
        '<label class="lp-oe-fast-field">kg' +
        this.stepperHtml({
          min: 0.1,
          step: 0.1,
          value: kgVal || '0.1',
          dataAttr: 'data-fast-kg'
        }) +
        '</label>';
    } else if (pack) {
      html += '<span class="lp-oe-fast-packchip" title="Fixed pack size">' + esc(pack) + '</span>';
    }
    html +=
      '<button type="button" class="lp-oe-fast-notes-btn' +
      (notesOpen ? ' on' : '') +
      '" data-act="toggle-notes" data-id="' +
      esc(id) +
      '" aria-expanded="' +
      (notesOpen ? 'true' : 'false') +
      '">' +
      (notesOpen ? 'Hide extras' : hasQs ? 'Options' : 'Notes') +
      '</button>';
    html +=
      '<button type="button" class="lp-oe-fast-add" data-act="add-inline" data-id="' +
      esc(id) +
      '"' +
      (this.state.busy ? ' disabled' : '') +
      '>Add</button>';
    html += '</div></div>';
    if (notesOpen) {
      html += '<div class="lp-oe-fast-extra">';
      if (hasQs) html += this.renderQuestionFields(p.questions, draft.answers || {});
      html +=
        '<label class="lp-oe-field">Notes<textarea class="lp-oe-notes-grow" rows="1" data-fast-notes placeholder="Optional notes">' +
        esc(notesVal) +
        '</textarea></label>';
      html += '</div>';
    }
    html += '</article>';
    return html;
  };

  OrderStorefront.prototype.renderGrid = function (mode) {
    var self = this;
    var products = (this.state.catalogue && this.state.catalogue.products) || [];
    var active = this.state.activeCategoryId;
    if (active) {
      products = products.filter(function (p) {
        return p.category_id === active;
      });
    }
    var html = '';
    var cls =
      mode === 'product_list'
        ? 'lp-oe-list'
        : mode === 'quick_order_table'
          ? 'lp-oe-table'
          : 'lp-oe-grid';
    html += '<div class="' + cls + '">';
    products.forEach(function (p) {
      var hasImg = !!p.image_url;
      var pack = self.packLabel(p);
      html +=
        '<article class="lp-oe-card' +
        (hasImg ? '' : ' no-img') +
        '" data-cat="' +
        esc(p.category_id || '') +
        '" data-open="' +
        esc(p.id) +
        '">';
      if (hasImg) {
        html += '<div class="lp-oe-img" style="background-image:url(\'' + esc(p.image_url) + '\')"></div>';
      }
      html += '<div class="lp-oe-body"><h3>' + esc(p.name) + '</h3>';
      if (pack) html += '<p class="lp-oe-pack">' + esc(pack) + ' pack</p>';
      if (p.short_description) html += '<p>' + esc(p.short_description) + '</p>';
      html += '<div class="lp-oe-price">' + esc(p.display_price) + '</div>';
      html += '<button type="button" data-open="' + esc(p.id) + '">Add</button></div></article>';
    });
    if (!products.length) html += '<p class="lp-oe-empty">No products in this category yet.</p>';
    html += '</div>';
    var dep = this.state.catalogue && this.state.catalogue.deposit;
    if (dep && dep.preview_cents > 0) {
      html +=
        '<p class="lp-oe-note">Deposit today: <strong>' +
        esc(dep.preview_label) +
        '</strong>. Final order price will be confirmed after items are prepared/weighed where needed.</p>';
    }
    return html;
  };

  OrderStorefront.prototype.renderProduct = function (p) {
    var pack = this.packLabel(p);
    var needsW = this.needsWeight(p);
    var html = '<div class="lp-oe-detail">';
    html += '<button type="button" class="lp-oe-link" data-act="back-shop">← Back</button>';
    html += '<h3>' + esc(p.name) + '</h3>';
    if (pack) html += '<p class="lp-oe-pack">' + esc(pack) + ' pack</p>';
    html += '<p class="lp-oe-price">' + esc(p.display_price) + '</p>';
    if (p.description || p.short_description)
      html += '<p class="lp-oe-desc">' + esc(p.description || p.short_description) + '</p>';
    html += '<div class="lp-oe-fields lp-oe-fields-app">';
    html += '<div class="lp-oe-field-row">';
    html += '<label class="lp-oe-field">Quantity' + this.stepperHtml({ min: 1, step: 1, value: 1, id: 'oe-qty' }) + '</label>';
    if (needsW) {
      html +=
        '<label class="lp-oe-field">Approx. weight (kg)' +
        this.stepperHtml({ min: 0.1, step: 0.1, value: '1.0', id: 'oe-kg' }) +
        '</label>';
    } else if (pack) {
      html += '<p class="lp-oe-pack-note">Sold as ' + esc(pack) + ' packs — choose quantity only.</p>';
    }
    html +=
      '<label class="lp-oe-field">Notes<textarea id="oe-notes" class="lp-oe-notes-grow" rows="1" placeholder="Optional"></textarea></label>';
    html += '</div>';
    html += this.renderQuestionFields(p.questions || {}, {});
    html += '</div>';
    html +=
      '<button type="button" class="lp-oe-primary" data-act="add-product" data-id="' +
      esc(p.id) +
      '"' +
      (this.state.busy ? ' disabled' : '') +
      '>Add to cart</button>';
    if ((p.related || []).length && this.state.catalogue) {
      var heading =
        (this.state.catalogue.system && this.state.catalogue.system.cross_sell_heading) ||
        'You Might Also Like';
      html += '<div class="lp-oe-related"><h4>' + esc(heading) + '</h4><ul>';
      var self = this;
      p.related.forEach(function (rel) {
        var rp = (self.state.catalogue.products || []).find(function (x) {
          return x.id === rel.related_product_id;
        });
        if (rp)
          html +=
            '<li><button type="button" data-open="' +
            esc(rp.id) +
            '">' +
            esc(rp.name) +
            '</button></li>';
      });
      html += '</ul></div>';
    }
    html += '</div>';
    return html;
  };

  OrderStorefront.prototype.linePriceLabel = function (it) {
    if (it.price_status === 'tbc' || it.price_status === 'quote_required') return 'Price TBC';
    if (it.line_known_cents != null) {
      return money(it.line_known_cents) + (it.price_status === 'estimated' ? ' est.' : '');
    }
    return 'Price TBC';
  };

  OrderStorefront.prototype.renderCart = function () {
    return this.renderLiveCart();
  };

  OrderStorefront.prototype.renderLiveCart = function () {
    var self = this;
    var d = this.state.checkoutDraft || {};
    var html = '';
    html += '<h3>Your cart</h3>';

    html += '<div class="lp-oe-login">';
    html += '<h4>Already ordered?</h4>';
    html +=
      '<p>Sign in with your mobile to view past orders.</p><a class="lp-oe-portal" href="' +
      esc(this.portalUrl()) +
      '">' +
      esc(this.portalLabel) +
      '</a>';
    html += '</div>';

    if (!this.state.items.length) {
      html += '<p class="lp-oe-empty" style="padding:12px 0">Cart is empty — add items from the menu.</p>';
      return html;
    }
    this.state.items.forEach(function (it) {
      var snap = it.product_snapshot || {};
      var q = Number(it.quantity) || 1;
      html += '<div class="lp-oe-line" data-line="' + esc(it.id) + '">';
      html += '<div class="lp-oe-line-main"><strong>' + esc(snap.name || 'Item') + '</strong>';
      if (snap.pack_label) {
        html += '<p class="lp-oe-line-meta">' + esc(snap.pack_label) + ' pack</p>';
      } else if (it.requested_weight_kg != null) {
        html += '<p class="lp-oe-line-meta">~' + esc(it.requested_weight_kg) + 'kg</p>';
      }
      if (snap.selected_options && snap.selected_options.length) {
        html +=
          '<p class="lp-oe-line-meta">' +
          esc(
            snap.selected_options
              .map(function (o) {
                return o.label + (o.price_cents ? ' (+' + money(o.price_cents) + ')' : '');
              })
              .join(', ')
          ) +
          '</p>';
      }
      html += '<p class="lp-oe-price">' + esc(self.linePriceLabel(it)) + '</p></div>';
      html += '<div class="lp-oe-line-actions">';
      html += '<div class="lp-oe-qty" role="group" aria-label="Quantity">';
      html +=
        '<button type="button" class="lp-oe-qty-btn" data-act="qty-dec" data-id="' +
        esc(it.id) +
        '"' +
        (self.state.busy ? ' disabled' : '') +
        ' aria-label="Decrease">−</button>';
      html += '<span class="lp-oe-qty-val">' + esc(q) + '</span>';
      html +=
        '<button type="button" class="lp-oe-qty-btn" data-act="qty-inc" data-id="' +
        esc(it.id) +
        '"' +
        (self.state.busy ? ' disabled' : '') +
        ' aria-label="Increase">+</button>';
      html += '</div>';
      html +=
        '<button type="button" class="lp-oe-remove" data-act="remove" data-id="' +
        esc(it.id) +
        '"' +
        (self.state.busy ? ' disabled' : '') +
        '>Remove</button>';
      html += '</div></div>';
    });
    html += '<div class="lp-oe-summary">';
    var knownLbl =
      (this.state.display && this.state.display.known_subtotal) ||
      money(this.state.cart && this.state.cart.known_subtotal_cents);
    var estLbl = this.state.display && this.state.display.estimated_subtotal;
    if (estLbl && estLbl !== knownLbl) {
      html +=
        '<div class="row"><span>Estimated items</span><strong>' + esc(estLbl) + '</strong></div>';
    } else {
      html +=
        '<div class="row"><span>Known items</span><strong>' + esc(knownLbl) + '</strong></div>';
    }
    if (this.state.cart && this.state.cart.has_unknown_prices)
      html += '<div class="row"><span>Other items</span><strong>Price TBC</strong></div>';
    html +=
      '<div class="row emph"><span>Deposit due today</span><strong>' +
      esc((this.state.display && this.state.display.deposit) || '—') +
      '</strong></div>';
    html +=
      '<p class="lp-oe-note" style="margin:8px 0 0">Final balance TBC after preparation where products are weighed or quoted.</p>';
    html += '</div>';

    var slots = this.state.pickupSlots || [];
    html += '<div class="lp-oe-fields">';
    html +=
      '<label>Your name<input id="oe-name" required value="' + esc(d.name || '') + '"></label>';
    html +=
      '<label>Mobile<input id="oe-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="04xx xxx xxx" value="' +
      esc(d.phone || '') +
      '"></label>';
    html +=
      '<label>Email<input id="oe-email" type="email" autocomplete="email" value="' +
      esc(d.email || '') +
      '"></label>';
    if (slots.length) {
      html += '<label>Pickup window<select id="oe-slot" required>';
      html += '<option value="">Choose a pickup time…</option>';
      slots.forEach(function (s) {
        html +=
          '<option value="' +
          esc(s.id) +
          '"' +
          (d.slotId === s.id ? ' selected' : '') +
          '>' +
          esc(s.label) +
          '</option>';
      });
      html += '</select></label>';
    } else {
      html +=
        '<label>Pickup date<input id="oe-date" type="date" min="' +
        esc(this.state.earliest || (this.state.catalogue && this.state.catalogue.earliest_pickup_date) || '') +
        '" value="' +
        esc(d.date || '') +
        '"></label>';
    }
    html +=
      '<label class="lp-oe-field lp-oe-field-notes">Order notes<textarea id="oe-cnotes" class="lp-oe-notes-grow" rows="1" placeholder="Optional notes">' +
      esc(d.notes || '') +
      '</textarea></label>';
    html += '</div>';
    html +=
      '<button type="button" class="lp-oe-primary" data-act="confirm"' +
      (this.state.busy ? ' disabled' : '') +
      '>' +
      esc((this.state.display && this.state.display.cta) || 'Place order') +
      '</button>';
    return html;
  };

  OrderStorefront.prototype.bind = function () {
    var self = this;
    if (!this.isFastMode()) {
      this.root.querySelectorAll('[data-open]').forEach(function (el) {
        el.addEventListener('click', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          var id = el.getAttribute('data-open');
          self.state.selected = (self.state.catalogue.products || []).find(function (p) {
            return p.id === id;
          });
          self.state.view = 'product';
          self.render();
        });
      });
    }
    this.root.querySelectorAll('[data-act]').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        self.onAct(el.getAttribute('data-act'), el);
      });
    });
    this.root.querySelectorAll('textarea.lp-oe-notes-grow').forEach(function (ta) {
      function grow() {
        ta.style.height = 'auto';
        var next = Math.min(Math.max(ta.scrollHeight, 40), 160);
        ta.style.height = next + 'px';
      }
      ta.setAttribute('rows', '1');
      grow();
      ta.addEventListener('input', grow);
    });
    this.root.querySelectorAll('.lp-oe-stepper').forEach(function (wrap) {
      var input = wrap.querySelector('input');
      if (!input) return;
      var step = Number(wrap.getAttribute('data-step') || input.step || 1) || 1;
      var min = Number(wrap.getAttribute('data-min') || input.min || 0);
      wrap.querySelectorAll('[data-stepper-dir]').forEach(function (btn) {
        btn.addEventListener('click', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          var dir = Number(btn.getAttribute('data-stepper-dir')) || 0;
          var cur = Number(input.value);
          if (!Number.isFinite(cur)) cur = min;
          var next = Math.round((cur + dir * step) * 1000) / 1000;
          if (next < min) next = min;
          input.value = step < 1 ? next.toFixed(1) : String(next);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
      });
    });
    this.root.querySelectorAll('.lp-oe-option-chip input').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var chip = inp.closest('.lp-oe-option-chip');
        if (!chip) return;
        if (inp.type === 'radio') {
          var name = inp.name;
          self.root.querySelectorAll('input[name="' + name + '"]').forEach(function (r) {
            var c = r.closest('.lp-oe-option-chip');
            if (c) c.classList.toggle('on', r.checked);
          });
        } else {
          chip.classList.toggle('on', inp.checked);
        }
        self.captureFastDrafts();
      });
    });
    this.root.querySelectorAll('[data-fast-row] input, [data-fast-row] textarea, [data-fast-row] select').forEach(function (inp) {
      inp.addEventListener('input', function () {
        self.captureFastDrafts();
      });
      inp.addEventListener('change', function () {
        self.captureFastDrafts();
      });
    });
    // Preserve checkout fields while typing
    ['oe-name', 'oe-phone', 'oe-email', 'oe-date', 'oe-slot', 'oe-cnotes'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', function () {
        self.captureCheckoutDraft();
      });
      el.addEventListener('change', function () {
        self.captureCheckoutDraft();
      });
    });
  };

  OrderStorefront.prototype.setQty = async function (itemId, nextQty) {
    var item = (this.state.items || []).find(function (it) {
      return it.id === itemId;
    });
    if (!item) return;
    if (nextQty <= 0) {
      await this.removeLine(itemId);
      return;
    }
    var productId = item.product_id;
    var out = await api('/api/order/cart', {
      method: 'POST',
      body: {
        action: 'update_item',
        slug: this.slug,
        cart_id: this.state.cartId,
        cart_item_id: itemId,
        product_id: productId,
        quantity: nextQty,
        requested_weight_kg: item.requested_weight_kg,
        notes: item.notes,
        answers: item.answers || {}
      }
    });
    this.applyPacked(out);
  };

  OrderStorefront.prototype.removeLine = async function (itemId) {
    var out = await api('/api/order/cart', {
      method: 'POST',
      body: {
        action: 'remove_item',
        slug: this.slug,
        cart_id: this.state.cartId,
        cart_item_id: itemId
      }
    });
    this.applyPacked(out);
  };

  OrderStorefront.prototype.onAct = async function (act, el) {
    var self = this;
    var freeActs = {
      'back-shop': 1,
      'open-cart': 1,
      'toggle-cart': 1,
      'view-grid': 1,
      'view-list': 1,
      'toggle-notes': 1,
      cat: 1
    };
    if (self.state.busy && !freeActs[act]) return;
    try {
      self.state.msg = '';
      if (act === 'toggle-notes') {
        self.captureFastDrafts();
        var nid = el.getAttribute('data-id');
        self.state.notesOpen[nid] = !self.state.notesOpen[nid];
        self.render();
        return;
      }
      if (act === 'cat') {
        self.captureCheckoutDraft();
        self.captureFastDrafts();
        self.state.activeCategoryId = el.getAttribute('data-cat') || '';
        self.state.view = 'shop';
        self.state.selected = null;
        self.render();
        return;
      }
      if (act === 'open-cart' || act === 'toggle-cart') {
        self.captureCheckoutDraft();
        await self.refreshCart();
        self.state.mobileShowCart = !self.state.mobileShowCart;
        try {
          var aside = document.getElementById('oe-aside');
          if (aside) aside.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (_e) {}
        self.render();
        return;
      }
      if (act === 'view-list') {
        self.captureCheckoutDraft();
        self.state.listMode = true;
        try { localStorage.setItem('lp.order.listMode.' + self.slug, '1'); } catch (_e) {}
        self.render();
        return;
      }
      if (act === 'view-grid') {
        self.captureCheckoutDraft();
        self.state.listMode = false;
        try { localStorage.setItem('lp.order.listMode.' + self.slug, '0'); } catch (_e) {}
        self.render();
        return;
      }
      if (act === 'back-shop') {
        self.captureCheckoutDraft();
        self.state.view = 'shop';
        self.state.selected = null;
        self.render();
        return;
      }
      if (act === 'to-checkout') {
        self.captureCheckoutDraft();
        await self.refreshCart();
        try {
          var aside2 = document.getElementById('oe-aside');
          if (aside2) aside2.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (_e) {}
        self.render();
        return;
      }
      if (act === 'qty-inc' || act === 'qty-dec') {
        self.state.busy = true;
        self.render();
        try {
          var id = el.getAttribute('data-id');
          var item = (self.state.items || []).find(function (it) {
            return it.id === id;
          });
          var q = Number(item && item.quantity) || 1;
          await self.setQty(id, act === 'qty-inc' ? q + 1 : q - 1);
        } finally {
          self.state.busy = false;
        }
        self.render();
        return;
      }
      if (act === 'remove') {
        self.state.busy = true;
        // Optimistic remove for snappy UI
        var rid = el.getAttribute('data-id');
        self.state.items = (self.state.items || []).filter(function (it) {
          return it.id !== rid;
        });
        self.render();
        try {
          await self.removeLine(rid);
        } finally {
          self.state.busy = false;
        }
        self.render();
        return;
      }
      if (act === 'add-inline') {
        self.captureFastDrafts();
        var row = el.closest('[data-fast-row]');
        var productId = el.getAttribute('data-id');
        var product = (self.state.catalogue.products || []).find(function (p) {
          return p.id === productId;
        });
        var draft = self.state.fastDrafts[productId] || {};
        var qtyVal = Number((row && row.querySelector('[data-fast-qty]') || {}).value || draft.qty || 1);
        var kgEl = row && row.querySelector('[data-fast-kg]');
        var kgVal = kgEl && kgEl.value !== '' ? Number(kgEl.value) : (draft.kg !== '' && draft.kg != null ? Number(draft.kg) : null);
        if (product && self.needsWeight(product) && (kgVal == null || !isFinite(kgVal) || kgVal <= 0)) {
          self.state.msg = 'Enter an approximate weight in kg for ' + (product.name || 'this item') + '.';
          self.render();
          return;
        }
        var notesEl = row && row.querySelector('[data-fast-notes]');
        var notesVal = (notesEl && notesEl.value) || draft.notes || null;
        var answers = self.collectAnswers(row || self.root);
        self.state.busy = true;
        el.disabled = true;
        try {
          await self.ensureCart();
          var outInline = await api('/api/order/cart', {
            method: 'POST',
            body: {
              action: 'add_item',
              slug: self.slug,
              cart_id: self.state.cartId,
              product_id: productId,
              quantity: qtyVal,
              requested_weight_kg: kgVal,
              notes: notesVal || null,
              answers: answers
            }
          });
          self.applyPacked(outInline);
          self.state.msg = 'Added to cart';
          self.state.fastDrafts[productId] = { qty: '1', kg: '', notes: '', answers: {} };
          self.state.notesOpen[productId] = false;
        } finally {
          self.state.busy = false;
        }
        self.render();
        return;
      }
      if (act === 'add-product') {
        var answers = self.collectAnswers(self.root);
        var kgEl = $('#oe-kg', self.root);
        var qtyVal = Number(($('#oe-qty', self.root) || {}).value || 1);
        var kgVal = kgEl && kgEl.value ? Number(kgEl.value) : null;
        var notesVal = (($('#oe-notes', self.root) || {}).value) || null;
        var productId = el.getAttribute('data-id');
        var product = (self.state.catalogue.products || []).find(function (p) {
          return p.id === productId;
        });
        if (product && self.needsWeight(product) && (kgVal == null || !isFinite(kgVal) || kgVal <= 0)) {
          self.state.msg = 'Enter an approximate weight in kg.';
          self.render();
          return;
        }
        self.state.busy = true;
        el.disabled = true;
        try {
          await self.ensureCart();
          var out = await api('/api/order/cart', {
            method: 'POST',
            body: {
              action: 'add_item',
              slug: self.slug,
              cart_id: self.state.cartId,
              product_id: productId,
              quantity: qtyVal,
              requested_weight_kg: kgVal,
              notes: notesVal,
              answers: answers
            }
          });
          self.applyPacked(out);
          self.state.msg = 'Added to cart';
          self.state.view = 'shop';
        } finally {
          self.state.busy = false;
        }
        self.render();
        return;
      }
      if (act === 'confirm') {
        self.captureCheckoutDraft();
        var draft = self.state.checkoutDraft || {};
        var name = draft.name;
        var phone = draft.phone;
        var email = draft.email;
        var notes = draft.notes;
        var slots = self.state.pickupSlots || [];
        var pickup_date = draft.date;
        var pickup_slot_id = draft.slotId || null;
        var pickup_window_start = null;
        var pickup_window_end = null;
        if (slots.length) {
          var slot = slots.find(function (s) {
            return s.id === pickup_slot_id;
          });
          if (!slot) {
            self.state.msg = 'Please choose a pickup window.';
            self.render();
            return;
          }
          pickup_date = slot.date;
          pickup_window_start = slot.window_start;
          pickup_window_end = slot.window_end;
        }
        if (!name || !pickup_date) {
          self.state.msg = 'Name and pickup date are required.';
          self.render();
          return;
        }
        self.state.busy = true;
        self.render();
        try {
          var out = await api('/api/order/cart', {
            method: 'POST',
            body: {
              action: 'checkout',
              slug: self.slug,
              cart_id: self.state.cartId,
              customer_name: name,
              customer_phone: phone,
              customer_email: email,
              pickup_date: pickup_date,
              pickup_slot_id: pickup_slot_id,
              pickup_window_start: pickup_window_start,
              pickup_window_end: pickup_window_end,
              customer_notes: notes || null,
              fulfilment_type: 'pickup'
            }
          });
          localStorage.removeItem(cartKey(self.slug));
          self.state.cartId = '';
          self.state.checkoutDraft = { name: '', phone: '', email: '', date: '', slotId: '', notes: '' };
          // Always land on order confirmation (portal) — customer presses Pay when ready.
          if (out.portal_url) {
            window.location = out.portal_url;
            return;
          }
          self.root.innerHTML =
            '<div class="lp-oe-empty"><h3>Order confirmed</h3><p>' +
            esc(out.order && out.order.order_number) +
            '</p></div>';
        } catch (e) {
          var msg = (e && e.message) || 'Something went wrong';
          if (msg === 'pickup_too_soon') {
            msg =
              'That pickup date is too soon' +
              (e.data && e.data.earliest_pickup_date
                ? ' — earliest is ' + e.data.earliest_pickup_date
                : '') +
              '.';
            if (e.data && e.data.earliest_pickup_date) self.state.earliest = e.data.earliest_pickup_date;
          } else if (msg === 'pickup_slot_required') {
            msg = 'Please choose a pickup window from the list.';
            if (e.data && e.data.pickup_slots) self.state.pickupSlots = e.data.pickup_slots;
          } else if (msg === 'date_at_capacity') {
            msg = 'That pickup day is full — please choose another.';
          }
          self.state.msg = msg;
          self.state.busy = false;
          self.render();
          return;
        } finally {
          self.state.busy = false;
        }
      }
    } catch (e) {
      self.state.busy = false;
      self.state.msg = (e && e.message) || 'Something went wrong';
      if (self.state.view === 'checkout') self.captureCheckoutDraft();
      self.render();
    }
  };

  function ensureStyles() {
    if (document.getElementById('lp-oe-storefront-css')) return;
    var st = document.createElement('style');
    st.id = 'lp-oe-storefront-css';
    st.textContent = [
      '.lp-oe{--oe-accent:var(--lp-oe-accent,var(--accent,#1f7a63));--oe-card:var(--lp-oe-card,#fffcf7);--oe-line:var(--lp-oe-line,#e4e0d8);--oe-ink:var(--lp-oe-ink,#1c241e);--oe-muted:var(--lp-oe-muted,#667066);--oe-btn:var(--lp-oe-btn-bg,var(--oe-accent));--oe-btn-text:var(--lp-oe-btn-text,#fff);--oe-radius:var(--lp-oe-radius,14px);--oe-pad:var(--lp-oe-pad,16px);--oe-maxw:var(--lp-oe-maxw,1440px);color:var(--oe-ink);font:400 14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;max-width:var(--oe-maxw);margin:0 auto;padding:var(--oe-pad);box-sizing:border-box;background:var(--lp-oe-page-bg,transparent)}',
      '.lp-oe *,.lp-oe *::before,.lp-oe *::after{box-sizing:border-box}',
      '.lp-oe-ey{margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--oe-accent)}',
      '.lp-oe-brand{font-size:clamp(24px,3.6vw,34px);margin:0 0 6px;font-weight:650;letter-spacing:-.02em;line-height:1.15}',
      '.lp-oe-sub{margin:0;color:var(--oe-muted);font-size:13.5px;line-height:1.45;max-width:46ch}',
      '.lp-oe-head{display:flex;flex-wrap:wrap;gap:14px 18px;align-items:flex-start;justify-content:space-between;margin:0 0 18px}',
      '.lp-oe-head-compact{justify-content:flex-end;margin:0 0 12px}',
      '.lp-oe-embedded{padding-top:4px}',
      '.lp-oe-head-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}',
      '.lp-oe-portal{display:inline-flex;align-items:center;font:700 13px/1.2 system-ui,sans-serif;color:var(--oe-accent);text-decoration:underline;text-underline-offset:3px}',
      '.lp-oe-cart-btn,.lp-oe-primary,.lp-oe-card button,.lp-oe-link,.lp-oe-view-btn{appearance:none;border:1px solid var(--oe-btn);background:var(--oe-btn);color:var(--oe-btn-text);font:600 13px/1 system-ui,sans-serif;padding:10px 14px;border-radius:10px;cursor:pointer}',
      '.lp-oe-view-toggle{display:inline-flex;gap:6px;flex:none;position:relative;z-index:3}',
      '.lp-oe-view-btn{background:transparent;color:var(--oe-accent);border-color:var(--oe-line);padding:8px 12px;pointer-events:auto}',
      '.lp-oe-view-btn.on{background:color-mix(in srgb,var(--oe-accent) 12%,transparent);border-color:var(--oe-accent)}',
      '.lp-oe-link{background:transparent;color:var(--oe-accent);border-color:transparent;padding:0;margin:0 0 12px}',
      '.lp-oe-toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin:0 0 14px;position:relative;z-index:2}',
      '.lp-oe-filters{display:flex;flex-wrap:wrap;gap:8px;margin:0;flex:1;min-width:0}',
      '.lp-oe-filters button{appearance:none;background:transparent;border:1px solid var(--oe-line);color:var(--oe-muted);border-radius:999px;padding:8px 12px;font:600 12.5px/1 system-ui,sans-serif;cursor:pointer;pointer-events:auto}',
      '.lp-oe-filters button.on{border-color:var(--oe-accent);color:var(--oe-accent);background:color-mix(in srgb,var(--oe-accent) 10%,transparent)}',
      '.lp-oe-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,360px);gap:20px;align-items:start}',
      '@media(max-width:960px){.lp-oe-layout{grid-template-columns:1fr}.lp-oe-aside{position:static!important;max-height:none!important}.lp-oe-mobile-cart{display:inline-flex!important}}',
      '.lp-oe-main{min-width:0}',
      '.lp-oe-aside{position:sticky;top:16px;background:var(--oe-card);border:1px solid var(--oe-line);border-radius:var(--oe-radius);padding:16px;box-shadow:0 12px 28px rgba(28,36,30,.05);max-height:calc(100vh - 32px);overflow:auto}',
      '.lp-oe-aside h3{margin:0 0 10px;font-size:20px}',
      '.lp-oe-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px}',
      '.lp-oe-list{display:flex;flex-direction:column;gap:12px;padding:8px 4px 16px;margin:0}',
      '.lp-oe-list .lp-oe-card{display:grid;grid-template-columns:72px minmax(0,1fr) auto;gap:12px;align-items:center;padding:14px 16px}',
      '.lp-oe-list .lp-oe-card.no-img{grid-template-columns:minmax(0,1fr) auto}',
      '.lp-oe-card.no-img .lp-oe-body{padding-top:16px}',
      '.lp-oe-pack{margin:0 0 4px;font-size:12px;font-weight:700;color:var(--oe-accent);letter-spacing:.02em}',
      '.lp-oe-pack-note{margin:0;color:var(--oe-muted);font-size:13px;align-self:center}',
      '.lp-oe input[type=number]{-moz-appearance:textfield;appearance:textfield}',
      '.lp-oe input[type=number]::-webkit-outer-spin-button,.lp-oe input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}',
      '.lp-oe-stepper{display:inline-flex;align-items:stretch;border:1px solid var(--oe-line);border-radius:12px;overflow:hidden;background:var(--lp-oe-input-bg,#fff);min-height:44px}',
      '.lp-oe-stepper-btn{appearance:none;border:0;background:color-mix(in srgb,var(--oe-accent) 8%,#fff);color:var(--oe-ink);width:44px;min-width:44px;font:700 22px/1 system-ui,sans-serif;cursor:pointer;padding:0}',
      '.lp-oe-stepper-btn:hover{background:color-mix(in srgb,var(--oe-accent) 16%,#fff)}',
      '.lp-oe-stepper-btn:active{background:color-mix(in srgb,var(--oe-accent) 22%,#fff)}',
      '.lp-oe-stepper input{width:64px;border:0;border-left:1px solid var(--oe-line);border-right:1px solid var(--oe-line);border-radius:0;text-align:center;font:700 15px/1.2 system-ui,sans-serif;min-height:44px;padding:0 6px;background:transparent;color:var(--oe-ink)}',
      '.lp-oe-option-group{display:grid;gap:8px;margin:0 0 4px}',
      '.lp-oe-option-title{margin:0;font-size:12px;font-weight:700;color:var(--oe-muted);letter-spacing:.03em;text-transform:uppercase}',
      '.lp-oe-option-list{display:flex;flex-wrap:wrap;gap:8px}',
      '.lp-oe-option-chip{display:inline-flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid var(--oe-line);border-radius:12px;cursor:pointer;font:600 13px/1.2 system-ui,sans-serif;color:var(--oe-ink);background:#fff;user-select:none}',
      '.lp-oe-option-chip input{accent-color:var(--oe-accent);width:16px;height:16px;margin:0}',
      '.lp-oe-option-chip.on{border-color:var(--oe-accent);background:color-mix(in srgb,var(--oe-accent) 10%,#fff);color:var(--oe-accent)}',
      '.lp-oe-list .lp-oe-img{aspect-ratio:1;width:72px;border-radius:10px;margin:0;flex:none}',
      '.lp-oe-list .lp-oe-body{padding:0;min-width:0}',
      '.lp-oe-list .lp-oe-body h3{font-size:15px;margin:0 0 2px}',
      '.lp-oe-list .lp-oe-body p{margin:0}',
      '.lp-oe-list .lp-oe-price{margin-top:4px}',
      '.lp-oe-list .lp-oe-card button{width:auto;margin:0;padding:9px 14px;justify-self:end}',
      '.lp-oe-card{background:var(--oe-card);border:1px solid var(--oe-line);border-radius:var(--oe-radius);overflow:hidden;box-shadow:0 8px 22px rgba(28,36,30,.04);cursor:pointer}',
      '.lp-oe-img{aspect-ratio:4/3;background:#e8e2d6 center/cover no-repeat}',
      '.lp-oe-img.text{display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,#e8efe9,#f3ebe1)}',
      '.lp-oe-img.text span{font-size:36px;color:var(--oe-accent);opacity:.7}',
      '.lp-oe-body{padding:14px}',
      '.lp-oe-body h3{margin:0 0 6px;font-size:16px;line-height:1.25}',
      '.lp-oe-body p,.lp-oe-desc{margin:0;color:var(--oe-muted);font-size:13px;line-height:1.4}',
      '.lp-oe-price{margin-top:8px;font-weight:700;color:var(--oe-accent)}',
      '.lp-oe-card button{width:100%;margin-top:10px}',
      '.lp-oe-note{color:var(--oe-muted);font-size:13px;line-height:1.45;margin:14px 0 0}',
      '.lp-oe-empty{padding:28px 12px;text-align:center;color:var(--oe-muted)}',
      '.lp-oe-msg{background:#fff1d6;border:1px solid #efd7a2;color:#7a5600;padding:10px 12px;border-radius:10px;margin:0 0 12px;font-size:13.5px}',
      '.lp-oe-detail{background:var(--oe-card);border:1px solid var(--oe-line);border-radius:var(--oe-radius);padding:16px;margin:0 0 14px}',
      '.lp-oe-fields{display:grid;gap:10px;margin:14px 0}',
      '.lp-oe-fields-app{gap:12px}',
      '.lp-oe-field-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;align-items:start}',
      '.lp-oe-field{display:grid;gap:5px;font-size:11.5px;font-weight:700;color:var(--oe-muted);letter-spacing:.02em;align-content:start}',
      '.lp-oe-field input,.lp-oe-field textarea,.lp-oe-field select,.lp-oe-fields input,.lp-oe-fields textarea,.lp-oe-fields select{width:100%;font:500 14px/1.35 system-ui,sans-serif;padding:10px 12px;border-radius:10px;border:1px solid var(--lp-oe-input-border,var(--oe-line));background:var(--lp-oe-input-bg,#fff);color:var(--oe-ink);min-height:42px}',
      '.lp-oe-field-notes{grid-column:1/-1}',
      '.lp-oe-notes-grow{min-height:42px;max-height:160px;resize:none;overflow-y:auto;line-height:1.4;field-sizing:content}',
      '.lp-oe-line{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding:14px 0;border-bottom:1px solid var(--oe-line)}',
      '.lp-oe-line-main{flex:1;min-width:0}',
      '.lp-oe-line-meta{margin:4px 0 0;color:var(--oe-muted);font-size:13px}',
      '.lp-oe-line-actions{display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex:none}',
      '.lp-oe-qty{display:inline-flex;align-items:center;border:1px solid var(--oe-line);border-radius:12px;overflow:hidden;background:#fff;min-height:44px}',
      '.lp-oe-qty-btn{appearance:none;border:0;background:color-mix(in srgb,var(--oe-accent) 8%,#fff);width:44px;height:44px;font:700 22px/1 system-ui,sans-serif;cursor:pointer;color:var(--oe-ink)}',
      '.lp-oe-qty-btn:hover{background:color-mix(in srgb,var(--oe-accent) 16%,#fff)}',
      '.lp-oe-qty-val{min-width:36px;text-align:center;font:700 16px/1 system-ui,sans-serif;padding:0 6px}',
      '.lp-oe-remove{appearance:none;border:1px solid #c45c26;background:transparent;color:#c45c26;font:600 12px/1 system-ui,sans-serif;padding:8px 12px;border-radius:999px;cursor:pointer}',
      '.lp-oe-summary{margin:14px 0;padding:14px;background:color-mix(in srgb,var(--oe-accent) 6%,#f7f3ec);border:1px solid var(--oe-line);border-radius:12px}',
      '.lp-oe-summary .row{display:flex;justify-content:space-between;gap:10px;margin:0 0 8px;font-size:14px}',
      '.lp-oe-summary .row.emph{font-weight:700;padding-top:8px;border-top:1px dashed var(--oe-line)}',
      '.lp-oe-login{margin:0 0 14px;padding:12px;border:1px dashed var(--oe-line);border-radius:12px;background:color-mix(in srgb,var(--oe-card) 80%,#faf7f1)}',
      '.lp-oe-login h4{margin:0 0 6px;font-size:14px}',
      '.lp-oe-login p{margin:0 0 8px;font-size:12.5px;color:var(--oe-muted);line-height:1.4}',
      '.lp-oe-mobile-cart{display:none}',
      '.lp-oe-primary:disabled,.lp-oe-cart-btn:disabled,.lp-oe-qty-btn:disabled,.lp-oe-remove:disabled{opacity:.55;cursor:not-allowed}',
      '.lp-oe-related ul{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 0}',
      '.lp-oe-related button{background:transparent;color:var(--oe-accent);border-color:var(--oe-line)}',
      '.lp-oe-fast{display:flex;flex-direction:column;gap:12px;padding:4px 0 12px}',
      '.lp-oe-fast-row{background:var(--oe-card);border:1px solid var(--oe-line);border-radius:var(--oe-radius);padding:12px 14px;box-shadow:0 8px 20px rgba(28,36,30,.04);transition:border-color .15s ease,box-shadow .15s ease}',
      '.lp-oe-fast-row.is-notes-open{border-color:color-mix(in srgb,var(--oe-accent) 35%,var(--oe-line));box-shadow:0 10px 24px rgba(28,36,30,.07)}',
      '.lp-oe-fast-main{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:12px 14px;align-items:center}',
      '.lp-oe-fast-main.no-img{grid-template-columns:minmax(0,1fr) auto}',
      '@media(max-width:720px){.lp-oe-fast-main{grid-template-columns:56px minmax(0,1fr);}.lp-oe-fast-main.no-img{grid-template-columns:1fr}.lp-oe-fast-controls{grid-column:1/-1;justify-content:flex-start}}',
      '.lp-oe-fast-img{width:64px;height:64px;border-radius:12px;background:#e8e2d6 center/cover no-repeat;flex:none}',
      '.lp-oe-fast-info{min-width:0}',
      '.lp-oe-fast-info h3{margin:0 0 2px;font-size:15.5px;line-height:1.25;letter-spacing:-.01em}',
      '.lp-oe-fast-desc{margin:0;color:var(--oe-muted);font-size:12.5px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.lp-oe-fast-info .lp-oe-price{margin-top:4px;font-size:13.5px}',
      '.lp-oe-fast-packchip{display:inline-flex;align-items:center;min-height:44px;padding:0 12px;border-radius:12px;border:1px dashed var(--oe-line);color:var(--oe-accent);font:700 12px/1 system-ui,sans-serif;letter-spacing:.02em}',
      '.lp-oe-fast-field .lp-oe-stepper{width:100%}',
      '.lp-oe-fast-field .lp-oe-stepper input{width:52px}',
      '.lp-oe-fast-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;justify-content:flex-end}',
      '.lp-oe-fast-field{display:grid;gap:3px;font-size:10.5px;font-weight:700;color:var(--oe-muted);letter-spacing:.03em;text-transform:uppercase}',
      '.lp-oe-fast-notes-btn,.lp-oe-fast-add{appearance:none;min-height:44px;padding:0 16px;border-radius:12px;font:600 13px/1 system-ui,sans-serif;cursor:pointer}',
      '.lp-oe-fast-notes-btn{border:1px solid var(--oe-line);background:transparent;color:var(--oe-muted)}',
      '.lp-oe-fast-notes-btn.on{border-color:var(--oe-accent);color:var(--oe-accent);background:color-mix(in srgb,var(--oe-accent) 10%,transparent)}',
      '.lp-oe-fast-add{border:1px solid var(--oe-btn);background:var(--oe-btn);color:var(--oe-btn-text)}',
      '.lp-oe-fast-add:disabled{opacity:.55;cursor:not-allowed}',
      '.lp-oe-fast-extra{margin-top:12px;padding-top:12px;border-top:1px dashed var(--oe-line);display:grid;gap:10px;animation:lpOeNotesIn .18s ease}',
      '@keyframes lpOeNotesIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}'
    ].join('');
    document.head.appendChild(st);
  }

  function boot(root) {
    if (!root) return;
    ensureStyles();
    root.__lpOeBooted = true;
    var app = new OrderStorefront(root);
    app.init();
  }

  function scan() {
    document.querySelectorAll('#lp-order-storefront, [data-lp-order-storefront]').forEach(function (el) {
      if (!el.getAttribute('data-slug')) return;
      boot(el);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  else scan();

  window.LPOrderStorefront = { boot: boot, scan: scan };
})();
