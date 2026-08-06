'use strict';

const { normalizeSearchCanvas } = require('./normalize');
const { deriveAccentTokens } = require('./accent');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(s) {
  return esc(s).replace(/'/g, '&#39;');
}

function paragraphsHtml(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!raw) return '';
  return raw
    .split(/\n\s*\n/)
    .map(function (p) {
      return '<p class="sc-p">' + esc(p).replace(/\n/g, '<br>\n') + '</p>';
    })
    .join('\n');
}

function destHref(dest) {
  if (!dest) return '';
  if (typeof dest === 'string') return dest;
  const type = dest.type || 'url';
  const value = String(dest.value || '').trim();
  if (!value) return '';
  if (type === 'phone' || type === 'tel') return value.indexOf('tel:') === 0 ? value : 'tel:' + value.replace(/\s+/g, '');
  if (type === 'email' || type === 'mailto') return value.indexOf('mailto:') === 0 ? value : 'mailto:' + value;
  return value;
}

/**
 * Server / SSR-friendly SearchCanvas HTML (all tabs in document).
 * @param {object} rawConfig
 * @param {{ instanceId?: string, icons?: Record<string,string> }} [opts]
 */
function renderSearchCanvasHtml(rawConfig, opts) {
  const options = opts || {};
  const cfg = normalizeSearchCanvas(rawConfig);
  if (!cfg.on && options.force !== true) {
    return '';
  }
  const uid = String(options.instanceId || 'sc')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 32) || 'sc';
  const icons = options.icons || {};
  const accent = deriveAccentTokens(cfg.style.masterColour);
  const tabs = cfg.tabs.filter(function (t) {
    return t && t.on !== false;
  });

  let defaultId = cfg.defaultTabId;
  if (tabs.length && !tabs.some(function (t) {
    return t.id === defaultId;
  })) {
    defaultId = tabs[0].id;
  }

  const preset = cfg.layout.preset || 'vertical-tabs-image-right';
  const imageMode = cfg.layout.imageMode || 'per-tab';
  const mobileMode = cfg.layout.mobileMode || 'single-accordion';
  const sharedImage = imageMode === 'shared'
    ? tabs.find(function (t) {
        return t.image && t.image.url;
      })
    : null;

  const styleVars = [];
  if (accent.accent) {
    styleVars.push('--sc-accent:' + accent.accent);
    styleVars.push('--sc-accent-soft:' + accent.accentSoft);
    styleVars.push('--sc-accent-hover:' + accent.accentHover);
    styleVars.push('--sc-accent-contrast:' + accent.accentContrast);
    styleVars.push('--sc-accent-border:' + accent.accentBorder);
  }
  const styleMap = [
    ['sectionBackground', '--sc-section-bg'],
    ['panelBackground', '--sc-panel-bg'],
    ['tabBackground', '--sc-tab-bg'],
    ['activeTabBackground', '--sc-tab-active-bg'],
    ['borderColour', '--sc-border'],
    ['headingColour', '--sc-heading'],
    ['bodyColour', '--sc-body'],
    ['mutedColour', '--sc-muted']
  ];
  styleMap.forEach(function (pair) {
    const v = cfg.style[pair[0]];
    if (v) styleVars.push(pair[1] + ':' + v);
  });
  const hc = cfg.header.colours || {};
  if (hc.eyebrow) styleVars.push('--sc-eyebrow-color:' + hc.eyebrow);
  if (hc.heading) styleVars.push('--sc-heading-color:' + hc.heading);
  if (hc.intro) styleVars.push('--sc-intro-color:' + hc.intro);

  const radiusClass = 'sc-radius-' + (cfg.style.radius || 'medium');
  const shadowClass = 'sc-shadow-' + (cfg.style.shadow || 'soft');
  const widthClass = 'sc-width-' + (cfg.layout.contentWidth || 'wide');
  const presetClass = 'sc-preset-' + preset;
  const imageClass =
    imageMode === 'none' ? 'sc-no-image' : imageMode === 'shared' ? 'sc-shared-image' : 'sc-per-tab-image';

  const headerHtml =
    '<header class="sc-header">' +
    (cfg.header.eyebrow ? '<p class="eyebrow sc-eyebrow">' + esc(cfg.header.eyebrow) + '</p>' : '') +
    (cfg.header.heading ? '<h2 class="sc-heading">' + esc(cfg.header.heading) + '</h2>' : '') +
    (cfg.header.intro ? '<p class="sc-intro">' + esc(cfg.header.intro) + '</p>' : '') +
    '</header>';

  // Header-only shell when AI / services have not created tabs yet — never invent Planning/Delivery.
  if (!tabs.length) {
    return (
      '<section class="section sc-section is-on ' +
      radiusClass +
      ' ' +
      shadowClass +
      ' ' +
      widthClass +
      ' sc-empty-tabs" data-sec="searchCanvas" id="searchCanvas" data-sc-on="1" data-sc-uid="' +
      escAttr(uid) +
      '"' +
      (styleVars.length ? ' style="' + styleVars.join(';') + '"' : '') +
      '>' +
      '<div class="wrap sc-wrap">' +
      headerHtml +
      '<div class="sc-empty" role="status"><p class="sc-empty-msg">Generate with AI to create service tabs for this business.</p></div>' +
      '</div></section>'
    );
  }

  function iconSvg(key) {
    if (!key) return '';
    const path = icons[key];
    if (!path) return '';
    return (
      '<svg class="sc-ic lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      path +
      '</svg>'
    );
  }

  function bulletTickHtml(tab) {
    const key = (tab && tab.bulletIconKey) || (cfg.style && cfg.style.bulletIconKey) || 'check';
    const svg = iconSvg(key) || iconSvg('check');
    return '<span class="sc-tick" aria-hidden="true">' + svg + '</span>';
  }

  function tabImage(tab) {
    if (imageMode === 'none') return null;
    if (imageMode === 'shared') return sharedImage && sharedImage.image;
    return tab.image && tab.image.url ? tab.image : null;
  }

  function figureHtml(tab, active) {
    const img = tabImage(tab);
    if (!img || !img.url) {
      return (
        '<figure class="sc-figure sc-figure-empty' +
        (active ? ' is-active' : '') +
        '" data-sc-figure="' +
        escAttr(tab.id) +
        '" hidden="' +
        (active ? 'false' : 'true') +
        '"' +
        (active ? '' : ' hidden') +
        '><div class="sc-figure-ph" aria-hidden="true"></div></figure>'
      );
    }
    const fit = img.fit === 'contain' ? 'contain' : 'cover';
    const pos = escAttr(img.objectPosition || 'center');
    return (
      '<figure class="sc-figure' +
      (active ? ' is-active' : '') +
      '" data-sc-figure="' +
      escAttr(tab.id) +
      '"' +
      (active ? '' : ' hidden') +
      '>' +
      '<img class="sc-img" src="' +
      escAttr(img.url) +
      '" alt="' +
      escAttr(img.alt || tab.heading || tab.label) +
      '" loading="' +
      (active ? 'eager' : 'lazy') +
      '" style="object-fit:' +
      fit +
      ';object-position:' +
      pos +
      '">' +
      '</figure>'
    );
  }

  function panelHtml(tab, active, headingTag) {
    const H = headingTag === 'h2' ? 'h2' : 'h3';
    const href = destHref(tab.link && tab.link.destination);
    const btnHref = destHref(tab.button && tab.button.destination);
    const bullets = (tab.bullets || [])
      .map(function (b) {
        return '<li>' + bulletTickHtml(tab) + '<span>' + esc(b) + '</span></li>';
      })
      .join('');
    return (
      '<article class="sc-panel' +
      (active ? ' is-active' : '') +
      '" role="tabpanel" id="' +
      uid +
      '-panel-' +
      escAttr(tab.id) +
      '" aria-labelledby="' +
      uid +
      '-tab-' +
      escAttr(tab.id) +
      '"' +
      (active ? '' : ' hidden') +
      ' data-sc-panel="' +
      escAttr(tab.id) +
      '">' +
      '<' +
      H +
      ' class="sc-tab-heading">' +
      esc(tab.heading || tab.label) +
      '</' +
      H +
      '>' +
      (tab.intro ? '<p class="sc-tab-intro">' + esc(tab.intro) + '</p>' : '') +
      '<div class="sc-tab-body">' +
      paragraphsHtml(tab.content) +
      '</div>' +
      (bullets ? '<ul class="sc-bullets">' + bullets + '</ul>' : '') +
      (tab.link && tab.link.label
        ? href
          ? '<a class="sc-text-link" href="' +
            escAttr(href) +
            '" data-sc-link="' +
            escAttr(tab.id) +
            '">' +
            esc(tab.link.label) +
            ' <span aria-hidden="true">→</span></a>'
          : '<span class="sc-text-link sc-link-disconnected" data-sc-link="' +
            escAttr(tab.id) +
            '">' +
            esc(tab.link.label) +
            '</span>'
        : '') +
      (tab.button && tab.button.enabled && tab.button.label
        ? btnHref
          ? '<a class="sc-btn" href="' +
            escAttr(btnHref) +
            '" data-sc-btn="' +
            escAttr(tab.id) +
            '">' +
            esc(tab.button.label) +
            '</a>'
          : '<span class="sc-btn sc-link-disconnected">' + esc(tab.button.label) + '</span>'
        : '') +
      '</article>'
    );
  }

  const tabButtons = tabs
    .map(function (tab, i) {
      const active = tab.id === defaultId;
      return (
        '<button type="button" class="sc-tab' +
        (active ? ' is-active' : '') +
        '" role="tab" id="' +
        uid +
        '-tab-' +
        escAttr(tab.id) +
        '" aria-selected="' +
        (active ? 'true' : 'false') +
        '" aria-controls="' +
        uid +
        '-panel-' +
        escAttr(tab.id) +
        '" tabindex="' +
        (active ? '0' : '-1') +
        '" data-sc-tab="' +
        escAttr(tab.id) +
        '">' +
        '<span class="sc-tab-ic">' +
        iconSvg(tab.iconKey) +
        '</span>' +
        '<span class="sc-tab-label">' +
        esc(tab.label) +
        '</span>' +
        '<span class="sc-tab-chev" aria-hidden="true"></span>' +
        '</button>'
      );
    })
    .join('\n');

  const desktopPanels = tabs
    .map(function (tab) {
      return panelHtml(tab, tab.id === defaultId, 'h3');
    })
    .join('\n');

  const desktopFigures = tabs
    .map(function (tab) {
      return figureHtml(tab, tab.id === defaultId);
    })
    .join('\n');

  const accordion = tabs
    .map(function (tab, i) {
      const open = tab.id === defaultId;
      const img = tabImage(tab);
      return (
        '<div class="sc-acc-item' +
        (open ? ' is-open' : '') +
        '" data-sc-acc="' +
        escAttr(tab.id) +
        '">' +
        '<h3 class="sc-acc-h">' +
        '<button type="button" class="sc-acc-btn" id="' +
        uid +
        '-acc-' +
        escAttr(tab.id) +
        '" aria-expanded="' +
        (open ? 'true' : 'false') +
        '" aria-controls="' +
        uid +
        '-acc-panel-' +
        escAttr(tab.id) +
        '" data-sc-acc-btn="' +
        escAttr(tab.id) +
        '">' +
        '<span class="sc-tab-ic">' +
        iconSvg(tab.iconKey) +
        '</span>' +
        '<span class="sc-tab-label">' +
        esc(tab.label || tab.heading) +
        '</span>' +
        '<span class="sc-tab-chev" aria-hidden="true"></span>' +
        '</button></h3>' +
        '<div class="sc-acc-panel" id="' +
        uid +
        '-acc-panel-' +
        escAttr(tab.id) +
        '" role="region" aria-labelledby="' +
        uid +
        '-acc-' +
        escAttr(tab.id) +
        '"' +
        (open ? '' : ' hidden') +
        '>' +
        (img && img.url
          ? '<figure class="sc-figure sc-acc-figure"><img class="sc-img" src="' +
            escAttr(img.url) +
            '" alt="' +
            escAttr(img.alt || tab.heading || tab.label) +
            '" loading="lazy" style="object-fit:' +
            (img.fit === 'contain' ? 'contain' : 'cover') +
            ';object-position:' +
            escAttr(img.objectPosition || 'center') +
            '"></figure>'
          : '') +
        panelHtml(tab, true, 'h3').replace(/role="tabpanel"[^>]*>/, '>') +
        '</div></div>'
      );
    })
    .join('\n');

  let ctaHtml = '';
  if (cfg.cta && cfg.cta.enabled && (cfg.cta.heading || cfg.cta.text || cfg.cta.primaryLabel)) {
    const dest = cfg.cta.primaryDestination && destHref(cfg.cta.primaryDestination)
      ? cfg.cta.primaryDestination
      : { type: 'section', value: '#quote' };
    const pHref = destHref(dest) || '#quote';
    const sHref = destHref(cfg.cta.secondaryDestination);
    const ctaAction = cfg.cta.action || (/^tel:/i.test(pHref) ? 'call' : /#quote/i.test(pHref) ? 'quote' : 'custom');
    const ctaLabel = cfg.cta.primaryLabel || (ctaAction === 'call' ? 'Call Now' : 'Get a Free Quote');
    ctaHtml =
      '<aside class="sc-cta sc-cta-' +
      escAttr(cfg.cta.style || 'strip') +
      '">' +
      (cfg.cta.iconKey ? '<div class="sc-cta-ic">' + iconSvg(cfg.cta.iconKey) + '</div>' : '') +
      '<div class="sc-cta-copy">' +
      (cfg.cta.heading ? '<p class="sc-cta-heading">' + esc(cfg.cta.heading) + '</p>' : '') +
      (cfg.cta.text ? '<p class="sc-cta-text">' + esc(cfg.cta.text) + '</p>' : '') +
      '</div>' +
      '<div class="sc-cta-actions">' +
      '<a class="sc-btn" href="' +
      escAttr(pHref) +
      '" data-sc-cta="primary" data-sc-cta-action="' +
      escAttr(ctaAction) +
      '">' +
      esc(ctaLabel) +
      '</a>' +
      (cfg.cta.secondaryLabel
        ? sHref
          ? '<a class="sc-text-link" href="' +
            escAttr(sHref) +
            '" data-sc-cta="secondary">' +
            esc(cfg.cta.secondaryLabel) +
            '</a>'
          : '<span class="sc-text-link">' + esc(cfg.cta.secondaryLabel) + '</span>'
        : '') +
      '</div></aside>';
  }

  return (
    '<section data-sec="searchCanvas" class="section sc-section ' +
    radiusClass +
    ' ' +
    shadowClass +
    ' ' +
    widthClass +
    ' ' +
    presetClass +
    ' ' +
    imageClass +
    '" id="searchCanvas" data-sc-uid="' +
    escAttr(uid) +
    '" data-sc-mobile="' +
    escAttr(mobileMode) +
    '" data-sc-default="' +
    escAttr(defaultId) +
    '"' +
    (styleVars.length ? ' style="' + escAttr(styleVars.join(';')) + '"' : '') +
    '>' +
    '<div class="wrap sc-wrap">' +
    '<header class="sc-header">' +
    (cfg.header.eyebrow
      ? '<p class="eyebrow sc-eyebrow">' + esc(cfg.header.eyebrow) + '</p>'
      : '') +
    (cfg.header.heading ? '<h2 class="sc-heading">' + esc(cfg.header.heading) + '</h2>' : '') +
    (cfg.header.intro ? '<p class="sc-intro">' + esc(cfg.header.intro) + '</p>' : '') +
    '</header>' +
    '<div class="search-canvas sc-desktop" data-sc-desktop>' +
    '<nav class="sc-tabs" role="tablist" aria-label="SearchCanvas topics">' +
    tabButtons +
    '</nav>' +
    '<div class="sc-main">' +
    '<div class="sc-panels">' +
    desktopPanels +
    '</div>' +
    '<div class="sc-media">' +
    desktopFigures +
    '</div>' +
    '</div></div>' +
    '<div class="sc-mobile" data-sc-mobile-root>' +
    accordion +
    '</div>' +
    ctaHtml +
    '</div></section>'
  );
}

module.exports = {
  renderSearchCanvasHtml,
  paragraphsHtml,
  destHref,
  esc
};
