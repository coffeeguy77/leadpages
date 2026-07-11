// lib/partner-landing.js — Converge Studio partner showcase landing (server HTML)

const esc = (s) => String(s ?? '').replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const { buildContext } = require('./partner-templates/shared');
const { standardSections } = require('./partner-templates/standard-sections');
const sections = require('./partner-website/sections');
const { seoHeadHtml } = require('./partner-website/seo');

function resolveLandingTheme(cfg) {
  const { resolveLandingTheme: r } = require('./partner-templates/shared');
  return r(cfg);
}

function themeStyleBlock(pal) {
  return '<style>:root{'
    + '--purple:' + pal.accent + ';'
    + '--purple-light:' + pal.glow + ';'
    + '--bg-primary:' + pal.ink + ';'
    + '--bg-card:' + pal.hi + ';'
    + '--pl-logo-scale:' + pal.logoSize + ';'
    + '}</style>';
}

function contactHref(email, phone) {
  if (email) return 'mailto:' + esc(email);
  if (phone) return 'tel:' + phone.replace(/[^+0-9]/g, '');
  return '#contact';
}

function buildPartnerLandingHtml(prof, partner, demos, base, opts) {
  opts = opts || {};
  const ctx = buildContext(prof, partner, demos, base, opts);
  const c = ctx.content;
  if (!c) throw new Error('themeContent required for Converge');
  const h = c.hero;
  const pal = ctx.pal;
  const seo = c.seo || {};
  const title = esc(seo.title || (ctx.name + ' — ' + ctx.headline));
  const desc = esc(seo.description || ctx.intro);

  const logoHtml = ctx.logoUrl ? '<img src="' + ctx.logoUrl + '" alt="' + ctx.name + '" class="pl-brand-logo">' : '';

  const body = ''
    + '<header class="urgency-banner">'
    + '<p class="urgency-banner__text">' + esc(c.partner.displayName) + ' — ' + esc(h.eyebrow) + '</p>'
    + '<a class="btn btn--primary btn--banner" href="#contact">' + esc(h.primaryCta) + '</a>'
    + '</header>'
    + '<main>'
    + '<section class="hero section" id="hero">'
    + '<div class="container hero__content">'
    + logoHtml
    + '<span class="badge">' + esc(h.eyebrow) + '</span>'
    + '<h1 class="hero__headline">' + esc(h.headline) + '</h1>'
    + '<p class="hero__subheadline"><em>' + esc(h.highlightedPhrase) + '</em> ' + esc(h.supportingText) + '</p>'
    + '<div class="hero__actions">'
    + '<a class="btn btn--primary" href="#contact">' + esc(h.primaryCta) + '</a>'
    + '<a class="btn btn--secondary" href="' + esc(h.secondaryCtaHref) + '">' + esc(h.secondaryCta) + '</a>'
    + '</div>'
    + sections.metricsBar(c)
    + '</div></section>'
    + '<div class="cv-sections">'
    + standardSections(c, { cardClass: 'browser-card card pt-demo-card' })
    + sections.contactSection(c, { title: 'Plan your website', className: 'cv-form' })
    + '</div>'
    + '</main>'
    + '<footer class="footer section"><div class="container">'
    + '<div class="footer__top"><div class="footer__brand">'
    + (ctx.logoUrl ? '<p class="footer__logo"><img src="' + ctx.logoUrl + '" alt="' + ctx.name + '"></p>' : '<p class="footer__logo">' + ctx.name + '</p>')
    + '<p class="footer__tagline">' + ctx.intro + '</p>'
    + '</div></div>'
    + '<div class="footer__bottom">'
    + '<p class="footer__copyright">&copy; ' + ctx.year + ' ' + ctx.name + '</p>'
    + '<a href="https://www.leadpages.com.au" class="footer__lp-logo" target="_blank" rel="noopener">'
    + '<span class="leadpages-logo" data-lp-logo="auto" data-lp-logo-ink="light" role="img" aria-label="LeadPages"></span></a>'
    + '</div></div></footer>';

  return '<!DOCTYPE html><html lang="en"><head>'
    + '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">'
    + '<title>' + title + '</title>'
    + '<meta name="description" content="' + desc + '">'
    + seoHeadHtml(seo)
    + '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">'
    + '<link rel="stylesheet" href="/assets/partner-templates/base.css">'
    + '<link rel="stylesheet" href="/assets/partner-landing/partner-landing.css">'
    + '<link rel="stylesheet" href="/assets/lp-logo.css">'
    + themeStyleBlock(pal)
    + '</head>'
    + '<body data-pl-site-id="' + ctx.siteId + '" data-pl-slug="' + ctx.siteSlug + '" data-pl-site="' + ctx.siteName + '"'
    + ' data-pl-partner-id="' + esc(c.meta.partnerId || '') + '" data-pt-template="converge">'
    + body
    + '<script src="/assets/lp-logo.js"></script>'
    + '<script src="/assets/partner-templates/partner-templates.js"></script>'
    + '<script src="/assets/partner-landing/partner-landing.js"></script>'
    + '</body></html>';
}

module.exports = { buildPartnerLandingHtml, resolveLandingTheme };
