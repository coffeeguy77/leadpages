/**
 * Local Website Co. — section renderers (partners1.png composition).
 */
const { esc } = require('./shared');
const { partnerLogoDisplayUrl } = require('../partner-website/logo');
const { buildLocalWebsiteCoCopy } = require('../partner-website/localwebsiteco-theme');

function shell(inner) {
  return '<div class="lwc-shell">' + inner + '</div>';
}

function copyFor(c) {
  return buildLocalWebsiteCoCopy(c);
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
      + '<img src="' + src + '" alt="' + esc(brand) + '" width="180" height="44" decoding="async" fetchpriority="high">'
      + '</a>';
  }
  return '<a class="lwc-brand lwc-brand--text" href="#top">'
    + '<span class="lwc-brand-mark" aria-hidden="true">L</span><span>' + esc(brand) + '</span>'
    + '</a>';
}

function strokeTick() {
  return '<svg class="lwc-tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
}

function iconSvg(name) {
  const paths = {
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
    life: '<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 14.14 14.14"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M2 12h4"/><path d="M18 12h4"/>',
    map: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    spark: '<path d="M12 3v4"/><path d="M12 17v4"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="m5.6 5.6 2.8 2.8"/><path d="m15.6 15.6 2.8 2.8"/><path d="m5.6 18.4 2.8-2.8"/><path d="m15.6 8.4 2.8-2.8"/>'
  };
  return '<svg class="lwc-icon" viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || paths.spark) + '</svg>';
}

