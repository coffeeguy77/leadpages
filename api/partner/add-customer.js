// api/partner/add-customer.js — a partner brings on a new client from their
// dashboard. Creates a sites row (the client record) stamped with the partner as
// BOTH the referring (lead attribution) and servicing partner, plus the customer's
// login email so they can sign in and see their site + support contact. The
// partner then finishes the build in /manage (the existing site builder), which
// they can now reach via the Phase 2 RLS policies.
//
// Service role because partners deliberately have no INSERT policy on sites — this
// is the one controlled path that sets attribution + owner_email correctly.
//
// Payload: { businessName, contactName, customerEmail, phone, industry, location,
//            notes, buildPrice, planKey }

const { createClient } = require('@supabase/supabase-js');
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function readBody(req){
  return new Promise((resolve)=>{
    if(req.body){ if(typeof req.body==='string'){ try{ return resolve(JSON.parse(req.body)); }catch{ return resolve({}); } } return resolve(req.body); }
    let raw=''; req.on('data',c=>raw+=c); req.on('end',()=>{ try{ resolve(raw?JSON.parse(raw):{}); }catch{ resolve({}); } }); req.on('error',()=>resolve({}));
  });
}
const clean=(s,n=400)=>(s==null?'':String(s)).trim().slice(0,n);

async function getUser(req){
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token) return null;
  try{
    const r=await fetch(process.env.SUPABASE_URL+'/auth/v1/user',{ headers:{ apikey:process.env.SUPABASE_ANON_KEY, Authorization:'Bearer '+token } });
    if(!r.ok) return null;
    const u=await r.json(); if(!u||!u.id) return null;
    return { id:u.id, email:String(u.email||'').toLowerCase() };
  }catch(_e){ return null; }
}

function slugify(s){
  return String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40) || 'site';
}
async function uniqueSlug(base){
  let slug=base, i=1;
  // try up to a handful of suffixes; service role can read every slug.
  for(;;){
    const r=await admin.from('sites').select('id').eq('slug',slug).maybeSingle();
    if(!r.data) return slug;
    i+=1; slug=base+'-'+i;
    if(i>50) return base+'-'+Date.now().toString(36);
  }
}

module.exports = async (req,res) => {
  if(req.method!=='POST') return res.status(405).json({ ok:false, error:'POST only' });
  const user=await getUser(req);
  if(!user) return res.status(401).json({ ok:false, error:'unauthorized' });

  // Caller must be an ACTIVE partner.
  const pr=await admin.from('partners').select('id,status').eq('user_id',user.id).maybeSingle();
  const partner=pr.data;
  if(!partner) return res.status(403).json({ ok:false, error:'not a partner' });
  if(partner.status!=='active') return res.status(403).json({ ok:false, error:'partner account is '+partner.status });

  const b=await readBody(req);
  const businessName=clean(b.businessName,160);
  if(!businessName) return res.status(400).json({ ok:false, error:'Business name is required.' });

  const customerEmail=clean(b.customerEmail,200).toLowerCase() || null;
  const industry=clean(b.industry,80);
  const planKey=clean(b.planKey,40) || null;

  // Look up the plan for a cached monthly amount (display only; Stripe stays source of truth).
  let monthly=null;
  if(planKey){
    const pl=await admin.from('billing_plans').select('monthly_amount').eq('key',planKey).maybeSingle();
    if(pl.data) monthly=pl.data.monthly_amount;
  }

  const slug=await uniqueSlug(slugify(businessName));

  // Optionally seed the design from one of the partner's saved themes.
  let base = {};
  const themeId = clean(b.themeId, 80);
  if (themeId) {
    const t = await admin.from('partner_themes').select('config').eq('id', themeId).eq('partner_id', partner.id).maybeSingle();
    if (t.data && t.data.config && typeof t.data.config === 'object') base = Object.assign({}, t.data.config);
  }

  // Minimal starter config — the partner customises in the builder. Intake details
  // are kept on the config so the builder/admin can see who the lead was.
  const config=Object.assign(base, {
    trade: industry || base.trade || '',
    _intake: {
      contactName: clean(b.contactName,160) || null,
      phone: clean(b.phone,60) || null,
      location: clean(b.location,160) || null,
      notes: clean(b.notes,1200) || null,
      buildPrice: clean(b.buildPrice,40) || null,
      addedByPartner: partner.id,
      addedAt: new Date().toISOString(),
    },
  });

  const row={
    slug,
    business_name: businessName,
    template: 'trade',
    vertical: 'trade',
    status: 'draft', // hidden until the partner publishes; previewable in the builder

    config,
    owner_email: customerEmail,
    referring_partner_id: partner.id,
    servicing_partner_id: partner.id,
    servicing_status: 'partner_serviced',
    plan_key: planKey,
    monthly_amount: monthly,
  };

  try{
    const ins=await admin.from('sites').insert(row).select('id,slug,business_name,status,template,plan_key,monthly_amount,servicing_status,created_at').single();
    if(ins.error||!ins.data) return res.status(500).json({ ok:false, error:'Could not create the client site. Please try again.' });
    return res.status(200).json({ ok:true, site:ins.data });
  }catch(_e){
    return res.status(500).json({ ok:false, error:'Could not create the client site. Please try again.' });
  }
};
