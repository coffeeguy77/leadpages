/**
 * Web Culture premium partner theme — section renderers.
 */
const { esc } = require('./shared');
const { partnerLogoDisplayUrl } = require('../partner-website/logo');
const {
  buildWebcultureCopy,
  groupServicesByPillar,
  groupDemosByIndustryTab,
  pickHeroDemo,
  WEBCULTURE_PROCESS,
  LEAD_FLOW_STEPS
} = require('../partner-website/webculture-theme');
const prm = require('./premium-components');

function shell(inner) {
  return '<div class="wc-shell">' + inner + '</div>';
}

function copyFor(content) {
  return buildWebcultureCopy(content);
}

function brandName(c) {
  return (c.partner && c.partner.agencyName) || (c.partner && c.partner.displayName) || 'Your agency';
}

function rawLogoUrl(ctx) {
  if (!ctx || !ctx.logoUrl) return '';
  return String(ctx.logoUrl).replace(/&amp;/g, '&').trim();
}

function logoSrc(ctx, basePx) {
  const raw = rawLogoUrl(ctx);
  if (!raw) return '';
  const scale = (ctx.pal && ctx.pal.logoSize) || 1;
  const px = Math.round(basePx * scale * 2);
  return esc(partnerLogoDisplayUrl(raw, px));
}

function brandLinkHtml(c, ctx) {
  const brand = brandName(c);
  const src = logoSrc(ctx, 320);
  if (src) {
    return '<a href="#top" class="wc-brand wc-brand-lockup">'
      + '<img src="' + src + '" alt="' + esc(brand) + '" class="wc-nav-logo" decoding="async" fetchpriority="high">'
      + '</a>';
  }
  return '<a href="#top" class="wc-brand wc-brand-text">' + esc(brand) + '</a>';
}

function navBlock(c, ctx) {
  const hero = c.hero || {};
  const COPY = copyFor(c);
  return '<header class="wc-header">'
    + shell(
      brandLinkHtml(c, ctx)
      + '<nav class="wc-nav wc-nav-links" aria-label="Primary">'
      + COPY.nav.map(function(link) {
        return '<a href="' + esc(link.href) + '">' + esc(link.label) + '</a>';
      }).join('')
      + '</nav>'
      + '<a class="wc-btn wc-btn-primary wc-header-cta" href="#contact">' + esc(hero.primaryCta) + '</a>'
      + '<button class="wc-btn wc-btn-ghost wc-menu-btn" type="button" aria-label="Menu" data-pt-menu>Menu</button>'
    )
    + '</header>';
}

function heroSection(c, ctx) {
  if (!c.visibility || c.visibility.hero === false) return '';
  const hero = c.hero || {};
  const COPY = copyFor(c);
  const heroDemo = pickHeroDemo(c.demos);
  const trust = COPY.heroTrust.map(function(it) {
    return '<li><span class="wc-trust-check" aria-hidden="true">✓</span>' + esc(it.label) + '</li>';
  }).join('');

  return '<section class="wc-section wc-hero" id="top">'
    + shell(
      '<div class="wc-hero-grid">'
      + '<div class="wc-hero-copy">'
      + '<p class="wc-eyebrow">' + esc(hero.eyebrow || 'YOUR WEBSITE PARTNER') + '</p>'
      + '<h1 class="wc-display">' + esc(hero.headline) + '</h1>'
      + '<p class="wc-lead">' + esc(hero.supportingText) + '</p>'
      + '<div class="wc-hero-actions">'
      + '<a class="wc-btn wc-btn-primary" href="' + esc(hero.secondaryCtaHref || '#demos') + '">'
      + esc(hero.secondaryCta || 'View live websites') + ' →</a>'
      + '<a class="wc-btn wc-btn-ghost" href="#contact">' + esc(hero.primaryCta) + '</a>'
      + '</div>'
      + (trust ? '<ul class="wc-trust-row">' + trust + '</ul>' : '')
      + '</div>'
      + prm.HeroWebsiteShowcase(heroDemo, { toast: COPY.quoteToast })
      + '</div>'
    )
    + '</section>';
}

