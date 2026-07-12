/**
 * Reusable premium partner theme components.
 */
const { esc } = require('./shared');
const { isValidImageUrl } = require('../partner-website/demo-cards');
const { partnerLogoDisplayUrl } = require('../partner-website/logo');
const { isLogoThumbnail } = require('../partner-website/webculture-theme');
const {
  renderIcon,
  connectedFlowArt,
  platformBridgeArt,
  processConnectorArt
} = require('./premium-icons');

function emphasizeText(text, words) {
  let html = esc(String(text || ''));
  (words || []).forEach(function(w) {
    const re = new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'i');
    html = html.replace(re, '<span class="wc-highlight">$1</span>');
  });
  return html;
}

function icon(name) {
  return renderIcon(name);
}

function iconRing(name, ringClass) {
  const cls = ringClass ? ' ' + esc(ringClass) : '';
  return '<span class="prm-icon-ring' + cls + '">' + renderIcon(name) + '</span>';
}

function demoThumbSrc(demo, width) {
  if (!demo || !demo.thumbnail || !isValidImageUrl(demo.thumbnail) || isLogoThumbnail(demo.thumbnail)) return '';
  return esc(partnerLogoDisplayUrl(demo.thumbnail, width || 900));
}

function demoScreenHtml(demo, width) {
  const src = demoThumbSrc(demo, width);
  const name = demo ? demo.name : 'Live demo';
  const industry = demo && demo.industry ? demo.industry : 'Website preview';
  if (src) {
    return '<img src="' + src + '" alt="' + esc(name) + ' website preview" class="prm-screen-img" loading="lazy" decoding="async"'
      + ' onerror="this.remove();this.parentElement.classList.add(\'is-fallback\');">';
  }
  return '<div class="prm-screen-fallback" aria-hidden="true">'
    + '<span class="prm-screen-fallback-name">' + esc(name) + '</span>'
    + '<span class="prm-screen-fallback-industry">' + esc(industry) + '</span>'
    + '</div>';
}

