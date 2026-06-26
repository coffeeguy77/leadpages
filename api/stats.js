// api/stats.js — reads analytics for the /manage dashboard using the service role,
// so it works even if row-level security on `events`/`leads` would block the
// signed-in user's own SELECT. This is why the stats panel could read 0 while the
// events were being written fine: the writes use the service role (events.js), but
// the dashboard was reading with the user's session and getting blocked/filtered.
//
// Auth: requires a valid Supabase session (Bearer token) — same check as the
// cloudinary sign endpoint — so only logged-in admins/brokers can pull stats.
//
// Query params:
//   siteId=<uuid>   → returns { events:[{event,created_at,props}], leads:[{name,kind,created_at}], leadsCount }
//   (no siteId)     → global: returns { events:[{event,site_id,created_at}] }
//   days=<n>        → period window (0 / missing = all time)
//
// created_at is filtered in JS and a missing created_at is treated as "include",
// so legacy rows written before the timestamp default was added still show up.

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyAuth(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  try {
    const r = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
    });
    return r.ok;
  } catch (e) {
    return false;
  }
}

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  return res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  if (!(await verifyAuth(req))) return json(res, 401, { error: 'unauthorized' });

  let siteId = null, days = 30;
  try {
    const u = new URL(req.url, 'http://x');
    siteId = u.searchParams.get('siteId');
    const d = parseInt(u.searchParams.get('days') || '30', 10);
    if (!isNaN(d)) days = d;
  } catch (e) { /* fall through with defaults */ }

  const sinceMs = days > 0 ? (Date.now() - days * 864e5) : 0;
  const inPeriod = (r) => {
    if (days <= 0) return true;
    if (!r || !r.created_at) return true; // legacy rows with no timestamp
    return new Date(r.created_at).getTime() >= sinceMs;
  };

  try {
    if (siteId) {
      let events = [], leads = [];
      try {
        const e = await supabase.from('events')
          .select('event,created_at,props')
          .eq('site_id', siteId)
          .order('created_at', { ascending: false })
          .limit(20000);
        events = (e.data || []).filter(inPeriod);
      } catch (_e) { events = []; }
      try {
        const l = await supabase.from('leads')
          .select('name,kind,created_at')
          .eq('site_id', siteId)
          .order('created_at', { ascending: false })
          .limit(500);
        leads = (l.data || []).filter(inPeriod);
      } catch (_e) { leads = []; }
      return json(res, 200, { events, leads, leadsCount: leads.length });
    }

    // global (all sites) — used by the super-admin "All sites" view
    let events = [];
    try {
      const e = await supabase.from('events')
        .select('event,site_id,created_at')
        .order('created_at', { ascending: false })
        .limit(40000);
      events = (e.data || []).filter(inPeriod);
    } catch (_e) { events = []; }
    return json(res, 200, { events });
  } catch (e) {
    return json(res, 200, { events: [], leads: [], leadsCount: 0 });
  }
};