function gallerySection(c) {
  if (!c.visibility || c.visibility.demos === false) return '';
  const demos = c.demos || [];
  if (!demos.length) return '';
  return prm.LiveDemoGallery(demos, copyFor(c).gallery);
}

function connectedSection(c) {
  if (!c.visibility || c.visibility.platformBacking === false) return '';
  const COPY = copyFor(c).connected;
  const cards = COPY.proofCards.map(function(card) {
    return '<article class="prm-proof-card" data-prm-lift>'
      + prm.icon(card.icon)
      + '<h3>' + esc(card.title) + '</h3>'
      + '<p>' + esc(card.body) + '</p>'
      + '</article>';
  }).join('');

  return '<section class="wc-section wc-section--ink wc-connected" id="platform">'
    + shell(
      '<div class="wc-connected-grid">'
      + prm.LeadFlowDiagram(LEAD_FLOW_STEPS, COPY.heading)
      + '<div class="wc-proof-cards">' + cards + '</div>'
      + '</div>'
    )
    + '</section>';
}

function demoShowcaseSection(c) {
  if (!c.visibility || c.visibility.demos === false) return '';
  const groups = groupDemosByIndustryTab(c.demos);
  if (!groups.length) return '';
  return prm.IndustryTabs(groups, copyFor(c).demos, { id: 'demos' });
}

function servicesSection(c) {
  if (!c.visibility || c.visibility.services === false) return '';
  const pillars = groupServicesByPillar(c.services);
  if (!pillars.length) return '';
  const sc = copyFor(c).services;
  const cta = (c.hero && c.hero.primaryCta) || 'Plan my website';
  return '<section class="wc-section wc-services" id="services">'
    + shell(
      '<p class="wc-eyebrow">' + esc(sc.eyebrow) + '</p>'
      + '<h2 class="wc-h1">' + esc(sc.heading) + '</h2>'
      + '<div class="wc-service-grid">'
      + pillars.map(function(p) { return prm.ServiceCard(p, cta); }).join('')
      + '</div>'
    )
    + '</section>';
}

function partnerProcessSection(c, ctx) {
  const showBio = !c.visibility || c.visibility.biography !== false;
  const showProcess = !c.visibility || c.visibility.process !== false;
  if (!showBio && !showProcess) return '';

  const pc = copyFor(c).partner;
  const prc = copyFor(c).process;
  const sa = c.serviceArea || {};
  const regionLine = sa.headline || '';

  return '<section class="wc-section wc-partner-process" id="process">'
    + shell(
      '<div class="wc-partner-process-grid">'
      + (showBio ? '<div id="partner">' + prm.PartnerCard(c, ctx, pc) + '</div>' : '')
      + (showProcess ? '<div class="wc-process-panel">'
        + '<p class="wc-eyebrow">' + esc(prc.eyebrow) + '</p>'
        + '<h2 class="wc-h2">' + esc(prc.heading) + '</h2>'
        + prm.Timeline(WEBCULTURE_PROCESS)
        + (regionLine ? '<p class="wc-region-line">' + esc(regionLine) + '</p>' : '')
        + '</div>' : '')
      + '</div>'
    )
    + '</section>';
}

function platformSection(c) {
  if (!c.visibility || c.visibility.platformBacking === false) return '';
  const plc = copyFor(c).platform;
  return '<section class="wc-section wc-platform" id="support">'
    + shell(
      '<p class="wc-eyebrow">' + esc(plc.eyebrow) + '</p>'
      + '<h2 class="wc-h1">' + esc(plc.heading) + '</h2>'
      + prm.PlatformDiagram(c, plc)
    )
    + '</section>';
}

