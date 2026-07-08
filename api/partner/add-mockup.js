// api/partner/add-mockup.js — partner creates a DEMO mockup site.
//
// Payload: {
//   businessName?, industry?, themeId?, packSlug?, packId?,
//   seedContent?, starterPack?, targetLocation?
// }

const { createClient } = require('@supabase/supabase-js');
const { slugify, locationSlug, mergePackIntoConfig } = require('../../lib/trade-pack-utils');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

const clean = (s, n = 160) => (s == null ? '' : String(s)).trim().slice(0, n);

async function getUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const r = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
    });
    if (!r.ok) return null;
    const u = await r.json();
    if (!u || !u.id) return null;
    return { id: u.id, email: String(u.email || '').toLowerCase() };
  } catch (_e) {
    return null;
  }
}

function demoSlugify(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36) || 'demo';
}

async function uniqueSlug(base) {
  let slug = base;
  let i = 1;
  for (;;) {
    const r = await admin.from('sites').select('id').eq('slug', slug).maybeSingle();
    if (!r.data) return slug;
    i += 1;
    slug = base + '-' + i;
    if (i > 50) return base + '-' + Date.now().toString(36);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const user = await getUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const pr = await admin.from('partners').select('id,status').eq('user_id', user.id).maybeSingle();
  const partner = pr.data;
  if (!partner) return res.status(403).json({ ok: false, error: 'not a partner' });
  if (partner.status !== 'active') return res.status(403).json({ ok: false, error: 'partner account is ' + partner.status });

  const b = await readBody(req);
  const businessName = clean(b.businessName, 160) || 'Untitled demo';
  const industry = clean(b.industry, 80);
  const targetLocation = clean(b.targetLocation, 120) || clean(b.location && b.location.city, 120) || '';

  let config = { trade: industry || '', name: businessName };

  const themeId = clean(b.themeId, 80);
  if (themeId) {
    const t = await admin.from('partner_themes').select('config').eq('id', themeId).eq('partner_id', partner.id).maybeSingle();
    if (t.data && t.data.config && typeof t.data.config === 'object') {
      config = Object.assign({}, t.data.config);
      if (industry) config.trade = industry;
      config.name = businessName;
    }
  }

  if (b.seedContent && b.starterPack && typeof b.starterPack === 'object') {
    config = mergePackIntoConfig(config, b.starterPack, businessName, industry, targetLocation);
  } else if (targetLocation) {
    config.sections = config.sections || {};
    config.sections.seoTokens = Object.assign({}, config.sections.seoTokens || {}, {
      trade: industry || config.trade || '',
      location: targetLocation,
      city: targetLocation,
      suburb: targetLocation,
      region: targetLocation,
    });
  }

  config._mockup = {
    createdBy: partner.id,
    createdAt: new Date().toISOString(),
    packSlug: clean(b.packSlug, 80) || null,
    packVariant: parseInt(b.packVariant, 10) || 1,
    targetLocation: targetLocation || null,
  };

  const slug = await uniqueSlug(demoSlugify(businessName) + '-demo');
  const row = {
    slug,
    business_name: businessName,
    template: 'trade',
    vertical: 'trade',
    status: 'draft',
    is_mockup: true,
    config,
    referring_partner_id: partner.id,
    servicing_partner_id: partner.id,
    servicing_status: 'partner_serviced',
  };

  try {
    const ins = await admin.from('sites').insert(row).select('id,slug,business_name,status,is_mockup,show_on_showcase,config,created_at').single();
    if (ins.error || !ins.data) return res.status(500).json({ ok: false, error: 'Could not create the demo. Please try again.' });

    if (b.packSlug && targetLocation) {
      try {
        let q = admin
          .from('pack_location_usage')
          .update({ site_id: ins.data.id })
          .eq('pack_slug', b.packSlug)
          .eq('location_slug', locationSlug(targetLocation));
        const variant = parseInt(b.packVariant, 10) || 1;
        q = q.eq('pack_variant', variant);
        await q;
      } catch (_e) { /* table optional */ }
    }

    return res.status(200).json({ ok: true, site: ins.data });
  } catch (_e) {
    return res.status(500).json({ ok: false, error: 'Could not create the demo. Please try again.' });
  }
};
