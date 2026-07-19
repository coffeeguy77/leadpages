'use strict';

const { createImageBrief } = require('../image-service/image-brief');

const DIRECTION_PROFILES = Object.freeze({
  'warm-editorial-hospitality': {
    id: 'warm-editorial-hospitality',
    label: 'Warm editorial hospitality',
    photographyStyle: 'warm editorial hospitality photography',
    lighting: 'golden soft daylight',
    contrast: 'medium',
    colourTemperature: 'warm',
    composition: 'environmental with product focus',
    humanPresence: 'guests and professional staff',
    backgroundTreatment: 'event atmosphere',
    editingCharacter: 'natural warm grade'
  },
  'bright-energetic-events': {
    id: 'bright-energetic-events',
    label: 'Bright energetic events',
    photographyStyle: 'bright energetic event photography',
    lighting: 'high-key daylight',
    contrast: 'punchy',
    colourTemperature: 'warm-neutral',
    composition: 'wide celebration frames',
    humanPresence: 'crowds and hosts',
    backgroundTreatment: 'festive venues',
    editingCharacter: 'vivid clean'
  },
  'dark-luxury-product': {
    id: 'dark-luxury-product',
    label: 'Dark luxury product editorial',
    photographyStyle: 'dark luxury product editorial',
    lighting: 'controlled studio softbox',
    contrast: 'high',
    colourTemperature: 'cool-neutral',
    composition: 'centred product with negative space',
    humanPresence: 'minimal or hands only',
    backgroundTreatment: 'deep muted tones',
    editingCharacter: 'refined contrast'
  },
  'restrained-professional': {
    id: 'restrained-professional',
    label: 'Restrained professional corporate',
    photographyStyle: 'restrained corporate photography',
    lighting: 'soft office daylight',
    contrast: 'low-medium',
    colourTemperature: 'neutral',
    composition: 'calm meeting and workspace frames',
    humanPresence: 'professional adults',
    backgroundTreatment: 'modern offices',
    editingCharacter: 'clean desaturated'
  },
  'rugged-practical-trades': {
    id: 'rugged-practical-trades',
    label: 'Rugged practical trades',
    photographyStyle: 'practical on-site trade photography',
    lighting: 'natural worksite light',
    contrast: 'medium-high',
    colourTemperature: 'neutral',
    composition: 'worker + tools + environment',
    humanPresence: 'licensed tradesperson at work',
    backgroundTreatment: 'homes and commercial sites',
    editingCharacter: 'documentary clear'
  },
  'soft-premium-beauty': {
    id: 'soft-premium-beauty',
    label: 'Soft premium beauty',
    photographyStyle: 'soft premium beauty photography',
    lighting: 'diffused salon light',
    contrast: 'soft',
    colourTemperature: 'warm',
    composition: 'portrait and detail',
    humanPresence: 'stylist and client',
    backgroundTreatment: 'bright salon interiors',
    editingCharacter: 'airy soft'
  },
  'documentary-wedding': {
    id: 'documentary-wedding',
    label: 'Documentary wedding photography',
    photographyStyle: 'documentary wedding photography',
    lighting: 'natural golden hour and reception light',
    contrast: 'medium',
    colourTemperature: 'warm',
    composition: 'candid moments and details',
    humanPresence: 'couples and wedding guests',
    backgroundTreatment: 'venues and outdoor ceremony',
    editingCharacter: 'filmic natural'
  },
  'outdoor-living-editorial': {
    id: 'outdoor-living-editorial',
    label: 'Outdoor living editorial',
    photographyStyle: 'premium outdoor living and landscaping photography',
    lighting: 'golden hour dusk and soft daylight',
    contrast: 'medium-high',
    colourTemperature: 'warm',
    composition: 'wide lifestyle outdoor spaces with strong foreground detail',
    humanPresence: 'minimal lifestyle or empty finished yards',
    backgroundTreatment: 'gardens, patios, hills and night fire pits',
    editingCharacter: 'rich natural colour'
  },
  'dynamic-hobby-action': {
    id: 'dynamic-hobby-action',
    label: 'Dynamic hobby action',
    photographyStyle: 'dynamic RC and hobby action photography',
    lighting: 'bright outdoor daylight and workshop task light',
    contrast: 'punchy',
    colourTemperature: 'neutral-warm',
    composition: 'low-angle action and detailed product setups',
    humanPresence: 'enthusiasts hands and riders',
    backgroundTreatment: 'dirt tracks, workshops and hobby shelves',
    editingCharacter: 'vivid clear'
  }
});

