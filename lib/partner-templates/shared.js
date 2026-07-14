/**
 * Shared helpers for partner landing templates.
 */

const esc = (s) => String(s ?? '').replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const { extractLogoValue, resolvePartnerLogo } = require('../partner-website/logo');

const hexOr = (v, d) => (/^#[0-9a-fA-F]{3,8}$/.test(v || '') ? v : d);

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800&q=80',
  'https://images.unsplash.com/photo-1486406146926-c627a92fd1b2?w=800&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80',
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80',
];

function cleanLogoSize(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  const stepped = Math.round(n * 2) / 2;
  return Math.min(10, Math.max(0.5, stepped));
}

function resolveLandingTheme(cfg) {
  cfg = cfg || {};
  const theme = cfg.theme || {};
  const accent = hexOr(theme.hivis, hexOr(cfg.accent, '#ff6a1a'));
  const brand = hexOr(theme.pipe, accent);
  const ink = hexOr(theme.steel, '#0f1419');
  const hi = hexOr(theme.lightBg, '#f4f6f8');
  const glow = hexOr(theme.safety, accent);
  const logoSize = cleanLogoSize(cfg.logoSize);
  return { accent, brand, ink, hi, glow, logoSize };
}

function themeCssVars(pal, extra) {
  extra = extra || {};
  return ':root{'
    + '--pt-accent:' + pal.accent + ';'
    + '--pt-brand:' + pal.brand + ';'
    + '--pt-ink:' + pal.ink + ';'
    + '--pt-bg:' + pal.hi + ';'
    + '--pt-glow:' + pal.glow + ';'
    + '--pt-logo-scale:' + pal.logoSize + ';'
    + Object.keys(extra).map(function(k) { return '--' + k + ':' + extra[k]; }).join(';')
    + (Object.keys(extra).length ? ';' : '')
    + '}';
}

function demoPreviewUrl(demo, index) {
  const cfg = demo.config || {};
  const sc = cfg.showcase || {};
  if (sc.image) return sc.image;
  const logo = cfg.logo && cfg.logo.imageUrl;
  if (logo) return logo;
  return FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];
}

function contactHref(email, phone) {
  if (email) return 'mailto:' + esc(email);
  if (phone) return 'tel:' + phone.replace(/[^+0-9]/g, '');
  return '#contact';
}

function buildContext(prof, partner, demos, base, opts) {
  opts = opts || {};
  if (opts.themeContent) {
    const c = opts.themeContent;
    const cfg = prof.showcase_config || {};
    const pal = c.pal || resolveLandingTheme(cfg);
    const publicBrand = c.partner.agencyName || c.partner.displayName;
    const resolvedLogo = c.partner.logoUrl
      || resolvePartnerLogo({
        showcaseConfig: cfg,
        identity: (cfg.websiteProfile && cfg.websiteProfile.identity) || {}
      })
      || extractLogoValue(cfg.logo)
      || '';
    if (resolvedLogo && !c.partner.logoUrl) {
      c.partner.logoUrl = resolvedLogo;
    }
    return {
      prof, partner, demos: c.demos || [], base, home: opts.home || null,
      cfg, pal, content: c,
      name: esc(publicBrand),
      partnerName: esc(c.partner.displayName),
      headline: esc(c.hero.headline),
      intro: esc(c.hero.supportingText),
      email: c.contact.email || '',
      phone: c.contact.phone || '',
      siteId: esc(c.meta.siteId || ''),
      siteSlug: esc(c.meta.siteSlug || ''),
      siteName: esc(c.meta.siteName || c.partner.agencyName),
      logoUrl: resolvedLogo ? esc(resolvedLogo) : '',
      templateKey: c.meta.templateKey || 'webculture',
      ctaHref: contactHref(c.contact.email, c.contact.phone),
      year: String(new Date().getFullYear())
    };
  }
  const home = opts.home || null;
  const cfg = prof.showcase_config || {};
  const pal = resolveLandingTheme(cfg);
  const name = esc(partner.display_name || 'Web Studio');
  const headline = esc(prof.showcase_headline || 'Websites that win you more customers');
  const intro = esc(cfg.intro || 'Your local LeadPages partner — professional websites, demos you can touch, and support that actually answers the phone.');
  const email = prof.support_email ? String(prof.support_email).trim() : '';
  const phone = prof.support_phone ? String(prof.support_phone).trim() : '';
  const siteId = home && home.id ? esc(home.id) : '';
  const siteSlug = home && home.slug ? esc(home.slug) : '';
  const siteName = home && home.business_name ? esc(home.business_name) : name;
  const logoUrl = extractLogoValue(cfg.logo) || '';
  const templateKey = cfg.templateKey || 'webculture';
  const ctaHref = contactHref(email, phone);
  const year = String(new Date().getFullYear());
  const demoList = (demos || []).slice(0, 12);
  return {
    prof, partner, demos: demoList, base, home, cfg, pal, name, headline, intro,
    email, phone, siteId, siteSlug, siteName, logoUrl: logoUrl ? esc(logoUrl) : '', templateKey, ctaHref, year
  };
}

