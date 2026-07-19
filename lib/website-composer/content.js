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

function servicesFromBrief(brief, profile) {
  const loc = brief.location || 'your area';
  const spec = brief.specialisation || profile.specialisation || brief.industry || '';
  let raw = Array.isArray(brief.mainServices)
    ? brief.mainServices.map((s) => String(s || '').trim()).filter(Boolean)
    : String(brief.mainServices || '')
        .split(/[,;\n|/]+/)
        .map((s) => s.trim())
        .filter(Boolean);
  // Single prose line like "RC Car sales and service" → separate cards.
  if (raw.length === 1 && /\s+(?:and|&)\s+/i.test(raw[0])) {
    const parts = raw[0]
      .split(/\s+(?:and|&)\s+/i)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2);
    if (parts.length >= 2) raw = parts;
  }
  if (!raw.length) return null;
  return raw.slice(0, 8).map((title, idx) => ({
    title: String(title).slice(0, 72),
    text:
      idx === 0 && spec
        ? spec + (loc ? ' across ' + loc + '.' : '.')
        : (spec ? spec + ' — ' : '') + 'Delivered with care' + (loc ? ' in ' + loc : '') + '.'
  }));
}

function serviceCatalog(brief, profile, recipe) {
  const loc = brief.location || 'your area';
  const spec = brief.specialisation || profile.specialisation || brief.industry;
  const shape = (recipe && recipe.contentHints && recipe.contentHints.serviceShape) || 'services';
  const name = brief.businessName || 'our team';

  const catalogs = {
    'event-packages': [
      {
        title: 'Coffee cart',
        text: 'Compact specialty cart for intimate weddings and courtyard activations in ' + loc + '.'
      },
      {
        title: 'Coffee van',
        text: 'Self-contained van service for corporate campuses, markets and larger guest lists.'
      },
      {
        title: 'Coffee caravan',
        text: 'Statement caravan bar for premium brand events and festival weekends.'
      },
      {
        title: 'Weddings & private events',
        text: 'Ceremony and reception coffee styled to match your day.'
      },
      {
        title: 'Corporate activations',
        text: 'Branded barista bars for launches, product demos and staff days.'
      },
      {
        title: 'Festival & market hire',
        text: 'Crowd-ready mobile setups with reliable throughput.'
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
    'landscape-services': [
      {
        title: 'Garden design & construction',
        text: 'Concept-to-build outdoor spaces tailored to ' + loc + '.'
      },
      {
        title: 'Retaining walls & hardscaping',
        text: 'Stone, sleeper and paved structure that lasts.'
      },
      {
        title: 'Outdoor living & entertaining',
        text: 'Fire pits, entertaining areas and lifestyle-ready yards.'
      },
      {
        title: 'Turf, irrigation & maintenance',
        text: 'Softscape, watering systems and ongoing care.'
      }
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

/**
 * Build ≥3 service cards. Sparse operator lists (1–2 items) are padded from
 * the industry catalog so marketplace adapters never fail generation.
 */
function buildServices(brief, profile, recipe) {
  const catalog = serviceCatalog(brief, profile, recipe);
  const fromBrief = servicesFromBrief(brief, profile);
  if (!fromBrief || !fromBrief.length) return catalog;

  const loc = brief.location || 'your area';
  const spec = brief.specialisation || (profile && profile.specialisation) || brief.industry || 'Our work';
  const name = brief.businessName || 'our team';
  const items = fromBrief.slice(0, 8);
  const seen = new Set(items.map((it) => String(it.title || '').toLowerCase()));

  for (let i = 0; i < catalog.length && items.length < 3; i++) {
    const candidate = catalog[i];
    const key = String(candidate.title || '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(candidate);
  }

  while (items.length < 3) {
    const n = items.length + 1;
    items.push({
      title: n === 2 ? 'Support & advice' : 'Follow-up care',
      text: spec + ' with ' + name + (loc ? ' across ' + loc : '') + '.'
    });
  }

  return items;
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
    },
    landscaping: {
      heroImage: 'Luxury landscaped backyard with fire pit at dusk',
      galleryImage1: 'Garden design and construction finished project',
      galleryImage2: 'Retaining walls and outdoor living entertaining area',
      galleryImage3: 'Fresh turf irrigation and maintained garden beds',
      teamImage: 'Landscaping crew on a residential outdoor project'
    }
  };

  if (map[pid]) return map[pid];
  return {
    heroImage: name + (loc ? ' in ' + loc : '') + ' — on-brand hero photography',
    galleryImage1: 'Brand photography for ' + (brief.industry || 'the business'),
    galleryImage2: 'Project highlight photography for ' + (brief.industry || 'the business')
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

/** Industry-aware "why choose us" cards — never trade/plumbing stubs. */
function whyItems(brief, profile) {
  const name = brief.businessName;
  const loc = brief.location || 'your area';
  const spec = brief.specialisation || brief.industry || 'our work';
  const pid = profile.profileId;
  const catalogs = {
    jewellery: [
      { title: 'Private appointments', text: 'Quiet showroom time so you can decide without pressure.' },
      { title: 'Provenance you can trust', text: 'Clear stone history and considered guidance on every piece.' },
      { title: 'Bespoke craftsmanship', text: 'Made-to-order settings guided by your taste and stone.' },
      { title: 'Local & considered', text: name + ' welcomes clients in ' + loc + ' and beyond.' }
    ],
    'coffee-event': [
      { title: 'Event-ready setups', text: 'Cart, van or caravan styled to match your day.' },
      { title: 'Specialty baristas', text: 'Consistent espresso and a polished guest experience.' },
      { title: 'Reliable logistics', text: 'On-time arrival, tidy pack-down across ' + loc + '.' },
      { title: 'Brand-ready', text: 'Cups, signage and service that photograph well.' }
    ],
    electrician: [
      { title: 'Licensed work', text: 'Qualified electrical work with clear documentation.' },
      { title: 'Upfront quotes', text: 'Scope and pricing agreed before work begins.' },
      { title: 'Tidy finish', text: 'Respect for your home or site from arrival to leave.' },
      { title: 'Local crew', text: 'A dependable team across ' + loc + '.' }
    ],
    'commercial-lawyer': [
      { title: 'Commercial focus', text: 'Advice shaped for growing businesses, not generic templates.' },
      { title: 'Plain-language counsel', text: 'Clear next steps without unnecessary jargon.' },
      { title: 'Protective drafting', text: 'Contracts and negotiations that protect your position.' },
      { title: 'Responsive partner', text: name + ' stays reachable when matters move quickly.' }
    ],
    'hair-salon': [
      { title: 'Consultation first', text: 'Every colour and cut starts with listening to your goals.' },
      { title: 'Skilled stylists', text: 'Techniques matched to your hair, lifestyle and face shape.' },
      { title: 'Calm studio', text: 'A considered appointment experience in ' + loc + '.' },
      { title: 'Lasting finish', text: 'Looks you can live in — not just leave the chair with.' }
    ],
    'wedding-photographer': [
      { title: 'Documentary heart', text: 'Quiet observation that catches the moments that matter.' },
      { title: 'Guided, never stiff', text: 'Natural direction so you feel like yourselves.' },
      { title: 'Timeline care', text: 'Coverage planned around your day, not the other way around.' },
      { title: 'Heirloom galleries', text: 'Images built to keep — prints and albums included in packages.' }
    ],
    landscaping: [
      { title: 'Design-led builds', text: 'Outdoor spaces planned for how you actually live.' },
      { title: 'Local craftsmanship', text: 'Hardscape and softscape built for ' + loc + ' conditions.' },
      { title: 'Clear project stages', text: 'From first consult to handover with no surprises.' },
      { title: 'Lifestyle finish', text: 'Entertaining areas, turf and planting that feel complete.' }
    ]
  };

  const diffs = Array.isArray(brief.differentiators)
    ? brief.differentiators.map((d) => String(d || '').trim()).filter(Boolean)
    : String(brief.differentiators || '')
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);

  // Prefer operator-provided differentiators over generic catalogs.
  if (diffs.length >= 1) {
    const cards = diffs.slice(0, 4).map((d, i) => ({
      title: String(d).slice(0, 48),
      text:
        i === 0
          ? (brief.notes ? String(brief.notes).slice(0, 140) : spec + ' with ' + name + '.')
          : 'Part of how ' + name + ' works with clients' + (loc ? ' in ' + loc : '') + '.'
    }));
    while (cards.length < 3 && catalogs[pid] && catalogs[pid][cards.length]) {
      cards.push(catalogs[pid][cards.length]);
    }
    return cards;
  }

  if (catalogs[pid]) return catalogs[pid];
  return [
    { title: 'Clear process', text: 'A straightforward path from first enquiry to outcome.' },
    { title: 'Quality focus', text: spec + ' delivered with care.' },
    { title: 'Local presence', text: name + ' serves clients in ' + loc + '.' },
    { title: 'Easy to deal with', text: 'Responsive communication from the first message.' }
  ];
}

function visualTrustBadges(brief, profile, services, imageBriefs) {
  const loc = brief.location || 'Local';
  const fromServices = (services || []).slice(0, 4).map((s, idx) => ({
    label: s.title,
    imageBrief:
      imageBriefs['galleryImage' + (idx + 1)] ||
      imageBriefs.galleryImage1 ||
      imageBriefs.heroImage,
    on: true
  }));
  if (fromServices.length >= 3) return fromServices;
  if (profile.profileId === 'landscaping') {
    return [
      {
        label: 'Garden Design & Construction',
        imageBrief: imageBriefs.galleryImage1 || imageBriefs.heroImage,
        on: true
      },
      {
        label: 'Retaining Walls & Hardscaping',
        imageBrief: imageBriefs.galleryImage2 || imageBriefs.heroImage,
        on: true
      },
      {
        label: 'Outdoor Living & Entertaining',
        imageBrief: imageBriefs.galleryImage3 || imageBriefs.galleryImage2 || imageBriefs.heroImage,
        on: true
      },
      {
        label: 'Turf, Irrigation & Maintenance',
        imageBrief: imageBriefs.galleryImage1 || imageBriefs.heroImage,
        on: true
      }
    ];
  }
  return [
    { label: 'Trusted locally', imageBrief: imageBriefs.heroImage, on: true },
    { label: loc, imageBrief: imageBriefs.galleryImage1 || imageBriefs.heroImage, on: true },
    { label: 'Quality finish', imageBrief: imageBriefs.galleryImage2 || imageBriefs.heroImage, on: true },
    { label: 'Clear communication', imageBrief: imageBriefs.galleryImage1 || imageBriefs.heroImage, on: true }
  ];
}

function usesImageTrustBar(profile, slot) {
  return (
    profile.profileId === 'landscaping' ||
    profile.profileId === 'jewellery' ||
    profile.profileId === 'coffee-event' ||
    (profile.profileId !== 'electrician' && slot === 1)
  );
}

/** Quote / enquiry form copy shaped by industry + conversion strategy slot. */
function quoteFields(brief, profile, cta, slot) {
  const loc = brief.location || 'your area';
  const pid = profile.profileId;
  const strategy = slot === 1 ? 'offer' : slot === 2 ? 'reviews' : 'showcase';
  const bases = {
    jewellery: {
      sub:
        strategy === 'offer'
          ? 'Reserve a private viewing — we will confirm a quiet time that suits you.'
          : strategy === 'reviews'
            ? 'Join clients who chose a calmer way to find their piece.'
            : 'Share a little about what you are looking for and we will arrange a private appointment.',
      lblJob: 'What are you interested in?',
      jobOptions: [
        { text: 'Engagement ring', on: true },
        { text: 'Rare pink diamond', on: true },
        { text: 'Bespoke design', on: true },
        { text: 'Private consultation', on: true },
        { text: 'Repairs & aftercare', on: true }
      ],
      points: [
        { text: 'Private showroom appointments', on: true },
        { text: 'Clear provenance on every stone', on: true },
        { text: 'Bespoke design guidance', on: true }
      ],
      detailPh: 'Tell us about the piece or appointment you have in mind',
      suburbPh: loc
    },
    'coffee-event': {
      sub: 'Share your event date and guest count — we will confirm the right setup.',
      lblJob: 'What kind of event?',
      jobOptions: [
        { text: 'Wedding', on: true },
        { text: 'Corporate activation', on: true },
        { text: 'Festival / market', on: true },
        { text: 'Private celebration', on: true }
      ],
      points: [
        { text: 'Cart, van or caravan options', on: true },
        { text: 'Specialty baristas on site', on: true },
        { text: 'Setup and pack-down included', on: true }
      ],
      detailPh: 'Date, venue, guest count and styling notes',
      suburbPh: loc
    },
    'commercial-lawyer': {
      sub: 'Tell us briefly about your matter — we will outline the next clear step.',
      lblJob: 'What do you need help with?',
      jobOptions: [
        { text: 'Contracts & agreements', on: true },
        { text: 'Negotiation support', on: true },
        { text: 'Ongoing counsel', on: true },
        { text: 'Other commercial matter', on: true }
      ],
      points: [
        { text: 'Plain-language advice', on: true },
        { text: 'Fees discussed upfront', on: true },
        { text: 'Responsive commercial focus', on: true }
      ],
      detailPh: 'A short summary of your matter',
      suburbPh: loc
    },
    'hair-salon': {
      sub: 'Book your appointment — tell us what you would like and we will confirm a time.',
      lblJob: 'What service are you after?',
      jobOptions: [
        { text: 'Cut & finish', on: true },
        { text: 'Colour', on: true },
        { text: 'Event styling', on: true },
        { text: 'Consultation', on: true }
      ],
      points: [
        { text: 'Consultation before colour', on: true },
        { text: 'Skilled stylists', on: true },
        { text: 'Easy online enquiry', on: true }
      ],
      detailPh: 'Any notes for your stylist',
      suburbPh: loc
    },
    electrician: {
      sub: 'Describe the job and we will come back with a clear next step.',
      lblJob: 'What do you need done?',
      jobOptions: [
        { text: 'Switchboard / safety', on: true },
        { text: 'New install', on: true },
        { text: 'Fault finding', on: true },
        { text: 'General electrical', on: true }
      ],
      points: [
        { text: 'Licensed electrical work', on: true },
        { text: 'Clear quotes before we start', on: true },
        { text: 'Tidy on-site manner', on: true }
      ],
      detailPh: 'Describe the work and preferred timing',
      suburbPh: loc
    }
  };
  const b = bases[pid] || {
    sub: 'Send a short enquiry and ' + brief.businessName + ' will be in touch.',
    lblJob: 'How can we help?',
    jobOptions: [
      { text: 'General enquiry', on: true },
      { text: 'Book a time', on: true },
      { text: 'Request information', on: true }
    ],
    points: [
      { text: 'Clear next steps', on: true },
      { text: 'Local service in ' + loc, on: true },
      { text: 'Friendly follow-up', on: true }
    ],
    detailPh: 'Tell us what you need',
    suburbPh: loc
  };
  return {
    heading: cta,
    title: cta,
    sub: b.sub,
    intro: b.sub,
    buttonText: cta,
    lblName: 'Name',
    lblPhone: 'Phone',
    lblJob: b.lblJob,
    lblSuburb: 'Suburb / area',
    lblDetail: 'Details',
    jobOptions: b.jobOptions,
    points: b.points,
    suburbPh: b.suburbPh,
    detailPh: b.detailPh,
    successMessage: 'Thanks — we will be in touch shortly.',
    successTitle: 'Enquiry received',
    successSub: 'We will follow up soon.'
  };
}

function reviewHighlightItems(brief, reviews) {
  const loc = brief.location || '';
  const src = (reviews || []).slice(0, 3);
  while (src.length < 3) {
    src.push({
      name: 'Recent client',
      text: 'A considered experience with ' + brief.businessName + (loc ? ' in ' + loc : '') + '.'
    });
  }
  return src.map((r) => ({
    stars: '★★★★★',
    text: r.text || '',
    who: (r.name || r.who || 'Client') + (loc ? ' — ' + loc : ''),
    name: r.name || r.who || 'Client'
  }));
}

function footerFields(brief, profile, services) {
  const name = brief.businessName;
  const loc = brief.location || '';
  const spec = brief.specialisation || brief.industry || '';
  const pid = profile.profileId;
  const blurb =
    pid === 'jewellery'
      ? name +
        (loc ? ' — ' + loc : '') +
        '. Private appointments for rare stones and bespoke fine jewellery.'
      : pid === 'coffee-event'
        ? name + (loc ? ' — ' + loc : '') + '. Specialty coffee for weddings, corporate and festivals.'
        : name + (loc ? ' — ' + loc : '') + (spec ? '. ' + spec + '.' : '.');
  const links = (services || []).slice(0, 4).map((s) => ({
    label: s.title || 'Service',
    href: '#quote'
  }));
  if (!links.length) {
    links.push({ label: 'Get in touch', href: '#quote' });
  }
  return {
    blurb,
    legal: name + (loc ? ' · ' + loc : '') + '.',
    callLabel: 'Call us',
    servicesHeading: pid === 'jewellery' ? 'Collections' : 'Services',
    serviceLinks: links,
    emergencyLabel: ''
  };
}

function activityFeedItems(brief, profile) {
  const loc = brief.location || 'Local area';
  const areas = (brief.serviceAreas || []).map((a) => (typeof a === 'string' ? a : a.label)).filter(Boolean);
  const a1 = areas[0] || loc;
  const a2 = areas[1] || loc;
  const a3 = areas[2] || loc;
  const pid = profile.profileId;
  if (pid === 'jewellery') {
    return [
      { text: 'Private viewing booked in ' + a1, time: '2 hours ago' },
      { text: 'Bespoke ring consultation completed', time: 'Yesterday' },
      { text: 'Rare stone appointment in ' + a2, time: '3 days ago' },
      { text: 'Aftercare visit scheduled', time: 'Last week' }
    ];
  }
  if (pid === 'coffee-event') {
    return [
      { text: 'Wedding coffee cart confirmed in ' + a1, time: '2 hours ago' },
      { text: 'Corporate activation booked', time: 'Yesterday' },
      { text: 'Festival service locked in ' + a2, time: '3 days ago' },
      { text: 'Tasting session completed', time: 'Last week' }
    ];
  }
  return [
    { text: 'Recent enquiry from ' + a1, time: '2 hours ago' },
    { text: 'Project update completed in ' + a2, time: 'Yesterday' },
    { text: 'New booking confirmed', time: '3 days ago' },
    { text: 'Follow-up scheduled in ' + a3, time: 'Last week' }
  ];
}

/**
 * Build fully populated section map for active section keys.
 * @returns {{ sections: Record<string, object>, services: object[], imageBriefs: Record<string, string>, provenanceMap: Record<string, string> }}
 */
function generateSectionContent(brief, profile, foundation, recipe, ctx) {
  const cta = ctx.cta;
  const slot = typeof ctx.slot === 'number' ? ctx.slot : 0;
  const services = buildServices(brief, profile, recipe);
  const imageBriefs = imageBriefsFor(brief, profile, recipe);
  const faqs = faqItems(brief, profile);
  const reviews = reviewItems(brief, profile);
  const whyCards = whyItems(brief, profile);
  const quote = quoteFields(brief, profile, cta, slot);
  const highlights = reviewHighlightItems(brief, reviews);
  const footer = footerFields(brief, profile, services);
  const feed = activityFeedItems(brief, profile);
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
            title: heading,
            sub: subheading,
            heading,
            subheading,
            cta,
            eyebrow: profile.profileId === 'jewellery' ? 'Private appointments' : '',
            imageBrief: imageBriefs.heroImage
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'heroSlider':
        put(
          key,
          {
            cta,
            slides: [
              {
                heading,
                subText: subheading,
                cta,
                imageBrief: imageBriefs.heroImage
              },
              {
                heading: services[0] ? services[0].title : name,
                subText: services[0]
                  ? services[0].text
                  : brief.specialisation || brief.industry || '',
                cta,
                imageBrief: imageBriefs.galleryImage1 || imageBriefs.heroImage
              },
              {
                heading: services[1] ? services[1].title : name + ' projects',
                subText: services[1]
                  ? services[1].text
                  : brief.notes
                    ? String(brief.notes).slice(0, 120)
                    : 'Recent work' + (loc ? ' across ' + loc : ''),
                cta,
                imageBrief: imageBriefs.galleryImage2 || imageBriefs.galleryImage1 || imageBriefs.heroImage
              }
            ]
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'splitHero':
        put(
          key,
          {
            title: heading,
            heading,
            sub: subheading,
            eyebrow:
              profile.profileId === 'jewellery'
                ? 'Private appointments today'
                : profile.profileId === 'coffee-event'
                  ? 'Events across ' + (loc || 'the region')
                  : 'Active with clients today',
            cta,
            imageBrief: imageBriefs.heroImage,
            feed,
            items: feed
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'emerg':
        put(
          key,
          {
            text:
              profile.profileId === 'jewellery'
                ? name + (loc ? ' · ' + loc : '') + ' — private appointments by arrangement'
                : name + (loc ? ' · ' + loc : '') + ' — get in touch today',
            content: {
              text:
                profile.profileId === 'jewellery'
                  ? name + (loc ? ' · ' + loc : '') + ' — private appointments by arrangement'
                  : name + (loc ? ' · ' + loc : '') + ' — get in touch today'
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
            heading:
              profile.profileId === 'jewellery'
                ? 'Selected pieces'
                : profile.profileId === 'landscaping'
                  ? 'Everything your outdoor space needs'
                  : 'Featured work',
            eyebrow:
              profile.profileId === 'coffee-event'
                ? 'Event gallery'
                : profile.profileId === 'landscaping'
                  ? 'Project gallery'
                  : '',
            intro:
              brief.notes
                ? String(brief.notes).slice(0, 160)
                : 'Highlights from ' + name + (loc ? ' across ' + loc : ''),
            projects: (services.length ? services : [{ title: 'Featured project', text: 'On-brand work for ' + name }])
              .slice(0, 4)
              .map((svc, idx) => ({
                title: svc.title,
                tag:
                  profile.profileId === 'coffee-event'
                    ? ['Wedding', 'Corporate', 'Festival', 'Private'][idx] || ''
                    : profile.profileId === 'landscaping'
                      ? String(svc.title).split(/[&/]/)[0].trim().slice(0, 28).toUpperCase()
                      : '',
                location: loc,
                text: svc.text || 'On-brand work for ' + name,
                imageBrief:
                  imageBriefs['galleryImage' + (idx + 1)] ||
                  imageBriefs.galleryImage1 ||
                  imageBriefs.heroImage
              }))
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'why':
        put(
          key,
          {
            heading: 'Why ' + name,
            intro: brief.notes
              ? String(brief.notes).slice(0, 180)
              : brief.desiredStyle
                ? 'A ' + brief.desiredStyle.toLowerCase() + ' experience shaped around your goals.'
                : 'Clarity, care, and a process that feels easy from the first enquiry.',
            items: whyCards.map((w, i) => ({
              n: String(i + 1).padStart(2, '0'),
              title: w.title,
              text: w.text,
              body: w.text,
              on: true
            }))
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
        put(key, quote, PROVENANCE.AI_GENERATED);
        break;
      case 'reviewHighlights':
        put(
          key,
          {
            heading: 'Review highlights',
            eyebrow: 'Don\'t take our word for it',
            intro: 'Recent client notes for ' + name + '.',
            items: highlights
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
        put(key, footer, PROVENANCE.BUSINESS_PROFILE);
        break;
      case 'specialOffer':
        put(
          key,
          {
            heading:
              profile.profileId === 'coffee-event'
                ? 'Event packages & inclusions'
                : profile.profileId === 'jewellery'
                  ? 'Private viewing offer'
                  : 'Current offer',
            text:
              profile.profileId === 'coffee-event'
                ? 'Packages include barista, specialty coffee, setup and pack-down' +
                  (loc ? ' across ' + loc : '') +
                  '. Ask about branded cups and signage.'
                : 'Ask about current availability' + (loc ? ' in ' + loc : '') + '.',
            cta
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'trustBar': {
        const imageMode = usesImageTrustBar(profile, slot);
        const imageBadges = visualTrustBadges(brief, profile, services, imageBriefs);
        const textBadges =
          profile.profileId === 'coffee-event'
            ? [
                { label: 'Weddings' },
                { label: 'Corporate' },
                { label: 'Festivals' },
                { label: 'Fully insured' }
              ]
            : profile.profileId === 'electrician'
              ? [
                  { label: 'Licensed' },
                  { label: 'Insured' },
                  { label: 'Clear quotes' },
                  { label: 'Local crew' }
                ]
              : profile.profileId === 'jewellery'
                ? [
                    { label: 'Private appointments' },
                    { label: 'Provenance first' },
                    { label: 'Bespoke design' },
                    { label: loc || 'Showroom' }
                  ]
                : profile.profileId === 'commercial-lawyer'
                  ? [
                      { label: 'Commercial focus' },
                      { label: 'Clear fees' },
                      { label: 'Responsive' },
                      { label: loc || 'Local' }
                    ]
                  : [
                      { label: 'Trusted locally' },
                      { label: 'Clear communication' },
                      { label: 'Quality finish' }
                    ];
        put(
          key,
          {
            heading: imageMode ? '' : 'Trusted locally',
            mode: imageMode ? 'images' : 'badges',
            imageHeight: 280,
            badges: imageMode ? imageBadges : textBadges
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      }
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
            heading: profile.profileId === 'coffee-event' ? 'How booking works' : 'How we work',
            intro:
              profile.profileId === 'coffee-event'
                ? 'A simple path from enquiry to barista on site.'
                : 'A clear path from first contact to finished outcome.',
            steps:
              profile.profileId === 'coffee-event'
                ? [
                    { title: 'Share your event', text: 'Date, guest count, venue and style.' },
                    { title: 'Choose your setup', text: 'Cart, van or caravan — with package inclusions.' },
                    { title: 'We show up ready', text: 'Baristas, coffee and a polished guest experience.' }
                  ]
                : [
                    { title: 'Tell us what you need', text: 'Share a short brief.' },
                    { title: 'Get a clear plan', text: 'We outline scope and timing.' },
                    { title: 'Deliver with care', text: 'We follow through cleanly.' }
                  ]
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
            heading: 'What you can expect',
            intro: 'Practical strengths of working with ' + name + '.',
            items: whyCards.slice(0, 4).map((w) => ({
              title: w.title,
              text: w.text
            }))
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
      case 'packageCompare':
        put(
          key,
          {
            heading: profile.profileId === 'coffee-event' ? 'Cart, van or caravan' : 'Compare packages',
            intro:
              profile.profileId === 'coffee-event'
                ? 'Choose the setup that matches your guest count and venue.'
                : 'Clear options so you can pick the right fit.',
            packages:
              profile.profileId === 'coffee-event'
                ? [
                    {
                      title: 'Coffee cart',
                      text: 'Compact specialty cart for intimate weddings and courtyard activations.',
                      inclusions: ['1 barista', 'Specialty espresso menu', 'Up to ~80 guests'],
                      priceLabel: 'From event quote'
                    },
                    {
                      title: 'Coffee van',
                      text: 'Self-contained van for campuses, markets and larger lists.',
                      inclusions: ['1–2 baristas', 'High throughput', 'Branding options'],
                      priceLabel: 'From event quote'
                    },
                    {
                      title: 'Coffee caravan',
                      text: 'Statement caravan bar for premium brand events and festivals.',
                      inclusions: ['Signature presence', 'Extended menu', 'Photo-ready setup'],
                      priceLabel: 'From event quote'
                    }
                  ]
                : [
                    {
                      title: 'Essential',
                      text: 'Core inclusions for a focused engagement.',
                      inclusions: ['Discovery call', 'Scoped plan', 'Email support'],
                      priceLabel: 'Talk to us'
                    },
                    {
                      title: 'Signature',
                      text: 'Our most popular package for growing brands.',
                      inclusions: ['Priority scheduling', 'Dedicated contact', 'Review checkpoint'],
                      priceLabel: 'Talk to us'
                    }
                  ],
            cta
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'productCollection':
        put(
          key,
          {
            heading: profile.profileId === 'jewellery' ? 'Featured collections' : 'Collections',
            intro: 'Pieces and sets selected for ' + (brief.audience || 'discerning clients') + '.',
            items: [
              {
                title: profile.profileId === 'jewellery' ? 'Pink diamond engagement' : 'Signature collection',
                text: 'Quietly exceptional pieces for private viewing.',
                imageBrief: imageBriefs.galleryImage1
              },
              {
                title: profile.profileId === 'jewellery' ? 'Rare coloured stones' : 'Seasonal edit',
                text: 'Curated stones and settings with clear provenance.',
                imageBrief: imageBriefs.galleryImage2
              },
              {
                title: 'Bespoke commissions',
                text: 'Designed with you — from sketch to setting.',
                imageBrief: imageBriefs.galleryImage1
              }
            ]
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'clientLogos':
        put(
          key,
          {
            heading: profile.profileId === 'coffee-event' ? 'Events & brands we serve' : 'Trusted by',
            logos: [
              { label: 'Corporate partners' },
              { label: 'Wedding studios' },
              { label: 'Venue groups' },
              { label: 'Festival organisers' }
            ]
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'bookingCta':
        put(
          key,
          {
            heading:
              profile.profileId === 'jewellery'
                ? slot === 1
                  ? 'Reserve your private viewing'
                  : 'Book a private appointment'
                : profile.profileId === 'coffee-event'
                  ? 'Check your event date'
                  : cta,
            intro:
              profile.profileId === 'jewellery'
                ? slot === 2
                  ? 'Clients choose us for calm appointments and clear stone guidance.'
                  : 'Quiet consultations for engagement rings and rare stones.'
                : profile.profileId === 'coffee-event'
                  ? 'Tell us the date, guest count and venue — we will confirm availability.'
                  : quote.sub,
            cta,
            body:
              profile.profileId === 'jewellery'
                ? 'Private showroom time in ' + (loc || 'our boutique') + '.'
                : quote.sub,
            finePrint: brief.location ? 'Serving ' + brief.location + ' and surrounds.' : ''
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'brandStory':
        put(
          key,
          {
            eyebrow: profile.profileId === 'jewellery' ? 'Provenance' : 'Our story',
            heading:
              profile.profileId === 'jewellery'
                ? 'Craftsmanship with a quiet confidence'
                : profile.profileId === 'landscaping'
                  ? 'Landscaping built for life outdoors'
                  : 'Why ' + name + ' exists',
            body:
              brief.notes
                ? String(brief.notes).slice(0, 320)
                : profile.profileId === 'jewellery'
                  ? name +
                    ' presents rare pink diamonds and fine jewellery through private appointments — with clear provenance and considered design.'
                  : name +
                    (brief.specialisation ? ' specialises in ' + brief.specialisation + '.' : '.') +
                    (brief.location ? ' Based in ' + brief.location + '.' : '') +
                    ' Every detail is shaped around the people we serve.',
            cta: 'Learn more',
            imageBrief: imageBriefs.galleryImage1
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'textBox':
        put(
          key,
          {
            heading: 'A note from ' + name,
            body: brief.notes || brief.specialisation || 'Thoughtful work for the people who choose us.',
            text: brief.notes || brief.specialisation || 'Thoughtful work for the people who choose us.'
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'customerReactions':
        put(
          key,
          {
            heading: 'What people say',
            items: [
              { who: 'Recent client', text: 'Clear communication and a result we were proud of.' },
              { who: 'Local customer', text: 'Professional, warm, and easy to deal with.' }
            ]
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'jobsFeed':
      case 'projectFeed':
        put(
          key,
          {
            heading:
              key === 'jobsFeed'
                ? profile.profileId === 'jewellery'
                  ? 'Recent appointments'
                  : 'Recent jobs'
                : profile.profileId === 'jewellery'
                  ? 'Studio feed'
                  : 'Project feed',
            items: feed.map((f) => ({
              title: f.text,
              text: f.text,
              time: f.time,
              location: loc
            }))
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'projectStats':
        put(
          key,
          {
            heading: 'By the numbers',
            items: [
              { label: 'Projects', value: '120+' },
              { label: 'Years', value: String(brief.yearsOperating || '5') + '+' },
              { label: 'Clients', value: 'Local' }
            ]
          },
          PROVENANCE.AI_GENERATED
        );
        break;
      case 'serviceAreas':
        put(
          key,
          {
            heading: 'Service areas',
            areas: (brief.serviceAreas || (loc ? [loc] : ['Local area'])).slice(0, 8).map((a) => ({
              label: typeof a === 'string' ? a : a.label || String(a)
            })),
            items: (brief.serviceAreas || (loc ? [loc] : ['Local area'])).slice(0, 8).map((a) => ({
              title: typeof a === 'string' ? a : a.label || String(a)
            }))
          },
          PROVENANCE.BUSINESS_PROFILE
        );
        break;
      case 'beforeAfterFeed':
        put(
          key,
          {
            heading: 'Before & after',
            items: [
              { title: 'Transformation one', text: 'Clear before and after proof.' },
              { title: 'Transformation two', text: 'Another recent result.' }
            ]
          },
          PROVENANCE.AI_GENERATED
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
    case 'landscaping':
      return (
        'Landscaping built for life' +
        (brief.location ? ' in ' + String(brief.location).split(/[,]/)[0] : '')
      );
    default:
      return name;
  }
}

function heroSub(brief) {
  if (brief.notes) {
    const note = String(brief.notes).replace(/\s+/g, ' ').trim();
    if (note.length > 40) return note.slice(0, 180);
  }
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
  servicesFromBrief,
  generateSectionContent,
  imageBriefsFor,
  whyItems,
  visualTrustBadges,
  usesImageTrustBar,
  quoteFields,
  reviewHighlightItems,
  footerFields,
  activityFeedItems
};
