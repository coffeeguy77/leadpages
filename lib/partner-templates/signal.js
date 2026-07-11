/**
 * Signal — brutalist high-contrast partner landing.
 */
const {
  buildContext, pageShell, leadForm, supportBlock, powerBlock, footerBlock,
  demoPreviewUrl, esc
} = require('./shared');

function build(prof, partner, demos, base, opts) {
  const ctx = buildContext(prof, partner, demos, base, opts);
  ctx.templateKey = 'signal';

  const demosHtml = ctx.demos.map(function(d, i) {
    const name = esc(d.business_name || d.slug);
    const img = esc(demoPreviewUrl(d, i));
    const url = 'https://' + ctx.base + '/' + encodeURIComponent(d.slug) + '?preview=1';
    return '<a class="sg-demo" href="' + url + '" target="_blank" rel="noopener">'
      + '<span class="sg-demo-num">' + String(i + 1).padStart(2, '0') + '</span>'
      + '<img src="' + img + '" alt="" loading="lazy">'
      + '<span class="sg-demo-name">' + name + '</span>'
      + '<span class="sg-demo-arrow">OPEN &rarr;</span></a>';
  }).join('');

  const body = ''
    + '<div class="sg-grid-bg" aria-hidden="true"></div>'
    + '<header class="sg-header">'
    + '<div class="pt-wrap sg-header-inner">'
    + '<a href="#" class="sg-brand">' + (ctx.logoUrl ? '<img src="' + ctx.logoUrl + '" alt="' + ctx.name + '">' : ctx.name) + '</a>'
    + '<nav class="sg-nav"><a href="#demos">DEMOS</a><a href="#power">POWER</a><a href="#support">SUPPORT</a><a href="#contact" class="sg-nav-hot">CONTACT</a></nav>'
    + '</div></header>'

    + '<section class="sg-hero">'
    + '<div class="pt-wrap">'
    + '<p class="sg-label">LEADPAGES PARTNER / LOCAL WEB AGENCY</p>'
    + '<h1 class="sg-title">' + ctx.headline + '</h1>'
    + '<p class="sg-sub">' + ctx.intro + '</p>'
    + '<div class="sg-hero-row">'
    + '<a class="sg-btn sg-btn-fill" href="#contact">GET A QUOTE</a>'
    + '<a class="sg-btn sg-btn-line" href="#demos">VIEW ' + ctx.demos.length + ' DEMOS</a>'
    + '</div></div></section>'

    + '<section class="sg-strip"><div class="pt-wrap sg-strip-inner">'
    + '<span>LOCAL SUPPORT</span><span class="sg-strip-x">+</span>'
    + '<span>LEADPAGES BACKUP</span><span class="sg-strip-x">+</span>'
    + '<span>LIVE DEMOS</span><span class="sg-strip-x">+</span>'
    + '<span>ONLINE QUOTES</span>'
    + '</div></section>'

    + '<section class="sg-demos" id="demos"><div class="pt-wrap">'
    + '<h2 class="sg-section-title">LIVE<br>SHOWCASE</h2>'
    + '<div class="sg-demo-grid">' + (demosHtml || '<p class="sg-empty">DEMOS LOADING</p>') + '</div>'
    + '</div></section>'

    + powerBlock(ctx)
    + supportBlock(ctx)

    + '<section class="sg-contact" id="contact"><div class="pt-wrap sg-contact-wrap">'
    + '<h2>LET&rsquo;S<br>BUILD.</h2>'
    + leadForm(ctx, { className: 'sg-form pt-lead-form', title: 'Enquiry' })
    + '</div></section>'

    + footerBlock(ctx);

  return pageShell(ctx, body, {
    templateId: 'signal',
    css: '/assets/partner-templates/signal.css',
    bodyClass: 'sg-body',
    fonts: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap'
  });
}

module.exports = { build };
