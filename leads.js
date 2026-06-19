// api/leads.js — receives a lead from any landing page and writes it to Supabase.
// Runs server-side only. Uses the service_role key (bypasses RLS), so it must
// never be exposed to the browser — keep SUPABASE_SERVICE_ROLE_KEY in Vercel env vars.

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
    const { site, kind, name, email, phone, details } = req.body || {};

    // Minimum we need to act on a lead.
    if (!site || !kind || !phone) {
      return res.status(400).json({ error: 'Missing site, kind or phone' });
    }

    const { error } = await supabase.from('leads').insert({
      site,
      kind,                       // 'broker' | 'trade'
      name:  name  || null,
      email: email || null,
      phone,
      details: details || {}      // jsonb — the per-vertical fields
    });

    if (error) {
      console.error('Supabase insert (leads) failed:', error);
      return res.status(500).json({ error: 'Could not save lead' });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('leads handler error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
};
