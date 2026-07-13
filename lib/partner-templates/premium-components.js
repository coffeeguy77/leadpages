/**
 * Reusable premium partner theme components.
 */
const { esc } = require('./shared');
const { isValidImageUrl } = require('../partner-website/demo-cards');
const { partnerLogoDisplayUrl } = require('../partner-website/logo');
const { isLogoThumbnail } = require('../partner-website/webculture-theme');
const { placeholderInitial, publicPhotoAlt } = require('../partner-website/public-identity');
const {
  renderIcon,
  connectedFlowArt
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

function demoHost(demo) {
  const d = demo || {};
  return (d.url || '').replace(/^https?:\/\//, '').split('/')[0] || 'live-demo';
}

function normalizeShowcaseDemos(demoOrList) {
  if (!demoOrList) return [{ name: 'Live demo', url: '#demos', industry: 'Website preview' }];
  if (Array.isArray(demoOrList)) {
    const list = demoOrList.filter(Boolean);
    return list.length ? list : [{ name: 'Live demo', url: '#demos', industry: 'Website preview' }];
  }
  return [demoOrList];
}

function demoPickerLabel(demo) {
  const industry = String((demo && demo.industry) || '').trim();
  if (industry) return industry.split(/\s+/)[0];
  const name = String((demo && demo.name) || '').trim();
  if (name) return name.split(/\s+/)[0];
  return 'Demo';
}

function demoLivePoster(demo, width) {
  const src = demoThumbSrc(demo, width);
  if (!src) return '';
  return '<img src="' + src + '" alt="" class="prm-live-poster" decoding="async" aria-hidden="true">';
}

function demoLiveFrame(demo, variant) {
  const url = (demo && demo.url) ? demo.url : '#demos';
  const name = (demo && demo.name) ? demo.name : 'Live demo';
  const posterWidth = variant === 'phone' ? 520 : 1400;
  const v = variant === 'phone' ? 'phone' : 'desktop';
  return '<div class="prm-live-frame prm-live-frame--' + v + '">'
    + demoLivePoster(demo, posterWidth)
    + '<iframe class="prm-live-iframe" data-prm-live-iframe="' + v + '" data-prm-live-scroll src="' + esc(url) + '"'
    + ' loading="lazy" title="' + esc(name) + ' live preview" tabindex="-1"></iframe>'
    + '</div>';
}

function heroDotNav(demos) {
  if (!demos || demos.length < 2) return '';
  return '<div class="prm-hero-dots" role="tablist" aria-label="Preview live website demos">'
    + demos.map(function(d, i) {
      const label = demoPickerLabel(d);
      const host = demoHost(d);
      const thumb = demoThumbSrc(d, 1200);
      return '<button type="button" role="tab" class="prm-hero-dot' + (i === 0 ? ' is-active' : '') + '"'
        + ' data-prm-hero-pick="' + i + '"'
        + ' data-demo-url="' + esc(d.url || '#demos') + '"'
        + ' data-demo-host="' + esc(host) + '"'
        + ' data-demo-name="' + esc(d.name || 'Live demo') + '"'
        + (thumb ? ' data-demo-thumb="' + thumb + '"' : '')
        + ' aria-selected="' + (i === 0 ? 'true' : 'false') + '"'
        + ' aria-label="' + esc((d.industry || d.name || label) + ' demo') + '">'
        + '<span class="prm-hero-dot-mark" aria-hidden="true"></span>'
        + '<span class="prm-hero-dot-label">' + esc(label) + '</span>'
        + '</button>';
    }).join('')
    + '</div>';
}

function heroBrowserFrame(demo) {
  const host = demoHost(demo);
  const url = demo.url || '#demos';
  return '<article class="prm-browser prm-hero-browser" data-prm-browser>'
    + '<div class="prm-browser-chrome" aria-hidden="true">'
    + '<span class="prm-browser-traffic"><i></i><i></i><i></i></span>'
    + '<span class="prm-browser-address">'
    + '<span class="prm-browser-lock" aria-hidden="true">' + renderIcon('lock') + '</span>'
    + '<span class="prm-browser-url" data-prm-hero-url>' + esc(host) + '</span>'
    + '</span>'
    + '<span class="prm-browser-live" aria-hidden="true">Live</span>'
    + '</div>'
    + '<div class="prm-browser-screen">'
    + demoLiveFrame(demo, 'desktop')
    + '<a class="prm-hero-open" data-prm-hero-open href="' + esc(url) + '" target="_blank" rel="noopener">'
    + '<span class="prm-hero-open-label">Open live demo</span></a>'
    + '</div></article>';
}

function demoShowcaseDevices(demo) {
  const url = demo.url || '#demos';
  const host = demoHost(demo);
  return '<div class="prm-demo-stage-devices" data-prm-demo-devices>'
    + '<article class="prm-browser prm-demo-browser" data-prm-browser>'
    + '<div class="prm-browser-chrome" aria-hidden="true">'
    + '<span class="prm-browser-traffic"><i></i><i></i><i></i></span>'
    + '<span class="prm-browser-address">'
    + '<span class="prm-browser-lock" aria-hidden="true">' + renderIcon('lock') + '</span>'
    + '<span class="prm-browser-url" data-prm-demo-url>' + esc(host) + '</span>'
    + '</span>'
    + '<span class="prm-browser-live" aria-hidden="true">Live</span>'
    + '</div>'
    + '<div class="prm-browser-screen">'
    + demoLiveFrame(demo, 'desktop')
    + '</div></article>'
    + '<article class="prm-phone prm-demo-phone" data-prm-phone>'
    + '<div class="prm-phone-shell">'
    + '<div class="prm-phone-island" aria-hidden="true"></div>'
    + '<div class="prm-phone-screen">'
    + demoLiveFrame(demo, 'phone')
    + '</div>'
    + '<span class="prm-phone-home" aria-hidden="true"></span>'
    + '</div></article>'
    + '<a class="prm-demo-open" href="' + esc(url) + '" target="_blank" rel="noopener">Open live demo</a>'
    + '</div>';
}

function heroPhoneFrame(demo) {
  const url = demo.url || '#demos';
  return '<article class="prm-phone prm-hero-phone" data-prm-phone>'
    + '<div class="prm-phone-shell">'
    + '<div class="prm-phone-island" aria-hidden="true"></div>'
    + '<div class="prm-phone-screen">'
    + demoLiveFrame(demo, 'phone')
    + '</div>'
    + '<span class="prm-phone-home" aria-hidden="true"></span>'
    + '<a class="prm-hero-phone-link" data-prm-hero-phone-open href="' + esc(url) + '" target="_blank" rel="noopener"'
    + ' aria-label="Open live demo on mobile"></a>'
    + '</div></article>';
}

function DemoBrowser(demoOrDemos, opts) {
  opts = opts || {};
  const demos = normalizeShowcaseDemos(demoOrDemos);
  const primary = demos[0];
  const cls = opts.className ? ' ' + esc(opts.className) : '';
  const animate = opts.animate !== false ? ' prm-browser--animate' : '';
  const host = demoHost(primary);
  return '<div class="prm-browser' + cls + animate + '" data-prm-browser>'
    + '<div class="prm-browser-chrome" aria-hidden="true">'
    + '<span class="prm-browser-traffic"><i></i><i></i><i></i></span>'
    + '<div class="prm-browser-toolbar">'
    + '<span class="prm-browser-nav-btn" aria-hidden="true"></span>'
    + '<span class="prm-browser-nav-btn" aria-hidden="true"></span>'
    + '<span class="prm-browser-address">'
    + '<span class="prm-browser-lock" aria-hidden="true">' + renderIcon('lock') + '</span>'
    + '<span class="prm-browser-url">' + esc(host) + '</span>'
    + '</span>'
    + '</div>'
    + '</div>'
    + '<div class="prm-browser-body">'
    + '<div class="prm-browser-screen">'
    + '<a class="prm-browser-screen-link" href="' + esc(primary.url || '#demos') + '" target="_blank" rel="noopener">'
    + demoScreenHtml(primary, opts.width || 1200)
    + '</a>'
    + '</div></div></div>';
}

function DemoPhone(demoOrDemos, opts) {
  opts = opts || {};
  const demos = normalizeShowcaseDemos(demoOrDemos);
  const primary = demos[0];
  const cls = opts.className ? ' ' + esc(opts.className) : '';
  const animate = opts.animate !== false ? ' prm-phone--animate' : '';
  return '<div class="prm-phone' + cls + animate + '" data-prm-phone>'
    + '<div class="prm-phone-shell">'
    + '<div class="prm-phone-island" aria-hidden="true"></div>'
    + '<div class="prm-phone-screen">'
    + '<a class="prm-phone-screen-link" href="' + esc(primary.url || '#demos') + '" target="_blank" rel="noopener">'
    + demoScreenHtml(primary, opts.width || 480)
    + '</a>'
    + '</div>'
    + '<span class="prm-phone-home" aria-hidden="true"></span>'
    + '</div></div>';
}

function HeroWebsiteShowcase(demoOrDemos, opts) {
  opts = opts || {};
  const demos = normalizeShowcaseDemos(demoOrDemos);
  const primary = demos[0];
  const toast = opts.toast || {};
  const rotating = demos.length > 1;
  return '<div class="prm-hero-showcase' + (opts.className ? ' ' + esc(opts.className) : '') + '"'
    + (rotating ? ' data-prm-hero-showcase data-prm-hero-interval="' + (opts.interval || 6000) + '"' : '')
    + '>'
    + '<div class="prm-hero-stage">'
    + '<div class="prm-hero-glow" aria-hidden="true"></div>'
    + '<div class="prm-hero-devices">'
    + heroBrowserFrame(primary)
    + heroPhoneFrame(primary)
    + '</div>'
    + '<aside class="prm-quote-toast" data-prm-toast role="status" aria-live="polite">'
    + '<span class="prm-quote-toast-dot" aria-hidden="true"></span>'
    + '<div class="prm-quote-toast-copy">'
    + '<strong data-prm-toast-title>' + esc(toast.title || 'New quote request') + '</strong>'
    + '<span data-prm-toast-body>' + esc(toast.body || 'New enquiry received') + '</span>'
    + '<time data-prm-toast-time>' + esc(toast.time || 'Just now') + '</time>'
    + '</div></aside>'
    + '</div>'
    + heroDotNav(demos)
    + '</div>';
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
  let indicatorsHtml = '';

  groups.forEach(function(group, i) {
    const demo = group.demos[0];
    const active = i === 0;
    const panelId = 'prm-demo-panel-' + group.tab.key;
    tabsHtml += '<button type="button" class="prm-tab' + (active ? ' is-active' : '') + '"'
      + ' role="tab" aria-selected="' + (active ? 'true' : 'false') + '"'
      + ' aria-controls="' + panelId + '" data-prm-tab="' + esc(group.tab.key) + '"'
      + ' data-prm-tab-index="' + i + '">'
      + esc(group.tab.label) + '</button>';

    indicatorsHtml += '<button type="button" class="prm-demo-indicator' + (active ? ' is-active' : '') + '"'
      + ' data-prm-demo-indicator="' + i + '" aria-label="' + esc(group.tab.label) + ' demo"'
      + ' aria-selected="' + (active ? 'true' : 'false') + '"></button>';

    const features = (c.features || []).map(function(f) {
      return '<li class="prm-feature-item">'
        + iconRing(f.icon, 'prm-icon-ring--feature')
        + '<span>' + esc(f.label) + '</span></li>';
    }).join('');

    const desc = demo.description || c.sub || '';

    panelsHtml += '<div class="prm-demo-panel' + (active ? ' is-active' : '') + '"'
      + ' id="' + panelId + '" role="tabpanel" data-prm-panel="' + esc(group.tab.key) + '"'
      + ' data-prm-panel-index="' + i + '"'
      + ' data-demo-url="' + esc(demo.url || '#demos') + '"'
      + ' data-demo-slug="' + esc(demo.slug || '') + '"'
      + (active ? '' : ' hidden') + '>'
      + '<div class="prm-demo-layout">'
      + '<div class="prm-demo-stage">'
      + demoShowcaseDevices(demo)
      + '<div class="prm-demo-actions prm-demo-actions--stage">'
      + '<a class="prm-btn prm-btn-primary" data-prm-demo-explore href="' + esc(demo.url) + '" target="_blank" rel="noopener">'
      + '<span>' + esc(c.ctaExplore || 'View live demo') + '</span>'
      + '<span class="prm-btn-icon">' + renderIcon('external') + '</span></a>'
      + '<a class="prm-btn prm-btn-ghost" href="#contact" data-demo-ref="' + esc(demo.slug) + '" data-prm-demo-build>'
      + esc(c.ctaBuild || 'Build this website') + '</a>'
      + '</div></div>'
      + '<div class="prm-demo-side">'
      + (desc ? '<p class="prm-demo-desc" data-prm-demo-desc>' + esc(desc) + '</p>' : '')
      + (features ? '<ul class="prm-feature-list" data-prm-demo-features>' + features + '</ul>' : '')
      + '</div></div></div>';
  });

  const controls = '<div class="prm-demo-controls" data-prm-demo-controls>'
    + '<button type="button" class="prm-demo-nav prm-demo-nav--prev" data-prm-demo-prev aria-label="Previous demo">'
    + '<span aria-hidden="true">←</span> Previous</button>'
    + '<div class="prm-demo-indicators" role="tablist" aria-label="Demo slides">' + indicatorsHtml + '</div>'
    + '<button type="button" class="prm-demo-nav prm-demo-nav--next" data-prm-demo-next aria-label="Next demo">'
    + 'Next <span aria-hidden="true">→</span></button>'
    + '</div>';

  const body = ''
    + (c.eyebrow ? '<p class="wc-eyebrow wc-eyebrow--pill">' + esc(c.eyebrow) + '</p>' : '')
    + '<h2 class="prm-h1 prm-serif">' + esc(c.heading || 'Choose an industry.')
    + (c.headingLine2 ? '<span class="prm-h1-line">' + esc(c.headingLine2) + '</span>' : '')
    + '</h2>'
    + '<div class="prm-tabs" role="tablist" aria-label="Industry demos">' + tabsHtml + '</div>'
    + controls
    + '<div class="prm-demo-panels" data-prm-demo-panels>' + panelsHtml + '</div>';

  if (opts.embedded) {
    return '<div class="wc-hero-demos prm-demo-showcase prm-demo-showcase--embedded" id="' + esc(tabsId) + '"'
      + ' data-prm-demo-carousel data-prm-demo-interval="8000">' + body + '</div>';
  }

  return '<section class="prm-demo-showcase" id="' + esc(tabsId) + '"'
    + ' data-prm-demo-carousel data-prm-demo-interval="8000">'
    + '<div class="prm-shell">'
    + body
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
    + '<div class="prm-flow-board" data-prm-flow-board>'
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
    + '<ol class="prm-timeline" data-prm-timeline data-prm-timeline-animate>'
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
  const identity = { displaySurnamePublicly: p.displaySurnamePublicly === true };
  const intro = p.publicIntro || {};
  const agencyHeading = intro.agencyHeading || p.agencyName || 'Your agency';
  const contactLine = intro.contactLine || null;
  const brand = p.agencyName || agencyHeading;
  const photoAlt = publicPhotoAlt(p.displayName, brand, identity);
  let visual = '';
  if (p.headshotUrl && isValidImageUrl(p.headshotUrl)) {
    visual = '<img src="' + esc(p.headshotUrl) + '" alt="' + esc(photoAlt) + '" class="prm-partner-photo" loading="lazy">';
  } else {
    const initial = placeholderInitial(brand, p.displayName, identity);
    visual = '<div class="prm-partner-placeholder" aria-hidden="true"><span>' + esc(initial) + '</span></div>';
  }
  const pc = copy || {};
  const sa = content.serviceArea || {};
  return '<article class="prm-partner-card">'
    + '<div class="prm-partner-visual">' + visual + '</div>'
    + '<h2 class="prm-partner-agency prm-serif">' + esc(agencyHeading) + '</h2>'
    + (contactLine ? '<p class="prm-partner-contact-line">' + esc(contactLine) + '</p>' : '')
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
    + '<div class="prm-platform-bridge">'
    + '<article class="prm-platform-card">'
    + '<h3>' + esc(agency) + '</h3>'
    + '<ul>' + (plc.agencyItems || []).map(function(item) {
      return '<li><span class="prm-platform-item-icon">' + renderIcon('square') + '</span>'
        + '<span>' + esc(item) + '</span></li>';
    }).join('') + '</ul></article>'
    + '<div class="prm-platform-hub" aria-hidden="true">'
    + '<span class="prm-platform-link"></span>'
    + '<div class="prm-platform-circle"><span class="prm-platform-hub-label">' + esc(plc.connector || 'Your complete website service') + '</span></div>'
    + '<span class="prm-platform-link"></span>'
    + '</div>'
    + '<article class="prm-platform-card">'
    + '<h3>LeadPages Platform</h3>'
    + '<ul>' + (plc.platformItems || []).map(function(item) {
      return '<li><span class="prm-platform-item-icon">' + renderIcon('square') + '</span>'
        + '<span>' + esc(item) + '</span></li>';
    }).join('') + '</ul></article>'
    + '</div></div>';
}

function ReviewCard(testimonial) {
  const t = testimonial || {};
  const starRow = [1, 2, 3, 4, 5].map(function() { return renderIcon('star'); }).join('');
  return '<article class="prm-review-card">'
    + '<div class="prm-review-top">'
    + '<div class="prm-review-stars" aria-label="5 out of 5 stars">' + starRow + '</div>'
    + '<p class="prm-review-rating">5.0 · 28+ reviews</p>'
    + '</div>'
    + '<blockquote><p>&ldquo;' + esc(t.text || '') + '&rdquo;</p>'
    + '<footer><cite>' + esc(t.customerName || 'Client') + '</cite>'
    + (t.businessName ? '<span>' + esc(t.businessName) + '</span>' : '')
    + '</footer></blockquote>'
    + '</article>';
}

function ContactPanel(content, copy) {
  const cc = copy || {};
  const ef = content.enquiryForm || {};
  const goals = ef.goals || [];

  return '<div class="prm-contact-panel">'
    + '<h3 class="prm-h3 prm-on-dark">' + esc(cc.formTitle || 'Let\u2019s plan your website') + '</h3>'
    + '<form class="prm-form prm-form--dark prm-form--compact pt-enquiry-form" data-pl-lead-form data-pl-kind="partner-consultation" data-pl-extended="1" method="post" action="#">'
    + '<label class="prm-field"><input name="name" type="text" required autocomplete="name" placeholder="Name *" aria-label="Name"></label>'
    + '<label class="prm-field"><input name="email" type="email" autocomplete="email" placeholder="Email" aria-label="Email"></label>'
    + '<label class="prm-field"><input name="phone" type="tel" autocomplete="tel" placeholder="Phone" aria-label="Phone"></label>'
    + '<label class="prm-field"><input name="businessName" type="text" placeholder="Business name" aria-label="Business name"></label>'
    + '<label class="prm-field prm-field--full"><select name="mainGoal" aria-label="What do you need?">'
    + '<option value="">What do you need?</option>'
    + goals.map(function(g) { return '<option value="' + esc(g) + '">' + esc(g) + '</option>'; }).join('')
    + '</select></label>'
    + '<label class="prm-field prm-field--full"><textarea name="message" rows="3" placeholder="Message" aria-label="Message"></textarea></label>'
    + '<div class="prm-form-extended" id="prm-form-more" hidden>'
    + '<label class="prm-field"><input name="existingWebsite" type="url" placeholder="Existing website" aria-label="Existing website"></label>'
    + '<label class="prm-field"><input name="industry" type="text" placeholder="Industry" aria-label="Industry"></label>'
    + '</div>'
    + '<button type="button" class="prm-form-more-btn" data-prm-form-more aria-expanded="false" aria-controls="prm-form-more">'
    + esc(cc.moreLabel || 'Tell us more') + '</button>'
    + '<button class="prm-btn prm-btn-primary prm-btn--compact" type="submit">Send my enquiry →</button>'
    + '<p class="pl-form-err" role="alert"></p>'
    + '<p class="pl-form-ok prm-on-dark" hidden role="status">Thanks — we\'ll be in touch shortly.</p>'
    + '</form></div>';
}

function FinalCTA(content, copy) {
  const hero = content.hero || {};
  const cc = copy || {};
  const btnLabel = cc.button || hero.primaryCta || 'Plan My Website';
  return '<section class="prm-final-cta prm-final-cta--slim" id="cta">'
    + '<div class="prm-shell prm-final-cta-inner">'
    + '<div class="prm-final-cta-lead">'
    + iconRing('rocket', 'prm-icon-ring--cta')
    + '<div class="prm-final-cta-copy">'
    + '<h2 class="prm-final-cta-title prm-serif">' + esc(cc.heading || 'Ready for a website that works harder for your business?') + '</h2>'
    + '<p class="prm-final-cta-sub">' + esc(cc.sub || 'Let\u2019s build something great together.') + '</p>'
    + '</div></div>'
    + '<a class="prm-btn prm-btn-ink prm-btn--slim" href="#contact">' + esc(btnLabel) + ' →</a>'
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
