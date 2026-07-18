'use strict';

const { PROVENANCE } = require('./constants');

/**
 * Deterministic, industry-aware content generation.
 * Every section field is owned — no inherited trade defaults.
 */

function primaryCta(brief, recipe) {
  const action = (recipe && recipe.ctas && recipe.ctas.primaryAction) || '';
  const map = {
    'call-quote': 'Call for a quote',
    'book-consult': 'Book a consultation',
    'book-event': 'Book your event',
    'plan-visit': 'Plan your visit',
    reserve: 'Reserve a table',
    'order-wholesale': 'Enquire about wholesale',
    'private-appointment': 'Book a private appointment',
    'book-appointment': 'Book an appointment',
    'check-date': 'Check your date',
    'check-availability': 'Check availability',
    'request-quote': 'Request a project quote',
    'get-in-touch': 'Get in touch'
  };
  if (map[action]) return map[action];
  const goal = String(brief.conversionGoal || '').toLowerCase();
  if (goal.includes('appoint')) return 'Book an appointment';
  if (goal.includes('call')) return 'Call now';
  if (goal.includes('visit')) return 'Plan your visit';
  return 'Get in touch';
}

function buildServices(brief, profile, recipe) {
  const loc = brief.location || 'your area';
  const spec = brief.specialisation || profile.specialisation || brief.industry;
  const shape = (recipe.contentHints && recipe.contentHints.serviceShape) || 'services';
  const name = brief.businessName;

  const catalogs = {
    'event-packages': [
      {
        title: 'Wedding & private events',
        text: 'Specialty coffee service styled for ceremonies and celebrations in ' + loc + '.'
      },
      {
        title: 'Corporate activations',
        text: 'Branded barista bars for launches, markets and campus events.'
      },
      {
        title: 'Festival & market carts',
        text: 'Reliable mobile setups with crowd-ready service.'
      }
    ],
    'menu-highlights': [
      { title: 'Specialty coffee', text: spec + ' prepared carefully in ' + loc + '.' },
      { title: 'Seasonal plates', text: 'Brunch and daily favourites locals return for.' },
      { title: 'Takeaway', text: 'Quality to go when you cannot stay.' }
    ],
    collections: [
      {
        title: 'Signature collection',
        text: 'Curated ' + spec + ' with private viewings in ' + loc + '.'
      },
      {
        title: 'Bespoke design',
        text: 'Made-to-order pieces guided by your taste and stone.'
      },
      {
        title: 'Private appointments',
        text: 'Quiet consultations for collectors and couples.'
      }
    ],
    'trade-services': [
      {
        title: 'Licensed ' + (brief.industry || 'trade') + ' work',
        text: spec + ' delivered by a professional local team in ' + loc + '.'
      },
      {
        title: 'Clear quotes',
        text: 'Upfront pricing and tidy workmanship before work starts.'
      },
      {
        title: 'Reliable follow-through',
        text: 'Communication from first call to job complete.'
      }
    ],
    'practice-areas': [
      {
        title: 'Commercial advice',
        text: spec + ' for businesses operating in ' + loc + '.'
      },
      {
        title: 'Contracts & negotiations',
        text: 'Practical guidance that protects your position without the jargon.'
      },
      {
        title: 'Ongoing counsel',
        text: 'A steady legal partner as your matters evolve.'
      }
    ],
    'salon-menu': [
      {
        title: 'Cut & finish',
        text: 'Precision cutting and styling tailored to your hair and lifestyle.'
      },
      {
        title: 'Colour services',
        text: 'Balayage, foils and colour correction with careful consultation.'
      },
      {
        title: 'Event styling',
        text: 'Blowouts and occasion hair for weddings and celebrations in ' + loc + '.'
      }
    ],
    packages: [
      {
        title: 'Wedding day coverage',
        text: 'Full-day photography focused on genuine moments and detail.'
      },
      {
        title: 'Engagement sessions',
        text: 'Relaxed portraits that help you settle in front of the lens.'
      },
      {
        title: 'Album & heirloom prints',
        text: 'Curated galleries and print options you will keep.'
      }
    ],
    advisory: [
      {
        title: 'Core advisory',
        text: spec + ' for growing businesses in ' + loc + '.'
      },
      {
        title: 'Clarity sessions',
        text: 'Practical guidance without jargon.'
      },
      {
        title: 'Ongoing support',
        text: 'A steady partner through each reporting cycle.'
      }
    ],
    'hire-packages': [
      { title: 'Hire packages', text: spec + ' sized for your guest list.' },
      { title: 'Styling pieces', text: 'Furniture and finishing touches that photograph well.' },
      { title: 'Delivery & setup', text: 'Reliable logistics across ' + loc + '.' }
    ],
    treatments: [
      { title: 'Assessment', text: 'A clear first appointment to understand your goals.' },
      { title: 'Care plans', text: 'Treatment pathways matched to your needs.' },
      { title: 'Follow-up', text: 'Support that continues after your visit.' }
    ],
    'build-services': [
      { title: 'Design & build', text: spec + ' from brief through handover.' },
      { title: 'Renovations', text: 'Structured stages with clear communication.' },
      { title: 'Project quotes', text: 'Transparent scoping for work in ' + loc + '.' }
    ],
    services: [
      {
        title: 'Featured service',
        text: spec + ' tailored for ' + (brief.audience || 'your clients') + '.'
      },
      {
        title: 'Guided experience',
        text: 'A clear path from first enquiry to outcome with ' + name + '.'
      },
      {
        title: 'Local presence',
        text: 'Based in ' + loc + '.'
      }
    ]
  };

  return catalogs[shape] || catalogs.services;
}

