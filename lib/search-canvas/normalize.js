'use strict';

const { blankTab, defaultSearchCanvasConfig, newId, isPlaceholderSearchCanvasTabs } = require('./defaults');

function hexOrNull(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return null;
  if (/^#?[0-9a-fA-F]{3}$/.test(s)) {
    const h = s[0] === '#' ? s.slice(1) : s;
    return '#' + h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (/^#?[0-9a-fA-F]{6}$/.test(s)) return s[0] === '#' ? s : '#' + s;
  return null;
}

function normalizeDestination(dest) {
  if (dest == null || dest === '') return null;
  if (typeof dest === 'string') {
    const t = dest.trim();
    if (!t) return null;
    if (t[0] === '#' || t[0] === '/') return { type: 'section', value: t };
    if (/^https?:\/\//i.test(t) || /^tel:/i.test(t) || /^mailto:/i.test(t)) {
      return { type: 'url', value: t };
    }
    return { type: 'url', value: t };
  }
  if (typeof dest === 'object') {
    const type = String(dest.type || 'url').trim() || 'url';
    const value = String(dest.value || dest.href || dest.url || '').trim();
    if (!value) return null;
    return { type: type, value: value };
  }
  return null;
}

function normalizeTab(raw, i) {
  const t = raw && typeof raw === 'object' ? raw : {};
  const bullets = Array.isArray(t.bullets)
    ? t.bullets.map(function (b) { return String(b || '').trim(); }).filter(Boolean).slice(0, 8)
    : [];
  const img = t.image && typeof t.image === 'object' ? t.image : {};
  const link = t.link && typeof t.link === 'object' ? t.link : {};
  const button = t.button && typeof t.button === 'object' ? t.button : {};
  const id = String(t.id || '').trim() || newId('tab');
  return {
    id: id,
    label: String(t.label || t.heading || 'Topic ' + (i + 1)).trim().slice(0, 48) || 'Topic',
    iconKey: t.iconKey == null || t.iconKey === '' ? null : String(t.iconKey).trim(),
    heading: String(t.heading || t.label || '').trim(),
    intro: String(t.intro || '').trim(),
    content: String(t.content || (Array.isArray(t.supportingParagraphs) ? t.supportingParagraphs.join('\n\n') : '') || '').trim(),
    bullets: bullets,
    image: {
      url: img.url ? String(img.url).trim() : null,
      publicId: img.publicId ? String(img.publicId).trim() : null,
      alt: String(img.alt || t.imageAltText || '').trim(),
      fit: img.fit === 'contain' ? 'contain' : 'cover',
      objectPosition: String(img.objectPosition || 'center').trim() || 'center'
    },
    link: {
      label: String(link.label || t.linkLabel || '').trim(),
      destination: normalizeDestination(link.destination != null ? link.destination : t.linkDestination)
    },
    button: {
      enabled: button.enabled === true,
      label: String(button.label || '').trim(),
      destination: normalizeDestination(button.destination)
    },
    on: t.on !== false,
    _imageSearchQuery: t.imageSearchQuery ? String(t.imageSearchQuery).trim() : '',
    _iconSuggestion: t.iconSuggestion ? String(t.iconSuggestion).trim() : ''
  };
}

function normalizeSearchCanvas(raw) {
  const base = defaultSearchCanvasConfig();
  const c = raw && typeof raw === 'object' ? raw : {};
  const headerIn = c.header && typeof c.header === 'object' ? c.header : {};
  const coloursIn = headerIn.colours && typeof headerIn.colours === 'object' ? headerIn.colours : {};
  const styleIn = c.style && typeof c.style === 'object' ? c.style : {};
  const layoutIn = c.layout && typeof c.layout === 'object' ? c.layout : {};
  const ctaIn = c.cta && typeof c.cta === 'object' ? c.cta : {};
  const aiIn = c.ai && typeof c.ai === 'object' ? c.ai : {};

  let tabs = Array.isArray(c.tabs) ? c.tabs.map(normalizeTab) : [];
  tabs = tabs.filter(function (t) { return t && (t.label || t.heading || t.intro); }).slice(0, 12);
  // Do NOT invent Planning/Delivery placeholders — empty stays empty until AI / services seed.

  let defaultTabId = c.defaultTabId ? String(c.defaultTabId) : null;
  if (!defaultTabId || !tabs.some(function (t) { return t.id === defaultTabId; })) {
    defaultTabId = tabs[0] ? tabs[0].id : null;
  }

  const presets = [
    'vertical-tabs-image-right',
    'vertical-tabs-image-left',
    'horizontal-tabs',
    'cards',
    'editorial-split'
  ];
  const preset = presets.indexOf(layoutIn.preset) >= 0 ? layoutIn.preset : base.layout.preset;
  const widths = ['site', 'narrow', 'wide'];
  const contentWidth = widths.indexOf(layoutIn.contentWidth) >= 0
    ? layoutIn.contentWidth
    : 'wide';

  return {
    on: c.on === true,
    version: 1,
    header: {
      eyebrow: String(headerIn.eyebrow != null ? headerIn.eyebrow : base.header.eyebrow).trim(),
      heading: String(headerIn.heading != null ? headerIn.heading : base.header.heading).trim(),
      intro: String(headerIn.intro != null ? headerIn.intro : base.header.intro).trim(),
      colours: {
        eyebrow: hexOrNull(coloursIn.eyebrow != null ? coloursIn.eyebrow : c.eyebrowColor),
        heading: hexOrNull(coloursIn.heading != null ? coloursIn.heading : c.headingColor),
        intro: hexOrNull(coloursIn.intro != null ? coloursIn.intro : c.introColor)
      }
    },
    tabs: tabs,
    defaultTabId: defaultTabId,
    style: {
      masterColour: hexOrNull(styleIn.masterColour),
      sectionBackground: hexOrNull(styleIn.sectionBackground),
      panelBackground: hexOrNull(styleIn.panelBackground),
      tabBackground: hexOrNull(styleIn.tabBackground),
      activeTabBackground: hexOrNull(styleIn.activeTabBackground),
      borderColour: hexOrNull(styleIn.borderColour),
      headingColour: hexOrNull(styleIn.headingColour),
      bodyColour: hexOrNull(styleIn.bodyColour),
      mutedColour: hexOrNull(styleIn.mutedColour),
      radius: ['none', 'small', 'medium', 'large'].indexOf(styleIn.radius) >= 0 ? styleIn.radius : 'medium',
      shadow: ['none', 'soft', 'medium'].indexOf(styleIn.shadow) >= 0 ? styleIn.shadow : 'soft'
    },
    layout: {
      preset: preset,
      imageMode: ['per-tab', 'shared', 'none'].indexOf(layoutIn.imageMode) >= 0 ? layoutIn.imageMode : 'per-tab',
      mobileMode: layoutIn.mobileMode === 'multi-accordion' ? 'multi-accordion' : 'single-accordion',
      contentWidth: contentWidth
    },
    cta: {
      enabled: ctaIn.enabled === true,
      style: ['strip', 'panel', 'simple'].indexOf(ctaIn.style) >= 0 ? ctaIn.style : 'strip',
      iconKey: ctaIn.iconKey ? String(ctaIn.iconKey).trim() : null,
      heading: String(ctaIn.heading || '').trim(),
      text: String(ctaIn.text || '').trim(),
      primaryLabel: String(ctaIn.primaryLabel || '').trim() || (ctaIn.enabled === true ? 'Get a Free Quote' : ''),
      primaryDestination: normalizeDestination(ctaIn.primaryDestination) ||
        (ctaIn.enabled === true ? { type: 'section', value: '#quote' } : null),
      action: ['quote', 'call', 'custom'].indexOf(ctaIn.action) >= 0
        ? ctaIn.action
        : (normalizeDestination(ctaIn.primaryDestination) &&
          /^tel:/i.test(String((normalizeDestination(ctaIn.primaryDestination) || {}).value || ''))
            ? 'call'
            : 'quote'),
      secondaryLabel: String(ctaIn.secondaryLabel || '').trim(),
      secondaryDestination: normalizeDestination(ctaIn.secondaryDestination)
    },
    ai: {
      primaryKeyword: String(aiIn.primaryKeyword || '').trim(),
      location: String(aiIn.location || '').trim(),
      source: aiIn.source || 'manual',
      generatedAt: aiIn.generatedAt || null,
      generationId: aiIn.generationId || null
    }
  };
}

/**
 * Merge AI draft into an existing SearchCanvas config.
 * mode: replace | preserve | fillEmpty
 */
function applyAiDraftToSearchCanvas(existing, aiDraft, opts) {
  const mode = (opts && opts.mode) || 'preserve';
  const replaceImages = !!(opts && opts.replaceImages);
  const cur = normalizeSearchCanvas(existing);
  const draft = aiDraft && typeof aiDraft === 'object' ? aiDraft : {};
  const out = JSON.parse(JSON.stringify(cur));
  out.on = true;

  function take(prev, next) {
    const n = String(next == null ? '' : next).trim();
    if (!n) return prev;
    if (mode === 'replace') return n;
    if (mode === 'fillEmpty') return String(prev || '').trim() ? prev : n;
    // preserve: only fill empty
    return String(prev || '').trim() ? prev : n;
  }

  out.header.eyebrow = take(out.header.eyebrow, draft.eyebrow);
  out.header.heading = take(out.header.heading, draft.heading);
  out.header.intro = take(out.header.intro, draft.intro);

  const aiTabs = Array.isArray(draft.tabs) ? draft.tabs : [];
  if (aiTabs.length) {
    // AI service tabs always win over empty/placeholder Planning–Delivery seeds.
    const replaceTabs =
      mode === 'replace' ||
      !out.tabs.length ||
      isPlaceholderSearchCanvasTabs(out.tabs) ||
      (opts && opts.replaceTabs === true);
    if (replaceTabs) {
      out.tabs = aiTabs.map(function (t, i) {
        const prev = out.tabs[i] || {};
        const keepImage = !replaceImages && prev.image && prev.image.url;
        return normalizeTab(
          {
            id: prev.id || newId('tab'),
            label: t.label,
            iconKey: t.iconSuggestion || t.iconKey || prev.iconKey || 'check',
            heading: t.heading || t.label,
            intro: t.intro,
            content: Array.isArray(t.supportingParagraphs) ? t.supportingParagraphs.join('\n\n') : t.content,
            bullets: t.bullets,
            image: keepImage
              ? prev.image
              : {
                  url: (prev.image && prev.image.url) || null,
                  publicId: null,
                  alt: t.imageAltText || '',
                  fit: 'cover',
                  objectPosition: 'center'
                },
            link: {
              label: t.linkLabel || '',
              destination: (prev.link && prev.link.destination) || null
            },
            imageSearchQuery: t.imageSearchQuery,
            iconSuggestion: t.iconSuggestion
          },
          i
        );
      }).slice(0, 12);
    } else {
      // preserve / fillEmpty — update empty text fields tab-by-tab
      aiTabs.slice(0, 12).forEach(function (t, i) {
        if (!out.tabs[i]) {
          out.tabs[i] = normalizeTab(t, i);
          return;
        }
        const curT = out.tabs[i];
        curT.label = take(curT.label, t.label);
        curT.heading = take(curT.heading, t.heading || t.label);
        curT.intro = take(curT.intro, t.intro);
        const paras = Array.isArray(t.supportingParagraphs) ? t.supportingParagraphs.join('\n\n') : t.content;
        curT.content = take(curT.content, paras);
        if ((!curT.bullets || !curT.bullets.length) && Array.isArray(t.bullets) && t.bullets.length) {
          curT.bullets = t.bullets.map(String).filter(Boolean).slice(0, 8);
        }
        if (!curT.iconKey && (t.iconSuggestion || t.iconKey)) curT.iconKey = String(t.iconSuggestion || t.iconKey);
        if ((!curT.link || !curT.link.label) && t.linkLabel) {
          curT.link = curT.link || { label: '', destination: null };
          curT.link.label = String(t.linkLabel);
        }
        if (replaceImages || !(curT.image && curT.image.url)) {
          if (t.imageAltText) {
            curT.image = curT.image || blankTab().image;
            curT.image.alt = String(t.imageAltText);
          }
        }
        curT._imageSearchQuery = t.imageSearchQuery || curT._imageSearchQuery || '';
      });
    }
  }

  if (draft.cta && typeof draft.cta === 'object') {
    if (mode === 'replace' || !out.cta.enabled) {
      out.cta.enabled = true;
      out.cta.heading = take(out.cta.heading, draft.cta.heading);
      out.cta.text = take(out.cta.text, draft.cta.text);
      out.cta.primaryLabel = take(out.cta.primaryLabel, draft.cta.buttonLabel || draft.cta.primaryLabel);
    } else {
      out.cta.heading = take(out.cta.heading, draft.cta.heading);
      out.cta.text = take(out.cta.text, draft.cta.text);
      out.cta.primaryLabel = take(out.cta.primaryLabel, draft.cta.buttonLabel || draft.cta.primaryLabel);
      if (out.cta.heading || out.cta.text || out.cta.primaryLabel) out.cta.enabled = true;
    }
  }

  out.defaultTabId = out.tabs[0] ? out.tabs[0].id : null;
  out.ai = Object.assign({}, out.ai, {
    primaryKeyword: draft.primaryKeyword || out.ai.primaryKeyword || '',
    location: draft.location || out.ai.location || '',
    source: (opts && opts.source) || 'seo-command',
    generatedAt: new Date().toISOString(),
    generationId: (opts && opts.generationId) || out.ai.generationId || null
  });

  return normalizeSearchCanvas(out);
}

/**
 * Place / repair SearchCanvas after How It Works (serviceProcess), else Services.
 * Relocates when it was incorrectly inserted under Hero on first enable.
 * @param {string[]} sectionOrder
 * @param {string[]} [layoutSections]
 * @param {{ force?: boolean }} [opts] force=true always re-pins after How It Works/Services
 */
function ensureSearchCanvasInOrder(sectionOrder, layoutSections, opts) {
  const force = !!(opts && opts.force);
  let ord = Array.isArray(sectionOrder) ? sectionOrder.slice() : [];
  const after = ['serviceProcess', 'services', 'hero', 'heroSlider', 'splitHero'];
  const sci = ord.indexOf('searchCanvas');
  const spi = ord.indexOf('serviceProcess');
  const si = ord.indexOf('services');
  const targetKey = spi >= 0 ? 'serviceProcess' : si >= 0 ? 'services' : null;
  const targetIx = targetKey ? ord.indexOf(targetKey) : -1;

  // Already correctly placed right after How It Works / Services.
  if (sci >= 0 && targetIx >= 0 && sci === targetIx + 1 && !force) return ord;

  // Misplaced too early (e.g. Hero → SearchCanvas → … → How It Works) — repair.
  const misplacedEarly = sci >= 0 && targetIx >= 0 && sci < targetIx;
  if (sci >= 0 && (force || misplacedEarly)) {
    ord.splice(sci, 1);
  } else if (sci >= 0) {
    return ord;
  }

  const insertAfter = ['serviceProcess', 'services', 'hero', 'heroSlider', 'splitHero'];
  for (let i = 0; i < insertAfter.length; i++) {
    const ix = ord.indexOf(insertAfter[i]);
    if (ix >= 0) {
      ord.splice(ix + 1, 0, 'searchCanvas');
      return ord;
    }
  }
  const fi = ord.indexOf('faq');
  if (fi >= 0) {
    ord.splice(fi, 0, 'searchCanvas');
    return ord;
  }
  if (Array.isArray(layoutSections) && !ord.length) {
    const base = layoutSections.slice();
    for (let j = 0; j < after.length; j++) {
      const bx = base.indexOf(after[j]);
      if (bx >= 0) {
        base.splice(bx + 1, 0, 'searchCanvas');
        return base;
      }
    }
  }
  ord.push('searchCanvas');
  return ord;
}

module.exports = {
  hexOrNull,
  normalizeDestination,
  normalizeTab,
  normalizeSearchCanvas,
  applyAiDraftToSearchCanvas,
  ensureSearchCanvasInOrder,
  isPlaceholderSearchCanvasTabs
};
