// api/leads.js — receives a lead from any landing page or the brokerAPP and writes
// it to Supabase. Server-side only; uses the service_role key (bypasses RLS), so it
// must never be exposed to the browser — keep SUPABASE_SERVICE_ROLE_KEY in Vercel env.

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

    // Need the site, the vertical, and at least one way to contact the lead.
    // (The brokerAPP "email me results" capture has email but no phone.)
    if (!site || !kind || (!phone && !email)) {
      return res.status(400).json({ error: 'Missing site, kind, or a contact (phone or email)' });
    }

    const { error } = await supabase.from('leads').insert({
      site,
      kind,                       // 'broker' | 'trade'
      name:  name  || null,
      email: email || null,
      phone: phone || null,
      details: details || {}      // jsonb — per-source fields (source, message, calc, etc.)
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
