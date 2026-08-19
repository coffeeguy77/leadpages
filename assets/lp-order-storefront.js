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

  async function api(path, opts) {
    opts = opts || {};
    var r = await fetch(path, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'content-type': 'application/json' }: undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    var j = null;
    try {
      j = await r.json();
    } catch (e) {
      j = {};
    }
    if (!r.ok) throw Object.assign(new Error((j && j.error) || 'request_failed'), { status: r.status, data: j });
    return j;
  }

  function cartKey(slug) {
    return 'lp.order.cart.' + slug;
  }

  function OrderStorefront(root) {
    this.root = root;
    this.slug = root.getAttribute('data-slug') || '';
    this.mode = root.getAttribute('data-mode') || 'embedded';
    this.state = {
      catalogue: null,
      cartId: localStorage.getItem(cartKey(this.slug)) || '',
      cart: null,
      items: [],
      view: 'shop',
      selected: null,
      busy: false,
      msg: ''
    };
  }

  OrderStorefront.prototype.init = async function () {
    try {
      this.state.catalogue = await api('/api/order/storefront?slug=' + encodeURIComponent(this.slug));
      if (this.state.cartId) {
        try {
          var packed = await api(
            '/api/order/cart?slug=' +
              encodeURIComponent(this.slug) +
              '&cart_id=' +
              encodeURIComponent(this.state.cartId)
          );
          this.state.cart = packed.cart;
          this.state.items = packed.items || [];
          this.state.deposit = packed.deposit;
          this.state.display = packed.display;
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
    this.state.cart = packed.cart;
    this.state.items = packed.items || [];
    this.state.deposit = packed.deposit;
    this.state.display = packed.display;
    this.state.earliest = packed.earliest_pickup_date;
  };

  OrderStorefront.prototype.render = function () {
    var c = this.state.catalogue;
    var biz = (c && c.site && c.site.business_name) || 'Order';
    var mode = (c && c.system && c.system.storefront_display_mode) || 'compact_cards';
    var html = '';
    html += '<div class="lp-oe">';
    html += '<header class="lp-oe-head"><div><p class="lp-oe-ey">Order online</p><h2 class="lp-oe-brand">' +
      esc(biz) +
      '</h2><p class="lp-oe-sub">Choose products, pick a collection date, pay deposit if required.</p></div>';
    html +=
      '<button type="button" class="lp-oe-cart-btn" data-act="open-cart">Cart (' +
      (this.state.items.length || 0) +
      ')</button></header>';

    if (this.state.msg) html += '<p class="lp-oe-msg">' + esc(this.state.msg) + '</p>';

    if (this.state.view === 'cart' || this.state.view === 'checkout') {
      html += this.renderCart();
    } else if (this.state.view === 'product' && this.state.selected) {
      html += this.renderProduct(this.state.selected);
    } else {
      html += this.renderGrid(mode);
    }
    html += '</div>';
    this.root.innerHTML = html;
    this.bind();
  };

  OrderStorefront.prototype.renderGrid = function (mode) {
    var products = (this.state.catalogue && this.state.catalogue.products) || [];
    var cats = (this.state.catalogue && this.state.catalogue.categories) || [];
    var html = '<div class="lp-oe-filters">';
    html += '<button type="button" class="on" data-cat="">All</button>';
    cats.forEach(function (cat) {
      html += '<button type="button" data-cat="' + esc(cat.id) + '">' + esc(cat.name) + '</button>';
    });
    html += '</div>';
    var cls =
      mode === 'product_list'
        ? 'lp-oe-list'
        : mode === 'quick_order_table'
          ? 'lp-oe-table'
          : 'lp-oe-grid';
    html += '<div class="' + cls + '">';
    products.forEach(function (p) {
      var hasImg = !!p.image_url;
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
      } else {
        html += '<div class="lp-oe-img text"><span>' + esc((p.name || '?').slice(0, 1)) + '</span></div>';
      }
      html += '<div class="lp-oe-body"><h3>' + esc(p.name) + '</h3>';
      if (p.short_description) html += '<p>' + esc(p.short_description) + '</p>';
      html += '<div class="lp-oe-price">' + esc(p.display_price) + '</div>';
      html += '<button type="button" data-open="' + esc(p.id) + '">Add</button></div></article>';
    });
    if (!products.length) html += '<p class="lp-oe-empty">No products available yet.</p>';
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
    var html = '<div class="lp-oe-detail">';
    html += '<button type="button" class="lp-oe-link" data-act="back-shop">← Back</button>';
    html += '<h3>' + esc(p.name) + '</h3>';
    html += '<p class="lp-oe-price">' + esc(p.display_price) + '</p>';
    if (p.description || p.short_description)
      html += '<p>' + esc(p.description || p.short_description) + '</p>';
    html += '<div class="lp-oe-fields">';
    html +=
      '<label>Quantity<input type="number" min="1" step="1" value="1" id="oe-qty"></label>';
    if (p.weight_required || p.pricing_method === 'per_weight' || p.pricing_method === 'price_tbc') {
      html +=
        '<label>Approx. weight (kg)<input type="number" min="0.01" step="0.01" id="oe-kg" placeholder="e.g. 1.2"></label>';
    }
    (p.questions || []).forEach(function (q) {
      html += '<label>' + esc(q.label);
      if (q.field_type === 'long_text') html += '<textarea data-q="' + esc(q.key) + '"></textarea>';
      else if (q.field_type === 'dropdown' || q.field_type === 'radio') {
        html += '<select data-q="' + esc(q.key) + '"><option value="">Select…</option>';
        (q.options || []).forEach(function (o) {
          var v = typeof o === 'string' ? o : o.value || o.label;
          html += '<option value="' + esc(v) + '">' + esc(v) + '</option>';
        });
        html += '</select>';
      } else html += '<input data-q="' + esc(q.key) + '">';
      html += '</label>';
    });
    html += '<label>Notes<textarea id="oe-notes"></textarea></label>';
    html += '</div>';
    html +=
      '<button type="button" class="lp-oe-primary" data-act="add-product" data-id="' +
      esc(p.id) +
      '">Add to cart</button>';
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

  OrderStorefront.prototype.renderCart = function () {
    var html = '<div class="lp-oe-cart">';
    html += '<button type="button" class="lp-oe-link" data-act="back-shop">← Keep shopping</button>';
    html += '<h3>Your cart</h3>';
    if (!this.state.items.length) {
      html += '<p class="lp-oe-empty">Cart is empty.</p></div>';
      return html;
    }
    this.state.items.forEach(function (it) {
      var snap = it.product_snapshot || {};
      html += '<div class="lp-oe-line">';
      html += '<div><strong>' + esc(snap.name || 'Item') + '</strong>';
      html +=
        '<p>Qty ' +
        esc(it.quantity) +
        (it.requested_weight_kg != null ? ' · ~' + esc(it.requested_weight_kg) + 'kg' : '') +
        '</p>';
      html +=
        '<p class="lp-oe-price">' +
        (it.price_status === 'tbc' || it.price_status === 'quote_required'
          ? 'Price TBC'
          : money(it.line_known_cents)) +
        '</p></div>';
      html +=
        '<button type="button" data-act="remove" data-id="' + esc(it.id) + '">Remove</button></div>';
    });
    html += '<div class="lp-oe-summary">';
    html +=
      '<div class="row"><span>Known items</span><strong>' +
      esc((this.state.display && this.state.display.known_subtotal) || money(this.state.cart.known_subtotal_cents)) +
      '</strong></div>';
    if (this.state.cart.has_unknown_prices)
      html += '<div class="row"><span>Other items</span><strong>Price TBC</strong></div>';
    html +=
      '<div class="row emph"><span>Deposit due today</span><strong>' +
      esc((this.state.display && this.state.display.deposit) || '—') +
      '</strong></div>';
    html +=
      '<p class="lp-oe-note">Final balance TBC after preparation where products are weighed or quoted.</p>';
    html += '</div>';

    if (this.state.view === 'checkout') {
      html += '<div class="lp-oe-fields">';
      html += '<label>Your name<input id="oe-name" required></label>';
      html += '<label>Mobile<input id="oe-phone" type="tel"></label>';
      html += '<label>Email<input id="oe-email" type="email"></label>';
      html +=
        '<label>Pickup date<input id="oe-date" type="date" min="' +
        esc(this.state.earliest || (this.state.catalogue && this.state.catalogue.earliest_pickup_date) || '') +
        '"></label>';
      html += '<label>Pickup time<input id="oe-time" type="time"></label>';
      html += '<label>Order notes<textarea id="oe-cnotes"></textarea></label>';
      html += '</div>';
      html +=
        '<button type="button" class="lp-oe-primary" data-act="confirm">' +
        esc((this.state.display && this.state.display.cta) || 'CONFIRM ORDER') +
        '</button>';
    } else {
      html += '<button type="button" class="lp-oe-primary" data-act="to-checkout">Checkout</button>';
    }
    html += '</div>';
    return html;
  };

  OrderStorefront.prototype.bind = function () {
    var self = this;
    this.root.querySelectorAll('[data-open]').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = el.getAttribute('data-open');
        self.state.selected = (self.state.catalogue.products || []).find(function (p) {
          return p.id === id;
        });
        self.state.view = 'product';
        self.render();
      });
    });
    this.root.querySelectorAll('[data-cat]').forEach(function (btn) {
      if (!btn.classList.contains('lp-oe-card')) {
        btn.addEventListener('click', function () {
          var cat = btn.getAttribute('data-cat');
          self.root.querySelectorAll('.lp-oe-filters button').forEach(function (b) {
            b.classList.toggle('on', b === btn);
          });
          self.root.querySelectorAll('.lp-oe-card').forEach(function (card) {
            card.style.display = !cat || card.getAttribute('data-cat') === cat ? '' : 'none';
          });
        });
      }
    });
    this.root.querySelectorAll('[data-act]').forEach(function (el) {
      el.addEventListener('click', function () {
        self.onAct(el.getAttribute('data-act'), el);
      });
    });
  };

  OrderStorefront.prototype.onAct = async function (act, el) {
    var self = this;
    try {
      self.state.msg = '';
      if (act === 'open-cart') {
        await self.refreshCart();
        self.state.view = 'cart';
        self.render();
        return;
      }
      if (act === 'back-shop') {
        self.state.view = 'shop';
        self.render();
        return;
      }
      if (act === 'to-checkout') {
        await self.refreshCart();
        self.state.view = 'checkout';
        self.render();
        return;
      }
      if (act === 'add-product') {
        await self.ensureCart();
        var answers = {};
        self.root.querySelectorAll('[data-q]').forEach(function (inp) {
          answers[inp.getAttribute('data-q')] = { value: inp.value, label: inp.getAttribute('data-q') };
        });
        var kgEl = $('#oe-kg', self.root);
        await api('/api/order/cart', {
          method: 'POST',
          body: {
            action: 'add_item',
            slug: self.slug,
            cart_id: self.state.cartId,
            product_id: el.getAttribute('data-id'),
            quantity: Number(($('#oe-qty', self.root) || {}).value || 1),
            requested_weight_kg: kgEl && kgEl.value ? Number(kgEl.value) : null,
            notes: (($('#oe-notes', self.root) || {}).value) || null,
            answers: answers
          }
        });
        await self.refreshCart();
        self.state.msg = 'Added to cart';
        self.state.view = 'cart';
        self.render();
        return;
      }
      if (act === 'remove') {
        await api('/api/order/cart', {
          method: 'POST',
          body: {
            action: 'remove_item',
            slug: self.slug,
            cart_id: self.state.cartId,
            cart_item_id: el.getAttribute('data-id')
          }
        });
        await self.refreshCart();
        self.render();
        return;
      }
      if (act === 'confirm') {
        var name = ($('#oe-name', self.root) || {}).value;
        var phone = ($('#oe-phone', self.root) || {}).value;
        var email = ($('#oe-email', self.root) || {}).value;
        var date = ($('#oe-date', self.root) || {}).value;
        var time = ($('#oe-time', self.root) || {}).value;
        var notes = ($('#oe-cnotes', self.root) || {}).value;
        if (!name || !date) {
          self.state.msg = 'Name and pickup date are required.';
          self.render();
          return;
        }
        var out = await api('/api/order/cart', {
          method: 'POST',
          body: {
            action: 'checkout',
            slug: self.slug,
            cart_id: self.state.cartId,
            customer_name: name,
            customer_phone: phone,
            customer_email: email,
            pickup_date: date,
            pickup_time: time || null,
            customer_notes: notes || null,
            fulfilment_type: 'pickup'
          }
        });
        localStorage.removeItem(cartKey(self.slug));
        self.state.cartId = '';
        if (out.checkout_url) {
          window.location = out.checkout_url;
          return;
        }
        if (out.portal_url) {
          window.location = out.portal_url;
          return;
        }
        self.root.innerHTML =
          '<div class="lp-oe-empty"><h3>Order confirmed</h3><p>' +
          esc(out.order && out.order.order_number) +
          '</p></div>';
      }
    } catch (e) {
      self.state.msg = (e && e.message) || 'Something went wrong';
      self.render();
    }
  };

  function boot(root) {
    var app = new OrderStorefront(root);
    app.init();
  }

  function scan() {
    document.querySelectorAll('#lp-order-storefront, [data-lp-order-storefront]').forEach(boot);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  else scan();

  window.LPOrderStorefront = { boot: boot, scan: scan };
})();