function leadForm(ctx, opts) {
  opts = opts || {};
  const cls = opts.className || 'pt-lead-form';
  const title = opts.title || 'Get a free quote';
  const sub = opts.subtitle || 'Tell us what you need — we respond within one business day.';
  return '<form class="' + cls + '" data-pl-lead-form data-pl-kind="quote" method="post" action="#">'
    + '<h3>' + esc(title) + '</h3>'
    + '<p class="pt-form-sub">' + esc(sub) + '</p>'
    + '<div class="pt-form-grid">'
    + '<label><span>Name</span><input name="name" type="text" placeholder="Your name" required></label>'
    + '<label><span>Email</span><input name="email" type="email" placeholder="you@business.com"></label>'
    + '<label><span>Phone</span><input name="phone" type="tel" placeholder="Your number"></label>'
    + '</div>'
    + '<button class="pt-btn pt-btn-primary" type="submit">Send enquiry</button>'
    + '<p class="pl-form-err"></p><p class="pl-form-ok" hidden>Thanks — we\'ll be in touch shortly.</p>'
    + '</form>';
}

function supportBlock(ctx) {
  return '<section class="pt-support" id="support">'
    + '<div class="pt-wrap">'
    + '<div class="pt-support-grid">'
    + '<article class="pt-support-card pt-support-local">'
    + '<span class="pt-support-tag">Local partner</span>'
    + '<h3>' + ctx.name + ' — on your doorstep</h3>'
    + '<p>Real conversations, local knowledge, and someone who picks up when you call. Your website isn\'t a ticket in a queue — it\'s a relationship with a designer who knows your market.</p>'
    + (ctx.email ? '<a class="pt-btn pt-btn-outline" href="mailto:' + esc(ctx.email) + '">Email ' + ctx.name + '</a>' : '')
    + (ctx.phone ? '<a class="pt-btn pt-btn-outline" href="tel:' + ctx.phone.replace(/[^+0-9]/g, '') + '">' + esc(ctx.phone) + '</a>' : '')
    + '</article>'
    + '<article class="pt-support-card pt-support-platform">'
    + '<span class="pt-support-tag">Platform backup</span>'
    + '<h3>Backed by LeadPages infrastructure</h3>'
    + '<p>Enterprise-grade hosting, security updates, CRM integrations, online quotes, SEO tooling, and a platform team behind every site — so your partner can focus on you, not servers.</p>'
    + '<ul class="pt-support-list">'
    + '<li>Lead capture &amp; CRM-ready forms</li>'
    + '<li>Online quote wizards with verification</li>'
    + '<li>Marketplace apps — portfolios, sliders, maps</li>'
    + '<li>Ongoing platform updates &amp; backups</li>'
    + '</ul>'
    + '</article>'
    + '</div></div></section>';
}

function powerBlock(ctx) {
  return '<section class="pt-power" id="power">'
    + '<div class="pt-wrap">'
    + '<p class="pt-eyebrow">Why LeadPages partners win</p>'
    + '<h2 class="pt-power-title">Not just a pretty site.<br>A <em>business system</em>.</h2>'
    + '<div class="pt-power-grid">'
    + '<article><span class="pt-power-num">01</span><h3>Live demo showcase</h3><p>Prospects explore real trade websites your partner has built — click through, test forms, see the quality before they buy.</p></article>'
    + '<article><span class="pt-power-num">02</span><h3>Conversion engineering</h3><p>Quote forms, call tracking, service packs, and landing pages designed to turn visitors into booked jobs — not just page views.</p></article>'
    + '<article><span class="pt-power-num">03</span><h3>Local + platform</h3><p>Your partner handles strategy, design, and hand-holding. LeadPages handles infrastructure, apps, and the tech that scales.</p></article>'
    + '<article><span class="pt-power-num">04</span><h3>Launch fast</h3><p>Pre-built trade packs, theme engines, and a marketplace of apps mean your site goes live in days — not months of agency back-and-forth.</p></article>'
    + '</div></div></section>';
}

