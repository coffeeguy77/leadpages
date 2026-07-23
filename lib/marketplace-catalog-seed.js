/**
 * Seed marketplace catalog (categories, features, blocks) and app registry presets.
 * Used by scripts/seed-marketplace-catalog.js and api/marketplace-setup.js
 */
const pp = require('./playground-preset');
const md = require('./marketplace-data');
const { CATEGORIES, SECTION_CATEGORY } = require('./marketplace-categories');
const mv = require('./marketplace-visuals');
const demoSites = require('./demo-sites');

const DEFAULT_POSITION = {
  hero: 'hero',
  heroSlider: 'hero',
  heroBeforeAfter: 'hero',
  splitHero: 'hero',
  navMenu: 'nav',
  trustBar: 'upper',
  textBox: 'upper',
  quote: 'mid',
  onlineQuote: 'mid',
  specialOffer: 'upper',
  responseCards: 'upper',
  reviewHighlights: 'upper',
  featuredProjects: 'upper',
  premiumGallery: 'upper',
  projectStats: 'upper',
  serviceAreas: 'upper',
  emergencyAvailability: 'upper'
};

const HERO_EXCLUSIVE = new Set(['heroSlider', 'heroBeforeAfter', 'splitHero']);

const API_DEPENDENCY = {
  instaGallery: 'Instagram API',
  igProjectFeed: 'Instagram API',
  serviceAreaMap: 'Google Maps (optional)'
};

