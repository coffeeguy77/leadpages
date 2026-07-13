/**
 * Shared Partner Website section renderers — all themes consume these.
 */

const { esc, demoPreviewUrl } = require('../partner-templates/shared');
const { publicPartnerIntro, publicPhotoAlt, placeholderInitial } = require('./public-identity');

function trustBar(content, className) {
  if (!content.visibility || content.visibility.trust === false) return '';
  const items = (content.trust || []).filter(function(t) { return t && t.label; });
  if (!items.length) return '';
  const cls = className || 'pt-trust';
  return '<section class="' + cls + '"><div class="pt-wrap"><div class="pt-trust-grid">'
    + items.map(function(t) {
      return '<div class="pt-trust-item"><strong>' + esc(t.label) + '</strong><span>' + esc(t.value) + '</span></div>';
    }).join('')
    + '</div></div></section>';
}

function industriesSection(content) {
  if (!content.visibility || content.visibility.industries === false) return '';
  const list = content.industries || [];
  if (!list.length) return '';
  return '<section class="pt-industries" id="industries"><div class="pt-wrap">'
    + '<p class="pt-eyebrow">Businesses we help</p>'
    + '<h2 class="pt-section-title">Industries &amp; local businesses</h2>'
    + '<div class="pt-industry-tags">'
    + list.map(function(i) { return '<span class="pt-industry-tag">' + esc(i) + '</span>'; }).join('')
    + '</div></div></section>';
}

