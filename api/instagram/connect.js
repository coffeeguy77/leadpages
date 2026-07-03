// api/instagram/connect.js
const crypto = require('crypto');

const APP_ID      = process.env.INSTAGRAM_APP_ID;
const APP_SECRET  = process.env.INSTAGRAM_APP_SECRET;
const REDIRECT    = 'https://www.leadpages.com.au/api/instagram/callback';
const STATE_SEC   = process.env.IG_STATE_SECRET || APP_SECRET || '';
const SCOPE       = 'instagram_business_basic';

function sign(p){ return crypto.createHmac('sha256', STATE_SEC).update(p).digest('base64url'); }
function makeState(slug){
  const body = Buffer.from(JSON.stringify({s:slug, t:Date.now(), n:crypto.randomBytes(8).toString('hex')})).toString('base64url');
  return body + '.' + sign(body);
}

module.exports = async (req, res) => {
  try {
    const slug = ((req.query && req.query.slug)||'').toString().trim();
    if(!slug) return res.status(400).send('Missing site slug.');
    if(!APP_ID || !APP_SECRET) return res.status(500).send('Instagram connection is not configured yet.');

    // Log the exact redirect URI being used (visible in Vercel function logs)
    console.log('[ig-connect] slug='+slug+' redirect='+REDIRECT+' appId='+APP_ID);

    const url = 'https://www.instagram.com/oauth/authorize'
      + '?client_id='     + encodeURIComponent(APP_ID)
      + '&redirect_uri='  + encodeURIComponent(REDIRECT)
      + '&response_type=code'
      + '&scope='         + encodeURIComponent(SCOPE)
      + '&state='         + encodeURIComponent(makeState(slug));

    res.setHeader('cache-control','no-store');
    res.writeHead(302, {Location: url});
    res.end();
  } catch(e){
    res.status(500).send('Could not start Instagram connection: '+String(e&&e.message||e));
  }
};
