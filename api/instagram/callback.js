// api/instagram/callback.js — completes Business Login and stores the long-lived token.
// GET /api/instagram/callback?code=...&state=...   (Instagram redirects here)

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const APP_ID     = process.env.INSTAGRAM_APP_ID;
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET;
const REDIRECT   = process.env.INSTAGRAM_REDIRECT_URI || 'https://www.leadpages.com.au/api/instagram/callback';
const STATE_SEC  = process.env.IG_STATE_SECRET || process.env.INSTAGRAM_APP_SECRET || '';
const BACK       = process.env.INSTAGRAM_SUCCESS_URL || 'https://www.leadpages.com.au/manage';

function sign(p){ return crypto.createHmac('sha256',STATE_SEC).update(p).digest('base64url'); }

function verifyState(state){
  try {
    const parts = String(state||'').split('.');
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

function redirect(res, slug, status, detail){
  let u = BACK + (BACK.includes('?')?'&':'?')
    + 'ig='+encodeURIComponent(status)
    + (slug?'&site='+encodeURIComponent(slug):'')
    + (detail?'&ig_detail='+encodeURIComponent(String(detail).slice(0,120)):'');
  res.setHeader('cache-control','no-store');
  res.writeHead(302,{Location:u});
  res.end();
}

module.exports = async (req, res) => {
  const q = req.query||{};
  const slug = verifyState(q.state);
  let step = 'init';
  try {
    if(q.error) return redirect(res, slug, 'denied', q.error_description||q.error);
    if(!slug) return res.status(400).send('Invalid or expired connection request — please start again from the editor.');
    if(!APP_ID||!APP_SECRET) return res.status(500).send('Instagram connection is not configured (missing env vars).');

    // Strip the trailing #_ Meta appends (may arrive as literal chars or encoded)
    let code = String(q.code||'').replace(/#_$/,'').trim();
    if(!code) return redirect(res, slug, 'error', 'no_code');

    // ---- step 1: code -> short-lived token ----
    step='short_token';
    const form=new URLSearchParams();
    form.set('client_id', APP_ID);
    form.set('client_secret', APP_SECRET);
    form.set('grant_type', 'authorization_code');
    form.set('redirect_uri', REDIRECT);
    form.set('code', code);

    const sRes = await fetch('https://api.instagram.com/oauth/access_token',{method:'POST',body:form});
    const sText = await sRes.text();
    let sJson={};
    try{ sJson=JSON.parse(sText); }catch(_){}

    // Response is flat {access_token, user_id} — NOT a data[] array for this flow
    const shortTok = sJson.access_token;
    if(!sRes.ok||!shortTok){
      const err=(sJson.error_message||sJson.error||sText||'').slice(0,200);
      return redirect(res, slug, 'error', 'step1:'+err);
    }

    // ---- step 2: short -> long-lived (60-day) token ----
    step='long_token';
    const lRes = await fetch(
      'https://graph.instagram.com/access_token'
      +'?grant_type=ig_exchange_token'
      +'&client_secret='+encodeURIComponent(APP_SECRET)
      +'&access_token='+encodeURIComponent(shortTok)
    );
    const lText = await lRes.text();
    let lJson={};
    try{ lJson=JSON.parse(lText); }catch(_){}

    const longTok = lJson.access_token;
    if(!lRes.ok||!longTok){
      const err=(lJson.error&&lJson.error.message||lText||'').slice(0,200);
      return redirect(res, slug, 'error', 'step2:'+err);
    }
    const expiresAt = new Date(Date.now()+(Number(lJson.expires_in||5184000)*1000)).toISOString();

    // ---- step 3: read username ----
    step='username';
    let username=null, igUserId=null;
    try{
      const uRes = await fetch('https://graph.instagram.com/me?fields=id,username&access_token='+encodeURIComponent(longTok));
      const uJson = await uRes.json().catch(()=>({}));
      if(uRes.ok){ username=uJson.username||null; igUserId=uJson.id||null; }
    }catch(_){}

    // ---- step 4: upsert ig_connections ----
    step='db';
    const row={
      slug, access_token:longTok, token_expires_at:expiresAt,
      ig_username:username, ig_user_id:igUserId,
      ig_cache:null, ig_cache_at:null
    };
    const {error:dbErr} = await supabase.from('ig_connections').upsert(row,{onConflict:'slug'});
    if(dbErr){
      // Try without the cache columns in case migration hasn't run
      const {error:dbErr2} = await supabase.from('ig_connections')
        .upsert({slug,access_token:longTok,token_expires_at:expiresAt,ig_username:username},{onConflict:'slug'});
      if(dbErr2) return redirect(res, slug, 'error', 'step4:'+String(dbErr2.message||'').slice(0,120));
    }

    return redirect(res, slug, 'connected');

  } catch(e){
    return redirect(res, slug, 'error', step+':'+String((e&&e.message)||e).slice(0,120));
  }
};
