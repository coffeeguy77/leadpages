// api/events.js — receives a tracking event (page_view, call_click, lead_submit, calc_freq)
// and writes it to Supabase. Server-side only; same service_role key as leads.

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
    const { site, event, props } = req.body || {};

    if (!site || !event) {
      return res.status(400).json({ error: 'Missing site or event' });
    }

    const { error } = await supabase.from('events').insert({
      site,
      event,                  // page_view | call_click | lead_submit | calc_freq
      props: props || {}
    });

    if (error) {
      console.error('Supabase insert (events) failed:', error);
      return res.status(500).json({ error: 'Could not save event' });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('events handler error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
};
