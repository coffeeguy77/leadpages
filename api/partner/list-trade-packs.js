// GET /api/partner/list-trade-packs — approved community trade packs for picker merge.

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getPartner(token) {
  if (!token) return null;
  try {
    const ur = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
    });
    const user = await ur.json();
    if (!user || !user.id) return null;
    const pr = await sb.from('partners').select('id,status').eq('user_id', user.id).maybeSingle();
    if (!pr.data || pr.data.status !== 'active') return null;
    return pr.data;
  } catch (_e) {
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'private, max-age=120');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!await getPartner(token)) {
    return res.status(401).json({ ok: false, error: 'Active partner sign-in required' });
  }

  try {
    const { data, error } = await sb
      .from('service_packs')
      .select('slug,category,label,variant')
      .eq('is_approved', true)
      .order('label', { ascending: true });
    if (error) return res.status(500).json({ ok: false, error: error.message });

    const bySlug = {};
    (data || []).forEach((row) => {
      if (!bySlug[row.slug]) {
        bySlug[row.slug] = { slug: row.slug, label: row.label, category: row.category || 'General', variants: 0 };
      }
      bySlug[row.slug].variants += 1;
    });

    return res.status(200).json({ ok: true, packs: Object.values(bySlug) });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
