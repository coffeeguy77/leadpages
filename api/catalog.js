// api/catalog.js — PUBLIC marketplace catalogue.
// GET /api/catalog            -> { categories:[...], features:[...] } (live only)
// GET /api/catalog?slug=<f>   -> { feature:{...}, blocks:[...] }
// Falls back to sell-templates + marketing aliases when Supabase rows lack playgrounds.
const { createClient } = require('@supabase/supabase-js');
const demoSites = require('../lib/demo-sites');
const resolve = require('../lib/marketplace-catalog-resolve');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('cache-control', 's-maxage=60, stale-while-revalidate=300');
  try {
    const slug = ((req.query && req.query.slug) || '').trim().toLowerCase();

    if (slug) {
      let feature = null;
      let blocks = [];
      try {
        const { data, error } = await supabase
          .from('catalog_features')
          .select('id,slug,name,tagline,summary,hero_image_url,demo_url,badge,category_id,status,section_key')
          .eq('slug', slug).eq('status', 'live').maybeSingle();
        if (!error && data) {
          feature = data;
          const { data: blks } = await supabase
            .from('catalog_blocks')
            .select('id,sort_order,block_type,payload')
            .eq('feature_id', feature.id)
            .order('sort_order', { ascending: true });
          blocks = blks || [];
        }
      } catch (_e) {
        /* fall through to static */
      }

      const enriched = resolve.enrichCatalogPayload(feature, blocks, slug);
      if (!enriched.feature) {
        const staticPayload = resolve.resolveFromStatic(slug);
        if (!staticPayload) return res.status(404).json({ error: 'not_found' });
        return res.status(200).json(staticPayload);
      }

      if (!enriched.feature.demo_url && enriched.feature.section_key) {
        const site = demoSites.getDemoSiteForApp(enriched.feature.section_key);
        if (site && site.url) enriched.feature.demo_url = site.url;
      }
      return res.status(200).json(enriched);
    }

    const [cats, feats] = await Promise.all([
      supabase.from('catalog_categories')
        .select('id,slug,name,blurb,sort_order,image_url')
        .eq('is_live', true).order('sort_order', { ascending: true }),
      supabase.from('catalog_features')
        .select('id,slug,name,tagline,summary,hero_image_url,demo_url,badge,category_id,sort_order,section_key,status')
        .eq('status', 'live').order('sort_order', { ascending: true })
    ]);
    if (cats.error) return res.status(500).json({ error: cats.error.message });
    if (feats.error) return res.status(500).json({ error: feats.error.message });

    // Ensure marketing hub aliases appear even if missing from DB
    const features = (feats.data || []).slice();
    const seen = {};
    features.forEach(function (f) { if (f && f.slug) seen[f.slug] = 1; });
    Object.keys(resolve.MARKETING_ALIASES).forEach(function (aliasSlug) {
      if (seen[aliasSlug]) return;
      const staticPayload = resolve.resolveFromStatic(aliasSlug);
      if (staticPayload && staticPayload.feature) {
        features.push({
          id: staticPayload.feature.id,
          slug: staticPayload.feature.slug,
          name: staticPayload.feature.name,
          tagline: staticPayload.feature.tagline,
          summary: staticPayload.feature.summary,
          hero_image_url: staticPayload.feature.hero_image_url,
          demo_url: staticPayload.feature.demo_url,
          badge: staticPayload.feature.badge,
          category_id: staticPayload.feature.category_id,
          sort_order: 900,
          section_key: staticPayload.feature.section_key,
          status: 'live'
        });
      }
    });

    return res.status(200).json({ categories: cats.data || [], features: features });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};
