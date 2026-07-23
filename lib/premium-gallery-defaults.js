'use strict';

/**
 * Premium Gallery (premiumGallery) — defaults + sample content for v1.
 * Photography-first marketplace gallery: simple / filtered / categories / albums.
 */

const SAMPLE_IMAGES = [
  {
    id: 'pg-img-1',
    on: true,
    src: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&h=800&fit=crop&q=80',
    alt: 'Modern open-plan living space',
    title: 'Open-plan living',
    caption: '',
    orientation: 'landscape',
    ratio: 1.5,
    categoryId: 'cat-extensions',
    albumId: 'alb-living',
    tags: ['Modern', 'Residential'],
    featured: true,
    size: 'wide'
  },
  {
    id: 'pg-img-2',
    on: true,
    src: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&h=1200&fit=crop&q=80',
    alt: 'Ensuite with freestanding bath',
    title: 'Ensuite bath',
    caption: '',
    orientation: 'portrait',
    ratio: 0.67,
    categoryId: 'cat-bathrooms',
    albumId: 'alb-ensuite',
    tags: ['Luxury', 'Residential'],
    featured: false,
    size: 'tall'
  },
  {
    id: 'pg-img-3',
    on: true,
    src: 'https://images.unsplash.com/photo-1556912173-46c336c7fd55?w=1200&h=900&fit=crop&q=80',
    alt: 'Kitchen with island bench',
    title: 'Island kitchen',
    caption: '',
    orientation: 'landscape',
    ratio: 1.33,
    categoryId: 'cat-kitchens',
    albumId: 'alb-kitchen',
    tags: ['Modern', 'Residential'],
    featured: true,
    size: 'large'
  },
  {
    id: 'pg-img-4',
    on: true,
    src: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=900&h=900&fit=crop&q=80',
    alt: 'Detail of timber joinery',
    title: 'Timber detail',
    caption: '',
    orientation: 'square',
    ratio: 1,
    categoryId: 'cat-kitchens',
    albumId: 'alb-kitchen',
    tags: ['Luxury'],
    featured: false,
    size: 'standard'
  },
  {
    id: 'pg-img-5',
    on: true,
    src: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1600&h=700&fit=crop&q=80',
    alt: 'Wide view of landscaped courtyard',
    title: 'Courtyard panorama',
    caption: '',
    orientation: 'panoramic',
    ratio: 2.28,
    categoryId: 'cat-outdoor',
    albumId: 'alb-outdoor',
    tags: ['Outdoor', 'Residential'],
    featured: true,
    size: 'full'
  },
  {
    id: 'pg-img-6',
    on: true,
    src: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&h=1100&fit=crop&q=80',
    alt: 'Family bathroom vanity',
    title: 'Family bathroom',
    caption: '',
    orientation: 'portrait',
    ratio: 0.73,
    categoryId: 'cat-bathrooms',
    albumId: 'alb-family',
    tags: ['Modern', 'Small Space'],
    featured: false,
    size: 'tall'
  },
  {
    id: 'pg-img-7',
    on: true,
    src: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&h=800&fit=crop&q=80',
    alt: 'Living room with natural light',
    title: 'Natural light living',
    caption: '',
    orientation: 'landscape',
    ratio: 1.5,
    categoryId: 'cat-extensions',
    albumId: 'alb-living',
    tags: ['Modern', 'Residential'],
    featured: false,
    size: 'standard'
  },
  {
    id: 'pg-img-8',
    on: true,
    src: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1000&h=750&fit=crop&q=80',
    alt: 'Outdoor entertaining deck',
    title: 'Entertaining deck',
    caption: '',
    orientation: 'landscape',
    ratio: 1.33,
    categoryId: 'cat-outdoor',
    albumId: 'alb-outdoor',
    tags: ['Outdoor', 'Luxury'],
    featured: false,
    size: 'wide'
  },
  {
    id: 'pg-img-9',
    on: true,
    src: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=900&h=1200&fit=crop&q=80',
    alt: 'Kitchen shelving detail',
    title: 'Open shelving',
    caption: '',
    orientation: 'portrait',
    ratio: 0.75,
    categoryId: 'cat-kitchens',
    albumId: 'alb-kitchen',
    tags: ['Modern'],
    featured: false,
    size: 'tall'
  },
  {
    id: 'pg-img-10',
    on: true,
    src: 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=1200&h=800&fit=crop&q=80',
    alt: 'Spa-style bathroom',
    title: 'Spa bathroom',
    caption: '',
    orientation: 'landscape',
    ratio: 1.5,
    categoryId: 'cat-bathrooms',
    albumId: 'alb-ensuite',
    tags: ['Luxury', 'Accessible'],
    featured: false,
    size: 'standard'
  },
  {
    id: 'pg-img-11',
    on: true,
    src: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdbc?w=1100&h=900&fit=crop&q=80',
    alt: 'Extension exterior at dusk',
    title: 'Dusk exterior',
    caption: '',
    orientation: 'landscape',
    ratio: 1.22,
    categoryId: 'cat-extensions',
    albumId: 'alb-living',
    tags: ['Residential'],
    featured: false,
    size: 'standard'
  },
  {
    id: 'pg-img-12',
    on: true,
    src: 'https://images.unsplash.com/photo-1416331108676-a22ccb276e35?w=900&h=900&fit=crop&q=80',
    alt: 'Stone path through garden',
    title: 'Garden path',
    caption: '',
    orientation: 'square',
    ratio: 1,
    categoryId: 'cat-outdoor',
    albumId: 'alb-outdoor',
    tags: ['Outdoor'],
    featured: false,
    size: 'standard'
  }
];

