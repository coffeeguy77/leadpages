// api/stats.js — powers the Visitors / Calls / Forms / Conversion dashboard in
// /manage. The dashboard calls GET /api/stats?siteId=<id>&days=<n> with the
// logged-in user's Supabase token; global (all-sites) view omits siteId.
//
// Returns (per site):
//   { events:[{event,created_at,props}], leads:[{name,kind,created_at,status}],
//     leadsCount, statusCounts:{new,contacted,won,lost,total} }
// Returns (global):
//   { events:[{event,site_id,created_at}] }
//
// Auth: Authorization: Bearer <supabase access token>. Uses service role to
// read (so it doesn't depend on RLS being configured on the events table).

const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL;
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function requireUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  try {
    const userClient = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: 'Bearer ' + token } }
    });
    const { data, error } = await userClient.auth.getUser(token);
    if (error || !data || !data.user) return null;
    return data.user;
  } catch { return null; }
}

function sinceIso(days) {
  const d = parseInt(days, 10);
  if (!d || d <= 0) return '1970-01-01T00:00:00Z';
  return new Date(Date.now() - d * 86400000).toISOString();
}

module.exports = async (req, res) => {
  const json = (code, obj) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); };
  if (req.method !== 'GET') return json(405, { error: 'method' });

  const user = await requireUser(req);
  if (!user) return json(401, { error: 'auth' });

  try {
    const url = new URL(req.url, 'https://x');
    const siteId = (url.searchParams.get('siteId') || '').trim();
    const since = sinceIso(url.searchParams.get('days'));

    // Global view: events across all sites (super-admin overview table).
    if (!siteId) {
      const ev = await admin.from('events').select('event,site_id,created_at').gte('created_at', since).limit(20000);
      return json(200, { events: ev.data || [] });
    }

    // Per-site view.
    const ev = await admin.from('events').select('event,created_at,props').eq('site_id', siteId).gte('created_at', since).limit(10000);
    const ld = await admin.from('leads').select('name,kind,created_at,status').eq('site_id', siteId).gte('created_at', since).order('created_at', { ascending: false }).limit(50);
    const all = await admin.from('leads').select('status').eq('site_id', siteId).gte('created_at', since);

    const statusCounts = { new: 0, contacted: 0, won: 0, lost: 0, total: 0 };
    (all.data || []).forEach((r) => { statusCounts.total++; const s = (r.status || 'new'); if (statusCounts[s] != null) statusCounts[s]++; });

    return json(200, {
      events: ev.data || [],
      leads: ld.data || [],
      leadsCount: statusCounts.total,
      statusCounts
    });
  } catch (e) {
    console.error('stats error:', e && e.message);
    return json(500, { error: 'server' });
  }
};
