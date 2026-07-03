// api/instagram/connect.js — starts "Business Login for Instagram" for one site.
// GET /api/instagram/connect?slug=<site-slug>  ->  302 to Instagram's consent screen.
//
// No secrets reach the browser. The site slug is carried in a signed `state` value
// (HMAC-SHA256) so the callback can trust which site is being connected.
//
// Env: INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET (used to sign state if IG_STATE_SECRET unset),
//      INSTAGRAM_REDIRECT_URI (must match the URI registered in the Meta app), IG_STATE_SECRET (optional).

const crypto = require('crypto');

const APP_ID = process.env.INSTAGRAM_APP_ID;
const REDIRECT = process.env.INSTAGRAM_REDIRECT_URI || 'https://www.leadpages.com.au/api/instagram/callback';
const STATE_SECRET = process.env.IG_STATE_SECRET || process.env.INSTAGRAM_APP_SECRET || '';
const SCOPE = 'instagram_business_basic';

function sign(payload) {
  return crypto.createHmac('sha256', STATE_SECRET).update(payload).digest('base64url');
}
function makeState(slug) {
  const body = Buffer.from(JSON.stringify({ s: slug, t: Date.now(), n: crypto.randomBytes(8).toString('hex') })).toString('base64url');
  return body + '.' + sign(body);
}

module.exports = async (req, res) => {
  try {
    const slug = ((req.query && req.query.slug) || '').toString().trim();
    if (!slug) return res.status(400).send('Missing site slug.');
    if (!APP_ID || !STATE_SECRET) return res.status(500).send('Instagram connection is not configured yet.');

    const url = 'https://www.instagram.com/oauth/authorize'
      + '?client_id=' + encodeURIComponent(APP_ID)
      + '&redirect_uri=' + encodeURIComponent(REDIRECT)
      + '&response_type=code'
      + '&scope=' + encodeURIComponent(SCOPE)
      + '&state=' + encodeURIComponent(makeState(slug));

    res.setHeader('cache-control', 'no-store');
    res.writeHead(302, { Location: url });
    res.end();
  } catch (e) {
    res.status(500).send('Could not start Instagram connection.');
  }
};
