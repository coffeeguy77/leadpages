/**
 * Resolve playground control paths to live site_config (v1) paths.
 * Handles legacy defs (crew.items → sections.crew.members, etc.).
 */
const SECTION_ITEM_KEYS = {
  featuredProjects: 'projects',
  projectFeed: 'items',
  jobsFeed: 'items',
  beforeAfterFeed: 'items',
  videoReels: 'items',
  activityTimeline: 'items',
  customerReactions: 'items',
  instaGallery: 'items',
  igProjectFeed: 'items'
};

const LIST_KEY = Object.assign({ items: 'items' }, SECTION_ITEM_KEYS);
LIST_KEY.crew = 'members';
LIST_KEY.trustBar = 'badges';
LIST_KEY.responseCards = 'cards';
LIST_KEY.serviceProcess = 'steps';
LIST_KEY.estimateBuilder = 'options';
LIST_KEY.serviceAreas = 'areas';
LIST_KEY.heroSlider = 'slides';

const SEGMENT_ALIASES = {
  items: null,
  name: null,
  bio: null,
  img: null,
  text: null,
  body: null,
  label: null,
  sub: null,
  before: null,
  after: null,
  headline: null,
  services: null,
  price: null,
  cta: null,
  expiry: null,
  type: null,
  accent: null
};

const PER_SECTION = {
  crew: { items: 'members', bio: 'detail', img: 'photo' },
  reviews: { name: 'who' },
  trustBar: { items: 'badges', text: 'label' },
  featuredProjects: { items: 'projects', img: 'image', type: 'tag' },
  beforeAfter: { label: 'title', before: 'beforeImage', after: 'afterImage' },
  responseCards: { items: 'cards', body: 'text' },
  certifications: { label: 'name', sub: 'body' },
  serviceProcess: { body: 'text' },
  estimateBuilder: { services: 'options', price: 'min' },
  heroSlider: { headline: 'heading', sub: 'subText' },
  specialOffer: { body: 'intro', cta: 'ctaText', expiry: 'intro' },
  finance: { body: 'description', options: null }
};

function aliasSegment(sectionKey, seg) {
  const map = PER_SECTION[sectionKey];
  if (map && Object.prototype.hasOwnProperty.call(map, seg)) {
    return map[seg];
  }
  return seg;
}

function normalizePlaygroundPath(sectionKey, key) {
  if (!key) return key;
  if (key.startsWith('theme.')) return key;

  let path = key;
  if (sectionKey === 'services' && /^services\.\d+\./.test(path)) {
    return path;
  }

  if (!path.startsWith('sections.')) {
    if (path.startsWith(sectionKey + '.')) {
      path = 'sections.' + path;
    } else if (path.indexOf('.') < 0) {
      path = 'sections.' + sectionKey + '.' + path;
    }
  }

  const parts = path.split('.');
  if (parts[0] === 'sections' && parts[1] === sectionKey) {
    const listKey = LIST_KEY[sectionKey] || 'items';
    if (parts[2] === 'items' && listKey !== 'items') {
      parts[2] = listKey;
    }
    for (let i = 2; i < parts.length; i++) {
      const mapped = aliasSegment(sectionKey, parts[i]);
      if (mapped === null) {
        parts.splice(i, 1);
        i--;
        continue;
      }
      if (mapped !== parts[i]) parts[i] = mapped;
    }
    if (sectionKey === 'featuredProjects' && parts[parts.length - 1] === 'accent') {
      parts.pop();
      parts.push('cardBg');
    }
  }

  return parts.join('.');
}

function fixFieldDef(sectionKey, field) {
  const out = Object.assign({}, field);
  out.key = normalizePlaygroundPath(sectionKey, field.key);
  if (sectionKey === 'serviceAreas' && field.key && field.key.indexOf('areas') >= 0 && field.join) {
    out.getTransform = 'areaNames';
    out.setTransform = 'areaNames';
  }
  return out;
}

function fixAllFieldDefs(all) {
  const out = {};
  Object.keys(all || {}).forEach(function(sectionKey) {
    out[sectionKey] = (all[sectionKey] || []).map(function(f) {
      return fixFieldDef(sectionKey, f);
    });
  });
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizePlaygroundPath,
    fixFieldDef,
    fixAllFieldDefs,
    LIST_KEY,
    PER_SECTION
  };
}
if (typeof window !== 'undefined') {
  window.LPPlaygroundFieldPaths = {
    normalizePlaygroundPath: normalizePlaygroundPath
  };
}