function sectionIntro(copy, opts) {
  opts = opts || {};
  return '<div class="lwc-section-intro' + (opts.className ? ' ' + opts.className : '') + '">'
    + (copy.eyebrow ? '<p class="lwc-eyebrow">' + esc(copy.eyebrow) + '</p>' : '')
    + '<h2>' + esc(copy.heading) + '</h2>'
    + (copy.sub ? '<p>' + esc(copy.sub) + '</p>' : '')
    + '</div>';
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
      + (phone
        ? '<a class="lwc-header-phone" href="' + esc(telHref(phone)) + '">'
          + iconSvg('phone') + '<span>Call ' + esc(phone) + '</span></a>'
        : '')
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
  const hero = copyFor(c).hero;
  const trustIcons = ['users', 'flag', 'life', 'map'];
  return '<section class="lwc-section lwc-hero" id="top">'
    + shell(
      '<div class="lwc-hero-grid">'
      + '<div class="lwc-hero-copy">'
      + '<p class="lwc-eyebrow">' + esc(hero.eyebrow) + '</p>'
      + '<h1>' + esc(hero.headlineHtml || hero.headline).replace(/\n/g, '<br>') + '</h1>'
      + '<p class="lwc-hero-lead">' + esc(hero.supporting) + '</p>'
      + '<div class="lwc-hero-actions">'
      + '<a class="lwc-btn lwc-btn--orange" href="#contact">' + esc(hero.primaryCta) + '</a>'
      + '<a class="lwc-btn lwc-btn--outline" href="#websites">' + esc(hero.secondaryCta) + '</a>'
      + '</div>'
      + '<div class="lwc-hero-trust">'
      + hero.trust.slice(0, 3).map(function(item, i) {
        return '<div class="lwc-hero-trust-item">'
          + '<span class="lwc-hero-trust-ico">' + iconSvg(trustIcons[i] || 'spark') + '</span>'
          + '<span>' + esc(item) + '</span></div>';
      }).join('')
      + '</div>'
      + (hero.trust[3]
        ? '<p class="lwc-hero-locale">' + iconSvg('map') + '<span>' + esc(hero.trust[3]) + '</span></p>'
        : '')
      + '</div>'
      + '<div class="lwc-hero-photo-wrap">'
      + '<img class="lwc-hero-photo" src="' + esc(hero.image) + '" alt="Local website consultant meeting a business owner" width="720" height="900" loading="eager" decoding="async">'
      + '<div class="lwc-hero-devices" aria-hidden="true">'
      + '<div class="lwc-hero-laptop"><div class="lwc-hero-laptop-screen"></div></div>'
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

function industriesSection(c) {
  if (!c.visibility || c.visibility.industries === false) return '';
  const COPY = copyFor(c).industries;
  return '<section class="lwc-section lwc-industries" id="industries">'
    + shell(
      '<div class="lwc-industries-grid">'
      + '<div class="lwc-industries-intro">'
      + '<p class="lwc-eyebrow">' + esc(COPY.eyebrow) + '</p>'
      + '<h2>' + esc(COPY.heading) + '</h2>'
      + (COPY.sub ? '<p>' + esc(COPY.sub) + '</p>' : '')
      + '</div>'
      + COPY.cards.map(function(card) {
        return '<article class="lwc-industry-card">'
          + '<img src="' + esc(card.image) + '" alt="' + esc(card.title) + '" width="640" height="360" loading="lazy" decoding="async">'
          + '<h3>' + esc(card.title) + '</h3>'
          + '</article>';
      }).join('')
      + '</div>'
    )
    + '</section>';
}

function demoCard(card) {
  const img = '<img src="' + esc(card.image) + '" alt="' + esc(card.name) + ' website demo" width="800" height="500" loading="lazy" decoding="async">';
  return '<article class="lwc-demo-card" data-lwc-demo-industry="' + esc(card.industry || 'All') + '">'
    + '<div class="lwc-device-stack">'
    + '<div class="lwc-device lwc-device--desk">'
    + '<div class="lwc-device-bar"><span></span><span></span><span></span></div>'
    + '<div class="lwc-device-screen">' + img + '</div></div>'
    + '<div class="lwc-device lwc-device--handset" aria-hidden="true">'
    + '<div class="lwc-device-screen">' + img + '</div></div>'
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
    + '<a class="lwc-link" href="' + esc(card.url || '#contact') + '"'
    + (card.url && card.url.charAt(0) !== '#' ? ' target="_blank" rel="noopener"' : '')
    + '>View live demo <span aria-hidden="true">→</span></a>'
    + '</div></article>';
}

function demosSection(c) {
  if (!c.visibility || c.visibility.demos === false) return '';
  const COPY = copyFor(c).demos;
  return '<section class="lwc-section lwc-demos" id="websites">'
    + shell(
      sectionIntro(COPY)
      + '<div class="lwc-demo-tabs" role="tablist" aria-label="Demo filters">'
      + COPY.tabs.map(function(tab, i) {
        return '<button type="button" class="lwc-pill' + (i === 0 ? ' is-active' : '') + '" data-lwc-filter="'
          + esc(tab.toLowerCase()) + '" role="tab" aria-selected="' + (i === 0 ? 'true' : 'false') + '">'
          + esc(tab) + '</button>';
      }).join('')
      + '</div>'
      + '<div class="lwc-demo-grid">'
      + COPY.cards.map(demoCard).join('')
      + '</div>'
      + '<p class="lwc-demo-foot"><a href="#contact">' + esc(COPY.missingLine) + '</a></p>'
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
      + '<span class="lwc-feature-ico">' + iconSvg('spark') + '</span>'
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
      + (COPY.pins || []).map(function(label, i) {
        return '<span class="lwc-pin lwc-pin--' + (i + 1) + '">' + esc(label) + '</span>';
      }).join('')
      + '</div></div>'
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
          + '<div class="lwc-process-copy">'
          + '<span class="lwc-process-num">' + esc(step.number) + '</span>'
          + '<h3>' + esc(step.title) + '</h3>'
          + '<p>' + esc(step.body) + '</p>'
          + '</div>'
          + '<div class="lwc-process-img">'
          + '<img src="' + esc(step.image) + '" alt="' + esc(step.title) + '" width="800" height="500" loading="lazy" decoding="async">'
          + (step.floatChip
            ? '<span class="lwc-process-float"><span class="lwc-float-ico is-mail" aria-hidden="true"></span>'
              + esc(step.floatChip.label) + '</span>'
            : '')
          + '</div>'
          + '</article>';
      }).join('')
      + '</div>'
      + '<div class="lwc-process-action"><a class="lwc-btn lwc-btn--orange lwc-process-cta" href="#contact">' + esc(COPY.cta) + '</a></div>'
    )
    + '</section>';
}

