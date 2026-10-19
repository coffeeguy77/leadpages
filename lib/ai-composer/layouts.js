'use strict';

/**
 * AI Composer layout catalogue — every alternative layout the editor offers for the
 * apps the composer places, so the design plan can pick the layout that matches the
 * design instead of always using an app's default look.
 *
 * Source of truth for the layouts themselves is the editor (manage.html
 * LPL_LAYOUT_SPECS, #svc-mode, #tb-mode, #pg-layout) and assets/lp-layouts.js.
 * tests/ai-composer-layout-catalogue.test.js fails when the editor offers a layout
 * value that is neither listed here nor in NOT_OFFERED, so the two cannot drift.
 *
 * Per app:
 *   path      config path the chosen variant's value is written to
 *   variants  [{ id, value, looks, use, tone?, side?, fields?, lists? }]
 *     id      what the model returns (the first variant is the app default)
 *     value   written to `path` ('' = the editor's default)
 *     looks   what it looks like; use = when to pick it (both go in the plan prompt)
 *     tone    { path, values } — background tones the variant supports
 *             (plan tone ids: page | soft | tint | dark | brand → value via `values`)
 *     side    { path, left, right } — value for "photo on the left / right"
 *     fields  extra copy/image fields only this variant reads (catalogue def format)
 *     lists   extra list fields only this variant reads (catalogue def format, ".0." paths)
 */

const TONES_4 = { page: '', soft: 'soft', tint: 'tint', dark: 'dark' };

