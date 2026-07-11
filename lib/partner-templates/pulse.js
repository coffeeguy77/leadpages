/**
 * Pulse — neon dark cyber partner landing.
 */
const {
  buildContext, pageShell, leadForm, supportBlock, powerBlock, footerBlock,
  demoPreviewUrl, esc
} = require('./shared');

function build(prof, partner, demos, base, opts) {
  const ctx = buildContext(prof, partner, demos, base, opts);
  ctx.templateKey = 'pulse';

  const demosHtml = ctx.demos.map(function(d, i) {
    const url = 'https://' + ctx.base + '/' + encodeURIComponent(d.slug) + '?preview=1';
    return '<a class="pl-demo" href="' + url + '" target="_blank" rel="noopener">'
      + '<div class="pl-demo-frame"><img src="' + esc(demoPreviewUrl(d, i)) + '" alt="" loading="lazy"></div>'
      + '<span class="pl-demo-title">' + esc(d.business_name || d.slug) + '</span>'
      + '<span class="pl-demo-link">LAUNCH DEMO</span></a>';
  }).join('');

  const body = ''
    + '<div class="pl-scanlines" aria-hidden="true"></div>'
    + '<header class="pl-header"><div class="pt-wrap pl-header-inner">'
    + '<a href="#" class="pl-logo">' + (ctx.logoUrl ? '<img src="' + ctx.logoUrl + '" alt="' + ctx.name + '">' : '// ' + ctx.name) + '</a>'
    + '<nav class="pl-nav"><a href="#demos">[demos]</a><a href="#power">[platform]</a><a href="#support">[support]</a><a href="#contact">[contact]</a></nav>'
    + '</div></header>'

    + '<section class="pl-hero"><div class="pt-wrap">'
    + '<p class="pl-tag">&lt;leadpages_partner /&gt;</p>'
    + '<h1 class="pl-glitch" data-text="' + ctx.headline + '">' + ctx.headline + '</h1>'
    + '<p class="pl-hero-sub">' + ctx.intro + '</p>'
    + '<div class="pl-hero-cta">'
    + '<a class="pl-btn pl-btn-neon" href="#contact">Initialize project</a>'
    + '<a class="pl-btn pl-btn-dim" href="#demos">Access demo matrix (' + ctx.demos.length + ')</a>'
    + '</div></div></section>'

    + '<section class="pl-dual"><div class="pt-wrap pl-dual-grid">'
    + '<article><h3>// LOCAL_NODE</h3><p>' + ctx.name + ' — human support, local strategy, hands-on design. Your partner in the room.</p></article>'
    + '<article><h3>// PLATFORM_CORE</h3><p>LeadPages — hosting, apps, quotes, CRM, security. The engine that never sleeps.</p></article>'
    + '</div></section>'

    + '<section class="pl-demos" id="demos"><div class="pt-wrap">'
    + '<h2 class="pl-section">DEMO_MATRIX</h2>'
    + '<div class="pl-demo-grid">' + demosHtml + '</div>'
    + '</div></section>'

    + powerBlock(ctx)
    + supportBlock(ctx)

    + '<section class="pl-contact" id="contact"><div class="pt-wrap pl-contact-box">'
    + '<h2>Transmit enquiry</h2>'
    + leadForm(ctx, { className: 'pl-form pt-lead-form' })
    + '</div></section>'

    + footerBlock(ctx);

  return pageShell(ctx, body, {
    templateId: 'pulse',
    css: '/assets/partner-templates/pulse.css',
    bodyClass: 'pl-body',
    fonts: 'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap',
    extraVars: { neon: ctx.pal.glow }
  });
}

module.exports = { build };
