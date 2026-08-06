/**
 * Local Website Co. — section renderers.
 */
const { esc } = require('./shared');
const { partnerLogoDisplayUrl } = require('../partner-website/logo');
const { buildLocalWebsiteCoCopy } = require('../partner-website/localwebsiteco-theme');

function shell(inner) {
  return '<div class="lwc-shell">' + inner + '</div>';
}

function copyFor(content) {
  return buildLocalWebsiteCoCopy(content);
}

function brandName(c) {
  return (c.partner && c.partner.agencyName) || (c.partner && c.partner.displayName) || 'Local Website Co.';
}

function firstName(c) {
  return (c.partner && c.partner.firstName) || 'Shaun';
}

function telHref(phone) {
  const p = String(phone || '').replace(/[^+0-9]/g, '');
  return p ? 'tel:' + p : '#contact';
}

function logoSrc(ctx, basePx) {
  const raw = ctx && ctx.logoUrl ? String(ctx.logoUrl).replace(/&amp;/g, '&').trim() : '';
  if (!raw) return '';
  const scale = (ctx.pal && ctx.pal.logoSize) || 1;
  const px = Math.round(basePx * scale * 2);
  return esc(partnerLogoDisplayUrl(raw, px));
}

function brandHtml(c, ctx) {
  const brand = brandName(c);
  const src = logoSrc(ctx, 260);
  if (src) {
    return '<a class="lwc-brand lwc-brand--image" href="#top">'
      + '<img src="' + src + '" alt="' + esc(brand) + '" decoding="async" fetchpriority="high">'
      + '</a>';
  }
  return '<a class="lwc-brand lwc-brand--text" href="#top">'
    + '<span class="lwc-brand-mark">L</span><span>' + esc(brand) + '</span>'
    + '</a>';
}

function iconDot(label) {
  return '<span class="lwc-icon-dot" aria-hidden="true">' + esc(String(label || '').slice(0, 1).toUpperCase()) + '</span>';
}

/** Stroke tick from the shared icon language (check path). */
function strokeTick() {
  return '<svg class="lwc-tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
}

function mapPinIcon() {
  return '<svg class="lwc-map-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
}

function navBlock(c, ctx) {
  const COPY = copyFor(c);
  const phone = (c.contact && c.contact.phone) || ctx.phone || '';
  return '<header class="lwc-header">'
    + shell(
      brandHtml(c, ctx)
      + '<nav class="lwc-nav lwc-nav-links" aria-label="Primary">'
      + COPY.nav.map(function(link) {
        return '<a href="' + esc(link.href) + '">' + esc(link.label) + '</a>';
      }).join('')
      + '</nav>'
      + '<div class="lwc-header-actions">'
      + (phone ? '<a class="lwc-header-phone" href="' + esc(telHref(phone)) + '"><span class="lwc-phone-ico" aria-hidden="true"></span>Call ' + esc(phone) + '</a>' : '')
      + '<a class="lwc-btn lwc-btn--orange lwc-header-cta" href="#contact">Let&apos;s talk</a>'
      + '<button class="lwc-menu-btn" type="button" aria-label="Menu" aria-expanded="false" data-pt-menu>Menu</button>'
      + '</div>'
    )
    + '</header>';
}

function poweredBar(c) {
  const COPY = copyFor(c);
  return '<div class="lwc-powered-bar">'
    + shell('<span class="lwc-powered-badge">' + esc(COPY.powered) + '</span>')
    + '</div>';
}