const LAYOUTS = {
  heroSlider: {
    path: 'sections.heroSlider.layout',
    variants: [
      { id: 'slider', value: '', looks: 'full-width photo behind the headline, text over the photo (one or more slides)', use: 'the hero headline sits ON TOP of a big photo' },
      {
        id: 'split', value: 'split',
        looks: 'headline, text and buttons on one side, a large photo on the other half (no text over the photo)',
        use: 'the hero shows text and photo SIDE BY SIDE',
        tone: { path: 'sections.heroSlider.splitTone', values: TONES_4 },
        side: { path: 'sections.heroSlider.splitSide', left: 'left', right: '' }
      },
      { id: 'half', value: 'half', looks: 'short half-height photo banner with eyebrow, title and intro', use: 'a slim banner hero rather than a tall one (common on inner pages)' },
      {
        id: 'booking', value: 'booking',
        looks: 'headline and photo beside a booking calendar card',
        use: 'the hero has a date-picker / calendar card for bookings',
        fields: [
          { type: 'text', key: 'sections.heroSlider.bookTitle', label: 'Calendar card heading' },
          { type: 'text', key: 'sections.heroSlider.bookNote', label: 'Small print under the card button' },
          { type: 'text', key: 'sections.heroSlider.imageCaption', label: 'Caption under the photo' }
        ]
      }
    ]
  },

  services: {
    path: 'sections.services.mode',
    variants: [
      { id: 'grid', value: 'grid', looks: 'white bordered cards, each with a SMALL square thumbnail at the top-left, a capitalised title and text', use: 'service cards with small pictures or none' },
      { id: 'cards', value: 'cards', looks: 'centred heading, then cards whose photo fills the whole top of the card, with a small title and text underneath', use: 'cards with a big photo filling the top of each card' },
      {
        id: 'photo', value: 'photo', looks: 'heading above cards that each show a large photo, then the title and text; the whole card is a link; optional heading-left / intro-right',
        use: 'cards dominated by a large photo with the title and text below',
        fields: [{ type: 'text', key: 'sections.services.photoLinkLabel', label: 'Text link under the cards (only if shown)' }]
      },
      {
        id: 'numbered', value: 'numbered', looks: 'eyebrow + heading on the left and intro text on the right, then columns each with a big number (01, 02…), a title, text and a photo underneath',
        use: 'the service columns are visibly numbered 01 / 02 / 03',
        fields: [{ type: 'text', key: 'sections.services.numLinkLabel', label: 'Text link under the cards (only if shown)' }]
      },
      { id: 'split', value: 'split', looks: 'heading (with a short brand underline) on the left; on the right, cards with a small picture, title and an outlined "Learn more" button', use: 'a heading column beside compact service cards with buttons' },
      { id: 'iconrow', value: 'iconrow', looks: 'a dark band with a row of small icons or pictures, each with a title and one short line', use: 'a dark row of icon + title + short line items' },
      { id: 'tick', value: 'tick', looks: 'a dark (or light) band of white cards, each with a small photo on the left, title, text and a tick mark', use: 'cards that show what is included, each with a tick' },
      {
        id: 'feature', value: 'feature', looks: 'one big photo on one side; heading, intro and icon points (icon, title, text) on the other',
        use: 'one large photo beside a list of icon points',
        tone: { path: 'sections.services.featureTone', values: TONES_4 },
        side: { path: 'sections.services.featureSide', left: '', right: 'right' },
        fields: [
          { type: 'image', key: 'sections.services.featureImage', label: 'The big photo' },
          { type: 'text', key: 'sections.services.featureCaption', label: 'Caption under the photo (only if shown)' }
        ],
        lists: [
          { type: 'icon', key: 'sections.services.featureItems.0.icon', label: 'Point icon' },
          { type: 'text', key: 'sections.services.featureItems.0.title', label: 'Point title' },
          { type: 'textarea', key: 'sections.services.featureItems.0.text', label: 'Point text' },
          { type: 'text', key: 'sections.services.featureItems.5.title', label: 'Point title' }
        ]
      },
      {
        id: 'story', value: 'story', looks: 'heading, text and a link on one side, one large photo on the other (no cards)',
        use: 'a single photo beside a short story-style text with a link',
        tone: { path: 'sections.services.storyTone', values: TONES_4 },
        side: { path: 'sections.services.storySide', left: 'left', right: '' },
        fields: [
          { type: 'image', key: 'sections.services.storyImage', label: 'The photo' },
          { type: 'text', key: 'sections.services.storyLinkLabel', label: 'Link text (only if shown)' }
        ]
      }
    ]
  },

  trustBar: {
    path: 'sections.trustBar.mode',
    variants: [
      { id: 'badges', value: 'badges', looks: 'a slim band with one centred line of small icon + label badges', use: 'a slim strip of short credentials (often on a grey or dark band)' },
      {
        id: 'stacked', value: 'stacked', looks: 'a taller band where each item shows a larger line icon ABOVE its spaced capital label, with thin dividers between',
        use: 'icons stacked over their labels in a band',
        tone: { path: 'sections.trustBar.stackTone', values: TONES_4 }
      }
    ]
  },

  textBox: {
    path: 'sections.textBox.layout',
    variants: [
      { id: 'standard', value: '', looks: 'text with a modest rounded photo beside it, inside the page width', use: 'an ordinary text block with a smaller photo' },
      {
        id: 'bleed', value: 'bleed', looks: 'text on one side, a large photo filling the other half of the section right to the page edge',
        use: 'text beside a photo that runs off the edge of the page',
        tone: { path: 'sections.textBox.bleedTone', values: TONES_4 },
        side: { path: 'sections.textBox.imageSide', left: 'left', right: 'right' }
      },
      {
        id: 'band', value: 'band', looks: 'a solid brand-colour band: large white heading, text, a grid of "Label: value" spec rows, ticks, a button, and a photo or a 3D box drawing with dimensions on the right',
        use: 'a solid brand-coloured or dark band of text with specs/ticks (e.g. vehicle or product specs)',
        tone: { path: 'sections.textBox.bandTone', values: { brand: '', dark: 'dark' } },
        fields: [
          { type: 'text', key: 'sections.textBox.dimLength', label: 'Box drawing: length (e.g. 4.2m) — only when the design shows a box/dimension drawing' },
          { type: 'text', key: 'sections.textBox.dimWidth', label: 'Box drawing: width (e.g. 2.1m)' },
          { type: 'text', key: 'sections.textBox.dimHeight', label: 'Box drawing: height (e.g. 2.1m)' },
          { type: 'text', key: 'sections.textBox.dimLift', label: 'Box drawing: tail-lift label (e.g. 500kg tail-lift)' }
        ]
      }
    ]
  },

  reviews: {
    path: 'sections.reviews.layout',
    variants: [
      {
        id: 'cards', value: '', looks: 'review cards', use: 'reviews shown as cards',
        tone: { path: 'sections.reviews.theme', values: { page: '', dark: 'dark' } }
      },
      { id: 'quotes', value: 'quotes', looks: 'large quote text under a brand line, no cards', use: 'one or two big quotes rather than cards' }
    ]
  },

  serviceProcess: {
    path: 'sections.serviceProcess.layout',
    variants: [
      { id: 'standard', value: '', looks: 'heading above a row of steps, each with a small filled number circle, title and short text, arrows between steps', use: 'steps with small circled numbers and arrows' },
      { id: 'numbered', value: 'numbered', looks: 'heading above a row of steps, each with a BIG plain number (1, 2 / 01, 02) over a thin brand-coloured line, title and text, thin dividers between steps; optional photo with a callout card', use: 'big numbers above each step, often joined by a line' },
      {
        id: 'journey', value: 'journey', looks: 'heading and intro on the left; on the right, steps in a row (optional line icon, spaced-capital name, short text) joined by arrows; often on a soft or tinted band',
        use: 'steps with arrows between them beside a heading',
        tone: { path: 'sections.serviceProcess.journeyTone', values: TONES_4 }
      },
      {
        id: 'milestone', value: 'milestone', looks: 'a giant figure (e.g. a year like 1990) on the left, heading, intro and link on the right — the steps themselves are NOT shown',
        use: 'one large number or year with a short statement, not a list of steps',
        tone: { path: 'sections.serviceProcess.journeyTone', values: TONES_4 },
        fields: [{ type: 'text', key: 'sections.serviceProcess.msFigure', label: 'The big figure (e.g. 1990)' }]
      }
    ]
  },

  faq: {
    path: 'sections.faq.layout',
    variants: [
      { id: 'standard', value: '', looks: 'heading above the questions', use: 'questions under the heading' },
      { id: 'split', value: 'split', looks: 'heading on the left, questions on the right', use: 'heading column beside the questions' }
    ]
  },

  specialOffer: {
    path: 'sections.specialOffer.layout',
    variants: [
      { id: 'card', value: '', looks: 'a full-width solid brand-colour band with a centred eyebrow, big capital headline, short points and a centred button', use: 'a coloured call-to-action band with no photo' },
      { id: 'banner', value: 'banner', looks: 'a wide rounded band over a photo with a dark overlay: eyebrow, headline and details on the left, button on the right', use: 'a call-to-action or featured project over a full-width photo' }
    ]
  },

  aboutUs: {
    path: 'sections.aboutUs.layout',
    variants: [
      { id: 'story', value: 'story', looks: 'story text split into three columns (no single large photo)', use: 'multi-column about text only — a text block beside one big photo is textBox instead' },
      { id: 'location', value: 'location', looks: 'address, opening hours, map and a premises photo', use: 'a location / contact block' }
    ]
  },

  activityCounter: {
    path: 'sections.activityCounter.style',
    variants: [
      { id: 'counters', value: '', looks: 'big counting figures', use: 'large stats' },
      { id: 'strip', value: 'strip', looks: 'compact row of icon + figure + label', use: 'a slim spec strip' }
    ]
  },

  featuredProjects: {
    path: 'sections.featuredProjects.layout',
    variants: [
      { id: 'grid', value: '', looks: 'rounded white cards: photo with a small coloured tag badge on it, bold capital title underneath', use: 'project tiles with a category tag' },
      { id: 'cards', value: 'cards', looks: 'frameless photo cards: photo, then the title with an arrow and a short line of text under it', use: 'photo cards each with a title, arrow and a short subtitle' }
    ]
  },

  bookingStorefront: {
    path: 'sections.bookingStorefront.layout',
    variants: [
      { id: 'hire', value: 'hire', looks: 'a white booking card with pick-up date, time and hire duration fields and a "Check availability" button, short points underneath and optional price cards beside it', use: 'a booking / availability bar with input fields' },
      { id: 'priceweek', value: 'priceweek', looks: 'a heading and a row of seven day cards (Monday … Sunday), each with its price per day, weekend days highlighted, short points underneath', use: 'a "price depends on the day" table of daily prices' }
    ]
  },

  footer: {
    path: 'sections.footer.layout',
    variants: [
      { id: 'standard', value: '', looks: 'logo and blurb, link columns and a contact box, then a bottom bar', use: 'a full footer with columns' },
      { id: 'minimal', value: 'minimal', looks: 'one slim bar: logo on the left and a short line of text', use: 'a single slim footer bar with just the logo and a line of text' }
    ]
  },

  premiumGallery: {
    path: 'sections.premiumGallery.layout',
    variants: [
      { id: 'smart-mosaic', value: 'smart-mosaic', looks: 'mosaic of mixed tile sizes', use: 'a varied photo mosaic' },
      { id: 'grid', value: 'grid', looks: 'uniform grid of equal tiles', use: 'equal square/rectangular photo tiles' },
      { id: 'masonry', value: 'masonry', looks: 'natural masonry columns', use: 'photos of different heights in columns' },
      { id: 'justified', value: 'justified', looks: 'justified rows of equal height', use: 'rows of photos of equal height' },
      { id: 'filmstrip', value: 'filmstrip', looks: 'a sideways-scrolling strip', use: 'one scrolling row of photos' },
      { id: 'slideshow', value: 'slideshow', looks: 'one large photo at a time', use: 'a single large photo with arrows' }
    ]
  }
};

