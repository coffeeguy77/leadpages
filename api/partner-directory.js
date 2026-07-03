// api/partner-directory.js — PUBLIC: live partner directory entries.
// GET /api/partner-directory[?state=ACT]
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const STATES = ['ACT','NSW','VIC','QLD','SA','WA','TAS','NT'];

module.exports = async (req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('cache-control', 's-maxage=300, stale-while-revalidate=600');
  try {
    let q = supabase.from('partner_directory')
      .select('id,business_name,suburb,state,postcode,blurb,website_url,sort_order')
      .eq('is_live', true)
      .order('sort_order', { ascending: true })
      .order('business_name', { ascending: true });
    const st = ((req.query && req.query.state) || '').toUpperCase();
    if (STATES.includes(st)) q = q.eq('state', st);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ partners: data || [] });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};
