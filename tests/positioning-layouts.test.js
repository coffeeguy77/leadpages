/**
 * Positioning layout apply modes + identity protection.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  applyPositioningLayout,
  captureLayoutFromConfig,
  mergeSectionPack
} = require('../lib/positioning-layouts');
const { resolveSectionOrder, pinTrustBarUnderHero } = require('../lib/section-order');

test('pinTrustBarUnderHero always places trustBar directly under first hero', function() {
  const a = pinTrustBarUnderHero(['emerg', 'hero', 'services', 'trustBar', 'faq']);
  assert.deepEqual(a.slice(0, 4), ['emerg', 'hero', 'trustBar', 'services']);

  const b = pinTrustBarUnderHero(['heroSlider', 'services', 'trustBar']);
  assert.deepEqual(b.slice(0, 3), ['heroSlider', 'trustBar', 'services']);

  const c = pinTrustBarUnderHero(['services', 'faq']);
  assert.equal(c[0], 'trustBar');
});

test('resolveSectionOrder pins trustBar under hero when trust bar is on', function() {
  const cfg = {
    sectionOrder: ['emerg', 'hero', 'instaGallery', 'trustBar', 'services', 'faq'],
    sections: {
      emerg: {}, hero: {}, instaGallery: { on: true }, trustBar: {}, services: {}, faq: {}
    }
  };
  const ord = resolveSectionOrder(cfg);
  assert.ok(ord.indexOf('hero') >= 0);
  assert.equal(ord.indexOf('trustBar'), ord.indexOf('hero') + 1);
  assert.ok(ord.indexOf('instaGallery') > ord.indexOf('trustBar'));
});

test('structure mode only changes order and on flags', function() {
  const cfg = {
    businessName: 'Acme Surfing',
    phone: '0400 000 000',
    sectionOrder: ['hero', 'services', 'faq'],
    sections: {
      hero: { heading: 'Keep my heading', on: true },
      services: { title: 'My services' },
      faq: {},
      trustBar: { badges: [{ label: 'Mine' }] },
      heroSlider: { on: false, slides: [] }
    }
  };
  const layout = {
    section_order: ['hero', 'trustBar', 'heroSlider', 'services', 'faq'],
    apps: [
      { section_key: 'hero', enabled: true },
      { section_key: 'trustBar', enabled: true },
      { section_key: 'heroSlider', enabled: true },
      { section_key: 'services', enabled: true },
      { section_key: 'faq', enabled: true }
    ],
    demo_packs: {
      heroSlider: {
        slides: [{ heading: 'Surf school', image: 'https://res.cloudinary.com/demo/surf.jpg' }]
      },
      hero: { heading: 'SHOULD NOT APPLY' }
    }
  };
  const r = applyPositioningLayout(cfg, layout, { mode: 'structure' });
  assert.equal(r.config.businessName, 'Acme Surfing');
  assert.equal(r.config.phone, '0400 000 000');
  assert.equal(r.config.sections.hero.heading, 'Keep my heading');
  assert.equal(r.config.sections.heroSlider.on, true);
  assert.deepEqual(r.config.sections.heroSlider.slides, []);
  // trust under first hero-like in order (hero comes before heroSlider in layout)
  const ord = r.config.sectionOrder;
  const heroIdxs = ['hero', 'heroSlider', 'heroBeforeAfter', 'splitHero']
    .map(function(k) { return ord.indexOf(k); })
    .filter(function(i) { return i >= 0; });
  const hi = Math.min.apply(null, heroIdxs);
  assert.equal(ord.indexOf('trustBar'), hi + 1);
});

test('fill_empty fills blank pack fields only', function() {
  const cfg = {
    sections: {
      heroSlider: {
        on: true,
        slides: [{ heading: 'Existing slide', image: 'https://mine.jpg' }]
      },
      trustBar: { badges: [] }
    },
    sectionOrder: ['heroSlider', 'trustBar']
  };
  const layout = {
    section_order: ['heroSlider', 'trustBar'],
    apps: [
      { section_key: 'heroSlider', enabled: true },
      { section_key: 'trustBar', enabled: true }
    ],
    demo_packs: {
      heroSlider: {
        slides: [{ heading: 'Surf', image: 'https://cloudinary/surf.jpg' }],
        eyebrow: 'Learn to surf'
      },
      trustBar: { badges: [{ label: 'Licensed' }, { label: 'Insured' }] }
    }
  };
  const r = applyPositioningLayout(cfg, layout, { mode: 'fill_empty' });
  assert.equal(r.config.sections.heroSlider.slides[0].heading, 'Existing slide');
  assert.equal(r.config.sections.heroSlider.eyebrow, 'Learn to surf');
  assert.equal(r.config.sections.trustBar.badges.length, 2);
});

test('demo_replace overwrites section content but protects identity', function() {
  const cfg = {
    businessName: 'Keep Me',
    phone: '0411 111 111',
    sections: {
      hero: { heading: 'Old', phone: '0411 111 111' },
      heroSlider: {
        on: true,
        slides: [{ heading: 'Old slide' }]
      }
    },
    sectionOrder: ['hero', 'heroSlider']
  };
  const layout = {
    section_order: ['heroSlider', 'trustBar'],
    apps: [
      { section_key: 'heroSlider', enabled: true },
      { section_key: 'trustBar', enabled: true },
      { section_key: 'hero', enabled: false }
    ],
    demo_packs: {
      heroSlider: {
        slides: [{ heading: 'Surf school', image: 'https://res.cloudinary.com/x/surf.jpg' }]
      },
      hero: { heading: 'New hero', phone: '0999' }
    }
  };
  const r = applyPositioningLayout(cfg, layout, { mode: 'demo_replace' });
  assert.equal(r.config.businessName, 'Keep Me');
  assert.equal(r.config.phone, '0411 111 111');
  assert.equal(r.config.sections.heroSlider.slides[0].heading, 'Surf school');
  assert.equal(r.config.sections.hero.phone, '0411 111 111'); // identity section key protected
  assert.equal(r.config.sections.hero.on, false);
});

test('captureLayoutFromConfig snapshots order and optional packs', function() {
  const cfg = {
    sectionOrder: ['hero', 'services', 'trustBar', 'faq'],
    sections: {
      hero: { heading: 'Hi', phone: '0400' },
      trustBar: { badges: [{ label: 'A' }] },
      services: { title: 'S' },
      faq: { items: [{ q: 'Q', a: 'A' }] }
    }
  };
  const draft = captureLayoutFromConfig(cfg, {
    name: 'Classic trade',
    includeDemoPacks: true,
    packKeys: ['hero', 'trustBar']
  });
  assert.equal(draft.name, 'Classic trade');
  assert.equal(draft.section_order.indexOf('trustBar'), draft.section_order.indexOf('hero') + 1);
  assert.ok(draft.demo_packs.hero);
  assert.equal(draft.demo_packs.hero.heading, 'Hi');
  assert.equal(draft.demo_packs.hero.phone, undefined); // stripped
  assert.ok(draft.demo_packs.trustBar.badges);
});

test('mergeSectionPack fill_empty skips non-empty', function() {
  const out = mergeSectionPack(
    { title: 'Keep', body: '' },
    { title: 'New', body: 'Filled' },
    'why',
    'fill_empty'
  );
  assert.equal(out.title, 'Keep');
  assert.equal(out.body, 'Filled');
});
