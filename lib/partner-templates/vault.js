const { buildContext, pageShell, footerBlock, esc } = require('./shared');
const { standardSections } = require('./standard-sections');
const sections = require('../partner-website/sections');

function build(prof, partner, demos, base, opts) {
  const ctx = buildContext(prof, partner, demos, base, opts);
  const c = ctx.content;
  const h = c.hero;
  const body = ''
    + '<header class="vt-header"><div class="pt-wrap vt-header-inner">'
    + '<a href="#" class="vt-brand">' + (ctx.logoUrl ? '<img src="' + ctx.logoUrl + '" alt="' + ctx.name + '">' : ctx.name) + '</a>'
    + '<nav class="vt-nav"><a href="#partner">About</a><a href="#demos">Work</a><a href="#services">Services</a><a href="#contact" class="vt-nav-btn">' + esc(h.primaryCta) + '</a></nav>'
    + '</div></header>'
    + '<section class="vt-hero"><div class="pt-wrap vt-hero-wrap">'
    + '<div class="vt-hero-badge">' + esc(h.eyebrow) + '</div>'
    + '<h1 class="vt-hero-title">' + esc(h.headline) + '</h1>'
    + '<p class="vt-hero-highlight">' + esc(h.highlightedPhrase) + '</p>'
    + '<p class="vt-hero-text">' + esc(h.supportingText) + '</p>'
    + '<div class="vt-hero-trust"><span>' + esc(c.partner.displayName) + '</span><span class="vt-dot"></span><span>LeadPages backed</span></div>'
    + '</div><div class="vt-hero-shape" aria-hidden="true"></div></section>'
    + standardSections(c, { cardClass: 'vt-project pt-demo-card' })
    + sections.contactSection(c, { className: 'vt-form' })
    + footerBlock(ctx);
  return pageShell(ctx, body, { templateId: 'vault', css: '/assets/partner-templates/vault.css', bodyClass: 'vt-body', themeContent: c,
    fonts: 'https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Nunito:wght@400;600;700;800&display=swap' });
}
module.exports = { build };
