// api/apps.js
// GET  /api/apps              -> {apps, categories} all live (public)
// GET  /api/apps?slug=<slug>  -> {app, schema, presets} single app (public)
// GET  /api/apps?all=1        -> all apps inc draft (admin only, service role)
const { createClient } = require('@supabase/supabase-js');
const pp = require('../lib/playground-preset');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const LP_ACCESSIBILITY_APP = {
  name: 'Appearance & Accessibility',
  slug: 'appearance-accessibility',
  section_key: 'lpAccessibility',
  tier: 'free',
  tagline: 'Themes, visitor viewing preferences, and WCAG 2.2-focused accessibility support.',
  description: 'Configure published-page themes, visitor viewing preferences, skip links, and the accessibility floating button from Appearance & Accessibility in the command centre.',
  default_position: 'footer',
  marketplace_status: 'live',
  builder_visible: true,
  can_reposition: false,
  hero_exclusive: false,
  sort_order: 900,
  updated_at: new Date().toISOString()
};

const PREMIUM_GALLERY_APP = {
  name: 'Premium Gallery',
  slug: 'premium-gallery',
  section_key: 'premiumGallery',
  tier: 'free',
  tagline: 'Design-led image galleries for large photo collections',
  description: 'Showcase mixed portrait and landscape photography with mosaic layouts, filters, categories and albums. Off by default — enable from App Marketplace.',
  default_position: 'upper',
  marketplace_status: 'live',
  builder_visible: true,
  can_reposition: true,
  hero_exclusive: false,
  sort_order: 88,
  updated_at: new Date().toISOString()
};

const SEARCH_CANVAS_APP = {
  name: 'SearchCanvas',
  slug: 'search-canvas',
  section_key: 'searchCanvas',
  tier: 'free',
  tagline: 'Visual SEO Content',
  description:
    'Turn search-focused content into an attractive tabbed section with images, icons and structured service information. Preferred output for AI Homepage SEO.',
  default_position: 'mid',
  marketplace_status: 'live',
  builder_visible: true,
  can_reposition: true,
  hero_exclusive: false,
  sort_order: 72,
  updated_at: new Date().toISOString()
};

const CUSTOM_HTML_APP = {
  name: 'Custom HTML',
  slug: 'custom-html',
  section_key: 'customHtml',
  tier: 'free',
  price_monthly_aud: 0,
  price_annual_aud: 0,
  tagline: 'Embed your own HTML, CSS and JS — fully responsive, not an iframe',
  description:
    'Drop custom HTML onto any page. Attach optional CSS and JavaScript URLs. '
    + 'Renders inline in your site layout so you can reposition it like any other app. '
    + 'Ideal for tools, calculators, and one-off widgets. Use Unique-to-page mode on '
    + 'landing pages so each page keeps its own HTML (e.g. transfer matcher vs pay frequency).',
  default_position: 'mid',
  marketplace_status: 'live',
  builder_visible: true,
  can_reposition: true,
  hero_exclusive: false,
  sort_order: 120,
  updated_at: new Date().toISOString()
};

/** Unified Promotions Engine — public hub is /marketplace/promotions (sections.promotions). */
const PROMOTIONS_APP = {
  name: 'Promotions & Offers',
  slug: 'promotions',
  section_key: 'promotions',
  tier: 'free',
  price_monthly_aud: 0,
  price_annual_aud: 0,
  tagline: 'Seasonal offers, front and centre',
  description:
    'Urgency offers with types, placements and styles — weekly windows, deadlines, '
    + 'limited spots, finance, suburb specials and more. Same Promotions Engine as the Page editor.',
  default_position: 'mid',
  marketplace_status: 'live',
  builder_visible: true,
  can_reposition: true,
  hero_exclusive: false,
  sort_order: 85,
  updated_at: new Date().toISOString()
};

const SCROLLING_SPONSOR_BANNER_APP = {
  name: 'Scrolling Sponsor Banner',
  slug: 'scrolling-sponsor-banner',
  section_key: 'scrollingSponsorBanner',
  tier: 'free',
  price_monthly_aud: 0,
  price_annual_aud: 0,
  tagline: 'Sponsors and partners, always in motion',
  description:
    'Display sponsors, partners and brands in a seamless scrolling banner with optional '
    + 'links, text overlays and custom styling. Multiple named banners per site.',
  default_position: 'upper',
  marketplace_status: 'live',
  builder_visible: true,
  can_reposition: true,
  hero_exclusive: false,
  sort_order: 78,
  updated_at: new Date().toISOString()
};

const STALE_PROMOTIONS_SECTION_KEYS = ['promotions-hero', 'promotions-inline'];

async function ensureLpAccessibilityApp() {
  const { data: existing } = await sb.from('app_registry')
    .select('id')
    .eq('section_key', 'lpAccessibility')
    .maybeSingle();
  if (existing) return;
  await sb.from('app_registry').upsert(LP_ACCESSIBILITY_APP, { onConflict: 'slug' });
}

