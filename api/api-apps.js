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
    }
    const {data:apps,error:ae} = await q;
    if (ae) return res.status(500).json({error:ae.message});
    return res.status(200).json({apps:apps||[]});
  } catch(e) {
    return res.status(500).json({error:String(e&&e.message||e)});
  }
};
