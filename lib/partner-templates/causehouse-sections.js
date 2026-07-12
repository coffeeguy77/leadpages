/**
 * Cause House — bespoke section renderers matching causehouse.co structure.
 */
const { esc } = require('./shared');
const { enquiryForm } = require('../partner-website/sections');

function shell(inner) {
  return '<div class="ch-shell">' + inner + '</div>';
}

function chapter(band, inner, opts) {
  opts = opts || {};
  const id = opts.id ? ' id="' + esc(opts.id) + '"' : '';
  const cls = opts.className ? ' ' + esc(opts.className) : '';
  return '<section class="ch-chapter ch-chapter-' + band + cls + '"' + id + '>' + shell(inner) + '</section>';
}

function eyebrow(text, variant) {
  if (!text) return '';
  return '<span class="ch-eyebrow ch-eyebrow-' + (variant || 'lime') + '">' + esc(text) + '</span>';
}

function pickHighlightWord(headline, hint) {
  const text = String(headline || '').replace(/\.$/, '').trim();
  if (!text) return '';
  const hintStr = String(hint || '').trim();
  if (hintStr && !hintStr.includes(' ') && text.toLowerCase().includes(hintStr.toLowerCase())) {
    return hintStr;
  }
  const words = text.split(/\s+/).filter(function(w) {
    return w.length > 3 && !/^(for|and|the|your|with|that|from|into|over)$/i.test(w);
  });
  if (!words.length) return text.split(/\s+/).pop() || '';
  return words[Math.min(1, words.length - 1)] || words[0];
}

function displayHeadline(headline, hint) {
  const text = String(headline || '').trim();
  if (!text) return '';
  const word = pickHighlightWord(text, hint);
  if (!word) return '<span class="ch-display">' + esc(text) + '</span>';
  const idx = text.toLowerCase().indexOf(word.toLowerCase());
  if (idx < 0) return '<span class="ch-display">' + esc(text) + '</span>';
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + word.length);
  const after = text.slice(idx + word.length);
  return '<span class="ch-display">' + esc(before)
    + '<span class="ch-lime-word">' + esc(match) + '</span>'
    + esc(after) + '</span>';
}

function sectionTitle(text, hint) {
  const t = String(text || '').trim();
  if (!t) return '';
  const word = pickHighlightWord(t, hint);
  const idx = word ? t.toLowerCase().indexOf(word.toLowerCase()) : -1;
  if (idx >= 0) {
    return '<h2 class="ch-h1">' + esc(t.slice(0, idx))
      + '<span class="ch-lime-inline">' + esc(t.slice(idx, idx + word.length)) + '</span>'
      + esc(t.slice(idx + word.length)) + '</h2>';
  }
  return '<h2 class="ch-h1">' + esc(t) + '</h2>';
}

function navBlock(c, ctx) {
  const hero = c.hero || {};
  return '<header class="ch-header">'
    + shell(
      (ctx.logoUrl ? '<a href="#top" class="ch-brand"><img src="' + ctx.logoUrl + '" alt="' + ctx.name + '"></a>'
        : '<a href="#top" class="ch-brand ch-brand-text">' + ctx.name + '</a>')
      + '<nav class="ch-nav ch-nav-links" aria-label="Primary">'
      + '<a href="#partner">About</a>'
      + '<a href="#demos">Work</a>'
      + '<a href="#services">Services</a>'
      + '<a href="#support">Support</a>'
      + '</nav>'
      + '<a class="ch-btn ch-btn-primary ch-header-cta" href="#contact">' + esc(hero.primaryCta) + '</a>'
      + '<button class="ch-pill ch-menu-btn" type="button" aria-label="Menu" data-pt-menu>Menu</button>'
    )
    + '</header>';
}

function heroSection(c) {
  const hero = c.hero || {};
  return chapter('bg', ''
    + '<div class="ch-hero-grid" id="top">'
    + '<div class="ch-hero-copy">'
    + eyebrow(hero.eyebrow, 'lime')
    + '<h1>' + displayHeadline(hero.headline, hero.highlightedPhrase) + '</h1>'
    + (hero.highlightedPhrase ? '<p class="ch-tagline">' + esc(hero.highlightedPhrase) + '</p>' : '')
    + '<p class="ch-lead">' + esc(hero.supportingText) + '</p>'
    + '<div class="ch-hero-actions">'
    + '<a class="ch-btn ch-btn-primary" href="#contact">' + esc(hero.primaryCta) + '</a>'
    + '<a class="ch-btn ch-btn-ghost-paper" href="' + esc(hero.secondaryCtaHref) + '">' + esc(hero.secondaryCta) + '</a>'
    + '</div>'
    + trustStrip(c)
    + '</div>'
    + '<div class="ch-hero-art" aria-hidden="true"><div class="ch-hero-house"></div></div>'
    + '</div>', { className: 'ch-hero-section' });
}

