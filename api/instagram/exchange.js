// api/instagram/exchange.js — POST {code, state} from the callback relay page.
// Verifies state, exchanges code -> short -> long-lived token, saves to ig_connections.
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { appUrl } = require('../../lib/app-url');

const APP_ID    = process.env.INSTAGRAM_APP_ID;
const APP_SEC   = process.env.INSTAGRAM_APP_SECRET;
const REDIRECT  = (process.env.INSTAGRAM_REDIRECT_URI || (appUrl() + '/api/instagram/callback')).replace(/\/$/, '');
const STATE_SEC = process.env.IG_STATE_SECRET || APP_SEC || '';

function sign(p){ return crypto.createHmac('sha256',STATE_SEC).update(p).digest('base64url'); }
function verifyState(state){
  try {
    const parts=String(state||'').split('.');
    if(parts.length!==2) return null;
    const exp=sign(parts[0]);
    const a=Buffer.from(parts[1],'base64url'), b=Buffer.from(exp,'base64url');
    if(a.length!==b.length||!crypto.timingSafeEqual(a,b)) return null;
    const obj=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
    if(!obj||!obj.s) return null;
    if(Date.now()-Number(obj.t||0)>15*60*1000) return null;
    return String(obj.s);
  } catch(_){ return null; }
}

module.exports = async (req,res) => {
  res.setHeader('Content-Type','application/json');
  res.setHeader('cache-control','no-store');
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'Method not allowed'});

  let body={};
  try { body = (typeof req.body==='object'&&req.body) ? req.body : JSON.parse(req.body||'{}'); }
  catch(_){ return res.status(400).json({ok:false,error:'Invalid JSON'}); }

  const slug = verifyState(body.state);
  let step='init';
  try {
    if(!slug) return res.status(400).json({ok:false,error:'Invalid or expired state — start again from the editor'});
    if(!APP_ID||!APP_SEC) return res.status(500).json({ok:false,slug,error:'Not configured'});

    let code=String(body.code||'').replace(/#_$/,'').trim();
    if(!code) return res.status(400).json({ok:false,slug,error:'no_code'});

    console.log('[ig-exchange] slug='+slug+' codeLen='+code.length);

    // Step 1: code -> short-lived token
    step='short_token';
    const form='client_id='+encodeURIComponent(APP_ID)
      +'&client_secret='+encodeURIComponent(APP_SEC)
      +'&grant_type=authorization_code'
      +'&redirect_uri='+encodeURIComponent(REDIRECT)
      +'&code='+encodeURIComponent(code);
    const sRes=await fetch('https://api.instagram.com/oauth/access_token',{
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:form
    });
    const sText=await sRes.text();
    let sJson={}; try{sJson=JSON.parse(sText);}catch(_){}
    console.log('[ig-exchange] step1 status='+sRes.status+' body='+sText.slice(0,400));
    const shortTok=sJson.access_token;
    if(!sRes.ok||!shortTok){
      return res.status(400).json({ok:false,slug,error:'step1:'+(sJson.error_message||sJson.error||sText||'unknown').slice(0,200)});
    }

    // Step 2: short -> long-lived
    step='long_token';
    const lRes=await fetch('https://graph.instagram.com/access_token'
      +'?grant_type=ig_exchange_token'
      +'&client_secret='+encodeURIComponent(APP_SEC)
      +'&access_token='+encodeURIComponent(shortTok));
    const lText=await lRes.text();
    let lJson={}; try{lJson=JSON.parse(lText);}catch(_){}
    console.log('[ig-exchange] step2 status='+lRes.status+' body='+lText.slice(0,300));
    const longTok=lJson.access_token;
    if(!lRes.ok||!longTok){
      return res.status(400).json({ok:false,slug,error:'step2:'+((lJson.error&&lJson.error.message)||lText||'unknown').slice(0,200)});
    }
    const expiresAt=new Date(Date.now()+(Number(lJson.expires_in||5184000)*1000)).toISOString();

    // Step 3: identity (ig_user_id is NOT NULL in the table)
    step='username';
    let username=null,igUserId=null;
    try{
      const uRes=await fetch('https://graph.instagram.com/me?fields=id,username&access_token='+encodeURIComponent(longTok));
      const uJson=await uRes.json().catch(()=>({}));
      if(uRes.ok){username=uJson.username||null;igUserId=uJson.id||null;}
    }catch(_){}
    if(!igUserId) return res.status(400).json({ok:false,slug,error:'no_user_id_from_token'});

    // Step 4: upsert
    step='db';
    const row={slug,access_token:longTok,token_expires_at:expiresAt,ig_username:username,ig_user_id:igUserId,ig_cache:null,ig_cache_at:null};
    const {error:e1}=await supabase.from('ig_connections').upsert(row,{onConflict:'slug'});
    if(e1){
      const {error:e2}=await supabase.from('ig_connections')
        .upsert({slug,access_token:longTok,token_expires_at:expiresAt,ig_username:username,ig_user_id:igUserId},{onConflict:'slug'});
      if(e2) return res.status(500).json({ok:false,slug,error:'step4:'+String(e2.message).slice(0,150)});
    }

    console.log('[ig-exchange] SUCCESS slug='+slug+' username='+username);
    return res.json({ok:true,slug,username});
  }catch(e){
    console.log('[ig-exchange] EXCEPTION step='+step+' '+String(e&&e.message||e));
    return res.status(500).json({ok:false,slug,error:step+':'+String(e&&e.message||e).slice(0,150)});
  }
};
