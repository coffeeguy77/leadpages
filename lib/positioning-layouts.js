/**
 * Apply admin positioning layouts to a site config safely.
 *
 * Modes:
 *   structure     — sectionOrder + which sections are on/off only (never touch content)
 *   fill_empty    — structure + copy demo pack fields only where the site value is empty
 *   demo_replace  — structure + replace section content from packs, protecting identity fields
 *
 * Identity (business name, phone, email, logo, address, etc.) is never overwritten.
 */
'use strict';

var { pinTrustBarUnderHero, resolveSectionOrder } = require('./section-order');

/** Top-level site identity keys — never taken from a layout pack. */
var IDENTITY_TOP_KEYS = [
  'businessName', 'business', 'phone', 'email', 'mobile', 'address', 'suburb',
  'postcode', 'state', 'abn', 'licence', 'license', 'ownerName', 'ownerEmail',
  'domain', 'slug', 'logo', 'logoUrl', 'logoDark', 'favicon', 'social',
  'facebook', 'instagram', 'google', 'mapsUrl', 'hours', 'tradingHours'
];

/** Per-section keys that identify the business — skip on demo_replace / fill_empty. */
var IDENTITY_SECTION_KEYS = {
  emerg: ['phone', 'text', 'ctaPhone'],
  hero: ['phone', 'businessName'],
  contact: ['phone', 'email', 'address'],
  footer: ['phone', 'email', 'address', 'abn', 'licence'],
  quote: ['phone', 'email'],
  onlineQuote: ['phone', 'email'],
  logo: ['url', 'src', 'darkUrl', 'lightUrl']
};

function isEmptyValue(v) {
  if (v == null) return true;
  if (typeof v === 'string') return !v.trim();
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}

function deepClone(o) {
  return JSON.parse(JSON.stringify(o == null ? {} : o));
}

function normalizeApps(apps) {
  if (!Array.isArray(apps)) return [];
  return apps.map(function(a) {
    if (!a || typeof a !== 'object') return null;
    var key = a.section_key || a.sectionKey || a.key || '';
    if (!key || typeof key !== 'string') return null;
    return {
      section_key: key,
      enabled: a.enabled !== false,
      label: a.label || null
    };
  }).filter(Boolean);
}

function normalizeSectionOrder(order, pin) {
  var list = Array.isArray(order)
    ? order.filter(function(x) { return typeof x === 'string' && x; })
    : [];
  if (pin !== false) list = pinTrustBarUnderHero(list);
  return list;
}

/**
 * Merge pack fields into an existing section object.
 * @param {'fill_empty'|'demo_replace'} mode
 */
function mergeSectionPack(existing, pack, sectionKey, mode) {
  var out = deepClone(existing && typeof existing === 'object' ? existing : {});
  var src = pack && typeof pack === 'object' ? pack : {};
  var protect = IDENTITY_SECTION_KEYS[sectionKey] || [];
  Object.keys(src).forEach(function(k) {
    if (k === 'on' || k === '__ghost') return;
    if (protect.indexOf(k) >= 0) return;
    if (IDENTITY_TOP_KEYS.indexOf(k) >= 0) return;
    if (mode === 'fill_empty') {
      if (isEmptyValue(out[k])) out[k] = deepClone(src[k]);
      return;
    }
    // demo_replace
    out[k] = deepClone(src[k]);
  });
  return out;
}

/**
 * Apply a positioning layout to a site config.
 * @param {object} cfg current site config (mutated copy returned)
 * @param {object} layout positioning_layouts row
 * @param {{ mode?: string }} [opts]
 * @returns {{ config: object, mode: string, changedSections: string[], notes: string[] }}
 */
