// api/site/support-contact.js — returns the servicing partner's support contact
// for a given site, so the customer (site owner) sees a real local support person
// in their builder. Non-sensitive (a name + how to reach them); service role so it
// can read across partner tables. Returns { ok:true, partner:{...}|null }.
//
// Query: ?siteId=<uuid>   (or ?slug=<slug>)

const { createClient } = require('@supabase/supabase-js');
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req,res) => {
  const q=req.query||{};
  const siteId=String(q.siteId||'').trim();
  const slug=String(q.slug||'').trim();
  if(!siteId && !slug) return res.status(400).json({ ok:false, error:'siteId or slug required' });

  try{
    let s=admin.from('sites').select('servicing_partner_id,servicing_status');
    s = siteId ? s.eq('id',siteId) : s.eq('slug',slug);
    const site=(await s.maybeSingle()).data;
    if(!site || !site.servicing_partner_id) return res.status(200).json({ ok:true, partner:null });

    const partner=(await admin.from('partners').select('status,display_name,email,phone').eq('id',site.servicing_partner_id).maybeSingle()).data;
    if(!partner || ['suspended','terminated'].includes(partner.status)) return res.status(200).json({ ok:true, partner:null });

    const prof=(await admin.from('partner_profiles').select('support_name,support_email,support_phone,region,bio').eq('partner_id',site.servicing_partner_id).maybeSingle()).data || {};

    return res.status(200).json({ ok:true, partner:{
      id: site.servicing_partner_id,
      name:  prof.support_name  || partner.display_name || null,
      email: prof.support_email || partner.email || null,
      phone: prof.support_phone || partner.phone || null,
      region: prof.region || null,
      bio: prof.bio || null,
      servicing_status: site.servicing_status || null,
    }});
  }catch(_e){
    return res.status(200).json({ ok:true, partner:null });
  }
};
