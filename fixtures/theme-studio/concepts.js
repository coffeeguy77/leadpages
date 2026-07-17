'use strict';

const briefs = require('./briefs');
const { PROTECTED_FIELDS } = require('../../lib/theme-studio/constants');

const PRESERVED = Object.freeze([
  'custom_domain',
  'owner_email',
  'owner_user_id',
  'referring_partner_id',
  'analytics',
  'gtmId',
  'gaId',
  'facebookPixel',
  'googleAds',
  'tracking',
  'crm',
  'leadRouting',
  'formDestinations',
  'billing',
  'permissions',
  'auth',
  'publishing',
  'status'
]);

function baseConcept(partial) {
  return {
    schemaVersion: 1,
    rationale: partial.rationale || 'Static fixture concept for Theme Studio Phases 1–2.',
    sourceTemplateId: 'trade',
    sourceAppIds: partial.sourceAppIds || [],
    typography: partial.typography || {
      fontDisplay: 'Playfair Display',
      fontUi: 'DM Sans'
    },
    globalStyles: {
      buttonTreatment: 'solid',
      cardTreatment: 'flat',
      motionDirection: 'subtle',
      density: 'balanced',
      colorMode: 'light'
    },
    header: {
      headerStyle: 'solid-sticky',
      ctaLabel: (partial.callsToAction && partial.callsToAction.primary && partial.callsToAction.primary.label) || 'Contact'
    },
    navigation: {
      items: [
        { label: 'Services', target: '#services' },
        { label: 'Contact', target: '#quote' }
      ]
    },
    pages: [],
    sectionVariants: {},
    content: {},
    footer: { blurb: partial.footerBlurb || '' },
    mobileRules: {
      notes: ['Stack imagery above copy on small screens'],
      stickyCta: true,
      stackOrder: 'content-first'
    },
    accessibilityNotes: ['Ensure colour contrast on CTAs'],
    preservedFields: [...PRESERVED],
    generatedFields: ['theme', 'sections', 'services', 'layout', 'sectionOrder', 'name', 'trade'],
    placeholderFields: [],
    validationStatus: 'pending',
    warnings: [],
    provenance: {
      generatedBy: 'fixture',
      fixtureId: partial.fixtureId,
      createdAt: '2026-07-17T00:00:00.000Z',
      brainTasks: []
    },
    ...partial
  };
}

const PINK_DIAMOND_VAULT_CONCEPT = Object.freeze(
  baseConcept({
    fixtureId: briefs.PINK_DIAMOND_VAULT.fixtureId,
    conceptId: 'concept_pink_diamond_vault_v1',
    conceptName: 'Editorial Vault',
    rationale:
      'Luxury jewellery presentation for Pink Diamond Vault in Canberra — appointment-led, editorial and feminine.',
    foundationId: 'retail-boutique',
    sourceAppIds: ['featuredProjects', 'instaGallery', 'onlineQuote', 'trustBar'],
    businessProfile: { ...briefs.PINK_DIAMOND_VAULT },
    theme: {
      pipe: '#2A1020',
      hivis: '#C4A1A8',
      steel: '#5C3A4A',
      safety: '#F2E6EA',
      lightBg: '#FBF7F8',
      presetName: 'Vault Rose'
    },
    typography: { fontDisplay: 'Playfair Display', fontUi: 'DM Sans' },
    layoutId: 'premium-showcase',
    sectionOrder: [
      'hero',
      'featuredProjects',
      'services',
      'why',
      'reviews',
      'specialOffer',
      'quote',
      'faq',
      'footer'
    ],
    sections: {
      hero: {
        on: true,
        variant: 'hero',
        content: {
          heading: 'Pink diamonds, set for forever',
          subheading:
            'Private appointments in Canberra for engagement rings and rare pink diamonds.',
          cta: 'Book a private viewing'
        }
      },
      featuredProjects: {
        on: true,
        content: {
          heading: 'Selected pieces',
          intro: 'An editorial edit of engagement rings and high jewellery.'
        }
      },
      services: {
        on: true,
        content: {
          heading: 'Atelier services',
          intro: 'From first sketch to setting day.'
        },
        items: [
          {
            title: 'Pink diamond sourcing',
            text: 'Carefully sourced pink diamonds with transparent provenance.'
          },
          {
            title: 'Engagement ring design',
            text: 'Bespoke settings tailored to your stone and style.'
          },
          {
            title: 'Private vault viewings',
            text: 'Quiet appointments for collectors and couples.'
          }
        ]
      },
      why: {
        on: true,
        content: {
          heading: 'Why collectors choose the Vault',
          intro: 'Discreet guidance, exacting craft and modern elegance.'
        }
      },
      reviews: {
        on: true,
        content: {
          heading: 'Client notes',
          intro: 'Words from couples and collectors.'
        }
      },
      specialOffer: {
        on: true,
        content: {
          heading: 'Complimentary design consultation',
          text: 'Begin with a private styling session in Canberra.'
        }
      },
      quote: {
        on: true,
        content: {
          heading: 'Request an appointment',
          buttonText: 'Book a private viewing'
        }
      },
      faq: {
        on: true,
        content: {
          heading: 'Jewellery FAQs'
        }
      },
      footer: {
        on: true,
        content: {
          blurb: 'Pink Diamond Vault — Canberra'
        }
      }
    },
    services: [
      {
        title: 'Pink diamond sourcing',
        text: 'Carefully sourced pink diamonds with transparent provenance.'
      },
      {
        title: 'Engagement ring design',
        text: 'Bespoke settings tailored to your stone and style.'
      },
      {
        title: 'Private vault viewings',
        text: 'Quiet appointments for collectors and couples.'
      }
    ],
    callsToAction: {
      primary: { label: 'Book a private viewing', action: 'quote' },
      secondary: { label: 'View the edit', action: 'featuredProjects' }
    },
    imagery: [
      {
        sectionKey: 'hero',
        subject: 'Soft-lit pink diamond ring on blush silk',
        composition: 'editorial close-up',
        altDirection: 'Luxury jewellery, no trade tools'
      }
    ],
    footerBlurb: 'Pink Diamond Vault — Canberra'
  })
);