function aboutSection(c) {
  if (!c.visibility || c.visibility.biography === false) return '';
  const COPY = copyFor(c).about;
  const contact = (c && c.contact) || {};
  return '<section class="lwc-about" id="about">'
    + shell(
      '<div class="lwc-about-grid">'
      + '<div class="lwc-about-photo">'
      + '<img src="' + esc(COPY.image) + '" alt="' + esc(firstName(c)) + ', local website partner" width="900" height="1100" loading="lazy" decoding="async">'
      + '</div>'
      + '<article class="lwc-about-panel">'
      + '<p class="lwc-eyebrow">' + esc(COPY.eyebrow) + '</p>'
      + '<h2>' + esc(COPY.headingHtml || COPY.heading).replace(/\n/g, '<br>') + '</h2>'
      + '<p>' + esc(COPY.body).replace(/\n\n/g, '</p><p>') + '</p>'
      + '<div class="lwc-about-icons">'
      + COPY.icons.map(function(item) {
        return '<span>' + strokeTick() + esc(item) + '</span>';
      }).join('')
      + '</div>'
      + '<div class="lwc-about-actions">'
      + (contact.phone
        ? '<a class="lwc-btn lwc-btn--light-outline" href="' + esc(telHref(contact.phone)) + '">' + esc(COPY.callLabel) + '</a>'
        : '')
      + (contact.email
        ? '<a class="lwc-btn lwc-btn--light-outline" href="mailto:' + esc(contact.email) + '">' + esc(COPY.emailLabel) + '</a>'
        : '')
      + (!contact.phone && !contact.email
        ? '<a class="lwc-btn lwc-btn--light-outline" href="#contact">Contact ' + esc(firstName(c)) + '</a>'
        : '')
      + '</div></article></div>'
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
          + (plan.audience ? '<p class="lwc-price-audience">' + esc(plan.audience) + '</p>' : '')
          + '<p class="lwc-price">' + esc(plan.price) + '</p>'
          + '<p class="lwc-price-note">' + esc(plan.note) + '</p>'
          + '<ul>' + plan.bullets.map(function(b) {
            return '<li><span class="lwc-tick-wrap" aria-hidden="true">' + strokeTick() + '</span><span>' + esc(b) + '</span></li>';
          }).join('') + '</ul>'
          + '<a class="lwc-btn ' + (plan.badge ? 'lwc-btn--orange' : 'lwc-btn--ghost') + ' lwc-btn--block" href="#contact">'
          + esc(plan.cta) + '</a></article>';
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
        const initial = String(item.customerName || 'L').charAt(0).toUpperCase();
        return '<blockquote class="lwc-quote">'
          + '<p>&ldquo;' + esc(item.text) + '&rdquo;</p>'
          + '<footer>'
          + '<span class="lwc-quote-mark" aria-hidden="true">' + esc(initial) + '</span>'
          + '<span><strong>' + esc(item.customerName || 'Local business owner') + '</strong>'
          + '<span>' + esc(item.businessName || item.location || 'Local business') + '</span></span>'
          + '</footer></blockquote>';
      }).join('')
      + '</div>'
    )
    + '</section>';
}

function trustSection(c) {
  if (!c.visibility || c.visibility.platformBacking === false) return '';
  const COPY = copyFor(c).trust;
  return '<section class="lwc-trust" id="trust">'
    + shell(
      '<div class="lwc-trust-band">'
      + '<div class="lwc-trust-photo">'
      + '<img src="' + esc(COPY.image) + '" alt="Local partner working on a LeadPages website" width="800" height="640" loading="lazy" decoding="async">'
      + '<div class="lwc-trust-badge" role="img" aria-label="Powered by LeadPages Australia">'
      + '<span>Powered by<br>LeadPages<br>Australia</span></div>'
      + '</div>'
      + '<div class="lwc-trust-copy">'
      + '<p class="lwc-eyebrow">' + esc(COPY.eyebrow) + '</p>'
      + '<h2>' + esc(COPY.heading) + '</h2>'
      + '<p>' + esc(COPY.powered) + '</p>'
      + '<div class="lwc-trust-strip" aria-label="Platform benefits">'
      + COPY.items.map(function(item) {
        return '<div class="lwc-trust-chip">' + strokeTick() + '<span>' + esc(item.title) + '</span></div>';
      }).join('')
      + '</div></div></div>'
    )
    + '</section>';
}

