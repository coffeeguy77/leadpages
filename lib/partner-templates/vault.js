/**
 * Vault — warm craft partner landing.
 */
const {
  buildContext, pageShell, leadForm, supportBlock, powerBlock, footerBlock,
  demoPreviewUrl, esc
} = require('./shared');

function build(prof, partner, demos, base, opts) {
  const ctx = buildContext(prof, partner, demos, base, opts);
  ctx.templateKey = 'vault';

  const demosHtml = ctx.demos.map(function(d, i) {
    const url = 'https://' + ctx.base + '/' + encodeURIComponent(d.slug) + '?preview=1';
    const trade = esc((d.config && d.config.trade) || 'Local business');
    return '<article class="vt-project">'
      + '<a class="vt-project-img" href="' + url + '" target="_blank" rel="noopener">'
      + '<img src="' + esc(demoPreviewUrl(d, i)) + '" alt="" loading="lazy"></a>'
      + '<div class="vt-project-body">'
      + '<span class="vt-project-type">' + trade + '</span>'
      + '<h3><a href="' + url + '" target="_blank" rel="noopener">' + esc(d.business_name || d.slug) + '</a></h3>'
      + '<a class="vt-link" href="' + url + '" target="_blank" rel="noopener">View live site</a>'
      + '</div></article>';
  }).join('');

  const body = ''
    + '<header class="vt-header"><div class="pt-wrap vt-header-inner">'
    + '<a href="#" class="vt-brand">' + (ctx.logoUrl ? '<img src="' + ctx.logoUrl + '" alt="' + ctx.name + '">' : ctx.name) + '</a>'
    + '<nav class="vt-nav"><a href="#craft">Our craft</a><a href="#demos">Work</a><a href="#support">Care</a><a href="#contact" class="vt-nav-btn">Say hello</a></nav>'
    + '</div></header>'

    + '<section class="vt-hero"><div class="pt-wrap vt-hero-wrap">'
    + '<div class="vt-hero-badge">Handcrafted digital</div>'
    + '<h1 class="vt-hero-title">' + ctx.headline + '</h1>'
    + '<p class="vt-hero-text">' + ctx.intro + '</p>'
    + '<div class="vt-hero-trust">'
    + '<span>Trusted local partner</span><span class="vt-dot"></span><span>LeadPages backed</span>'
    + '</div></div>'
    + '<div class="vt-hero-shape" aria-hidden="true"></div>'
    + '</section>'

    + '<section class="vt-craft" id="craft"><div class="pt-wrap vt-craft-grid">'
    + '<div><h2>Built with care,<br>backed with power.</h2>'
    + '<p>We believe every local business deserves a website that feels personal — not pulled from a generic template pile. Your partner at ' + ctx.name + ' shapes the story; LeadPages powers the machinery underneath.</p></div>'
    + '<ul class="vt-craft-list">'
    + '<li>Live demo gallery for every prospect</li>'
    + '<li>Online quotes &amp; lead capture built-in</li>'
    + '<li>Real humans when you need help</li>'
    + '<li>Platform updates handled for you</li>'
    + '</ul></div></section>'

    + '<section class="vt-work" id="demos"><div class="pt-wrap">'
    + '<h2 class="vt-section-title">Selected work</h2>'
    + '<p class="vt-section-sub">Explore live demos — each one a real business site.</p>'
    + '<div class="vt-projects">' + (demosHtml || '<p>Projects coming soon.</p>') + '</div>'
    + '</div></section>'

    + powerBlock(ctx)
    + supportBlock(ctx)

    + '<section class="vt-contact" id="contact"><div class="pt-wrap vt-contact-wrap">'
    + '<div class="vt-contact-intro"><h2>Let&rsquo;s make something lasting.</h2><p>Tell us about your business — we&rsquo;d love to hear from you.</p></div>'
    + leadForm(ctx, { className: 'vt-form pt-lead-form', title: 'Send a message' })
    + '</div></section>'

    + footerBlock(ctx);

  return pageShell(ctx, body, {
    templateId: 'vault',
    css: '/assets/partner-templates/vault.css',
    bodyClass: 'vt-body',
    fonts: 'https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Nunito:wght@400;600;700;800&display=swap'
  });
}

module.exports = { build };
