// api/partner/ensure-home.js — make sure the partner has a homepage SITE they can
// edit in the normal tradie builder. Returns the existing one, or creates a draft
// trade site (is_partner_home) serviced by the partner. POST (Bearer).

const { createClient } = require('@supabase/supabase-js');
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getUser(req){
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token) return null;
  try{ const r=await fetch(process.env.SUPABASE_URL+'/auth/v1/user',{ headers:{ apikey:process.env.SUPABASE_ANON_KEY, Authorization:'Bearer '+token } }); if(!r.ok) return null; const u=await r.json(); return u&&u.id?{id:u.id,email:String(u.email||'').toLowerCase()}:null; }catch(_e){ return null; }
}
function slugify(s){ return String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,32)||'web'; }
async function uniqueSlug(base){ let slug=base,i=1; for(;;){ const r=await admin.from('sites').select('id').eq('slug',slug).maybeSingle(); if(!r.data) return slug; i+=1; slug=base+'-'+i; if(i>60) return base+'-'+Date.now().toString(36); } }

module.exports = async (req,res) => {
  if(req.method!=='POST') return res.status(405).json({ ok:false, error:'POST only' });
  const user=await getUser(req); if(!user) return res.status(401).json({ ok:false, error:'unauthorized' });
  const pr=await admin.from('partners').select('id,display_name,status').eq('user_id',user.id).maybeSingle();
  const partner=pr.data;
  if(!partner) return res.status(403).json({ ok:false, error:'not a partner' });
  if(partner.status!=='active') return res.status(403).json({ ok:false, error:'partner account is '+partner.status });

  // Existing home?
  const ex=await admin.from('sites')
    .select('id,slug,business_name,status,is_partner_home')
    .eq('servicing_partner_id',partner.id).eq('is_partner_home',true).maybeSingle();
  if(ex.data) return res.status(200).json({ ok:true, site:ex.data, created:false });

  const name=(partner.display_name||'My Web Design').trim();
  const slug=await uniqueSlug(slugify(name)+'-home');
  const row={
    slug, business_name:name, template:'trade', vertical:'trade', status:'draft',
    is_partner_home:true, is_mockup:false,
    referring_partner_id:partner.id, servicing_partner_id:partner.id, servicing_status:'partner_serviced',
    config:{ trade:'Web Design', _partnerHome:true }
  };
  try{
    const ins=await admin.from('sites').insert(row).select('id,slug,business_name,status,is_partner_home').single();
    if(ins.error||!ins.data) return res.status(500).json({ ok:false, error:'Could not create your homepage. Please try again.' });
    return res.status(200).json({ ok:true, site:ins.data, created:true });
  }catch(_e){ return res.status(500).json({ ok:false, error:'Could not create your homepage. Please try again.' }); }
};