const SAMPLE_CATEGORIES = [
  {
    id: 'cat-bathrooms',
    on: true,
    name: 'Bathrooms',
    eyebrow: 'Renovations',
    intro: 'Ensuites, family bathrooms and accessible upgrades.',
    cover: SAMPLE_IMAGES[1].src,
    slug: 'bathrooms',
    badge: ''
  },
  {
    id: 'cat-kitchens',
    on: true,
    name: 'Kitchens',
    eyebrow: 'Renovations',
    intro: 'Island benches, joinery and lighting that make the room work harder.',
    cover: SAMPLE_IMAGES[2].src,
    slug: 'kitchens',
    badge: ''
  },
  {
    id: 'cat-extensions',
    on: true,
    name: 'Extensions',
    eyebrow: 'Additions',
    intro: 'Light-filled living spaces and open-plan connections.',
    cover: SAMPLE_IMAGES[0].src,
    slug: 'extensions',
    badge: ''
  },
  {
    id: 'cat-outdoor',
    on: true,
    name: 'Outdoor Living',
    eyebrow: 'Exteriors',
    intro: 'Decks, courtyards and landscaped entertaining zones.',
    cover: SAMPLE_IMAGES[4].src,
    slug: 'outdoor-living',
    badge: ''
  }
];

const SAMPLE_ALBUMS = [
  {
    id: 'alb-ensuite',
    on: true,
    categoryId: 'cat-bathrooms',
    title: 'Yarralumla Ensuite',
    eyebrow: 'Bathroom',
    intro: 'A calm ensuite with freestanding bath and soft lighting.',
    location: 'Yarralumla, ACT',
    cover: SAMPLE_IMAGES[1].src,
    slug: 'yarralumla-ensuite',
    featured: true,
    tags: ['Luxury']
  },
  {
    id: 'alb-family',
    on: true,
    categoryId: 'cat-bathrooms',
    title: 'Gungahlin Family Bathroom',
    eyebrow: 'Bathroom',
    intro: 'Practical family bathroom with durable finishes.',
    location: 'Gungahlin, ACT',
    cover: SAMPLE_IMAGES[5].src,
    slug: 'gungahlin-family-bathroom',
    featured: false,
    tags: ['Modern', 'Small Space']
  },
  {
    id: 'alb-kitchen',
    on: true,
    categoryId: 'cat-kitchens',
    title: 'Red Hill Kitchen',
    eyebrow: 'Kitchen',
    intro: 'Island bench, open shelving and integrated appliances.',
    location: 'Red Hill, ACT',
    cover: SAMPLE_IMAGES[2].src,
    slug: 'red-hill-kitchen',
    featured: true,
    tags: ['Modern']
  },
  {
    id: 'alb-living',
    on: true,
    categoryId: 'cat-extensions',
    title: 'Campbell Living Extension',
    eyebrow: 'Extension',
    intro: 'Open-plan living that opens to the garden.',
    location: 'Campbell, ACT',
    cover: SAMPLE_IMAGES[0].src,
    slug: 'campbell-living-extension',
    featured: true,
    tags: ['Residential']
  },
  {
    id: 'alb-outdoor',
    on: true,
    categoryId: 'cat-outdoor',
    title: 'Forrest Entertaining Deck',
    eyebrow: 'Outdoor',
    intro: 'Hardwood deck and courtyard for year-round entertaining.',
    location: 'Forrest, ACT',
    cover: SAMPLE_IMAGES[7].src,
    slug: 'forrest-entertaining-deck',
    featured: false,
    tags: ['Outdoor', 'Luxury']
  }
];

