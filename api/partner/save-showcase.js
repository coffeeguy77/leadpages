// api/partner/save-showcase.js — the authoritative save for a partner's page
// settings. Re-validates the address + domain server-side (format, reserved
// words, other partners, and existing tenant sites) so a shadowed/invalid name
// can never be stored, regardless of what the UI sends. POST (Bearer).
//
// Body: { slug, domain, enabled, headline, config:{logo,logoSize,intro,accent,theme,themeId,templateKey} }

const { normalizeTemplateKey } = require('../../lib/partner-templates/registry');

function cleanHex(v) {
  return /^#[0-9a-fA-F]{3,8}$/.test(v || '') ? v : null;
}
function cleanTheme(t) {
  if (!t || typeof t !== 'object') return null;
  const out = {};
  ['pipe', 'hivis', 'steel', 'safety', 'lightBg'].forEach((k) => {
    const h = cleanHex(t[k]);
    if (h) out[k] = h;
  });
  return Object.keys(out).length ? out : null;
}
function cleanLogoSize(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  const stepped = Math.round(n * 2) / 2;
  return Math.min(10, Math.max(0.5, stepped));
}

const { createClient } = require('@supabase/supabase-js');
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const RESERVED = new Set(['www','app','api','manage','partner','partners','partners-admin','tradies','domains','home','admin','mail','ftp','dashboard','login','assets','static','cdn','status','blog','help','support','leadpages']);
const PLATFORM_DOMAINS = ['leadpages.com.au','leadpages.webculture.au'];

function readBody(req){
  return new Promise((resolve)=>{
    if(req.body){ if(typeof req.body==='string'){ try{ return resolve(JSON.parse(req.body)); }catch{ return resolve({}); } } return resolve(req.body); }
    let raw=''; req.on('data',c=>raw+=c); req.on('end',()=>{ try{ resolve(raw?JSON.parse(raw):{}); }catch{ resolve({}); } }); req.on('error',()=>resolve({}));
  });
}
async function getUser(req){
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token) return null;
  try{ const r=await fetch(process.env.SUPABASE_URL+'/auth/v1/user',{ headers:{ apikey:process.env.SUPABASE_ANON_KEY, Authorization:'Bearer '+token } }); if(!r.ok) return null; const u=await r.json(); return u&&u.id?{id:u.id}:null; }catch(_e){ return null; }
}
const fail=(res,field,error)=>res.status(200).json({ ok:false, field, error });

module.exports = async (req,res) => {
  if(req.method!=='POST') return res.status(405).json({ ok:false, error:'POST only' });
  const user=await getUser(req); if(!user) return res.status(401).json({ ok:false, error:'unauthorized' });
  const pr=await admin.from('partners').select('id,status').eq('user_id',user.id).maybeSingle();
  const partner=pr.data;
  if(!partner) return res.status(403).json({ ok:false, error:'not a partner' });
  if(partner.status!=='active') return res.status(403).json({ ok:false, error:'partner account is '+partner.status });

  const b=await readBody(req);
  const slug=String(b.slug||'').trim().toLowerCase();
  let domain=String(b.domain||'').trim().toLowerCase().replace(/^https?:\/\//,'').replace(/\/.*$/,'').replace(/\s+/g,'');
  const enabled=!!b.enabled;
  const headline=String(b.headline||'').trim().slice(0,160);
  const cfgIn=(b.config&&typeof b.config==='object')?b.config:{};
  const theme=cleanTheme(cfgIn.theme);
  const accent=cleanHex(cfgIn.accent)||(theme&&theme.hivis)||null;
  const config={
    logo:cfgIn.logo?String(cfgIn.logo).slice(0,400):null,
    logoSize:cleanLogoSize(cfgIn.logoSize),
    intro:cfgIn.intro?String(cfgIn.intro).slice(0,600):null,
    accent,
    theme,
    themeId:cfgIn.themeId?String(cfgIn.themeId).slice(0,80):null,
    templateKey:normalizeTemplateKey(cfgIn.templateKey),
  };
  if(!config.themeId) delete config.themeId;
  if(!config.theme) delete config.theme;

  // ---- Address (slug) ----
  if(slug){
    if(!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug)) return fail(res,'slug','Use 3–40 letters, numbers or hyphens (no spaces).');
    if(RESERVED.has(slug)) return fail(res,'slug','That name is reserved.');
    const other=await admin.from('partner_profiles').select('partner_id').ilike('showcase_slug',slug).maybeSingle();
    if(other.data && other.data.partner_id!==partner.id) return fail(res,'slug','That name is taken.');
    const site=await admin.from('sites').select('id').eq('slug',slug).maybeSingle();
    if(site.data) return fail(res,'slug','That name is already in use.');
  }

  // ---- Own domain ----
  if(domain){
    if(!/^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(domain)) return fail(res,'domain','That doesn’t look like a valid domain.');
    if(PLATFORM_DOMAINS.some(d=>domain===d||domain.endsWith('.'+d))) return fail(res,'domain','Use the address field above for a leadpages address.');
    const od=await admin.from('partner_profiles').select('partner_id').or('showcase_domain.ilike.'+domain+',showcase_domain.ilike.www.'+domain).maybeSingle();
    if(od.data && od.data.partner_id!==partner.id) return fail(res,'domain','That domain is already connected to another partner.');
  }

  // ---- Going live needs somewhere to live ----
  if(enabled && !slug && !domain) return fail(res,'slug','Choose an address before making your page live.');

  const patch={
    showcase_slug: slug||null, showcase_domain: domain||null, showcase_enabled: enabled,
    showcase_protected:false, showcase_password:null, showcase_headline: headline||null,
    showcase_config: config, updated_at: new Date().toISOString()
  };
  try{
    const up=await admin.from('partner_profiles').update(patch).eq('partner_id',partner.id).select('*').single();
    if(up.error){ if(/duplicate|unique/i.test(up.error.message)) return fail(res,'slug','That address is already taken — pick another.'); return res.status(500).json({ ok:false, error:'Could not save. Please try again.' }); }
    if(theme){
      const home=await admin.from('sites').select('id,config').eq('servicing_partner_id',partner.id).eq('is_partner_home',true).maybeSingle();
      if(home.data){
        const hc=home.data.config||{};
        hc.theme=Object.assign({},hc.theme||{},theme);
        await admin.from('sites').update({ config:hc, updated_at:new Date().toISOString() }).eq('id',home.data.id);
      }
    }
    return res.status(200).json({ ok:true, profile:up.data });
  }catch(_e){ return res.status(500).json({ ok:false, error:'Could not save. Please try again.' }); }
};