function imageBriefsFor(brief, profile, recipe) {
  const name = brief.businessName;
  const loc = brief.location || '';
  const pid = profile.profileId;
  const map = {
    'coffee-event': {
      heroImage: 'Corporate coffee cart at outdoor event',
      galleryImage1: 'Wedding coffee service',
      galleryImage2: 'Barista pouring latte art at a branded event cart',
      teamImage: 'Friendly barista team at a festival coffee setup'
    },
    cafe: {
      heroImage: 'Warm café interior with specialty coffee bar',
      galleryImage1: 'Latte art on a wooden café counter',
      galleryImage2: 'Seasonal brunch plate by a sunny window'
    },
    jewellery: {
      heroImage: 'Soft-lit jewellery display with pink diamond ring',
      galleryImage1: 'Close-up of an engagement ring on linen',
      galleryImage2: 'Private consultation table in a boutique showroom'
    },
    electrician: {
      heroImage: 'Licensed electrician working safely on a switchboard',
      galleryImage1: 'Clean residential electrical install',
      galleryImage2: 'Service van arriving at a suburban home'
    },
    'commercial-lawyer': {
      heroImage: 'Modern law office meeting room with city light',
      galleryImage1: 'Solicitor reviewing commercial contracts',
      galleryImage2: 'Calm reception area of a professional legal practice'
    },
    'hair-salon': {
      heroImage: 'Bright hair salon styling station with mirrors',
      galleryImage1: 'Stylist finishing a blowout',
      galleryImage2: 'Salon colour consultation with hair colour swatches'
    },
    'wedding-photographer': {
      heroImage: 'Couple photographed at golden-hour wedding reception',
      galleryImage1: 'Detail shot of wedding rings and florals',
      galleryImage2: 'Documentary wedding dance floor moment'
    }
  };

  if (map[pid]) return map[pid];
  return {
    heroImage: name + (loc ? ' in ' + loc : '') + ' — on-brand hero photography',
    galleryImage1: 'Brand photography for ' + (brief.industry || 'the business')
  };
}

function faqItems(brief, profile) {
  const name = brief.businessName;
  const loc = brief.location || 'the local area';
  const pid = profile.profileId;
  if (pid === 'jewellery') {
    return [
      {
        q: 'Do you offer private appointments?',
        a: 'Yes — ' + name + ' books private viewings so you can browse without rush.'
      },
      {
        q: 'Can you create a bespoke engagement ring?',
        a: 'We design made-to-order settings guided by your stone, taste and budget.'
      }
    ];
  }
  if (pid === 'coffee-event' || pid === 'cafe') {
    return [
      {
        q: 'Do you travel for events?',
        a: name + ' can service events across ' + loc + ' subject to availability.'
      },
      {
        q: 'What packages do you offer?',
        a: 'We tailor coffee service packages to guest count, duration and styling needs.'
      }
    ];
  }
  if (pid === 'electrician') {
    return [
      {
        q: 'Are you licensed?',
        a: name + ' provides licensed electrical work across ' + loc + '.'
      },
      {
        q: 'Do you provide written quotes?',
        a: 'Yes — we quote clearly before work begins whenever the job scope allows.'
      }
    ];
  }
  if (pid === 'commercial-lawyer') {
    return [
      {
        q: 'What matters do you handle?',
        a: name + ' focuses on commercial legal matters for businesses and founders.'
      },
      {
        q: 'How do consultations work?',
        a: 'Book a consultation and we will clarify scope, next steps and fees upfront.'
      }
    ];
  }
  if (pid === 'hair-salon') {
    return [
      {
        q: 'How do I book?',
        a: 'Use the booking form or call ' + name + ' to reserve your appointment.'
      },
      {
        q: 'Do you offer colour consultations?',
        a: 'Yes — every colour service starts with a consultation to match your goals.'
      }
    ];
  }
  if (pid === 'wedding-photographer') {
    return [
      {
        q: 'Do you travel for weddings?',
        a: name + ' covers weddings in ' + loc + ' and selected destinations.'
      },
      {
        q: 'How soon should we enquire?',
        a: 'Popular dates book out — check your date early to confirm availability.'
      }
    ];
  }
  return [
    {
      q: 'How do we get started?',
      a: 'Share a short brief with ' + name + ' and we will outline the next clear step.'
    },
    {
      q: 'Where are you based?',
      a: name + ' serves clients in ' + loc + '.'
    }
  ];
}