function faqSection(c) {
  if (!c.visibility || c.visibility.faqs === false) return '';
  const COPY = copyFor(c).faqs;
  const midpoint = Math.ceil(COPY.items.length / 2);
  function list(items, colIndex) {
    return '<div class="lwc-faq-col">' + items.map(function(item, i) {
      const id = 'lwc-faq-' + colIndex + '-' + i;
      return '<div class="lwc-faq-item">'
        + '<button type="button" class="lwc-faq-btn" aria-expanded="' + (i === 0 && colIndex === 0 ? 'true' : 'false') + '" aria-controls="' + id + '" data-lwc-faq>'
        + '<span>' + esc(item.question) + '</span><span class="lwc-faq-chev" aria-hidden="true"></span></button>'
        + '<div class="lwc-faq-panel" id="' + id + '"' + (i === 0 && colIndex === 0 ? '' : ' hidden') + '>'
        + '<p>' + esc(item.answer) + '</p></div></div>';
    }).join('') + '</div>';
  }
  return '<section class="lwc-section lwc-faq" id="faq">'
    + shell(
      sectionIntro(COPY)
      + '<div class="lwc-faq-grid">'
      + list(COPY.items.slice(0, midpoint), 0)
      + list(COPY.items.slice(midpoint), 1)
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
    + '<label><span>Name</span><input name="name" type="text" placeholder="Your name" required autocomplete="name"></label>'
    + '<label><span>Business name</span><input name="businessName" type="text" placeholder="Business name" autocomplete="organization"></label>'
    + '<label><span>Phone</span><input name="phone" type="tel" placeholder="Phone number" autocomplete="tel"></label>'
    + '<label><span>Email</span><input name="email" type="email" placeholder="you@business.com" autocomplete="email"></label>'
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
      + '<h2>' + esc(COPY.headingHtml || COPY.heading).replace(/\n/g, '<br>') + '</h2>'
      + '<p>' + esc(COPY.sub) + '</p>'
      + '<div class="lwc-final-contact-list">'
      + (COPY.phone
        ? '<a class="lwc-final-contact-item" href="' + esc(telHref(COPY.phone)) + '">'
          + iconSvg('phone') + '<span>Call ' + esc(COPY.phone) + '</span></a>'
        : '')
      + (COPY.email
        ? '<a class="lwc-final-contact-item" href="mailto:' + esc(COPY.email) + '">'
          + iconSvg('mail') + '<span>' + esc(COPY.email) + '</span></a>'
        : '')
      + '<a class="lwc-final-contact-item" href="#contact">'
      + iconSvg('chat') + '<span>Book a quick chat</span></a>'
      + '</div></div>'
      + contactForm(c)
      + '<div class="lwc-final-photo">'
      + '<img src="' + esc(COPY.image) + '" alt="' + esc(firstName(c)) + ' speaking with a local business client" width="720" height="900" loading="lazy" decoding="async">'
      + '</div></div>'
    )
    + '</section>';
}

function footerBlock(ctx, c) {
  const COPY = copyFor(c).footer;
  const brand = brandName(c);
  return '<footer class="lwc-footer">'
    + shell(
      '<div class="lwc-footer-grid">'
      + '<div><strong>' + esc(brand) + '</strong><p>' + esc(COPY.tagline) + '</p>'
      + (COPY.location ? '<p>' + esc(COPY.location) + '</p>' : '')
      + '</div>'
      + '<nav aria-label="Footer">'
      + '<a href="#websites">Websites</a><a href="#process">How it works</a><a href="#about">About</a>'
      + '<a href="#pricing">Pricing</a><a href="#contact">Contact</a>'
      + '<a href="' + esc(COPY.privacy) + '">Privacy</a><a href="' + esc(COPY.terms) + '">Terms</a>'
      + '</nav>'
      + '<a href="https://www.leadpages.com.au" target="_blank" rel="noopener" class="lwc-footer-powered">'
      + '<span class="leadpages-logo" data-lp-logo="auto" data-lp-logo-ink="auto" data-lp-logo-pulse="false" role="img" aria-label="LeadPages"></span>'
      + '<span>Powered by <strong>LeadPages</strong> Australia</span></a>'
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