function heroSection(c) {
  if (!c.visibility || c.visibility.hero === false) return '';
  const COPY = copyFor(c);
  const hero = COPY.hero;
  const region = hero.trust && hero.trust.length ? hero.trust[hero.trust.length - 1] : '';
  return '<section class="lwc-section lwc-hero" id="top">'
    + shell(
      '<div class="lwc-hero-grid">'
      + '<div class="lwc-hero-copy">'
      + '<p class="lwc-eyebrow">' + esc(hero.eyebrow) + '</p>'
      + '<h1>' + esc(hero.headline) + '</h1>'
      + '<p class="lwc-hero-lead">' + esc(hero.supporting) + '</p>'
      + '<div class="lwc-hero-actions">'
      + '<a class="lwc-btn lwc-btn--orange" href="#contact">' + esc(hero.primaryCta) + '</a>'
      + '<a class="lwc-btn lwc-btn--outline" href="#websites">' + esc(hero.secondaryCta) + '</a>'
      + '</div>'
      + '<div class="lwc-hero-trust">'
      + hero.trust.slice(0, 3).map(function(item) {
        return '<div class="lwc-hero-trust-item">' + iconDot(item) + '<span>' + esc(item) + '</span></div>';
      }).join('')
      + (region
        ? '<div class="lwc-hero-trust-item lwc-hero-trust-item--region">' + mapPinIcon() + '<span>' + esc(region) + '</span></div>'
        : '')
      + '</div>'
      + '</div>'
      + '<div class="lwc-hero-photo-wrap">'
      + '<img class="lwc-hero-photo" src="' + esc(hero.image) + '" alt="Local website consultant working with a client at a laptop" loading="eager" decoding="async">'
      + '<div class="lwc-hero-devices" aria-hidden="true">'
      + '<div class="lwc-hero-laptop"><div class="lwc-hero-laptop-screen"><span></span><span></span><span></span></div></div>'
      + '<div class="lwc-hero-tablet"><div class="lwc-hero-tablet-screen"></div></div>'
      + '<div class="lwc-hero-phone"><div class="lwc-hero-phone-screen"></div></div>'
      + '</div>'
      + '<div class="lwc-floating-chips">'
      + hero.chips.map(function(chip, i) {
        const label = typeof chip === 'string' ? chip : (chip && chip.label) || '';
        const kind = typeof chip === 'string' ? '' : (chip && chip.kind) || '';
        return '<span class="lwc-float-chip lwc-float-chip--' + (i + 1) + (kind ? ' is-' + esc(kind) : '') + '">'
          + '<span class="lwc-float-ico" aria-hidden="true"></span>' + esc(label) + '</span>';
      }).join('')
      + '</div>'
      + '</div>'
      + '</div>'
    )
    + '</section>';
}

function sectionIntro(copy) {
  return '<div class="lwc-section-intro">'
    + (copy.eyebrow ? '<p class="lwc-eyebrow">' + esc(copy.eyebrow) + '</p>' : '')
    + '<h2>' + esc(copy.heading) + '</h2>'
    + (copy.sub ? '<p>' + esc(copy.sub) + '</p>' : '')
    + '</div>';
}

function industriesSection(c) {
  if (!c.visibility || c.visibility.industries === false) return '';
  const COPY = copyFor(c).industries;
  return '<section class="lwc-section lwc-industries" id="industries">'
    + shell(
      sectionIntro(COPY)
      + '<div class="lwc-industry-grid">'
      + COPY.cards.map(function(card) {
        return '<article class="lwc-industry-card">'
          + '<img src="' + esc(card.image) + '" alt="' + esc(card.title) + '" loading="lazy" decoding="async">'
          + '<div><h3>' + esc(card.title) + '</h3><p>' + esc(card.body) + '</p></div>'
          + '</article>';
      }).join('')
      + '</div>'
    )
    + '</section>';
}