const DEFAULT_PREMIUM_GALLERY = {
  on: false,
  structureMode: 'simple',
  eyebrow: 'Our work',
  heading: 'A gallery of completed projects',
  intro:
    'Browse a selection of recent work — mixed portrait and landscape photography arranged for a premium finish.',
  supporting: '',
  badge: '',
  headerLayout: 'centred',
  showEyebrow: true,
  showTitle: true,
  showIntro: true,
  showSupporting: false,
  showBadge: false,
  showCount: true,
  showBreadcrumb: true,
  showBack: true,
  showCta: false,
  ctaText: 'Get a quote',
  ctaAction: 'quote',
  coverImage: '',
  layout: 'smart-mosaic',
  density: 'balanced',
  imageSize: 'standard',
  ratio: 'original',
  columnsDesktop: 4,
  columnsTablet: 3,
  columnsMobile: 2,
  gap: 12,
  radius: 12,
  hover: 'zoom',
  overlay: 'bottom-gradient',
  loadMoreCount: 16,
  lightboxOn: true,
  lightboxStyle: 'dark',
  lightboxCaptions: true,
  lightboxThumbnails: true,
  lightboxZoom: true,
  lightboxDownloads: false,
  filtersEnabled: true,
  filterStyle: 'pills',
  filterSource: 'tags',
  filterMultiple: false,
  showAllTab: true,
  showFilterCounts: false,
  autoplay: false,
  autoplayDelay: 5000,
  cardLayout: 'overlay',
  smartPreset: 'dynamic',
  mosaicLocked: true,
  mosaicSeed: 7,
  mosaicRandomize: 'locked', // locked | once | every-load
  mosaicLayout: [],
  collageRotation: 4,
  collageOverlap: 12,
  virtualizeAt: 48,
  urlMode: 'hash', // none | hash | query | path
  seoTitle: '',
  seoDescription: '',
  seoIndex: true,
  analyticsOn: true,
  eyebrowColor: '',
  titleColor: '',
  introColor: '',
  captionColor: '',
  filterColor: '',
  activeFilterColor: '',
  badgeBg: '',
  badgeText: '',
  categories: SAMPLE_CATEGORIES,
  albums: SAMPLE_ALBUMS,
  images: SAMPLE_IMAGES
};

function cloneDefaultPremiumGallery() {
  return JSON.parse(JSON.stringify(DEFAULT_PREMIUM_GALLERY));
}

const {
  SMART_PRESETS,
  getSmartPreset,
  applySmartPreset,
  regenerateMosaicLayout
} = require('./premium-gallery-presets');

module.exports = {
  SAMPLE_IMAGES,
  SAMPLE_CATEGORIES,
  SAMPLE_ALBUMS,
  DEFAULT_PREMIUM_GALLERY,
  cloneDefaultPremiumGallery,
  SMART_PRESETS,
  getSmartPreset,
  applySmartPreset,
  regenerateMosaicLayout
};
