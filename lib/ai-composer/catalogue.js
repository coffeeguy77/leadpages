'use strict';

/**
 * AI Composer app catalogue.
 *
 * One machine-readable list of the LeadPages apps the AI may place, built from
 * what already exists (no new source of truth):
 *   - marketplace/playground-field-defs.json  → fields per app (normalised to live
 *     sites.config paths by lib/playground-field-paths.js)
 *   - marketplace/app-content.json            → what each app is for
 *   - lib/section-order.js                    → which section keys the renderer knows
 *
 * Only copy, image and colour fields are exposed. Layout switches (selects,
 * numbers, checkboxes, icons, links) keep their editor defaults.
 */

const FIELD_DEFS = require('../../marketplace/playground-field-defs.json');
const APP_CONTENT = require('../../marketplace/app-content.json');
const { fixAllFieldDefs } = require('../playground-field-paths');
const {
  DEFAULT_LAYOUT_SECTIONS,
  OPTIONAL_SECTIONS,
  OFF_BY_DEFAULT
} = require('../section-order');
const { labelForSection } = require('../layout-composer/section-catalogue');
const fs = require('fs');
const path = require('path');

/** Apps the composer never places (need connections, paid engines, or code). */
const EXCLUDED_APPS = [
  'navMenu', 'customHtml', 'searchCanvas', 'instaGallery', 'igProjectFeed',
  'promotions', 'onlineQuote', 'estimateBuilder', 'orderStorefront',
  'scrollingSponsorBanner', 'bookingCta',
  // Map wiring is incomplete — the section renders nothing from text alone.
  'serviceAreaMap',
  // Renders nothing from its fields alone (checked by rendering every app).
  'finance'
];

/** Playground fields the template does not actually read (found by rendering). */
const DEAD_FIELDS = [
  'sections.specialOffer.ctaText', // template reads sections.specialOffer.cta
  'sections.splitHero.intro',      // template reads sections.splitHero.subText
  // Opening hours only show in schedule mode, which the AI does not switch on.
  'sections.emergencyAvailability.weekdayOpen', 'sections.emergencyAvailability.weekdayClose',
  'sections.emergencyAvailability.satOpen', 'sections.emergencyAvailability.satClose',
  'sections.emergencyAvailability.sunOpen', 'sections.emergencyAvailability.sunClose'
];

/** Hero-type apps — a page gets at most one. */
const HERO_APPS = ['hero', 'heroSlider', 'splitHero', 'heroBeforeAfter'];

/** List items the AI may write per list (editor defs usually show 3–4). */
const MAX_LIST_ITEMS = 8;

const SKIP_TYPES = ['select', 'number', 'checkbox', 'toggle', 'boolean', 'icon'];

/**
 * Icon fields the AI may set (kind "icon"): LeadPages icon names from icons.js only.
 * Matched like CHOICE_FIELDS (list indexes → "*"). Others keep their editor defaults.
 */
const ICON_FIELDS = [
  'sections.activityCounter.stats.*.icon',
  'sections.serviceProcess.steps.*.icon',
  'sections.heroSlider.badges.*.icon',
  'sections.textBox.features.*.icon',
  'sections.aboutUs.features.*.icon',
  'sections.specialOffer.points.*.icon',
  'sections.bookingStorefront.points.*.icon',
  'sections.bookingStorefront.icon'
];

let _iconNames = null;
/** Names in window.LP_ICONS (icons.js). */
function iconNames() {
  if (_iconNames) return _iconNames;
  _iconNames = [];
  try {
    // icons.js is our own browser script that assigns window.LP_ICONS; run it in a sandbox.
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'icons.js'), 'utf8');
    const box = { window: {} };
    require('vm').runInNewContext(src, box, { timeout: 2000 });
    _iconNames = Object.keys(box.window.LP_ICONS || {});
  } catch (_e) { _iconNames = []; }
  return _iconNames;
}
/** A known icon name. If icons.js could not be read (bundling), any well-formed name is
 *  accepted — the page simply shows no icon / its default tick for an unknown name. */