/**
 * Layout values the editor offers that the composer deliberately does not pick
 * (they need data the design cannot provide, or extra fields not yet mapped).
 * Listed so the drift test knows they were considered.
 */
const NOT_OFFERED = {
  trustBar: ['images', 'sideCards'],               // image tiles / side cards need per-tile titles + info text
  premiumGallery: ['random-mosaic', 'editorial', 'feature-grid', 'stacked', 'collage'],
  bookingStorefront: [''],                          // the call-to-action layout needs Bookings set up
  mapHours: ['', 'bleed'], orderStorefront: ['', 'editorial'],
  storyTimeline: ['', 'alternate', 'rail', 'cards'], ctaBanner: ['', 'boxes'] // excluded apps
};

/**
 * Site-wide style the plan reads from the design (fonts, buttons, header, light/dark
 * bands). Font sets are /assets/lp-fonts.js; button shapes are lp-layouts.js BTN_RADIUS.
 */
const FONT_SETS = {
  classic: 'condensed bold CAPITAL headings (Barlow Condensed) — the trade default',
  archivo: 'extra-condensed heavy headings in normal case (Archivo)',
  oswald: 'tall condensed CAPITAL headings (Oswald) with a clean body font',
  bebas: 'poster-style tall CAPITAL headings (Bebas Neue)',
  montserrat: 'modern geometric bold sans-serif headings in normal case (Montserrat), clean body text',
  poppins: 'rounded friendly sans-serif throughout (Poppins)',
  space: 'techy grotesk headings (Space Grotesk)',
  playfair: 'elegant high-contrast SERIF headings (Playfair Display)',
  heritage: 'classic serif headings with small tracked capitals (Newsreader + Jost)'
};
const BUTTON_SHAPES = ['square', 'rounded', 'pill'];