/** Intentionally invalid — trade leakage for jewellery industry. */
const PINK_DIAMOND_VAULT_LEAKY = Object.freeze({
  ...PINK_DIAMOND_VAULT_CONCEPT,
  conceptId: 'concept_pink_diamond_vault_leaky',
  sections: {
    ...PINK_DIAMOND_VAULT_CONCEPT.sections,
    hero: {
      on: true,
      variant: 'hero',
      content: {
        heading: 'Blocked drain? Call us for emergency call-outs',
        subheading: 'Hi-vis crew for plumbing and hedge trimming across Canberra suburbs.',
        cta: 'Request security patrol'
      }
    }
  }
});

const LUKES_SECURITY_CONCEPT = Object.freeze(
  baseConcept({
    fixtureId: briefs.LUKES_SECURITY_CO.fixtureId,
    conceptId: 'concept_lukes_security_v1',
    conceptName: 'Bold Trust',
    rationale:
      "Professional, high-contrast trade concept for Luke's Security Co — call-first trust.",
    foundationId: 'trade-field-services',
    sourceAppIds: ['trustBar', 'jobsFeed', 'onlineQuote', 'emergencyAvailability'],
    businessProfile: { ...briefs.LUKES_SECURITY_CO },
    theme: {
      pipe: '#0B1F33',
      hivis: '#F5B700',
      steel: '#1F3A54',
      safety: '#E8EEF4',
      lightBg: '#F7F9FB',
      presetName: 'Security Bold'
    },
    typography: { fontDisplay: 'Fraunces', fontUi: 'DM Sans' },
    layoutId: 'classic',
    sectionOrder: [
      'emerg',
      'hero',
      'trustBar',
      'services',
      'serviceProcess',
      'why',
      'reviews',
      'area',
      'quote',
      'faq',
      'footer'
    ],
    sections: {
      emerg: {
        on: true,
        content: { text: 'Canberra security & property maintenance — call now' }
      },
      hero: {
        on: true,
        variant: 'hero',
        content: {
          heading: 'Security and property care you can trust',
          subheading: "Luke's Security Co — professional crews across Canberra.",
          cta: 'Get a free quote'
        }
      },
      trustBar: { on: true, content: { heading: 'Licensed · Insured · Local' } },
      services: {
        on: true,
        content: { heading: 'Security & maintenance services' },
        items: [
          { title: 'Security patrols', text: 'Scheduled and responsive property patrols.' },
          { title: 'Access control', text: 'Locks, alarms and entry upgrades.' },
          {
            title: 'Property maintenance',
            text: 'Practical upkeep that keeps sites safe and presentable.'
          }
        ]
      },
      serviceProcess: {
        on: true,
        content: { heading: 'How we work' }
      },
      why: {
        on: true,
        content: { heading: 'Why Canberra chooses Luke' }
      },
      reviews: { on: true, content: { heading: 'Client reviews' } },
      area: { on: true, content: { heading: 'Service areas' } },
      quote: {
        on: true,
        content: { heading: 'Request a quote', buttonText: 'Get a free quote' }
      },
      faq: { on: true, content: { heading: 'FAQs' } },
      footer: { on: true, content: { blurb: "Luke's Security Co" } }
    },
    services: [
      { title: 'Security patrols', text: 'Scheduled and responsive property patrols.' },
      { title: 'Access control', text: 'Locks, alarms and entry upgrades.' },
      {
        title: 'Property maintenance',
        text: 'Practical upkeep that keeps sites safe and presentable.'
      }
    ],
    callsToAction: {
      primary: { label: 'Get a free quote', action: 'quote' },
      secondary: { label: 'Call now', action: 'phone' }
    },
    imagery: [
      {
        sectionKey: 'hero',
        subject: 'Professional security technician on site',
        composition: 'high contrast documentary',
        altDirection: 'Trade-appropriate; no jewellery styling'
      }
    ]
  })
);

