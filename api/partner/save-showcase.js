// api/partner/save-showcase.js — the authoritative save for a partner's page
// settings. Re-validates the address + domain server-side (format, reserved
// words, other partners, and existing tenant sites) so a shadowed/invalid name
// can never be stored, regardless of what the UI sends. POST (Bearer).
//
// Body: { slug, domain, enabled, headline, config:{logo,logoSize,intro,accent,theme,themeId,templateKey} }

const { getCultureColorPreset } = require('../../lib/partner-website/webculture-color-presets');
const { websiteProfileFromRow, saveWebsiteProfile } = require('../../lib/partner-website/profile-store');
const { mergeWebsiteProfilePatch } = require('../../lib/partner-website/validate');
const { extractLogoValue, normalizeLogoForStorage } = require('../../lib/partner-website/logo');

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
function cleanCulturePreset(v) {
  const id = String(v || 'culture').trim().toLowerCase();
  if (id === 'custom') return 'custom';
  return getCultureColorPreset(id).id;
}

const { admin, resolvePartnerActor } = require('../../lib/partner/resolve-actor');

const RESERVED = new Set(['www','app','api','manage','partner','partners','partners-admin','tradies','domains','home','admin','mail','ftp','dashboard','login','assets','static','cdn','status','blog','help','support','leadpages']);
const PLATFORM_DOMAINS = ['leadpages.com.au','leadpages.webculture.au'];

function readBody(req){
  return new Promise((resolve)=>{
    if(req.body){ if(typeof req.body==='string'){ try{ return resolve(JSON.parse(req.body)); }catch{ return resolve({}); } } return resolve(req.body); }
    let raw=''; req.on('data',c=>raw+=c); req.on('end',()=>{ try{ resolve(raw?JSON.parse(raw):{}); }catch{ resolve({}); } }); req.on('error',()=>resolve({}));
  });
}
const fail=(res,field,error)=>res.status(200).json({ ok:false, field, error });

module.exports = async (req,res) => {
  if(req.method!=='POST') return res.status(405).json({ ok:false, error:'POST only' });

  const b=await readBody(req);
  const actor=await resolvePartnerActor(req,{ body:b });
  if(actor.error) return res.status(actor.error.status).json(actor.error.body);
  const partner=actor.partner;
  const slug=String(b.slug||'').trim().toLowerCase();
  let domain=String(b.domain||'').trim().toLowerCase().replace(/^https?:\/\//,'').replace(/\/.*$/,'').replace(/\s+/g,'');
  const enabled=!!b.enabled;
  const headline=String(b.headline||'').trim().slice(0,160);
  const cfgIn=(b.config&&typeof b.config==='object')?b.config:{};
  const theme=cleanTheme(cfgIn.theme);
  const accent=cleanHex(cfgIn.accent)||(theme&&theme.hivis)||null;

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

  const curProf=await admin.from('partner_profiles').select('showcase_config').eq('partner_id',partner.id).maybeSingle();
  const existingCfg=(curProf.data&&curProf.data.showcase_config)||{};
  const cultureColorPreset=('cultureColorPreset' in cfgIn)
    ? cleanCulturePreset(cfgIn.cultureColorPreset)
    : cleanCulturePreset(existingCfg.cultureColorPreset||'culture');
  const config=Object.assign({},existingCfg,{
    logo:'logo' in cfgIn ? normalizeLogoForStorage(cfgIn.logo) : normalizeLogoForStorage(existingCfg.logo),
    logoSize:'logoSize' in cfgIn?cleanLogoSize(cfgIn.logoSize):cleanLogoSize(existingCfg.logoSize),
    intro:'intro' in cfgIn?(cfgIn.intro?String(cfgIn.intro).slice(0,600):null):existingCfg.intro,
    accent:accent!=null?accent:existingCfg.accent,
    theme:theme||existingCfg.theme,
    themeId:cfgIn.themeId?String(cfgIn.themeId).slice(0,80):(existingCfg.themeId||null),
    templateKey:'webculture',
    cultureColorPreset:cultureColorPreset
  });
  if(!config.themeId) delete config.themeId;
  if(!config.theme) delete config.theme;

  const patch={
    showcase_slug: slug||null, showcase_domain: domain||null, showcase_enabled: enabled,
    showcase_protected:false, showcase_password:null, showcase_headline: headline||null,
    showcase_config: config, updated_at: new Date().toISOString()
  };
  try{
    const up=await admin.from('partner_profiles').update(patch).eq('partner_id',partner.id).select('*').single();
    if(up.error){ if(/duplicate|unique/i.test(up.error.message)) return fail(res,'slug','That address is already taken — pick another.'); return res.status(500).json({ ok:false, error:'Could not save. Please try again.' }); }
    const home=await admin.from('sites').select('id,config').eq('servicing_partner_id',partner.id).eq('is_partner_home',true).maybeSingle();
    if(home.data){
      const hc=home.data.config||{};
      if(theme) hc.theme=Object.assign({},hc.theme||{},theme);
      if(config.logo) hc.logo={ imageUrl: String(config.logo) };
      else if('logo' in cfgIn && !config.logo) delete hc.logo;
      await admin.from('sites').update({ config:hc, updated_at:new Date().toISOString() }).eq('id',home.data.id);
    }
    const existingWp = websiteProfileFromRow(up.data) || {};
    const syncedWp = mergeWebsiteProfilePatch(existingWp, {
      identity: {
        logoUrl: config.logo || undefined
      },
      positioning: {
        heroHeadline: headline || undefined,
        heroSupporting: config.intro || undefined
      },
      biography: {
        shortIntro: config.intro ? String(config.intro).slice(0, 240) : undefined
      }
    });
    await saveWebsiteProfile(admin, partner.id, syncedWp, new Date().toISOString());
    return res.status(200).json({ ok:true, profile:up.data });
  }catch(_e){ return res.status(500).json({ ok:false, error:'Could not save. Please try again.' }); }
};
