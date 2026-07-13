/**
 * Web Culture premium partner theme — section renderers.
 */
const { esc } = require('./shared');
const { partnerLogoDisplayUrl } = require('../partner-website/logo');
const {
  buildWebcultureCopy,
  groupDemosByIndustryTab,
  pickHeroDemos,
  SERVICE_PILLARS,
  WEBCULTURE_PROCESS,
  LEAD_FLOW_STEPS
} = require('../partner-website/webculture-theme');
const prm = require('./premium-components');
const { webcultureCloudMark } = require('./premium-icons');

function shell(inner) {
  return '<div class="wc-shell">' + inner + '</div>';
}

function copyFor(content) {
  return buildWebcultureCopy(content);
}

function heroFields(c) {
  const themed = copyFor(c).hero || {};
  const resolved = c.hero || {};
  return {
    eyebrow: themed.eyebrow,
    headline: themed.headline,
    highlightedPhrase: themed.highlight || resolved.highlightedPhrase || 'work harder',
    supportingText: themed.supporting,
    primaryCta: themed.primaryCta,
    secondaryCta: themed.secondaryCta,
    primaryCtaHref: resolved.primaryCtaHref || '#contact',
    secondaryCtaHref: resolved.secondaryCtaHref || '#demos'
  };
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

function wordmarkHtml(brand, extraClass) {
  const parts = String(brand || '').trim().split(/\s+/);
  const cls = 'wc-wordmark' + (extraClass ? ' ' + extraClass : '');
  if (parts.length >= 2) {
    return '<span class="' + cls + '"><span class="wc-wordmark-web">' + esc(parts[0].toUpperCase()) + '</span> '
      + '<span class="wc-wordmark-culture">' + esc(parts.slice(1).join(' ').toUpperCase()) + '</span></span>';
  }
  return '<span class="' + cls + '"><span class="wc-wordmark-web">' + esc(String(brand).toUpperCase()) + '</span></span>';
}

function brandLinkHtml(c, ctx) {
  const brand = brandName(c);
  const src = logoSrc(ctx, 320);
  if (src) {
    return '<a href="#top" class="wc-brand wc-brand-lockup">'
      + '<img src="' + src + '" alt="' + esc(brand) + '" class="wc-nav-logo" decoding="async" fetchpriority="high">'
      + '</a>';
  }
  return '<a href="#top" class="wc-brand wc-brand-text">' + wordmarkHtml(brand) + '</a>';
}

function emphasizeHeading(text, words) {
  let html = esc(String(text || ''));
  (words || []).forEach(function(w) {
    const re = new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'i');
    html = html.replace(re, '<span class="wc-highlight">$1</span>');
  });
  return html;
}

function highlightHeadline(headline, hint) {
  const text = String(headline || '').trim();
  if (!text) return '';
  const hintStr = String(hint || '').trim();
  if (hintStr) {
    const idx = text.toLowerCase().indexOf(hintStr.toLowerCase());
    if (idx >= 0) {
      return esc(text.slice(0, idx))
        + '<span class="wc-highlight">' + esc(text.slice(idx, idx + hintStr.length)) + '</span>'
        + esc(text.slice(idx + hintStr.length));
    }
  }
  const phrases = [];
  const regionMatch = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+businesses\b/);
  if (regionMatch) phrases.push(regionMatch[0]);
  if (/work harder/i.test(text)) {
    const wh = text.match(/work harder/i);
    if (wh) phrases.push(wh[0]);
  }
  if (/enquir/i.test(text)) {
    const em = text.match(/\bmore\s+enquiries?\.?/i) || text.match(/\benquiries?\.?/i);
    if (em) phrases.push(em[0]);
  }
  if (!phrases.length) return esc(text);
  let out = text;
  let html = '';
  phrases.forEach(function(phrase) {
    const idx = out.toLowerCase().indexOf(phrase.toLowerCase());
    if (idx < 0) return;
    html += esc(out.slice(0, idx))
      + '<span class="wc-highlight">' + esc(out.slice(idx, idx + phrase.length)) + '</span>';
    out = out.slice(idx + phrase.length);
  });
  return html + esc(out);
}

