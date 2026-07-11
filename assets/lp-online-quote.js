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

  function OnlineQuoteWidget(el) {
    this.el = el;
    this.slug = (el.getAttribute('data-slug') || '').trim().toLowerCase();
    this.token = null;
    this.shell = null;
    this.state = {
      step: 0,
      productId: '',
      hours: 3,
      guestCount: 50,
      beverageId: '',
      addonIds: [],
      travelZoneId: '',
      contact: { name: '', email: '', phone: '' },
      quote: null,
      session: null,
      portalUrl: null,
      pdfUrl: null,
      emailCodeSent: false
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

  OnlineQuoteWidget.prototype.steps = function() {
    return (this.shell.wizard && this.shell.wizard.steps) || ['equipment', 'beverages', 'addons', 'contact'];
  };

  OnlineQuoteWidget.prototype.render = function() {
    var steps = this.steps();
    var stepKey = steps[this.state.step] || 'contact';
    var biz = (this.shell.business && this.shell.business.name) || 'Get your quote';
    var html = '<div class="lp-oq-card">' +
      '<div class="lp-oq-head"><h2 class="lp-oq-title">' + esc(biz) + '</h2>' +
      '<div class="lp-oq-steps">' + steps.map(function(s, i) {
        return '<span class="lp-oq-step' + (i === this.state.step ? ' is-active' : (i < this.state.step ? ' is-done' : '')) + '">' + esc(s) + '</span>';
      }, this).join('') + '</div></div>' +
      '<div class="lp-oq-body">' + this.renderStep(stepKey) + '</div>' +
      '<div class="lp-oq-foot">' + this.renderFooter(stepKey, steps) + '</div>' +
      (this.state.quote ? this.renderQuotePanel() : '') +
      '</div>';
    this.el.innerHTML = html;
    this.wire(stepKey);
  };

  OnlineQuoteWidget.prototype.renderStep = function(key) {
    var s = this.state;
    if (key === 'equipment' || key === 'products' || key === 'event') {
      var products = this.shell.products || [];
      return '<p class="lp-oq-intro">Choose your setup.</p>' +
        products.map(function(p) {
          var sel = s.productId === p.id ? ' is-selected' : '';
          return '<button type="button" class="lp-oq-choice' + sel + '" data-pick="productId" data-val="' + esc(p.id) + '">' +
            '<strong>' + esc(p.label) + '</strong>' +
            (p.description ? '<span>' + esc(p.description) + '</span>' : '') +
            '</button>';
        }).join('') +
        '<label class="lp-oq-field"><span>Event duration (hours)</span>' +
        '<input type="number" min="1" max="24" data-field="hours" value="' + esc(s.hours) + '"></label>';
    }
    if (key === 'beverages') {
      var bevs = this.shell.beverages || [];
      return '<p class="lp-oq-intro">Guest count and beverage package.</p>' +
        '<label class="lp-oq-field"><span>Expected guests</span>' +
        '<input type="number" min="1" max="5000" data-field="guestCount" value="' + esc(s.guestCount) + '"></label>' +
        bevs.map(function(b) {
          var sel = s.beverageId === b.id ? ' is-selected' : '';
          return '<button type="button" class="lp-oq-choice' + sel + '" data-pick="beverageId" data-val="' + esc(b.id) + '">' +
            '<strong>' + esc(b.label) + '</strong>' +
            (b.description ? '<span>' + esc(b.description) + '</span>' : '') +
            '</button>';
        }).join('');
    }
    if (key === 'addons') {
      var addons = this.shell.addons || [];
      if (!addons.length) return '<p class="lp-oq-muted">No add-ons for this quote.</p>';
      return '<p class="lp-oq-intro">Optional extras.</p>' +
        addons.map(function(a) {
          var on = s.addonIds.indexOf(a.id) >= 0 ? ' is-selected' : '';
          return '<button type="button" class="lp-oq-choice lp-oq-multi' + on + '" data-addon="' + esc(a.id) + '">' +
            '<strong>' + esc(a.label) + '</strong>' +
            (a.description ? '<span>' + esc(a.description) + '</span>' : '') +
            '</button>';
        }).join('');
    }
    return '<p class="lp-oq-intro">Your details to receive the quote.</p>' +
      '<label class="lp-oq-field"><span>Name</span><input data-field="contact.name" value="' + esc(s.contact.name) + '"></label>' +
      '<label class="lp-oq-field"><span>Email</span><input type="email" data-field="contact.email" value="' + esc(s.contact.email) + '"></label>' +
      '<label class="lp-oq-field"><span>Mobile</span><input type="tel" data-field="contact.phone" placeholder="0414 631 463" value="' + esc(s.contact.phone) + '"></label>';
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
      html += '<p>' + esc(q.message || 'Verify your email to see your total.') + '</p>' +
        '<div class="lp-oq-verify"><button type="button" class="lp-oq-btn" data-act="send-email">' +
        (this.state.emailCodeSent ? 'Resend verification code' : 'Email me a verification code') +
        '</button></div>';
      if (this.state.emailCodeSent) {
        html += '<p class="lp-oq-muted" style="font-size:13px;margin:8px 0 0">Check your inbox for a 6-digit code.</p>';
      }
      html += '<label class="lp-oq-field"><span>Email verification code</span>' +
        '<input data-field="emailCode" placeholder="6-digit code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" value="' + esc(this.state.emailCode || '') + '"></label>' +
        '<button type="button" class="lp-oq-btn" data-act="confirm-email" style="margin-top:10px">Confirm email code</button>';
    } else if (q.level === 'email_verified_total') {
      html += '<p class="lp-oq-total">' + esc(q.totalFormatted || '') + ' <small>inc GST</small></p>' +
        (this.state.emailSummarySent ? '<p class="lp-oq-muted" style="font-size:13px">A summary was emailed to you. Complete SMS below for the full PDF.</p>' : '') +
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
    this.el.querySelectorAll('[data-pick]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var key = btn.getAttribute('data-pick');
        self.state[key] = btn.getAttribute('data-val');
        self.render();
      });
    });
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
        } else if (f === 'hours' || f === 'guestCount') self.state[f] = parseInt(v, 10) || 0;
        else self.state[f] = v;
      });
    });
    this.el.querySelectorAll('[data-act]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var act = btn.getAttribute('data-act');
        if (act === 'back') { self.state.step--; self.render(); }
        else if (act === 'next') { self.state.step++; self.render(); }
        else if (act === 'calculate') self.calculate();
        else if (act === 'send-email') self.sendEmail();
        else if (act === 'confirm-email') self.confirmEmail();
        else if (act === 'send-sms') self.sendSms();
        else if (act === 'confirm-sms') self.confirmSms();
      });
    });
  };

  OnlineQuoteWidget.prototype.ensureSession = function() {
    var self = this;
    var inputs = {
      productId: this.state.productId,
      hours: this.state.hours,
      guestCount: this.state.guestCount,
      beverageId: this.state.beverageId,
      addonIds: this.state.addonIds,
      travelZoneId: this.state.travelZoneId
    };
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
    this.el.querySelector('.lp-oq-body').innerHTML = '<p class="lp-oq-muted">Calculating…</p>';
    this.ensureSession().then(function() {
      return post('/calculate', {
        token: self.token,
        inputs: {
          productId: self.state.productId,
          hours: self.state.hours,
          guestCount: self.state.guestCount,
          beverageId: self.state.beverageId,
          addonIds: self.state.addonIds,
          travelZoneId: self.state.travelZoneId
        }
      });
    }).then(function(res) {
      if (!res.ok) throw new Error(res.error || 'calculate');
      self.state.quote = res.quote;
      self.state.session = res.session;
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
    if (document.getElementById('lp-oq-styles')) return;
    var css = document.createElement('style');
    css.id = 'lp-oq-styles';
    css.textContent = [
      '.lp-oq-card{font-family:system-ui,-apple-system,Segoe UI,sans-serif;border:1px solid color-mix(in srgb,var(--pipe,#1f7a63) 25%,#e5e7eb);border-radius:16px;padding:20px;background:var(--panel,#fff);color:var(--ink,#1c2330)}',
      '.lp-oq-title{margin:0 0 8px;font-size:1.35rem}',
      '.lp-oq-steps{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}',
      '.lp-oq-step{font-size:11px;padding:4px 10px;border-radius:999px;background:#f3f4f6;color:#6b7280;text-transform:capitalize}',
      '.lp-oq-step.is-active{background:var(--pipe,#1f7a63);color:#fff}',
      '.lp-oq-step.is-done{background:color-mix(in srgb,var(--pipe,#1f7a63) 20%,#fff);color:var(--pipe,#1f7a63)}',
      '.lp-oq-choice{display:block;width:100%;text-align:left;margin:0 0 8px;padding:12px 14px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;cursor:pointer}',
      '.lp-oq-choice.is-selected{border-color:var(--pipe,#1f7a63);box-shadow:0 0 0 2px color-mix(in srgb,var(--pipe,#1f7a63) 25%,transparent)}',
      '.lp-oq-choice span{display:block;font-size:13px;color:#6b7280;margin-top:4px}',
      '.lp-oq-field{display:block;margin:10px 0 0}',
      '.lp-oq-field span{display:block;font-size:12px;color:#6b7280;margin-bottom:4px}',
      '.lp-oq-field input{width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:10px;font:inherit}',
      '.lp-oq-foot{display:flex;gap:8px;margin-top:16px}',
      '.lp-oq-btn{padding:10px 18px;border:none;border-radius:10px;background:var(--pipe,#1f7a63);color:#fff;font-weight:600;cursor:pointer}',
      '.lp-oq-btn-ghost{background:transparent;color:var(--pipe,#1f7a63);border:1px solid color-mix(in srgb,var(--pipe,#1f7a63) 40%,#e5e7eb)}',
      '.lp-oq-quote{margin-top:18px;padding-top:18px;border-top:1px solid #eef0f2}',
      '.lp-oq-total{font-size:1.6rem;font-weight:800;margin:0 0 8px}',
      '.lp-oq-lines{list-style:none;padding:0;margin:12px 0 0}',
      '.lp-oq-lines li{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:14px}',
      '.lp-oq-muted{color:#6b7280}.lp-oq-error{color:#b42318}.lp-oq-loading{color:#6b7280}'
    ].join('');
    document.head.appendChild(css);
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