function DemoBrowser(demo, opts) {
  opts = opts || {};
  const cls = opts.className ? ' ' + esc(opts.className) : '';
  const animate = opts.animate !== false ? ' prm-browser--animate' : '';
  const d = demo || { name: 'Live demo', url: '#demos' };
  const host = (d.url || '').replace(/^https?:\/\//, '').split('/')[0] || 'live-demo';
  return '<div class="prm-browser' + cls + animate + '" data-prm-browser>'
    + '<div class="prm-browser-chrome" aria-hidden="true">'
    + '<span class="prm-browser-traffic"><i></i><i></i><i></i></span>'
    + '<span class="prm-browser-url">' + esc(host) + '</span>'
    + '</div>'
    + '<a class="prm-browser-screen" href="' + esc(d.url || '#demos') + '" target="_blank" rel="noopener">'
    + demoScreenHtml(d, opts.width || 1200)
    + '</a></div>';
}

function DemoPhone(demo, opts) {
  opts = opts || {};
  const cls = opts.className ? ' ' + esc(opts.className) : '';
  const animate = opts.animate !== false ? ' prm-phone--animate' : '';
  const d = demo || { name: 'Live demo', url: '#demos' };
  return '<div class="prm-phone' + cls + animate + '" data-prm-phone>'
    + '<div class="prm-phone-island" aria-hidden="true"></div>'
    + '<a class="prm-phone-screen" href="' + esc(d.url || '#demos') + '" target="_blank" rel="noopener">'
    + demoScreenHtml(d, opts.width || 480)
    + '</a></div>';
}

function HeroWebsiteShowcase(demo, opts) {
  opts = opts || {};
  const toast = opts.toast || {};
  return '<div class="prm-hero-showcase' + (opts.className ? ' ' + esc(opts.className) : '') + '">'
    + DemoBrowser(demo, { className: 'prm-hero-browser', width: 1400 })
    + DemoPhone(demo, { className: 'prm-hero-phone', width: 520 })
    + '<aside class="prm-quote-toast" data-prm-toast role="status" aria-live="polite">'
    + '<span class="prm-quote-toast-dot" aria-hidden="true"></span>'
    + '<div class="prm-quote-toast-copy">'
    + '<strong>' + esc(toast.title || 'New quote request') + '</strong>'
    + '<span>' + esc(toast.body || 'New enquiry received') + '</span>'
    + '<time>' + esc(toast.time || 'Just now') + '</time>'
    + '</div></aside></div>';
}

function LiveDemoGallery(demos, copy) {
  const list = (demos || []).filter(function(d) { return d && d.url; });
  if (!list.length) return '';
  const c = copy || {};
  return '<div class="prm-gallery-strip" id="gallery" aria-label="Live demo gallery">'
    + '<div class="prm-gallery-track" data-prm-gallery>'
    + list.map(function(d, i) {
      const src = demoThumbSrc(d, 640);
      return '<article class="prm-gallery-card" data-prm-gallery-card>'
        + '<button type="button" class="prm-gallery-thumb" aria-expanded="false" aria-controls="prm-gallery-panel-' + i + '">'
        + (src ? '<img src="' + src + '" alt="' + esc(d.name) + '" loading="lazy">' : '<span>' + esc(d.name) + '</span>')
        + '<span class="prm-gallery-thumb-label">' + esc(d.industry || 'Demo') + '</span>'
        + '</button>'
        + '<div class="prm-gallery-panel" id="prm-gallery-panel-' + i + '" hidden>'
        + DemoBrowser(d, { animate: false, width: 1000 })
        + '<a class="prm-btn prm-btn-primary" href="' + esc(d.url) + '" target="_blank" rel="noopener">'
        + esc(c.openLabel || 'Open live demo') + '</a>'
        + '</div></article>';
    }).join('')
    + '</div></div>';
}

function IndustryTabs(groups, copy, opts) {
  opts = opts || {};
  if (!groups || !groups.length) return '';
  const c = copy || {};
  const tabsId = opts.id || 'demos';
  let panelsHtml = '';
  let tabsHtml = '';

  groups.forEach(function(group, i) {
    const demo = group.demos[0];
    const active = i === 0;
    const panelId = 'prm-demo-panel-' + group.tab.key;
    tabsHtml += '<button type="button" class="prm-tab' + (active ? ' is-active' : '') + '"'
      + ' role="tab" aria-selected="' + (active ? 'true' : 'false') + '"'
      + ' aria-controls="' + panelId + '" data-prm-tab="' + esc(group.tab.key) + '">'
      + esc(group.tab.label) + '</button>';

    const features = (c.features || []).map(function(f) {
      return '<li class="prm-feature-item">'
        + iconRing(f.icon, 'prm-icon-ring--feature')
        + '<span>' + esc(f.label) + '</span></li>';
    }).join('');

    panelsHtml += '<div class="prm-demo-panel' + (active ? ' is-active' : '') + '"'
      + ' id="' + panelId + '" role="tabpanel" data-prm-panel="' + esc(group.tab.key) + '"'
      + (active ? '' : ' hidden') + '>'
      + '<div class="prm-demo-layout">'
      + '<div class="prm-demo-stage">'
      + DemoBrowser(demo, { className: 'prm-demo-browser', width: 1200 })
      + DemoPhone(demo, { className: 'prm-demo-phone', width: 480 })
      + '<div class="prm-demo-actions prm-demo-actions--stage">'
      + '<a class="prm-btn prm-btn-primary" href="' + esc(demo.url) + '" target="_blank" rel="noopener">'
      + '<span>' + esc(c.ctaExplore || 'View live demo') + '</span>'
      + '<span class="prm-btn-icon">' + renderIcon('external') + '</span></a>'
      + '<a class="prm-btn prm-btn-ghost" href="#contact" data-demo-ref="' + esc(demo.slug) + '">'
      + esc(c.ctaBuild || 'Build this website') + '</a>'
      + '</div></div>'
      + '<div class="prm-demo-side">'
      + (features ? '<ul class="prm-feature-list">' + features + '</ul>' : '')
      + '</div></div></div>';
  });

  return '<section class="prm-demo-showcase" id="' + esc(tabsId) + '">'
    + '<div class="prm-shell">'
    + (c.eyebrow ? '<p class="wc-eyebrow wc-eyebrow--pill">' + esc(c.eyebrow) + '</p>' : '')
    + '<h2 class="prm-h1 prm-serif">' + esc(c.heading || 'Choose an industry.')
    + (c.headingLine2 ? '<span class="prm-h1-line">' + esc(c.headingLine2) + '</span>' : '')
    + '</h2>'
    + '<div class="prm-tabs" role="tablist" aria-label="Industry demos">' + tabsHtml + '</div>'
    + '<div class="prm-demo-panels" data-prm-demo-panels>' + panelsHtml + '</div>'
    + '</div></section>';
}

function LeadFlowDiagram(steps, opts) {
  opts = opts || {};
  const list = steps || [];
  const mainSteps = list.filter(function(s) { return !s.branch; });
  const branchStep = list.find(function(s) { return s.branch; });
  const headingHtml = opts.heading
    ? (opts.headingEmphasis
      ? emphasizeText(opts.heading, opts.headingEmphasis)
      : esc(opts.heading))
    : '';
  return '<div class="prm-lead-flow">'
    + (opts.eyebrow ? '<p class="prm-eyebrow prm-eyebrow--lime">' + esc(opts.eyebrow) + '</p>' : '')
    + (headingHtml ? '<h2 class="prm-h2 prm-serif prm-on-dark">' + headingHtml + '</h2>' : '')
    + '<div class="prm-flow-board">'
    + connectedFlowArt()
    + '<ol class="prm-flow-steps prm-flow-steps--horizontal" data-prm-flow>'
    + mainSteps.map(function(step, i) {
      return '<li class="prm-flow-step" style="--prm-step:' + i + '">'
        + iconRing(step.icon, 'prm-icon-ring--flow')
        + '<span class="prm-flow-label">' + esc(step.label) + '</span>'
        + (step.sub ? '<span class="prm-flow-sub">' + esc(step.sub) + '</span>' : '')
        + '</li>';
    }).join('')
    + '</ol>'
    + (branchStep ? '<div class="prm-flow-branch">'
      + '<div class="prm-flow-step prm-flow-step--highlight">'
      + iconRing(branchStep.icon, 'prm-icon-ring--flow prm-icon-ring--filled')
      + '<span class="prm-flow-label">' + esc(branchStep.label) + '</span>'
      + '</div></div>' : '')
    + '</div></div>';
}

function ServiceCard(pillar) {
  if (!pillar) return '';
  return '<article class="prm-service-card">'
    + '<span class="prm-service-icon">' + icon(pillar.icon) + '</span>'
    + '<h3 class="prm-service-title">' + esc(pillar.title) + '</h3>'
    + '<p class="prm-service-summary">' + esc(pillar.summary) + '</p>'
    + '</article>';
}

function Timeline(steps) {
  const list = steps || [];
  return '<div class="prm-timeline-wrap">'
    + processConnectorArt()
    + '<ol class="prm-timeline" data-prm-timeline>'
    + list.map(function(s, i) {
      return '<li class="prm-timeline-step" style="--prm-step:' + i + '">'
        + iconRing(s.icon || 'plan', 'prm-icon-ring--timeline')
        + '<span class="prm-timeline-num">' + String(s.step || (i + 1)) + '</span>'
        + '<h3>' + esc(s.title) + '</h3>'
        + '<p>' + esc(s.description) + '</p>'
        + '</li>';
    }).join('')
    + '</ol></div>';
}

function PartnerCard(content, ctx, copy) {
  const p = content.partner || {};
  const b = content.biography || {};
  const c = content.contact || {};
  const brand = p.agencyName || p.displayName || 'Partner';
  let visual = '';
  if (p.headshotUrl && isValidImageUrl(p.headshotUrl)) {
    visual = '<img src="' + esc(p.headshotUrl) + '" alt="' + esc(p.displayName) + '" class="prm-partner-photo" loading="lazy">';
  } else if (ctx && ctx.logoUrl) {
    visual = '<img src="' + esc(ctx.logoUrl) + '" alt="' + esc(brand) + '" class="prm-partner-logo" loading="lazy">';
  } else {
    visual = '<div class="prm-partner-initial" aria-hidden="true">' + esc((p.displayName || brand).charAt(0).toUpperCase()) + '</div>';
  }
  const pc = copy || {};
  const sa = content.serviceArea || {};
  return '<article class="prm-partner-card">'
    + '<div class="prm-partner-visual">' + visual + '</div>'
    + (p.displayName ? '<p class="prm-partner-name">' + esc(p.displayName) + '</p>' : '')
    + (b.shortIntro ? '<p class="prm-partner-intro">' + esc(b.shortIntro) + '</p>' : '')
    + '<span class="prm-partner-badge">' + renderIcon('check') + '<span>' + esc(pc.badge || 'LeadPages Certified Partner') + '</span></span>'
    + (sa.headline ? '<p class="prm-partner-region">' + esc(sa.headline) + '</p>' : '')
    + '<div class="prm-partner-actions">'
    + (c.phone ? '<a class="prm-btn prm-btn-ghost" href="tel:' + String(c.phone).replace(/[^+0-9]/g, '') + '">' + esc(c.phone) + '</a>' : '')
    + (c.email ? '<a class="prm-btn prm-btn-ghost" href="mailto:' + esc(c.email) + '">Email</a>' : '')
    + '</div></article>';
}

function PlatformDiagram(content, copy) {
  const p = content.partner || {};
  const agency = p.agencyName || p.displayName || 'Your partner';
  const plc = copy || {};
  return '<div class="prm-platform-diagram">'
    + '<div class="prm-platform-row">'
    + '<article class="prm-platform-card">'
    + '<h3>' + esc(agency) + '</h3>'
    + '<ul>' + (plc.agencyItems || []).map(function(item) {
      return '<li><span class="prm-platform-item-icon">' + renderIcon('square') + '</span>'
        + '<span>' + esc(item) + '</span></li>';
    }).join('') + '</ul></article>'
    + '<article class="prm-platform-card">'
    + '<h3>LeadPages Platform</h3>'
    + '<ul>' + (plc.platformItems || []).map(function(item) {
      return '<li><span class="prm-platform-item-icon">' + renderIcon('square') + '</span>'
        + '<span>' + esc(item) + '</span></li>';
    }).join('') + '</ul></article>'
    + '</div>'
    + platformBridgeArt()
    + '<div class="prm-platform-hub">'
    + '<div class="prm-platform-circle"><span class="prm-platform-hub-label">' + esc(plc.connector || 'Your complete website service') + '</span></div>'
    + '</div></div>';
}

function ReviewCard(testimonial, contact, metrics, social, serviceArea) {
  const t = testimonial || {};
  const c = contact || {};
  const s = social || {};
  const sa = serviceArea || {};
  const starRow = [1, 2, 3, 4, 5].map(function() { return renderIcon('star'); }).join('');
  let badges = '<span class="prm-review-badge">Google</span><span class="prm-review-badge">Facebook</span>';
  if (s.googleBusiness) badges = '<span class="prm-review-badge">Google</span>' + badges;
  return '<article class="prm-review-card">'
    + '<div class="prm-review-stars" aria-label="5 out of 5 stars">' + starRow + '</div>'
    + '<p class="prm-review-rating">5.0 from 28+ reviews</p>'
    + '<blockquote class="prm-serif"><p>&ldquo;' + esc(t.text || '') + '&rdquo;</p>'
    + '<footer><strong>' + esc(t.customerName || 'Client') + '</strong>'
    + (t.businessName ? '<span>' + esc(t.businessName) + '</span>' : '')
    + '</footer></blockquote>'
    + '<div class="prm-review-badges">' + badges + '</div>'
    + '<ul class="prm-review-contact">'
    + (c.phone ? '<li><a href="tel:' + String(c.phone).replace(/[^+0-9]/g, '') + '">' + esc(c.phone) + '</a></li>' : '')
    + (c.email ? '<li><a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></li>' : '')
    + (sa.areas && sa.areas[0] ? '<li>' + esc(sa.areas[0].label) + '</li>' : '')
    + (c.responseTime ? '<li>' + esc(c.responseTime) + '</li>' : '')
    + '</ul></article>';
}

function ContactPanel(content, copy) {
  const cc = copy || {};
  const ef = content.enquiryForm || {};
  const goals = ef.goals || [];

  return '<div class="prm-contact-panel">'
    + '<h3 class="prm-h3 prm-on-dark">' + esc(cc.formTitle || 'Let\u2019s plan your website') + '</h3>'
    + '<form class="prm-form prm-form--dark prm-form--tight pt-enquiry-form" data-pl-lead-form data-pl-kind="partner-consultation" data-pl-extended="1" method="post" action="#">'
    + '<label><span>Name *</span><input name="name" type="text" required autocomplete="name"></label>'
    + '<label><span>Email</span><input name="email" type="email" autocomplete="email"></label>'
    + '<label><span>Phone</span><input name="phone" type="tel" autocomplete="tel"></label>'
    + '<label><span>Business name</span><input name="businessName" type="text"></label>'
    + '<label><span>What do you need?</span><select name="mainGoal">'
    + '<option value="">Select…</option>'
    + goals.map(function(g) { return '<option value="' + esc(g) + '">' + esc(g) + '</option>'; }).join('')
    + '</select></label>'
    + '<label><span>Message</span><textarea name="message" rows="4" placeholder="Tell us about your project"></textarea></label>'
    + '<div class="prm-form-extended" id="prm-form-more" hidden>'
    + '<label><span>Existing website</span><input name="existingWebsite" type="url"></label>'
    + '<label><span>Industry</span><input name="industry" type="text"></label>'
    + '</div>'
    + '<button type="button" class="prm-form-more-btn" data-prm-form-more aria-expanded="false" aria-controls="prm-form-more">'
    + esc(cc.moreLabel || 'Tell us more') + '</button>'
    + '<button class="prm-btn prm-btn-primary" type="submit">Send my enquiry →</button>'
    + '<p class="pl-form-err" role="alert"></p>'
    + '<p class="pl-form-ok prm-on-dark" hidden role="status">Thanks — we\'ll be in touch shortly.</p>'
    + '</form></div>';
}

function FinalCTA(content, copy) {
  const hero = content.hero || {};
  const cc = copy || {};
  return '<section class="prm-final-cta" id="cta">'
    + '<div class="prm-shell prm-final-cta-inner">'
    + '<h2 class="prm-display prm-serif">' + esc(cc.heading || 'Ready to get started?') + '</h2>'
    + '<a class="prm-btn prm-btn-ink" href="#contact">' + esc(hero.primaryCta || 'Plan my website') + ' →</a>'
    + '</div></section>';
}

module.exports = {
  DemoBrowser,
  DemoPhone,
  HeroWebsiteShowcase,
  LiveDemoGallery,
  IndustryTabs,
  LeadFlowDiagram,
  ServiceCard,
  Timeline,
  PartnerCard,
  PlatformDiagram,
  ReviewCard,
  ContactPanel,
  FinalCTA,
  icon,
  iconRing,
  demoThumbSrc,
  demoScreenHtml
};
