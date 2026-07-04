// api/partner-directory-self.js
// GET  -> {listing}  the signed-in partner's own directory entry (or null)
// POST {action:'save', ...fields} -> upsert their listing
// POST {action:'hide'}  -> set is_live=false
// POST {action:'publish'} -> set is_live=true
// Auth: Supabase session; resolves partner via partners.user_id

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const STATES = ['ACT','NSW','VIC','QLD','SA','WA','TAS','NT'];
function clean(s, n) { return String(s == null ? '' : s).trim().slice(0, n || 500); }

async function getUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const r = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  try {
    // Resolve partner row from user_id
    let { data: partner } = await sb.from('partners')
      .select('id,display_name,email,phone,status')
      .eq('user_id', user.id).maybeSingle();
    // Fallback: match by email if user_id not linked yet
    if (!partner && user.email) {
      const { data: byEmail } = await sb.from('partners')
        .select('id,display_name,email,phone,status')
        .eq('email', user.email).maybeSingle();
      if (byEmail) {
        partner = byEmail;
        // Back-fill user_id so future lookups are fast
        await sb.from('partners').update({ user_id: user.id }).eq('id', byEmail.id);
      }
    }
    if (!partner) return res.status(404).json({ error: 'no partner account found' });
    if (partner.status !== 'active')
      return res.status(403).json({ error: 'partner account is not active' });

    // GET — return their current listing
    if (req.method === 'GET') {
      const { data: listing } = await sb.from('partner_directory')
        .select('*').eq('partner_id', partner.id).maybeSingle();
      return res.status(200).json({ listing: listing || null, partner });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST only' });

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};
    const action = String(body.action || 'save').trim();

    if (action === 'hide') {
      await sb.from('partner_directory').update({ is_live: false })
        .eq('partner_id', partner.id);
      return res.status(200).json({ ok: true });
    }
    if (action === 'publish') {
      await sb.from('partner_directory').update({ is_live: true })
        .eq('partner_id', partner.id);
      return res.status(200).json({ ok: true });
    }

    // save / upsert
    const bizName = clean(body.business_name || partner.display_name, 200);
    if (!bizName) return res.status(400).json({ error: 'Business name is required.' });
    const state = String(body.state || '').toUpperCase();

    // Check if listing already exists
    const { data: existing } = await sb.from('partner_directory')
      .select('id').eq('partner_id', partner.id).maybeSingle();

    const row = {
      partner_id: partner.id,
      business_name: bizName,
      suburb: clean(body.suburb, 120) || null,
      state: STATES.includes(state) ? state : null,
      postcode: clean(body.postcode, 10) || null,
      blurb: clean(body.blurb, 400) || null,
      website_url: clean(body.website_url, 300) || null,
      photo_url: clean(body.photo_url, 500) || null,
      email: clean(body.email, 200) || partner.email || null,
      phone: clean(body.phone, 60) || partner.phone || null,
      specialties: Array.isArray(body.specialties)
        ? body.specialties.map((s) => String(s).trim()).filter(Boolean).slice(0, 8)
        : null,
      // New listings go live immediately — admin can hide if needed
      is_live: true,
    };

    let error;
    if (existing) {
      ({ error } = await sb.from('partner_directory')
        .update(row)
        .eq('partner_id', partner.id));
    } else {
      ({ error } = await sb.from('partner_directory').insert(row));
    }
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, created: !existing });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message || e) });
  }
};