function pickImageDirection(profile, foundation, slot) {
  const pid = profile && profile.profileId;
  if (pid === 'coffee-event' || pid === 'cafe') {
    return slot === 1 ? DIRECTION_PROFILES['bright-energetic-events'] : DIRECTION_PROFILES['warm-editorial-hospitality'];
  }
  if (pid === 'jewellery') return DIRECTION_PROFILES['dark-luxury-product'];
  if (pid === 'hobby-retail') return DIRECTION_PROFILES['dynamic-hobby-action'];
  if (pid === 'electrician' || pid === 'security-trade') return DIRECTION_PROFILES['rugged-practical-trades'];
  if (pid === 'commercial-lawyer' || pid === 'accounting') return DIRECTION_PROFILES['restrained-professional'];
  if (pid === 'hair-salon') return DIRECTION_PROFILES['soft-premium-beauty'];
  if (pid === 'wedding-photographer') return DIRECTION_PROFILES['documentary-wedding'];
  if (pid === 'landscaping' || (foundation && foundation.category === 'construction')) {
    return DIRECTION_PROFILES['outdoor-living-editorial'];
  }
  if (foundation && foundation.category === 'trades') return DIRECTION_PROFILES['rugged-practical-trades'];
  if (foundation && foundation.category === 'retail') return DIRECTION_PROFILES['dark-luxury-product'];
  return DIRECTION_PROFILES['restrained-professional'];
}

function avoidForProfile(profile) {
  const pid = profile && profile.profileId;
  const base = ['plumbing', 'construction site rubble', 'blocked drain', 'hi-vis clutter'];
  if (pid === 'jewellery') return base.concat(['coffee cart', 'electrician', 'salon scissors']);
  if (pid === 'coffee-event' || pid === 'cafe') {
    return base.concat(['empty cafe only', 'coffee beans only', 'home coffee machine', 'jewellery vault']);
  }
  if (pid === 'electrician') return ['pink diamond', 'wedding dress', 'coffee cart', 'law office gavel meme'];
  if (pid === 'commercial-lawyer') return base.concat(['hard hat', 'coffee cart', 'engagement ring macro']);
  if (pid === 'hair-salon') return base.concat(['surgery', 'construction', 'plumbing']);
  if (pid === 'wedding-photographer') return base.concat(['stock handshake', 'office cubicle', 'plumber']);
  if (pid === 'landscaping') {
    return base.concat(['plumbing tools', 'coffee cart', 'engagement ring', 'office cubicle', 'empty lawn only']);
  }
  if (pid === 'hobby-retail') {
    return base.concat(['plumbing tools', 'kitchen sink', 'car mechanic workshop only', 'engagement ring', 'coffee cart']);
  }
  return base;
}

/**
 * Build structured image briefs for active sections needing imagery.
 */
