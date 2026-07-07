// api/marketplace-setup.js
// POST { action: 'setup_all' | 'setup_one', section_key? }  (super admin)
const { createClient } = require('@supabase/supabase-js');
const { seedMarketplaceCatalog } = require('../lib/marketplace-catalog-seed');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'string') {
        try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); }
      }
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
  });
}

async function requireSuperAdmin(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const userClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: 'Bearer ' + token } }
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return null;
  const { data: prof } = await sb.from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle();
  if (!prof || !prof.is_super_admin) return null;
  return user;
}

module.exports = async (req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'POST, OPTIONS');
  res.setHeader('access-control-allow-headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const user = await requireSuperAdmin(req);
    if (!user) return res.status(403).json({ error: 'super_admin_required' });

    const body = await readBody(req);
    const action = (body.action || 'setup_all').trim();
    const sectionKey = (body.section_key || '').trim();

    if (action === 'setup_all') {
      const result = await seedMarketplaceCatalog(sb, {});
      return res.status(200).json({ ok: true, action, result });
    }

    if (action === 'setup_one') {
      if (!sectionKey) return res.status(400).json({ error: 'section_key required' });
      const result = await seedMarketplaceCatalog(sb, { sectionKeys: [sectionKey] });
      return res.status(200).json({ ok: true, action, section_key: sectionKey, result });
    }

    return res.status(400).json({ error: 'unknown_action' });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};