function testimonialsContactSection(c) {
  const showTestimonials = !c.visibility || c.visibility.testimonials !== false;
  const showContact = !c.visibility || c.visibility.contact !== false;
  if (!showTestimonials && !showContact) return '';

  const list = (c.testimonials || []).filter(function(t) {
    return t && t.text && String(t.text).trim();
  });
  const featured = list.find(function(t) { return t.featured; }) || list[0] || null;
  const cc = copyFor(c).contact;

  return '<section class="wc-section wc-testimonials-contact" id="contact">'
    + shell(
      '<div class="wc-testimonials-contact-grid">'
      + (showTestimonials && featured
        ? '<div class="wc-testimonial-col">'
          + '<p class="wc-eyebrow">' + esc(copyFor(c).testimonials.eyebrow) + '</p>'
          + prm.ReviewCard(featured, c.contact, c.metrics)
          + '</div>'
        : '<div class="wc-testimonial-col wc-testimonial-col--info">'
          + '<p class="wc-eyebrow">' + esc(cc.eyebrow) + '</p>'
          + '<h2 class="wc-h2">' + esc(cc.heading) + '</h2>'
          + '<p class="wc-lead">' + esc(cc.sub) + '</p>'
          + '</div>')
      + (showContact ? prm.ContactPanel(c, cc) : '')
      + '</div>'
    )
    + '</section>';
}

function finalCtaSection(c) {
  return prm.FinalCTA(c, copyFor(c).closingCta);
}

function footerBlock(ctx, c) {
  const content = c || {};
  const brand = brandName(content);
  const fc = copyFor(content).footer;
  const contact = content.contact || {};
  const social = content.social || {};
  const src = logoSrc(ctx, 220);

  let socialHtml = '';
  if (social.facebook) socialHtml += '<a href="' + esc(social.facebook) + '" target="_blank" rel="noopener" aria-label="Facebook">Fb</a>';
  if (social.linkedin) socialHtml += '<a href="' + esc(social.linkedin) + '" target="_blank" rel="noopener" aria-label="LinkedIn">In</a>';
  if (social.instagram) socialHtml += '<a href="' + esc(social.instagram) + '" target="_blank" rel="noopener" aria-label="Instagram">Ig</a>';

  const brandHtml = src
    ? '<img src="' + src + '" alt="' + esc(brand) + '" class="wc-footer-logo" loading="lazy">'
    : '<strong class="wc-footer-name">' + esc(brand) + '</strong>';

  return '<footer class="wc-footer">'
    + shell(
      '<div class="wc-footer-grid">'
      + '<div class="wc-footer-brand">'
      + brandHtml
      + '<p class="wc-footer-tagline">' + esc(fc.tagline) + '</p>'
      + '<p class="wc-footer-powered">' + esc(fc.poweredLine) + '</p>'
      + '<a href="https://www.leadpages.com.au" target="_blank" rel="noopener" class="wc-lp-badge">'
      + '<span class="leadpages-logo" data-lp-logo="auto" data-lp-logo-ink="auto" data-lp-logo-pulse="false" role="img" aria-label="LeadPages"></span>'
      + '<span>Powered by <strong>LeadPages</strong></span>'
      + '</a>'
      + '</div>'
      + '<nav class="wc-footer-nav" aria-label="Footer">'
      + '<a href="#services">Websites</a><a href="#demos">Services</a><a href="#process">Process</a>'
      + '<a href="#partner">About</a><a href="#contact">Contact</a>'
      + '<a href="/privacy-policy.html">Privacy</a><a href="/terms-of-use.html">Terms</a>'
      + '</nav>'
      + '<div class="wc-footer-contact">'
      + (contact.phone ? '<a href="tel:' + String(contact.phone).replace(/[^+0-9]/g, '') + '">' + esc(contact.phone) + '</a>' : '')
      + (contact.email ? '<a href="mailto:' + esc(contact.email) + '">' + esc(contact.email) + '</a>' : '')
      + (socialHtml ? '<div class="wc-footer-social">' + socialHtml + '</div>' : '')
      + '<p class="wc-footer-copy">&copy; ' + esc(ctx.year) + ' ' + esc(brand) + '</p>'
      + '</div></div>'
    )
    + '</footer>';
}

function allSections(c, ctx) {
  return ''
    + gallerySection(c)
    + connectedSection(c)
    + demoShowcaseSection(c)
    + servicesSection(c)
    + partnerProcessSection(c, ctx)
    + platformSection(c)
    + testimonialsContactSection(c)
    + finalCtaSection(c);
}

module.exports = {
  navBlock,
  heroSection,
  gallerySection,
  connectedSection,
  demoShowcaseSection,
  servicesSection,
  partnerProcessSection,
  platformSection,
  testimonialsContactSection,
  finalCtaSection,
  footerBlock,
  allSections
};