function isIconName(v) {
  const n = String(v == null ? '' : v).trim();
  const names = iconNames();
  return names.length ? names.indexOf(n) >= 0 : /^[a-z0-9]+(-[a-z0-9]+)*$/.test(n);
}
/** Short list of icon names offered to the model (all names are accepted). */
const ICON_HINT = ['truck', 'car', 'calendar', 'clock', 'map-pin', 'phone', 'mail', 'circle-check', 'shield-check', 'star',
  'award', 'dollar-sign', 'receipt', 'percent', 'route', 'package', 'box', 'wrench', 'cog', 'snowflake', 'camera',
  'gauge', 'navigation', 'key', 'users', 'home', 'leaf', 'zap', 'droplet', 'flame', 'hammer', 'paintbrush',
  'heart', 'thumbs-up', 'sparkles', 'circle-parking', 'accessibility', 'arrows-up-from-line', 'clipboard-check', 'headset'];
const IMAGE_NAME_RE = /(image|imageurl|img|photo|thumbnail|src|beforeimage|afterimage|logo)$/i;
const NON_COPY_NAME_RE = /(icon|href|url|link|mode|sep|id|orientation|action|target|embed|code|html|script|slug|ratio|featured|span|width|height|align|size|position|style|layout|variant|side|type)$/i;
const LIST_PATH_RE = /^(.*)\.(\d+)\.([A-Za-z0-9_]+)$/;

/**
 * Layout choices the AI may set (approved list). Matched against the live path with
 * list indexes replaced by "*". Values must come from the field's own options.
 */
const CHOICE_FIELDS = [
  'sections.textBox.imageSide',
  'sections.textBox.textAlign',
  'services.*.imageFit',
  'services.*.mediaSize',
  'sections.projectFeed.cardStyle',
  // Extra layouts (assets/lp-layouts.js) — see LAYOUT_FIELDS.
  'sections.heroSlider.textCase',
  'sections.services.mode',
  'sections.services.tickTheme',
  'sections.activityCounter.style',
  'sections.textBox.eyebrowStyle',
  'sections.reviews.theme',
  'sections.reviews.badge',
  'sections.aboutUs.layout',
  'sections.specialOffer.layout',
  'sections.faq.columns'
];

/**
 * Fields the AI must never write. Quote form labels describe what each input
 * collects (name, phone, job, suburb…); relabelling them from a design with
 * different inputs mislabels the form. Neutral wording is set in build-config.
 */
const LOCKED_FIELD_RE = /^sections\.quote\.(lbl[A-Za-z]+|suburbPh|detailPh|formStyle|jobOptions)(\.|$)/;

function isChoiceField(path) {
  const generic = String(path).replace(/\.\d+\./g, '.*.');
  return CHOICE_FIELDS.indexOf(generic) >= 0;
}

/**
 * Colour fields the AI may set. Text colours (heading/intro/body/fg…) are left
 * out: a white heading copied from a dark design lands on LeadPages' own light
 * section background and disappears. Backgrounds are checked for lightness in
 * build-config; buttons are checked for contrast.
 */
const SAFE_COLOR_NAMES = ['bg', 'cardBg', 'btnBg', 'btnText', 'starColor', 'accent', 'iconColor', 'activeFilterColor', 'line', 'stroke', 'sectionStroke', 'strokeColour', 'edgeColour'];

function isIconField(p) {
  return ICON_FIELDS.indexOf(String(p).replace(/\.\d+\./g, '.*.')) >= 0;
}

function fieldKind(def) {
  const name = String(def.key || '').split('.').pop();
  if (LOCKED_FIELD_RE.test(String(def.key || ''))) return null;
  if (def.type === 'icon') return isIconField(def.key) ? 'icon' : null;
  if (DEAD_FIELDS.indexOf(String(def.key || '')) >= 0) return null;
  if (def.type === 'select' && isChoiceField(def.key) && Array.isArray(def.options) && def.options.length) return 'choice';
  if (def.type === 'image' || IMAGE_NAME_RE.test(name)) return 'image';
  if (SKIP_TYPES.indexOf(def.type) >= 0) return null;
  if (def.type === 'color') return SAFE_COLOR_NAMES.indexOf(name) >= 0 ? 'color' : null;
  if (NON_COPY_NAME_RE.test(name)) return null;
  if (def.type === 'text' || def.type === 'textarea') return 'text';
  return null;
}