function trustStrip(content) {
  if (!content.visibility || content.visibility.trust === false) return '';
  const items = (content.trust || []).filter(function(t) { return t && t.label; });
  if (!items.length) return '';
  return '<div class="ch-trust-strip">'
    + items.map(function(t) {
      return '<div class="ch-trust-item"><strong>' + esc(t.value) + '</strong><span>' + esc(t.label) + '</span></div>';
    }).join('')
    + '</div>';
}

function statsSection(content) {
  const m = content.metrics || {};
  const items = [];
  if (m.partnerProjectsCompleted) items.push({ v: m.partnerProjectsCompleted, l: 'Projects delivered' });
  if (m.partnerBusinessesSupported) items.push({ v: m.partnerBusinessesSupported, l: 'Businesses supported' });
  if (m.typicalResponseTime) items.push({ v: m.typicalResponseTime, l: 'Typical response time' });
  if (!items.length) return '';
  const lead = items[0];
  const sub = items.slice(1).map(function(it) {
    return esc(it.v) + ' ' + esc(it.l);
  }).join(' · ');
  return chapter('ink', ''
    + '<div class="ch-stat-panel">'
    + '<div class="ch-stat-row">'
    + '<p class="ch-stat-number">' + esc(lead.v) + '</p>'
    + '<div class="ch-stat-copy">'
    + '<p class="ch-h2 ch-on-dark">' + esc(lead.l) + '</p>'
    + (sub ? '<p class="ch-body-muted">' + sub + '</p>' : '')
    + '<p class="ch-body-muted">' + esc(content.hero.supportingText || '') + '</p>'
    + '</div></div></div>', { className: 'ch-stats-section' });
}

function benefitsSection(content) {
  if (!content.visibility || content.visibility.included === false) return '';
  const benefits = content.benefits || [];
  if (!benefits.length) return '';
  return chapter('ink', ''
    + '<div class="ch-split">'
    + '<div class="ch-split-intro">'
    + eyebrow('What is included', 'outline')
    + '<h2 class="ch-h1 ch-on-dark">More than a good-looking website.</h2>'
    + '<p class="ch-body-muted">A complete business system — built to win enquiries, not just look polished.</p>'
    + '</div>'
    + '<div class="ch-split-cards">'
    + benefits.map(function(b, i) {
      return '<article class="ch-card-ink">'
        + '<div class="ch-card-row">'
        + '<span class="ch-num">' + String(i + 1).padStart(2, '0') + '</span>'
        + '<div><h3 class="ch-h3 ch-on-dark">' + esc(b.title) + '</h3>'
        + '<p class="ch-body-muted">' + esc(b.body) + '</p></div>'
        + '</div></article>';
    }).join('')
    + '</div></div>', { id: 'included' });
}

function industriesSection(content) {
  if (!content.visibility || content.visibility.industries === false) return '';
  const list = content.industries || [];
  if (!list.length) return '';
  return chapter('bg', ''
    + eyebrow('Businesses we help', 'outline-paper')
    + sectionTitle('Industries & local businesses')
    + '<div class="ch-pill-row">'
    + list.map(function(i) { return '<span class="ch-pill">' + esc(i) + '</span>'; }).join('')
    + '</div>', { id: 'industries' });
}

