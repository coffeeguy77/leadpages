// lib/partner-landing.js — Converge Studio partner showcase landing (server HTML)

const esc = (s) => String(s ?? '').replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const hexOr = (v, d) => (/^#[0-9a-fA-F]{3,8}$/.test(v || '') ? v : d);

const FALLBACK_IMAGES = [
  '/assets/partner-landing/images/dental.jpg',
  '/assets/partner-landing/images/law.jpg',
  '/assets/partner-landing/images/hvac.jpg',
  '/assets/partner-landing/images/fitness.jpg',
  '/assets/partner-landing/images/roofing.jpg',
  '/assets/partner-landing/images/realty.jpg',
];

function resolveLandingTheme(cfg) {
  cfg = cfg || {};
  const theme = cfg.theme || {};
  const accent = hexOr(theme.hivis, hexOr(cfg.accent, '#7b2fff'));
  const brand = hexOr(theme.pipe, accent);
  const ink = hexOr(theme.steel, '#080808');
  const hi = hexOr(theme.lightBg, '#0d0d12');
  const glow = hexOr(theme.safety, '#b44fff');
  return { accent, brand, ink, hi, glow };
}

function themeStyleBlock(pal) {
  return '<style>:root{'
    + '--purple:' + pal.accent + ';'
    + '--purple-light:' + pal.glow + ';'
    + '--purple-muted:color-mix(in srgb,' + pal.accent + ' 55%,#9b8db0);'
    + '--bg-primary:' + pal.ink + ';'
    + '--bg-secondary:color-mix(in srgb,' + pal.ink + ' 88%,#000);'
    + '--bg-card:' + pal.hi + ';'
    + '--bg-input:color-mix(in srgb,' + pal.hi + ' 80%,' + pal.ink + ');'
    + '--bg-banner:color-mix(in srgb,' + pal.ink + ' 70%,' + pal.accent + ' 30%);'
    + '--gradient-purple:linear-gradient(163deg,' + pal.accent + ' 25%,' + pal.glow + ' 75%);'
    + '--gradient-text:linear-gradient(162deg,' + pal.accent + ' 25%,' + pal.glow + ' 75%);'
    + '--border-purple:color-mix(in srgb,' + pal.accent + ' 40%,transparent);'
    + '--shadow-purple:0 8px 12px color-mix(in srgb,' + pal.accent + ' 31%,transparent);'
    + '}</style>';
}

function demoPreviewUrl(demo, index) {
  const cfg = demo.config || {};
  const sc = cfg.showcase || {};
  if (sc.image) return sc.image;
  const logo = cfg.logo && cfg.logo.imageUrl;
  if (logo) return logo;
  return FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];
}

function portfolioCard(demo, base, index) {
  const cfg = demo.config || {};
  const trade = esc((cfg.trade || 'Local business').toString());
  const name = esc(demo.business_name || demo.slug);
  const img = esc(demoPreviewUrl(demo, index));
  const url = 'https://' + base + '/' + encodeURIComponent(demo.slug) + '?preview=1';
  return '<article class="browser-card card">'
    + '<div class="browser-card__chrome">'
    + '<span class="browser-card__dot browser-card__dot--red"></span>'
    + '<span class="browser-card__dot browser-card__dot--yellow"></span>'
    + '<span class="browser-card__dot browser-card__dot--green"></span>'
    + '</div>'
    + '<a class="browser-card__preview" href="' + url + '" target="_blank" rel="noopener">'
    + '<img src="' + img + '" alt="' + name + ' website preview" width="405" height="240" loading="lazy">'
    + '</a>'
    + '<div class="browser-card__body">'
    + '<div><h3 class="browser-card__title">' + name + '</h3><p class="browser-card__category">' + trade + '</p></div>'
    + '<p class="conversion-stat"><strong>See live demo</strong> Tap to explore</p>'
    + '<a class="btn btn--primary btn--sm" href="' + url + '" target="_blank" rel="noopener">View Demo</a>'
    + '</div></article>';
}

