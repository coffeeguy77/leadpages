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
function readBody(req){
  return new Promise((resolve)=>{
    if(req.body){ if(typeof req.body==='string'){ try{ return resolve(JSON.parse(req.body)); }catch{ return resolve({}); } } return resolve(req.body); }
    let raw=''; req.on('data',c=>raw+=c); req.on('end',()=>{ try{ resolve(raw?JSON.parse(raw):{}); }catch{ resolve({}); } }); req.on('error',()=>resolve({}));
  });
}

module.exports = async (req,res) => {
  if(req.method!=='POST') return res.status(405).json({ ok:false, error:'POST only' });
  const user=await getUser(req); if(!user) return res.status(401).json({ ok:false, error:'unauthorized' });
  const pr=await admin.from('partners').select('id,display_name,status').eq('user_id',user.id).maybeSingle();
  const partner=pr.data;
  if(!partner) return res.status(403).json({ ok:false, error:'not a partner' });
  if(partner.status!=='active') return res.status(403).json({ ok:false, error:'partner account is '+partner.status });

  const b=await readBody(req);
  const themeId=String((b&&b.themeId)||'').trim();
  let theme=null;
  if(themeId){
    const t=(await admin.from('partner_themes').select('config').eq('id',themeId).eq('partner_id',partner.id).maybeSingle()).data;
    if(t&&t.config&&t.config.theme) theme=t.config.theme;
  }

  // Existing home?
  const ex=await admin.from('sites')
    .select('id,slug,business_name,status,is_partner_home')
    .eq('servicing_partner_id',partner.id).eq('is_partner_home',true).maybeSingle();
  if(ex.data){
    if(theme){
      const cur=(await admin.from('sites').select('config').eq('id',ex.data.id).maybeSingle()).data;
      const hc=(cur&&cur.config)||{};
      hc.theme=Object.assign({},hc.theme||{},theme);
      await admin.from('sites').update({ config:hc, updated_at:new Date().toISOString() }).eq('id',ex.data.id);
    }
    return res.status(200).json({ ok:true, site:ex.data, created:false });
  }

  const name=(partner.display_name||'My Web Design').trim();
  const slug=await uniqueSlug(slugify(name)+'-home');
  const row={
    slug, business_name:name, template:'trade', vertical:'trade', status:'draft',
    is_partner_home:true, is_mockup:false,
    referring_partner_id:partner.id, servicing_partner_id:partner.id, servicing_status:'partner_serviced',
    config:{
      trade:'Web Design', _partnerHome:true, phone:'', email:'',
      sections:{
        hero:{ eyebrow:'Web design studio', title:'Websites that bring in the work', titleHl:'the work', sub:'Professional, mobile-first websites for local businesses \u2014 built fast, with lead forms that put enquiries straight in your inbox.' },
        textBox:{ on:true, eyebrow:'About the studio', heading:'Local websites, done properly', intro:'', content:'We design and build websites for local trades and small businesses \u2014 clean, quick to launch, and easy to update. You get a site that earns its keep and a real person to call when you need a change.' }
      },
      services:[
        { on:true, icon:'\uD83D\uDCF1', title:'Mobile-first design', body:'Sites that look sharp and load fast on the phone, where most local customers find you.' },
        { on:true, icon:'\u26A1', title:'Lead forms that work', body:'Enquiry forms that land straight in your inbox so you never miss a job.' },
        { on:true, icon:'\uD83D\uDD0E', title:'Found on Google', body:'Local search basics built in so nearby customers can actually find you.' },
        { on:true, icon:'\uD83D\uDE80', title:'Live in days', body:'No drawn-out web project \u2014 your site can be online and taking enquiries this week.' }
      ]
    }
  };
  if(theme) row.config.theme=theme;
  try{
    const ins=await admin.from('sites').insert(row).select('id,slug,business_name,status,is_partner_home').single();
    if(ins.error||!ins.data) return res.status(500).json({ ok:false, error:'Could not create your homepage. Please try again.' });
    return res.status(200).json({ ok:true, site:ins.data, created:true });
  }catch(_e){ return res.status(500).json({ ok:false, error:'Could not create your homepage. Please try again.' }); }
};
