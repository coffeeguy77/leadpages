// api/partner/new-site.js — a partner makes a new (draft) website from one of their designs.
//
// Only partners with partners.can_create_sites = true (a super-admin switch) can use it.
// The new site is a normal client site, NOT a demo: is_mockup false, so it never gets the
// Buy Now bar. The design's content is copied as-is (no starter pack written over it).
// A super admin viewing a partner's dashboard ("as" partner) can create on their behalf.
//
// Payload: { businessName, themeId, asPartnerId? }

const { createClient } = require('@supabase/supabase-js');
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); } }
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
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
    return u && u.id ? { id: u.id } : null;
  } catch (_e) { return null; }
}
async function isSuper(userId) {
  try {
    const r = await admin.from('profiles').select('is_super_admin').eq('id', userId).maybeSingle();
    return !!(r.data && r.data.is_super_admin);
  } catch (_e) { return false; }
}
function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'site';
}
async function uniqueSlug(base) {
  let slug = base, i = 1;
  for (;;) {
    const r = await admin.from('sites').select('id').eq('slug', slug).maybeSingle();
    if (!r.data) return slug;
    i += 1; slug = base + '-' + i;
    if (i > 50) return base + '-' + Date.now().toString(36);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const user = await getUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'unauthorized' });
  const b = await readBody(req);

  let partner = null;
  const asPartnerId = clean(b.asPartnerId, 80);
  if (asPartnerId) {
    if (!(await isSuper(user.id))) return res.status(403).json({ ok: false, error: 'forbidden' });
    partner = (await admin.from('partners').select('id,status,can_create_sites').eq('id', asPartnerId).maybeSingle()).data;
  } else {
    partner = (await admin.from('partners').select('id,status,can_create_sites').eq('user_id', user.id).maybeSingle()).data;
  }
  if (!partner) return res.status(403).json({ ok: false, error: 'not a partner' });
  if (partner.status !== 'active') return res.status(403).json({ ok: false, error: 'partner account is ' + partner.status });
  if (!partner.can_create_sites) return res.status(403).json({ ok: false, error: 'New websites aren’t switched on for this account. Please contact LeadPages.' });

  const businessName = clean(b.businessName, 160);
  if (!businessName) return res.status(400).json({ ok: false, error: 'Give the website a name.' });
  const themeId = clean(b.themeId, 80);
  if (!themeId) return res.status(400).json({ ok: false, error: 'Choose a design.' });

  const t = (await admin.from('partner_themes').select('id,name,config,partner_id,shared_with_partners,source_site_id').eq('id', themeId).maybeSingle()).data;
  if (!t || !(t.partner_id === partner.id || t.shared_with_partners === true)) return res.status(404).json({ ok: false, error: 'Design not found.' });
  if (!t.config || typeof t.config !== 'object') return res.status(400).json({ ok: false, error: 'That design has no content.' });

  let template = 'trade', vertical = 'trade';
  if (t.source_site_id) {
    const src = (await admin.from('sites').select('template,vertical').eq('id', t.source_site_id).maybeSingle()).data;
    if (src) { template = src.template || template; vertical = src.vertical || vertical; }
  }

  const config = JSON.parse(JSON.stringify(t.config));
  delete config._mockup;
  config._createdFrom = { themeId: t.id, themeName: t.name || null, partnerId: partner.id, at: new Date().toISOString() };

  const row = {
    slug: await uniqueSlug(slugify(businessName)),
    business_name: businessName,
    template,
    vertical,
    status: 'draft',
    is_mockup: false,
    config,
    referring_partner_id: partner.id,
    servicing_partner_id: partner.id,
    servicing_status: 'partner_serviced',
  };
  try {
    const ins = await admin.from('sites').insert(row).select('id,slug,business_name,status,is_mockup,created_at').single();
    if (ins.error || !ins.data) return res.status(500).json({ ok: false, error: 'Could not create the website. Please try again.' });
    return res.status(200).json({ ok: true, site: ins.data });
  } catch (_e) {
    return res.status(500).json({ ok: false, error: 'Could not create the website. Please try again.' });
  }
};