function reviewItems(brief, profile) {
  const loc = brief.location || 'town';
  const samples = {
    jewellery: [
      {
        name: 'Amelia',
        text: 'A calm private appointment — the ring design process felt considered and personal.'
      },
      {
        name: 'James',
        text: 'Beautiful stones and honest guidance. Worth every visit to ' + loc + '.'
      }
    ],
    'coffee-event': [
      {
        name: 'Priya',
        text: 'Our wedding guests still talk about the coffee cart — seamless and stylish.'
      },
      {
        name: 'Tom',
        text: 'Professional setup for our product launch. The barista team was excellent.'
      }
    ],
    electrician: [
      {
        name: 'Sarah',
        text: 'Clear quote, tidy work, and they explained everything. Highly recommend in ' + loc + '.'
      },
      {
        name: 'Mark',
        text: 'Arrived on time and left the switchboard safer than they found it.'
      }
    ],
    'commercial-lawyer': [
      {
        name: 'Elena',
        text: 'Sharp commercial advice without the fog. Contracts finally make sense.'
      },
      {
        name: 'Daniel',
        text: 'Responsive, practical, and protective of our position in negotiations.'
      }
    ],
    'hair-salon': [
      {
        name: 'Chloe',
        text: 'Best colour consultation I have had — left feeling polished and looked after.'
      },
      {
        name: 'Mia',
        text: 'Beautiful cut and finish. The salon atmosphere in ' + loc + ' is lovely.'
      }
    ],
    'wedding-photographer': [
      {
        name: 'Hannah',
        text: 'They caught the quiet moments we would have missed. The gallery still makes us cry (happy tears).'
      },
      {
        name: 'Oliver',
        text: 'Relaxed direction, stunning light, and a timeline that never felt rushed.'
      }
    ]
  };
  return (
    samples[profile.profileId] || [
      {
        name: 'Alex',
        text: 'Professional, clear, and easy to deal with from the first message.'
      },
      {
        name: 'Jordan',
        text: 'Exactly what we needed — would recommend to anyone in ' + loc + '.'
      }
    ]
  );
}

/**
 * Build fully populated section map for active section keys.
 * @returns {{ sections: Record<string, object>, services: object[], imageBriefs: Record<string, string>, provenanceMap: Record<string, string> }}
 */