function stripIndexFromLabel(label) {
  return String(label || '')
    .replace(/\b\d+\b\s*/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function purposeFor(key) {
  const c = APP_CONTENT[key];
  if (c) {
    return [c.name, c.tagline, c.summary].filter(Boolean).join(' — ');
  }
  if (key === 'footer') return 'Footer — business blurb, contact details and quick links at the bottom of the page.';
  if (key === 'emerg') return 'Emergency bar — a thin announcement strip at the very top of the page.';
  return labelForSection(key);
}

/**
 * Copy fields the template reads that are missing from the playground defs.
 * Without them the template shows its own trade wording (found by rendering).
 */
const EXTRA_FIELDS = {
  projectStats: [
    { type: 'text', key: 'sections.projectStats.eyebrow', label: 'Eyebrow' },
    { type: 'text', key: 'sections.projectStats.heading', label: 'Heading' }
  ],
  crew: [
    { type: 'text', key: 'sections.crew.eyebrow', label: 'Eyebrow' },
    { type: 'text', key: 'sections.crew.heading', label: 'Heading' }
  ],
  certifications: [
    { type: 'text', key: 'sections.certifications.eyebrow', label: 'Eyebrow' },
    { type: 'text', key: 'sections.certifications.heading', label: 'Heading' }
  ],
  specialOffer: [
    { type: 'text', key: 'sections.specialOffer.cta', label: 'Button text' }
  ],
  splitHero: [
    { type: 'textarea', key: 'sections.splitHero.subText', label: 'Sub-headline' },
    { type: 'text', key: 'sections.splitHero.primaryCtaText', label: 'Button text' }
  ],
  area: [
    { type: 'text', key: 'sections.area.ctaTitle', label: 'Call-out card title' },
    { type: 'text', key: 'sections.area.ctaSub', label: 'Call-out card text' }
  ]
};

/**
 * Apps that still make sense with all their lists empty. Every other app with
 * lists is switched off when the design gave it no items, because the template
 * fills empty lists with its own sample (trade) items.
 */
const LISTS_OPTIONAL = ['hero', 'quote', 'footer', 'specialOffer', 'bookingStorefront'];

/**
 * Opt-in layouts for existing apps (assets/lp-layouts.js) and the Bookings hire bar
 * (assets/lp-booking-hire.js). A def here replaces a playground def with the same key.
 * List fields use ".0." paths like the playground defs.
 */
function opt(values) { return values.map(function (v) { return { value: v }; }); }
const LAYOUT_FIELDS = {
  heroSlider: [
    { type: 'select', key: 'sections.heroSlider.textCase', label: 'Headline case (normal = as typed, not forced capitals)', options: opt(['normal']) },
    { type: 'icon', key: 'sections.heroSlider.badges.0.icon', label: 'Badge icon' },
    { type: 'text', key: 'sections.heroSlider.badges.0.title', label: 'Badge title' },
    { type: 'text', key: 'sections.heroSlider.badges.0.text', label: 'Badge small text' },
    { type: 'text', key: 'sections.heroSlider.badges.3.title', label: 'Badge title' }
  ],
  services: [
    { type: 'select', key: 'sections.services.mode', label: 'Card style (tick = included-item cards: photo, title and a tick)', options: opt(['grid', 'tick']) },
    { type: 'select', key: 'sections.services.tickTheme', label: 'Tick cards band (dark band or light)', options: opt(['dark', 'light']) }
  ],
  activityCounter: [
    { type: 'select', key: 'sections.activityCounter.style', label: 'Style (strip = compact row of icon + figure + label)', options: opt(['strip']) }
  ],
  textBox: [
    { type: 'select', key: 'sections.textBox.eyebrowStyle', label: 'Eyebrow style (tag = solid coloured label)', options: opt(['tag']) },
    { type: 'icon', key: 'sections.textBox.features.0.icon', label: 'Feature icon' },
    { type: 'text', key: 'sections.textBox.features.0.text', label: 'Feature' },
    { type: 'text', key: 'sections.textBox.features.5.text', label: 'Feature' },
    { type: 'text', key: 'sections.textBox.ctaLabel', label: 'Button text under the text' }
  ],
  reviews: [
    { type: 'select', key: 'sections.reviews.theme', label: 'Band (dark = dark background, white cards)', options: opt(['dark']) },
    { type: 'select', key: 'sections.reviews.badge', label: 'Card badge (google = Google "G" on each card)', options: opt(['google']) },
    { type: 'text', key: 'sections.reviews.summaryRating', label: 'Overall rating figure (e.g. 4.9)' },
    { type: 'text', key: 'sections.reviews.summaryText', label: 'Rating text (e.g. from 100+ reviews)' },
    { type: 'text', key: 'sections.reviews.summaryCtaLabel', label: '"View all reviews" button text' }
  ],
  aboutUs: [
    { type: 'select', key: 'sections.aboutUs.layout', label: 'Layout (location = address, hours, map and photo)', options: opt(['story', 'location']) },
    { type: 'textarea', key: 'sections.aboutUs.address', label: 'Address (location layout)' },
    { type: 'textarea', key: 'sections.aboutUs.hours', label: 'Opening hours, one line per row (location layout)' },
    { type: 'icon', key: 'sections.aboutUs.features.0.icon', label: 'Photo point icon' },
    { type: 'text', key: 'sections.aboutUs.features.0.text', label: 'Photo point (location layout)' },
    { type: 'text', key: 'sections.aboutUs.features.3.text', label: 'Photo point (location layout)' }
  ],
  specialOffer: [
    { type: 'select', key: 'sections.specialOffer.layout', label: 'Layout (banner = full-width photo banner)', options: opt(['banner']) },
    { type: 'image', key: 'sections.specialOffer.bgImage', label: 'Banner background photo' },
    { type: 'icon', key: 'sections.specialOffer.points.0.icon', label: 'Point icon' }
  ],
  serviceProcess: [
    { type: 'image', key: 'sections.serviceProcess.sideImage', label: 'Photo beside the steps' },
    { type: 'text', key: 'sections.serviceProcess.calloutTitle', label: 'Card over the photo: title' },
    { type: 'textarea', key: 'sections.serviceProcess.calloutText', label: 'Card over the photo: text' },
    { type: 'text', key: 'sections.serviceProcess.calloutLinkLabel', label: 'Card over the photo: link text' }
  ],
  faq: [
    { type: 'select', key: 'sections.faq.columns', label: 'Columns', options: opt(['1', '2']) },
    { type: 'text', key: 'sections.faq.ctaLabel', label: '"View all FAQs" button text' }
  ],
  bookingStorefront: [
    { type: 'text', key: 'sections.bookingStorefront.hireHeading', label: 'Booking bar heading' },
    { type: 'icon', key: 'sections.bookingStorefront.icon', label: 'Heading icon' },
    { type: 'text', key: 'sections.bookingStorefront.hireCtaLabel', label: 'Button text' },
    { type: 'text', key: 'sections.bookingStorefront.dateLabel', label: 'Date field label' },
    { type: 'text', key: 'sections.bookingStorefront.timeLabel', label: 'Time field label' },
    { type: 'text', key: 'sections.bookingStorefront.durationLabel', label: 'Duration field label' },
    { type: 'icon', key: 'sections.bookingStorefront.points.0.icon', label: 'Point icon' },
    { type: 'text', key: 'sections.bookingStorefront.points.0.text', label: 'Point under the form' },
    { type: 'text', key: 'sections.bookingStorefront.points.3.text', label: 'Point under the form' },
    { type: 'text', key: 'sections.bookingStorefront.rates.0.label', label: 'Rate card label (e.g. Mon – Thu)' },
    { type: 'text', key: 'sections.bookingStorefront.rates.0.price', label: 'Rate card price (e.g. $150)' },
    { type: 'text', key: 'sections.bookingStorefront.rates.0.unit', label: 'Rate card unit (e.g. per 24 hours)' },
    { type: 'text', key: 'sections.bookingStorefront.rates.0.note', label: 'Rate card note (e.g. 200km included)' },
    { type: 'text', key: 'sections.bookingStorefront.rates.3.label', label: 'Rate card label' }
  ]
};
/** Plan-prompt purpose for apps that only exist through LAYOUT_FIELDS. */
const LAYOUT_PURPOSE = {
  bookingStorefront: 'Booking bar (vehicle / equipment hire) — a white card with pick-up date, pick-up time and hire duration fields, a "Check availability" button, short points underneath and optional price cards on the right. Place it directly under the hero when the design shows a booking/availability bar there.'
};

function buildEntry(key, defs) {
  const layout = LAYOUT_FIELDS[key] || [];
  const overridden = {};
  layout.forEach(function (d) { overridden[d.key] = true; });
  defs = layout.concat((defs || []).filter(function (d) { return d && !overridden[d.key]; }), EXTRA_FIELDS[key] || []);
  const scalars = [];
  const listsByPath = {};
  (defs || []).forEach(function (def) {
    if (!def || !def.key || String(def.key).indexOf('theme.') === 0) return;
    // A field that writes into another app's section (e.g. serviceAreaMap → serviceAreas) is skipped.
    const own = String(def.key).match(/^sections\.([^.]+)\./);
    if (own && own[1] !== key) return;
    if (def.getTransform || def.setTransform) return;
    const kind = fieldKind(def);
    if (!kind) return;
    const m = String(def.key).match(LIST_PATH_RE);
    if (m) {
      // Item colours are cosmetic per-card overrides; leave them to the editor.
      if (kind === 'color') return;
      const listPath = m[1];
      const idx = Number(m[2]);
      const name = m[3];
      if (listPath.indexOf('.') >= 0 && /\.\d+$/.test(listPath)) return; // nested lists
      const list = listsByPath[listPath] || (listsByPath[listPath] = {
        path: listPath,
        capacity: 0,
        fields: [],
        _names: {},
        // Lists added by an opt-in layout never decide whether the app is kept.
        _layout: !!overridden[def.key]
      });
      if (!overridden[def.key]) list._layout = false;
      list.capacity = Math.max(list.capacity, idx + 1);
      if (!list._names[name]) {
        list._names[name] = true;
        const item = { name: name, label: stripIndexFromLabel(def.label) || name, kind: kind };
        if (kind === 'icon') item.label += ' (LeadPages icon name, e.g. ' + ICON_HINT.slice(0, 12).join(', ') + ')';
        if (kind === 'choice') item.options = def.options.map(function (o) { return String(o.value); });
        list.fields.push(item);
      }
      return;
    }
    // Fields stored as an array of strings (editor "join" fields, e.g. area suburbs).
    const split = kind === 'text' && typeof def.join === 'string';
    const field = { path: def.key, label: (def.label || def.key) + (kind === 'icon' ? ' (LeadPages icon name, e.g. ' + ICON_HINT.slice(0, 12).join(', ') + ')' : ''), kind: kind };
    if (split) field.split = true;
    if (kind === 'choice') field.options = def.options.map(function (o) { return String(o.value); });
    scalars.push(field);
  });
  const lists = Object.keys(listsByPath).map(function (p) {
    const l = listsByPath[p];
    delete l._names;
    if (l._layout) l.layoutOnly = true;
    delete l._layout;
    l.maxItems = Math.max(l.capacity, MAX_LIST_ITEMS);
    return l;
  });
  // Drop duplicate scalar paths, and scalars that are really a list stored another
  // way (e.g. serviceAreas.areas as joined text vs areas[n].name) — the list wins.
  const listPaths = {};
  lists.forEach(function (l) { listPaths[l.path] = true; });
  const kept = {};
  for (let j = 0; j < scalars.length; j++) {
    const p = scalars[j].path;
    if (listPaths[p] || kept[p]) { scalars.splice(j, 1); j--; continue; }
    kept[p] = true;
  }
  const hasImages = scalars.some(function (s) { return s.kind === 'image'; }) ||
    lists.some(function (l) { return l.fields.some(function (f) { return f.kind === 'image'; }); });
  return {
    key: key,
    label: labelForSection(key),
    purpose: LAYOUT_PURPOSE[key] || purposeFor(key),
    hero: HERO_APPS.indexOf(key) >= 0,
    listsOptional: LISTS_OPTIONAL.indexOf(key) >= 0 || !lists.some(function (l) { return !l.layoutOnly; }),
    scalars: scalars,
    lists: lists,
    hasImages: hasImages
  };
}

function footerEntry() {
  return {
    key: 'footer',
    label: 'Footer',
    purpose: purposeFor('footer'),
    hero: false,
    listsOptional: true,
    scalars: [
      { path: 'sections.footer.blurb', label: 'About blurb', kind: 'text' },
      { path: 'sections.footer.servicesTitle', label: 'Links column title', kind: 'text' },
      { path: 'sections.footer.supportTitle', label: 'Contact box title', kind: 'text' },
      { path: 'sections.footer.supportHelp', label: 'Contact box text', kind: 'text' },
      { path: 'sections.footer.taglineLead', label: 'Bottom tagline (first part)', kind: 'text' },
      { path: 'sections.footer.taglineAccent', label: 'Bottom tagline (highlighted part)', kind: 'text' }
    ],
    lists: [{
      path: 'sections.footer.services',
      capacity: 6,
      maxItems: MAX_LIST_ITEMS,
      fields: [{ name: 'label', label: 'Link label', kind: 'text' }]
    }],
    hasImages: false
  };
}

let _cache = null;

/** @returns {Record<string, ReturnType<typeof buildEntry>>} */
function getCatalogue() {
  if (_cache) return _cache;
  const fixed = fixAllFieldDefs(FIELD_DEFS);
  const known = {};
  DEFAULT_LAYOUT_SECTIONS.concat(OPTIONAL_SECTIONS).forEach(function (k) { known[k] = true; });
  const out = {};
  Object.keys(fixed).concat(Object.keys(LAYOUT_FIELDS)).forEach(function (key) {
    if (out[key] || !known[key] || EXCLUDED_APPS.indexOf(key) >= 0) return;
    // Bookings is only placed as the hire bar — its CTA fields stay with the editor.
    out[key] = buildEntry(key, key === 'bookingStorefront' ? [] : fixed[key]);
  });
  out.footer = footerEntry();
  _cache = out;
  return out;
}

function listAppKeys() {
  return Object.keys(getCatalogue());
}

function getApp(key) {
  return getCatalogue()[key] || null;
}

/**
 * Compact text for the design-plan prompt: one line per app.
 */
function catalogueForPlanPrompt() {
  const cat = getCatalogue();
  return Object.keys(cat).map(function (key) {
    const a = cat[key];
    const parts = a.scalars
      .filter(function (s) { return s.kind !== 'color' && s.kind !== 'choice' && s.kind !== 'icon'; })
      .map(function (s) { return s.label + (s.kind === 'image' ? ' (photo)' : ''); });
    a.lists.forEach(function (l) {
      parts.push('list of up to ' + l.maxItems + ' items [' + l.fields.filter(function (f) { return f.kind !== 'choice' && f.kind !== 'icon'; }).map(function (f) {
        return f.label + (f.kind === 'image' ? ' (photo)' : '');
      }).join(', ') + ']');
    });
    return '- ' + key + (a.hero ? ' [HERO]' : '') + ': ' + a.purpose +
      (parts.length ? ' | Holds: ' + parts.join('; ') : '');
  }).join('\n');
}

/**
 * Field sheet for one app in the fill prompt.
 */
function appFieldSheet(key) {
  const a = getApp(key);
  if (!a) return null;
  return {
    appKey: key,
    app: a.label,
    fields: a.scalars.map(function (s) {
      if (s.split) return { path: s.path, label: s.label + ' (comma-separated list)', kind: s.kind };
      if (s.kind === 'choice') return { path: s.path, label: s.label, kind: s.kind, options: s.options };
      return { path: s.path, label: s.label, kind: s.kind };
    }),
    lists: a.lists.map(function (l) {
      return {
        path: l.path,
        maxItems: l.maxItems,
        itemFields: l.fields.map(function (f) {
          return f.kind === 'choice'
            ? { name: f.name, label: f.label, kind: f.kind, options: f.options }
            : { name: f.name, label: f.label, kind: f.kind };
        })
      };
    })
  };
}

/** Every section key the renderer knows (used to switch unchosen ones off). */
function allKnownSectionKeys() {
  const seen = {};
  const out = [];
  DEFAULT_LAYOUT_SECTIONS.concat(OPTIONAL_SECTIONS, OFF_BY_DEFAULT).forEach(function (k) {
    if (!seen[k]) { seen[k] = true; out.push(k); }
  });
  return out;
}

module.exports = {
  EXCLUDED_APPS,
  CHOICE_FIELDS,
  ICON_FIELDS,
  LAYOUT_FIELDS,
  LOCKED_FIELD_RE,
  isIconName,
  iconNames,
  SAFE_COLOR_NAMES,
  HERO_APPS,
  MAX_LIST_ITEMS,
  getCatalogue,
  listAppKeys,
  getApp,
  catalogueForPlanPrompt,
  appFieldSheet,
  allKnownSectionKeys,
  _fieldKind: fieldKind
};