const RIVERSONG_CAFE_CONCEPT = Object.freeze(
  baseConcept({
    fixtureId: briefs.RIVERSONG_CAFE.fixtureId,
    conceptId: 'concept_riversong_cafe_v1',
    conceptName: 'Warm Cup',
    foundationId: 'hospitality-cafe',
    sourceAppIds: ['featuredProjects', 'instaGallery', 'onlineQuote'],
    businessProfile: { ...briefs.RIVERSONG_CAFE },
    theme: {
      pipe: '#3B2F2F',
      hivis: '#C27A4A',
      steel: '#6B4F4F',
      safety: '#F3E7D3',
      lightBg: '#FFF9F2',
      presetName: 'Cafe Warm'
    },
    typography: { fontDisplay: 'Lora', fontUi: 'Work Sans' },
    layoutId: 'photo-proof',
    sectionOrder: [
      'hero',
      'featuredProjects',
      'services',
      'why',
      'reviews',
      'specialOffer',
      'quote',
      'footer'
    ],
    sections: {
      hero: {
        on: true,
        variant: 'hero',
        content: {
          heading: 'Coffee, brunch and river light',
          subheading: 'Specialty coffee and seasonal plates in Hobart.',
          cta: 'Plan your visit'
        }
      },
      featuredProjects: {
        on: true,
        content: { heading: 'From the kitchen', intro: 'Seasonal plates and pastry.' }
      },
      services: {
        on: true,
        content: { heading: 'What we serve' },
        items: [
          { title: 'Specialty coffee', text: 'Single-origin espresso and filter.' },
          { title: 'Weekend brunch', text: 'Seasonal plates made to share.' },
          { title: 'Takeaway', text: 'Beans and pastries for the week.' }
        ]
      },
      why: { on: true, content: { heading: 'Why locals linger' } },
      reviews: { on: true, content: { heading: 'Kind words' } },
      specialOffer: {
        on: true,
        content: { heading: 'Weekday coffee flight', text: 'Taste three seasonal pours.' }
      },
      quote: {
        on: true,
        content: { heading: 'Book a table', buttonText: 'Plan your visit' }
      },
      footer: { on: true, content: { blurb: 'Riversong Café — Hobart' } }
    },
    services: [
      { title: 'Specialty coffee', text: 'Single-origin espresso and filter.' },
      { title: 'Weekend brunch', text: 'Seasonal plates made to share.' },
      { title: 'Takeaway', text: 'Beans and pastries for the week.' }
    ],
    callsToAction: {
      primary: { label: 'Plan your visit', action: 'quote' }
    }
  })
);

