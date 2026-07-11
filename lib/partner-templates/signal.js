const { buildContext, pageShell, footerBlock, esc } = require('./shared');
const { standardSections } = require('./standard-sections');
const sections = require('../partner-website/sections');

function build(prof, partner, demos, base, opts) {
  const ctx = buildContext(prof, partner, demos, base, opts);
  const c = ctx.content;
  const h = c.hero;
  const body = ''
    + '<div class="sg-grid-bg" aria-hidden="true"></div>'
    + '<header class="sg-header"><div class="pt-wrap sg-header-inner">'
    + '<a href="#" class="sg-brand">' + (ctx.logoUrl ? '<img src="' + ctx.logoUrl + '" alt="' + ctx.name + '">' : ctx.name) + '</a>'
    + '<nav class="sg-nav"><a href="#demos">DEMOS</a><a href="#partner">PARTNER</a><a href="#services">SERVICES</a><a href="#support">SUPPORT</a><a href="#contact" class="sg-nav-hot">CONTACT</a></nav>'
    + '</div></header>'
    + '<section class="sg-hero"><div class="pt-wrap">'
    + '<p class="sg-label">' + esc(h.eyebrow) + '</p>'
    + '<h1 class="sg-title">' + esc(h.headline) + '</h1>'
    + '<p class="sg-sub">' + esc(h.supportingText) + '</p>'
    + '<p class="sg-highlight">' + esc(h.highlightedPhrase) + '</p>'
    + '<div class="sg-hero-row">'
    + '<a class="sg-btn sg-btn-fill" href="#contact">' + esc(h.primaryCta) + '</a>'
    + '<a class="sg-btn sg-btn-line" href="' + esc(h.secondaryCtaHref) + '">' + esc(h.secondaryCta) + '</a>'
    + '</div></div></section>'
    + '<section class="sg-strip"><div class="pt-wrap sg-strip-inner">'
    + '<span>LOCAL: ' + esc(c.partner.displayName) + '</span><span class="sg-strip-x">+</span>'
    + '<span>LEADPAGES BACKUP</span><span class="sg-strip-x">+</span>'
    + '<span>' + (c.demos.length || 0) + ' LIVE DEMOS</span>'
    + '</div></section>'
    + standardSections(c, { cardClass: 'sg-demo pt-demo-card' })
    + sections.contactSection(c, { className: 'sg-form' })
    + footerBlock(ctx);
  return pageShell(ctx, body, { templateId: 'signal', css: '/assets/partner-templates/signal.css', bodyClass: 'sg-body', themeContent: c,
    fonts: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap' });
}
module.exports = { build };
