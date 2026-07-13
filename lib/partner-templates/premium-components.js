/**
 * Reusable premium partner theme components.
 */
const { esc } = require('./shared');
const { isValidImageUrl } = require('../partner-website/demo-cards');
const { partnerLogoDisplayUrl } = require('../partner-website/logo');
const { isLogoThumbnail } = require('../partner-website/webculture-theme');
const { placeholderInitial, publicPhotoAlt, publicPartnerBio } = require('../partner-website/public-identity');
const {
  renderIcon,
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

function heroBrowserFrame(demo, opts) {
  opts = opts || {};
  const host = demoHost(demo);
  const url = demo.url || '#demos';
  const picker = opts.pickerHtml || '';
  return '<article class="prm-browser prm-hero-browser" data-prm-browser>'
    + '<div class="prm-browser-chrome" aria-hidden="true">'
    + '<span class="prm-browser-traffic"><i></i><i></i><i></i></span>'
    + '<span class="prm-browser-address">'
    + '<span class="prm-browser-lock" aria-hidden="true">' + renderIcon('lock') + '</span>'
    + '<span class="prm-browser-url" data-prm-hero-url>' + esc(host) + '</span>'
    + '</span>'
    + (picker ? '<span class="prm-hero-browser-picker">' + picker + '</span>' : '<span class="prm-browser-live">Live</span>')
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
    + '<p class="prm-demo-client-badge" aria-hidden="true">'
    + '<span class="prm-demo-client-badge-dot"></span>LIVE CLIENT WEBSITE</p>'
    + '<article class="prm-browser prm-demo-browser prm-demo-browser--deep" data-prm-browser>'
    + '<div class="prm-browser-chrome" aria-hidden="true">'
    + '<span class="prm-browser-traffic"><i></i><i></i><i></i></span>'
    + '<span class="prm-browser-address">'
    + '<span class="prm-browser-lock" aria-hidden="true">' + renderIcon('lock') + '</span>'
    + '<span class="prm-browser-url" data-prm-demo-url>' + esc(host) + '</span>'
    + '</span>'
    + '<span class="prm-browser-live prm-browser-live--animated" aria-hidden="true">'
    + '<span class="prm-browser-live-dot"></span>Live</span>'
    + '</div>'
    + '<div class="prm-browser-screen">'
    + demoLiveFrame(demo, 'desktop')
    + '</div></article>'
    + '<article class="prm-phone prm-demo-phone prm-demo-phone--float" data-prm-phone>'
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

function heroDashboardEmbedded(copy) {
  const c = copy || {};
  const widgets = c.widgets || [];
  if (!widgets.length) return '';
  return '<div class="prm-eco-dashboard" aria-label="LeadPages platform dashboard">'
    + '<div class="prm-eco-dashboard-grid">'
    + widgets.map(function(widget) {
      const status = widget.status === 'live'
        ? '<span class="wc-dashboard-status wc-dashboard-status--live">Live</span>'
        : '<span class="wc-dashboard-hint">' + esc(widget.hint || 'Connected') + '</span>';
      return '<article class="wc-dashboard-widget">'
        + '<p class="wc-dashboard-label">' + esc(widget.label) + '</p>'
        + status
        + '</article>';
    }).join('')
    + '</div></div>';
}

function HeroProductEcosystem(demoOrDemos, opts) {
  opts = opts || {};
  const demos = normalizeShowcaseDemos(demoOrDemos);
  const primary = demos[0];
  const toast = opts.toast || {};
  const pipeline = [
    { icon: 'website', label: 'Website' },
    { icon: 'enquiries', label: 'Leads' },
    { icon: 'crm', label: 'CRM' },
    { icon: 'grow', label: 'Growth' }
  ];
  return '<div class="prm-hero-ecosystem" data-prm-hero-ecosystem'
    + ' aria-label="Website, leads and CRM in one connected platform">'
    + '<div class="prm-eco-ambient" aria-hidden="true"></div>'
    + '<div class="prm-eco-stack">'
    + '<div class="prm-eco-browser-zone">'
    + heroBrowserFrame(primary, {})
    + heroPhoneFrame(primary)
    + '<aside class="prm-eco-toast prm-eco-toast--lead" data-prm-eco-toast="lead" role="status" aria-live="polite">'
    + '<span class="prm-eco-toast-dot" aria-hidden="true"></span>'
    + '<div class="prm-eco-toast-copy">'
    + '<strong>' + esc(toast.title || 'New quote request') + '</strong>'
    + '<span>' + esc(toast.body || 'Kitchen renovation enquiry') + '</span>'
    + '<time>' + esc(toast.time || 'Just now') + '</time>'
    + '</div></aside>'
    + '<aside class="prm-eco-toast prm-eco-toast--crm" data-prm-eco-toast="crm" role="status" aria-hidden="true">'
    + '<span class="prm-eco-toast-dot" aria-hidden="true"></span>'
    + '<div class="prm-eco-toast-copy">'
    + '<strong>CRM lead received</strong>'
    + '<span>' + esc(toast.body || 'Ready to follow up') + '</span>'
    + '</div></aside>'
    + '</div>'
    + heroDashboardEmbedded(opts.dashboard)
    + '</div>'
    + '<div class="prm-eco-pipeline" aria-hidden="true">'
    + pipeline.map(function(step, i) {
      const bridge = i < pipeline.length - 1
        ? '<span class="prm-eco-pipeline-bridge"></span>'
        : '';
      return '<span class="prm-eco-pipeline-step" style="--prm-pipe:' + i + '">'
        + iconRing(step.icon, 'prm-icon-ring--eco-pipe')
        + '<span class="prm-eco-pipeline-label">' + esc(step.label) + '</span>'
        + '</span>' + bridge;
    }).join('')
    + '</div></div>';
}

function HeroTrustMeta(trustItems, metrics, responseCopy) {
  const items = trustItems || [];
  const rc = responseCopy || {};
  const responseValue = (metrics && metrics.typicalResponseTime)
    ? String(metrics.typicalResponseTime)
    : (rc.value || rc.fallback || '');
  const strip = items.length
    ? '<ul class="wc-hero-trust-strip" aria-label="Trust indicators">'
      + items.map(function(item) {
        return '<li>'
          + '<span class="wc-hero-trust-icon" aria-hidden="true">' + renderIcon(item.icon || 'check') + '</span>'
          + '<span>' + esc(item.label) + '</span>'
          + '</li>';
      }).join('')
      + '</ul>'
    : '';
  const badge = responseValue
    ? '<aside class="wc-hero-response-badge" aria-label="Response time">'
      + '<p class="wc-hero-response-label">' + esc(rc.label || 'Average response') + '</p>'
      + '<p class="wc-hero-response-value">' + esc(responseValue) + '</p>'
      + '</aside>'
    : '';
  if (!strip && !badge) return '';
  return '<div class="wc-hero-trust-meta">' + strip + badge + '</div>';
}

function HeroCustomerJourney(steps, opts) {
  opts = opts || {};
  const list = steps || [];
  if (!list.length) return '';
  const interval = opts.interval || 7000;
  const toast = opts.toast || {};
  return '<div class="prm-hero-journey"'
    + ' data-prm-hero-journey data-prm-journey-interval="' + interval + '"'
    + ' aria-label="How your website generates business">'
    + '<div class="prm-journey-stage">'
    + '<div class="prm-journey-glow" aria-hidden="true"></div>'
    + '<div class="prm-journey-canvas">'
    + '<div class="prm-journey-device prm-journey-device--site" data-journey-device="site">'
    + '<div class="prm-journey-browser-mini">'
    + '<div class="prm-journey-browser-bar" aria-hidden="true"><span></span><span></span><span></span></div>'
    + '<div class="prm-journey-browser-content">'
    + '<div class="prm-journey-skeleton" aria-hidden="true"></div>'
    + '<div class="prm-journey-skeleton prm-journey-skeleton--short" aria-hidden="true"></div>'
    + '<div class="prm-journey-cta-bar" aria-hidden="true"></div>'
    + '<div class="prm-journey-form-pop" data-journey-pop="enquiry">'
    + '<strong>' + esc(toast.title || 'New enquiry') + '</strong>'
    + '<span class="prm-journey-form-field" aria-hidden="true"></span>'
    + '<span class="prm-journey-form-field" aria-hidden="true"></span>'
    + '<span class="prm-journey-form-submit">Submit</span>'
    + '</div>'
    + '</div></div></div>'
    + '<div class="prm-journey-device prm-journey-device--crm" data-journey-device="crm">'
    + '<div class="prm-journey-crm-card">'
    + '<span class="prm-journey-crm-label">CRM</span>'
    + '<div class="prm-journey-lead" data-journey-pop="lead">'
    + '<strong>' + esc(toast.title || 'New lead') + '</strong>'
    + '<span>' + esc(toast.body || 'Kitchen renovation enquiry') + '</span>'
    + '</div>'
    + '<div class="prm-journey-lead-status" data-journey-pop="contacted">'
    + '<span class="prm-journey-status-badge">Contacted</span>'
    + '</div>'
    + '</div></div>'
    + '<div class="prm-journey-device prm-journey-device--phone" data-journey-device="phone">'
    + '<div class="prm-journey-phone-mini">'
    + '<div class="prm-journey-notification" data-journey-pop="notify">'
    + '<strong>' + esc(toast.title || 'New enquiry') + '</strong>'
    + '<span>' + esc(toast.body || 'Kitchen renovation enquiry') + '</span>'
    + '</div>'
    + '</div></div>'
    + '<div class="prm-journey-success" data-journey-pop="success" aria-hidden="true">'
    + iconRing('check', 'prm-icon-ring--journey-success')
    + '<span>Lead captured</span>'
    + '</div>'
    + '</div>'
    + '<ol class="prm-journey-track" aria-hidden="true">'
    + list.map(function(s, i) {
      return '<li class="prm-journey-step' + (i === 0 ? ' is-active' : '') + '"'
        + ' data-journey-step="' + i + '"'
        + ' title="' + esc(s.label) + '"></li>';
    }).join('')
    + '</ol>'
    + '<p class="prm-journey-caption" data-prm-journey-caption aria-live="polite">'
    + esc(list[0].label) + '</p>'
    + '</div></div>';
}

function DemoTrustList(items) {
  const list = items || [];
  if (!list.length) return '';
  return '<ul class="prm-demo-trust" data-prm-demo-trust>'
    + list.map(function(item) {
      return '<li>'
        + '<span class="prm-demo-trust-icon" aria-hidden="true">' + renderIcon(item.icon || 'check') + '</span>'
        + '<span>' + esc(item.label) + '</span>'
        + '</li>';
    }).join('')
    + '</ul>';
}

function TransformCompare(beforeItems, afterItems) {
  const before = beforeItems || [];
  const after = afterItems || [];
  if (!before.length || !after.length) return '';
  function col(items, mod) {
    const isBefore = mod === 'before';
    return '<ul class="prm-transform-list">'
      + items.map(function(item) {
        return '<li>'
          + '<span class="prm-transform-mark prm-transform-mark--' + (isBefore ? 'neg' : 'pos') + '" aria-hidden="true">'
          + (isBefore ? '×' : '✓')
          + '</span>'
          + '<span>' + esc(item) + '</span></li>';
      }).join('')
      + '</ul>';
  }
  return '<div class="prm-transform" aria-label="Business transformation">'
    + '<div class="prm-transform-col prm-transform-col--before">'
    + '<span class="prm-transform-tag">Before</span>'
    + col(before, 'before')
    + '</div>'
    + '<div class="prm-transform-bridge" aria-hidden="true"><span></span></div>'
    + '<div class="prm-transform-col prm-transform-col--after">'
    + '<span class="prm-transform-tag">After</span>'
    + col(after, 'after')
    + '</div></div>';
}

function ProofStats(metrics) {
  const m = metrics || {};
  const items = [];
  if (m.partnerBusinessesSupported) {
    items.push({ value: String(m.partnerBusinessesSupported), label: 'Businesses supported', suffix: '+' });
  }
  if (m.partnerProjectsCompleted) {
    items.push({ value: String(m.partnerProjectsCompleted), label: 'Websites launched', suffix: '' });
  }
  if (m.typicalResponseTime) {
    items.push({ value: String(m.typicalResponseTime), label: 'Average response', suffix: '' });
  }
  if (m.googleRating) {
    items.push({ value: String(m.googleRating), label: 'Google Rating', suffix: '★' });
  }
  if (!items.length) return '';
  return '<div class="prm-proof-stats" aria-label="Partner metrics">'
    + items.map(function(item) {
      const suffix = item.suffix || '';
      const display = esc(item.value) + (suffix && !String(item.value).includes(suffix) ? esc(suffix) : '');
      return '<article class="prm-proof-stat">'
        + '<p class="prm-proof-stat-value">' + display + '</p>'
        + '<p class="prm-proof-stat-label">' + esc(item.label) + '</p>'
        + '</article>';
    }).join('')
    + '</div>';
}

function HeroWebsiteShowcase(demoOrDemos, opts) {
  opts = opts || {};
  const demos = normalizeShowcaseDemos(demoOrDemos);
  const primary = demos[0];
  const toast = opts.toast || {};
  const rotating = demos.length > 1;
  const picker = rotating ? heroDotNav(demos) : '';
  return '<div class="prm-hero-showcase' + (opts.className ? ' ' + esc(opts.className) : '') + '"'
    + (rotating ? ' data-prm-hero-showcase data-prm-hero-interval="' + (opts.interval || 8000) + '"' : '')
    + '>'
    + '<div class="prm-hero-stage">'
    + '<div class="prm-hero-glow" aria-hidden="true"></div>'
    + '<div class="prm-hero-devices">'
    + heroBrowserFrame(primary, { pickerHtml: picker })
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

function DemoFaqPanel(faqs, copy, opts) {
  opts = opts || {};
  const list = (faqs || []).filter(function(f) {
    return f && f.question && String(f.question).trim();
  });
  if (!list.length) return '';
  const c = copy || {};
  const featuredCount = Math.max(1, c.featuredCount || 5);
  const featured = list.slice(0, featuredCount);
  const more = list.slice(featuredCount);

  function faqItem(f, open) {
    return '<details class="prm-faq-item"' + (open ? ' open' : '') + '>'
      + '<summary class="prm-faq-q">' + esc(f.question) + '</summary>'
      + '<div class="prm-faq-a"><p>' + esc(f.answer) + '</p></div></details>';
  }

  const panelAttrs = opts.panelKey
    ? ' data-prm-faq-panel="' + esc(opts.panelKey) + '"'
      + (opts.active === false ? ' hidden' : '')
    : '';
  const idAttr = opts.rootId ? ' id="' + esc(opts.rootId) + '"' : '';

  return '<aside class="prm-demo-faq"' + idAttr + panelAttrs + ' aria-label="Frequently asked questions">'
    + (opts.showHeading !== false && c.eyebrow ? '<p class="wc-eyebrow wc-eyebrow--pill">' + esc(c.eyebrow) + '</p>' : '')
    + (opts.showHeading !== false && c.heading ? '<h3 class="prm-faq-heading prm-serif">' + esc(c.heading) + '</h3>' : '')
    + '<div class="prm-faq-list" data-prm-faq-list>'
    + featured.map(function(f, i) { return faqItem(f, i === 0); }).join('')
    + (more.length
      ? '<div class="prm-faq-more" hidden data-prm-faq-more>'
        + more.map(function(f) { return faqItem(f, false); }).join('')
        + '</div>'
      : '')
    + '</div>'
    + (more.length
      ? '<button type="button" class="prm-faq-expand" data-prm-faq-expand>'
        + esc(c.expandLabel || 'View all questions') + '</button>'
      : '')
    + '</aside>';
}

function IndustryTabs(groups, copy, opts) {
  opts = opts || {};
  if (!groups || !groups.length) return '';
  const c = copy || {};
  const tabsId = opts.id || 'demos';
  const faqs = opts.faqs || [];
  const faqForTab = opts.faqForTab;
  const faqHtml = groups.length && (faqs.length || faqForTab)
    ? '<div class="prm-demo-faq-stack" data-prm-faq-panels>'
      + groups.map(function(group, i) {
        const tabFaqs = faqForTab ? faqForTab(group.tab.key, faqs) : faqs;
        return DemoFaqPanel(tabFaqs, opts.faqCopy || {}, {
          panelKey: group.tab.key,
          active: i === 0,
          rootId: i === 0 ? 'faqs' : undefined,
          showHeading: i === 0
        });
      }).join('')
      + '</div>'
    : '';
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

    const desc = demo.description || c.sub || '';
    const trustItems = opts.trustItems || [];

    panelsHtml += '<div class="prm-demo-panel' + (active ? ' is-active' : '') + '"'
      + ' id="' + panelId + '" role="tabpanel" data-prm-panel="' + esc(group.tab.key) + '"'
      + ' data-prm-panel-index="' + i + '"'
      + ' data-demo-url="' + esc(demo.url || '#demos') + '"'
      + ' data-demo-host="' + esc(demoHost(demo)) + '"'
      + ' data-demo-slug="' + esc(demo.slug || '') + '"'
      + (active ? '' : ' hidden') + '>'
      + '<div class="prm-demo-stage">'
      + demoShowcaseDevices(demo)
      + '<div class="prm-demo-actions prm-demo-actions--stage">'
      + '<a class="prm-btn prm-btn-primary" data-prm-demo-explore href="' + esc(demo.url) + '" target="_blank" rel="noopener">'
      + '<span>' + esc(c.ctaExplore || 'View live demo') + '</span>'
      + '<span class="prm-btn-icon">' + renderIcon('external') + '</span></a>'
      + '<a class="prm-btn prm-btn-ghost" href="#contact" data-demo-ref="' + esc(demo.slug) + '" data-prm-demo-build>'
      + esc(c.ctaBuild || 'Build this website') + '</a>'
      + '</div></div>'
      + (desc ? '<p class="prm-demo-desc prm-demo-desc--below" data-prm-demo-desc>' + esc(desc) + '</p>' : '')
      + DemoTrustList(trustItems)
      + '</div>';
  });

  const controls = '<div class="prm-demo-controls" data-prm-demo-controls>'
    + '<button type="button" class="prm-demo-nav prm-demo-nav--prev" data-prm-demo-prev aria-label="Previous demo">'
    + '<span aria-hidden="true">←</span> Previous</button>'
    + '<div class="prm-demo-indicators" role="tablist" aria-label="Demo slides">' + indicatorsHtml + '</div>'
    + '<button type="button" class="prm-demo-nav prm-demo-nav--next" data-prm-demo-next aria-label="Next demo">'
    + 'Next <span aria-hidden="true">→</span></button>'
    + '</div>';

  const panelsBlock = '<div class="prm-demo-panels" data-prm-demo-panels>' + panelsHtml + '</div>';
  const demoBody = faqHtml
    ? '<div class="prm-demo-body">' + panelsBlock + faqHtml + '</div>'
    : panelsBlock;

  const body = ''
    + (c.eyebrow ? '<p class="wc-eyebrow wc-eyebrow--pill">' + esc(c.eyebrow) + '</p>' : '')
    + '<h2 class="prm-h1 prm-serif">' + esc(c.heading || 'Choose an industry.')
    + (c.headingLine2 ? '<span class="prm-h1-line">' + esc(c.headingLine2) + '</span>' : '')
    + '</h2>'
    + '<div class="prm-tabs" role="tablist" aria-label="Industry demos">' + tabsHtml + '</div>'
    + controls
    + demoBody;

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
    + '<ol class="prm-flow-steps prm-flow-steps--horizontal" data-prm-flow data-prm-flow-steps="' + mainSteps.length + '">'
    + mainSteps.map(function(step, i) {
      var stepHtml = '<li class="prm-flow-step" data-prm-flow-step="' + i + '" style="--prm-step:' + i + '">'
        + iconRing(step.icon, 'prm-icon-ring--flow')
        + '<span class="prm-flow-label">' + esc(step.label) + '</span>'
        + (step.sub ? '<span class="prm-flow-sub">' + esc(step.sub) + '</span>' : '')
        + '</li>';
      var arrowHtml = i < mainSteps.length - 1
        ? '<li class="prm-flow-arrow" aria-hidden="true">'
          + '<span class="prm-flow-arrow-icon">' + renderIcon('arrow') + '</span>'
          + '</li>'
        : '';
      return stepHtml + arrowHtml;
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
    + '<div class="prm-service-copy">'
    + '<h3 class="prm-service-title">' + esc(pillar.title) + '</h3>'
    + '<p class="prm-service-summary">' + esc(pillar.summary) + '</p>'
    + (pillar.detail ? '<p class="prm-service-detail">' + esc(pillar.detail) + '</p>' : '')
    + '</div></article>';
}

function Timeline(steps) {
  const list = steps || [];
  return '<div class="prm-timeline-wrap">'
    + '<ol class="prm-timeline" data-prm-timeline data-prm-timeline-animate data-prm-timeline-interactive>'
    + list.map(function(s, i) {
      return '<li class="prm-timeline-step" data-prm-timeline-step="' + i + '" style="--prm-step:' + i + '">'
        + iconRing(s.icon || 'plan', 'prm-icon-ring--timeline')
        + '<span class="prm-timeline-num">' + String(s.step || (i + 1)) + '</span>'
        + '<h3>' + esc(s.title) + '</h3>'
        + '<p class="prm-timeline-summary">' + esc(s.description) + '</p>'
        + (s.detail ? '<p class="prm-timeline-detail">' + esc(s.detail) + '</p>' : '')
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
  const pc = copy || {};
  const sa = content.serviceArea || {};
  const bioIntro = publicPartnerBio(b.shortIntro, intro, { agencyName: brand, displayName: p.displayName });

  let logoHtml = '';
  if (ctx && ctx.logoUrl) {
    const raw = String(ctx.logoUrl).replace(/&amp;/g, '&').trim();
    if (raw && isValidImageUrl(raw)) {
      const src = esc(partnerLogoDisplayUrl(raw, 240));
      logoHtml = '<img src="' + src + '" alt="' + esc(brand) + ' logo" class="prm-partner-logo" loading="lazy" decoding="async">';
    }
  }

  let visual = '';
  if (p.headshotUrl && isValidImageUrl(p.headshotUrl)) {
    visual = '<img src="' + esc(p.headshotUrl) + '" alt="' + esc(photoAlt) + '" class="prm-partner-photo" loading="lazy">';
  } else {
    const initial = placeholderInitial(brand, p.displayName, identity);
    visual = '<div class="prm-partner-portrait" aria-hidden="true"><span>' + esc(initial) + '</span></div>';
  }

  return '<article class="prm-partner-card">'
    + (logoHtml ? '<div class="prm-partner-logo-wrap">' + logoHtml + '</div>' : '')
    + '<div class="prm-partner-visual">' + visual + '</div>'
    + '<h2 class="prm-partner-agency prm-serif">' + esc(agencyHeading) + '</h2>'
    + (contactLine ? '<p class="prm-partner-contact-line">' + esc(contactLine) + '</p>' : '')
    + (bioIntro ? '<p class="prm-partner-intro">' + esc(bioIntro) + '</p>' : '')
    + '<span class="prm-partner-badge">' + renderIcon('check') + '<span>' + esc(pc.badge || 'LeadPages Certified Partner') + '</span></span>'
    + (sa.headline ? '<p class="prm-partner-region">' + esc(sa.headline) + '</p>' : '')
    + '<div class="prm-partner-actions">'
    + (c.phone ? '<a class="prm-btn prm-btn-ghost" href="tel:' + String(c.phone).replace(/[^+0-9]/g, '') + '">' + esc(pc.callCta || 'Call') + '</a>' : '')
    + (c.email ? '<a class="prm-btn prm-btn-ghost" href="mailto:' + esc(c.email) + '">Email</a>' : '')
    + '<a class="prm-btn prm-btn-primary" href="#contact">' + esc(pc.bookCta || 'Book Consultation') + '</a>'
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

function reviewSummaryHtml(opts) {
  opts = opts || {};
  const rating = opts.googleRating;
  const count = opts.googleReviewCount;
  const link = opts.googleLink;
  const starsHtml = '<div class="prm-review-stars" aria-hidden="true">'
    + [1, 2, 3, 4, 5].map(function() { return renderIcon('star'); }).join('')
    + '</div>';
  if (rating && count) {
    const label = Number(rating).toFixed(1) + ' · ' + String(count) + '+ reviews';
    const inner = starsHtml + '<p class="prm-review-rating">'
      + '<span class="prm-review-source">Google Reviews</span>'
      + '<span class="prm-review-trust">Trusted by local businesses</span>'
      + '<span class="prm-review-count">' + esc(label) + '</span></p>';
    if (link) {
      return '<a class="prm-review-summary" href="' + esc(link) + '" target="_blank" rel="noopener">' + inner + '</a>';
    }
    return '<div class="prm-review-summary">' + inner + '</div>';
  }
  const fallback = opts.fallback || 'Google Reviews · Trusted by local businesses';
  const inner = starsHtml + '<p class="prm-review-rating">'
    + '<span class="prm-review-source">' + esc(fallback) + '</span></p>';
  if (link) {
    return '<a class="prm-review-summary" href="' + esc(link) + '" target="_blank" rel="noopener">' + inner + '</a>';
  }
  return '<div class="prm-review-summary prm-review-summary--fallback">' + inner + '</div>';
}

function ReviewCard(testimonial, opts) {
  opts = opts || {};
  const t = testimonial || {};
  const slideCls = opts.slide ? ' prm-review-slide' + (opts.active ? ' is-active' : '') : '';
  const slideAttrs = opts.slide
    ? ' data-prm-review-slide="' + (opts.index || 0) + '"'
      + (opts.active ? '' : ' aria-hidden="true"')
    : '';
  const summary = opts.showSummary ? reviewSummaryHtml(opts.summary || {}) : '';
  return '<article class="prm-review-card' + slideCls + '"' + slideAttrs + '>'
    + (summary ? '<div class="prm-review-top">' + summary + '</div>' : '')
    + '<blockquote><p>&ldquo;' + esc(t.text || '') + '&rdquo;</p>'
    + '<footer><cite>' + esc(t.customerName || 'Client') + '</cite>'
    + (t.businessName ? '<span>' + esc(t.businessName) + '</span>' : '')
    + '</footer></blockquote>'
    + '</article>';
}

function ReviewSlider(testimonials, opts) {
  opts = opts || {};
  const list = (testimonials || []).filter(function(t) {
    return t && t.text && String(t.text).trim();
  });
  if (!list.length) return '';
  const interval = opts.interval || 10000;
  const multi = list.length > 1;
  const indicators = list.map(function(_t, i) {
    return '<button type="button" class="prm-review-indicator' + (i === 0 ? ' is-active' : '') + '"'
      + ' data-prm-review-indicator="' + i + '"'
      + ' aria-label="Show testimonial ' + (i + 1) + ' of ' + list.length + '"'
      + ' aria-selected="' + (i === 0 ? 'true' : 'false') + '"></button>';
  }).join('');

  const summary = {
    googleRating: opts.googleRating,
    googleReviewCount: opts.googleReviewCount,
    googleLink: opts.googleLink,
    fallback: opts.reviewFallback
  };
  return '<div class="prm-review-slider"'
    + (multi ? ' data-prm-review-slider data-prm-review-interval="' + interval + '"' : '')
    + '>'
    + '<div class="prm-review-slider-viewport">'
    + '<div class="prm-review-slides" role="region" aria-roledescription="carousel" aria-label="Client testimonials">'
    + list.map(function(t, i) {
      return ReviewCard(t, {
        slide: true,
        active: i === 0,
        index: i,
        showSummary: i === 0,
        summary: summary
      });
    }).join('')
    + '</div></div>'
    + (multi
      ? '<div class="prm-review-slider-controls">'
        + '<button type="button" class="prm-review-nav prm-review-nav--prev" data-prm-review-prev aria-label="Previous testimonial">'
        + '<span aria-hidden="true">←</span></button>'
        + '<div class="prm-review-indicators" role="tablist" aria-label="Testimonial slides">' + indicators + '</div>'
        + '<button type="button" class="prm-review-nav prm-review-nav--next" data-prm-review-next aria-label="Next testimonial">'
        + '<span aria-hidden="true">→</span></button>'
        + '</div>'
      : '')
    + '</div>';
}

function ContactPanel(content, copy) {
  const cc = copy || {};
  const ef = content.enquiryForm || {};
  const goals = ef.goals || [];
  const trustItems = cc.trustItems || [];
  const trustHtml = trustItems.length
    ? '<ul class="prm-form-trust">'
      + trustItems.map(function(item) {
        return '<li>'
          + '<span class="prm-form-trust-icon" aria-hidden="true">' + renderIcon(item.icon || 'check') + '</span>'
          + '<span>' + esc(item.label) + '</span>'
          + '</li>';
      }).join('')
      + '</ul>'
    : (cc.formReassurance ? '<p class="prm-form-reassurance">' + esc(cc.formReassurance) + '</p>' : '');

  return '<div class="prm-contact-panel">'
    + '<h3 class="prm-h3 prm-on-dark">' + esc(cc.formTitle || 'Let\u2019s plan your website') + '</h3>'
    + trustHtml
    + (cc.formSub ? '<p class="prm-form-sub">' + esc(cc.formSub) + '</p>' : '')
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

function HeroPlatformDashboard(copy) {
  const c = copy || {};
  const widgets = c.widgets || [];
  if (!widgets.length) return '';
  return '<aside class="wc-hero-dashboard" aria-label="LeadPages platform dashboard preview">'
    + (c.eyebrow ? '<p class="wc-hero-dashboard-eyebrow">' + esc(c.eyebrow) + '</p>' : '')
    + (c.heading ? '<h2 class="wc-hero-dashboard-title prm-serif">' + esc(c.heading) + '</h2>' : '')
    + '<div class="wc-hero-dashboard-grid">'
    + widgets.map(function(widget) {
      const status = widget.status === 'live'
        ? '<span class="wc-dashboard-status wc-dashboard-status--live">Live</span>'
        : '<span class="wc-dashboard-hint">' + esc(widget.hint || 'Connected') + '</span>';
      return '<article class="wc-dashboard-widget">'
        + '<p class="wc-dashboard-label">' + esc(widget.label) + '</p>'
        + status
        + '</article>';
    }).join('')
    + '</div></aside>';
}

function HeroPlatformBenefits(copy) {
  const c = copy || {};
  const items = c.items || [];
  if (!items.length) return '';
  return '<aside class="wc-hero-benefits" aria-label="LeadPages platform benefits">'
    + (c.eyebrow ? '<p class="wc-hero-benefits-eyebrow">' + esc(c.eyebrow) + '</p>' : '')
    + (c.heading ? '<h2 class="wc-hero-benefits-title prm-serif">' + esc(c.heading) + '</h2>' : '')
    + '<ul class="wc-hero-benefit-grid">'
    + items.map(function(item) {
      return '<li class="wc-hero-benefit-card">'
        + iconRing(item.icon || 'cloud', 'prm-icon-ring--feature')
        + '<div class="wc-hero-benefit-copy">'
        + '<h3>' + esc(item.title) + '</h3>'
        + '<p>' + esc(item.body) + '</p>'
        + '</div></li>';
    }).join('')
    + '</ul></aside>';
}

function FinalCTA(content, copy) {
  const hero = content.hero || {};
  const cc = copy || {};
  const btnLabel = cc.button || hero.primaryCta || 'Plan My Website';
  return '<section class="prm-final-cta prm-final-cta--premium" id="cta">'
    + '<div class="prm-shell prm-final-cta-inner">'
    + '<div class="prm-final-cta-lead">'
    + iconRing('rocket', 'prm-icon-ring--cta')
    + '<div class="prm-final-cta-copy">'
    + '<h2 class="prm-final-cta-title prm-serif">' + esc(cc.heading || 'Ready for a website that works harder for your business?') + '</h2>'
    + '<p class="prm-final-cta-sub">' + esc(cc.sub || 'Let\u2019s build something great together.') + '</p>'
    + '</div></div>'
    + '<a class="prm-btn prm-btn-ink prm-btn--cta-lg" href="#contact">' + esc(btnLabel) + ' →</a>'
    + '</div></section>';
}

module.exports = {
  DemoBrowser,
  DemoPhone,
  HeroWebsiteShowcase,
  HeroProductEcosystem,
  HeroTrustMeta,
  HeroCustomerJourney,
  DemoTrustList,
  TransformCompare,
  ProofStats,
  HeroPlatformDashboard,
  HeroPlatformBenefits,
  LiveDemoGallery,
  IndustryTabs,
  DemoFaqPanel,
  LeadFlowDiagram,
  ServiceCard,
  Timeline,
  PartnerCard,
  PlatformDiagram,
  ReviewCard,
  ReviewSlider,
  ContactPanel,
  FinalCTA,
  icon,
  iconRing,
  demoThumbSrc,
  demoScreenHtml
};
