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

/** Apps the composer never places (need connections, paid engines, or code). */
const EXCLUDED_APPS = [
  'navMenu', 'customHtml', 'searchCanvas', 'instaGallery', 'igProjectFeed',
  'promotions', 'onlineQuote', 'estimateBuilder', 'orderStorefront',
  'bookingStorefront', 'scrollingSponsorBanner', 'bookingCta',
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
  'sections.projectFeed.cardStyle'
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

function fieldKind(def) {
  const name = String(def.key || '').split('.').pop();
  if (LOCKED_FIELD_RE.test(String(def.key || ''))) return null;
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
const LISTS_OPTIONAL = ['hero', 'quote', 'footer', 'specialOffer'];

function buildEntry(key, defs) {
  defs = (defs || []).concat(EXTRA_FIELDS[key] || []);
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
        _names: {}
      });
      list.capacity = Math.max(list.capacity, idx + 1);
      if (!list._names[name]) {
        list._names[name] = true;
        const item = { name: name, label: stripIndexFromLabel(def.label) || name, kind: kind };
        if (kind === 'choice') item.options = def.options.map(function (o) { return String(o.value); });
        list.fields.push(item);
      }
      return;
    }
    // Fields stored as an array of strings (editor "join" fields, e.g. area suburbs).
    const split = kind === 'text' && typeof def.join === 'string';
    const field = { path: def.key, label: def.label || def.key, kind: kind };
    if (split) field.split = true;
    if (kind === 'choice') field.options = def.options.map(function (o) { return String(o.value); });
    scalars.push(field);
  });
  const lists = Object.keys(listsByPath).map(function (p) {
    const l = listsByPath[p];
    delete l._names;
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
    purpose: purposeFor(key),
    hero: HERO_APPS.indexOf(key) >= 0,
    listsOptional: LISTS_OPTIONAL.indexOf(key) >= 0 || !lists.length,
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
  Object.keys(fixed).forEach(function (key) {
    if (!known[key] || EXCLUDED_APPS.indexOf(key) >= 0) return;
    out[key] = buildEntry(key, fixed[key]);
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
      .filter(function (s) { return s.kind !== 'color' && s.kind !== 'choice'; })
      .map(function (s) { return s.label + (s.kind === 'image' ? ' (photo)' : ''); });
    a.lists.forEach(function (l) {
      parts.push('list of up to ' + l.maxItems + ' items [' + l.fields.filter(function (f) { return f.kind !== 'choice'; }).map(function (f) {
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
  LOCKED_FIELD_RE,
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
