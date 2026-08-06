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

function fourServiceTabs() {
  const labels = [
    { label: 'Planning', iconKey: 'calendar', heading: 'Planning & advice' },
    { label: 'Delivery', iconKey: 'truck', heading: 'Delivery & installation' },
    { label: 'Support', iconKey: 'users', heading: 'Ongoing support' },
    { label: 'Maintenance', iconKey: 'wrench', heading: 'Care & maintenance' }
  ];
  return labels.map(function (L) {
    return blankTab({
      label: L.label,
      iconKey: L.iconKey,
      heading: L.heading,
      intro:
        'Add clear, customer-facing detail about this topic. Keep it practical and easy to scan.',
      bullets: [
        'Clear scope of work',
        'Practical options',
        'Transparent next steps',
        'Local, responsive service'
      ],
      link: { label: 'Learn more', destination: null }
    });
  });
}

function defaultSearchCanvasConfig() {
  const tabs = fourServiceTabs();
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
    tabs: tabs,
    defaultTabId: tabs[0] ? tabs[0].id : null,
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
      contentWidth: 'site'
    },
    cta: {
      enabled: false,
      style: 'strip',
      iconKey: null,
      heading: '',
      text: '',
      primaryLabel: '',
      primaryDestination: null,
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
  defaultSearchCanvasConfig
};
