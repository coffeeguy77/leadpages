// api/site-apps-config.js
// GET /api/site-apps-config?site_id=<id>
// Returns {sections:{key:{on,config}}, sectionOrder:[...keys], ghostKeys:[...]}
// Used by the in-page loader to merge into SITE_CONFIG before template init runs.
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Position slot order — determines the global section sequence
const SLOT_ORDER = ['nav','hero','upper','mid','lower','footer'];

module.exports = async (req, res) => {
  res.setHeader('access-control-allow-origin','*');
  res.setHeader('cache-control','s-maxage=60,stale-while-revalidate=120');
  res.setHeader('content-type','application/json');

  const site_id = ((req.query && req.query.site_id) || '').trim();
  if (!site_id) return res.status(400).json({error:'site_id required'});

  try {
    // Get enabled apps with registry info and subscription status
    const { data, error } = await sb
      .from('site_apps')
      .select(`
        app_id, enabled, position_slot, position_order, config,
        app_registry(section_key, tier, default_position),
        site_app_subscriptions(status, access_until)
      `)
      .eq('site_id', site_id)
      .eq('enabled', true);

    if (error) return res.status(500).json({error: error.message});

    const rows = data || [];
    const now = new Date();
    const sections = {};
    const ghostKeys = [];
    const ordered = [];

    rows.forEach(function(row) {
      const reg = row.app_registry;
      if (!reg) return;
      const key = reg.section_key;
      const tier = reg.tier;
      const sub = row.site_app_subscriptions && row.site_app_subscriptions[0];

      // Determine if this app is active or ghost
      let active = true;
      if (tier === 'paid' || tier === 'metered') {
        if (!sub || sub.status === 'cancelled') {
          active = false;
        } else if (sub.status === 'suspended') {
          active = false;
        } else if (sub.access_until && new Date(sub.access_until) < now) {
          active = false;
        }
      }

      // Merge config — spread app config over section config
      const cfg = Object.assign({}, row.config || {});
      if (!active) {
        cfg.__ghost = true; // renderer uses this to add ghost class
      }
      sections[key] = Object.assign({on: true}, cfg);
      if (!active) ghostKeys.push(key);

      ordered.push({
        key,
        slotIdx: SLOT_ORDER.indexOf(row.position_slot || reg.default_position || 'mid'),
        order: row.position_order || 0
      });
    });

    // Build sectionOrder array
    ordered.sort(function(a, b) {
      if (a.slotIdx !== b.slotIdx) return a.slotIdx - b.slotIdx;
      return a.order - b.order;
    });
    const sectionOrder = ordered.map(function(o) { return o.key; });

    return res.status(200).json({ sections, sectionOrder, ghostKeys });
  } catch(e) {
    return res.status(500).json({error: String(e && e.message || e)});
  }
};