function applyPositioningLayout(cfg, layout, opts) {
  opts = opts || {};
  var mode = opts.mode || 'structure';
  if (['structure', 'fill_empty', 'demo_replace'].indexOf(mode) < 0) {
    mode = 'structure';
  }

  var config = deepClone(cfg || {});
  if (!config.sections || typeof config.sections !== 'object') config.sections = {};
  var notes = [];
  var changed = [];

  var apps = normalizeApps(layout && layout.apps);
  var order = normalizeSectionOrder(layout && layout.section_order);
  var packs = (layout && layout.demo_packs && typeof layout.demo_packs === 'object')
    ? layout.demo_packs
    : {};

  // 1) Structure: enable/disable apps from the layout recipe
  apps.forEach(function(app) {
    var key = app.section_key;
    if (!config.sections[key]) config.sections[key] = {};
    var was = config.sections[key].on;
    if (app.enabled) {
      if (config.sections[key].on === false) delete config.sections[key].on;
      // Optional apps need explicit on:true
      var OFF = require('./section-order').OFF_BY_DEFAULT;
      if (OFF.indexOf(key) >= 0) config.sections[key].on = true;
    } else {
      config.sections[key].on = false;
    }
    if (was !== config.sections[key].on) changed.push(key);
  });

  // 2) Position law
  if (order.length) {
    config.sectionOrder = order.slice();
  }
  config.sectionOrder = resolveSectionOrder(config);

  // 3) Demo packs (optional)
  if (mode === 'structure') {
    notes.push('Applied structure only — content and imagery were left unchanged.');
  } else {
    var packKeys = Object.keys(packs);
    if (!packKeys.length) {
      notes.push('No demo packs on this layout — structure only.');
    } else {
      packKeys.forEach(function(key) {
        var pack = packs[key];
        if (!pack || typeof pack !== 'object') return;
        if (!config.sections[key]) config.sections[key] = {};
        config.sections[key] = mergeSectionPack(config.sections[key], pack, key, mode);
        if (changed.indexOf(key) < 0) changed.push(key);
      });
      if (mode === 'fill_empty') {
        notes.push('Filled empty section fields from demo packs. Existing copy and images were kept.');
      } else {
        notes.push('Replaced section demo content from packs. Business identity (name, phone, email, logo, address) was protected.');
      }
    }
  }

  // Never let packs overwrite top-level identity even if someone stuffed them in demo_packs._site
  if (packs._site && typeof packs._site === 'object' && mode !== 'structure') {
    notes.push('Skipped packs._site identity blob (not applied).');
  }

  return {
    config: config,
    mode: mode,
    changedSections: changed,
    notes: notes
  };
}

/**
 * Snapshot the current site into a layout payload (admin "save from site").
 */
function captureLayoutFromConfig(cfg, meta) {
  meta = meta || {};
  cfg = cfg || {};
  var sections = cfg.sections || {};
  var order = Array.isArray(cfg.sectionOrder) ? cfg.sectionOrder.slice() : [];
  order = pinTrustBarUnderHero(order);

  var { sectionIsOn, OFF_BY_DEFAULT } = require('./section-order');
  var apps = [];
  var seen = {};

  function pushApp(key, enabled) {
    if (!key || seen[key]) return;
    seen[key] = 1;
    apps.push({ section_key: key, enabled: !!enabled });
  }

  order.forEach(function(key) {
    pushApp(key, sectionIsOn(cfg, key));
  });
  Object.keys(sections).forEach(function(key) {
    pushApp(key, sectionIsOn(cfg, key));
  });

  var demoPacks = {};
  if (meta.includeDemoPacks) {
    var keys = Array.isArray(meta.packKeys) && meta.packKeys.length
      ? meta.packKeys
      : Object.keys(sections);
    keys.forEach(function(key) {
      if (!sections[key] || typeof sections[key] !== 'object') return;
      var snap = deepClone(sections[key]);
      delete snap.on;
      delete snap.__ghost;
      // Strip identity-ish fields from captured packs
      (IDENTITY_SECTION_KEYS[key] || []).forEach(function(k) { delete snap[k]; });
      if (!isEmptyValue(snap)) demoPacks[key] = snap;
    });
  }

  return {
    name: meta.name || 'Untitled layout',
    slug: meta.slug || '',
    description: meta.description || '',
    theme_image_url: meta.theme_image_url || meta.themeImageUrl || null,
    layout_image_url: meta.layout_image_url || meta.layoutImageUrl || null,
    section_order: order,
    apps: apps,
    demo_packs: demoPacks,
    industry_tags: Array.isArray(meta.industry_tags) ? meta.industry_tags : [],
    visibility: meta.visibility || 'partners',
    sort_order: meta.sort_order != null ? meta.sort_order : 0,
    enabled: meta.enabled !== false
  };
}

module.exports = {
  IDENTITY_TOP_KEYS: IDENTITY_TOP_KEYS,
  IDENTITY_SECTION_KEYS: IDENTITY_SECTION_KEYS,
  isEmptyValue: isEmptyValue,
  normalizeApps: normalizeApps,
  normalizeSectionOrder: normalizeSectionOrder,
  mergeSectionPack: mergeSectionPack,
  applyPositioningLayout: applyPositioningLayout,
  captureLayoutFromConfig: captureLayoutFromConfig
};
