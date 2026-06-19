// api/admin-data.js — powers the admin dashboard.
// Password-gated (ADMIN_PASSWORD env var). Reads leads + events per site with the
// service_role key. This is a simple single-admin gate for now; per-client logins
// come with Supabase Auth + RLS when we onboard external clients.

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { password, site } = req.body || {};
    const expected = process.env.ADMIN_PASSWORD;

    if (!expected) {
      return res.status(500).json({ error: 'ADMIN_PASSWORD is not set in the environment yet.' });
    }
    if (!password || password !== expected) {
      return res.status(401).json({ error: 'Wrong password' });
    }

    // All sites (for the picker)
    const { data: sites, error: se } = await supabase
      .from('sites')
      .select('id, slug, business_name, vertical')
      .order('business_name');
    if (se) throw se;

    // Optional filter to one site (by business_name, which leads/events store)
    const filterSite = site && site !== 'all' ? site : null;

    let leadsQ = supabase
      .from('leads')
      .select('created_at, name, phone, kind, details')
      .order('created_at', { ascending: false })
      .limit(500);
    let eventsQ = supabase
      .from('events')
      .select('created_at, event, site')
      .order('created_at', { ascending: false })
      .limit(2000);

    if (filterSite) {
      leadsQ = leadsQ.eq('site', filterSite);
      eventsQ = eventsQ.eq('site', filterSite);
    }

    const [{ data: leads, error: le }, { data: events, error: ee }] =
      await Promise.all([leadsQ, eventsQ]);
    if (le) throw le;
    if (ee) throw ee;

    const stats = { leads: leads.length, page_view: 0, call_click: 0, lead_submit: 0, calc_freq: 0 };
    for (const ev of events) {
      if (stats[ev.event] !== undefined) stats[ev.event]++;
    }

    return res.status(200).json({
      ok: true,
      sites: sites || [],
      selected: filterSite || 'all',
      stats,
      leads: leads || [],
      recentEvents: (events || []).slice(0, 30)
    });
  } catch (e) {
    console.error('admin-data error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
};
