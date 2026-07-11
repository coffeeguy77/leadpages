/**
 * Cause House — editorial big-type partner landing.
 */
const {
  buildContext, pageShell, leadForm, supportBlock, powerBlock, footerBlock,
  demoPreviewUrl, esc
} = require('./shared');

function demoCard(ctx, demo, i) {
  const cfg = demo.config || {};
  const trade = esc((cfg.trade || 'Local business').toString());
  const name = esc(demo.business_name || demo.slug);
  const img = esc(demoPreviewUrl(demo, i));
  const url = 'https://' + ctx.base + '/' + encodeURIComponent(demo.slug) + '?preview=1';
  return '<article class="ch-demo-card">'
    + '<a class="ch-demo-img" href="' + url + '" target="_blank" rel="noopener">'
    + '<img src="' + img + '" alt="' + name + '" loading="lazy"></a>'
    + '<div class="ch-demo-body">'
    + '<span class="ch-demo-cat">' + trade + '</span>'
    + '<h3><a href="' + url + '" target="_blank" rel="noopener">' + name + '</a></h3>'
    + '<p>Live demo — open in a new tab and explore the full site.</p>'
    + '<a class="pt-btn pt-btn-text" href="' + url + '" target="_blank" rel="noopener">Explore demo &rarr;</a>'
    + '</div></article>';
}

function build(prof, partner, demos, base, opts) {
  const ctx = buildContext(prof, partner, demos, base, opts);
  ctx.templateKey = 'causehouse';

  const rawHeadline = prof.showcase_headline || 'Websites that win you more customers';
  const parts = String(rawHeadline).trim().split(/\s+/);
  const word1 = parts.slice(0, 2).join(' ') || 'Build the';
  const word2 = parts.slice(2).join(' ') || 'house your business grows in';

  const demoHtml = ctx.demos.length
    ? ctx.demos.map(function(d, i) { return demoCard(ctx, d, i); }).join('')
    : '<p class="ch-empty">Demo showcase coming soon — your partner is adding live examples.</p>';

  const body = ''
    + '<header class="ch-nav">'
    + '<div class="pt-wrap ch-nav-inner">'
    + (ctx.logoUrl ? '<a href="#" class="ch-logo"><img src="' + ctx.logoUrl + '" alt="' + ctx.name + '"></a>' : '<a href="#" class="ch-logo-text">' + ctx.name + '</a>')
    + '<nav class="ch-nav-links" aria-label="Primary">'
    + '<a href="#about">About</a><a href="#demos">Work</a><a href="#power">Platform</a><a href="#support">Support</a><a href="#contact" class="ch-nav-cta">Work with us</a>'
    + '</nav>'
    + '<button class="ch-menu-btn" type="button" aria-label="Menu" data-pt-menu><span></span><span></span></button>'
    + '</div></header>'

    + '<section class="ch-hero" id="top">'
    + '<div class="pt-wrap">'
    + '<p class="ch-hero-eyebrow">LeadPages partner agency</p>'
    + '<h1 class="ch-hero-title">'
    + '<span class="ch-word-line">' + esc(word1) + '</span>'
    + '<span class="ch-word-art" data-text="' + esc(word2) + '">' + esc(word2) + '</span>'
    + '</h1>'
    + '<p class="ch-hero-lead">' + ctx.intro + '</p>'
    + '<div class="ch-hero-actions">'
    + '<a class="pt-btn pt-btn-primary" href="#contact">Work with ' + ctx.name + '</a>'
    + '<a class="pt-btn pt-btn-ghost" href="#demos">Explore live demos</a>'
    + '</div>'
    + '<div class="ch-hero-stats">'
    + '<div><strong>' + (ctx.demos.length || '12') + '+</strong><span>Live demo sites</span></div>'
    + '<div><strong>Local</strong><span>Partner support</span></div>'
    + '<div><strong>LeadPages</strong><span>Platform backup</span></div>'
    + '</div></div>'
    + '<div class="ch-hero-scroll" aria-hidden="true">Scroll</div>'
    + '</section>'

    + '<section class="ch-about" id="about">'
    + '<div class="pt-wrap ch-about-grid">'
    + '<div class="ch-about-copy">'
    + '<p class="pt-eyebrow">About ' + ctx.name + '</p>'
    + '<h2>Websites, lead systems, and growth infrastructure for local businesses.</h2>'
    + '<p>We help trade and service businesses build the digital foundation behind sustainable growth — from high-converting websites and live demo showcases to CRM-ready forms, online quotes, and reporting that actually makes sense.</p>'
    + '<p>Everything is designed to work together, so trust, enquiries, and long-term engagement can scale.</p>'
    + '</div>'
    + '<div class="ch-about-cards">'
    + '<article><span>01</span><h3>Systems, not one-off pages</h3><p>We map the full customer journey — from first visit to enquiry, follow-up, and retention.</p></article>'
    + '<article><span>02</span><h3>Creative with accountability</h3><p>Design, messaging, and conversion tools live inside one measurable framework.</p></article>'
    + '<article><span>03</span><h3>Connected infrastructure</h3><p>Your site, forms, quotes, and CRM should work as one ecosystem — not disconnected tools.</p></article>'
    + '</div></div></section>'

    + '<section class="ch-demos" id="demos">'
    + '<div class="pt-wrap">'
    + '<div class="ch-section-head">'
    + '<p class="pt-eyebrow">Live showcase</p>'
    + '<h2>See what we build.<br><em>Click any demo.</em></h2>'
    + '<p>Real trade websites your partner has crafted — explore live in your browser before you commit.</p>'
    + '</div>'
    + '<div class="ch-demo-grid">' + demoHtml + '</div>'
    + '</div></section>'

    + powerBlock(ctx)
    + supportBlock(ctx)

    + '<section class="ch-contact" id="contact">'
    + '<div class="pt-wrap ch-contact-grid">'
    + '<div class="ch-contact-copy">'
    + '<p class="pt-eyebrow">Get in touch</p>'
    + '<h2>Tell us what you&rsquo;re building.</h2>'
    + '<p>Share a bit about your business and how we can help. You&rsquo;re in great hands — local partner care, backed by LeadPages.</p>'
    + '<ul class="ch-contact-perks">'
    + '<li>Response within one business day</li>'
    + '<li>Free strategy conversation</li>'
    + '<li>No obligation quote</li>'
    + '</ul></div>'
    + leadForm(ctx, { className: 'ch-form pt-lead-form', title: 'Start the conversation' })
    + '</div></section>'

    + footerBlock(ctx);

  return pageShell(ctx, body, {
    templateId: 'causehouse',
    css: '/assets/partner-templates/causehouse.css',
    bodyClass: 'ch-body',
    fonts: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700;9..144,800&family=DM+Sans:wght@400;500;600;700&display=swap'
  });
}

module.exports = { build };
