/**
 * LeadPages Online Quote — public visitor wizard (embeddable).
 *
 * Usage on a tenant page:
 *   <div id="lp-online-quote" data-slug="beanculture"></div>
 *   <script src="/assets/lp-online-quote.js" defer></script>
 *
 * API-only — never receives private pricing config; totals unlock via verification.
 */
(function() {
  'use strict';

  var ROOT_ID = 'lp-online-quote';
  var API = '/api/quote-system';

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function post(path, body) {
    return fetch(API + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function(r) { return r.json(); });
  }

  function get(path) {
    return fetch(API + path).then(function(r) { return r.json(); });
  }

  function normaliseAuPhone(phone) {
    var digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.indexOf('61') === 0) return '+' + digits;
    if (digits.charAt(0) === '0') return '+61' + digits.slice(1);
    return '+61' + digits;
  }

  function contactPhone() {
    return normaliseAuPhone(this.state.contact.phone);
  }

  function iconHtml(name) {
    if (!name || !window.LP_ICONS || !window.LP_ICONS[name]) return '';
    return '<span class="lp-oq-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + window.LP_ICONS[name] + '</svg></span>';
  }

  function choiceHtml(item) {
    var D = window.LPQuoteDisplay || {};
    if (D.choiceVisualHtml) {
      return D.choiceVisualHtml(item, { esc: esc, iconHtml: iconHtml });
    }
    if (item && item.displayMode === 'image' && item.imageUrl) {
      var px = (D.displayPx) ? D.displayPx(item.imageSize, item.imageScale) : 80;
      return '<img class="lp-oq-choice-img" src="' + esc(item.imageUrl) + '" alt="" style="height:' + px + 'px;width:auto;max-width:100%;object-fit:contain;display:block;margin:0 0 8px;border-radius:8px">' +
        '<strong>' + esc(item.label) + '</strong>' +
        (item.description ? '<span>' + esc(item.description) + '</span>' : '');
    }
    return iconHtml(item.icon) +
      '<strong>' + esc(item.label) + '</strong>' +
      (item.description ? '<span>' + esc(item.description) + '</span>' : '');
  }

  function layoutClass(shell) {
    var D = window.LPQuoteDisplay;
    if (D && D.layoutClass) return D.layoutClass(shell);
    var layout = (shell && shell.wizard && shell.wizard.layout) || 'cards';
    return ' lp-oq-layout-' + layout;
  }

  function stepLayout(shell) {
    var D = window.LPQuoteDisplay;
    if (D && D.wizardLayout) return D.wizardLayout(shell);
    return (shell && shell.wizard && shell.wizard.layout) || 'cards';
  }

  function wrapStep(parts) {
    var D = window.LPQuoteDisplay;
    if (D && D.wrapStepBody) return D.wrapStepBody(parts, stepLayout(this.shell));
    return (parts.intro || '') + (parts.fields || '') + (parts.choices || '') + (parts.extra || '');
  }

  function wl() {
    return window.LPQuoteWizardLogic || {};
  }

  function OnlineQuoteWidget(el) {
    this.el = el;
    this.slug = (el.getAttribute('data-slug') || '').trim().toLowerCase();
    this.token = null;
    this.shell = null;
    this.state = {
      step: 0,
      productId: '',
      hours: 3,
      eventDate: '',
      guestCount: 50,
      unitCount: null,
      labourPlanning: 'hours',
      eventConfigMode: 'same',
      shifts: [],
      carts: [],
      beverageId: '',
      beverageLines: [],
      addonIds: [],
      travelZoneId: '',
      customAnswers: {},
      contact: { name: '', email: '', phone: '' },
      quote: null,
      session: null,
      portalUrl: null,
      pdfUrl: null,
      emailCodeSent: false,
      emailWhitelisted: false,
      emailSummarySent: false
    };
  }

  OnlineQuoteWidget.prototype.init = function() {
    var self = this;
    if (!this.slug) {
      this.el.innerHTML = '<p class="lp-oq-error">Quote wizard: missing data-slug.</p>';
      return;
    }
    this.el.innerHTML = '<div class="lp-oq-loading">Loading quote wizard…</div>';
    get('/public-config?slug=' + encodeURIComponent(this.slug)).then(function(res) {
      if (!res.ok || !res.enabled) {
        self.el.innerHTML = '<p class="lp-oq-muted">Online quotes are not available for this site yet.</p>';
        return;
      }
      self.shell = res.shell || {};
      self.render();
    }).catch(function() {
      self.el.innerHTML = '<p class="lp-oq-error">Could not load quote wizard.</p>';
    });
  };

  OnlineQuoteWidget.prototype.planning = function() {
    return window.LPQuotePlanning || null;
  };

  OnlineQuoteWidget.prototype.progress = function() {
    var P = this.planning();
    if (P && P.progressPayload) return P.progressPayload(this.state);
    return {
      productId: this.state.productId,
      hours: this.state.hours,
      guestCount: this.state.guestCount,
      unitCount: this.state.unitCount,
      beverageId: this.state.beverageId,
      beverageLines: this.state.beverageLines,
      addonIds: this.state.addonIds,
      travelZoneId: this.state.travelZoneId
    };
  };

  OnlineQuoteWidget.prototype.resolvedSteps = function() {
    var shell = this.shell || {};
    var wizard = shell.wizard || {};
    var tz = (shell.travelZones || []).length;
    var W = wl();
    if (W.resolveWizardSteps) {
      return W.resolveWizardSteps(
        Object.assign({}, wizard, { travelZones: shell.travelZones || [] }),
        this.progress(),
        tz
      );
    }
    return wizard.steps || ['equipment', 'beverages', 'addons', 'contact'];
  };

  OnlineQuoteWidget.prototype.filterItems = function(items) {
    var W = wl();
    if (W.filterByShowWhen) return W.filterByShowWhen(items, this.progress());
    return items || [];
  };

  OnlineQuoteWidget.prototype.reconcileState = function() {
    var shell = this.shell || {};
    var P = this.planning();
    if (P && P.ensureCarts) P.ensureCarts(this.state, shell.products || []);
    var bevs = this.filterItems(shell.beverages);
    var bevIds = bevs.map(function(b) { return b.id; });
    if (!Array.isArray(this.state.beverageLines)) this.state.beverageLines = [];
    this.state.beverageLines = this.state.beverageLines.filter(function(l) {
      return l && l.beverageId && bevIds.indexOf(l.beverageId) >= 0 && (Number(l.quantity) || 0) > 0;
    });
    if (this.state.beverageLines.length) {
      this.state.beverageId = this.state.beverageLines[0].beverageId;
      this.state.guestCount = this.state.beverageLines[0].quantity;
      this.state.unitCount = this.state.beverageLines[0].quantity;
    } else if (this.state.beverageId && bevIds.indexOf(this.state.beverageId) < 0) {
      this.state.beverageId = '';
    }
    var addons = this.filterItems(shell.addons);
    var ids = addons.map(function(a) { return a.id; });
    this.state.addonIds = this.state.addonIds.filter(function(id) { return ids.indexOf(id) >= 0; });
    var steps = this.resolvedSteps();
    if (this.state.step >= steps.length) this.state.step = Math.max(0, steps.length - 1);
  };

  OnlineQuoteWidget.prototype.steps = function() {
    return this.resolvedSteps();
  };

  OnlineQuoteWidget.prototype.stepLabel = function(key) {
    var labels = (this.shell.wizard && this.shell.wizard.stepLabels) || {};
    if (labels[key]) return labels[key];
    var W = wl();
    if (W.catalogLabel) return W.catalogLabel(key);
    return key;
  };

  OnlineQuoteWidget.prototype.render = function() {
    injectStyles();
    var steps = this.steps();
    var stepKey = steps[this.state.step] || 'contact';
    var biz = (this.shell.business && this.shell.business.name) || 'Get your quote';
    var uiStyle = (window.LPQuoteDisplay && window.LPQuoteDisplay.wizardUiVars)
      ? window.LPQuoteDisplay.wizardUiVars(this.shell) : '';
    var html = '<div class="lp-oq-card' + layoutClass(this.shell) + '"' + (uiStyle ? (' style="' + uiStyle + '"') : '') + '>' +
      '<div class="lp-oq-head"><h2 class="lp-oq-title">' + esc(biz) + '</h2>' +
      '<div class="lp-oq-steps">' + steps.map(function(s, i) {
        return '<span class="lp-oq-step' + (i === this.state.step ? ' is-active' : (i < this.state.step ? ' is-done' : '')) + '">' + esc(this.stepLabel(s)) + '</span>';
      }, this).join('') + '</div></div>' +
      '<div class="lp-oq-body">' + this.renderStep(stepKey) + '</div>' +
      '<div class="lp-oq-foot">' + this.renderFooter(stepKey, steps) + '</div>' +
      (this.state.quote ? this.renderQuotePanel() : '') +
      '</div>';
    this.el.innerHTML = html;
    this.wire(stepKey);
  };

  OnlineQuoteWidget.prototype.customFieldsFor = function(attachTo) {
    var P = this.planning();
    var wizard = (this.shell && this.shell.wizard) || {};
    if (P && P.customFieldsFor) return P.customFieldsFor(wizard, attachTo);
    var W = wl();
    if (W.customFieldsFor) return W.customFieldsFor(wizard, attachTo);
    return [];
  };

  OnlineQuoteWidget.prototype.renderCustomFields = function(attachTo) {
    var P = this.planning();
    var fields = this.customFieldsFor(attachTo);
    if (!fields.length) return '';
    if (P && P.renderCustomFieldsHtml) {
      return P.renderCustomFieldsHtml(fields, this.state.customAnswers || {}, { esc: esc, attr: 'data-custom-field' });
    }
    return '';
  };

  OnlineQuoteWidget.prototype.renderStep = function(key) {
    var s = this.state;
    var P = this.planning();
    var wrap = wrapStep.bind(this);

    if (key === 'event') {
      var products = this.filterItems(this.shell.products || []);
      var fields = (P && P.renderLabourPlanning)
        ? P.renderLabourPlanning(s, this.shell, products)
        : '<label class="lp-oq-field"><span>Barista 1 — event duration (hours)</span>' +
          '<input type="number" min="1" max="48" data-field="hours" value="' + esc(s.hours) + '"></label>';
      var staffing = (P && P.renderStaffing)
        ? P.renderStaffing(s, this.shell, products)
        : '';
      return wrap({
        intro: '<p class="lp-oq-intro">When is your event, and how many baristas do you need?</p>',
        fields: fields + staffing + this.renderCustomFields('event')
      });
    }

    if (key === 'custom' || key === 'questions') {
      var customHtml = this.renderCustomFields('custom');
      if (!customHtml) return '<p class="lp-oq-muted">No questions configured.</p>';
      return wrap({
        intro: '<p class="lp-oq-intro">A few more details about your event.</p>',
        fields: customHtml
      });
    }

    if (key === 'equipment' || key === 'products') {
      var products = this.filterItems(this.shell.products || []);
      if (!products.length) return '<p class="lp-oq-muted">No equipment configured.</p>';
      var choices = '';
      if (P && P.renderCartRows) {
        choices = P.renderCartRows(s, this.shell, products, { esc: esc, iconHtml: iconHtml.bind(this) });
      } else {
        choices = products.map(function(p) {
          var sel = s.productId === p.id ? ' is-selected' : '';
          return '<button type="button" class="lp-oq-choice' + sel + '" data-pick="productId" data-val="' + esc(p.id) + '">' +
            choiceHtml(p) + '</button>';
        }).join('');
      }
      var fields = '';
      if (this.steps().indexOf('event') < 0) {
        fields = (P && P.renderLabourPlanning)
          ? P.renderLabourPlanning(s, this.shell, products)
          : '<label class="lp-oq-field"><span>Event date</span>' +
            '<input type="date" data-field="eventDate" value="' + esc(s.eventDate || '') + '"></label>' +
            '<label class="lp-oq-field"><span>Barista 1 — event duration (hours)</span>' +
            '<input type="number" min="1" max="48" data-field="hours" value="' + esc(s.hours) + '"></label>';
      }
      return wrap({
        intro: '<p class="lp-oq-intro">What equipment would you like to hire?</p>',
        fields: fields,
        choices: choices
      });
    }
    if (key === 'beverages') {
      var bevs = this.filterItems(this.shell.beverages || []);
      if (!bevs.length) return '<p class="lp-oq-muted">No packages for this selection.</p>';
      var bevCards = (P && P.renderBeverageQtyCards)
        ? P.renderBeverageQtyCards(s, this.shell, bevs, { esc: esc, iconHtml: iconHtml })
        : bevs.map(function(b) {
          var sel = s.beverageId === b.id ? ' is-selected' : '';
          return '<button type="button" class="lp-oq-choice' + sel + '" data-pick="beverageId" data-val="' + esc(b.id) + '">' +
            choiceHtml(b) + '</button>';
        }).join('');
      return wrap({
        intro: '<p class="lp-oq-intro">Set a quantity for each package or catering option you want. Leave others at 0.</p>',
        choices: bevCards
      });
    }
    if (key === 'travel') {
      var zones = this.shell.travelZones || [];
      var Pt = global.LPQuotePlanning;
      var travelChoices = (Pt && Pt.renderTravelZoneRows)
        ? Pt.renderTravelZoneRows(this.state, this.shell, zones, { esc: esc, iconHtml: iconHtml })
        : zones.map(function(z) {
          var sel = s.travelZoneId === z.id ? ' is-selected' : '';
          return '<button type="button" class="lp-oq-choice' + sel + '" data-pick="travelZoneId" data-val="' + esc(z.id) + '">' +
            choiceHtml(z) + '</button>';
        }).join('');
      return wrap({
        intro: '<p class="lp-oq-intro">Where is your event?</p>',
        choices: travelChoices
      });
    }
    if (key === 'addons') {
      var addons = this.filterItems(this.shell.addons || []);
      if (!addons.length) return '<p class="lp-oq-muted">No add-ons for this quote.</p>';
      return wrap({
        intro: '<p class="lp-oq-intro">Optional extras.</p>',
        choices: addons.map(function(a) {
          var on = s.addonIds.indexOf(a.id) >= 0 ? ' is-selected' : '';
          return '<button type="button" class="lp-oq-choice lp-oq-multi' + on + '" data-addon="' + esc(a.id) + '">' +
            choiceHtml(a) + '</button>';
        }).join('')
      });
    }
    return wrap({
      intro: '<p class="lp-oq-intro">Your details to receive the quote.</p>',
      fields: '<label class="lp-oq-field"><span>Name</span><input data-field="contact.name" value="' + esc(s.contact.name) + '"></label>' +
        '<label class="lp-oq-field"><span>Email</span><input type="email" data-field="contact.email" value="' + esc(s.contact.email) + '"></label>' +
        '<label class="lp-oq-field"><span>Mobile</span><input type="tel" data-field="contact.phone" placeholder="0414 631 463" value="' + esc(s.contact.phone) + '"></label>' +
        this.renderCustomFields('contact')
    });
  };

  OnlineQuoteWidget.prototype.renderFooter = function(stepKey, steps) {
    var back = this.state.step > 0
      ? '<button type="button" class="lp-oq-btn lp-oq-btn-ghost" data-act="back">Back</button>'
      : '';
    var isLast = this.state.step >= steps.length - 1;
    var next = isLast
      ? '<button type="button" class="lp-oq-btn" data-act="calculate">Get my quote</button>'
      : '<button type="button" class="lp-oq-btn" data-act="next">Continue</button>';
    return back + next;
  };

  OnlineQuoteWidget.prototype.renderQuotePanel = function() {
    var q = this.state.quote;
    if (!q) return '';
    var html = '<div class="lp-oq-quote"><h3>Your quote</h3>';
    if (q.level === 'public_progress') {
      html += '<p>' + esc(q.message || 'Verify your email to see your total.') + '</p>';
      if (this.state.emailCodeSent) {
        html += '<p class="lp-oq-muted" style="font-size:13px;margin:0 0 12px">We sent a 6-digit code to your email. Enter it below.</p>';
      }
      html += '<label class="lp-oq-field"><span>Email verification code</span>' +
        '<input data-field="emailCode" placeholder="6-digit code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" value="' + esc(this.state.emailCode || '') + '"></label>' +
        '<button type="button" class="lp-oq-btn" data-act="confirm-email" style="margin-top:10px">Confirm email code</button>';
      if (this.state.emailCodeSent) {
        html += '<p style="margin-top:10px"><button type="button" class="lp-oq-btn lp-oq-btn-ghost" data-act="send-email" style="font-size:13px;padding:6px 12px">Resend code</button></p>';
      }
    } else if (q.level === 'email_verified_total') {
      html += '<p class="lp-oq-total">' + esc(q.totalFormatted || '') + ' <small>inc GST</small></p>' +
        (this.state.emailWhitelisted
          ? '<p class="lp-oq-muted" style="font-size:13px">Welcome back — your email is already verified.</p>'
          : (this.state.emailSummarySent ? '<p class="lp-oq-muted" style="font-size:13px">A summary was emailed to you. Complete SMS below for the full PDF.</p>' : '')) +
        '<p>' + esc(q.message || '') + '</p>' +
        '<div class="lp-oq-verify"><button type="button" class="lp-oq-btn" data-act="send-sms">Text me a code for full breakdown</button></div>' +
        '<label class="lp-oq-field"><span>SMS verification code</span><input data-field="smsCode" placeholder="6-digit code"></label>' +
        '<button type="button" class="lp-oq-btn" data-act="confirm-sms">Confirm SMS code</button>';
    } else if (q.level === 'fully_verified_quote') {
      html += '<p class="lp-oq-total">' + esc(q.totalFormatted || '') + ' <small>inc GST</small></p><ul class="lp-oq-lines">';
      (q.breakdown || []).forEach(function(row) {
        html += '<li><span>' + esc(row.label) + '</span><span>' + esc(formatMoney(row.totalCents)) + '</span></li>';
      });
      html += '</ul>';
      if (this.state.portalUrl) {
        html += '<div class="lp-oq-verify" style="margin-top:14px">' +
          '<a class="lp-oq-btn" href="' + esc(this.state.portalUrl) + '" target="_blank" rel="noopener" style="display:inline-block;text-decoration:none">Open quote portal</a>' +
          (this.state.pdfUrl ? ' <a class="lp-oq-btn lp-oq-btn-ghost" href="' + esc(this.state.pdfUrl) + '" target="_blank" rel="noopener" style="display:inline-block;text-decoration:none;margin-left:8px">Download PDF</a>' : '') +
          '</div><p class="lp-oq-muted" style="font-size:12px;margin-top:8px">Check your email for the portal link and PDF attachment.</p>';
      }
    }
    html += '</div>';
    return html;
  };

  function formatMoney(cents) {
    return '$' + (Math.round(cents) / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  OnlineQuoteWidget.prototype.wire = function(stepKey) {
    var self = this;
    var P = this.planning();
    var products = this.filterItems(this.shell.products || []);
    this.el.querySelectorAll('[data-pick]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var key = btn.getAttribute('data-pick');
        self.state[key] = btn.getAttribute('data-val');
        if (P && P.ensureCarts) P.ensureCarts(self.state, products);
        if (key === 'productId') self.reconcileState();
        self.render();
      });
    });
    if (P && P.wireLabourPlanning) P.wireLabourPlanning(this.el, this.state, this.shell, function() { self.render(); }, products);
    if (P && P.wireStaffing) P.wireStaffing(this.el, this.state, this.shell, products, function() { self.render(); });
    if (P && P.wireCartRows) P.wireCartRows(this.el, this.state, this.shell, products, function() { self.reconcileState(); self.render(); });
    if (P && P.wireTravelZoneRows) P.wireTravelZoneRows(this.el, this.state, function() { self.render(); });
    if (P && P.wireBeverageQty) P.wireBeverageQty(this.el, this.state, function() { self.render(); });
    if (P && P.wireCustomFields) P.wireCustomFields(this.el, this.state, 'data-custom-field');
    this.el.querySelectorAll('[data-addon]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-addon');
        var idx = self.state.addonIds.indexOf(id);
        if (idx >= 0) self.state.addonIds.splice(idx, 1);
        else self.state.addonIds.push(id);
        self.render();
      });
    });
    this.el.querySelectorAll('[data-field]').forEach(function(inp) {
      inp.addEventListener('change', function() {
        var f = inp.getAttribute('data-field');
        var v = inp.value;
        if (f.indexOf('contact.') === 0) {
          var key = f.slice(8);
          self.state.contact[key] = key === 'phone' ? normaliseAuPhone(v) : v;
        } else if (f === 'hours') {
          if (P && P.setGlobalBarista1Hours) P.setGlobalBarista1Hours(self.state, v);
          else self.state.hours = parseInt(v, 10) || 0;
        } else if (f === 'guestCount' || f === 'unitCount') self.state[f] = parseInt(v, 10) || 0;
        else self.state[f] = v;
      });
    });
    this.el.querySelectorAll('[data-act]').forEach(function(btn) {
      // Prevent qty/input blur→change from destroying this button before click.
      btn.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return;
        var act = btn.getAttribute('data-act');
        if (act === 'next' || act === 'back' || act === 'calculate') e.preventDefault();
      });
      btn.addEventListener('click', function() {
        var act = btn.getAttribute('data-act');
        if (act === 'back') {
          self.syncWizardDom();
          self.moveStep(-1);
        } else if (act === 'next') {
          self.syncWizardDom();
          var needsEventDate = stepKey === 'event' ||
            ((stepKey === 'equipment' || stepKey === 'products') && self.steps().indexOf('event') < 0);
          if (needsEventDate) {
            var eventErr = self.validateEventStep();
            if (eventErr) { alert(eventErr); return; }
          }
          var err = self.validateStepCustomFields(stepKey);
          if (err) { alert(err); return; }
          self.moveStep(1);
        }
        else if (act === 'calculate') self.calculate();
        else if (act === 'send-email') self.sendEmail();
        else if (act === 'confirm-email') self.confirmEmail();
        else if (act === 'send-sms') self.sendSms();
        else if (act === 'confirm-sms') self.confirmSms();
      });
    });
  };

  OnlineQuoteWidget.prototype.syncWizardDom = function() {
    var P = this.planning();
    if (P && P.syncEventFieldsFromDom) P.syncEventFieldsFromDom(this.el, this.state);
    if (P && P.syncBeverageQtyFromDom) P.syncBeverageQtyFromDom(this.el, this.state);
    this.syncCustomFromDom();
  };

  OnlineQuoteWidget.prototype.validateEventStep = function() {
    if ((this.state.labourPlanning || 'hours') === 'shifts') return null;
    if (!(this.state.eventDate || '').trim()) {
      return 'Please choose an event date.';
    }
    return null;
  };

  OnlineQuoteWidget.prototype.moveStep = function(delta) {
    var W = wl();
    var before = this.resolvedSteps();
    var idx = this.state.step;
    this.reconcileState();
    var after = this.resolvedSteps();
    if (W.stepIndexAfterMove) {
      this.state.step = W.stepIndexAfterMove(before, idx, delta, after);
    } else {
      this.state.step = Math.max(0, Math.min(after.length - 1, idx + (delta < 0 ? -1 : 1)));
    }
    this.render();
  };

  OnlineQuoteWidget.prototype.syncCustomFromDom = function() {
    var P = this.planning();
    if (P && P.syncCustomAnswersFromDom) {
      P.syncCustomAnswersFromDom(this.el, this.state, 'data-custom-field');
    }
  };

  OnlineQuoteWidget.prototype.validateStepCustomFields = function(stepKey) {
    var P = this.planning();
    var attach = stepKey === 'event' ? 'event'
      : (stepKey === 'custom' || stepKey === 'questions') ? 'custom'
      : stepKey === 'contact' ? 'contact'
      : null;
    if (!attach) return null;
    var fields = this.customFieldsFor(attach);
    if (P && P.validateCustomFields) return P.validateCustomFields(fields, this.state.customAnswers || {});
    return null;
  };

  OnlineQuoteWidget.prototype.syncContactFromDom = function() {
    this.el.querySelectorAll('[data-field^="contact."]').forEach(function(inp) {
      var key = inp.getAttribute('data-field').slice(8);
      var v = inp.value;
      if (key === 'phone') this.state.contact.phone = normaliseAuPhone(v);
      else this.state.contact[key] = v;
    }, this);
    this.syncWizardDom();
  };

  OnlineQuoteWidget.prototype.ensureSession = function() {
    var self = this;
    var inputs = this.progress();
    var body = {
      slug: this.slug,
      progress: inputs,
      contact: {
        name: this.state.contact.name,
        email: this.state.contact.email,
        phone: contactPhone.call(this)
      }
    };
    if (this.token) body.token = this.token;
    return post('/session', body).then(function(res) {
      if (!res.ok) throw new Error(res.error || 'session');
      self.token = res.token;
      self.state.session = res.session;
      return res;
    });
  };

  OnlineQuoteWidget.prototype.calculate = function() {
    var self = this;
    this.syncContactFromDom();
    var email = (this.state.contact.email || '').trim();
    if (!email || email.indexOf('@') < 3) {
      alert('Enter a valid email address to receive your quote.');
      return;
    }
    var contactErr = this.validateStepCustomFields('contact');
    if (contactErr) { alert(contactErr); return; }
    var customErr = this.validateStepCustomFields('custom');
    if (customErr) { alert(customErr); return; }
    var eventErr = this.validateStepCustomFields('event');
    if (eventErr) { alert(eventErr); return; }
    this.el.querySelector('.lp-oq-body').innerHTML = '<p class="lp-oq-muted">Calculating…</p>';
    this.ensureSession().then(function() {
      return post('/calculate', {
        token: self.token,
        inputs: self.progress()
      });
    }).then(function(res) {
      if (!res.ok) throw new Error(res.error || 'calculate');
      self.state.quote = res.quote;
      self.state.session = res.session;
      if (res.emailVerification) {
        if (res.emailVerification.sent) self.state.emailCodeSent = true;
        if (res.emailVerification.whitelisted) {
          self.state.emailWhitelisted = true;
          self.state.emailSummarySent = true;
        }
      }
      self.render();
    }).catch(function() {
      self.el.querySelector('.lp-oq-body').innerHTML = '<p class="lp-oq-error">Could not calculate quote. Please try again.</p>';
    });
  };

  OnlineQuoteWidget.prototype.sendEmail = function() {
    var self = this;
    var email = (this.state.contact.email || '').trim();
    if (!email || email.indexOf('@') < 3) {
      alert('Enter a valid email address first.');
      return;
    }
    this.ensureSession().then(function() {
      return post('/verify-email', {
        token: self.token,
        action: 'send',
        email: email
      });
    }).then(function(res) {
      if (!res || !res.ok) {
        alert('Could not send code. ' + (res && res.error ? res.error : 'Try again shortly.'));
        return;
      }
      if (res.sent) {
        self.state.emailCodeSent = true;
        self.render();
      } else if (res.reason === 'no_key') {
        alert('Email verification is not configured yet. Please contact the business directly.');
      } else {
        alert('Could not send code. Try again shortly.');
      }
    }).catch(function() {
      alert('Could not send code. Try again shortly.');
    });
  };

  OnlineQuoteWidget.prototype.confirmEmail = function() {
    var self = this;
    var codeInp = this.el.querySelector('[data-field="emailCode"]');
    var code = ((codeInp && codeInp.value) || this.state.emailCode || '').trim();
    if (!code) {
      alert('Enter the 6-digit code from your email.');
      return;
    }
    post('/verify-email', { token: this.token, action: 'confirm', code: code }).then(function(res) {
      if (!res.ok) { alert('Invalid or expired code.'); return; }
      if (res.summaryEmailSent) {
        self.state.emailSummarySent = true;
      }
      return post('/calculate', { token: self.token });
    }).then(function(res) {
      if (res && res.ok) {
        self.state.quote = res.quote;
        self.state.session = res.session;
        self.render();
      }
    });
  };

  OnlineQuoteWidget.prototype.sendSms = function() {
    var self = this;
    var phone = contactPhone.call(this);
    if (!phone || phone.length < 11) {
      alert('Enter a valid Australian mobile number (e.g. 0414 631 463).');
      return;
    }
    post('/verify-sms', {
      token: this.token,
      action: 'send',
      phone: phone
    }).then(function(res) {
      if (!res.sent) alert('SMS verification is not available yet.');
      else alert('Verification code sent to your mobile.');
      self.render();
    });
  };

  OnlineQuoteWidget.prototype.confirmSms = function() {
    var self = this;
    var codeInp = this.el.querySelector('[data-field="smsCode"]');
    var code = codeInp ? codeInp.value : '';
    post('/verify-sms', {
      token: this.token,
      action: 'confirm',
      code: code,
      phone: contactPhone.call(this)
    }).then(function(res) {
      if (!res.ok) { alert('Invalid or expired SMS code.'); return; }
      self.state.portalUrl = res.portalUrl || null;
      self.state.pdfUrl = res.pdfUrl || null;
      if (res.quote) self.state.quote = res.quote;
      return post('/calculate', { token: self.token });
    }).then(function(res) {
      if (res && res.ok) {
        self.state.quote = res.quote;
        self.state.session = res.session;
        self.render();
      }
    });
  };

  function injectStyles() {
    var brand = 'var(--pipe, var(--accent, #1f7a63))';
    var css = document.getElementById('lp-oq-styles');
    if (!css) {
      css = document.createElement('style');
      css.id = 'lp-oq-styles';
      document.head.appendChild(css);
    }
    var layoutRules = (window.LPQuoteDisplay && window.LPQuoteDisplay.layoutCss)
      ? window.LPQuoteDisplay.layoutCss(brand) : '';
    css.textContent = [
      /* Section band — match trade theme .eyebrow / .section-head */
      '.online-quote .section-head{max-width:62ch}',
      '.online-quote .eyebrow,.online-quote .ey{font-family:"Barlow",system-ui,-apple-system,sans-serif;font-weight:700;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--oq-eyebrow,var(--pipe,var(--accent,inherit)));margin:0}',
      '.online-quote .section-head h2,.online-quote>.in>h2,.online-quote .in>.section-head>h2{font-family:"Barlow Condensed","Barlow",system-ui,sans-serif;font-size:clamp(32px,4.4vw,52px);font-weight:800;letter-spacing:-.01em;text-transform:uppercase;margin:10px 0 0;line-height:1.1;color:var(--oq-heading,inherit)}',
      '.online-quote .section-head p,.online-quote .intro{margin:13px 0 0;font-size:18px;font-weight:500;line-height:1.45;color:var(--oq-intro,var(--muted,var(--ink-soft,inherit)));max-width:62ch}',
      '.lp-oq-card{font-family:system-ui,-apple-system,Segoe UI,sans-serif;width:100%;max-width:100%;box-sizing:border-box;border:1px solid var(--lp-oq-panel-border,color-mix(in srgb,' + brand + ' 28%, var(--line, var(--border, currentColor))));border-radius:16px;padding:20px;background:var(--lp-oq-panel-bg,transparent);color:var(--lp-oq-body,var(--ink, var(--text, inherit)))}',
      '.lp-oq-title{margin:0 0 8px;font-size:1.35rem;color:var(--lp-oq-panel-title,var(--ink, var(--text, inherit)))}',
      '.lp-oq-intro{color:var(--lp-oq-intro,var(--ink-soft, var(--text-soft, inherit)));margin:0 0 10px}',
      '.lp-oq-steps{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}',
      /* Progress chips match Back / Continue / Get my quote size */
      '.lp-oq-step{display:inline-flex;align-items:center;justify-content:center;font-size:inherit;line-height:1.2;padding:10px 18px;border-radius:8px;border:1px solid var(--lp-oq-step-border,color-mix(in srgb,' + brand + ' 22%, var(--line, var(--border, currentColor))));background:var(--lp-oq-step-bg,transparent);color:var(--lp-oq-step-text,var(--ink-soft, var(--text-soft, inherit)));text-transform:capitalize;font-weight:600;box-sizing:border-box}',
      '.lp-oq-step.is-active{background:var(--lp-oq-step-active-bg,' + brand + ');border-color:var(--lp-oq-step-active-border,var(--lp-oq-step-active-bg,' + brand + '));color:var(--lp-oq-step-active-text,var(--accent-text, var(--on-pipe, var(--ink))))}',
      '.lp-oq-step.is-done{background:transparent;border-color:var(--lp-oq-step-done-border,color-mix(in srgb,' + brand + ' 40%, var(--line, var(--border, currentColor))));color:var(--lp-oq-step-done-text,' + brand + ')}',
      '.lp-oq-choice{display:block;width:100%;text-align:left;margin:0 0 8px;padding:12px 14px;border:1px solid color-mix(in srgb,' + brand + ' 22%, var(--line, var(--border, currentColor)));border-radius:12px;background:transparent;color:var(--lp-oq-choice-text,var(--ink, var(--text, inherit)));cursor:pointer;font:inherit;box-sizing:border-box}',
      '.lp-oq-choice strong{color:inherit}',
      '.lp-oq-choice .lp-oq-ic{display:inline-flex;vertical-align:middle;margin-right:8px;color:' + brand + '}',
      '.lp-oq-choice .lp-oq-ic svg{width:18px;height:18px}',
      '.lp-oq-choice-img{display:block;margin:0 0 8px;border-radius:8px;object-fit:contain;max-width:100%}',
      layoutRules,
      /* Packages / add-ons / travel: horizontal row for cards + grid layouts */
      '.lp-oq-layout-cards .lp-oq-choices:not(.lp-oq-fp-grid),.lp-oq-layout-grid .lp-oq-choices:not(.lp-oq-fp-grid){display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;width:100%}',
      '.lp-oq-layout-cards .lp-oq-choices:not(.lp-oq-fp-grid) .lp-oq-choice,.lp-oq-layout-grid .lp-oq-choices:not(.lp-oq-fp-grid) .lp-oq-choice{width:auto;margin:0;height:100%}',
      '.lp-oq-choice.is-selected{border-color:' + brand + ';box-shadow:0 0 0 2px color-mix(in srgb,' + brand + ' 30%, transparent)}',
      '.lp-oq-choice span{display:block;font-size:13px;color:var(--lp-oq-choice-desc,var(--ink-soft, var(--text-soft, inherit)));margin-top:4px}',
      '.lp-oq-field{display:block;margin:10px 0 0}',
      '.lp-oq-field span{display:block;font-size:12px;color:var(--lp-oq-label,var(--ink-soft, var(--text-soft, inherit)));margin-bottom:4px}',
      '.lp-oq-field input{width:100%;padding:10px 12px;border:1px solid var(--line-strong, var(--border-strong, currentColor));border-radius:10px;font:inherit;background:var(--lp-oq-field-bg,var(--input-bg, var(--panel, transparent)));color:var(--lp-oq-field-text,var(--ink, var(--text, inherit)));box-sizing:border-box}',
      '.lp-oq-foot{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}',
      '.lp-oq-btn{display:inline-flex;align-items:center;justify-content:center;padding:10px 18px;border:none;border-radius:8px;background:var(--lp-oq-btn-bg,' + brand + ');color:var(--lp-oq-btn-text,var(--accent-text, var(--on-pipe, var(--ink))));font-weight:600;cursor:pointer;font:inherit;line-height:1.2;box-sizing:border-box}',
      '.lp-oq-btn-ghost{background:var(--lp-oq-btn-ghost-bg,transparent);color:var(--lp-oq-btn-ghost-text,' + brand + ');border:1px solid var(--lp-oq-btn-ghost-border,color-mix(in srgb,' + brand + ' 40%, var(--line, var(--border, currentColor))))}',
      '.lp-oq-quote{margin-top:18px;padding-top:18px;border-top:1px solid color-mix(in srgb,' + brand + ' 18%, var(--line, var(--border, currentColor)))}',
      '.lp-oq-total{font-size:1.6rem;font-weight:800;margin:0 0 8px;color:var(--lp-oq-body,var(--ink, var(--text, inherit)))}',
      '.lp-oq-lines{list-style:none;padding:0;margin:12px 0 0}',
      '.lp-oq-lines li{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid color-mix(in srgb, var(--ink-soft, var(--text-soft, currentColor)) 25%, transparent);font-size:14px;color:var(--lp-oq-body,var(--ink, var(--text, inherit)))}',
      '.lp-oq-muted{color:var(--lp-oq-muted,var(--ink-soft, var(--text-soft, inherit)))}',
      '.lp-oq-error{color:var(--danger, #b42318)}',
      '.lp-oq-loading{color:var(--lp-oq-muted,var(--ink-soft, var(--text-soft, inherit)))}',
      '.lp-oq-plan{border:1px solid color-mix(in srgb,' + brand + ' 18%, var(--line, var(--border, currentColor)));border-radius:12px;padding:12px;margin-top:12px;color:var(--lp-oq-body,inherit)}',
      '.lp-oq-plan legend{font-size:12px;font-weight:600;padding:0 4px;color:var(--lp-oq-label,inherit)}',
      '.lp-oq-radio{display:inline-flex;align-items:center;gap:6px;margin:0 12px 8px 0;font-size:13px;color:var(--lp-oq-body,inherit)}',
      '.lp-oq-check{display:flex;align-items:center;gap:8px;margin:10px 0 0;font-size:13px;color:var(--lp-oq-body,inherit)}',
      '.lp-oq-shift,.lp-oq-cart,.lp-oq-staff-row{border:1px dashed color-mix(in srgb,' + brand + ' 22%, var(--line, var(--border, currentColor)));border-radius:10px;padding:10px;margin:10px 0;color:var(--lp-oq-body,inherit)}',
      '.lp-oq-cart-head,.lp-oq-staff-label{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;color:var(--lp-oq-body,inherit)}',
      '.lp-oq-product-qty{margin-top:8px}',
      '.lp-oq-product-qty input:disabled{opacity:.45}',
      '.lp-oq-shift-remove,.lp-oq-cart-remove{font-size:12px;padding:4px 10px}'
    ].join('');
  }

  function resolveSlug(el) {
    if (!el) return '';
    var s = (el.getAttribute('data-slug') || '').trim().toLowerCase();
    if (s) return s;
    if (typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG && SITE_CONFIG.slug) {
      return String(SITE_CONFIG.slug).trim().toLowerCase();
    }
    if (window.__lpLiveCfg && window.__lpLiveCfg.slug) {
      return String(window.__lpLiveCfg.slug).trim().toLowerCase();
    }
    return '';
  }

  function mount(el) {
    if (!el) return;
    var slug = resolveSlug(el);
    if (!slug) return;
    el.setAttribute('data-slug', slug);
    if (el.__lpOqMounted && el.__lpOqSlug === slug) return;
    el.__lpOqMounted = true;
    el.__lpOqSlug = slug;
    injectStyles();
    var w = new OnlineQuoteWidget(el);
    w.init();
  }

  function boot() {
    var el = document.getElementById(ROOT_ID);
    if (!el) return;
    var sec = el.closest('[data-sec="onlineQuote"]');
    var cfg = (typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG) || window.__lpLiveCfg || {};
    var on = cfg.sections && cfg.sections.onlineQuote && cfg.sections.onlineQuote.on === true;
    if (sec && sec.style.display === 'none' && !on) return;
    mount(el);
  }

  window.LPOnlineQuoteMount = mount;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
