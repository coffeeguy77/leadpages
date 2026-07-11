const { buildContext, pageShell, footerBlock, esc } = require('./shared');
const { standardSections } = require('./standard-sections');
const sections = require('../partner-website/sections');

function build(prof, partner, demos, base, opts) {
  const ctx = buildContext(prof, partner, demos, base, opts);
  const c = ctx.content;
  const h = c.hero;
  const body = ''
    + '<header class="at-masthead"><div class="pt-wrap">'
    + '<div class="at-mast-top"><span>' + esc(c.partner.agencyName) + '</span><span>LeadPages Partner</span></div>'
    + '<div class="at-mast-rule"></div>'
    + '<nav class="at-mast-nav"><a href="#partner">Partner</a><a href="#demos">Portfolio</a><a href="#services">Services</a><a href="#support">Support</a><a href="#contact">Enquire</a></nav>'
    + '</div></header>'
    + '<section class="at-hero"><div class="pt-wrap at-hero-grid">'
    + '<div class="at-hero-main">'
    + (ctx.logoUrl ? '<img class="at-logo" src="' + ctx.logoUrl + '" alt="' + ctx.name + '">' : '')
    + '<p class="pt-eyebrow">' + esc(h.eyebrow) + '</p>'
    + '<h1>' + esc(h.headline) + '</h1>'
    + '<p class="at-deck">' + esc(h.supportingText) + '</p>'
    + '<blockquote class="at-pull">&ldquo;' + esc(h.highlightedPhrase) + '&rdquo;</blockquote>'
    + '</div><aside class="at-hero-aside">'
    + '<a class="pt-btn pt-btn-primary" href="#contact">' + esc(h.primaryCta) + '</a>'
    + '<a class="pt-btn pt-btn-ghost" href="' + esc(h.secondaryCtaHref) + '" style="margin-top:12px;display:inline-flex">' + esc(h.secondaryCta) + '</a>'
    + '</aside></div></section>'
    + standardSections(c, { cardClass: 'at-mini pt-demo-card' })
    + sections.contactSection(c, { className: 'at-form' })
    + footerBlock(ctx);
  return pageShell(ctx, body, { templateId: 'atlas', css: '/assets/partner-templates/atlas.css', bodyClass: 'at-body', themeContent: c,
    fonts: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Source+Sans+3:wght@400;500;600;700&display=swap' });
}
module.exports = { build };
