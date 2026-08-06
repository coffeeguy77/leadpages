'use strict';

function newId(prefix) {
  return String(prefix || 'tab') + '-' + Math.random().toString(36).slice(2, 9);
}

function blankTab(overrides) {
  return Object.assign(
    {
      id: newId('tab'),
      label: 'Service',
      iconKey: 'check',
      heading: 'Service heading',
      intro: 'Describe this service for visitors — clear, useful and specific.',
      content: '',
      bullets: ['What’s included', 'How it works', 'What to expect', 'Next steps'],
      image: {
        url: null,
        publicId: null,
        alt: '',
        fit: 'cover',
        objectPosition: 'center'
      },
      link: { label: '', destination: null },
      button: { enabled: false, label: '', destination: null },
      on: true
    },
    overrides || {}
  );
}

/** Legacy generic placeholders — never treat these as real AI/service content. */
var PLACEHOLDER_LABELS = {
  planning: 1,
  delivery: 1,
  support: 1,
  maintenance: 1,
  consultation: 1,
  service: 1,
  'new topic': 1,
  'service 1': 1,
  'service 2': 1,
  'service 3': 1,
  'service 4': 1,
  'service 5': 1,
  'service 6': 1
};

var PLACEHOLDER_INTRO_RE = /add clear, customer-facing detail|describe this (service|topic) for visitors|describe this topic for visitors/i;

/**
 * True when tabs are empty or still the generic Planning/Delivery seed (not real services).
 */
function isPlaceholderSearchCanvasTabs(tabs) {
  if (!Array.isArray(tabs) || !tabs.length) return true;
  var hits = 0;
  for (var i = 0; i < tabs.length; i++) {
    var t = tabs[i] || {};
    var label = String(t.label || '')
      .toLowerCase()
      .trim();
    if (PLACEHOLDER_LABELS[label] || PLACEHOLDER_INTRO_RE.test(String(t.intro || ''))) hits++;
  }
  return hits >= Math.max(1, Math.ceil(tabs.length * 0.5));
}

/**
 * Build tabs from real site service titles (e.g. Landscape Design, Retaining Walls).
 * Returns [] when no titles — caller should leave empty until AI generate.
 */
function tabsFromServiceTitles(titles) {
  var list = (Array.isArray(titles) ? titles : [])
    .map(function (s) {
      return String(s || '').trim();
    })
    .filter(Boolean)
    .slice(0, 12);
  return list.map(function (title) {
    return blankTab({
      label: title.split(/\s+/).slice(0, 4).join(' '),
      iconKey: 'check',
      heading: title,
      intro: '',
      bullets: [],
      link: { label: '', destination: null },
      _seedFromServices: true
    });
  });
}

/** @deprecated Generic demo tabs only — do not use as live AI output. */
function fourServiceTabs() {
  return tabsFromServiceTitles(['Planning', 'Delivery', 'Support', 'Maintenance']);
}

function defaultSearchCanvasConfig() {
  return {
    on: false,
    version: 1,
    header: {
      eyebrow: 'Our expertise',
      heading: 'Solutions designed around your business',
      intro:
        'Explore the services, experience and practical support our team provides — structured so visitors can find what they need quickly.',
      colours: { eyebrow: null, heading: null, intro: null }
    },
    // Empty until install seeds from site services or AI generates real service tabs.
    tabs: [],
    defaultTabId: null,
    style: {
      masterColour: null,
      sectionBackground: null,
      panelBackground: null,
      tabBackground: null,
      activeTabBackground: null,
      borderColour: null,
      headingColour: null,
      bodyColour: null,
      mutedColour: null,
      radius: 'medium',
      shadow: 'soft'
    },
    layout: {
      preset: 'vertical-tabs-image-right',
      imageMode: 'per-tab',
      mobileMode: 'single-accordion',
      contentWidth: 'wide'
    },
    cta: {
      enabled: false,
      style: 'strip',
      iconKey: null,
      heading: '',
      text: '',
      primaryLabel: 'Get a Free Quote',
      primaryDestination: { type: 'section', value: '#quote' },
      action: 'quote',
      secondaryLabel: '',
      secondaryDestination: null
    },
    ai: {
      primaryKeyword: '',
      location: '',
      source: 'manual',
      generatedAt: null,
      generationId: null
    }
  };
}

module.exports = {
  newId,
  blankTab,
  fourServiceTabs,
  tabsFromServiceTitles,
  isPlaceholderSearchCanvasTabs,
  PLACEHOLDER_LABELS,
  defaultSearchCanvasConfig
};