function demoCard(card, index) {
  const img = '<img src="' + esc(card.image) + '" alt="' + esc(card.name) + ' website demo" loading="lazy" decoding="async">';
  return '<article class="lwc-demo-card" data-lwc-demo-industry="' + esc(card.industry || 'All') + '">'
    + '<div class="lwc-device-stack">'
    + '<div class="lwc-device lwc-device--desk">'
    + '<div class="lwc-device-bar"><span></span><span></span><span></span></div>'
    + '<div class="lwc-device-screen">'
    + '<!-- Placeholder demo/process imagery may use Unsplash until partner demos provide screenshots. -->'
    + img
    + '</div>'
    + '</div>'
    + '<div class="lwc-device lwc-device--handset" aria-hidden="true">'
    + '<div class="lwc-device-screen">' + img + '</div>'
    + '</div>'
    + '</div>'
    + '<div class="lwc-demo-body">'
    + '<span class="lwc-demo-tag">' + esc(card.tag || card.industry || 'Local') + '</span>'
    + '<h3>' + esc(card.name) + '</h3>'
    + '<p>' + esc(card.description) + '</p>'
    + '<div class="lwc-swatches" aria-label="Colour palette">'
    + (card.colours || []).slice(0, 4).map(function(colour) {
      return '<span style="background:' + esc(colour) + '"></span>';
    }).join('')
    + '</div>'
    + '<a class="lwc-link" href="' + esc(card.url || '#contact') + '" target="' + (card.url && card.url.charAt(0) !== '#' ? '_blank' : '_self') + '" rel="noopener">View live demo <span aria-hidden="true">→</span></a>'
    + '</div>'
    + '<span class="lwc-demo-num">' + esc(String(index + 1).padStart(2, '0')) + '</span>'
    + '</article>';
}

function demosSection(c) {
  if (!c.visibility || c.visibility.demos === false) return '';
  const COPY = copyFor(c).demos;
  return '<section class="lwc-section lwc-demos" id="websites">'
    + shell(
      sectionIntro(COPY)
      + '<div class="lwc-demo-tabs" aria-label="Demo filters">'
      + COPY.tabs.map(function(tab, i) {
        return '<button type="button" class="lwc-pill' + (i === 0 ? ' is-active' : '') + '" data-lwc-filter="' + esc(tab.toLowerCase()) + '">' + esc(tab) + '</button>';
      }).join('')
      + '</div>'
      + '<div class="lwc-demo-grid">'
      + COPY.cards.map(demoCard).join('')
      + '</div>'
      + '<p class="lwc-demo-foot">' + esc(COPY.missingLine) + '</p>'
    )
    + '</section>';
}

function featuresSection(c) {
  if (!c.visibility || c.visibility.included === false) return '';
  const COPY = copyFor(c).features;
  const left = COPY.callouts.filter(function(item) { return item.side === 'left'; });
  const right = COPY.callouts.filter(function(item) { return item.side === 'right'; });
  function callout(item) {
    return '<article class="lwc-feature-callout">'
      + iconDot(item.title)
      + '<div><h3>' + esc(item.title) + '</h3><p>' + esc(item.text) + '</p></div>'
      + '</article>';
  }
  return '<section class="lwc-section lwc-features" id="features">'
    + shell(
      sectionIntro(COPY)
      + '<div class="lwc-feature-showcase">'
      + '<div class="lwc-feature-col">' + left.map(callout).join('') + '</div>'
      + '<div class="lwc-feature-devices" aria-label="Website feature preview">'
      + '<div class="lwc-device lwc-device--desktop"><div class="lwc-device-bar"><span></span><span></span><span></span></div><div class="lwc-mini-site"><b></b><i></i><i></i><em></em></div></div>'
      + '<div class="lwc-device lwc-device--phone"><div class="lwc-mini-site lwc-mini-site--phone"><b></b><i></i><em></em></div></div>'
      + '<div class="lwc-feature-pins">'
      + (COPY.pins || COPY.callouts.map(function(item) { return item.title; })).map(function(label, i) {
        return '<span class="lwc-pin lwc-pin--' + (i + 1) + '">' + esc(label) + '</span>';
      }).join('')
      + '</div>'
      + '</div>'
      + '<div class="lwc-feature-col">' + right.map(callout).join('') + '</div>'
      + '</div>'
    )
    + '</section>';
}