async function ensurePremiumGalleryApp() {
  const row = Object.assign({}, PREMIUM_GALLERY_APP, { updated_at: new Date().toISOString() });
  const { data: existing } = await sb.from('app_registry')
    .select('id,marketplace_status,builder_visible,default_position')
    .eq('section_key', 'premiumGallery')
    .maybeSingle();
  if (!existing) {
    await sb.from('app_registry').upsert(row, { onConflict: 'slug' });
    return;
  }
  // Heal draft / hidden / wrong-zone rows so the tile stays selectable in Mid/Upper.
  if (
    existing.marketplace_status !== 'live' ||
    existing.builder_visible !== true ||
    existing.default_position !== 'upper'
  ) {
    await sb.from('app_registry').update({
      name: row.name,
      slug: row.slug,
      tagline: row.tagline,
      description: row.description,
      tier: row.tier,
      default_position: row.default_position,
      marketplace_status: 'live',
      builder_visible: true,
      can_reposition: true,
      hero_exclusive: false,
      sort_order: row.sort_order,
      updated_at: row.updated_at
    }).eq('id', existing.id);
  }
}

async function ensureSearchCanvasApp() {
  const row = Object.assign({}, SEARCH_CANVAS_APP, { updated_at: new Date().toISOString() });
  const { data: existing } = await sb.from('app_registry')
    .select('id,marketplace_status,builder_visible,default_position,name,tagline')
    .eq('section_key', 'searchCanvas')
    .maybeSingle();
  if (!existing) {
    await sb.from('app_registry').upsert(row, { onConflict: 'slug' });
    return;
  }
  if (
    existing.marketplace_status !== 'live' ||
    existing.builder_visible !== true ||
    existing.default_position !== 'mid' ||
    existing.name !== row.name
  ) {
    await sb.from('app_registry').update({
      name: row.name,
      slug: row.slug,
      tagline: row.tagline,
      description: row.description,
      tier: row.tier,
      default_position: row.default_position,
      marketplace_status: 'live',
      builder_visible: true,
      can_reposition: true,
      hero_exclusive: false,
      sort_order: row.sort_order,
      updated_at: row.updated_at
    }).eq('id', existing.id);
  }
}

async function ensureCustomHtmlApp() {
  const row = Object.assign({}, CUSTOM_HTML_APP, { updated_at: new Date().toISOString() });
  const { data: existing } = await sb.from('app_registry')
    .select('id,marketplace_status,builder_visible,default_position,name,slug')
    .eq('section_key', 'customHtml')
    .maybeSingle();
  if (!existing) {
    await sb.from('app_registry').upsert(row, { onConflict: 'slug' });
    return;
  }
  // Heal draft / hidden rows so Custom HTML stays in landing-page + marketplace lists.
  if (
    existing.marketplace_status !== 'live' ||
    existing.builder_visible !== true ||
    existing.default_position !== 'mid' ||
    existing.slug !== row.slug ||
    existing.name !== row.name
  ) {
    await sb.from('app_registry').update({
      name: row.name,
      slug: row.slug,
      tagline: row.tagline,
      description: row.description,
      tier: row.tier,
      price_monthly_aud: row.price_monthly_aud,
      price_annual_aud: row.price_annual_aud,
      default_position: row.default_position,
      marketplace_status: 'live',
      builder_visible: true,
      can_reposition: true,
      hero_exclusive: false,
      sort_order: row.sort_order,
      updated_at: row.updated_at
    }).eq('id', existing.id);
  }
}

async function ensureScrollingSponsorBannerApp() {
  const row = Object.assign({}, SCROLLING_SPONSOR_BANNER_APP, { updated_at: new Date().toISOString() });
  const { data: existing } = await sb.from('app_registry')
    .select('id,marketplace_status,builder_visible,default_position,name')
    .eq('section_key', 'scrollingSponsorBanner')
    .maybeSingle();
  if (!existing) {
    await sb.from('app_registry').upsert(row, { onConflict: 'slug' });
    return;
  }
  if (
    existing.marketplace_status !== 'live' ||
    existing.builder_visible !== true ||
    existing.default_position !== row.default_position ||
    existing.name !== row.name
  ) {
    await sb.from('app_registry').update({
      name: row.name,
      slug: row.slug,
      tagline: row.tagline,
      description: row.description,
      tier: row.tier,
      default_position: row.default_position,
      marketplace_status: 'live',
      builder_visible: true,
      can_reposition: true,
      hero_exclusive: false,
      sort_order: row.sort_order,
      updated_at: row.updated_at
    }).eq('id', existing.id);
  }
}

/**
 * Register / heal Promotions & Offers (sections.promotions).
 * Production historically had split promotions-hero / promotions-inline rows that
 * do not match the real config key — remap the primary row and retire leftovers.
 */
