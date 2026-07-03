// api/instagram/connect.js — Instagram Business Login (multi-tenant)
const crypto = require('crypto');

const APP_ID    = process.env.INSTAGRAM_APP_ID;
const APP_SEC   = process.env.INSTAGRAM_APP_SECRET;
const REDIRECT  = 'https://www.leadpages.com.au/api/instagram/callback';
const STATE_SEC = process.env.IG_STATE_SECRET || APP_SEC || '';

function sign(p){ return crypto.createHmac('sha256',STATE_SEC).update(p).digest('base64url'); }
function makeState(slug){
  const body=Buffer.from(JSON.stringify({s:slug,t:Date.now(),n:crypto.randomBytes(8).toString('hex')})).toString('base64url');
  return body+'.'+sign(body);
}

module.exports = async (req, res) => {
  try {
    const slug = ((req.query&&req.query.slug)||'').toString().trim();
    if(!slug) return res.status(400).send('Missing site slug.');
    if(!APP_ID||!APP_SEC) return res.status(500).send('Instagram connection is not configured yet.');

    console.log('[ig-connect] slug='+slug+' appId='+APP_ID);

    // Build URL manually — do NOT encodeURIComponent the scope so commas stay as commas
    const state = encodeURIComponent(makeState(slug));
    const redirect = encodeURIComponent(REDIRECT);
    const url = 'https://www.instagram.com/oauth/authorize'
      +'?force_reauth=true'
      +'&client_id='+APP_ID
      +'&redirect_uri='+redirect
      +'&response_type=code'
      +'&scope=instagram_business_basic'
      +'&state='+state;

    res.setHeader('cache-control','no-store');
    res.writeHead(302,{Location:url});
    res.end();
  } catch(e){
    res.status(500).send('Could not start Instagram connection: '+String(e&&e.message||e));
  }
};