function processSection(c) {
  if (!c.visibility || c.visibility.process === false) return '';
  const COPY = copyFor(c).process;
  return '<section class="lwc-section lwc-process" id="process">'
    + shell(
      sectionIntro(COPY)
      + '<div class="lwc-process-grid">'
      + COPY.steps.map(function(step) {
        return '<article class="lwc-process-step">'
          + '<div class="lwc-process-img">'
          + '<!-- Unsplash placeholder used until partner process photography is supplied. -->'
          + '<img src="' + esc(step.image) + '" alt="' + esc(step.title) + '" loading="lazy" decoding="async">'
          + (step.floatChip
            ? '<span class="lwc-process-float is-' + esc(step.floatChip.kind || 'mail') + '">'
              + '<span class="lwc-float-ico" aria-hidden="true"></span>' + esc(step.floatChip.label)
              + '</span>'
            : '')
          + '</div>'
          + '<span>' + esc(step.number) + '</span>'
          + '<h3>' + esc(step.title) + '</h3>'
          + '<p>' + esc(step.body) + '</p>'
          + '</article>';
      }).join('')
      + '</div>'
      + '<div class="lwc-process-action"><a class="lwc-btn lwc-btn--orange" href="#contact">' + esc(COPY.cta) + '</a></div>'
    )
    + '</section>';
}

function aboutSection(c, ctx) {
  if (!c.visibility || c.visibility.biography === false) return '';
  const COPY = copyFor(c).about;
  const contact = (c && c.contact) || {};
  return '<section class="lwc-section lwc-about" id="about">'
    + shell(
      '<div class="lwc-about-grid">'
      + '<div class="lwc-about-photo">'
      + '<!-- Unsplash placeholder used when the partner has not uploaded a headshot. -->'
      + '<img src="' + esc(COPY.image) + '" alt="' + esc(firstName(c)) + ', local website partner" loading="lazy" decoding="async">'
      + '</div>'
      + '<article class="lwc-about-panel">'
      + '<p class="lwc-eyebrow">' + esc(COPY.eyebrow) + '</p>'
      + '<h2>' + esc(COPY.heading) + '</h2>'
      + '<p>' + esc(COPY.body).replace(/\n\n/g, '</p><p>') + '</p>'
      + '<div class="lwc-about-icons">'
      + COPY.icons.map(function(item) { return '<span>' + iconDot(item) + esc(item) + '</span>'; }).join('')
      + '</div>'
      + '<div class="lwc-about-actions">'
      + (contact.phone ? '<a class="lwc-btn lwc-btn--orange" href="' + esc(telHref(contact.phone)) + '">' + esc(COPY.callLabel) + '</a>' : '')
      + (contact.email ? '<a class="lwc-btn lwc-btn--light-outline" href="mailto:' + esc(contact.email) + '">' + esc(COPY.emailLabel) + '</a>' : '')
      + (!contact.phone && !contact.email ? '<a class="lwc-btn lwc-btn--orange" href="#contact">Contact ' + esc(firstName(c)) + '</a>' : '')
      + '</div>'
      + '</article>'
      + '</div>'
    )
    + '</section>';
}

function pricingSection(c) {
  if (c.visibility && c.visibility.pricing === false) return '';
  const COPY = copyFor(c).pricing;
  return '<section class="lwc-section lwc-pricing" id="pricing">'
    + shell(
      sectionIntro(COPY)
      + '<div class="lwc-pricing-grid">'
      + COPY.plans.map(function(plan) {
        return '<article class="lwc-price-card' + (plan.badge ? ' is-featured' : '') + '">'
          + (plan.badge ? '<span class="lwc-price-badge">' + esc(plan.badge) + '</span>' : '')
          + '<h3>' + esc(plan.name) + '</h3>'
          + '<p class="lwc-price">' + esc(plan.price) + '</p>'
          + '<p class="lwc-price-note">' + esc(plan.note) + '</p>'
          + '<ul>' + plan.bullets.map(function(b) {
            return '<li><span class="lwc-tick-wrap" aria-hidden="true">' + strokeTick() + '</span><span>' + esc(b) + '</span></li>';
          }).join('') + '</ul>'
          + '<a class="lwc-btn ' + (plan.badge ? 'lwc-btn--orange' : 'lwc-btn--outline') + '" href="#contact">' + esc(plan.cta) + '</a>'
          + '</article>';
      }).join('')
      + '</div>'
    )
    + '</section>';
}