function getLayouts(appKey) { return LAYOUTS[appKey] || null; }

/** The variant for an id (or null). */
function getVariant(appKey, id) {
  const L = LAYOUTS[appKey];
  if (!L) return null;
  return L.variants.find(function (v) { return v.id === String(id || ''); }) || null;
}

/** Fields (scalars + list fields) a variant adds, tagged with the variant id. */
function variantFieldDefs(appKey) {
  const L = LAYOUTS[appKey];
  if (!L) return [];
  const out = [];
  L.variants.forEach(function (v) {
    (v.fields || []).concat(v.lists || []).forEach(function (d) {
      out.push(Object.assign({}, d, { onlyFor: v.id }));
    });
  });
  return out;
}

/** Tone ids a variant accepts. */
function toneIds(v) { return v && v.tone ? Object.keys(v.tone.values) : []; }

/** One line per layout for the plan prompt. */
function layoutsForPrompt(appKey) {
  const L = LAYOUTS[appKey];
  if (!L) return '';
  return L.variants.map(function (v) {
    const extra = [];
    if (v.tone) extra.push('tones: ' + toneIds(v).join('/'));
    if (v.side) extra.push('photo side: left/right');
    return '      · ' + v.id + ' — looks: ' + v.looks + '. Use for: ' + v.use + (extra.length ? ' (' + extra.join('; ') + ')' : '');
  }).join('\n');
}

/**
 * Settings to write for a chosen variant + tone + side.
 * @returns {{ path: string, value: string }[]}
 */
function variantSettings(appKey, id, tone, side) {
  const L = LAYOUTS[appKey];
  if (!L) return [];
  const v = getVariant(appKey, id) || L.variants[0];
  const out = [{ path: L.path, value: v.value }];
  if (v.tone && tone && Object.prototype.hasOwnProperty.call(v.tone.values, tone)) {
    out.push({ path: v.tone.path, value: v.tone.values[tone] });
  }
  if (v.side && (side === 'left' || side === 'right')) {
    out.push({ path: v.side.path, value: v.side[side] });
  }
  return out;
}

module.exports = {
  FONT_SETS,
  BUTTON_SHAPES,
  LAYOUTS,
  NOT_OFFERED,
  getLayouts,
  getVariant,
  variantFieldDefs,
  toneIds,
  layoutsForPrompt,
  variantSettings
};
