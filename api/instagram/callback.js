// api/instagram/callback.js
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const APP_ID     = process.env.INSTAGRAM_APP_ID;
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET;
const REDIRECT   = 'https://www.leadpages.com.au/api/instagram/callback';
const STATE_SEC  = process.env.IG_STATE_SECRET || APP_SECRET || '';
const BACK       = 'https://www.leadpages.com.au/manage';

function sign(p){ return crypto.createHmac('sha256', STATE_SEC).update(p).digest('base64url'); }

function verifyState(state){
  try {
    const parts = String(state||'').split('.');
    if(parts.length!==2) return null;
    const exp = sign(parts[0]);
    const a = Buffer.from(parts[1],'base64url');
    const b = Buffer.from(exp,'base64url');
    if(a.length!==b.length || !crypto.timingSafeEqual(a,b)) return null;
    const obj = JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
    if(!obj||!obj.s) return null;
    if(Date.now()-Number(obj.t||0) > 15*60*1000) return null;
    return String(obj.s);
  } catch(_){ return null; }
}

function done(res, slug, status, detail){
  const u = BACK+'?ig='+encodeURIComponent(status)
    +(slug?'&site='+encodeURIComponent(slug):'')
    +(detail?'&ig_detail='+encodeURIComponent(String(detail).slice(0,200)):'');
  res.setHeader('cache-control','no-store');
  res.writeHead(302, {Location: u});
  res.end();
}

module.exports = async (req, res) => {
  const q    = req.query||{};
  const slug = verifyState(q.state);
  let step   = 'init';
  try {
    if(q.error) return done(res, slug, 'denied', q.error_description||q.error);
    if(!slug)   return res.status(400).send('Invalid or expired connection request — please start again.');
    if(!APP_ID||!APP_SECRET) return res.status(500).send('Instagram connection is not configured.');

    let code = String(q.code||'').replace(/#_$/,'').trim();
    if(!code) return done(res, slug, 'error', 'no_code');

    // Log exactly what we're sending (visible in Vercel function logs)
    console.log('[ig-callback] slug='+slug+' redirect='+REDIRECT+' appId='+APP_ID+' codeLen='+code.length);

    // ---- step 1: code -> short-lived token ----
    step = 'short_token';
    const form = new URLSearchParams({
      client_id:     APP_ID,
      client_secret: APP_SECRET,
      grant_type:    'authorization_code',
      redirect_uri:  REDIRECT,
      code:          code
    });

    const sRes  = await fetch('https://api.instagram.com/oauth/access_token', {method:'POST', body:form});
    const sText = await sRes.text();
    let sJson = {};
    try{ sJson = JSON.parse(sText); }catch(_){}
    console.log('[ig-callback] step1 status='+sRes.status+' body='+sText.slice(0,300));

    const shortTok = sJson.access_token;
    if(!sRes.ok || !shortTok){
      const err = (sJson.error_message||sJson.error||sText||'unknown').slice(0,200);
      return done(res, slug, 'error', 'step1:'+err);
    }

    // ---- step 2: short -> long-lived (60-day) token ----
    step = 'long_token';
    const lRes  = await fetch('https://graph.instagram.com/access_token'
      +'?grant_type=ig_exchange_token'
      +'&client_secret='+encodeURIComponent(APP_SECRET)
      +'&access_token=' +encodeURIComponent(shortTok));
    const lText = await lRes.text();
    let lJson = {};
    try{ lJson = JSON.parse(lText); }catch(_){}
    console.log('[ig-callback] step2 status='+lRes.status+' body='+lText.slice(0,300));

    const longTok = lJson.access_token;
    if(!lRes.ok || !longTok){
      const err = (lJson.error&&lJson.error.message||lText||'unknown').slice(0,200);
      return done(res, slug, 'error', 'step2:'+err);
    }
    const expiresAt = new Date(Date.now()+(Number(lJson.expires_in||5184000)*1000)).toISOString();

    // ---- step 3: read username ----
    step = 'username';
    let username=null, igUserId=null;
    try{
      const uRes  = await fetch('https://graph.instagram.com/me?fields=id,username&access_token='+encodeURIComponent(longTok));
      const uJson = await uRes.json().catch(()=>({}));
      if(uRes.ok){ username=uJson.username||null; igUserId=uJson.id||null; }
      console.log('[ig-callback] step3 username='+username);
    }catch(_){}

    // ---- step 4: upsert ig_connections ----
    step = 'db';
    const row = {slug, access_token:longTok, token_expires_at:expiresAt, ig_username:username, ig_user_id:igUserId, ig_cache:null, ig_cache_at:null};
    const {error:e1} = await supabase.from('ig_connections').upsert(row, {onConflict:'slug'});
    if(e1){
      console.log('[ig-callback] upsert err:'+e1.message+' — retrying without cache cols');
      const {error:e2} = await supabase.from('ig_connections')
        .upsert({slug, access_token:longTok, token_expires_at:expiresAt, ig_username:username}, {onConflict:'slug'});
      if(e2) return done(res, slug, 'error', 'step4:'+String(e2.message).slice(0,120));
    }

    console.log('[ig-callback] SUCCESS slug='+slug+' username='+username);
    return done(res, slug, 'connected');

  } catch(e){
    console.log('[ig-callback] EXCEPTION step='+step+' err='+String(e&&e.message||e));
    return done(res, slug, 'error', step+':'+String(e&&e.message||e).slice(0,120));
  }
};
