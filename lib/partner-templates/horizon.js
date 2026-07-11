/**
 * Horizon — glass/light futuristic partner landing.
 */
const {
  buildContext, pageShell, leadForm, supportBlock, powerBlock, footerBlock,
  demoPreviewUrl, esc
} = require('./shared');

function build(prof, partner, demos, base, opts) {
  const ctx = buildContext(prof, partner, demos, base, opts);
  ctx.templateKey = 'horizon';

  const cards = ctx.demos.map(function(d, i) {
    const url = 'https://' + ctx.base + '/' + encodeURIComponent(d.slug) + '?preview=1';
    return '<a class="hz-card" href="' + url + '" target="_blank" rel="noopener">'
      + '<div class="hz-card-img"><img src="' + esc(demoPreviewUrl(d, i)) + '" alt="" loading="lazy"></div>'
      + '<div class="hz-card-body"><h3>' + esc(d.business_name || d.slug) + '</h3>'
      + '<span>Live demo &rarr;</span></div></a>';
  }).join('');

  const body = ''
    + '<div class="hz-aurora" aria-hidden="true"></div>'
    + '<header class="hz-nav"><div class="pt-wrap hz-nav-inner">'
    + (ctx.logoUrl ? '<img class="hz-logo" src="' + ctx.logoUrl + '" alt="' + ctx.name + '">' : '<span class="hz-brand">' + ctx.name + '</span>')
    + '<nav><a href="#demos">Demos</a><a href="#power">Platform</a><a href="#support">Support</a></nav>'
    + '<a class="pt-btn pt-btn-primary hz-nav-cta" href="#contact">Get started</a>'
    + '</div></header>'

    + '<section class="hz-hero"><div class="pt-wrap hz-hero-inner">'
    + '<div class="hz-glass hz-hero-card">'
    + '<span class="hz-pill">LeadPages partner studio</span>'
    + '<h1>' + ctx.headline + '</h1>'
    + '<p>' + ctx.intro + '</p>'
    + '<div class="hz-hero-btns">'
    + '<a class="pt-btn pt-btn-primary" href="#demos">Browse demos</a>'
    + '<a class="pt-btn pt-btn-ghost" href="#contact">Talk to us</a>'
    + '</div></div>'
    + '<div class="hz-float-stats">'
    + '<div class="hz-glass"><strong>' + ctx.demos.length + '+</strong><span>Live sites</span></div>'
    + '<div class="hz-glass"><strong>Local</strong><span>Your partner</span></div>'
    + '<div class="hz-glass"><strong>Backed</strong><span>By LeadPages</span></div>'
    + '</div></div></section>'

    + '<section class="hz-demos" id="demos"><div class="pt-wrap">'
    + '<h2>Explore live work</h2>'
    + '<p class="hz-sub">Tap any card — these are real sites you can walk through today.</p>'
    + '<div class="hz-grid">' + (cards || '<p class="hz-empty">Demos appearing soon.</p>') + '</div>'
    + '</div></section>'

    + powerBlock(ctx)
    + supportBlock(ctx)

    + '<section class="hz-contact" id="contact"><div class="pt-wrap">'
    + '<div class="hz-glass hz-contact-card">'
    + '<h2>Ready when you are.</h2>'
    + leadForm(ctx, { className: 'hz-form pt-lead-form' })
    + '</div></div></section>'

    + footerBlock(ctx);

  return pageShell(ctx, body, {
    templateId: 'horizon',
    css: '/assets/partner-templates/horizon.css',
    bodyClass: 'hz-body',
    fonts: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Sora:wght@400;500;600&display=swap'
  });
}

module.exports = { build };
