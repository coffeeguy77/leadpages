// api/partner/quote-get.js — PUBLIC. Returns a quote by its token for the client
// view page (/quote?t=...). Service role, so it bypasses RLS; we only ever return
// a safe subset plus the demo's slug/password so the page can link to the preview.

const { createClient } = require('@supabase/supabase-js');
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { publicOfferFields } = require('../../lib/quote-offer');

function partnerLogoUrl(profile, listing) {
  const cfg = (profile && profile.showcase_config) || {};
  if (cfg && cfg.logo) return String(cfg.logo).trim() || null;
  if (listing && listing.photo_url) return String(listing.photo_url).trim() || null;
  return null;
}

module.exports = async (req, res) => {
  const token = String((req.query && req.query.t) || '').trim();
  if (!token) return res.status(400).json({ ok: false, error: 'Missing quote token.' });

  const q = (await admin.from('partner_quotes').select('*').eq('token', token).maybeSingle()).data;
  if (!q) return res.status(404).json({ ok: false, error: 'This quote could not be found. The link may be incorrect or expired.' });

  let demo = null, partner = null;
  if (q.site_id) {
    const s = (await admin.from('sites').select('slug,business_name,preview_password').eq('id', q.site_id).maybeSingle()).data;
    if (s) demo = { slug: s.slug, business_name: s.business_name, has_password: !!s.preview_password, password: s.preview_password || null };
  }
  if (q.partner_id) {
    const p = (await admin.from('partners').select('display_name,email,phone').eq('id', q.partner_id).maybeSingle()).data;
    const pp = (await admin.from('partner_profiles').select('support_name,support_email,support_phone,showcase_config').eq('partner_id', q.partner_id).maybeSingle()).data || {};
    const listing = (await admin.from('partner_directory').select('business_name,email,phone,website_url,photo_url').eq('partner_id', q.partner_id).maybeSingle()).data || {};
    partner = {
      business_name: listing.business_name || (p && p.display_name) || pp.support_name || null,
      display_name: (p && p.display_name) || pp.support_name || listing.business_name || null,
      support_name: pp.support_name || (p && p.display_name) || listing.business_name || null,
      support_email: pp.support_email || listing.email || (p && p.email) || null,
      support_phone: pp.support_phone || listing.phone || (p && p.phone) || null,
      website_url: listing.website_url || null,
      logo_url: partnerLogoUrl(pp, listing),
    };
  }

  return res.status(200).json({
    ok: true,
    quote: Object.assign({
      token: q.token, business_name: q.business_name, contact_person: q.contact_person,
      address: q.address, email: q.email, phones: q.phones || [], job_description: q.job_description,
      features: q.features || [], price: q.price, plan_key: q.plan_key, status: q.status,
      paid_at: q.paid_at,
    }, publicOfferFields(q)),
    demo, partner,
  });
};