function formatHeroSupporting(text, agencyName) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const emphasis = [
    'generates enquiries',
    'live demos',
    'LeadPages platform',
    'local support every step of the way'
  ];
  const parts = raw.split(/(?<=\.)\s+(?=Explore)/);

  function fmt(part) {
    let html = esc(part);
    if (agencyName) {
      const re = new RegExp('(' + String(agencyName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'g');
      html = html.replace(re, '<strong class="wc-lead-brand">$1</strong>');
    }
    emphasis.forEach(function(phrase) {
      const re = new RegExp('(' + phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      html = html.replace(re, '<span class="wc-lead-em">$1</span>');
    });
    return html;
  }

  if (parts.length > 1) {
    return parts.map(function(part, i) {
      const cls = 'wc-hero-lead' + (i > 0 ? ' wc-hero-lead--secondary' : '');
      return '<p class="' + cls + '">' + fmt(part.trim()) + '</p>';
    }).join('');
  }
  return '<p class="wc-hero-lead">' + fmt(raw) + '</p>';
}

function navBlock(c, ctx) {
  const hero = heroFields(c);
  const COPY = copyFor(c);
  return '<header class="wc-header">'
    + shell(
      brandLinkHtml(c, ctx)
      + '<nav class="wc-nav wc-nav-links" aria-label="Primary">'
      + COPY.nav.map(function(link) {
        const arrow = link.arrow ? ' <span class="wc-nav-arrow" aria-hidden="true">→</span>' : '';
        return '<a href="' + esc(link.href) + '">' + esc(link.label) + arrow + '</a>';
      }).join('')
      + '</nav>'
      + '<a class="wc-btn wc-btn-primary wc-header-cta" href="#contact">' + esc(hero.primaryCta) + '</a>'
      + '<button class="wc-btn wc-btn-ghost wc-menu-btn" type="button" aria-label="Menu" data-pt-menu>Menu</button>'
    )
    + '</header>';
}

function heroSection(c, ctx) {
  if (!c.visibility || c.visibility.hero === false) return '';
  const hero = heroFields(c);
  const COPY = copyFor(c);
  const heroDemos = pickHeroDemos(c.demos, 5);
  const trust = COPY.heroTrust.map(function(it) {
    return '<li><span class="wc-trust-check" aria-hidden="true">✓</span>' + esc(it.label) + '</li>';
  }).join('');

  return '<section class="wc-section wc-hero" id="top">'
    + shell(
      '<div class="wc-hero-grid">'
      + '<div class="wc-hero-copy">'
      + (hero.eyebrow ? '<p class="wc-eyebrow wc-eyebrow--pill">' + esc(hero.eyebrow) + '</p>' : '')
      + '<h1 class="wc-display prm-serif wc-hero-title">' + highlightHeadline(hero.headline, hero.highlightedPhrase) + '</h1>'
      + '<div class="wc-hero-lead-wrap">' + formatHeroSupporting(hero.supportingText, brandName(c)) + '</div>'
      + '<div class="wc-hero-actions">'
      + '<a class="wc-btn wc-btn-primary" href="' + esc(hero.secondaryCtaHref || '#demos') + '">'
      + esc(hero.secondaryCta || 'Explore Live Demos') + ' →</a>'
      + '<a class="wc-btn wc-btn-ghost" href="#contact">' + esc(hero.primaryCta || 'Plan My Website') + '</a>'
      + '</div>'
      + (trust ? '<ul class="wc-trust-row">' + trust + '</ul>' : '')
      + '</div>'
      + prm.HeroWebsiteShowcase(heroDemos, { toast: COPY.quoteToast })
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
    const cloudMod = card.icon === 'cloud' ? ' prm-proof-card--cloud' : '';
    const ringClass = 'prm-icon-ring--proof' + (card.icon === 'cloud' ? ' prm-icon-ring--cloud' : '');
    return '<article class="prm-proof-card' + cloudMod + '">'
      + prm.iconRing(card.icon, ringClass)
      + '<div class="prm-proof-copy">'
      + '<h3>' + esc(card.title) + '</h3>'
      + '<p>' + esc(card.body) + '</p>'
      + '</div></article>';
  }).join('');

  return '<section class="wc-section wc-section--ink wc-connected" id="platform">'
    + shell(
      '<div class="wc-connected-grid">'
      + prm.LeadFlowDiagram(LEAD_FLOW_STEPS, {
        heading: COPY.heading,
        eyebrow: COPY.eyebrow
      })
      + '<div class="wc-proof-col">'
      + '<p class="prm-proof-heading">' + esc(COPY.proofHeading || 'YOU GET') + '</p>'
      + '<div class="wc-proof-cards">' + cards + '</div>'
      + '</div>'
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
  const sc = copyFor(c).services;
  return '<section class="wc-section wc-section--ink wc-services" id="services">'
    + shell(
      '<p class="wc-eyebrow wc-eyebrow--pill">' + esc(sc.eyebrow) + '</p>'
      + '<h2 class="wc-h1 prm-serif">' + esc(sc.heading) + '</h2>'
      + '<div class="wc-service-grid">'
      + SERVICE_PILLARS.map(function(p) { return prm.ServiceCard(p); }).join('')
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
        + '<h2 class="wc-h2 prm-serif prm-on-dark">' + esc(prc.eyebrow) + '</h2>'
        + prm.Timeline(WEBCULTURE_PROCESS)
        + (regionLine ? '<p class="wc-region-line">' + esc(regionLine) + '</p>' : '')
        + '</div>' : '')
      + '</div>'
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

  return '<section class="wc-section wc-section--ink wc-testimonials-contact" id="contact">'
    + shell(
      '<div class="wc-testimonials-contact-grid">'
      + (showTestimonials && featured
        ? '<div class="wc-testimonial-col">'
          + prm.ReviewCard(featured)
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

function footerBrandHtml(c) {
  const brand = brandName(c);
  return '<a href="#top" class="wc-footer-lockup" aria-label="' + esc(brand) + '">'
    + webcultureCloudMark()
    + wordmarkHtml(brand, 'wc-wordmark--footer')
    + '</a>';
}

function stickyCtaBlock(c) {
  const hero = heroFields(c);
  const label = hero.primaryCta || 'Plan My Website';
  return '<a href="#contact" class="wc-sticky-cta" data-wc-sticky-cta hidden>'
    + esc(label) + ' →</a>';
}

function footerBlock(ctx, c) {
  const content = c || {};
  const brand = brandName(content);
  const fc = copyFor(content).footer || {};

  return '<footer class="wc-footer">'
    + shell(
      '<div class="wc-footer-grid">'
      + '<div class="wc-footer-brand">' + footerBrandHtml(content) + '</div>'
      + '<nav class="wc-footer-nav" aria-label="Footer">'
      + '<a href="#services">Websites</a>'
      + '<a href="#demos">Services</a>'
      + '<a href="#process">Process</a>'
      + '<a href="#partner">About</a>'
      + '<a href="#contact">Contact</a>'
      + '<a href="/privacy-policy.html">Privacy</a>'
      + '<a href="/terms-of-use.html">Terms</a>'
      + '</nav>'
      + '<div class="wc-footer-lp">'
      + '<p class="wc-footer-lp-eyebrow">Powered by</p>'
      + '<a href="https://www.leadpages.com.au" target="_blank" rel="noopener" class="wc-footer-lp-link" aria-label="LeadPages">'
      + '<span class="wc-footer-lp-logo leadpages-logo" data-lp-logo="auto" data-lp-logo-ink="light" data-lp-logo-pulse role="img"></span>'
      + '</a>'
      + '</div>'
      + '</div>'
      + (fc.localLine ? '<p class="wc-footer-local">' + esc(fc.localLine) + '</p>' : '')
      + '<p class="wc-footer-copy">&copy; ' + esc(ctx.year) + ' ' + esc(brand) + '</p>'
    )
    + '</footer>';
}

function allSections(c, ctx) {
  return ''
    + connectedSection(c)
    + demoShowcaseSection(c)
    + servicesSection(c)
    + partnerProcessSection(c, ctx)
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
  testimonialsContactSection,
  finalCtaSection,
  stickyCtaBlock,
  footerBlock,
  allSections
};
