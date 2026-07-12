/**
 * Cause House — editorial big-type partner landing.
 */
const { buildContext, pageShell, footerBlock, esc } = require('./shared');
const sections = require('../partner-website/sections');

function build(prof, partner, demos, base, opts) {
  const ctx = buildContext(prof, partner, demos, base, opts);
  const c = ctx.content;
  if (!c) throw new Error('themeContent required');

  const hero = c.hero;
  const rawHeadline = hero.headline || 'Websites built for local businesses';
  const parts = String(rawHeadline).trim().split(/\s+/);
  const word1 = parts.slice(0, 2).join(' ') || 'Websites built';
  const word2 = parts.slice(2).join(' ') || 'for local businesses';
  const highlight = hero.highlightedPhrase || '';

  const body = ''
    + '<header class="ch-nav">'
    + '<div class="pt-wrap ch-nav-inner">'
    + (ctx.logoUrl ? '<a href="#" class="ch-logo"><img src="' + ctx.logoUrl + '" alt="' + ctx.name + '"></a>' : '<a href="#" class="ch-logo-text">' + ctx.name + '</a>')
    + '<nav class="ch-nav-links" aria-label="Primary">'
    + '<a href="#partner">About</a><a href="#demos">Work</a><a href="#services">Services</a><a href="#support">Support</a><a href="#contact" class="ch-nav-cta">' + esc(hero.primaryCta) + '</a>'
    + '</nav>'
    + '<button class="ch-menu-btn" type="button" aria-label="Menu" data-pt-menu><span></span><span></span></button>'
    + '</div></header>'

    + '<section class="ch-hero" id="top">'
    + '<div class="pt-wrap">'
    + '<p class="ch-hero-eyebrow">' + esc(hero.eyebrow) + '</p>'
    + '<h1 class="ch-hero-title">'
    + '<span class="ch-word-line">' + esc(word1) + '</span>'
    + '<span class="ch-word-art" data-text="' + esc(word2) + '">' + esc(word2) + '</span>'
    + (highlight ? '<span class="ch-hero-highlight">' + esc(highlight) + '</span>' : '')
    + '</h1>'
    + '<p class="ch-hero-lead">' + esc(hero.supportingText) + '</p>'
    + '<div class="ch-hero-actions">'
    + '<a class="pt-btn pt-btn-primary" href="#contact">' + esc(hero.primaryCta) + '</a>'
    + '<a class="pt-btn pt-btn-ghost" href="' + esc(hero.secondaryCtaHref) + '">' + esc(hero.secondaryCta) + '</a>'
    + '</div>'
    + sections.metricsBar(c)
    + '</div></section>'

    + sections.trustBar(c)
    + sections.industriesSection(c)
    + sections.demosSection(c, { cardClass: 'ch-demo-card pt-demo-card' })
    + sections.servicesSection(c)
    + sections.benefitsSection(c)
    + sections.processSection(c)
    + sections.caseStudiesSection(c)
    + sections.biographySection(c)
    + sections.serviceAreaSection(c)
    + sections.platformBackingSection(c)
    + sections.testimonialsSection(c)
    + sections.faqsSection(c)
    + sections.leadOfferSection(c)
    + sections.contactSection(c, { className: 'ch-form', sectionClass: 'ch-contact' })
    + footerBlock(ctx);

  return pageShell(ctx, body, {
    templateId: 'causehouse',
    css: '/assets/partner-templates/causehouse.css',
    bodyClass: 'ch-body',
    themeContent: c,
    fonts: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700;9..144,800&family=Inter:wght@400;500;600;700&display=swap',
    extraVars: {
      'pt-accent': '#c53a20',
      'pt-brand': '#bfea4b',
      'pt-ink': '#1d2b1f',
      'pt-bg': '#f7f0e6',
      'pt-glow': '#b9d9c4'
    }
  });
}

module.exports = { build };
