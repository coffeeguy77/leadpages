const { buildContext, pageShell, footerBlock, esc } = require('./shared');
const { standardSections } = require('./standard-sections');
const sections = require('../partner-website/sections');

function build(prof, partner, demos, base, opts) {
  const ctx = buildContext(prof, partner, demos, base, opts);
  const c = ctx.content;
  const h = c.hero;
  const body = ''
    + '<div class="hz-aurora" aria-hidden="true"></div>'
    + '<header class="hz-nav"><div class="pt-wrap hz-nav-inner">'
    + (ctx.logoUrl ? '<img class="hz-logo" src="' + ctx.logoUrl + '" alt="' + ctx.name + '">' : '<span class="hz-brand">' + ctx.name + '</span>')
    + '<nav><a href="#demos">Demos</a><a href="#partner">Partner</a><a href="#services">Services</a><a href="#support">Support</a></nav>'
    + '<a class="pt-btn pt-btn-primary hz-nav-cta" href="#contact">' + esc(h.primaryCta) + '</a>'
    + '</div></header>'
    + '<section class="hz-hero"><div class="pt-wrap hz-hero-inner">'
    + '<div class="hz-glass hz-hero-card">'
    + '<span class="hz-pill">' + esc(h.eyebrow) + '</span>'
    + '<h1>' + esc(h.headline) + '</h1>'
    + '<p><em>' + esc(h.highlightedPhrase) + '</em></p>'
    + '<p>' + esc(h.supportingText) + '</p>'
    + '<div class="hz-hero-btns">'
    + '<a class="pt-btn pt-btn-primary" href="#contact">' + esc(h.primaryCta) + '</a>'
    + '<a class="pt-btn pt-btn-ghost" href="' + esc(h.secondaryCtaHref) + '">' + esc(h.secondaryCta) + '</a>'
    + '</div></div></div></section>'
    + standardSections(c, { cardClass: 'hz-card pt-demo-card' })
    + sections.contactSection(c, { className: 'hz-form' })
    + footerBlock(ctx);
  return pageShell(ctx, body, { templateId: 'horizon', css: '/assets/partner-templates/horizon.css', bodyClass: 'hz-body', themeContent: c,
    fonts: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Sora:wght@400;500;600&display=swap' });
}
module.exports = { build };