function buildStructuredImageBriefs({ brief, profile, foundation, sectionOrder, direction, contentHints }) {
  const avoid = avoidForProfile(profile);
  const industry = brief.industry || profile.industry;
  const briefs = [];
  const dir = direction || pickImageDirection(profile, foundation, 0);

  const heroSubjects = {
    'coffee-event': {
      subject: 'premium mobile coffee cart serving guests',
      setting: 'stylish outdoor corporate event',
      humanPresence: 'professional barista and guests',
      textOverlaySafeArea: 'left'
    },
    jewellery: {
      subject: 'luxury pink diamond engagement ring',
      setting: 'dark editorial jewellery display',
      humanPresence: 'minimal hands only',
      textOverlaySafeArea: 'left'
    },
    electrician: {
      subject: 'licensed electrician working on residential switchboard',
      setting: 'Australian suburban home',
      humanPresence: 'tradesperson at work',
      textOverlaySafeArea: 'left'
    },
    'commercial-lawyer': {
      subject: 'commercial lawyer in modern office meeting',
      setting: 'bright contemporary law firm',
      humanPresence: 'professionals in discussion',
      textOverlaySafeArea: 'right'
    },
    'hair-salon': {
      subject: 'hair stylist finishing a blowout in bright salon',
      setting: 'premium hair salon interior',
      humanPresence: 'stylist and client',
      textOverlaySafeArea: 'left'
    },
    'wedding-photographer': {
      subject: 'couple at golden-hour outdoor wedding',
      setting: 'romantic wedding venue garden',
      humanPresence: 'bride and groom',
      textOverlaySafeArea: 'left'
    },
    landscaping: {
      subject: 'luxury landscaped backyard with stone fire pit at dusk',
      setting: 'premium rural outdoor living space with hills beyond',
      humanPresence: 'empty finished yard lifestyle scene',
      textOverlaySafeArea: 'left'
    },
    'hobby-retail': {
      subject: 'remote control RC car racing on outdoor dirt track',
      setting: 'sunny multi-terrain RC track',
      humanPresence: 'enthusiast hands launching an RC buggy',
      textOverlaySafeArea: 'left'
    }
  };

  const hero = heroSubjects[profile.profileId] || {
    subject: brief.businessName + ' brand photography',
    setting: brief.location || 'local business setting',
    humanPresence: dir.humanPresence,
    textOverlaySafeArea: 'left'
  };

  if (sectionOrder.includes('hero') || sectionOrder.includes('heroSlider') || sectionOrder.includes('splitHero')) {
    const heroKey = sectionOrder.find((k) => ['hero', 'heroSlider', 'splitHero'].includes(k)) || 'hero';
    const heroSlideSubjects =
      heroKey === 'heroSlider'
        ? profile.profileId === 'landscaping'
          ? [
              hero.subject,
              'finished garden design with layered planting and pathways',
              'outdoor entertaining patio with seating and warm lighting'
            ]
          : [
              hero.subject,
              'second brand hero photography for ' + (brief.industry || 'the business'),
              'third lifestyle hero photography for ' + (brief.businessName || 'the brand')
            ]
        : [hero.subject];

    heroSlideSubjects.forEach((subject, idx) => {
      briefs.push(
        createImageBrief({
          imageBriefId: heroKey + '_slide_' + idx,
          sectionId: heroKey === 'heroSlider' ? heroKey + ':' + idx : heroKey,
          appId: heroKey,
          purpose: 'hero',
          subject,
          setting: hero.setting,
          industry,
          visualStyle: dir.label,
          photographyStyle: dir.photographyStyle,
          lighting: dir.lighting,
          colourDirection: dir.colourTemperature,
          orientation: 'landscape',
          targetAspectRatio: '16:9',
          minimumWidth: 1600,
          minimumHeight: 900,
          humanPresence: hero.humanPresence,
          textOverlaySafeArea: hero.textOverlaySafeArea,
          composition: dir.composition,
          avoidTerms: avoid,
          altTextIntent: subject
        })
      );
    });
  }

  if (sectionOrder.includes('featuredProjects')) {
    const gallerySubjects = {
      'coffee-event': [
        'wedding coffee service cart',
        'corporate branded barista bar',
        'festival coffee van service'
      ],
      jewellery: [
        'editorial engagement ring flatlay',
        'boutique jewellery consultation table',
        'pink diamond close-up on linen'
      ],
      electrician: [
        'clean residential electrical install',
        'service van at suburban home',
        'switchboard upgrade completed'
      ],
      'commercial-lawyer': [
        'modern law office meeting room',
        'solicitor reviewing contracts',
        'professional reception area'
      ],
      'hair-salon': [
        'salon colour consultation',
        'finished blowout portrait',
        'bright styling station mirrors'
      ],
      'wedding-photographer': [
        'wedding rings and florals detail',
        'documentary wedding dance floor',
        'outdoor ceremony portrait'
      ],
      landscaping: [
        'garden design and construction finished landscaping project',
        'retaining walls and hardscaping outdoor living',
        'turf irrigation and planted garden beds',
        'outdoor entertaining area with fire pit'
      ]
    };
    const list = gallerySubjects[profile.profileId] || [
      'brand photography highlight one',
      'brand photography highlight two',
      'brand photography highlight three'
    ];
    list.forEach((subject, idx) => {
      briefs.push(
        createImageBrief({
          imageBriefId: 'gallery_' + idx,
          sectionId: 'featuredProjects:' + idx,
          appId: 'featuredProjects',
          purpose: 'gallery',
          subject,
          setting: hero.setting,
          industry,
          visualStyle: dir.label,
          photographyStyle: dir.photographyStyle,
          lighting: dir.lighting,
          colourDirection: dir.colourTemperature,
          orientation: 'landscape',
          targetAspectRatio: '4:3',
          minimumWidth: 1200,
          minimumHeight: 800,
          humanPresence: dir.humanPresence,
          composition: dir.composition,
          avoidTerms: avoid,
          altTextIntent: subject
        })
      );
    });
  }

  if (sectionOrder.includes('trustBar')) {
    const trustSubjects =
      profile.profileId === 'landscaping'
        ? [
            'garden design construction project photography',
            'retaining wall hardscaping finished project',
            'outdoor living entertaining patio dusk',
            'fresh turf irrigation landscaped garden'
          ]
        : profile.profileId === 'jewellery'
          ? [
              'luxury jewellery private appointment setting',
              'editorial engagement ring display',
              'boutique jewellery consultation',
              'rare pink diamond close-up'
            ]
          : [
              'brand capability photography one',
              'brand capability photography two',
              'brand capability photography three',
              'brand capability photography four'
            ];
    trustSubjects.forEach((subject, idx) => {
      briefs.push(
        createImageBrief({
          imageBriefId: 'trust_' + idx,
          sectionId: 'trustBar:' + idx,
          appId: 'trustBar',
          purpose: 'gallery',
          subject,
          setting: hero.setting,
          industry,
          visualStyle: dir.label,
          photographyStyle: dir.photographyStyle,
          lighting: dir.lighting,
          colourDirection: dir.colourTemperature,
          orientation: 'landscape',
          targetAspectRatio: '4:3',
          minimumWidth: 1000,
          minimumHeight: 700,
          humanPresence: 'minimal',
          composition: dir.composition,
          avoidTerms: avoid,
          altTextIntent: subject
        })
      );
    });
  }

  if (sectionOrder.includes('crew')) {
    briefs.push(
      createImageBrief({
        sectionId: 'crew',
        appId: 'crew',
        purpose: 'team',
        subject: 'team portrait for ' + brief.businessName,
        setting: hero.setting,
        industry,
        visualStyle: dir.label,
        photographyStyle: dir.photographyStyle,
        orientation: 'portrait',
        targetAspectRatio: '3:4',
        minimumWidth: 800,
        minimumHeight: 1000,
        humanPresence: 'team members',
        avoidTerms: avoid,
        altTextIntent: 'Team at ' + brief.businessName
      })
    );
  }

  void contentHints;
  void foundation;
  return { direction: dir, briefs };
}

module.exports = {
  DIRECTION_PROFILES,
  pickImageDirection,
  buildStructuredImageBriefs
};
