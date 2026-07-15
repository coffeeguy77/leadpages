// api/stats.js — powers the Visitors / Calls / Forms / Conversion dashboard in
// /manage. The dashboard calls GET /api/stats?siteId=<id>&days=<n> with the
// logged-in user's Supabase token; global (all-sites) view omits siteId.
//
// Returns merged raw + daily-rollup events. Rolled rows include `count` and
// `rolled: true` so totals stay correct after archival.
//
// Auth: Authorization: Bearer <supabase access token>. Uses service role to
// read (so it doesn't depend on RLS being configured on the events table).

const { createClient } = require('@supabase/supabase-js');
const { keepDays, dailyToStatsEvents, retentionCutoffIso, dayKey } = require('../lib/event-rollup');

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

async function loadDaily(siteId, since) {
  try {
    let q = admin.from('event_daily')
      .select('site_id,day,event,count,locations')
      .gte('day', dayKey(since))
      .order('day', { ascending: true })
      .limit(20000);
    if (siteId) q = q.eq('site_id', siteId);
    const { data, error } = await q;
    if (error) {
      // Table missing until migration applied — ignore softly
      if (/event_daily|does not exist|42P01/i.test(error.message || '')) return [];
      throw error;
    }
    return data || [];
  } catch (e) {
    if (/event_daily|does not exist|42P01/i.test(e && e.message || '')) return [];
    throw e;
  }
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
    const keep = keepDays();
    const rawFloor = retentionCutoffIso(Date.now(), keep);
    // Raw query from max(since, a bit before retention) — daily covers older days.
    const rawSince = since > rawFloor ? since : rawFloor;

    if (!siteId) {
      const [ev, daily] = await Promise.all([
        admin.from('events').select('event,site_id,created_at').gte('created_at', rawSince).limit(20000),
        loadDaily(null, since)
      ]);
      const rolled = dailyToStatsEvents(daily);
      const raw = (ev.data || []).map(function (r) {
        return { event: r.event, site_id: r.site_id, created_at: r.created_at, count: 1 };
      });
      return json(200, {
        events: rolled.concat(raw),
        meta: { keepDays: keep, rawSince: rawSince, rolledRows: rolled.length, rawRows: raw.length }
      });
    }

    const [ev, ld, all, daily] = await Promise.all([
      admin.from('events').select('event,created_at,props').eq('site_id', siteId).gte('created_at', rawSince).limit(10000),
      admin.from('leads').select('name,kind,created_at,status').eq('site_id', siteId).gte('created_at', since).order('created_at', { ascending: false }).limit(50),
      admin.from('leads').select('status').eq('site_id', siteId).gte('created_at', since),
      loadDaily(siteId, since)
    ]);

    const statusCounts = { new: 0, contacted: 0, won: 0, lost: 0, total: 0 };
    (all.data || []).forEach((r) => { statusCounts.total++; const s = (r.status || 'new'); if (statusCounts[s] != null) statusCounts[s]++; });

    const rolled = dailyToStatsEvents(daily);
    const raw = (ev.data || []).map(function (r) {
      return { event: r.event, created_at: r.created_at, props: r.props || null, count: 1 };
    });

    return json(200, {
      events: rolled.concat(raw),
      leads: ld.data || [],
      leadsCount: statusCounts.total,
      statusCounts,
      meta: { keepDays: keep, rawSince: rawSince, rolledRows: rolled.length, rawRows: raw.length }
    });
  } catch (e) {
    console.error('stats error:', e && e.message);
    return json(500, { error: 'server' });
  }
};