function testimonialsSection(c) {
  if (!c.visibility || c.visibility.testimonials === false) return '';
  const COPY = copyFor(c).testimonials;
  return '<section class="lwc-section lwc-testimonials" id="testimonials">'
    + shell(
      sectionIntro(COPY)
      + '<div class="lwc-testimonial-grid">'
      + COPY.items.slice(0, 3).map(function(item) {
        return '<blockquote class="lwc-quote">'
          + '<p>&ldquo;' + esc(item.text) + '&rdquo;</p>'
          + '<footer><strong>' + esc(item.customerName || 'Local business owner') + '</strong><span>' + esc(item.businessName || item.location || 'Local business') + '</span></footer>'
          + '</blockquote>';
      }).join('')
      + '</div>'
    )
    + '</section>';
}

function trustSection(c) {
  if (!c.visibility || c.visibility.platformBacking === false) return '';
  const COPY = copyFor(c).trust;
  return '<section class="lwc-section lwc-trust" id="trust">'
    + shell(
      sectionIntro(COPY)
      + '<div class="lwc-powered-panel">'
      + '<div class="lwc-powered-brand">'
      + '<span class="leadpages-logo" data-lp-logo="auto" data-lp-logo-ink="light" data-lp-logo-pulse="false" role="img" aria-label="LeadPages"></span>'
      + '<p><strong>Powered by LeadPages Australia</strong><span>' + esc(COPY.powered) + '</span></p>'
      + '</div>'
      + '<div class="lwc-trust-strip" aria-label="Platform benefits">'
      + COPY.items.map(function(item) {
        return '<div class="lwc-trust-chip">' + strokeTick() + '<span>' + esc(item.title) + '</span></div>';
      }).join('')
      + '</div>'
      + '</div>'
    )
    + '</section>';
}

function faqSection(c) {
  if (!c.visibility || c.visibility.faqs === false) return '';
  const COPY = copyFor(c).faqs;
  const midpoint = Math.ceil(COPY.items.length / 2);
  function list(items) {
    return '<div class="lwc-faq-col">' + items.map(function(item, i) {
      return '<details class="lwc-faq-item"' + (i === 0 ? ' open' : '') + '>'
        + '<summary>' + esc(item.question) + '</summary>'
        + '<p>' + esc(item.answer) + '</p>'
        + '</details>';
    }).join('') + '</div>';
  }
  return '<section class="lwc-section lwc-faq" id="faq">'
    + shell(
      sectionIntro(COPY)
      + '<div class="lwc-faq-grid">'
      + list(COPY.items.slice(0, midpoint))
      + list(COPY.items.slice(midpoint))
      + '</div>'
    )
    + '</section>';
}

function contactForm(c) {
  const COPY = copyFor(c).contact;
  return '<form class="lwc-contact-form" data-pl-lead-form data-pl-kind="partner-showcase" data-pl-extended="1" method="post" action="#">'
    + '<h3>' + esc(COPY.formTitle) + '</h3>'
    + '<p class="lwc-form-sub">' + esc(COPY.formSub) + '</p>'
    + '<div class="lp-hp" aria-hidden="true"><label for="lwc_lp_hp">Company website</label><input type="text" id="lwc_lp_hp" name="lp_hp" value="" tabindex="-1" autocomplete="off"></div>'
    + '<div class="lwc-form-grid">'
    + '<label><span>Name</span><input name="name" type="text" placeholder="Your name" required></label>'
    + '<label><span>Business Name</span><input name="businessName" type="text" placeholder="Business name"></label>'
    + '<label><span>Phone</span><input name="phone" type="tel" placeholder="Phone number"></label>'
    + '<label><span>Email</span><input name="email" type="email" placeholder="you@business.com"></label>'
    + '<label class="lwc-form-full"><span>What do you need help with?</span><textarea name="message" rows="4" placeholder="Tell me what you need your website to do."></textarea></label>'
    + '</div>'
    + '<button class="lwc-btn lwc-btn--orange" type="submit">Start the conversation</button>'
    + '<p class="pl-form-err"></p><p class="pl-form-ok" hidden>Thanks — we&apos;ll be in touch shortly.</p>'
    + '</form>';
}