function footerBlock(ctx) {
  return '<footer class="pt-footer">'
    + '<div class="pt-wrap pt-footer-inner">'
    + '<div class="pt-footer-brand">'
    + (ctx.logoUrl ? '<img src="' + ctx.logoUrl + '" alt="' + ctx.name + '" class="pt-footer-logo">' : '<strong class="pt-footer-name">' + ctx.name + '</strong>')
    + '<p>' + ctx.intro + '</p>'
    + '</div>'
    + '<nav class="pt-footer-nav" aria-label="Footer">'
    + '<a href="#demos">Demos</a><a href="#services">Services</a><a href="#partner">About</a><a href="#contact">Contact</a>'
    + '</nav>'
    + '<div class="pt-footer-bottom">'
    + '<p class="pt-footer-copy">&copy; ' + ctx.year + ' ' + ctx.name + '</p>'
    + '<a href="https://www.leadpages.com.au" target="_blank" rel="noopener" class="pt-lp-badge">'
    + '<span class="pt-lp-badge-logo leadpages-logo" data-lp-logo="auto" data-lp-logo-ink="auto" data-lp-logo-pulse="false" role="img" aria-label="LeadPages"></span>'
    + '<span class="pt-lp-badge-label">Powered by <strong>LeadPages</strong></span>'
    + '</a>'
    + '</div></div></footer>';
}

function pageShell(ctx, bodyHtml, opts) {
  opts = opts || {};
  const cssHref = opts.css || '/assets/partner-templates/webculture.css';
  const bodyClass = opts.bodyClass || '';
  const fonts = opts.fonts || 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap';
  const extraHead = opts.extraHead || '';
  const tplSwitcher = opts.templateSwitcher !== false ? templateSwitcherBar(ctx) : '';
  const content = ctx.content || (opts.themeContent) || null;
  const seo = content && content.seo ? content.seo : null;
  const title = seo ? esc(seo.title) : (ctx.name + ' — ' + ctx.headline);
  const desc = seo ? esc(seo.description) : ctx.intro;
  let seoHead = '';
  if (seo) {
    try { seoHead = require('../partner-website/seo').seoHeadHtml(seo); } catch (_e) {}
  }
  const partnerId = content && content.meta ? content.meta.partnerId : '';
  return '<!DOCTYPE html><html lang="en"><head>'
    + '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">'
    + '<title>' + title + '</title>'
    + '<meta name="description" content="' + desc + '">'
    + seoHead
    + '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    + '<link href="' + fonts + '" rel="stylesheet">'
    + '<link rel="stylesheet" href="/assets/partner-templates/base.css">'
    + '<link rel="stylesheet" href="' + cssHref + '">'
    + '<link rel="stylesheet" href="/assets/lp-logo.css">'
    + '<style>' + themeCssVars(ctx.pal, opts.extraVars || {}) + '</style>'
    + extraHead
    + '</head>'
    + '<body class="pt-tpl-' + esc(opts.templateId || ctx.templateKey) + ' ' + bodyClass + '"'
    + ' data-pl-site-id="' + ctx.siteId + '" data-pl-slug="' + ctx.siteSlug + '" data-pl-site="' + ctx.siteName + '"'
    + ' data-pl-partner-id="' + esc(partnerId) + '" data-pt-template="' + esc(opts.templateId || ctx.templateKey) + '">'
    + tplSwitcher + bodyHtml
    + '<script>window.__LP_VISITOR_A11Y__={enabled:false};</script>'
    + '<script src="/assets/lp-logo.js"></script>'
    + '<script src="/assets/partner-templates/partner-templates.js"></script>'
    + '</body></html>';
}

function templateSwitcherBar(ctx) {
  const templates = require('./registry').PARTNER_TEMPLATES;
  const links = templates.map(function(t) {
    const active = t.id === (ctx.templateKey || 'converge') ? ' is-active' : '';
    return '<a class="pt-tpl-switch' + active + '" href="?tpl=' + encodeURIComponent(t.id) + '" title="' + esc(t.label) + '">' + esc(t.short) + '</a>';
  }).join('');
  return '<div class="pt-tpl-bar" role="navigation" aria-label="Preview templates">'
    + '<span class="pt-tpl-bar-label">Template</span>' + links + '</div>';
}

module.exports = {
  esc,
  hexOr,
  FALLBACK_IMAGES,
  resolveLandingTheme,
  themeCssVars,
  demoPreviewUrl,
  contactHref,
  buildContext,
  leadForm,
  supportBlock,
  powerBlock,
  footerBlock,
  pageShell,
  templateSwitcherBar
};