function demosSection(content) {
  if (!content.visibility || content.visibility.demos === false) return '';
  const demos = content.demos || [];
  if (!demos.length) return '';
  return chapter('surface', ''
    + eyebrow('Live showcase', 'outline-paper')
    + sectionTitle('See what we can build')
    + '<p class="ch-section-sub">Explore live website demos in your browser before deciding what is right for your business.</p>'
    + '<div class="ch-demo-grid">'
    + demos.map(function(d) {
      const bg = d.thumbnailColor ? ' style="background:' + esc(d.thumbnailColor) + '"' : '';
      return '<article class="ch-card-hard ch-demo-card">'
        + '<a class="ch-demo-img" href="' + esc(d.url) + '" target="_blank" rel="noopener"' + bg + '>'
        + '<img src="' + esc(d.thumbnail) + '" alt="' + esc(d.name) + '" loading="lazy" style="object-fit:' + esc(d.thumbnailFit || 'cover') + '"></a>'
        + '<div class="ch-demo-body">'
        + '<span class="ch-demo-cat">' + esc(d.industry) + '</span>'
        + '<h3><a href="' + esc(d.url) + '" target="_blank" rel="noopener">' + esc(d.name) + '</a></h3>'
        + (d.description ? '<p>' + esc(d.description) + '</p>' : '')
        + '<div class="ch-demo-actions">'
        + '<a class="ch-btn ch-btn-primary ch-btn-sm" href="' + esc(d.url) + '" target="_blank" rel="noopener">' + esc(d.ctaExplore) + '</a>'
        + '<a class="ch-btn ch-btn-ghost-paper ch-btn-sm" href="#contact" data-demo-ref="' + esc(d.slug) + '">' + esc(d.ctaBuild) + '</a>'
        + '</div></div></article>';
    }).join('')
    + '</div>', { id: 'demos' });
}

function servicesSection(content) {
  if (!content.visibility || content.visibility.services === false) return '';
  const services = content.services || [];
  if (!services.length) return '';
  return chapter('bg', ''
    + eyebrow('What we offer', 'outline-paper')
    + sectionTitle('Website services for your business')
    + '<div class="ch-service-grid">'
    + services.map(function(s, i) {
      return '<article class="ch-card-hard ch-service-card' + (s.featured ? ' is-featured' : '') + '">'
        + '<span class="ch-num-badge">' + String(i + 1).padStart(2, '0') + '</span>'
        + (s.featured ? '<span class="ch-badge-pop">Popular</span>' : '')
        + '<h3>' + esc(s.name) + '</h3>'
        + '<p>' + esc(s.description) + '</p>'
        + (s.personalNote ? '<p class="ch-note">' + esc(s.personalNote) + '</p>' : '')
        + '<span class="ch-price">' + esc(s.priceLabel) + '</span>'
        + '<a class="ch-btn ch-btn-outline-paper ch-btn-sm" href="#contact">Enquire</a>'
        + '</article>';
    }).join('')
    + '</div>', { id: 'services' });
}

function processSection(content) {
  if (!content.visibility || content.visibility.process === false) return '';
  const steps = content.process || [];
  if (!steps.length) return '';
  return chapter('surface', ''
    + eyebrow('How it works', 'outline-paper')
    + sectionTitle('From first conversation to launch')
    + '<div class="ch-process-grid">'
    + steps.map(function(s) {
      return '<article class="ch-card-hard ch-process-card">'
        + '<span class="ch-num-badge">' + esc(String(s.step).padStart(2, '0')) + '</span>'
        + '<h3>' + esc(s.title) + '</h3>'
        + '<p>' + esc(s.description) + '</p>'
        + '</article>';
    }).join('')
    + '</div>', { id: 'process' });
}