function generateSectionContent(brief, profile, foundation, recipe, ctx) {
  const cta = ctx.cta;
  const services = buildServices(brief, profile, recipe);
  const imageBriefs = imageBriefsFor(brief, profile, recipe);
  const faqs = faqItems(brief, profile);
  const reviews = reviewItems(brief, profile);
  const name = brief.businessName;
  const loc = brief.location || '';
  const heading = heroHeading(brief, profile);
  const subheading = heroSub(brief);

  /** @type {Record<string, object>} */
  const sections = {};
  /** @type {Record<string, string>} */
  const provenanceMap = {};

  function put(key, body, provenance) {
    sections[key] = {
      on: true,
      provenance,
      ...body
    };
    provenanceMap[key] = provenance;
  }

  for (const key of ctx.sectionOrder) {
    switch (key) {
      case 'hero':
        put(
          key,
          {
            variant: 'hero',
            content: {
              heading,
              subheading,
              title: heading,
              sub: subheading,
              cta,
              imageBrief: imageBriefs.heroImage
            }
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'emerg':
        put(
          key,
          {
            content: {
              text: name + (loc ? ' · ' + loc : '') + ' — call now for prompt service'
            }
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'services':
        put(
          key,
          {
            content: {
              heading: recipe.contentHints?.serviceShape === 'practice-areas' ? 'Practice areas' : 'Services',
              intro: brief.specialisation || profile.specialisation || brief.industry
            },
            items: services
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'featuredProjects':
        put(
          key,
          {
            content: {
              heading: profile.profileId === 'jewellery' ? 'Selected pieces' : 'Featured work',
              intro: 'Highlights from ' + name,
              imageBrief: imageBriefs.galleryImage1 || imageBriefs.heroImage
            },
            items: [
              {
                title: imageBriefs.galleryImage1 || 'Featured project',
                text: 'On-brand work for ' + name,
                imageBrief: imageBriefs.galleryImage1
              },
              {
                title: imageBriefs.galleryImage2 || 'Recent highlight',
                text: 'A second showcase moment',
                imageBrief: imageBriefs.galleryImage2
              }
            ].filter((i) => i.imageBrief || i.title)
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'why':
        put(
          key,
          {
            content: {
              heading: 'Why ' + name,
              intro: brief.desiredStyle
                ? 'A ' + brief.desiredStyle.toLowerCase() + ' experience shaped around your goals.'
                : 'Clarity, care, and a process that feels easy from the first enquiry.'
            }
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'reviews':
        put(
          key,
          {
            content: { heading: 'What clients say' },
            items: reviews
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'quote':
        put(
          key,
          {
            content: { heading: cta, buttonText: cta, title: cta }
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'faq':
        put(
          key,
          {
            content: { heading: 'FAQs' },
            items: faqs
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'footer':
        put(
          key,
          {
            content: { blurb: name + (loc ? ' — ' + loc : '') },
            blurb: name + (loc ? ' — ' + loc : '')
          },
          PROVENANCE.BUSINESS_PROFILE
        );
        break;
      case 'specialOffer':
        put(
          key,
          {
            content: {
              heading: 'Current offer',
              text: 'Ask about current availability' + (loc ? ' in ' + loc : '') + '.'
            }
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'trustBar':
        put(key, { content: { heading: 'Trusted locally' } }, PROVENANCE.AI_GENERATED);
        break;
      case 'crew':
        put(
          key,
          {
            content: {
              heading: 'Meet the team',
              imageBrief: imageBriefs.teamImage || 'Team portrait for ' + name
            }
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'area':
        put(
          key,
          {
            content: { heading: 'Areas we serve', intro: loc || 'Local coverage' }
          },
          PROVENANCE.BUSINESS_PROFILE
        );
        break;
      case 'serviceProcess':
        put(
          key,
          {
            content: {
              heading: 'How we work',
              intro: 'A clear path from first contact to finished outcome.'
            }
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'beforeAfter':
        put(
          key,
          {
            content: {
              heading: 'Before & after',
              intro: 'Proof of craftsmanship from recent projects.'
            }
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'featureStrip':
        put(
          key,
          {
            content: {
              heading: 'What you can expect',
              intro: 'Practical strengths of working with ' + name + '.'
            }
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'certifications':
        put(
          key,
          { content: { heading: 'Credentials', intro: 'Qualifications and standards we work to.' } },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'onlineQuote':
        put(
          key,
          { content: { heading: cta, buttonText: cta } },
          PROVENANCE.RECIPE
        );
        break;
      case 'instaGallery':
        put(
          key,
          {
            content: {
              heading: 'On Instagram',
              imageBrief: imageBriefs.galleryImage2 || imageBriefs.galleryImage1
            }
          },
          PROVENANCE.RECIPE
        );
        break;
      default:
        put(
          key,
          {
            content: {
              heading: humanizeKey(key),
              intro: 'Section prepared for ' + name
            }
          },
          PROVENANCE.AI_GENERATED
        );
    }
  }

  // Structural provenance notes for foundation/recipe contributions
  provenanceMap.__foundation = PROVENANCE.FOUNDATION;
  provenanceMap.__recipe = PROVENANCE.RECIPE;

  return { sections, services, imageBriefs, provenanceMap, heading, subheading, cta };
}

function heroHeading(brief, profile) {
  const name = brief.businessName;
  switch (profile.profileId) {
    case 'jewellery':
      return name + ' — ' + (brief.specialisation || 'rare pieces, quietly presented');
    case 'electrician':
    case 'security-trade':
      return (brief.specialisation || brief.industry) + ' you can trust';
    case 'coffee-event':
      return name + ' — specialty coffee for events that feel considered';
    case 'commercial-lawyer':
      return 'Commercial legal counsel for growing businesses';
    case 'hair-salon':
      return name + ' — hair, colour and care';
    case 'wedding-photographer':
      return name + ' — wedding photography with a documentary heart';
    default:
      return name;
  }
}

function heroSub(brief) {
  const bits = [];
  if (brief.specialisation) bits.push(brief.specialisation);
  if (brief.location) bits.push(brief.location);
  if (brief.audience) bits.push('for ' + brief.audience);
  return bits.join(' · ') || 'A complete web presence built around your brief.';
}

function humanizeKey(key) {
  return String(key)
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

module.exports = {
  primaryCta,
  buildServices,
  generateSectionContent,
  imageBriefsFor
};