function toSlug(sectionKey) {
  return sectionKey.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function appRegistrySlug(sectionKey) {
  return toSlug(sectionKey);
}

function buildDemoPreset(sectionKey, defaultConfigs, meta) {
  const flat = defaultConfigs[sectionKey];
  if (!flat) return null;
  const siteConfig = pp.flatDemoToSiteConfig(flat, sectionKey);
  const dbConfig = pp.dbConfigFromSiteConfig(sectionKey, siteConfig);
  return {
    slug: 'demo',
    label: (meta && meta.name ? meta.name : sectionKey) + ' (sample)',
    description: 'Auto-seeded demo preset for marketplace playground',
    config: dbConfig,
    sort_order: 0,
    is_live: true
  };
}

async function upsertCategory(sb, cat) {
  const { data: existing } = await sb.from('catalog_categories')
    .select('id')
    .eq('slug', cat.slug)
    .maybeSingle();
  const row = {
    name: cat.name,
    slug: cat.slug,
    blurb: cat.blurb || null,
    sort_order: cat.sort_order || 0,
    is_live: true
  };
  if (existing) {
    const { error } = await sb.from('catalog_categories').update(row).eq('id', existing.id);
    if (error) throw error;
    return existing.id;
  }
  const { data, error } = await sb.from('catalog_categories').insert(row).select('id').single();
  if (error) throw error;
  return data.id;
}

async function upsertCatalogFeature(sb, sectionKey, meta, sellTpl, categoryId, sortOrder) {
  const slug = toSlug(sectionKey);
  const { data: existing } = await sb.from('catalog_features')
    .select('id,slug')
    .eq('slug', slug)
    .maybeSingle();

  const hero = mv.getCategoryHero(sectionKey, meta);
  const demoSite = demoSites.getDemoSiteForApp(sectionKey);
  const row = {
    name: meta.name || sellTpl.name || sectionKey,
    slug,
    tagline: meta.tagline || sellTpl.tagline || null,
    summary: meta.summary || sellTpl.summary || null,
    section_key: sectionKey,
    category_id: categoryId,
    hero_image_url: (hero && hero.url) || (sellTpl.hero_image_url || null),
    demo_url: (demoSite && demoSite.url) || null,
    badge: null,
    sort_order: sortOrder,
    status: 'live',
    updated_at: new Date().toISOString()
  };

  let featureId;
  if (existing) {
    const { error } = await sb.from('catalog_features').update(row).eq('id', existing.id);
    if (error) throw error;
    featureId = existing.id;
  } else {
    const { data, error } = await sb.from('catalog_features').insert(row).select('id').single();
    if (error) throw error;
    featureId = data.id;
  }

  await sb.from('catalog_blocks').delete().eq('feature_id', featureId);
  const blocks = (sellTpl && sellTpl.blocks) || [];
  if (blocks.length) {
    const rows = blocks.map(function(b, i) {
      const payload = Object.assign({}, b.payload || {});
      if (b.block_type === 'playground') {
        payload.section_key = sectionKey;
        if (!payload.presets || !payload.presets.length) {
          payload.presets = sectionKey === 'featuredProjects' ? ['aam1', 'default'] : ['default'];
        }
      }
      return {
        feature_id: featureId,
        sort_order: i,
        block_type: b.block_type,
        payload
      };
    });
    const { error: blockErr } = await sb.from('catalog_blocks').insert(rows);
    if (blockErr) throw blockErr;
  }

  return { featureId, slug, blocks: blocks.length };
}

async function upsertAppRegistry(sb, sectionKey, meta, sortOrder) {
  const slug = appRegistrySlug(sectionKey);
  const { data: existing } = await sb.from('app_registry')
    .select('id,slug')
    .eq('section_key', sectionKey)
    .maybeSingle();

  const row = {
    name: meta.name || sectionKey,
    slug,
    section_key: sectionKey,
    tier: 'free',
    tagline: meta.tagline || null,
    description: meta.pitch || meta.summary || null,
    default_position: DEFAULT_POSITION[sectionKey] || 'mid',
    marketplace_status: 'live',
    builder_visible: true,
    can_reposition: true,
    hero_exclusive: HERO_EXCLUSIVE.has(sectionKey),
    api_dependency: API_DEPENDENCY[sectionKey] || null,
    sort_order: sortOrder,
    updated_at: new Date().toISOString()
  };

  if (existing) {
    const { error } = await sb.from('app_registry').update(row).eq('id', existing.id);
    if (error) throw error;
    return existing.id;
  }
  const { data, error } = await sb.from('app_registry').insert(row).select('id').single();
  if (error) throw error;
  return data.id;
}

async function upsertDemoPreset(sb, appId, sectionKey, defaultConfigs, meta) {
  const preset = buildDemoPreset(sectionKey, defaultConfigs, meta);
  if (!preset) return false;

  const { data: existing } = await sb.from('app_presets')
    .select('id')
    .eq('app_id', appId)
    .eq('slug', 'demo')
    .maybeSingle();

  const row = Object.assign({}, preset, {
    app_id: appId,
    updated_at: new Date().toISOString()
  });

  if (existing) {
    const { error } = await sb.from('app_presets').update(row).eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await sb.from('app_presets').insert(row);
    if (error) throw error;
  }
  return true;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {{ sectionKeys?: string[], dryRun?: boolean }} options
 */
async function seedMarketplaceCatalog(sb, options) {
  options = options || {};
  const appContent = md.appContent;
  const sellTemplates = md.sellTemplates;
  const defaultConfigs = md.defaultConfigs;

  const allKeys = Object.keys(appContent).sort();
  const sectionKeys = (options.sectionKeys && options.sectionKeys.length)
    ? options.sectionKeys.filter(function(k) { return appContent[k]; })
    : allKeys;

  const result = {
    categories: 0,
    features: [],
    apps: 0,
    presets: 0,
    errors: []
  };

  if (options.dryRun) {
    result.dryRun = true;
    result.wouldSeed = sectionKeys.length;
    result.sectionKeys = sectionKeys;
    return result;
  }

  const categoryIds = {};
  for (const cat of CATEGORIES) {
    try {
      categoryIds[cat.slug] = await upsertCategory(sb, cat);
      result.categories++;
    } catch (e) {
      result.errors.push({ step: 'category', slug: cat.slug, error: String(e.message || e) });
    }
  }

  let sort = 10;
  for (const sectionKey of sectionKeys) {
    sort += 10;
    const meta = appContent[sectionKey];
    const sellTpl = sellTemplates[sectionKey];
    const catSlug = SECTION_CATEGORY[sectionKey] || 'core-content';
    const categoryId = categoryIds[catSlug] || null;

    try {
      const feat = await upsertCatalogFeature(sb, sectionKey, meta, sellTpl, categoryId, sort);
      result.features.push({ section_key: sectionKey, slug: feat.slug, blocks: feat.blocks });

      const appId = await upsertAppRegistry(sb, sectionKey, meta, sort);
      result.apps++;

      const saved = await upsertDemoPreset(sb, appId, sectionKey, defaultConfigs, meta);
      if (saved) result.presets++;
    } catch (e) {
      result.errors.push({ step: 'feature', section_key: sectionKey, error: String(e.message || e) });
    }
  }

  return result;
}

module.exports = {
  CATEGORIES,
  SECTION_CATEGORY,
  seedMarketplaceCatalog,
  toSlug
};
