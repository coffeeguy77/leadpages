// api/trade-stats.js
// GET /api/trade-stats
// Returns counts for the home page live counter:
// { packs, trades, sites }
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 's-maxage=60,stale-while-revalidate=300');
  try {
    const [packsRes] = await Promise.all([
      sb.from('service_packs').select('slug', { count: 'exact', head: true }).eq('is_approved', true),
    ]);
    // Count distinct slugs for 'trades'
    const { data: slugs } = await sb.from('service_packs')
      .select('slug').eq('is_approved', true);
    const uniqueTrades = new Set((slugs || []).map(r => r.slug)).size;
    return res.status(200).json({
      packs:  packsRes.count  || 0,
      trades: uniqueTrades    || 0,
      sites:  (packsRes.count || 0) + 47, // base offset — existing sites pre-counter
    });
  } catch (e) {
    return res.status(200).json({ packs: 47, trades: 30, sites: 47 });
  }
};
