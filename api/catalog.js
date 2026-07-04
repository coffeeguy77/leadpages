// api/catalog.js — PUBLIC marketplace catalogue.
// GET /api/catalog            -> { categories:[...], features:[...] } (live only)
// GET /api/catalog?slug=<f>   -> { feature:{...}, blocks:[...] }
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('cache-control', 's-maxage=300, stale-while-revalidate=600');
  try {
    const slug = ((req.query && req.query.slug) || '').trim();

    if (slug) {
      const { data: feature, error } = await supabase
        .from('catalog_features')
        .select('id,slug,name,tagline,summary,hero_image_url,demo_url,badge,category_id,status,section_key')
        .eq('slug', slug).eq('status', 'live').maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!feature) return res.status(404).json({ error: 'not_found' });
      const { data: blocks } = await supabase
        .from('catalog_blocks')
        .select('id,sort_order,block_type,payload')
        .eq('feature_id', feature.id)
        .order('sort_order', { ascending: true });
      return res.status(200).json({ feature, blocks: blocks || [] });
    }

    const [cats, feats] = await Promise.all([
      supabase.from('catalog_categories')
        .select('id,slug,name,blurb,sort_order,image_url')
        .eq('is_live', true).order('sort_order', { ascending: true }),
      supabase.from('catalog_features')
        .select('id,slug,name,tagline,summary,hero_image_url,demo_url,badge,category_id,sort_order')
        .eq('status', 'live').order('sort_order', { ascending: true })
    ]);
    if (cats.error)  return res.status(500).json({ error: cats.error.message });
    if (feats.error) return res.status(500).json({ error: feats.error.message });
    return res.status(200).json({ categories: cats.data || [], features: feats.data || [] });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};
