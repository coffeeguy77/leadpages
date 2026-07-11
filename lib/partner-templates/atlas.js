/**
 * Atlas — editorial magazine partner landing.
 */
const {
  buildContext, pageShell, leadForm, supportBlock, powerBlock, footerBlock,
  demoPreviewUrl, esc
} = require('./shared');

function build(prof, partner, demos, base, opts) {
  const ctx = buildContext(prof, partner, demos, base, opts);
  ctx.templateKey = 'atlas';

  const featured = ctx.demos[0];
  const rest = ctx.demos.slice(1, 7);
  let featuredHtml = '';
  if (featured) {
    const url = 'https://' + ctx.base + '/' + encodeURIComponent(featured.slug) + '?preview=1';
    featuredHtml = '<a class="at-featured" href="' + url + '" target="_blank" rel="noopener">'
      + '<img src="' + esc(demoPreviewUrl(featured, 0)) + '" alt="">'
      + '<div class="at-featured-cap"><span>Featured demo</span><h3>' + esc(featured.business_name || featured.slug) + '</h3></div></a>';
  }

  const restHtml = rest.map(function(d, i) {
    const url = 'https://' + ctx.base + '/' + encodeURIComponent(d.slug) + '?preview=1';
    return '<a class="at-mini" href="' + url + '" target="_blank" rel="noopener">'
      + '<img src="' + esc(demoPreviewUrl(d, i + 1)) + '" alt="" loading="lazy">'
      + '<span>' + esc(d.business_name || d.slug) + '</span></a>';
  }).join('');

  const body = ''
    + '<header class="at-masthead"><div class="pt-wrap">'
    + '<div class="at-mast-top"><span>' + ctx.name + '</span><span>Est. LeadPages Partner</span></div>'
    + '<div class="at-mast-rule"></div>'
    + '<nav class="at-mast-nav"><a href="#story">Story</a><a href="#demos">Portfolio</a><a href="#power">Systems</a><a href="#support">Support</a><a href="#contact">Enquire</a></nav>'
    + '</div></header>'

    + '<section class="at-hero"><div class="pt-wrap at-hero-grid">'
    + '<div class="at-hero-main">'
    + (ctx.logoUrl ? '<img class="at-logo" src="' + ctx.logoUrl + '" alt="' + ctx.name + '">' : '')
    + '<h1>' + ctx.headline + '</h1>'
    + '<p class="at-deck">' + ctx.intro + '</p>'
    + '<blockquote class="at-pull">&ldquo;Your local web agency — backed by a platform built for trades.&rdquo;</blockquote>'
    + '</div>'
    + '<aside class="at-hero-aside">'
    + '<div class="at-stat-stack">'
    + '<div><em>' + ctx.demos.length + '+</em><span>Live demos</span></div>'
    + '<div><em>Local</em><span>Partner care</span></div>'
    + '<div><em>24/7</em><span>Platform uptime</span></div>'
    + '</div>'
    + '<a class="pt-btn pt-btn-primary" href="#contact">Book a call</a>'
    + '</aside></div></section>'

    + '<section class="at-story" id="story"><div class="pt-wrap at-story-cols">'
    + '<h2>We don&rsquo;t sell templates.<br>We sell <em>outcomes</em>.</h2>'
    + '<div><p>Every site we launch is a conversion system — forms, quotes, portfolios, and CRM hooks wired from day one. Prospects can explore your live demo gallery before they ever pick up the phone.</p>'
    + '<p>And when something needs fixing? You talk to ' + ctx.name + ' first. LeadPages handles the engine underneath.</p></div>'
    + '</div></section>'

    + '<section class="at-portfolio" id="demos"><div class="pt-wrap">'
    + '<h2 class="at-section-label">Portfolio / Live demos</h2>'
    + '<div class="at-port-grid">' + featuredHtml + '<div class="at-port-rest">' + restHtml + '</div></div>'
    + '</div></section>'

    + powerBlock(ctx)
    + supportBlock(ctx)

    + '<section class="at-contact" id="contact"><div class="pt-wrap at-contact-split">'
    + '<div><h2>Start a project.</h2><p>Tell us about your business — we&rsquo;ll show you what&rsquo;s possible.</p></div>'
    + leadForm(ctx, { className: 'at-form pt-lead-form' })
    + '</div></section>'

    + footerBlock(ctx);

  return pageShell(ctx, body, {
    templateId: 'atlas',
    css: '/assets/partner-templates/atlas.css',
    bodyClass: 'at-body',
    fonts: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Source+Sans+3:wght@400;500;600;700&display=swap'
  });
}

module.exports = { build };