function finalCtaSection(c) {
  if (!c.visibility || c.visibility.contact === false) return '';
  const COPY = copyFor(c).contact;
  return '<section class="lwc-section lwc-final" id="contact">'
    + shell(
      '<div class="lwc-final-grid">'
      + '<div class="lwc-final-copy">'
      + '<p class="lwc-eyebrow">' + esc(COPY.eyebrow) + '</p>'
      + '<h2>' + esc(COPY.heading) + '</h2>'
      + '<p>' + esc(COPY.sub) + '</p>'
      + '<div class="lwc-final-contact-list">'
      + (COPY.phone
        ? '<a class="lwc-final-contact-item" href="' + esc(telHref(COPY.phone)) + '"><span class="lwc-phone-ico" aria-hidden="true"></span><span>Call ' + esc(COPY.phone) + '</span></a>'
        : '')
      + (COPY.email
        ? '<a class="lwc-final-contact-item" href="mailto:' + esc(COPY.email) + '"><span class="lwc-mail-ico" aria-hidden="true"></span><span>' + esc(COPY.email) + '</span></a>'
        : '')
      + '<a class="lwc-final-contact-item is-chat" href="#contact"><span class="lwc-chat-ico" aria-hidden="true"></span><span>Book a quick chat</span></a>'
      + '</div>'
      + '</div>'
      + contactForm(c)
      + '</div>'
    )
    + '</section>';
}

function footerBlock(ctx, c) {
  const COPY = copyFor(c).footer;
  const brand = brandName(c);
  return '<footer class="lwc-footer">'
    + shell(
      '<div class="lwc-footer-grid">'
      + '<div><strong>' + esc(brand) + '</strong><p>' + esc(COPY.tagline) + '</p></div>'
      + '<nav aria-label="Footer"><a href="#websites">Websites</a><a href="#process">How it works</a><a href="#about">About</a><a href="#pricing">Pricing</a><a href="#contact">Contact</a><a href="' + esc(COPY.privacy) + '">Privacy</a><a href="' + esc(COPY.terms) + '">Terms</a></nav>'
      + '<a href="https://www.leadpages.com.au" target="_blank" rel="noopener" class="lwc-footer-powered">'
      + '<span class="leadpages-logo" data-lp-logo="auto" data-lp-logo-ink="auto" data-lp-logo-pulse="false" role="img" aria-label="LeadPages"></span>'
      + '<span>Powered by <strong>LeadPages</strong></span>'
      + '</a>'
      + '</div>'
      + '<p class="lwc-footer-copy">&copy; ' + esc(ctx.year) + ' ' + esc(brand) + '</p>'
    )
    + '</footer>';
}

function stickyCtaBlock(c) {
  const phone = (c.contact && c.contact.phone) || '';
  return '<div class="lwc-sticky-cta" data-lwc-sticky-cta>'
    + (phone ? '<a href="' + esc(telHref(phone)) + '">Call</a>' : '')
    + '<a href="#contact">Let&apos;s talk</a>'
    + '</div>';
}

function allSections(c, ctx) {
  return ''
    + industriesSection(c)
    + demosSection(c)
    + featuresSection(c)
    + processSection(c)
    + aboutSection(c, ctx)
    + pricingSection(c)
    + testimonialsSection(c)
    + trustSection(c)
    + faqSection(c)
    + finalCtaSection(c);
}

module.exports = {
  navBlock,
  poweredBar,
  heroSection,
  industriesSection,
  demosSection,
  featuresSection,
  processSection,
  aboutSection,
  pricingSection,
  testimonialsSection,
  trustSection,
  faqSection,
  finalCtaSection,
  footerBlock,
  stickyCtaBlock,
  allSections
};
