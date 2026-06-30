// api/partner/showcase-check.js — is a showcase subdomain slug available?
// GET ?slug=<slug>  ->  { ok, available, reason? }
// Validates format + reserved words, and treats the caller's OWN slug as available.

const { createClient } = require('@supabase/supabase-js');
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const RESERVED = new Set(['www','app','api','manage','partner','partners','partners-admin','tradies','domains','home','admin','mail','ftp','dashboard','login','assets','static','cdn','status','blog','help','support','leadpages']);

async function getUser(req){
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token) return null;
  try{ const r=await fetch(process.env.SUPABASE_URL+'/auth/v1/user',{ headers:{ apikey:process.env.SUPABASE_ANON_KEY, Authorization:'Bearer '+token } }); if(!r.ok) return null; const u=await r.json(); return u&&u.id?{id:u.id}:null; }catch(_e){ return null; }
}

module.exports = async (req,res) => {
  const slug = String((req.query&&req.query.slug)||'').trim().toLowerCase();
  if(!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug)) return res.status(200).json({ ok:true, available:false, reason:'Use 3–40 letters, numbers or hyphens (no spaces).' });
  if(RESERVED.has(slug)) return res.status(200).json({ ok:true, available:false, reason:'That name is reserved.' });

  const user = await getUser(req);
  let mineId = null;
  if(user){ const pr=await admin.from('partners').select('id').eq('user_id',user.id).maybeSingle(); mineId = pr.data && pr.data.id; }

  const ex = await admin.from('partner_profiles').select('partner_id').ilike('showcase_slug', slug).maybeSingle();
  if(ex.data && ex.data.partner_id !== mineId) return res.status(200).json({ ok:true, available:false, reason:'That name is taken.' });

  // A tenant site with this slug would shadow the partner page at /<slug>, so it's not free.
  const site = await admin.from('sites').select('id').eq('slug', slug).maybeSingle();
  if(site.data) return res.status(200).json({ ok:true, available:false, reason:'That name is already in use.' });

  return res.status(200).json({ ok:true, available:true });
};
