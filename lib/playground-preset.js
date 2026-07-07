/**
 * Playground preset contract v1 — single normal form for file JSON + app_presets DB.
 *
 * Unified preset:
 *   { contract_version: 1, slug, label, section_key, source?, site_config: { sections, theme, ... } }
 *
 * DB app_presets.config stores: { contract_version: 1, section_key, site_config }
 * File playground/*.json stores the full unified preset (slug optional in file).
 */
const CONTRACT_VERSION = 1;

const SECTION_SCALAR_KEYS = new Set([
  'theme', 'business', 'trade', 'phone', 'phoneText', 'layout', 'sectionOrder', 'logo', 'pages'
]);

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

const SECTION_FIELD_KEYS = [
  'eyebrow', 'heading', 'intro', 'cardBg', 'cardText', 'headSep', 'cardStyle',
  'showTag', 'showTitle', 'showLocation', 'showDate', 'showDesc',
  'title', 'sub', 'titleHl', 'amount', 'period', 'description', 'disclaimer',
  'postsToShow', 'sortOrder', 'source', 'count', 'columns'
];

function clone(obj) {
  return JSON.parse(JSON.stringify(obj || {}));
}

function isV1Preset(raw) {
  return raw && raw.contract_version === CONTRACT_VERSION && raw.site_config && typeof raw.site_config === 'object';
}

function mapLegacyItems(items, sectionKey) {
  if (!Array.isArray(items)) return items;
  const listKey = SECTION_ITEM_KEYS[sectionKey] || 'items';
  const mapped = items.map(function(it) {
    return {
      on: it.on !== false,
      title: it.title,
      tag: it.type || it.tag,
      location: it.location,
      description: it.description || it.caption,
      image: it.img || it.image,
      service: it.service,
      date: it.date,
      caption: it.caption || it.description,
      permalink: it.permalink
    };
  });
  return { key: listKey, value: mapped };
}

function legacyFileToSiteConfig(raw, sectionKey) {
  const sk = sectionKey || raw.section || raw.section_key || '';
  const cfg = raw.config || {};
  const sec = { on: true };
  SECTION_FIELD_KEYS.forEach(function(k) {
    if (cfg[k] != null) sec[k] = cfg[k];
  });
  if (raw.headBadges) sec.headBadges = raw.headBadges;
  const items = raw.items || raw.projects;
  if (items && Array.isArray(items)) {
    const m = mapLegacyItems(items, sk);
    sec[m.key] = m.value;
  }
  const out = { sections: {} };
  if (sk) out.sections[sk] = sec;
  if (cfg.accent) out.theme = { pipe: cfg.accent };
  if (raw.theme) out.theme = Object.assign({}, out.theme, raw.theme);
  if (raw.phone) out.phone = raw.phone;
  if (raw.business) out.business = raw.business;
  return out;
}

function flatDemoToSiteConfig(flat, sectionKey) {
  const src = flat || {};
  const out = {
    sections: {},
    theme: clone(src.theme || {}),
    phone: src.phone || src.phoneText || null,
    business: src.business || src.business_name || src.name || null,
    trade: src.trade || null
  };
  Object.keys(src).forEach(function(k) {
    if (SECTION_SCALAR_KEYS.has(k)) return;
    if (src[k] && typeof src[k] === 'object') {
      out.sections[k] = Object.assign({ on: true }, src[k]);
    }
  });
  if (sectionKey && src[sectionKey] && !out.sections[sectionKey]) {
    out.sections[sectionKey] = Object.assign({ on: true }, src[sectionKey]);
  }
  return out;
}

function legacyDbToSiteConfig(raw) {
  const cfg = raw || {};
  if (cfg.demo_config) {
    if (cfg.demo_config.sections) return clone(cfg.demo_config);
    return flatDemoToSiteConfig(cfg.demo_config, cfg.section_key);
  }
  if (cfg.sections) return clone(cfg);
  if (cfg.section_key && cfg.site_config) return clone(cfg.site_config);
  return flatDemoToSiteConfig(cfg, cfg.section_key);
}

function inferSectionKey(raw, fallback) {
  return (raw && (raw.section_key || raw.section)) || fallback || '';
}

function siteConfigToDbConfig(sectionKey, siteConfig) {
  return {
    contract_version: CONTRACT_VERSION,
    section_key: sectionKey,
    site_config: clone(siteConfig)
  };
}

function normalizePreset(raw, meta) {
  meta = meta || {};
  const slug = meta.slug || raw.slug || '';
  const source = meta.source || raw.source || 'file';
  let sectionKey = inferSectionKey(raw, meta.section_key);
  let siteConfig;

  if (isV1Preset(raw)) {
    sectionKey = sectionKey || inferSectionKey(raw.site_config, meta.section_key);
    return {
      contract_version: CONTRACT_VERSION,
      slug,
      label: raw.label || meta.label || slug,
      section_key: sectionKey,
      source,
      site_config: clone(raw.site_config)
    };
  }

  if (raw && raw.demo_config) {
    siteConfig = legacyDbToSiteConfig(raw);
    sectionKey = sectionKey || raw.section_key || '';
  } else if (raw && (raw.config || raw.items || raw.projects || raw.headBadges) && (raw.section || raw.section_key)) {
    siteConfig = legacyFileToSiteConfig(raw, sectionKey);
    sectionKey = sectionKey || raw.section || raw.section_key;
  } else if (raw && raw.sections) {
    siteConfig = clone(raw);
    sectionKey = sectionKey || meta.section_key || '';
  } else if (raw && sectionKey && raw[sectionKey]) {
    siteConfig = flatDemoToSiteConfig(raw, sectionKey);
  } else {
    siteConfig = flatDemoToSiteConfig(raw, sectionKey);
  }

  return {
    contract_version: CONTRACT_VERSION,
    slug,
    label: (raw && raw.label) || meta.label || slug,
    section_key: sectionKey,
    source,
    site_config: siteConfig
  };
}

function presetToSiteConfig(preset) {
  const p = normalizePreset(preset, {
    slug: preset.slug,
    source: preset.source,
    section_key: preset.section_key,
    label: preset.label
  });
  return clone(p.site_config);
}

function dbConfigFromSiteConfig(sectionKey, siteConfig) {
  return siteConfigToDbConfig(sectionKey, siteConfig);
}

function fileJsonFromPreset(preset) {
  const p = normalizePreset(preset, {});
  return {
    contract_version: CONTRACT_VERSION,
    label: p.label,
    section_key: p.section_key,
    site_config: p.site_config
  };
}

function siteConfigToFlatDemo(siteConfig) {
  const sc = siteConfig || {};
  const flat = {};
  if (sc.theme) flat.theme = clone(sc.theme);
  if (sc.business) flat.business = sc.business;
  if (sc.trade) flat.trade = sc.trade;
  if (sc.phone) flat.phone = sc.phone;
  if (sc.sections) {
    Object.keys(sc.sections).forEach(function(k) {
      flat[k] = clone(sc.sections[k]);
    });
  }
  return flat;
}

const api = {
  CONTRACT_VERSION,
  normalizePreset,
  presetToSiteConfig,
  flatDemoToSiteConfig,
  legacyFileToSiteConfig,
  legacyDbToSiteConfig,
  siteConfigToFlatDemo,
  siteConfigToDbConfig,
  dbConfigFromSiteConfig,
  fileJsonFromPreset
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof window !== 'undefined') {
  window.LPPlaygroundPreset = api;
}
