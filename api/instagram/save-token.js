// api/instagram/save-token.js
// POST {slug, token} — saves a long-lived token directly to ig_connections.
// POST {slug, token:'', disconnect:true} — clears the connection.
// Only callable from the manage editor (checks Origin/Referer).

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  res.setHeader('Content-Type','application/json');
  res.setHeader('cache-control','no-store');

  // Only allow from manage page
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

  // Disconnect
  if(body.disconnect){
    const {error}=await supabase.from('ig_connections')
      .update({access_token:null,token_expires_at:null,ig_username:null,ig_user_id:null,ig_cache:null,ig_cache_at:null})
      .eq('slug',slug);
    if(error) return res.status(500).json({ok:false,error:error.message});
    return res.json({ok:true});
  }

  const token = String(body.token||'').trim();
  if(!token) return res.status(400).json({ok:false,error:'Missing token'});

  // Verify the token works and get username
  let username=null, igUserId=null, expiresAt=null;
  try {
    const uRes=await fetch('https://graph.instagram.com/me?fields=id,username&access_token='+encodeURIComponent(token));
    const uJson=await uRes.json().catch(()=>({}));
    if(!uRes.ok) return res.status(400).json({ok:false,error:'Token invalid: '+(uJson.error&&uJson.error.message||'bad token')});
    username=uJson.username||null;
    igUserId=uJson.id||null;
  } catch(e){ return res.status(500).json({ok:false,error:'Could not verify token: '+String(e&&e.message||e)}); }

  // Long-lived tokens expire in ~60 days — set expiry
  expiresAt=new Date(Date.now()+(60*24*60*60*1000)).toISOString();

  const row={slug,access_token:token,token_expires_at:expiresAt,ig_username:username,ig_user_id:igUserId,ig_cache:null,ig_cache_at:null};
  const {error:e1}=await supabase.from('ig_connections').upsert(row,{onConflict:'slug'});
  if(e1){
    const {error:e2}=await supabase.from('ig_connections')
      .upsert({slug,access_token:token,token_expires_at:expiresAt,ig_username:username},{onConflict:'slug'});
    if(e2) return res.status(500).json({ok:false,error:e2.message});
  }

  return res.json({ok:true,username});
};