function demosSection(content, opts) {
  if (!content.visibility || content.visibility.demos === false) return '';
  const demos = content.demos || [];
  if (!demos.length) return '';
  opts = opts || {};
  const cardClass = opts.cardClass || 'pt-demo-card';
  return '<section class="pt-demos" id="demos"><div class="pt-wrap">'
    + '<p class="pt-eyebrow">Live showcase</p>'
    + '<h2 class="pt-section-title">See what we can build</h2>'
    + '<p class="pt-section-sub">Explore live website demos in your browser before deciding what is right for your business.</p>'
    + '<div class="pt-demo-grid">'
    + demos.map(function(d) {
      const bg = d.thumbnailColor ? ' style="background:' + esc(d.thumbnailColor) + '"' : '';
      return '<article class="' + cardClass + '">'
        + '<a class="pt-demo-img" href="' + esc(d.url) + '" target="_blank" rel="noopener"' + bg + '>'
        + '<img src="' + esc(d.thumbnail) + '" alt="' + esc(d.name) + '" loading="lazy" style="object-fit:' + esc(d.thumbnailFit || 'cover') + '"></a>'
        + '<div class="pt-demo-body">'
        + '<span class="pt-demo-cat">' + esc(d.industry) + '</span>'
        + '<h3><a href="' + esc(d.url) + '" target="_blank" rel="noopener">' + esc(d.name) + '</a></h3>'
        + (d.description ? '<p>' + esc(d.description) + '</p>' : '')
        + (d.features.length ? '<ul class="pt-demo-feats">' + d.features.map(function(f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' : '')
        + '<div class="pt-demo-actions">'
        + '<a class="pt-btn pt-btn-primary pt-btn-sm" href="' + esc(d.url) + '" target="_blank" rel="noopener">' + esc(d.ctaExplore) + '</a>'
        + '<a class="pt-btn pt-btn-ghost pt-btn-sm" href="#contact" data-demo-ref="' + esc(d.slug) + '">' + esc(d.ctaBuild) + '</a>'
        + '</div></div></article>';
    }).join('')
    + '</div></div></section>';
}

function servicesSection(content) {
  if (!content.visibility || content.visibility.services === false) return '';
  const services = content.services || [];
  if (!services.length) return '';
  return '<section class="pt-services" id="services"><div class="pt-wrap">'
    + '<p class="pt-eyebrow">What we offer</p>'
    + '<h2 class="pt-section-title">Website services for your business</h2>'
    + '<div class="pt-services-grid">'
    + services.map(function(s) {
      return '<article class="pt-service-card' + (s.featured ? ' is-featured' : '') + '">'
        + (s.featured ? '<span class="pt-service-badge">Popular</span>' : '')
        + '<h3>' + esc(s.name) + '</h3>'
        + '<p>' + esc(s.description) + '</p>'
        + (s.personalNote ? '<p class="pt-service-note">' + esc(s.personalNote) + '</p>' : '')
        + '<span class="pt-service-price">' + esc(s.priceLabel) + '</span>'
        + '<a class="pt-btn pt-btn-outline pt-btn-sm" href="#contact">Enquire</a>'
        + '</article>';
    }).join('')
    + '</div></div></section>';
}

function benefitsSection(content) {
  if (!content.visibility || content.visibility.included === false) return '';
  const benefits = content.benefits || [];
  return '<section class="pt-benefits" id="included"><div class="pt-wrap">'
    + '<p class="pt-eyebrow">What is included</p>'
    + '<h2 class="pt-section-title">More than a good-looking website</h2>'
    + '<p class="pt-section-highlight">A <em>complete business system</em>.</p>'
    + '<div class="pt-benefits-grid">'
    + benefits.map(function(b, i) {
      return '<article><span class="pt-benefit-num">' + String(i + 1).padStart(2, '0') + '</span>'
        + '<h3>' + esc(b.title) + '</h3><p>' + esc(b.body) + '</p></article>';
    }).join('')
    + '</div></div></section>';
}

function processSection(content) {
  if (!content.visibility || content.visibility.process === false) return '';
  const steps = content.process || [];
  return '<section class="pt-process" id="process"><div class="pt-wrap">'
    + '<p class="pt-eyebrow">How it works</p>'
    + '<h2 class="pt-section-title">From first conversation to launch</h2>'
    + '<div class="pt-process-steps">'
    + steps.map(function(s) {
      return '<article class="pt-process-step"><span class="pt-process-num">' + s.step + '</span>'
        + '<h3>' + esc(s.title) + '</h3><p>' + esc(s.description) + '</p></article>';
    }).join('')
    + '</div></div></section>';
}

function biographySection(content) {
  if (!content.visibility || content.visibility.biography === false) return '';
  const b = content.biography || {};
  const p = content.partner || {};
  const c = content.contact || {};
  if (!b.shortIntro && !b.fullBio) return '';
  const intro = p.publicIntro || publicPartnerIntro(p.agencyName, p.displayName, { displaySurnamePublicly: false });
  const agencyHeading = intro.agencyHeading || p.agencyName || 'Your agency';
  const contactLine = intro.contactLine || null;
  const brand = p.agencyName || agencyHeading;
  const photoAlt = publicPhotoAlt(p.displayName, brand, { displaySurnamePublicly: false });
  const placeholder = placeholderInitial(brand, p.displayName, { displaySurnamePublicly: false });
  return '<section class="pt-biography" id="partner"><div class="pt-wrap pt-bio-grid">'
    + '<div class="pt-bio-photo">'
    + (p.headshotUrl
      ? '<img src="' + esc(p.headshotUrl) + '" alt="' + esc(photoAlt) + '" class="pt-bio-headshot">'
      : '<div class="pt-bio-placeholder" aria-hidden="true"><span>' + esc(placeholder) + '</span></div>')
    + '</div>'
    + '<div class="pt-bio-copy">'
    + '<p class="pt-eyebrow">Meet your local website partner</p>'
    + '<h2 class="pt-section-title">' + esc(agencyHeading) + '</h2>'
    + (contactLine ? '<p class="pt-bio-contact-line">' + esc(contactLine) + '</p>' : '')
    + '<p class="pt-bio-agency">' + esc(p.agencyName) + (content.serviceArea && content.serviceArea.primaryRegion ? ' · ' + esc(content.serviceArea.primaryRegion) : '') + '</p>'
    + (b.shortIntro ? '<p class="pt-bio-intro">' + esc(b.shortIntro) + '</p>' : '')
    + (b.fullBio ? '<div class="pt-bio-full">' + esc(b.fullBio).replace(/\n/g, '<br>') + '</div>' : '')
    + (b.workingStyle ? '<p class="pt-bio-style"><strong>How I work:</strong> ' + esc(b.workingStyle) + '</p>' : '')
    + (b.whyPartner ? '<p class="pt-bio-why"><strong>Why I became a LeadPages Partner:</strong> ' + esc(b.whyPartner) + '</p>' : '')
    + '<div class="pt-bio-meta">'
    + (b.yearsExperience ? '<span>' + esc(b.yearsExperience) + ' experience</span>' : '')
    + (b.languages ? '<span>' + esc(b.languages) + '</span>' : '')
    + (b.qualifications ? '<span>' + esc(b.qualifications) + '</span>' : '')
    + '</div>'
    + '<div class="pt-bio-contact">'
    + (c.phone ? '<a class="pt-btn pt-btn-outline" href="tel:' + c.phone.replace(/[^+0-9]/g, '') + '">' + esc(c.phone) + '</a>' : '')
    + (c.email ? '<a class="pt-btn pt-btn-outline" href="mailto:' + esc(c.email) + '">Email ' + esc(p.firstName || p.publicName || 'us') + '</a>' : '')
    + (c.bookingUrl ? '<a class="pt-btn pt-btn-primary" href="' + esc(c.bookingUrl) + '" target="_blank" rel="noopener">Book consultation</a>' : '<a class="pt-btn pt-btn-primary" href="#contact">Plan my website</a>')
    + '</div></div></div></section>';
}

function serviceAreaSection(content) {
  if (!content.visibility || content.visibility.serviceArea === false) return '';
  const sa = content.serviceArea || {};
  const areas = sa.areas || [];
  if (!areas.length && !sa.primaryRegion) return '';
  return '<section class="pt-service-area" id="areas"><div class="pt-wrap">'
    + '<p class="pt-eyebrow">Service area</p>'
    + '<h2 class="pt-section-title">' + esc(sa.headline || 'Where we work') + '</h2>'
    + '<div class="pt-area-tags">'
    + (areas.length ? areas.map(function(a) { return '<span class="pt-area-tag">' + esc(a.label) + '</span>'; }).join('')
      : '<span class="pt-area-tag">' + esc(sa.primaryRegion) + '</span>')
    + '</div>'
    + '<p class="pt-area-note">'
    + (sa.remoteAvailable ? 'Remote projects welcome. ' : '')
    + (sa.inPersonAvailable !== false ? 'In-person meetings available.' : '')
    + '</p></div></section>';
}

function platformBackingSection(content) {
  if (!content.visibility || content.visibility.platformBacking === false) return '';
  const pb = content.platformBacking || {};
  const p = content.partner || {};
  const c = content.contact || {};
  const intro = p.publicIntro || publicPartnerIntro(p.agencyName, p.displayName, { displaySurnamePublicly: false });
  const contactHeading = intro.contactLine
    || (p.firstName ? 'Work directly with ' + p.firstName : intro.agencyHeading);
  return '<section class="pt-support" id="support"><div class="pt-wrap">'
    + '<div class="pt-support-grid">'
    + '<article class="pt-support-card pt-support-local">'
    + '<span class="pt-support-tag">Local partner</span>'
    + '<h3>' + esc(contactHeading) + ' — your direct contact</h3>'
    + '<p>' + esc(pb.personalStatement) + ' ' + esc(pb.localStatement) + '</p>'
    + (c.email ? '<a class="pt-btn pt-btn-outline" href="mailto:' + esc(c.email) + '">Email ' + esc(p.firstName || p.publicName || 'us') + '</a>' : '')
    + (c.phone ? '<a class="pt-btn pt-btn-outline" href="tel:' + c.phone.replace(/[^+0-9]/g, '') + '">' + esc(c.phone) + '</a>' : '')
    + '</article>'
    + '<article class="pt-support-card pt-support-platform">'
    + '<span class="pt-support-tag">Platform backup</span>'
    + '<h3>' + esc(pb.heading) + '</h3>'
    + '<p>' + esc(pb.copy) + '</p>'
    + '<ul class="pt-support-list">' + (pb.bullets || []).map(function(b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>'
    + '</article></div></div></section>';
}

function testimonialsSection(content) {
  if (!content.visibility || content.visibility.testimonials === false) return '';
  const list = content.testimonials || [];
  if (!list.length) return '';
  return '<section class="pt-testimonials" id="testimonials"><div class="pt-wrap">'
    + '<p class="pt-eyebrow">What clients say</p>'
    + '<h2 class="pt-section-title">Trusted by local businesses</h2>'
    + '<div class="pt-testimonial-grid">'
    + list.map(function(t) {
      return '<blockquote class="pt-testimonial-card">'
        + (t.isPlatform ? '<span class="pt-testimonial-src">' + esc(t.attribution || 'LeadPages platform') + '</span>' : '')
        + '<p>&ldquo;' + esc(t.text) + '&rdquo;</p>'
        + '<footer><strong>' + esc(t.customerName || 'Client') + '</strong>'
        + (t.businessName ? '<span>' + esc(t.businessName) + '</span>' : '')
        + (t.location ? '<span>' + esc(t.location) + '</span>' : '')
        + '</footer></blockquote>';
    }).join('')
    + '</div></div></section>';
}

function caseStudiesSection(content) {
  if (!content.visibility || content.visibility.caseStudies === false) return '';
  const list = content.caseStudies || [];
  if (!list.length) return '';
  return '<section class="pt-cases" id="cases"><div class="pt-wrap">'
    + '<p class="pt-eyebrow">Case studies</p>'
    + '<h2 class="pt-section-title">Recent projects</h2>'
    + '<div class="pt-cases-grid">'
    + list.map(function(c) {
      return '<article class="pt-case-card">'
        + (c.afterImage ? '<img src="' + esc(c.afterImage) + '" alt="" loading="lazy" class="pt-case-img">' : '')
        + '<div class="pt-case-body">'
        + '<span class="pt-case-industry">' + esc(c.industry || '') + '</span>'
        + '<h3>' + esc(c.clientName) + '</h3>'
        + (c.challenge ? '<p><strong>Challenge:</strong> ' + esc(c.challenge) + '</p>' : '')
        + (c.solution ? '<p><strong>Solution:</strong> ' + esc(c.solution) + '</p>' : '')
        + (c.result ? '<p><strong>Result:</strong> ' + esc(c.result) + '</p>' : '')
        + (c.websiteUrl ? '<a href="' + esc(c.websiteUrl) + '" target="_blank" rel="noopener">View site</a>' : '')
        + '</div></article>';
    }).join('')
    + '</div></div></section>';
}

function faqsSection(content) {
  if (!content.visibility || content.visibility.faqs === false) return '';
  const faqs = content.faqs || [];
  if (!faqs.length) return '';
  return '<section class="pt-faqs" id="faqs"><div class="pt-wrap">'
    + '<p class="pt-eyebrow">Questions</p>'
    + '<h2 class="pt-section-title">Frequently asked questions</h2>'
    + '<div class="pt-faq-list">'
    + faqs.map(function(f, i) {
      return '<details class="pt-faq-item"' + (i === 0 ? ' open' : '') + '>'
        + '<summary>' + esc(f.question) + '</summary>'
        + '<p>' + esc(f.answer) + '</p></details>';
    }).join('')
    + '</div></div></section>';
}

function leadOfferSection(content) {
  const offer = content.leadOffer || {};
  if (!offer.enabled || !content.visibility || content.visibility.leadOffer === false) return '';
  return '<section class="pt-lead-offer" id="review"><div class="pt-wrap">'
    + '<div class="pt-lead-offer-card">'
    + '<h2>' + esc(offer.title) + '</h2>'
    + '<p>' + esc(offer.description || 'Send us your current website and your local partner will review its mobile usability, messaging, calls to action and opportunities to generate more enquiries.') + '</p>'
    + '<a class="pt-btn pt-btn-primary" href="#contact" data-offer="review">' + esc(offer.ctaLabel) + '</a>'
    + '</div></div></section>';
}

function metricsBar(content) {
  const m = content.metrics || {};
  const items = [];
  if (m.partnerProjectsCompleted) items.push({ v: m.partnerProjectsCompleted, l: 'Projects' });
  if (m.partnerBusinessesSupported) items.push({ v: m.partnerBusinessesSupported, l: 'Businesses supported' });
  if (m.typicalResponseTime) items.push({ v: m.typicalResponseTime, l: 'Response time' });
  if (!items.length) return '';
  return '<div class="pt-metrics"><div class="pt-wrap"><div class="pt-metrics-grid">'
    + items.map(function(it) { return '<div><strong>' + esc(it.v) + '</strong><span>' + esc(it.l) + '</span></div>'; }).join('')
    + '</div></div></div>';
}

function enquiryForm(content, opts) {
  opts = opts || {};
  const cls = opts.className || 'pt-lead-form pt-enquiry-form';
  const c = content.contact || {};
  const ef = content.enquiryForm || {};
  const showExt = ef.showExtended !== false;
  const goals = ef.goals || [];
  const features = ef.features || [];

  let html = '<form class="' + cls + '" data-pl-lead-form data-pl-kind="partner-consultation" data-pl-extended="1" method="post" action="#">'
    + '<h3>' + esc(opts.title || 'Plan your website') + '</h3>'
    + '<p class="pt-form-sub">' + esc(opts.subtitle || 'Tell us about your business — we respond within one business day.') + '</p>'
    + '<div class="pt-form-grid">'
    + '<label><span>Name *</span><input name="name" type="text" required></label>'
    + '<label><span>Email</span><input name="email" type="email"></label>'
    + '<label><span>Phone</span><input name="phone" type="tel"></label>'
    + '<label><span>Business name</span><input name="businessName" type="text"></label>';

  if (showExt) {
    html += '<label><span>Existing website</span><input name="existingWebsite" type="url" placeholder="https://"></label>'
      + '<label><span>Industry</span><input name="industry" type="text"></label>'
      + '<label><span>Suburb / region</span><input name="suburb" type="text"></label>'
      + '<label><span>New site or redesign?</span><select name="projectType"><option value="">Choose…</option><option>New website</option><option>Redesign</option><option>Not sure</option></select></label>'
      + '<label class="pt-form-full"><span>Main goal</span><select name="mainGoal"><option value="">Choose…</option>'
      + goals.map(function(g) { return '<option>' + esc(g) + '</option>'; }).join('') + '</select></label>'
      + '<label class="pt-form-full"><span>Features needed</span><select name="features" multiple size="4">'
      + features.map(function(f) { return '<option>' + esc(f) + '</option>'; }).join('') + '</select></label>'
      + '<label><span>Approx. budget</span><select name="budget"><option value="">Prefer not to say</option><option>Under $2,000</option><option>$2,000–$5,000</option><option>$5,000–$10,000</option><option>$10,000+</option></select></label>'
      + '<label><span>Launch timeframe</span><select name="timeframe"><option value="">Flexible</option><option>ASAP</option><option>1–3 months</option><option>3–6 months</option></select></label>'
      + '<label><span>Preferred contact</span><select name="contactMethod"><option>Email</option><option>Phone</option><option>Either</option></select></label>';
  }

  html += '</div>'
    + '<label class="pt-form-full"><span>Message</span><textarea name="message" rows="4" placeholder="Tell us what you need"></textarea></label>'
    + '<label class="pt-form-consent"><input type="checkbox" name="consent" required> I agree to be contacted about my website enquiry.</label>'
    + '<button class="pt-btn pt-btn-primary" type="submit">' + esc(c.ctaLabel || 'Send enquiry') + '</button>'
    + '<p class="pl-form-err"></p><p class="pl-form-ok" hidden>Thanks — we\'ll be in touch shortly.</p>'
    + '</form>';
  return html;
}

function contactSection(content, opts) {
  if (!content.visibility || content.visibility.contact === false) return '';
  opts = opts || {};
  const sectionCls = opts.sectionClass ? esc(opts.sectionClass) + ' ' : '';
  const p = content.partner || {};
  const c = content.contact || {};
  const social = content.social || {};
  let socialHtml = '';
  if (social.linkedin) socialHtml += '<a href="' + esc(social.linkedin) + '" target="_blank" rel="noopener">LinkedIn</a>';
  if (social.facebook) socialHtml += '<a href="' + esc(social.facebook) + '" target="_blank" rel="noopener">Facebook</a>';
  if (social.instagram) socialHtml += '<a href="' + esc(social.instagram) + '" target="_blank" rel="noopener">Instagram</a>';
  if (social.googleBusiness) socialHtml += '<a href="' + esc(social.googleBusiness) + '" target="_blank" rel="noopener">Google</a>';

  const intro = p.publicIntro || publicPartnerIntro(p.agencyName, p.displayName, { displaySurnamePublicly: false });
  const contactHeading = intro.agencyHeading || p.agencyName || 'Your local LeadPages Partner';

  return '<section class="' + sectionCls + 'pt-contact" id="contact"><div class="pt-wrap pt-contact-grid">'
    + '<div class="pt-contact-info">'
    + '<p class="pt-eyebrow">Get in touch</p>'
    + '<h2 class="pt-section-title">' + esc(contactHeading) + '</h2>'
    + '<p>Your local LeadPages partner — backed by secure hosting and platform support.</p>'
    + '<ul class="pt-contact-list">'
    + (c.email ? '<li><strong>Email</strong> <a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></li>' : '')
    + (c.phone ? '<li><strong>Phone</strong> <a href="tel:' + c.phone.replace(/[^+0-9]/g, '') + '">' + esc(c.phone) + '</a></li>' : '')
    + (c.contactHours ? '<li><strong>Hours</strong> ' + esc(c.contactHours) + '</li>' : '')
    + (c.responseTime ? '<li><strong>Response</strong> ' + esc(c.responseTime) + '</li>' : '')
    + '</ul>'
    + (socialHtml ? '<nav class="pt-social">' + socialHtml + '</nav>' : '')
    + '<div class="pt-lp-disclosure">'
    + '<span class="pt-lp-disclosure-logo leadpages-logo" data-lp-logo="auto" data-lp-logo-ink="auto" data-lp-logo-pulse="false" role="img" aria-label="LeadPages"></span>'
    + '<span class="pt-lp-disclosure-text">Your website runs on LeadPages platform infrastructure with local partner support.</span>'
    + '</div>'
    + '</div>'
    + enquiryForm(content, opts)
    + '</div></section>';
}

function allSections(content, opts) {
  return ''
    + trustBar(content)
    + industriesSection(content)
    + demosSection(content, opts)
    + servicesSection(content)
    + benefitsSection(content)
    + processSection(content)
    + caseStudiesSection(content)
    + biographySection(content)
    + serviceAreaSection(content)
    + platformBackingSection(content)
    + testimonialsSection(content)
    + faqsSection(content)
    + leadOfferSection(content)
    + contactSection(content, opts);
}

module.exports = {
  trustBar, industriesSection, demosSection, servicesSection, benefitsSection,
  processSection, biographySection, serviceAreaSection, platformBackingSection,
  testimonialsSection, caseStudiesSection, faqsSection, leadOfferSection,
  metricsBar, enquiryForm, contactSection, allSections
};
