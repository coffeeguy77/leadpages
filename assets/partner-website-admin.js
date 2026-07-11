/**
 * Partner Website profile editor — tabs, completion score, section saves.
 */
(function(global) {
  'use strict';

  var state = {
    authHeader: null,
    websiteProfile: null,
    platform: null,
    completion: null,
    activeTab: 'overview',
    dirty: false,
    loading: false
  };

  var TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'positioning', label: 'Hero & pitch' },
    { id: 'biography', label: 'Biography' },
    { id: 'location', label: 'Service area' },
    { id: 'services', label: 'Services' },
    { id: 'testimonials', label: 'Testimonials' },
    { id: 'caseStudies', label: 'Case studies' },
    { id: 'faqs', label: 'FAQs' },
    { id: 'contact', label: 'Contact' },
    { id: 'social', label: 'Social' },
    { id: 'seo', label: 'SEO' },
    { id: 'visibility', label: 'Sections' }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function $(id) { return document.getElementById(id); }

  function wp() { return state.websiteProfile || {}; }

  function field(label, id, value, opts) {
    opts = opts || {};
    var type = opts.type || 'text';
    var hint = opts.hint ? '<p class="muted" style="font-size:12px;margin:6px 0 0">' + esc(opts.hint) + '</p>' : '';
    if (type === 'textarea') {
      return '<div class="field"><label for="' + id + '">' + esc(label) + '</label>'
        + '<textarea id="' + id + '" rows="' + (opts.rows || 3) + '" placeholder="' + esc(opts.placeholder || '') + '">' + esc(value || '') + '</textarea>'
        + hint + '</div>';
    }
    if (type === 'checkbox') {
      return '<label style="display:inline-flex;align-items:center;gap:8px;font-weight:600;margin:0">'
        + '<input type="checkbox" id="' + id + '"' + (value ? ' checked' : '') + ' style="width:auto"> '
        + esc(label) + '</label>';
    }
    return '<div class="field"><label for="' + id + '">' + esc(label) + '</label>'
      + '<input id="' + id + '" type="' + type + '" value="' + esc(value || '') + '" placeholder="' + esc(opts.placeholder || '') + '">'
      + hint + '</div>';
  }

  function completionHtml() {
    var c = state.completion || { overall: 0, groups: [], actions: [] };
    var groups = (c.groups || []).map(function(g) {
      return '<div class="pwp-score-item"><span class="pwp-score-label">' + esc(g.label) + '</span>'
        + '<div class="pwp-score-bar"><span style="width:' + g.percent + '%"></span></div>'
        + '<span class="pwp-score-pct">' + g.percent + '%</span></div>';
    }).join('');
    var actions = (c.actions || []).slice(0, 5).map(function(a) {
      return '<li>' + esc(a.label) + '</li>';
    }).join('');
    return '<div class="pwp-completion">'
      + '<div class="pwp-completion-head"><strong>Profile completion</strong><span class="pwp-completion-overall">' + c.overall + '%</span></div>'
      + '<div class="pwp-score-grid">' + groups + '</div>'
      + (actions ? '<ul class="pwp-actions muted">' + actions + '</ul>' : '')
      + '</div>';
  }

  function tabNav() {
    return '<nav class="pwp-tabs" role="tablist" aria-label="Website profile sections">'
      + TABS.map(function(t) {
        var on = t.id === state.activeTab ? ' is-active' : '';
        return '<button type="button" class="pwp-tab' + on + '" role="tab" data-pwp-tab="' + t.id + '" aria-selected="' + (on ? 'true' : 'false') + '">' + esc(t.label) + '</button>';
      }).join('')
      + '</nav>';
  }

  function panelOverview() {
    var c = state.completion || {};
    return '<div class="pwp-panel" data-pwp-panel="overview">'
      + '<p class="muted" style="margin:0 0 16px;font-size:14px">Personalise your public partner page — biography, services, testimonials, and enquiry form. All seven page designs use this same content.</p>'
      + completionHtml()
      + '<div class="pwp-overview-grid">'
      + field('Agency / trading name', 'pwp-agency', wp().identity && wp().identity.agencyName, { hint: 'Shown in hero, footer, and SEO.' })
      + field('Profile photo URL', 'pwp-headshot', wp().identity && wp().identity.headshotUrl, { placeholder: 'https://…' })
      + '</div>'
      + '</div>';
  }

  function panelPositioning() {
    var p = wp().positioning || {};
    return '<div class="pwp-panel" data-pwp-panel="positioning">'
      + '<p class="muted" style="margin:0 0 16px">Hero copy for your partner page. Headline and intro above still work as fallbacks.</p>'
      + '<div class="row2">'
      + field('Eyebrow', 'pwp-hero-eyebrow', p.heroEyebrow, { placeholder: 'LeadPages partner' })
      + field('Highlight phrase', 'pwp-hero-highlight', p.heroHighlight, { placeholder: 'e.g. that get you booked' })
      + '</div>'
      + field('Hero headline', 'pwp-hero-headline', p.heroHeadline, { placeholder: 'Websites for Canberra trades' })
      + field('Supporting text', 'pwp-hero-supporting', p.heroSupporting, { type: 'textarea', rows: 4 })
      + '<div class="row2">'
      + field('Primary CTA', 'pwp-primary-cta', p.primaryCta, { placeholder: 'Plan my website' })
      + field('Secondary CTA', 'pwp-secondary-cta', p.secondaryCta, { placeholder: 'See live demos' })
      + '</div>'
      + field('Partner promise', 'pwp-partner-promise', p.partnerPromise, { type: 'textarea', rows: 2 })
      + field('Local credibility', 'pwp-local-cred', p.localCredibilityStatement, { type: 'textarea', rows: 2 })
      + field('Platform backing', 'pwp-platform-back', p.platformBackingStatement, { type: 'textarea', rows: 3 })
      + '</div>';
  }

  function panelBiography() {
    var b = wp().biography || {};
    var e = wp().experience || {};
    return '<div class="pwp-panel hidden" data-pwp-panel="biography">'
      + field('Short intro', 'pwp-short-intro', b.shortIntro, { type: 'textarea', rows: 2, hint: 'Shown in hero and about sections (max 240 chars).' })
      + field('Full biography', 'pwp-full-bio', b.fullBio, { type: 'textarea', rows: 6 })
      + '<div class="row2">'
      + field('Years experience', 'pwp-years-exp', b.yearsExperience)
      + field('Professional background', 'pwp-prof-bg', b.professionalBackground)
      + '</div>'
      + field('Why LeadPages partner', 'pwp-why-partner', b.whyPartner, { type: 'textarea', rows: 3 })
      + field('Working style', 'pwp-working-style', b.workingStyle, { type: 'textarea', rows: 3 })
      + field('Industries worked', 'pwp-industries-worked', b.industriesWorked)
      + '<div class="row2">'
      + field('Years in business', 'pwp-years-biz', e.yearsInBusiness)
      + field('Years in web', 'pwp-years-web', e.yearsInWeb)
      + '</div>'
      + field('Industry specialisations (comma-separated)', 'pwp-specs', (e.industrySpecialisations || []).join(', '))
      + '</div>';
  }

  function panelLocation() {
    var l = wp().location || {};
    var areas = (l.serviceAreas || []).map(function(a) { return a.label; }).join('\n');
    return '<div class="pwp-panel hidden" data-pwp-panel="location">'
      + field('Service region headline', 'pwp-region-headline', l.serviceRegionHeadline, { placeholder: 'Serving Canberra & surrounds' })
      + '<div class="row2">'
      + field('Primary suburb', 'pwp-suburb', l.primarySuburb)
      + field('State', 'pwp-state', l.state)
      + '</div>'
      + field('Service areas (one per line)', 'pwp-areas', areas, { type: 'textarea', rows: 5 })
      + '<div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:12px">'
      + field('Remote available', 'pwp-remote', l.remoteAvailable, { type: 'checkbox' })
      + field('In-person available', 'pwp-inperson', l.inPersonAvailable !== false, { type: 'checkbox' })
      + '</div>'
      + '</div>';
  }

  function panelServices() {
    var selections = {};
    (wp().serviceSelections || []).forEach(function(s) { selections[s.serviceKey] = s; });
    var rows = (state.platform && state.platform.services || []).map(function(def) {
      var sel = selections[def.key] || {};
      var enabled = sel.enabled !== undefined ? sel.enabled : (def.featured !== false);
      return '<div class="pwp-service-row">'
        + '<label class="pwp-service-check"><input type="checkbox" data-pwp-svc="' + esc(def.key) + '" data-pwp-svc-field="enabled"' + (enabled ? ' checked' : '') + '> <strong>' + esc(def.name) + '</strong></label>'
        + '<p class="muted" style="margin:4px 0 8px;font-size:12.5px">' + esc(def.description) + '</p>'
        + '<input type="text" data-pwp-svc="' + esc(def.key) + '" data-pwp-svc-field="personalNote" placeholder="Personal note (optional)" value="' + esc(sel.personalNote || '') + '" style="width:100%;margin-bottom:8px">'
        + '<label style="display:inline-flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" data-pwp-svc="' + esc(def.key) + '" data-pwp-svc-field="featured"' + (sel.featured ? ' checked' : '') + ' style="width:auto"> Feature on page</label>'
        + '</div>';
    }).join('');
    return '<div class="pwp-panel hidden" data-pwp-panel="services">'
      + '<p class="muted" style="margin:0 0 16px">Choose which platform services you offer. Add a personal note to stand out.</p>'
      + '<div class="pwp-service-list">' + rows + '</div>'
      + '</div>';
  }

  function testimonialRow(t, i) {
    t = t || {};
    return '<div class="pwp-repeat" data-pwp-testimonial="' + i + '">'
      + '<div class="row2">'
      + field('Customer name', 'pwp-t-name-' + i, t.customerName)
      + field('Business', 'pwp-t-biz-' + i, t.businessName)
      + '</div>'
      + '<div class="row2">'
      + field('Role', 'pwp-t-role-' + i, t.role)
      + field('Location', 'pwp-t-loc-' + i, t.location)
      + '</div>'
      + field('Testimonial', 'pwp-t-text-' + i, t.text, { type: 'textarea', rows: 3 })
      + field('Featured', 'pwp-t-feat-' + i, t.featured, { type: 'checkbox' })
      + '<button type="button" class="btn" data-pwp-remove-testimonial="' + i + '" style="margin-top:8px;padding:6px 12px;font-size:13px">Remove</button>'
      + '</div>';
  }

  function panelTestimonials() {
    var list = wp().testimonials || [];
    if (!list.length) list = [{}];
    return '<div class="pwp-panel hidden" data-pwp-panel="testimonials">'
      + '<p class="muted" style="margin:0 0 16px">Add client testimonials. They appear once saved — platform fallbacks show until you add your own.</p>'
      + '<div id="pwp-testimonials">' + list.map(testimonialRow).join('') + '</div>'
      + '<button type="button" class="btn" id="pwp-add-testimonial" style="margin-top:12px">Add testimonial</button>'
      + '</div>';
  }

  function caseStudyRow(c, i) {
    c = c || {};
    return '<div class="pwp-repeat" data-pwp-case="' + i + '">'
      + field('Client name', 'pwp-c-name-' + i, c.clientName)
      + '<div class="row2">'
      + field('Industry', 'pwp-c-ind-' + i, c.industry)
      + field('Website URL', 'pwp-c-url-' + i, c.websiteUrl)
      + '</div>'
      + field('Challenge', 'pwp-c-chal-' + i, c.challenge, { type: 'textarea', rows: 2 })
      + field('Solution', 'pwp-c-sol-' + i, c.solution, { type: 'textarea', rows: 2 })
      + field('Result', 'pwp-c-res-' + i, c.result, { type: 'textarea', rows: 2 })
      + field('Featured', 'pwp-c-feat-' + i, c.featured, { type: 'checkbox' })
      + '<button type="button" class="btn" data-pwp-remove-case="' + i + '" style="margin-top:8px;padding:6px 12px;font-size:13px">Remove</button>'
      + '</div>';
  }

  function panelCaseStudies() {
    var list = wp().caseStudies || [];
    if (!list.length) list = [{}];
    return '<div class="pwp-panel hidden" data-pwp-panel="caseStudies">'
      + '<p class="muted" style="margin:0 0 16px">Showcase projects you have delivered for local businesses.</p>'
      + '<div id="pwp-cases">' + list.map(caseStudyRow).join('') + '</div>'
      + '<button type="button" class="btn" id="pwp-add-case" style="margin-top:12px">Add case study</button>'
      + '</div>';
  }

  function faqRow(f, i) {
    f = f || {};
    return '<div class="pwp-repeat" data-pwp-faq="' + i + '">'
      + field('Question', 'pwp-f-q-' + i, f.question)
      + field('Answer', 'pwp-f-a-' + i, f.answer, { type: 'textarea', rows: 3 })
      + field('Enabled', 'pwp-f-on-' + i, f.enabled !== false, { type: 'checkbox' })
      + '<button type="button" class="btn" data-pwp-remove-faq="' + i + '" style="margin-top:8px;padding:6px 12px;font-size:13px">Remove</button>'
      + '</div>';
  }

  function panelFaqs() {
    var list = wp().partnerFaqs || [];
    return '<div class="pwp-panel hidden" data-pwp-panel="faqs">'
      + '<p class="muted" style="margin:0 0 16px">Your own FAQs appear above platform FAQs on your page.</p>'
      + '<div id="pwp-faqs">' + (list.length ? list.map(faqRow).join('') : faqRow({}, 0)) + '</div>'
      + '<button type="button" class="btn" id="pwp-add-faq" style="margin-top:12px">Add FAQ</button>'
      + '</div>';
  }

  function panelContact() {
    var c = wp().contact || {};
    var e = wp().enquiryForm || {};
    var l = wp().leadOffer || {};
    return '<div class="pwp-panel hidden" data-pwp-panel="contact">'
      + '<h4 style="font-size:15px;margin:0 0 12px">Contact preferences</h4>'
      + '<div class="row2">'
      + field('CTA label', 'pwp-cta-label', c.ctaLabel)
      + field('Response time', 'pwp-response', c.responseTime, { placeholder: 'Usually within 24 hours' })
      + '</div>'
      + field('Contact hours', 'pwp-hours', c.contactHours)
      + field('Booking URL', 'pwp-booking', c.bookingUrl, { placeholder: 'https://calendly.com/…' })
      + '<h4 style="font-size:15px;margin:24px 0 12px">Lead offer</h4>'
      + field('Enable free review offer', 'pwp-offer-on', l.enabled, { type: 'checkbox' })
      + field('Offer title', 'pwp-offer-title', l.title)
      + field('Offer description', 'pwp-offer-desc', l.description, { type: 'textarea', rows: 2 })
      + '<h4 style="font-size:15px;margin:24px 0 12px">Enquiry form</h4>'
      + field('Show extended consultation fields', 'pwp-extended', e.showExtended !== false, { type: 'checkbox' })
      + '</div>';
  }

  function panelSocial() {
    var s = wp().social || {};
    return '<div class="pwp-panel hidden" data-pwp-panel="social">'
      + field('Google Business', 'pwp-soc-gmb', s.googleBusiness)
      + field('LinkedIn', 'pwp-soc-li', s.linkedin)
      + field('Facebook', 'pwp-soc-fb', s.facebook)
      + field('Instagram', 'pwp-soc-ig', s.instagram)
      + '</div>';
  }

  function panelSeo() {
    var s = wp().seo || {};
    return '<div class="pwp-panel hidden" data-pwp-panel="seo">'
      + field('Page title override', 'pwp-seo-title', s.titleOverride, { hint: 'Leave blank to auto-generate from your agency name and region.' })
      + field('Meta description', 'pwp-seo-desc', s.descriptionOverride, { type: 'textarea', rows: 3 })
      + field('Social share image URL', 'pwp-seo-og', s.ogImage)
      + '</div>';
  }

  function panelVisibility() {
    var v = wp().visibility || {};
    var keys = [
      ['hero', 'Hero'], ['trust', 'Trust bar'], ['demos', 'Live demos'], ['services', 'Services'],
      ['biography', 'Biography'], ['serviceArea', 'Service area'], ['testimonials', 'Testimonials'],
      ['caseStudies', 'Case studies'], ['faqs', 'FAQs'], ['leadOffer', 'Lead offer'], ['contact', 'Contact form']
    ];
    var checks = keys.map(function(pair) {
      var on = v[pair[0]] !== false;
      return '<label class="pwp-vis-item"><input type="checkbox" id="pwp-vis-' + pair[0] + '"' + (on ? ' checked' : '') + ' style="width:auto"> ' + esc(pair[1]) + '</label>';
    }).join('');
    return '<div class="pwp-panel hidden" data-pwp-panel="visibility">'
      + '<p class="muted" style="margin:0 0 16px">Toggle which sections appear on your public page.</p>'
      + '<div class="pwp-vis-grid">' + checks + '</div>'
      + '</div>';
  }

  function renderEditor() {
    var root = $('pwp-editor');
    if (!root) return;
    root.innerHTML = tabNav()
      + '<div class="pwp-panels">'
      + panelOverview()
      + panelPositioning()
      + panelBiography()
      + panelLocation()
      + panelServices()
      + panelTestimonials()
      + panelCaseStudies()
      + panelFaqs()
      + panelContact()
      + panelSocial()
      + panelSeo()
      + panelVisibility()
      + '</div>'
      + '<div class="save-row" style="margin-top:20px">'
      + '<button type="button" class="btn btn-brand" id="pwp-save">Save page content</button>'
      + '<span class="saved" id="pwp-saved">Saved ✓</span>'
      + '<span class="notice bad hidden" id="pwp-err" style="margin:0;padding:8px 12px"></span>'
      + '</div>';
    showTab(state.activeTab);
    wireEditor();
  }

  function showTab(id) {
    state.activeTab = id;
    document.querySelectorAll('.pwp-tab').forEach(function(btn) {
      var on = btn.getAttribute('data-pwp-tab') === id;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.pwp-panel').forEach(function(p) {
      var on = p.getAttribute('data-pwp-panel') === id;
      p.classList.toggle('hidden', !on);
    });
  }

  function val(id) {
    var el = $(id);
    if (!el) return '';
    if (el.type === 'checkbox') return el.checked;
    return (el.value || '').trim();
  }

  function collectProfile() {
    var areas = String(val('pwp-areas') || '').split(/\n/).map(function(s) { return s.trim(); }).filter(Boolean)
      .map(function(label) { return { label: label }; });
    var specs = String(val('pwp-specs') || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);

    var serviceSelections = [];
    document.querySelectorAll('[data-pwp-svc][data-pwp-svc-field="enabled"]').forEach(function(cb) {
      var key = cb.getAttribute('data-pwp-svc');
      var noteEl = document.querySelector('[data-pwp-svc="' + key + '"][data-pwp-svc-field="personalNote"]');
      var featEl = document.querySelector('[data-pwp-svc="' + key + '"][data-pwp-svc-field="featured"]');
      serviceSelections.push({
        serviceKey: key,
        enabled: cb.checked,
        personalNote: noteEl ? noteEl.value.trim() : '',
        featured: featEl ? featEl.checked : false
      });
    });

    var testimonials = [];
    document.querySelectorAll('[data-pwp-testimonial]').forEach(function(row) {
      var i = row.getAttribute('data-pwp-testimonial');
      var text = val('pwp-t-text-' + i);
      if (!text) return;
      testimonials.push({
        customerName: val('pwp-t-name-' + i),
        businessName: val('pwp-t-biz-' + i),
        role: val('pwp-t-role-' + i),
        location: val('pwp-t-loc-' + i),
        text: text,
        featured: val('pwp-t-feat-' + i),
        status: 'approved'
      });
    });

    var caseStudies = [];
    document.querySelectorAll('[data-pwp-case]').forEach(function(row) {
      var i = row.getAttribute('data-pwp-case');
      var name = val('pwp-c-name-' + i);
      if (!name) return;
      caseStudies.push({
        clientName: name,
        industry: val('pwp-c-ind-' + i),
        websiteUrl: val('pwp-c-url-' + i),
        challenge: val('pwp-c-chal-' + i),
        solution: val('pwp-c-sol-' + i),
        result: val('pwp-c-res-' + i),
        featured: val('pwp-c-feat-' + i),
        status: 'approved'
      });
    });

    var partnerFaqs = [];
    document.querySelectorAll('[data-pwp-faq]').forEach(function(row) {
      var i = row.getAttribute('data-pwp-faq');
      var q = val('pwp-f-q-' + i);
      var a = val('pwp-f-a-' + i);
      if (!q || !a) return;
      partnerFaqs.push({ question: q, answer: a, enabled: val('pwp-f-on-' + i) });
    });

    var visibility = {};
    ['hero', 'trust', 'demos', 'services', 'biography', 'serviceArea', 'testimonials', 'caseStudies', 'faqs', 'leadOffer', 'contact'].forEach(function(k) {
      visibility[k] = val('pwp-vis-' + k);
    });

    return {
      identity: {
        agencyName: val('pwp-agency'),
        headshotUrl: val('pwp-headshot')
      },
      positioning: {
        heroEyebrow: val('pwp-hero-eyebrow'),
        heroHeadline: val('pwp-hero-headline'),
        heroHighlight: val('pwp-hero-highlight'),
        heroSupporting: val('pwp-hero-supporting'),
        primaryCta: val('pwp-primary-cta'),
        secondaryCta: val('pwp-secondary-cta'),
        partnerPromise: val('pwp-partner-promise'),
        localCredibilityStatement: val('pwp-local-cred'),
        platformBackingStatement: val('pwp-platform-back')
      },
      biography: {
        shortIntro: val('pwp-short-intro'),
        fullBio: val('pwp-full-bio'),
        yearsExperience: val('pwp-years-exp'),
        professionalBackground: val('pwp-prof-bg'),
        whyPartner: val('pwp-why-partner'),
        workingStyle: val('pwp-working-style'),
        industriesWorked: val('pwp-industries-worked')
      },
      experience: {
        yearsInBusiness: val('pwp-years-biz'),
        yearsInWeb: val('pwp-years-web'),
        industrySpecialisations: specs
      },
      location: {
        serviceRegionHeadline: val('pwp-region-headline'),
        primarySuburb: val('pwp-suburb'),
        state: val('pwp-state'),
        serviceAreas: areas,
        remoteAvailable: val('pwp-remote'),
        inPersonAvailable: val('pwp-inperson')
      },
      contact: {
        ctaLabel: val('pwp-cta-label'),
        responseTime: val('pwp-response'),
        contactHours: val('pwp-hours'),
        bookingUrl: val('pwp-booking')
      },
      leadOffer: {
        enabled: val('pwp-offer-on'),
        title: val('pwp-offer-title'),
        description: val('pwp-offer-desc')
      },
      enquiryForm: {
        showExtended: val('pwp-extended')
      },
      social: {
        googleBusiness: val('pwp-soc-gmb'),
        linkedin: val('pwp-soc-li'),
        facebook: val('pwp-soc-fb'),
        instagram: val('pwp-soc-ig')
      },
      seo: {
        titleOverride: val('pwp-seo-title'),
        descriptionOverride: val('pwp-seo-desc'),
        ogImage: val('pwp-seo-og')
      },
      visibility: visibility,
      serviceSelections: serviceSelections,
      testimonials: testimonials,
      caseStudies: caseStudies,
      partnerFaqs: partnerFaqs
    };
  }

  async function saveProfile() {
    var err = $('pwp-err');
    var btn = $('pwp-save');
    if (!state.authHeader || state.loading) return;
    err.classList.add('hidden');
    btn.disabled = true;
    state.loading = true;
    try {
      var r = await fetch('/api/partner/website-profile', {
        method: 'POST',
        headers: Object.assign({ 'content-type': 'application/json' }, await state.authHeader()),
        body: JSON.stringify({ section: 'all', websiteProfile: collectProfile() })
      });
      var j = await r.json();
      if (!j.ok) {
        err.textContent = j.error || 'Could not save.';
        err.classList.remove('hidden');
        return;
      }
      state.websiteProfile = j.websiteProfile;
      state.completion = j.completion;
      var sv = $('pwp-saved');
      if (sv) { sv.classList.add('show'); setTimeout(function() { sv.classList.remove('show'); }, 1700); }
      renderEditor();
    } catch (_e) {
      err.textContent = 'Network error — please try again.';
      err.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      state.loading = false;
    }
  }

  var wired = false;
  function wireEditor() {
    if (wired) return;
    wired = true;
    var root = $('pwp-editor');
    if (!root) return;
    root.addEventListener('click', function(e) {
      var tab = e.target.closest('[data-pwp-tab]');
      if (tab) { showTab(tab.getAttribute('data-pwp-tab')); return; }
      if (e.target.id === 'pwp-save' || e.target.closest('#pwp-save')) { saveProfile(); return; }
      if (e.target.id === 'pwp-add-testimonial') {
        var box = $('pwp-testimonials');
        var i = box.querySelectorAll('[data-pwp-testimonial]').length;
        box.insertAdjacentHTML('beforeend', testimonialRow({}, i));
        return;
      }
      if (e.target.id === 'pwp-add-case') {
        var cbox = $('pwp-cases');
        var ci = cbox.querySelectorAll('[data-pwp-case]').length;
        cbox.insertAdjacentHTML('beforeend', caseStudyRow({}, ci));
        return;
      }
      if (e.target.id === 'pwp-add-faq') {
        var fbox = $('pwp-faqs');
        var fi = fbox.querySelectorAll('[data-pwp-faq]').length;
        fbox.insertAdjacentHTML('beforeend', faqRow({}, fi));
        return;
      }
      var rmT = e.target.getAttribute('data-pwp-remove-testimonial');
      if (rmT != null) { var tr = e.target.closest('[data-pwp-testimonial]'); if (tr) tr.remove(); return; }
      var rmC = e.target.getAttribute('data-pwp-remove-case');
      if (rmC != null) { var cr = e.target.closest('[data-pwp-case]'); if (cr) cr.remove(); return; }
      var rmF = e.target.getAttribute('data-pwp-remove-faq');
      if (rmF != null) { var fr = e.target.closest('[data-pwp-faq]'); if (fr) fr.remove(); return; }
    });
  }

  async function load(opts) {
    opts = opts || {};
    state.authHeader = opts.authHeader;
    var root = $('pwp-editor');
    if (!root) return;
    root.innerHTML = '<p class="muted" style="font-size:13px">Loading page content editor…</p>';
    try {
      var r = await fetch('/api/partner/website-profile', { headers: await state.authHeader() });
      var j = await r.json();
      if (!j.ok) {
        root.innerHTML = '<p class="notice bad" style="margin:0">' + esc(j.error || 'Could not load profile.') + '</p>';
        return;
      }
      state.websiteProfile = j.websiteProfile;
      state.platform = j.platform;
      state.completion = j.completion;
      renderEditor();
    } catch (_e) {
      root.innerHTML = '<p class="notice bad" style="margin:0">Could not load page content editor.</p>';
    }
  }

  global.LPPartnerWebsiteAdmin = { load: load, collectProfile: collectProfile };
})(typeof window !== 'undefined' ? window : global);
