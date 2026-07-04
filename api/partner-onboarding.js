// api/partner-onboarding.js
// GET  ?partnerId=  -> {steps, partner}  (the partner's own progress)
// POST { step, data? } -> mark a step complete
// Secured: the caller must be the linked partner (via user_id) or a super admin.

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const STEPS = [
  'welcome',          // read the welcome + overview
  'platform_tour',    // watched/completed the builder walkthrough
  'demo_site',        // built their first demo site
  'first_template',   // saved their first partner template
  'first_client',     // added their first real client site
  'directory_listed', // added themselves to the partner directory
];

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

async function resolvePartner(user, partnerId) {
  // Admin: can pass partnerId directly
  const { data: profile } = await sb.from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle();
  const admin = !!(profile && profile.is_super_admin);
  if (admin && partnerId) {
    const { data } = await sb.from('partners').select('*').eq('id', partnerId).maybeSingle();
    return { partner: data, admin };
  }
  // Self: find by user_id
  const { data } = await sb.from('partners').select('*').eq('user_id', user.id).maybeSingle();
  return { partner: data, admin };
}

module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  try {
    let partnerId = null;
    try { partnerId = new URL(req.url, 'http://x').searchParams.get('partnerId'); } catch (e) {}

    const { partner, admin } = await resolvePartner(user, partnerId);
    if (!partner) return res.status(404).json({ error: 'partner not found' });

    if (req.method === 'GET') {
      const { data: progress } = await sb.from('partner_onboarding')
        .select('step,completed_at,data').eq('partner_id', partner.id);
      const completedMap = {};
      (progress || []).forEach((p) => { completedMap[p.step] = p; });
      const steps = STEPS.map((s) => ({
        key: s, completed: !!(completedMap[s] && completedMap[s].completed_at),
        completed_at: (completedMap[s] && completedMap[s].completed_at) || null,
        data: (completedMap[s] && completedMap[s].data) || {},
      }));
      const pct = Math.round((steps.filter((s) => s.completed).length / STEPS.length) * 100);
      return res.status(200).json({ partner, steps, pct, total: STEPS.length });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
      body = body || {};
      const step = String(body.step || '').trim();
      if (!STEPS.includes(step)) return res.status(400).json({ error: 'unknown step: ' + step });
      const now = new Date().toISOString();
      const { error } = await sb.from('partner_onboarding').upsert({
        partner_id: partner.id, step,
        completed_at: body.completed === false ? null : now,
        data: body.data || {},
      }, { onConflict: 'partner_id,step' });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'GET or POST only' });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message || e) });
  }
};