function biographySection(content) {
  if (!content.visibility || content.visibility.biography === false) return '';
  const b = content.biography || {};
  const p = content.partner || {};
  const c = content.contact || {};
  if (!b.shortIntro && !b.fullBio) return '';
  return chapter('bg', ''
    + '<div class="ch-bio-grid">'
    + '<div class="ch-bio-photo">'
    + (p.headshotUrl ? '<img src="' + esc(p.headshotUrl) + '" alt="' + esc(p.displayName) + '" class="ch-bio-headshot">'
      : '<div class="ch-bio-placeholder" aria-hidden="true"></div>')
    + '</div>'
    + '<div class="ch-bio-copy">'
    + eyebrow('Meet your local website partner', 'outline-paper')
    + '<h2 class="ch-h1">' + esc(p.displayName) + '</h2>'
    + '<p class="ch-bio-agency">' + esc(p.agencyName)
    + (content.serviceArea && content.serviceArea.primaryRegion ? ' · ' + esc(content.serviceArea.primaryRegion) : '')
    + '</p>'
    + (b.shortIntro ? '<p class="ch-bio-intro">' + esc(b.shortIntro) + '</p>' : '')
    + (b.fullBio ? '<div class="ch-bio-full">' + esc(b.fullBio).replace(/\n/g, '<br>') + '</div>' : '')
    + (b.workingStyle ? '<p class="ch-bio-style"><strong>How I work:</strong> ' + esc(b.workingStyle) + '</p>' : '')
    + (b.whyPartner ? '<p class="ch-bio-why"><strong>Why I became a LeadPages Partner:</strong> ' + esc(b.whyPartner) + '</p>' : '')
    + '<div class="ch-bio-meta">'
    + (b.yearsExperience ? '<span>' + esc(b.yearsExperience) + ' experience</span>' : '')
    + (b.languages ? '<span>' + esc(b.languages) + '</span>' : '')
    + (b.qualifications ? '<span>' + esc(b.qualifications) + '</span>' : '')
    + '</div>'
    + '<div class="ch-bio-actions">'
    + (c.phone ? '<a class="ch-btn ch-btn-outline-paper" href="tel:' + c.phone.replace(/[^+0-9]/g, '') + '">' + esc(c.phone) + '</a>' : '')
    + (c.email ? '<a class="ch-btn ch-btn-outline-paper" href="mailto:' + esc(c.email) + '">Email ' + esc(p.firstName || p.displayName) + '</a>' : '')
    + (c.bookingUrl ? '<a class="ch-btn ch-btn-primary" href="' + esc(c.bookingUrl) + '" target="_blank" rel="noopener">Book consultation</a>'
      : '<a class="ch-btn ch-btn-primary" href="#contact">Plan my website</a>')
    + '</div></div></div>', { id: 'partner' });
}

function serviceAreaSection(content) {
  if (!content.visibility || content.visibility.serviceArea === false) return '';
  const sa = content.serviceArea || {};
  const areas = sa.areas || [];
  if (!areas.length && !sa.primaryRegion) return '';
  return chapter('surface', ''
    + eyebrow('Service area', 'outline-paper')
    + sectionTitle(sa.headline || 'Where we work')
    + '<div class="ch-pill-row">'
    + (areas.length ? areas.map(function(a) { return '<span class="ch-pill">' + esc(a.label) + '</span>'; }).join('')
      : '<span class="ch-pill">' + esc(sa.primaryRegion) + '</span>')
    + '</div>'
    + '<p class="ch-section-sub">'
    + (sa.remoteAvailable ? 'Remote projects welcome. ' : '')
    + (sa.inPersonAvailable !== false ? 'In-person meetings available.' : '')
    + '</p>', { id: 'areas' });
}

