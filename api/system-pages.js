// api/billing/system-pages.js
// GET  — returns all suspended page variants from system_pages table
// POST { key, content } — saves a variant

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const VALID_KEYS = ['suspended_client', 'suspended_demo', 'suspended_system'];

const DEFAULTS = {
  suspended_client: {
    heading: 'Site temporarily unavailable',
    sub: 'This site is currently suspended. If you manage this site, please contact your web designer to restore access.',
    cta: 'Contact support',
    bg: '#1a1a1a', text: '#ffffff', accent: '#1f7a63'
  },
  suspended_demo: {
    heading: 'Demo site suspended',
    sub: 'This demo site has been suspended. Contact LeadPages to reactivate.',
    cta: 'Get in touch',
    bg: '#1a1a1a', text: '#ffffff', accent: '#1f7a63'
  },
  suspended_system: {
    heading: 'Temporarily offline',
    sub: 'This site is temporarily offline for maintenance. Please check back soon.',
    cta: '',
    bg: '#1a1a1a', text: '#ffffff', accent: '#1f7a63'
  }
};

module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');

  // Auth — super admin only
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Unauthorised' });

  try {
    const ur = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token }
    });
    const user = await ur.json();
    if (!user || !user.id) return res.status(401).json({ error: 'Invalid session' });

    const { data: prof } = await sb.from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle();
    if (!prof || !prof.is_super_admin) return res.status(403).json({ error: 'Super admin only' });
  } catch (e) {
    return res.status(401).json({ error: 'Auth failed' });
  }

  // ── GET ───────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const { data } = await sb.from('system_pages').select('key, content').in('key', VALID_KEYS);
      const rows = data || [];
      const pages = VALID_KEYS.map(key => {
        const row = rows.find(r => r.key === key);
        return { key, content: row ? row.content : DEFAULTS[key] };
      });
      return res.status(200).json({ ok: true, pages });
    } catch (e) {
      // Table might not exist yet — return defaults
      const pages = VALID_KEYS.map(key => ({ key, content: DEFAULTS[key] }));
      return res.status(200).json({ ok: true, pages });
    }
  }

  // ── POST ──────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    const { key, content } = body || {};
    if (!key || !VALID_KEYS.includes(key)) return res.status(400).json({ error: 'Invalid key' });
    if (!content || typeof content !== 'object') return res.status(400).json({ error: 'Invalid content' });

    try {
      const { error } = await sb.from('system_pages').upsert({ key, content }, { onConflict: 'key' });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
