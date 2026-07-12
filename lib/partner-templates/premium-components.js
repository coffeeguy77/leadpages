/**
 * Reusable premium partner theme components.
 * CSS prefix: prm- (premium). Used by webculture and future premium themes.
 */
const { esc } = require('./shared');
const { isValidImageUrl } = require('../partner-website/demo-cards');
const { partnerLogoDisplayUrl } = require('../partner-website/logo');
const { isLogoThumbnail } = require('../partner-website/webculture-theme');

const ICONS = {
  build: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16M6 20V10l6-6 6 6v10M10 20v-6h4v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  convert: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4zM8 10h8M8 14h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  connect: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="6" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="18" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.3 11.2 15.7 7M8.3 12.8l7.4 4.2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  grow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18h16M7 16l3-5 3 3 4-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="11" r="2" fill="currentColor"/></svg>',
  monitor: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 20h8M12 16v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18h11a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 6.5 8 4.5 4.5 0 0 0 7 18z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  target: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>',
  device: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 18h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10-10-4-4L4 16v4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  globe: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 12h16M12 4a12 12 0 0 1 0 16M12 4a12 12 0 0 0 0 16" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  form: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 8h8M8 12h8M8 16h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  crm: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 9h4M7 13h10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m8.5 12 2.5 2.5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

function icon(name) {
  return '<span class="prm-icon">' + (ICONS[name] || ICONS.target) + '</span>';
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
  return '<div class="prm-browser' + cls + animate + '" data-prm-browser>'
    + '<div class="prm-browser-chrome" aria-hidden="true">'
    + '<span class="prm-browser-dot"></span><span class="prm-browser-dot"></span><span class="prm-browser-dot"></span>'
    + '<span class="prm-browser-url">' + esc((d.url || '').replace(/^https?:\/\//, '').split('/')[0] || 'live-demo') + '</span>'
    + '</div>'
    + '<a class="prm-browser-screen" href="' + esc(d.url || '#demos') + '" target="_blank" rel="noopener">'
    + demoScreenHtml(d, opts.width || 1200)
    + '</a>'
    + '</div>';
}

function DemoPhone(demo, opts) {
  opts = opts || {};
  const cls = opts.className ? ' ' + esc(opts.className) : '';
  const animate = opts.animate !== false ? ' prm-phone--animate' : '';
  const d = demo || { name: 'Live demo', url: '#demos' };
  return '<div class="prm-phone' + cls + animate + '" data-prm-phone>'
    + '<div class="prm-phone-notch" aria-hidden="true"></div>'
    + '<a class="prm-phone-screen" href="' + esc(d.url || '#demos') + '" target="_blank" rel="noopener">'
    + demoScreenHtml(d, opts.width || 480)
    + '</a>'
    + '</div>';
}

function HeroWebsiteShowcase(demo, opts) {
  opts = opts || {};
  const toast = opts.toast || {};
  return '<div class="prm-hero-showcase' + (opts.className ? ' ' + esc(opts.className) : '') + '">'
    + DemoBrowser(demo, { className: 'prm-hero-browser', width: 1400 })
    + DemoPhone(demo, { className: 'prm-hero-phone', width: 520 })
    + '<div class="prm-quote-toast" data-prm-toast role="status" aria-live="polite">'
    + '<span class="prm-quote-toast-icon" aria-hidden="true">✓</span>'
    + '<div class="prm-quote-toast-copy">'
    + '<strong>' + esc(toast.title || 'New quote request') + '</strong>'
    + '<span>' + esc(toast.body || 'New enquiry received') + '</span>'
    + '<time>' + esc(toast.time || 'Just now') + '</time>'
    + '</div></div>'
    + '</div>';
}

function LiveDemoGallery(demos, copy) {
  const list = (demos || []).filter(function(d) {
    return d && d.url && (d.thumbnail || d.name);
  });
  if (!list.length) return '';
  const c = copy || {};
  return '<section class="prm-gallery" id="gallery" aria-label="Live demo gallery">'
    + '<div class="prm-shell">'
    + (c.eyebrow ? '<p class="prm-eyebrow">' + esc(c.eyebrow) + '</p>' : '')
    + (c.heading ? '<h2 class="prm-h2">' + esc(c.heading) + '</h2>' : '')
    + '</div>'
    + '<div class="prm-gallery-track" data-prm-gallery>'
    + list.map(function(d, i) {
      const src = demoThumbSrc(d, 640);
      const bg = d.thumbnailColor ? ' style="--prm-thumb-bg:' + esc(d.thumbnailColor) + '"' : '';
      return '<article class="prm-gallery-card" data-prm-gallery-card style="--prm-i:' + i + '">'
        + '<button type="button" class="prm-gallery-thumb" aria-expanded="false" aria-controls="prm-gallery-panel-' + i + '">'
        + (src
          ? '<img src="' + src + '" alt="' + esc(d.name) + ' thumbnail" loading="lazy" decoding="async">'
          : '<span class="prm-gallery-thumb-fallback">' + esc(d.name) + '</span>')
        + '<span class="prm-gallery-thumb-label">' + esc(d.industry || 'Live demo') + '</span>'
        + '</button>'
        + '<div class="prm-gallery-panel" id="prm-gallery-panel-' + i + '" hidden>'
        + DemoBrowser(d, { animate: false, width: 1000 })
        + '<div class="prm-gallery-panel-actions">'
        + '<a class="prm-btn prm-btn-primary" href="' + esc(d.url) + '" target="_blank" rel="noopener">'
        + esc(c.openLabel || 'Open live demo') + '</a>'
        + '<a class="prm-btn prm-btn-ghost" href="#contact">Build this website</a>'
        + '</div></div></article>';
    }).join('')
    + '</div></section>';
}

function IndustryTabs(groups, copy, opts) {
  opts = opts || {};
  if (!groups || !groups.length) return '';
  const c = copy || {};
  const activeIdx = 0;
  const tabsId = opts.id || 'demos';
  let panelsHtml = '';
  let tabsHtml = '';

  groups.forEach(function(group, i) {
    const demo = group.demos[0];
    const active = i === activeIdx;
    const panelId = 'prm-demo-panel-' + group.tab.key;
    tabsHtml += '<button type="button" class="prm-tab' + (active ? ' is-active' : '') + '"'
      + ' role="tab" aria-selected="' + (active ? 'true' : 'false') + '"'
      + ' aria-controls="' + panelId + '" data-prm-tab="' + esc(group.tab.key) + '">'
      + esc(group.tab.label) + '</button>';

    const features = (c.features || []).map(function(f) {
      return '<li class="prm-feature-item">' + icon(f.icon) + '<span>' + esc(f.label) + '</span></li>';
    }).join('');

    panelsHtml += '<div class="prm-demo-panel' + (active ? ' is-active' : '') + '"'
      + ' id="' + panelId + '" role="tabpanel" data-prm-panel="' + esc(group.tab.key) + '"'
      + (active ? '' : ' hidden') + '>'
      + '<div class="prm-demo-layout">'
      + '<div class="prm-demo-stage">'
      + DemoBrowser(demo, { className: 'prm-demo-browser', width: 1200 })
      + DemoPhone(demo, { className: 'prm-demo-phone', width: 480 })
      + '</div>'
      + '<div class="prm-demo-side">'
      + '<h3 class="prm-demo-name">' + esc(demo.name) + '</h3>'
      + '<p class="prm-demo-industry">' + esc(demo.industry || 'Live website demo') + '</p>'
      + (demo.description ? '<p class="prm-demo-desc">' + esc(demo.description) + '</p>' : '')
      + (features ? '<ul class="prm-feature-list">' + features + '</ul>' : '')
      + '<div class="prm-demo-actions">'
      + '<a class="prm-btn prm-btn-primary" href="' + esc(demo.url) + '" target="_blank" rel="noopener">'
      + esc(c.ctaExplore || 'View live demo') + ' →</a>'
      + '<a class="prm-btn prm-btn-ghost" href="#contact" data-demo-ref="' + esc(demo.slug) + '">'
      + esc(c.ctaBuild || 'Build this website') + '</a>'
      + '</div></div></div></div>';
  });

  return '<section class="prm-demo-showcase" id="' + esc(tabsId) + '">'
    + '<div class="prm-shell">'
    + (c.eyebrow ? '<p class="prm-eyebrow">' + esc(c.eyebrow) + '</p>' : '')
    + '<h2 class="prm-h1">' + esc(c.heading || 'Choose an industry.')
    + (c.headingLine2 ? '<span class="prm-h1-line">' + esc(c.headingLine2) + '</span>' : '')
    + '</h2>'
    + (c.sub ? '<p class="prm-lead">' + esc(c.sub) + '</p>' : '')
    + '<div class="prm-tabs" role="tablist" aria-label="Industry demos">' + tabsHtml + '</div>'
    + '<div class="prm-demo-panels" data-prm-demo-panels>' + panelsHtml + '</div>'
    + '</div></section>';
}

function LeadFlowDiagram(steps, heading) {
  const list = steps || [];
  return '<div class="prm-lead-flow">'
    + (heading ? '<h2 class="prm-h2 prm-on-dark">' + esc(heading) + '</h2>' : '')
    + '<ol class="prm-flow-steps prm-flow-steps--horizontal" data-prm-flow>'
    + list.map(function(step, i) {
      const hl = step.highlight ? ' prm-flow-step--highlight' : '';
      return '<li class="prm-flow-step' + hl + '" style="--prm-step:' + i + '">'
        + '<span class="prm-flow-node">' + icon(step.icon) + '</span>'
        + '<span class="prm-flow-label">' + esc(step.label) + '</span>'
        + (step.sub ? '<span class="prm-flow-sub">' + esc(step.sub) + '</span>' : '')
        + (i < list.length - 1 ? '<span class="prm-flow-arrow" aria-hidden="true">→</span>' : '')
        + '</li>';
    }).join('')
    + '</ol></div>';
}

function ServiceCard(pillar) {
  if (!pillar) return '';
  return '<article class="prm-service-card" data-prm-lift>'
    + icon(pillar.icon)
    + '<h3 class="prm-service-title">' + esc(pillar.title) + '</h3>'
    + '<p class="prm-service-summary">' + esc(pillar.summary) + '</p>'
    + '</article>';
}

function Timeline(steps) {
  const list = steps || [];
  return '<ol class="prm-timeline" data-prm-timeline>'
    + list.map(function(s, i) {
      return '<li class="prm-timeline-step" style="--prm-step:' + i + '">'
        + '<span class="prm-timeline-num">' + String(s.step || (i + 1)) + '</span>'
        + '<div class="prm-timeline-copy">'
        + '<h3>' + esc(s.title) + '</h3>'
        + '<p>' + esc(s.description) + '</p>'
        + '</div></li>';
    }).join('')
    + '</ol>';
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
    visual = '<img src="' + esc(ctx.logoUrl) + '" alt="' + esc(brand) + ' logo" class="prm-partner-logo" loading="lazy">';
  } else {
    visual = '<div class="prm-partner-initial" aria-hidden="true">' + esc(brand.charAt(0).toUpperCase()) + '</div>';
  }
  const pc = copy || {};
  const cta = c.ctaLabel || (content.hero && content.hero.primaryCta) || 'Plan my website';
  return '<article class="prm-partner-card">'
    + '<div class="prm-partner-visual">' + visual + '</div>'
    + (pc.eyebrow ? '<p class="prm-eyebrow prm-eyebrow--lime">' + esc(pc.eyebrow) + '</p>' : '')
    + '<h2 class="prm-h2">' + esc(pc.heading || ('Work with ' + p.displayName)) + '</h2>'
    + (b.shortIntro ? '<p class="prm-partner-intro">' + esc(b.shortIntro) + '</p>' : '')
    + (p.displayName ? '<p class="prm-partner-name"><strong>' + esc(p.displayName) + '</strong></p>' : '')
    + '<span class="prm-partner-badge">' + esc(pc.badge || 'LeadPages Partner') + '</span>'
    + '<div class="prm-partner-actions">'
    + (c.email ? '<a class="prm-btn prm-btn-ghost" href="mailto:' + esc(c.email) + '">Email</a>' : '')
    + (c.phone ? '<a class="prm-btn prm-btn-ghost" href="tel:' + String(c.phone).replace(/[^+0-9]/g, '') + '">' + esc(c.phone) + '</a>' : '')
    + '<a class="prm-btn prm-btn-primary" href="#contact">' + esc(cta) + '</a>'
    + '</div></article>';
}

function PlatformDiagram(content, copy) {
  const p = content.partner || {};
  const agency = p.agencyName || p.displayName || 'Your partner';
  const plc = copy || {};
  return '<div class="prm-platform-diagram" data-prm-lift>'
    + '<article class="prm-platform-card prm-platform-card--agency">'
    + '<h3>' + esc(agency) + '</h3>'
    + '<ul>' + (plc.agencyItems || []).map(function(item) {
      return '<li>' + esc(item) + '</li>';
    }).join('') + '</ul></article>'
    + '<div class="prm-platform-bridge" aria-hidden="true">'
    + '<span class="prm-platform-line"></span>'
    + '<span class="prm-platform-circle"></span>'
    + '<span class="prm-platform-hub-label">' + esc(plc.connector || 'Your complete website service') + '</span>'
    + '<span class="prm-platform-line"></span>'
    + '</div>'
    + '<article class="prm-platform-card prm-platform-card--platform">'
    + '<h3>LeadPages Platform</h3>'
    + '<ul>' + (plc.platformItems || []).map(function(item) {
      return '<li>' + esc(item) + '</li>';
    }).join('') + '</ul></article>'
    + '</div>';
}

function ReviewCard(testimonial, contact, metrics, social) {
  const t = testimonial || {};
  const c = contact || {};
  const m = metrics || {};
  const s = social || {};
  const stars = '★★★★★';
  let socialHtml = '';
  if (s.googleBusiness) socialHtml += '<span class="prm-review-badge">Google</span>';
  if (s.facebook) socialHtml += '<span class="prm-review-badge">Facebook</span>';
  if (s.linkedin) socialHtml += '<span class="prm-review-badge">LinkedIn</span>';
  return '<article class="prm-review-card">'
    + '<div class="prm-review-stars" aria-label="5 out of 5 stars">' + stars + '</div>'
    + '<p class="prm-review-rating">5.0 rating</p>'
    + '<blockquote><p>&ldquo;' + esc(t.text || '') + '&rdquo;</p>'
    + '<footer><strong>' + esc(t.customerName || 'Client') + '</strong>'
    + (t.businessName ? '<span>' + esc(t.businessName) + '</span>' : '')
    + (t.location ? '<span>' + esc(t.location) + '</span>' : '')
    + '</footer></blockquote>'
    + (socialHtml ? '<div class="prm-review-badges">' + socialHtml + '</div>' : '')
    + '<div class="prm-review-meta">'
    + (c.responseTime ? '<p class="prm-review-response"><strong>Response time:</strong> ' + esc(c.responseTime) + '</p>' : '')
    + (c.phone ? '<p><a class="prm-contact-link" href="tel:' + String(c.phone).replace(/[^+0-9]/g, '') + '">' + esc(c.phone) + '</a></p>' : '')
    + (c.email ? '<p><a class="prm-contact-link" href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></p>' : '')
    + '</div></article>';
}

function ContactPanel(content, copy) {
  const cc = copy || {};
  const ef = content.enquiryForm || {};
  const showExt = ef.showExtended !== false;
  const goals = ef.goals || [];
  const features = ef.features || [];

  let extended = '';
  if (showExt) {
    extended = '<div class="prm-form-extended" id="prm-form-more" hidden>'
      + '<label><span>Existing website</span><input name="existingWebsite" type="url" placeholder="https://"></label>'
      + '<label><span>Industry</span><input name="industry" type="text"></label>'
      + '<label><span>Suburb</span><input name="suburb" type="text"></label>'
      + '<label><span>What do you need?</span><select name="mainGoal">'
      + '<option value="">Select…</option>'
      + goals.map(function(g) { return '<option value="' + esc(g) + '">' + esc(g) + '</option>'; }).join('')
      + '</select></label>'
      + '<label><span>Message</span><textarea name="message" rows="3"></textarea></label>'
      + (features.length ? '<fieldset><legend>Features of interest</legend>'
        + features.map(function(f) {
          return '<label class="prm-check"><input type="checkbox" name="features" value="' + esc(f) + '"> ' + esc(f) + '</label>';
        }).join('') + '</fieldset>' : '')
      + '</div>'
      + '<button type="button" class="prm-form-more-btn" data-prm-form-more aria-expanded="false" aria-controls="prm-form-more">'
      + esc(cc.moreLabel || 'Tell us more') + '</button>';
  }

  return '<div class="prm-contact-panel" data-prm-lift>'
    + (cc.formTitle ? '<h3 class="prm-h3">' + esc(cc.formTitle) + '</h3>' : '')
    + (cc.formSub ? '<p class="prm-form-sub">' + esc(cc.formSub) + '</p>' : '')
    + '<form class="prm-form pt-enquiry-form" data-pl-lead-form data-pl-kind="partner-consultation" data-pl-extended="1" method="post" action="#">'
    + '<label><span>Name *</span><input name="name" type="text" required autocomplete="name"></label>'
    + '<label><span>Email</span><input name="email" type="email" autocomplete="email"></label>'
    + '<label><span>Phone</span><input name="phone" type="tel" autocomplete="tel"></label>'
    + '<label><span>Business name</span><input name="businessName" type="text" autocomplete="organization"></label>'
    + extended
    + '<button class="prm-btn prm-btn-primary" type="submit">Send my enquiry →</button>'
    + '<p class="pl-form-err" role="alert"></p>'
    + '<p class="pl-form-ok" hidden role="status">Thanks — we\'ll be in touch shortly.</p>'
    + '</form></div>';
}

function FinalCTA(content, copy) {
  const hero = content.hero || {};
  const cc = copy || {};
  return '<section class="prm-final-cta" id="cta">'
    + '<div class="prm-shell prm-final-cta-inner">'
    + '<h2 class="prm-display">' + esc(cc.heading || 'Ready to get started?') + '</h2>'
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
  demoThumbSrc,
  demoScreenHtml
};