function platformBackingSection(content) {
  if (!content.visibility || content.visibility.platformBacking === false) return '';
  const pb = content.platformBacking || {};
  const p = content.partner || {};
  const c = content.contact || {};
  return chapter('ink', ''
    + eyebrow('Support', 'outline')
    + sectionTitle('Local service. Platform-backed delivery.')
    + '<div class="ch-support-grid">'
    + '<article class="ch-card-ink">'
    + '<span class="ch-support-tag">Local partner</span>'
    + '<h3 class="ch-h3 ch-on-dark">' + esc(p.displayName) + ' — your direct contact</h3>'
    + '<p class="ch-body-muted">' + esc(pb.personalStatement) + ' ' + esc(pb.localStatement) + '</p>'
    + (c.email ? '<a class="ch-btn ch-btn-outline-paper ch-on-dark" href="mailto:' + esc(c.email) + '">Email ' + esc(p.displayName) + '</a>' : '')
    + (c.phone ? '<a class="ch-btn ch-btn-outline-paper ch-on-dark" href="tel:' + c.phone.replace(/[^+0-9]/g, '') + '">' + esc(c.phone) + '</a>' : '')
    + '</article>'
    + '<article class="ch-card-ink">'
    + '<span class="ch-support-tag">Platform backup</span>'
    + '<h3 class="ch-h3 ch-on-dark">' + esc(pb.heading) + '</h3>'
    + '<p class="ch-body-muted">' + esc(pb.copy) + '</p>'
    + '<ul class="ch-support-list">' + (pb.bullets || []).map(function(b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>'
    + '</article></div>', { id: 'support' });
}

function testimonialsSection(content) {
  if (!content.visibility || content.visibility.testimonials === false) return '';
  const list = content.testimonials || [];
  if (!list.length) return '';
  return chapter('bg', ''
    + eyebrow('What clients say', 'outline-paper')
    + sectionTitle('Trusted by local businesses')
    + '<div class="ch-testimonial-grid">'
    + list.map(function(t) {
      return '<blockquote class="ch-card-hard ch-testimonial">'
        + (t.isPlatform ? '<span class="ch-testimonial-src">' + esc(t.attribution || 'LeadPages platform') + '</span>' : '')
        + '<p>&ldquo;' + esc(t.text) + '&rdquo;</p>'
        + '<footer><strong>' + esc(t.customerName || 'Client') + '</strong>'
        + (t.businessName ? '<span>' + esc(t.businessName) + '</span>' : '')
        + (t.location ? '<span>' + esc(t.location) + '</span>' : '')
        + '</footer></blockquote>';
    }).join('')
    + '</div>', { id: 'testimonials' });
}

function caseStudiesSection(content) {
  if (!content.visibility || content.visibility.caseStudies === false) return '';
  const list = content.caseStudies || [];
  if (!list.length) return '';
  return chapter('surface', ''
    + eyebrow('Case studies', 'outline-paper')
    + sectionTitle('Recent projects')
    + '<div class="ch-case-grid">'
    + list.map(function(cs) {
      return '<article class="ch-card-hard ch-case-card">'
        + (cs.afterImage ? '<img src="' + esc(cs.afterImage) + '" alt="" loading="lazy" class="ch-case-img">' : '')
        + '<div class="ch-case-body">'
        + '<span class="ch-demo-cat">' + esc(cs.industry || '') + '</span>'
        + '<h3>' + esc(cs.clientName) + '</h3>'
        + (cs.challenge ? '<p><strong>Challenge:</strong> ' + esc(cs.challenge) + '</p>' : '')
        + (cs.solution ? '<p><strong>Solution:</strong> ' + esc(cs.solution) + '</p>' : '')
        + (cs.result ? '<p><strong>Result:</strong> ' + esc(cs.result) + '</p>' : '')
        + (cs.websiteUrl ? '<a class="ch-btn ch-btn-ghost-paper ch-btn-sm" href="' + esc(cs.websiteUrl) + '" target="_blank" rel="noopener">View site</a>' : '')
        + '</div></article>';
    }).join('')
    + '</div>', { id: 'cases' });
}

function faqsSection(content) {
  if (!content.visibility || content.visibility.faqs === false) return '';
  const faqs = content.faqs || [];
  if (!faqs.length) return '';
  return chapter('surface', ''
    + eyebrow('Questions', 'outline-paper')
    + sectionTitle('Frequently asked questions')
    + '<div class="ch-faq-list">'
    + faqs.map(function(f, i) {
      return '<details class="ch-card-hard ch-faq-item"' + (i === 0 ? ' open' : '') + '>'
        + '<summary>' + esc(f.question) + '</summary>'
        + '<p>' + esc(f.answer) + '</p></details>';
    }).join('')
    + '</div>', { id: 'faqs' });
}

function leadOfferSection(content) {
  const offer = content.leadOffer || {};
  if (!offer.enabled || !content.visibility || content.visibility.leadOffer === false) return '';
  return chapter('lime', ''
    + '<div class="ch-cta-band">'
    + '<div class="ch-cta-copy">'
    + eyebrow('Free review', 'ink')
    + '<h2 class="ch-display ch-on-primary">' + esc(offer.title) + '</h2>'
    + '<p class="ch-on-primary">' + esc(offer.description || 'Send us your current website and your local partner will review its mobile usability, messaging, calls to action and opportunities to generate more enquiries.') + '</p>'
    + '</div>'
    + '<a class="ch-btn ch-btn-ink" href="#contact" data-offer="review">' + esc(offer.ctaLabel) + '</a>'
    + '</div>', { id: 'review' });
}

function contactSection(content) {
  if (!content.visibility || content.visibility.contact === false) return '';
  const p = content.partner || {};
  const c = content.contact || {};
  const social = content.social || {};
  let socialHtml = '';
  if (social.linkedin) socialHtml += '<a href="' + esc(social.linkedin) + '" target="_blank" rel="noopener">LinkedIn</a>';
  if (social.facebook) socialHtml += '<a href="' + esc(social.facebook) + '" target="_blank" rel="noopener">Facebook</a>';
  if (social.instagram) socialHtml += '<a href="' + esc(social.instagram) + '" target="_blank" rel="noopener">Instagram</a>';
  if (social.googleBusiness) socialHtml += '<a href="' + esc(social.googleBusiness) + '" target="_blank" rel="noopener">Google</a>';

  return chapter('ink', ''
    + '<div class="ch-contact-grid">'
    + '<div class="ch-contact-info">'
    + eyebrow('Get in touch', 'outline')
    + '<h2 class="ch-h1 ch-on-dark">Work with ' + esc(p.displayName) + '</h2>'
    + '<p class="ch-body-muted">Your local LeadPages partner — backed by secure hosting and platform support.</p>'
    + '<ul class="ch-contact-list">'
    + (c.email ? '<li><strong>Email</strong> <a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></li>' : '')
    + (c.phone ? '<li><strong>Phone</strong> <a href="tel:' + c.phone.replace(/[^+0-9]/g, '') + '">' + esc(c.phone) + '</a></li>' : '')
    + (c.contactHours ? '<li><strong>Hours</strong> ' + esc(c.contactHours) + '</li>' : '')
    + (c.responseTime ? '<li><strong>Response</strong> ' + esc(c.responseTime) + '</li>' : '')
    + '</ul>'
    + (socialHtml ? '<nav class="ch-social">' + socialHtml + '</nav>' : '')
    + '<div class="ch-lp-disclosure">'
    + '<span class="ch-lp-disclosure-logo leadpages-logo" data-lp-logo="auto" data-lp-logo-ink="auto" data-lp-logo-pulse="false" role="img" aria-label="LeadPages"></span>'
    + '<span class="ch-lp-disclosure-text">Your website runs on LeadPages platform infrastructure with local partner support.</span>'
    + '</div>'
    + '</div>'
    + enquiryForm(content, { className: 'ch-form pt-enquiry-form', title: 'Plan your website', subtitle: 'Tell us about your business — we respond within one business day.' })
    + '</div>', { id: 'contact', className: 'ch-contact-section' });
}

function footerBlock(ctx) {
  return '<footer class="ch-footer">'
    + shell(
      '<div class="ch-footer-grid">'
      + '<div class="ch-footer-brand">'
      + (ctx.logoUrl ? '<img src="' + ctx.logoUrl + '" alt="' + ctx.name + '" class="ch-footer-logo">' : '<strong class="ch-footer-name">' + ctx.name + '</strong>')
      + '<p>' + ctx.intro + '</p>'
      + '</div>'
      + '<nav class="ch-footer-nav" aria-label="Footer">'
      + '<a href="#demos">Demos</a><a href="#services">Services</a><a href="#partner">About</a><a href="#contact">Contact</a>'
      + '</nav>'
      + '</div>'
      + '<div class="ch-footer-bottom">'
      + '<p class="ch-footer-copy">&copy; ' + ctx.year + ' ' + ctx.name + '</p>'
      + '<a href="https://www.leadpages.com.au" target="_blank" rel="noopener" class="ch-lp-badge">'
      + '<span class="ch-lp-badge-logo leadpages-logo" data-lp-logo="auto" data-lp-logo-ink="auto" data-lp-logo-pulse="false" role="img" aria-label="LeadPages"></span>'
      + '<span class="ch-lp-badge-label">Powered by <strong>LeadPages</strong></span>'
      + '</a>'
      + '</div>'
    )
    + '</footer>';
}

function closingCtaSection(content) {
  const hero = content.hero || {};
  return chapter('lime', ''
    + '<div class="ch-cta-band">'
    + '<div class="ch-cta-copy">'
    + eyebrow('Get started', 'ink')
    + '<h2 class="ch-display ch-on-primary">Ready to build a stronger website for your business?</h2>'
    + '</div>'
    + '<a class="ch-btn ch-btn-ink" href="#contact">' + esc(hero.primaryCta) + '</a>'
    + '</div>', { className: 'ch-closing-cta' });
}

function allSections(content) {
  return ''
    + statsSection(content)
    + benefitsSection(content)
    + industriesSection(content)
    + demosSection(content)
    + servicesSection(content)
    + processSection(content)
    + biographySection(content)
    + serviceAreaSection(content)
    + platformBackingSection(content)
    + testimonialsSection(content)
    + caseStudiesSection(content)
    + faqsSection(content)
    + leadOfferSection(content)
    + contactSection(content)
    + closingCtaSection(content);
}

module.exports = {
  navBlock, heroSection, footerBlock, allSections,
  statsSection, benefitsSection, industriesSection, demosSection,
  servicesSection, processSection, biographySection, serviceAreaSection,
  platformBackingSection, testimonialsSection, caseStudiesSection,
  faqsSection, leadOfferSection, contactSection, closingCtaSection
};