async function ensurePromotionsApp() {
  const row = Object.assign({}, PROMOTIONS_APP, { updated_at: new Date().toISOString() });
  const { data: related } = await sb.from('app_registry')
    .select('id,slug,section_key,marketplace_status,builder_visible,default_position,name')
    .in('section_key', ['promotions'].concat(STALE_PROMOTIONS_SECTION_KEYS));

  const list = related || [];
  const byKey = {};
  list.forEach(function(a) { byKey[a.section_key] = a; });

  let primary = byKey.promotions || byKey['promotions-hero'] || null;

  if (!primary) {
    await sb.from('app_registry').upsert(row, { onConflict: 'slug' });
  } else {
    const needsHeal =
      primary.section_key !== row.section_key ||
      primary.slug !== row.slug ||
      primary.name !== row.name ||
      primary.marketplace_status !== 'live' ||
      primary.builder_visible !== true ||
      primary.default_position !== row.default_position;
    if (needsHeal) {
      // Remap in-place so existing site_apps FKs keep working.
      const { error } = await sb.from('app_registry').update({
        name: row.name,
        slug: row.slug,
        section_key: row.section_key,
        tagline: row.tagline,
        description: row.description,
        tier: row.tier,
        price_monthly_aud: row.price_monthly_aud,
        price_annual_aud: row.price_annual_aud,
        default_position: row.default_position,
        marketplace_status: 'live',
        builder_visible: true,
        can_reposition: true,
        hero_exclusive: false,
        sort_order: row.sort_order,
        updated_at: row.updated_at
      }).eq('id', primary.id);
      if (error) throw error;
    }
  }

  // Hide stale split apps so App Marketplace shows one tile matching /marketplace/promotions.
  const stale = list.filter(function(a) {
    return a.id !== (primary && primary.id) && STALE_PROMOTIONS_SECTION_KEYS.indexOf(a.section_key) >= 0;
  });
  for (const s of stale) {
    if (s.builder_visible === false && s.marketplace_status === 'draft') continue;
    await sb.from('app_registry').update({
      marketplace_status: 'draft',
      builder_visible: false,
      updated_at: row.updated_at
    }).eq('id', s.id);
  }
}

module.exports = async (req, res) => {
  res.setHeader('access-control-allow-origin','*');
  res.setHeader('cache-control','s-maxage=120,stale-while-revalidate=300');
  try {
    const slug  = ((req.query&&req.query.slug)||'').trim();
    const all   = req.query&&req.query.all==='1';

    if (slug) {
      const {data:app,error} = await sb.from('app_registry')
        .select('*').eq('slug',slug).maybeSingle();
      if (error) return res.status(500).json({error:error.message});
      if (!app)  return res.status(404).json({error:'not_found'});
      const [{data:schema},{data:presets}] = await Promise.all([
        sb.from('app_schemas').select('schema,version').eq('app_id',app.id)
          .order('version',{ascending:false}).limit(1).maybeSingle(),
        sb.from('app_presets').select('slug,label,description,config,sort_order')
          .eq('app_id',app.id).eq('is_live',true).order('sort_order',{ascending:true})
      ]);
      const normalizedPresets = (presets || []).map(function(row) {
        return pp.normalizePreset(row.config || {}, {
          slug: row.slug,
          label: row.label,
          source: 'db',
          section_key: app.section_key
        });
      });
      return res.status(200).json({
        app,
        schema: schema || null,
        contract_version: pp.CONTRACT_VERSION,
        presets: normalizedPresets
      });
    }

    let q = sb.from('app_registry')
      .select('id,slug,section_key,name,tagline,tier,price_monthly_aud,price_annual_aud,default_position,can_reposition,hero_exclusive,api_dependency,marketplace_status,builder_visible,sort_order')
      .order('sort_order',{ascending:true});
    if (!all) q = q.eq('marketplace_status','live');
    if (all) {
      await ensureLpAccessibilityApp();
      await ensurePremiumGalleryApp();
      await ensureSearchCanvasApp();
      await ensureCustomHtmlApp();
      await ensurePromotionsApp();
      await ensureScrollingSponsorBannerApp();
    }
    // Public marketplace list should also auto-register SearchCanvas / Custom HTML / Promotions once.
    if (!all && !slug) {
      try { await ensureSearchCanvasApp(); } catch (_e) { /* non-fatal */ }
      try { await ensureCustomHtmlApp(); } catch (_e) { /* non-fatal */ }
      try { await ensurePromotionsApp(); } catch (_e) { /* non-fatal */ }
      try { await ensureScrollingSponsorBannerApp(); } catch (_e) { /* non-fatal */ }
    }
    const {data:apps,error:ae} = await q;
    if (ae) return res.status(500).json({error:ae.message});
    return res.status(200).json({apps:apps||[]});
  } catch(e) {
    return res.status(500).json({error:String(e&&e.message||e)});
  }
};