function portfolioGrid(demos, base) {
  if (!demos || !demos.length) {
    return '<p style="color:var(--text-secondary);text-align:center;grid-column:1/-1">New designs coming soon — check back shortly.</p>';
  }
  return demos.slice(0, 12).map((d, i) => portfolioCard(d, base, i)).join('');
}

function contactHref(email, phone) {
  if (email) return 'mailto:' + esc(email);
  if (phone) return 'tel:' + phone.replace(/[^+0-9]/g, '');
  return '#final-cta';
}

function buildPartnerLandingHtml(prof, partner, demos, base, opts) {
  opts = opts || {};
  const home = opts.home || null;
  const cfg = prof.showcase_config || {};
  const pal = resolveLandingTheme(cfg);
  const name = esc(partner.display_name || 'Web Studio');
  const headline = esc(prof.showcase_headline || 'We Build Sites That Convert');
  const intro = esc(cfg.intro || 'Landing pages engineered for calls, form submissions, and measurable ROI.');
  const email = prof.support_email ? String(prof.support_email).trim() : '';
  const phone = prof.support_phone ? String(prof.support_phone).trim() : '';
  const siteId = home && home.id ? esc(home.id) : '';
  const siteSlug = home && home.slug ? esc(home.slug) : '';
  const siteName = home && home.business_name ? esc(home.business_name) : name;
  const logoUrl = cfg.logo ? esc(cfg.logo) : '';
  const logoHtml = logoUrl
    ? '<img src="' + logoUrl + '" alt="' + name + '" class="pl-brand-logo">'
    : '';
  const footerLogo = logoUrl
    ? '<p class="footer__logo"><img src="' + logoUrl + '" alt="' + name + '"></p>'
    : '<p class="footer__logo">' + name + '</p>';
  const ctaHref = contactHref(email, phone);
  const year = String(new Date().getFullYear());

  const quoteForm = '<form class="quote-form card" data-pl-lead-form data-pl-kind="quote" method="post" action="#">'
    + '<h2 class="quote-form__title">Get a free quote</h2>'
    + '<p class="quote-form__subtitle">Tell us what you need and we\u2019ll send a custom proposal.</p>'
    + '<div class="quote-form__fields">'
    + '<div class="field"><label for="pl-name">Name</label><input id="pl-name" name="name" type="text" placeholder="Your name" required></div>'
    + '<div class="field"><label for="pl-email">Email</label><input id="pl-email" name="email" type="email" placeholder="you@company.com"></div>'
    + '<div class="field"><label for="pl-phone">Phone</label><input id="pl-phone" name="phone" type="tel" placeholder="Your phone number"></div>'
    + '</div>'
    + '<div class="quote-form__cta-row">'
    + '<button class="btn btn--primary" type="submit">Get My Free Quote</button>'
    + '<div class="trust-bar">'
    + '<span class="trust-pill trust-pill--rating">\u2605 5.0</span>'
    + '<span class="trust-bar__stat">Built for local businesses</span>'
    + '<span class="trust-pill trust-pill--lock">\uD83D\uDD12 No spam, ever</span>'
    + '</div></div>'
    + '<p class="pl-form-err" style="color:#ff8a65;font-size:14px;margin-top:12px"></p>'
    + '<p class="pl-form-ok" hidden style="color:#7dffb0;font-size:14px;margin-top:12px">Thanks \u2014 we\u2019ll be in touch shortly.</p>'
    + '</form>';

  const gallery = demos && demos.length
    ? '<section class="section section--dark" id="gallery">'
      + '<div class="glow gallery__glow" aria-hidden="true"></div>'
      + '<div class="container">'
      + '<a class="btn btn--primary sticky-cta" href="' + ctaHref + '">Book a Strategy Call \u2192</a>'
      + '<div class="section-header--row">'
      + '<div><h2 class="section-title--md">Live Client Sites \u2014 Click to Explore</h2>'
      + '<p class="section-subtitle section-subtitle--left">Tap any design to see it live in your browser.</p></div>'
      + (demos.length > 6 ? '<a class="btn btn--secondary" href="#gallery">View portfolio</a>' : '')
      + '</div>'
      + '<div class="portfolio-grid">' + portfolioGrid(demos, base) + '</div>'
      + '</div></section>'
    : '';

  return '<!DOCTYPE html><html lang="en"><head>'
    + '<meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
    + '<title>' + name + ' \u2014 ' + headline + '</title>'
    + '<meta name="description" content="' + intro + '">'
    + '<link rel="preconnect" href="https://fonts.googleapis.com">'
    + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    + '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">'
    + '<link rel="stylesheet" href="/assets/partner-landing/partner-landing.css">'
    + themeStyleBlock(pal)
    + '</head>'
    + '<body data-pl-site-id="' + siteId + '" data-pl-slug="' + siteSlug + '" data-pl-site="' + siteName + '">'

    + '<header class="urgency-banner">'
    + '<p class="urgency-banner__text">\u26A1 Limited spots this month \u2014 ' + name + ' is booking new website projects now</p>'
    + '<a class="btn btn--primary btn--banner" href="#hero">Claim spot</a>'
    + '</header>'

    + '<main>'
    + '<section class="hero section" id="hero">'
    + '<div class="hero__glow glow" aria-hidden="true"></div>'
    + '<div class="container hero__content">'
    + quoteForm
    + '<div class="social-proof">'
    + '<div class="avatars" aria-hidden="true">'
    + '<span class="avatar">AC</span><span class="avatar">JM</span><span class="avatar">RK</span><span class="avatar">SL</span><span class="avatar">TB</span>'
    + '</div><p class="social-proof__text">Trusted by local service businesses</p></div>'
    + logoHtml
    + '<div><span class="badge">NOW BOOKING NEW PROJECTS</span>'
    + '<h1 class="hero__headline">' + headline + '</h1>'
    + '<p class="hero__subheadline">' + intro + '</p></div>'
    + '<div class="hero__actions">'
    + (demos.length ? '<a class="btn btn--primary" href="#gallery">See Our Work</a>' : '')
    + '<a class="btn btn--secondary" href="#final-cta">Get a Free Quote</a>'
    + '</div>'
    + '<div class="hero__stats">'
    + '<div class="stat"><p class="stat__value">' + (demos.length || '12') + '+</p><p class="stat__label">Demo Sites</p></div>'
    + '<div class="stat"><p class="stat__value">Fast</p><p class="stat__label">Launch Timeline</p></div>'
    + '<div class="stat"><p class="stat__value">100%</p><p class="stat__label">Mobile Ready</p></div>'
    + '</div>'
    + '<div class="stats-strip card">'
    + '<div class="stat"><p class="stat__value gradient-text">Leads</p><p class="stat__label">Built-in capture</p></div>'
    + '<div class="stat"><p class="stat__value gradient-text">SEO</p><p class="stat__label">Local search ready</p></div>'
    + '<div class="stat"><p class="stat__value gradient-text">CRM</p><p class="stat__label">Enquiries in your inbox</p></div>'
    + '<div class="stat"><p class="stat__value gradient-text">Support</p><p class="stat__label">Real people, local</p></div>'
    + '</div></div></section>'

    + gallery

    + '<section class="section" id="features">'
    + '<div class="container"><div class="section-header">'
    + '<h2 class="section-title">Stop Guessing, Start Growing</h2>'
    + '<p class="section-subtitle">Data-driven design that eliminates the guesswork from your marketing spend.</p>'
    + '</div><div class="features-grid">'
    + '<article class="feature-card card"><div class="feature-card__icon" aria-hidden="true">\uD83D\uDCDE</div>'
    + '<h3 class="feature-card__title">Call Tracking</h3>'
    + '<p class="feature-card__text">Track every inbound call source down to the specific keyword or ad campaign.</p></article>'
    + '<article class="feature-card card"><div class="feature-card__icon" aria-hidden="true">\uD83D\uDCCB</div>'
    + '<h3 class="feature-card__title">Form Attribution</h3>'
    + '<p class="feature-card__text">Know exactly which page or CTA drove each lead into your CRM.</p></article>'
    + '<article class="feature-card card"><div class="feature-card__icon" aria-hidden="true">\uD83D\uDDB1\uFE0F</div>'
    + '<h3 class="feature-card__title">Heatmaps &amp; Sessions</h3>'
    + '<p class="feature-card__text">See how visitors behave \u2014 where they click, scroll, and where they drop off.</p></article>'
    + '</div></div></section>'

    + '<section class="section section--dark" id="process">'
    + '<div class="glow process__glow" aria-hidden="true"></div>'
    + '<div class="container">'
    + '<div class="guarantee"><div class="guarantee__header">'
    + '<div class="guarantee__icon" aria-hidden="true">\uD83D\uDEE1\uFE0F</div>'
    + '<div><h2 class="guarantee__title">Our Guarantee</h2>'
    + '<p class="guarantee__subtitle">If your site doesn\u2019t generate leads in 60 days, we rebuild it. Free.</p></div></div>'
    + '<ul class="guarantee__list">'
    + '<li>Full call tracking + form attribution included</li>'
    + '<li>Weekly performance reporting to keep you aligned</li>'
    + '<li>No hidden fees \u2014 you only pay for results</li>'
    + '</ul></div>'
    + '<div class="section-header"><h2 class="section-title">Our High-Performance Process</h2>'
    + '<p class="section-subtitle">From first call to live tracking in as little as 21 days.</p></div>'
    + '<div class="process-steps">'
    + '<article class="process-step"><div class="process-step__number-row"><span class="process-step__number">1</span><span class="process-step__line" aria-hidden="true"></span></div>'
    + '<h3 class="process-step__title">Strategy Call</h3><p class="process-step__text">We deep-dive into your unit economics and lead goals.</p></article>'
    + '<article class="process-step"><div class="process-step__number-row"><span class="process-step__line" aria-hidden="true"></span><span class="process-step__number">2</span><span class="process-step__line" aria-hidden="true"></span></div>'
    + '<h3 class="process-step__title">Design &amp; Build</h3><p class="process-step__text">Proprietary frameworks focused on conversion psychology.</p></article>'
    + '<article class="process-step"><div class="process-step__number-row"><span class="process-step__line" aria-hidden="true"></span><span class="process-step__number">3</span></div>'
    + '<h3 class="process-step__title">Launch &amp; Track</h3><p class="process-step__text">Go live with full analytics and call tracking active.</p></article>'
    + '</div></div></section>'

    + '<section class="section" id="testimonials">'
    + '<div class="container"><div class="faq">'
    + '<h2 class="section-title--md">FAQs</h2>'
    + '<p class="section-subtitle section-subtitle--left">Common questions about pricing, tracking, and what happens after launch.</p>'
    + '<div class="faq__list">'
    + '<div class="faq-item card faq-item--open"><div class="faq-item__header">'
    + '<p class="faq-item__question">How much does a lead-gen website cost?</p><span class="faq-item__toggle" aria-hidden="true">\u2212</span></div>'
    + '<p class="faq-item__answer">Pricing starts at $2,500 for a single landing page with tracking. Growth packages include multi-page funnels, call tracking, and CRM integration.</p></div>'
    + '<div class="faq-item card"><div class="faq-item__header">'
    + '<p class="faq-item__question">How does call tracking and attribution work?</p><span class="faq-item__toggle" aria-hidden="true">+</span></div>'
    + '<p class="faq-item__answer">We assign unique tracking numbers to each marketing channel and tie form submissions to the exact page and CTA that generated them.</p></div>'
    + '<div class="faq-item card"><div class="faq-item__header">'
    + '<p class="faq-item__question">What\u2019s the typical timeline from kickoff to launch?</p><span class="faq-item__toggle" aria-hidden="true">+</span></div>'
    + '<p class="faq-item__answer">Most projects launch in 12\u201321 days depending on scope. Starter packages average 21 days; Growth packages typically take 3\u20134 weeks.</p></div>'
    + '<div class="faq-item card"><div class="faq-item__header">'
    + '<p class="faq-item__question">What happens after my site launches?</p><span class="faq-item__toggle" aria-hidden="true">+</span></div>'
    + '<p class="faq-item__answer">You get weekly performance reports, ongoing tracking setup, and access to our team for optimization recommendations based on real conversion data.</p></div>'
    + '</div></div>'
    + '<div class="section-header"><h2 class="section-title--md">Trusted by Service Businesses</h2>'
    + '<p class="section-subtitle section-subtitle--left">Real results from businesses that demand ROI.</p></div>'
    + '<div class="testimonials-grid">'
    + '<blockquote class="testimonial-card card"><p class="testimonial-card__quote">\u201cSince switching, our cost per lead dropped while our call volume nearly doubled. The tracking is a game changer.\u201d</p>'
    + '<footer><p class="testimonial-card__name">Happy Client</p><p class="testimonial-card__company">Local Service Business</p></footer></blockquote>'
    + '<blockquote class="testimonial-card card"><p class="testimonial-card__quote">\u201cWe finally know which marketing channels are actually driving cases. The website pays for itself every single month.\u201d</p>'
    + '<footer><p class="testimonial-card__name">Business Owner</p><p class="testimonial-card__company">Professional Services</p></footer></blockquote>'
    + '<blockquote class="testimonial-card card"><p class="testimonial-card__quote">\u201cThe most professional agency we\u2019ve ever worked with. They understand our industry and what drives leads.\u201d</p>'
    + '<footer><p class="testimonial-card__name">Trade Business</p><p class="testimonial-card__company">Canberra &amp; ACT</p></footer></blockquote>'
    + '</div></div></section>'

    + '<section class="section section--dark" id="pricing">'
    + '<div class="glow pricing__glow" aria-hidden="true"></div>'
    + '<div class="container"><div class="section-header">'
    + '<h2 class="section-title">Investment Tiers</h2>'
    + '<p class="section-subtitle">Simple, transparent pricing built for long-term growth.</p></div>'
    + '<div class="pricing-grid">'
    + '<article class="pricing-card card"><div><div class="pricing-card__header"><h3 class="pricing-card__tier">Starter</h3></div><p class="pricing-card__price">$2,500</p></div>'
    + '<ul class="pricing-card__features"><li>Single Landing Page</li><li>Form Tracking</li><li>Standard SEO</li><li>21 Day Launch</li></ul>'
    + '<a class="btn btn--secondary btn--full" href="#hero">Choose Plan</a></article>'
    + '<article class="pricing-card pricing-card--featured card"><div><div class="pricing-card__header"><h3 class="pricing-card__tier">Growth</h3>'
    + '<span class="badge badge--popular">MOST POPULAR</span></div><p class="pricing-card__price">$4,500</p></div>'
    + '<ul class="pricing-card__features"><li>Multi-page Funnel</li><li>Call Tracking Active</li><li>Heatmap Analytics</li><li>CRM Integration</li><li>Priority Support</li></ul>'
    + '<a class="btn btn--primary btn--full" href="#hero">Choose Plan</a></article>'
    + '<article class="pricing-card card"><div><div class="pricing-card__header"><h3 class="pricing-card__tier">Scale</h3></div><p class="pricing-card__price">Custom</p></div>'
    + '<ul class="pricing-card__features"><li>Enterprise Systems</li><li>Multi-location SEO</li><li>Full Ad Management</li><li>Custom Dashboards</li><li>24/7 Monitoring</li></ul>'
    + '<a class="btn btn--secondary btn--full" href="' + ctaHref + '">Contact Sales</a></article>'
    + '</div></div></section>'

    + '<section class="final-cta section" id="final-cta">'
    + '<div class="glow final-cta__glow" aria-hidden="true"></div>'
    + '<div class="final-cta__content"><div>'
    + '<h2 class="final-cta__title">Stop Losing Leads to a Weak Website</h2>'
    + '<p class="final-cta__subtitle">Build a site that converts. Get in touch with ' + name + ' today.</p></div>'
    + '<div class="countdown" aria-label="Special pricing countdown">'
    + '<span class="countdown__unit"><span class="countdown__value" id="countdown-days">00d</span><span class="countdown__sep">:</span></span>'
    + '<span class="countdown__unit"><span class="countdown__value" id="countdown-hours">00h</span><span class="countdown__sep">:</span></span>'
    + '<span class="countdown__unit"><span class="countdown__value" id="countdown-minutes">00m</span><span class="countdown__sep">:</span></span>'
    + '<span class="countdown__unit"><span class="countdown__value" id="countdown-seconds">00s</span></span>'
    + '<span class="countdown__label">Special pricing ends soon</span></div>'
    + '<form class="email-capture" data-pl-lead-form data-pl-kind="audit" method="post" action="#">'
    + '<input type="email" name="email" placeholder="Enter your email address" required aria-label="Email address">'
    + '<button class="btn btn--primary" type="submit">Get My Audit</button></form>'
    + '<p class="pl-form-err" style="color:#ff8a65;font-size:14px"></p>'
    + '<p class="pl-form-ok" hidden style="color:#7dffb0;font-size:14px">Thanks \u2014 we\u2019ll be in touch shortly.</p>'
    + '</div></section>'
    + '</main>'

    + '<footer class="footer section"><div class="container">'
    + '<div class="footer__top"><div class="footer__brand">'
    + footerLogo
    + '<p class="footer__tagline">' + intro + '</p>'
    + (email ? '<p style="margin-top:12px"><a href="mailto:' + esc(email) + '" style="color:var(--text-secondary)">' + esc(email) + '</a></p>' : '')
    + (phone ? '<p style="margin-top:8px"><a href="tel:' + phone.replace(/[^+0-9]/g, '') + '" style="color:var(--text-secondary)">' + esc(phone) + '</a></p>' : '')
    + '</div><nav class="footer__links" aria-label="Footer">'
    + '<div class="footer__column"><h4>Service</h4><ul>'
    + '<li><a href="#features">Web Design</a></li><li><a href="#features">SEO</a></li>'
    + '<li><a href="#features">Call Tracking</a></li><li><a href="#features">Form Analytics</a></li>'
    + '</ul></div>'
    + '<div class="footer__column"><h4>Company</h4><ul>'
    + '<li><a href="#gallery">Our Work</a></li><li><a href="#process">About Us</a></li>'
    + '<li><a href="#final-cta">Contact</a></li>'
    + '</ul></div>'
    + '<div class="footer__column"><h4>Legal</h4><ul>'
    + '<li><a href="/privacy-policy">Privacy</a></li><li><a href="/terms-of-use">Terms</a></li>'
    + '</ul></div></nav></div>'
    + '<div class="footer__bottom">'
    + '<p class="footer__copyright">\u00A9 ' + year + ' ' + name + '. All rights reserved.</p>'
    + '<p class="footer__badge-row">Powered by <span class="footer__badge">LEADPAGES</span></p>'
    + '</div></div></footer>'

    + '<script src="/assets/partner-landing/partner-landing.js"></script>'
    + '</body></html>';
}

module.exports = { buildPartnerLandingHtml, resolveLandingTheme };
