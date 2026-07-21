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
      jobsPortalUrl: null,
      pdfUrl: null,
      emailCodeSent: false,
      emailWhitelisted: false,
      emailSummarySent: false,
      emailSendReason: null,
      showPortalAccess: false,
      portalAccessEmail: '',
      portalAccessMsg: ''
    };
  };

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
    var bodyHtml;
    try {
      bodyHtml = this.renderStep(stepKey);
    } catch (err) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('[lp-online-quote] renderStep failed for', stepKey, err);
      }
      bodyHtml = '<p class="lp-oq-error">This step could not be loaded. Please go back and try again.</p>';
    }
    var html = '<div class="lp-oq-card' + layoutClass(this.shell) + '"' + (uiStyle ? (' style="' + uiStyle + '"') : '') + '>' +
      '<div class="lp-oq-head"><h2 class="lp-oq-title">' + esc(biz) + '</h2>' +
      '<div class="lp-oq-nav">' +
      '<div class="lp-oq-steps">' + steps.map(function(s, i) {
        return '<span class="lp-oq-step' + (i === this.state.step ? ' is-active' : (i < this.state.step ? ' is-done' : '')) + '">' + esc(this.stepLabel(s)) + '</span>';
      }, this).join('') + '</div>' +
      '<button type="button" class="lp-oq-btn lp-oq-access-toggle" data-act="portal-access-toggle">Already quoted? Access my portal</button>' +
      '</div></div>' +
      '<div class="lp-oq-body">' + bodyHtml + '</div>' +
      '<div class="lp-oq-foot">' + this.renderFooter(stepKey, steps) + '</div>' +
      '</div>' +
      this.renderPortalAccessPopup(uiStyle);
    this.el.innerHTML = html;
    this.wire(stepKey);
  };

  OnlineQuoteWidget.prototype.renderPortalAccessPopup = function(uiStyle) {
    var s = this.state;
    if (!s.showPortalAccess) return '';
    var styleAttr = uiStyle ? (' style="' + uiStyle + '"') : '';
    var html = '<div class="lp-oq-access-backdrop" role="presentation">' +
      '<div class="lp-oq-access-dialog" role="dialog" aria-modal="true" aria-labelledby="lp-oq-access-title" data-lp-oq-access-dialog' + styleAttr + '>' +
      '<h3 id="lp-oq-access-title" class="lp-oq-access-title">Access my portal</h3>' +
      '<p class="lp-oq-access-lead">Enter the email from your quote. We\'ll send a private link to your portal.</p>' +
      '<label class="lp-oq-field lp-oq-access-field"><span>Email</span>' +
      '<input type="email" data-field="portalAccessEmail" autocomplete="email" value="' + esc(s.portalAccessEmail || s.contact.email || '') + '" placeholder="you@example.com"></label>' +
      '<div class="lp-oq-access-actions">' +
      '<button type="button" class="lp-oq-btn lp-oq-access-send" data-act="portal-access-send">Email me a link</button>' +
      '<button type="button" class="lp-oq-btn lp-oq-access-cancel" data-act="portal-access-toggle">Cancel</button>' +
      '</div>';
    if (s.portalAccessMsg) {
      html += '<p class="lp-oq-access-msg">' + esc(s.portalAccessMsg) + '</p>';
    }
    html += '</div></div>';
    return html;
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
      var eventCustom = this.renderCustomFields('event');
      return wrap({
        intro: '<p class="lp-oq-intro">When is your event, and how many baristas do you need?</p>',
        fields: '<div class="lp-oq-cols lp-oq-cols-event">' +
          '<div class="lp-oq-col lp-oq-col-schedule">' +
          '<p class="lp-oq-col-title">Event schedule</p>' + fields +
          '</div>' +
          '<div class="lp-oq-col lp-oq-col-staff">' +
          '<p class="lp-oq-col-title">Barista staffing</p>' + staffing +
          '</div></div>' +
          (eventCustom ? '<div class="lp-oq-event-extra">' + eventCustom + '</div>' : '')
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
      // Must use this.planning() — live script is a plain IIFE (no `global` binding).
      var Pt = this.planning();
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
    var contactSelf = this;
    return wrap({
      intro: '<p class="lp-oq-intro">Your details to receive the quote.</p>',
      fields: (function() {
        var allContact = contactSelf.customFieldsFor('contact');
        var parts = (P && P.partitionCustomFields)
          ? P.partitionCustomFields(allContact)
          : { left: allContact.filter(function(f) { return f.type !== 'textarea'; }),
              right: allContact.filter(function(f) { return f.type === 'textarea'; }) };
        var leftExtra = (P && P.renderCustomFieldsHtml)
          ? P.renderCustomFieldsHtml(parts.left, s.customAnswers || {}, { esc: esc, attr: 'data-custom-field' })
          : '';
        var rightExtra = (P && P.renderCustomFieldsHtml)
          ? P.renderCustomFieldsHtml(parts.right, s.customAnswers || {}, { esc: esc, attr: 'data-custom-field' })
          : '';
        var left = '<label class="lp-oq-field"><span>Name</span><input data-field="contact.name" value="' + esc(s.contact.name) + '"></label>' +
          '<label class="lp-oq-field"><span>Email</span><input type="email" data-field="contact.email" value="' + esc(s.contact.email) + '"></label>' +
          '<label class="lp-oq-field"><span>Mobile</span><input type="tel" data-field="contact.phone" placeholder="0414 631 463" value="' + esc(s.contact.phone) + '"></label>' +
          leftExtra;
        var right = rightExtra +
          (s.quote
            ? contactSelf.renderQuotePanel()
            : '<div class="lp-oq-quote-slot"><p class="lp-oq-col-title">Your quote</p>' +
              '<p class="lp-oq-muted" style="margin:0;line-height:1.45">Fill in your details, then tap <strong>Get my quote</strong>. Your total and verification will appear here.</p></div>');
        return '<div class="lp-oq-cols lp-oq-cols-contact">' +
          '<div class="lp-oq-col lp-oq-col-contact">' + left + '</div>' +
          '<div class="lp-oq-col lp-oq-col-aside">' + right + '</div></div>';
      })()
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
      html += '<p class="lp-oq-lead">' + esc(q.message || 'Verify your email to see your total.') + '</p>';
      if (this.state.emailCodeSent) {
        html += '<p class="lp-oq-lead">We sent a 6-digit code to your email. Enter it below.</p>';
      } else if (this.state.emailSendReason === 'no_key') {
        html += '<p class="lp-oq-lead">Email sending is not configured on the server yet. Please contact the business.</p>';
      } else {
        html += '<p class="lp-oq-lead">Tap <strong>Send code</strong> if you have not received an email yet.</p>';
      }
      html += '<label class="lp-oq-field"><span>Email verification code</span>' +
        '<input data-field="emailCode" placeholder="6-digit code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" value="' + esc(this.state.emailCode || '') + '"></label>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">' +
        '<button type="button" class="lp-oq-btn" data-act="confirm-email">Confirm email code</button>' +
        '<button type="button" class="lp-oq-btn lp-oq-btn-ghost" data-act="send-email">' +
        (this.state.emailCodeSent ? 'Resend code' : 'Send code') + '</button></div>';
    } else if (q.level === 'email_verified_total') {
      html += '<p class="lp-oq-total">' + esc(q.totalFormatted || '') + ' <small>inc GST</small></p>' +
        (this.state.emailWhitelisted
          ? '<p class="lp-oq-lead">Welcome back — your email is already verified. SMS is still required for the itemised quote.</p>'
          : (this.state.emailSummarySent ? '<p class="lp-oq-lead">A summary was emailed to you. Complete SMS below for the full PDF.</p>' : '')) +
        '<p class="lp-oq-lead">' + esc(q.message || '') + '</p>' +
        '<div class="lp-oq-verify"><button type="button" class="lp-oq-btn" data-act="send-sms">Text me a code for full breakdown</button></div>' +
        '<label class="lp-oq-field"><span>SMS verification code</span><input data-field="smsCode" placeholder="6-digit code" inputmode="numeric" autocomplete="one-time-code"></label>' +
        '<button type="button" class="lp-oq-btn" data-act="confirm-sms">Confirm SMS code</button>';
    } else if (q.level === 'fully_verified_quote') {
      html += '<p class="lp-oq-total">' + esc(q.totalFormatted || '') + ' <small>inc GST</small></p><ul class="lp-oq-lines">';
      (q.breakdown || []).forEach(function(row) {
        html += '<li><span>' + esc(row.label) + '</span><span>' + esc(formatMoney(row.totalCents)) + '</span></li>';
      });
      html += '</ul>';
      var portalHref = this.state.jobsPortalUrl || this.state.portalUrl;
      if (portalHref) {
        html += '<div class="lp-oq-verify" style="margin-top:14px">' +
          '<a class="lp-oq-btn" href="' + esc(portalHref) + '" target="_blank" rel="noopener" style="display:inline-block;text-decoration:none">' +
          (this.state.jobsPortalUrl ? 'Open your quotes portal' : 'Open quote portal') + '</a>' +
          (this.state.pdfUrl ? ' <a class="lp-oq-btn lp-oq-btn-ghost" href="' + esc(this.state.pdfUrl) + '" target="_blank" rel="noopener" style="display:inline-block;text-decoration:none;margin-left:8px">Download PDF</a>' : '') +
          '</div><p class="lp-oq-lead" style="margin-top:8px">Check your email for the portal link and PDF. Returning visits skip email verify — SMS is still required for each itemised quote.</p>';
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
        else if (act === 'portal-access-toggle') {
          self.togglePortalAccess();
        }
        else if (act === 'portal-access-send') self.sendPortalAccess();
      });
    });
    var backdrop = this.el.querySelector('.lp-oq-access-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', function(e) {
        if (e.target === backdrop) self.togglePortalAccess(false);
      });
      var dialog = backdrop.querySelector('[data-lp-oq-access-dialog]');
      if (dialog) {
        dialog.addEventListener('click', function(e) { e.stopPropagation(); });
      }
    }
    this.el.querySelectorAll('[data-field="portalAccessEmail"]').forEach(function(inp) {
      inp.addEventListener('change', function() {
        self.state.portalAccessEmail = inp.value || '';
      });
      inp.addEventListener('input', function() {
        self.state.portalAccessEmail = inp.value || '';
      });
      if (self.state.showPortalAccess) {
        try { inp.focus(); } catch (err) { /* ignore */ }
      }
    });
    if (self._portalEscBound) {
      document.removeEventListener('keydown', self._portalEscBound);
      self._portalEscBound = null;
    }
    if (self.state.showPortalAccess) {
      self._portalEscBound = function(e) {
        if (e.key === 'Escape') self.togglePortalAccess(false);
      };
      document.addEventListener('keydown', self._portalEscBound);
    }
  };

  OnlineQuoteWidget.prototype.togglePortalAccess = function(force) {
    var open = (typeof force === 'boolean') ? force : !this.state.showPortalAccess;
    this.state.showPortalAccess = open;
    if (!open) this.state.portalAccessMsg = '';
    if (open && !this.state.portalAccessEmail) {
      this.state.portalAccessEmail = (this.state.contact && this.state.contact.email) || '';
    }
    this.render();
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
    var nextIdx = W.stepIndexAfterMove
      ? W.stepIndexAfterMove(before, idx, delta, after)
      : Math.max(0, Math.min(after.length - 1, idx + (delta < 0 ? -1 : 1)));
    var prevIdx = this.state.step;
    this.state.step = nextIdx;
    this.state._calOpen = null;
    try {
      this.render();
    } catch (err) {
      // Never leave state advanced while the previous step stays painted (causes skip).
      this.state.step = prevIdx;
      if (typeof console !== 'undefined' && console.error) {
        console.error('[lp-online-quote] moveStep render failed; rolled back', err);
      }
      try { this.render(); } catch (err2) { /* keep prior DOM */ }
    }
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
        inputs: self.progress(),
        contact: {
          name: self.state.contact.name,
          email: self.state.contact.email,
          phone: contactPhone.call(self)
        }
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
        self.state.emailSendReason = res.emailVerification.reason || null;
      }
      var steps = self.steps();
      var contactIdx = steps.indexOf('contact');
      if (contactIdx >= 0) self.state.step = contactIdx;
      self.render();
      var ev = res.emailVerification || {};
      if (ev.required && !ev.whitelisted && !ev.sent) {
        if (ev.reason === 'no_key') {
          alert('Email verification is not configured on the server (missing RESEND_API_KEY). Contact the site owner.');
        } else if (ev.reason === 'no_email') {
          alert('Your email did not save to the quote session. Please tap Get my quote again.');
        } else if (ev.reason && String(ev.reason).indexOf('resend_') === 0) {
          alert('We could not email your code (' + ev.reason + '). Tap Resend code, or check spam.');
        } else {
          // Attempt an explicit force-send so the customer still gets a code.
          self.sendEmail({ quiet: true });
        }
      } else if (ev.sent) {
        // Soft notice — do not block the UI.
      }
    }).catch(function(err) {
      var detail = (err && err.message) ? String(err.message) : '';
      var hint = '';
      if (detail === 'subscription_required') hint = ' Online quote is not active for this site.';
      else if (detail === 'quote_not_enabled') hint = ' Online quote is turned off.';
      else if (detail === 'session_expired') hint = ' Your session expired — refresh and try again.';
      else if (detail === 'no_config') hint = ' Quote pricing is not configured yet.';
      else if (detail && detail !== 'calculate' && detail !== 'session' && detail !== 'server_error') {
        hint = ' (' + detail.replace(/_/g, ' ') + ')';
      }
      self.el.querySelector('.lp-oq-body').innerHTML = '<p class="lp-oq-error">Could not calculate quote. Please try again.' + hint + '</p>';
    });
  };

  OnlineQuoteWidget.prototype.sendEmail = function(opts) {
    var self = this;
    opts = opts || {};
    this.syncContactFromDom();
    var email = (this.state.contact.email || '').trim();
    if (!email || email.indexOf('@') < 3) {
      if (!opts.quiet) alert('Enter a valid email address first.');
      return;
    }
    this.ensureSession().then(function() {
      return post('/verify-email', {
        token: self.token,
        action: 'send',
        email: email,
        force: true
      });
    }).then(function(res) {
      if (!res || !res.ok) {
        if (!opts.quiet) {
          alert('Could not send code. ' + ((res && (res.message || res.error)) || 'Try again shortly.'));
        }
        return;
      }
      if (res.sent) {
        self.state.emailCodeSent = true;
        self.state.emailCode = '';
        self.state.emailSendReason = null;
        self.render();
        if (!opts.quiet) {
          alert('We sent a 6-digit code to your email. Check inbox and spam.');
        }
      } else if (res.reason === 'no_key') {
        if (!opts.quiet) {
          alert('Email verification is not configured yet. Please contact the business directly.');
        }
      } else {
        self.state.emailSendReason = res.reason || 'send_failed';
        self.render();
        if (!opts.quiet) {
          alert('Could not send code' + (res.reason ? (' (' + res.reason + ')') : '') + '. Try Resend code again shortly.');
        }
      }
    }).catch(function() {
      if (!opts.quiet) alert('Could not send code. Try again shortly.');
    });
  };

  OnlineQuoteWidget.prototype.confirmEmail = function() {
    var self = this;
    this.syncContactFromDom();
    var codeInp = this.el.querySelector('[data-field="emailCode"]');
    var raw = ((codeInp && codeInp.value) || this.state.emailCode || '').trim();
    var code = String(raw).replace(/\D/g, '');
    if (!code || code.length < 4) {
      alert('Enter the 6-digit code from your email.');
      return;
    }
    var email = (this.state.contact.email || '').trim();
    this.ensureSession().then(function() {
      return post('/verify-email', {
        token: self.token,
        action: 'confirm',
        code: code,
        email: email
      });
    }).then(function(res) {
      if (!res || !res.ok) {
        alert((res && res.message) || 'Invalid or expired code. Tap Resend code and use the newest email.');
        return null;
      }
      if (res.summaryEmailSent) self.state.emailSummarySent = true;
      if (res.whitelisted || res.emailVerified) self.state.emailWhitelisted = true;
      return post('/calculate', { token: self.token, inputs: self.progress() });
    }).then(function(res) {
      if (res && res.ok) {
        self.state.quote = res.quote;
        self.state.session = res.session;
        if (res.emailVerification && res.emailVerification.whitelisted) {
          self.state.emailWhitelisted = true;
        }
        // Stay on Your Details so verification UI does not leak onto other steps.
        var steps = self.steps();
        var contactIdx = steps.indexOf('contact');
        if (contactIdx >= 0) self.state.step = contactIdx;
        self.render();
      }
    }).catch(function() {
      alert('Could not verify that code. Please try again.');
    });
  };

  OnlineQuoteWidget.prototype.sendPortalAccess = function() {
    var self = this;
    var emailInp = this.el.querySelector('[data-field="portalAccessEmail"]');
    var email = ((emailInp && emailInp.value) || this.state.portalAccessEmail || '').trim().toLowerCase();
    if (!email || email.indexOf('@') < 3) {
      this.state.portalAccessMsg = 'Enter a valid email address.';
      this.render();
      return;
    }
    this.state.portalAccessEmail = email;
    this.state.portalAccessMsg = 'Sending link…';
    this.render();
    post('/portal-access', { slug: this.slug, email: email }).then(function(res) {
      if (!res || res.ok === false) {
        self.state.portalAccessMsg = (res && res.message) || 'Could not send a link. Try again shortly.';
      } else {
        self.state.portalAccessMsg = (res && res.message) ||
          'If we have quotes for that email, we just sent a private access link. Check your inbox (and spam).';
      }
      self.render();
    }).catch(function() {
      self.state.portalAccessMsg = 'Could not send a link. Try again shortly.';
      self.render();
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
      self.state.jobsPortalUrl = res.jobsPortalUrl || null;
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
      '.online-quote{padding-top:clamp(48px,6vw,80px);padding-bottom:clamp(52px,7vw,88px);box-sizing:border-box}',
      '.online-quote .in{padding-top:12px;padding-bottom:16px;box-sizing:border-box}',
      '.online-quote .section-head{max-width:62ch;margin-bottom:8px}',
      '.online-quote .eyebrow,.online-quote .ey{font-family:"Barlow",system-ui,-apple-system,sans-serif;font-weight:700;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--oq-eyebrow,var(--pipe,var(--accent,inherit)));margin:0}',
      '.online-quote .section-head h2,.online-quote>.in>h2,.online-quote .in>.section-head>h2{font-family:"Barlow Condensed","Barlow",system-ui,sans-serif;font-size:clamp(32px,4.4vw,52px);font-weight:800;letter-spacing:-.01em;text-transform:uppercase;margin:10px 0 0;line-height:1.1;color:var(--oq-heading,inherit)}',
      '.online-quote .section-head p,.online-quote .intro{margin:13px 0 0;font-size:18px;font-weight:500;line-height:1.45;color:var(--oq-intro,var(--muted,var(--ink-soft,inherit)));max-width:62ch}',
      /* Global readable type scale for the whole quote wizard */
      '.lp-oq-card{--lp-oq-fs:16px;--lp-oq-fs-lead:16px;--lp-oq-fs-label:14px;--lp-oq-fs-muted:15px;--lp-oq-cal-icon:#000000;--lp-oq-card-min:640px;--lp-oq-body-min:520px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:var(--lp-oq-fs);line-height:1.45;width:100%;max-width:100%;box-sizing:border-box;border:1px solid var(--lp-oq-panel-border,color-mix(in srgb,' + brand + ' 28%, var(--line, var(--border, currentColor))));border-radius:16px;padding:22px;background:var(--lp-oq-panel-bg,transparent);color:var(--lp-oq-body,var(--ink, var(--text, inherit)));display:flex;flex-direction:column;min-height:var(--lp-oq-card-min)}',
      '.lp-oq-title{margin:0 0 8px;font-size:1.35rem;color:var(--lp-oq-panel-title,var(--ink, var(--text, inherit)))}',
      '.lp-oq-intro,.lp-oq-lead,.lp-oq-plan p,.lp-oq-staff-row>p,.lp-oq-cal-hint,.lp-oq-quote p{font-size:var(--lp-oq-fs-lead)!important;line-height:1.5;color:var(--lp-oq-intro,var(--ink-soft, var(--text-soft, inherit)));margin:0 0 10px}',
      '.lp-oq-muted{font-size:var(--lp-oq-fs-lead)!important;line-height:1.5;color:var(--lp-oq-muted,var(--ink-soft, var(--text-soft, inherit)))}',
      '.lp-oq-plan p.lp-oq-muted,.lp-oq-staff-row>p.lp-oq-muted{margin:0 0 10px}',
      '.lp-oq-nav{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-bottom:16px;width:100%;box-sizing:border-box}',
      '.lp-oq-steps{display:flex;flex-wrap:wrap;gap:8px;flex:1 1 auto;min-width:0;margin:0}',
      /* Progress chips match Back / Continue / Get my quote size */
      '.lp-oq-step{display:inline-flex;align-items:center;justify-content:center;font-size:inherit;line-height:1.2;padding:10px 18px;border-radius:8px;border:1px solid var(--lp-oq-step-border,color-mix(in srgb,' + brand + ' 22%, var(--line, var(--border, currentColor))));background:var(--lp-oq-step-bg,transparent);color:var(--lp-oq-step-text,var(--ink-soft, var(--text-soft, inherit)));text-transform:capitalize;font-weight:600;box-sizing:border-box}',
      '.lp-oq-step.is-active{background:var(--lp-oq-step-active-bg,' + brand + ');border-color:var(--lp-oq-step-active-border,var(--lp-oq-step-active-bg,' + brand + '));color:var(--lp-oq-step-active-text,var(--accent-text, var(--on-pipe, var(--ink))))}',
      '.lp-oq-step.is-done{background:transparent;border-color:var(--lp-oq-step-done-border,color-mix(in srgb,' + brand + ' 40%, var(--line, var(--border, currentColor))));color:var(--lp-oq-step-done-text,' + brand + ')}',
      '.lp-oq-access-toggle{margin-left:auto;flex:0 0 auto;white-space:nowrap;font-size:var(--lp-oq-fs-lead)!important;background:var(--lp-oq-access-btn-bg,var(--lp-oq-btn-bg,' + brand + '));color:var(--lp-oq-access-btn-text,var(--lp-oq-btn-text,var(--accent-text, var(--on-pipe, #fff))));border:1px solid var(--lp-oq-access-btn-border,var(--lp-oq-access-btn-bg,var(--lp-oq-btn-bg,' + brand + ')))}',
      '.lp-oq-access-backdrop{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(8,10,14,.62);box-sizing:border-box}',
      '.lp-oq-access-dialog{width:min(420px,100%);padding:20px 22px;border-radius:16px;border:1px solid var(--lp-oq-access-pop-border,color-mix(in srgb,' + brand + ' 35%, var(--line, var(--border, currentColor))));background:var(--lp-oq-access-pop-bg,var(--lp-oq-panel-bg,var(--panel,#1c181c)));color:var(--lp-oq-access-pop-text,#ffffff);box-shadow:0 22px 60px rgba(0,0,0,.45);box-sizing:border-box}',
      '.lp-oq-access-title{margin:0 0 8px;font-size:1.2rem;font-weight:800;color:var(--lp-oq-access-pop-title,var(--lp-oq-access-pop-text,#ffffff))}',
      '.lp-oq-access-lead,.lp-oq-access-msg{margin:0 0 12px;font-size:var(--lp-oq-fs-lead)!important;line-height:1.5;color:var(--lp-oq-access-pop-text,#ffffff)}',
      '.lp-oq-access-msg{margin:12px 0 0}',
      '.lp-oq-access-field{margin-top:4px}',
      '.lp-oq-access-field>span{color:var(--lp-oq-access-pop-label,var(--lp-oq-label,' + brand + '))}',
      '.lp-oq-access-field input{background:var(--lp-oq-access-pop-field-bg,var(--lp-oq-field-bg,var(--input-bg,transparent)));color:var(--lp-oq-access-pop-field-text,var(--lp-oq-field-text,var(--ink,inherit)));border-color:var(--lp-oq-access-pop-field-border,var(--line-strong, var(--border-strong, currentColor)))}',
      '.lp-oq-access-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}',
      '.lp-oq-access-send{background:var(--lp-oq-access-pop-btn-bg,var(--lp-oq-btn-bg,' + brand + '));color:var(--lp-oq-access-pop-btn-text,var(--lp-oq-btn-text,var(--accent-text, var(--on-pipe, #fff))));border:1px solid var(--lp-oq-access-pop-btn-bg,var(--lp-oq-btn-bg,' + brand + '))}',
      '.lp-oq-access-cancel{background:var(--lp-oq-access-pop-cancel-bg,transparent);color:var(--lp-oq-access-pop-cancel-text,var(--lp-oq-access-pop-text,#ffffff));border:1px solid var(--lp-oq-access-pop-cancel-border,color-mix(in srgb,' + brand + ' 40%, var(--line, var(--border, currentColor))))}',
      '@media (max-width:720px){.lp-oq-access-toggle{margin-left:0;width:100%;justify-content:center}}',
      '.lp-oq-choice{display:block;width:100%;text-align:left;margin:0 0 8px;padding:12px 14px;border:1px solid color-mix(in srgb,' + brand + ' 22%, var(--line, var(--border, currentColor)));border-radius:12px;background:transparent;color:var(--lp-oq-choice-text,var(--ink, var(--text, inherit)));cursor:pointer;font:inherit;box-sizing:border-box}',
      '.lp-oq-choice strong{color:inherit}',
      '.lp-oq-choice .lp-oq-ic{display:inline-flex;vertical-align:middle;margin-right:8px;color:' + brand + '}',
      '.lp-oq-choice .lp-oq-ic svg{width:18px;height:18px}',
      '.lp-oq-choice-img{display:block;margin:0 0 8px;border-radius:8px;object-fit:contain;max-width:100%}',
      layoutRules,
      /* Stable body height keeps Continue from jumping between steps */
      '.lp-oq-body{flex:1 1 auto;min-height:var(--lp-oq-body-min);overflow:visible;width:100%;box-sizing:border-box}',
      '.lp-oq-head{flex:0 0 auto}',
      /* Two-column contact + event layouts */
      '.lp-oq-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;align-items:start;width:100%;box-sizing:border-box}',
      '.lp-oq-col{min-width:0}',
      '.lp-oq-col-title{margin:0 0 8px;font-size:var(--lp-oq-fs-label);font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--lp-oq-label,var(--ink-soft,inherit))}',
      '.lp-oq-cols-contact{align-items:start}',
      '.lp-oq-cols-contact .lp-oq-col-contact .lp-oq-field:first-child,.lp-oq-cols-contact .lp-oq-col-aside>.lp-oq-field:first-child{margin-top:0}',
      '.lp-oq-cols-contact .lp-oq-col-aside{padding:0;border:none;background:transparent;border-radius:0}',
      '.lp-oq-cols-contact .lp-oq-quote{margin-top:14px;padding-top:14px;border-top:1px solid color-mix(in srgb,' + brand + ' 18%, var(--line, var(--border, currentColor)))}',
      '.lp-oq-quote-slot{min-height:80px}',
      '.lp-oq-cols-event .lp-oq-plan{margin-top:0}',
      '.lp-oq-event-extra{margin-top:14px}',
      '@media (max-width:720px){.lp-oq-cols{grid-template-columns:1fr}.lp-oq-card{min-height:0}.lp-oq-hours-row,.lp-oq-shift-row{grid-template-columns:1fr}}',
      /* Compact date picker + themed popup calendar */
      '.lp-oq-cal-ic{display:block;color:var(--lp-oq-cal-icon,#000);flex-shrink:0}',
      '.lp-oq-datepick{position:relative;min-width:0;flex:1 1 auto}',
      '.lp-oq-datepick-trigger{appearance:none;width:100%;display:flex;align-items:center;gap:10px;text-align:left;cursor:pointer;padding:8px 12px;border-radius:10px;border:1px solid var(--line-strong, var(--border-strong, currentColor));background:var(--lp-oq-field-bg,var(--input-bg,transparent));color:var(--lp-oq-field-text,var(--ink,inherit));font:inherit;box-sizing:border-box}',
      '.lp-oq-datepick-trigger:hover{border-color:' + brand + '}',
      '.lp-oq-datepick.is-open .lp-oq-datepick-trigger{border-color:' + brand + ';box-shadow:0 0 0 2px color-mix(in srgb,' + brand + ' 28%,transparent)}',
      '.lp-oq-datepick-ic{display:flex;align-items:center;justify-content:center}',
      '.lp-oq-datepick-meta{display:flex;flex-direction:column;gap:1px;min-width:0}',
      '.lp-oq-datepick-label{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--lp-oq-label,var(--ink-soft,inherit))}',
      '.lp-oq-datepick-value{font-size:var(--lp-oq-fs);font-weight:600;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.lp-oq-datepick-value.is-empty{font-weight:500;opacity:.72}',
      '.lp-oq-cal-pop{position:absolute;z-index:40;top:calc(100% + 6px);left:0;width:min(280px,92vw);padding:12px;border-radius:14px;border:1px solid var(--lp-oq-cal-pop-border,color-mix(in srgb,' + brand + ' 35%, var(--line, var(--border, currentColor))));background:var(--lp-oq-cal-pop-bg,var(--lp-oq-panel-bg,var(--panel,#1c181c)));color:var(--lp-oq-body,inherit);box-shadow:0 18px 48px rgba(0,0,0,.45);box-sizing:border-box}',
      '.lp-oq-cal-nav{display:flex;align-items:center;justify-content:space-between;gap:4px;margin-bottom:8px}',
      '.lp-oq-cal-month{font-weight:700;font-size:14px;color:var(--lp-oq-body,inherit)}',
      '.lp-oq-cal-nav-btn{appearance:none;border:1px solid color-mix(in srgb,' + brand + ' 28%, var(--line, var(--border, currentColor)));background:transparent;color:var(--lp-oq-body,inherit);width:30px;height:30px;border-radius:8px;font-size:16px;line-height:1;cursor:pointer}',
      '.lp-oq-cal-nav-btn:hover{border-color:' + brand + ';color:' + brand + '}',
      '.lp-oq-cal-weekdays{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px;margin-bottom:4px;text-align:center;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--lp-oq-muted,var(--ink-soft,inherit))}',
      '.lp-oq-cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px}',
      '.lp-oq-cal-day{appearance:none;border:0;border-radius:8px;aspect-ratio:1;min-height:0;height:auto;font:inherit;font-size:12px;font-weight:600;cursor:pointer;background:transparent;color:var(--lp-oq-body,inherit);padding:0}',
      '.lp-oq-cal-day:hover{background:color-mix(in srgb,' + brand + ' 16%, transparent)}',
      '.lp-oq-cal-day.is-muted{opacity:.35;font-weight:500}',
      '.lp-oq-cal-day.is-today{box-shadow:inset 0 0 0 1.5px color-mix(in srgb,' + brand + ' 55%, transparent)}',
      '.lp-oq-cal-day.is-selected{background:var(--lp-oq-btn-bg,' + brand + ');color:var(--lp-oq-btn-text,var(--accent-text, var(--on-pipe, #fff)));box-shadow:none}',
      '.lp-oq-cal-day.is-selected.is-today{box-shadow:none}',
      '.lp-oq-cal-hint{margin:6px 0 0}',
      /* Simple hours: date + duration on one row */
      '.lp-oq-hours-row{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(110px,.7fr);gap:10px;align-items:end;margin-top:8px}',
      '.lp-oq-hours-field{margin:0}',
      /* Multi-day compact rows — equal-height date + time controls */
      '.lp-oq-shifts{display:flex;flex-direction:column;gap:8px;margin-top:4px}',
      '.lp-oq-shift-row{display:grid;grid-template-columns:44px minmax(0,1.35fr) minmax(0,.9fr) minmax(0,.9fr) 36px;gap:8px;align-items:end;margin:0;padding:8px;border:1px solid color-mix(in srgb,' + brand + ' 18%, var(--line, var(--border, currentColor)));border-radius:12px;border-style:solid;background:color-mix(in srgb,' + brand + ' 4%, transparent)}',
      '.lp-oq-shift-day{font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--lp-oq-label,inherit);align-self:center;padding-bottom:10px}',
      '.lp-oq-datepick-row{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.lp-oq-datepick-row>.lp-oq-datepick-label{display:block;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--lp-oq-label,var(--ink-soft,inherit));line-height:1.2}',
      '.lp-oq-datepick-row .lp-oq-datepick-trigger{height:42px;min-height:42px;padding:0 10px;gap:8px}',
      '.lp-oq-datepick-row .lp-oq-datepick-meta{flex-direction:row;align-items:center}',
      '.lp-oq-datepick-row .lp-oq-datepick-value{font-size:14px;line-height:1.2}',
      '.lp-oq-time{position:relative;display:flex;flex-direction:column;gap:2px;min-width:0;margin:0}',
      '.lp-oq-time-label{font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--lp-oq-label,var(--ink-soft,inherit));line-height:1.2}',
      '.lp-oq-time-ic{position:absolute;left:10px;bottom:12px;pointer-events:none;display:flex;align-items:center}',
      '.lp-oq-time input[type=time]{width:100%;height:42px;min-height:42px;padding:0 10px 0 34px;border:1px solid var(--line-strong, var(--border-strong, currentColor));border-radius:10px;font:inherit;font-size:14px;line-height:1.2;background:var(--lp-oq-field-bg,var(--input-bg,transparent));color:var(--lp-oq-field-text,var(--ink,inherit));box-sizing:border-box;color-scheme:dark}',
      '.lp-oq-shift-remove{min-width:36px;width:36px;height:42px;padding:0;border-radius:10px;font-size:18px;line-height:1;align-self:end}',
      '.lp-oq-shift-spacer{width:36px;height:42px}',
      '.lp-oq-shift-add{margin-top:8px}',
      /* Packages / add-ons / travel: horizontal row for cards + grid layouts */
      '.lp-oq-layout-cards .lp-oq-choices:not(.lp-oq-fp-grid):not(.lp-oq-bev-grid),.lp-oq-layout-grid .lp-oq-choices:not(.lp-oq-fp-grid):not(.lp-oq-bev-grid){display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;width:100%}',
      '.lp-oq-layout-cards .lp-oq-choices:not(.lp-oq-fp-grid) .lp-oq-choice,.lp-oq-layout-grid .lp-oq-choices:not(.lp-oq-fp-grid) .lp-oq-choice{width:auto;margin:0;height:100%}',
      /* Drinks + catering share one forced 2-up grid (headers span full width) */
      '.lp-oq-layout-cards .lp-oq-choices.lp-oq-bev-grid,.lp-oq-layout-grid .lp-oq-choices.lp-oq-bev-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px;width:100%;align-items:stretch}',
      '.lp-oq-choices.lp-oq-bev-grid>.lp-oq-bev-group{grid-column:1/-1}',
      '@media (max-width:640px){.lp-oq-layout-cards .lp-oq-choices.lp-oq-bev-grid,.lp-oq-layout-grid .lp-oq-choices.lp-oq-bev-grid{grid-template-columns:1fr!important}}',
      '.lp-oq-choice.is-selected{border-color:' + brand + ';box-shadow:0 0 0 2px color-mix(in srgb,' + brand + ' 30%, transparent)}',
      '.lp-oq-field{display:block;margin:10px 0 0}',
      '.lp-oq-field span{display:block;font-size:var(--lp-oq-fs-label);font-weight:600;color:var(--lp-oq-label,var(--ink-soft, var(--text-soft, inherit)));margin-bottom:4px}',
      '.lp-oq-field input,.lp-oq-field select{width:100%;padding:10px 12px;border:1px solid var(--line-strong, var(--border-strong, currentColor));border-radius:10px;font:inherit;font-size:var(--lp-oq-fs);background:var(--lp-oq-field-bg,var(--input-bg, var(--panel, transparent)));color:var(--lp-oq-field-text,var(--ink, var(--text, inherit)));box-sizing:border-box}',
      '.lp-oq-field textarea,.lp-oq-field-textarea textarea{display:block;width:100%;min-width:0;max-width:100%;min-height:6.5em;padding:10px 12px;border:1px solid var(--line-strong, var(--border-strong, currentColor));border-radius:10px;font:inherit;font-size:var(--lp-oq-fs);line-height:1.45;background:transparent;color:var(--lp-oq-field-text,var(--ink, var(--text, inherit)));box-sizing:border-box;resize:vertical}',
      '.lp-oq-radio{display:inline-flex;align-items:center;gap:8px;margin:0 12px 8px 0;font-size:var(--lp-oq-fs-lead);line-height:1.35;color:var(--lp-oq-body,inherit);vertical-align:middle}',
      '.lp-oq-radio input[type=radio]{margin:0;flex-shrink:0}',
      '.lp-oq-radio-hint{display:inline;margin:0;padding:0;font-size:inherit;font-weight:500;line-height:inherit;vertical-align:baseline;color:var(--lp-oq-muted,var(--ink-soft,inherit));opacity:.9}',
      '.lp-oq-staff-count{display:flex;flex-direction:column;align-items:flex-start;gap:6px}',
      '.lp-oq-staff-count .lp-oq-radio{margin:0;display:flex}',
      '.lp-oq-check{display:flex;align-items:center;gap:8px;margin:10px 0 0;font-size:var(--lp-oq-fs-lead);color:var(--lp-oq-body,inherit)}',
      '.lp-oq-plan{border:1px solid color-mix(in srgb,' + brand + ' 18%, var(--line, var(--border, currentColor)));border-radius:12px;padding:12px;margin-top:12px;color:var(--lp-oq-body,inherit)}',
      '.lp-oq-plan legend{font-size:var(--lp-oq-fs-label);font-weight:700;padding:0 4px;color:var(--lp-oq-label,inherit)}',
      '.lp-oq-quote h3{margin:0 0 8px;font-size:1.1rem}',
      '.lp-oq-choice span{display:block;font-size:var(--lp-oq-fs-muted);color:var(--lp-oq-choice-desc,var(--ink-soft, var(--text-soft, inherit)));margin-top:4px}',
      '.lp-oq-foot{display:flex;gap:8px;margin-top:auto;padding-top:16px;flex-wrap:wrap;flex-shrink:0}',
      '.lp-oq-btn{display:inline-flex;align-items:center;justify-content:center;padding:10px 18px;border:none;border-radius:8px;background:var(--lp-oq-btn-bg,' + brand + ');color:var(--lp-oq-btn-text,var(--accent-text, var(--on-pipe, var(--ink))));font-weight:600;cursor:pointer;font:inherit;line-height:1.2;box-sizing:border-box}',
      '.lp-oq-btn-ghost{background:var(--lp-oq-btn-ghost-bg,transparent);color:var(--lp-oq-btn-ghost-text,' + brand + ');border:1px solid var(--lp-oq-btn-ghost-border,color-mix(in srgb,' + brand + ' 40%, var(--line, var(--border, currentColor))))}',
      '.lp-oq-quote{margin-top:18px;padding-top:18px;border-top:1px solid color-mix(in srgb,' + brand + ' 18%, var(--line, var(--border, currentColor)))}',
      '.lp-oq-total{font-size:1.6rem;font-weight:800;margin:0 0 8px;color:var(--lp-oq-body,var(--ink, var(--text, inherit)))}',
      '.lp-oq-lines{list-style:none;padding:0;margin:12px 0 0}',
      '.lp-oq-lines li{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid color-mix(in srgb, var(--ink-soft, var(--text-soft, currentColor)) 25%, transparent);font-size:var(--lp-oq-fs-lead);color:var(--lp-oq-body,var(--ink, var(--text, inherit)))}',
      '.lp-oq-error{color:var(--danger, #b42318)}',
      '.lp-oq-loading{color:var(--lp-oq-muted,var(--ink-soft, var(--text-soft, inherit)))}',
      '.lp-oq-shift,.lp-oq-cart,.lp-oq-staff-row{border:1px dashed color-mix(in srgb,' + brand + ' 22%, var(--line, var(--border, currentColor)));border-radius:10px;padding:10px;margin:10px 0;color:var(--lp-oq-body,inherit)}',
      '.lp-oq-shift.lp-oq-shift-row{border-style:solid;margin:0}',
      '.lp-oq-cart-head,.lp-oq-staff-label{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;color:var(--lp-oq-body,inherit);font-size:var(--lp-oq-fs-lead)}',
      '.lp-oq-product-qty{margin-top:8px}',
      '.lp-oq-product-qty input:disabled{opacity:.45}',
      '.lp-oq-shift-remove,.lp-oq-cart-remove{font-size:var(--lp-oq-fs-label);padding:4px 10px}'
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
  window.LPOnlineQuoteWidget = OnlineQuoteWidget;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
