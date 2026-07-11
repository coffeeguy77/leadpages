const { buildContext, pageShell, footerBlock, esc } = require('./shared');
const { standardSections } = require('./standard-sections');
const sections = require('../partner-website/sections');

function build(prof, partner, demos, base, opts) {
  const ctx = buildContext(prof, partner, demos, base, opts);
  const c = ctx.content;
  const h = c.hero;
  const body = ''
    + '<div class="pl-scanlines" aria-hidden="true"></div>'
    + '<header class="pl-header"><div class="pt-wrap pl-header-inner">'
    + '<a href="#" class="pl-logo">' + (ctx.logoUrl ? '<img src="' + ctx.logoUrl + '" alt="' + ctx.name + '">' : '// ' + ctx.name) + '</a>'
    + '<nav class="pl-nav"><a href="#demos">[demos]</a><a href="#partner">[partner]</a><a href="#services">[services]</a><a href="#contact">[contact]</a></nav>'
    + '</div></header>'
    + '<section class="pl-hero"><div class="pt-wrap">'
    + '<p class="pl-tag">' + esc(h.eyebrow) + '</p>'
    + '<h1 class="pl-glitch" data-text="' + esc(h.headline) + '">' + esc(h.headline) + '</h1>'
    + '<p class="pl-hero-sub">' + esc(h.supportingText) + '</p>'
    + '<p class="pl-highlight">' + esc(h.highlightedPhrase) + '</p>'
    + '<div class="pl-hero-cta">'
    + '<a class="pl-btn pl-btn-neon" href="#contact">' + esc(h.primaryCta) + '</a>'
    + '<a class="pl-btn pl-btn-dim" href="' + esc(h.secondaryCtaHref) + '">' + esc(h.secondaryCta) + '</a>'
    + '</div></div></section>'
    + standardSections(c, { cardClass: 'pl-demo pt-demo-card' })
    + sections.contactSection(c, { className: 'pl-form' })
    + footerBlock(ctx);
  return pageShell(ctx, body, { templateId: 'pulse', css: '/assets/partner-templates/pulse.css', bodyClass: 'pl-body', themeContent: c,
    fonts: 'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap',
    extraVars: { neon: ctx.pal.glow } });
}
module.exports = { build };
