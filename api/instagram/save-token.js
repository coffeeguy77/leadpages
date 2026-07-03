// api/instagram/save-token.js
// POST {slug, token} — verify + save a long-lived token to ig_connections.
// POST {slug, disconnect:true} — DELETE the connection row entirely.

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  res.setHeader('Content-Type','application/json');
  res.setHeader('cache-control','no-store');

  const origin = req.headers.origin || req.headers.referer || '';
  if(!origin.includes('leadpages.com.au') && !origin.includes('localhost')){
    return res.status(403).json({ok:false, error:'Forbidden'});
  }
  if(req.method!=='POST') return res.status(405).json({ok:false, error:'Method not allowed'});

  let body={};
  try {
    if(typeof req.body==='object' && req.body) body=req.body;
    else body=JSON.parse(req.body||'{}');
  } catch(_){ return res.status(400).json({ok:false,error:'Invalid JSON'}); }

  const slug = String(body.slug||'').trim();
  if(!slug) return res.status(400).json({ok:false,error:'Missing slug'});

  // ---- Disconnect: DELETE the row (avoids not-null constraints entirely) ----
  if(body.disconnect){
    const {error}=await supabase.from('ig_connections').delete().eq('slug',slug);
    if(error) return res.status(500).json({ok:false,error:error.message});
    return res.json({ok:true,disconnected:true});
  }

  const token = String(body.token||'').trim();
  if(!token) return res.status(400).json({ok:false,error:'Missing token'});

  // Verify token + get identity (ig_user_id is NOT NULL in the table, so we must have it)
  let username=null, igUserId=null;
  try {
    const uRes=await fetch('https://graph.instagram.com/me?fields=id,username&access_token='+encodeURIComponent(token));
    const uJson=await uRes.json().catch(()=>({}));
    if(!uRes.ok) return res.status(400).json({ok:false,error:'Token invalid: '+(uJson.error&&uJson.error.message||'bad token')});
    username=uJson.username||null;
    igUserId=uJson.id||null;
  } catch(e){ return res.status(500).json({ok:false,error:'Could not verify token: '+String(e&&e.message||e)}); }
  if(!igUserId) return res.status(400).json({ok:false,error:'Token verified but no user id returned'});

  const expiresAt=new Date(Date.now()+(60*24*60*60*1000)).toISOString();

  const row={slug,access_token:token,token_expires_at:expiresAt,ig_username:username,ig_user_id:igUserId,ig_cache:null,ig_cache_at:null};
  const {error:e1}=await supabase.from('ig_connections').upsert(row,{onConflict:'slug'});
  if(e1){
    // Retry without optional cache columns in case they don't exist
    const {error:e2}=await supabase.from('ig_connections')
      .upsert({slug,access_token:token,token_expires_at:expiresAt,ig_username:username,ig_user_id:igUserId},{onConflict:'slug'});
    if(e2) return res.status(500).json({ok:false,error:e2.message});
  }

  return res.json({ok:true,username});
};