const NORTHSIDE_ADVISORY_CONCEPT = Object.freeze(
  baseConcept({
    fixtureId: briefs.NORTHSIDE_ADVISORY.fixtureId,
    conceptId: 'concept_northside_advisory_v1',
    conceptName: 'Quiet Authority',
    foundationId: 'professional-services',
    sourceAppIds: ['trustBar', 'onlineQuote', 'featuredProjects'],
    businessProfile: { ...briefs.NORTHSIDE_ADVISORY },
    theme: {
      pipe: '#1C2430',
      hivis: '#3D6B8C',
      steel: '#334155',
      safety: '#E8EEF4',
      lightBg: '#F8FAFC',
      presetName: 'Advisory Calm'
    },
    typography: { fontDisplay: 'Playfair Display', fontUi: 'Inter' },
    layoutId: 'authority-builder',
    sectionOrder: [
      'hero',
      'trustBar',
      'services',
      'why',
      'crew',
      'reviews',
      'quote',
      'faq',
      'footer'
    ],
    sections: {
      hero: {
        on: true,
        variant: 'hero',
        content: {
          heading: 'Clear advice for growing businesses',
          subheading: 'Tax, compliance and advisory for Melbourne SMEs.',
          cta: 'Book a consultation'
        }
      },
      trustBar: { on: true, content: { heading: 'CPA · Registered agents' } },
      services: {
        on: true,
        content: { heading: 'Advisory services' },
        items: [
          { title: 'Business tax', text: 'Planning and lodgement with clarity.' },
          { title: 'Bookkeeping oversight', text: 'Clean numbers, calm decisions.' },
          { title: 'Growth advisory', text: 'Structure and forecasting support.' }
        ]
      },
      why: { on: true, content: { heading: 'Why Northside' } },
      crew: { on: true, content: { heading: 'Your advisory team' } },
      reviews: { on: true, content: { heading: 'Client feedback' } },
      quote: {
        on: true,
        content: { heading: 'Book a consultation', buttonText: 'Book a consultation' }
      },
      faq: { on: true, content: { heading: 'FAQs' } },
      footer: { on: true, content: { blurb: 'Northside Advisory' } }
    },
    services: [
      { title: 'Business tax', text: 'Planning and lodgement with clarity.' },
      { title: 'Bookkeeping oversight', text: 'Clean numbers, calm decisions.' },
      { title: 'Growth advisory', text: 'Structure and forecasting support.' }
    ],
    callsToAction: {
      primary: { label: 'Book a consultation', action: 'quote' }
    }
  })
);

const CANBERRA_EVENT_HIRE_CONCEPT = Object.freeze(
  baseConcept({
    fixtureId: briefs.CANBERRA_EVENT_HIRE.fixtureId,
    conceptId: 'concept_canberra_event_hire_v1',
    conceptName: 'Celebration Catalogue',
    foundationId: 'events-hire',
    sourceAppIds: ['featuredProjects', 'onlineQuote', 'projectFeed', 'estimateBuilder'],
    businessProfile: { ...briefs.CANBERRA_EVENT_HIRE },
    theme: {
      pipe: '#241A2E',
      hivis: '#D4A017',
      steel: '#4A3560',
      safety: '#F4EFE6',
      lightBg: '#FFFDF8',
      presetName: 'Event Gold'
    },
    typography: { fontDisplay: 'Poppins', fontUi: 'DM Sans' },
    layoutId: 'offer-funnel',
    sectionOrder: [
      'hero',
      'services',
      'featuredProjects',
      'why',
      'specialOffer',
      'reviews',
      'quote',
      'faq',
      'footer'
    ],
    sections: {
      hero: {
        on: true,
        variant: 'hero',
        content: {
          heading: 'Marquees and hire for unforgettable events',
          subheading: 'Capital Marquee Hire — Canberra weddings and corporate events.',
          cta: 'Check availability'
        }
      },
      services: {
        on: true,
        content: { heading: 'Hire catalogue' },
        items: [
          { title: 'Marquee packages', text: 'Elegant structures sized for your guest list.' },
          { title: 'Furniture hire', text: 'Tables, seating and styling pieces.' },
          { title: 'Event equipment', text: 'Lighting, flooring and essentials.' }
        ]
      },
      featuredProjects: {
        on: true,
        content: { heading: 'Recent events', intro: 'Weddings and brand gatherings we have dressed.' }
      },
      why: { on: true, content: { heading: 'Why planners book Capital' } },
      specialOffer: {
        on: true,
        content: { heading: 'Midweek hire rate', text: 'Ask about weekday availability packages.' }
      },
      reviews: { on: true, content: { heading: 'Planner reviews' } },
      quote: {
        on: true,
        content: { heading: 'Request availability', buttonText: 'Check availability' }
      },
      faq: { on: true, content: { heading: 'Hire FAQs' } },
      footer: { on: true, content: { blurb: 'Capital Marquee Hire' } }
    },
    services: [
      { title: 'Marquee packages', text: 'Elegant structures sized for your guest list.' },
      { title: 'Furniture hire', text: 'Tables, seating and styling pieces.' },
      { title: 'Event equipment', text: 'Lighting, flooring and essentials.' }
    ],
    callsToAction: {
      primary: { label: 'Check availability', action: 'quote' }
    }
  })
);

module.exports = {
  PRESERVED,
  PROTECTED_FIELDS,
  PINK_DIAMOND_VAULT_CONCEPT,
  PINK_DIAMOND_VAULT_LEAKY,
  LUKES_SECURITY_CONCEPT,
  RIVERSONG_CAFE_CONCEPT,
  NORTHSIDE_ADVISORY_CONCEPT,
  CANBERRA_EVENT_HIRE_CONCEPT
};
