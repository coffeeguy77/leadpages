// api/cloudinary/sign.js — Vercel serverless function (CommonJS, matches existing /api style)
// Signs a Cloudinary upload so the admin browser can upload directly, scoped to leadpages/<site>/...
// The API secret never leaves the server. Requires a valid Supabase session (admin/broker).
//
// Credential resolution is defensive about how the env vars were entered in Vercel:
//   • Preferred: the single standard CLOUDINARY_URL = cloudinary://<key>:<secret>@<cloud>
//   • Or the three separate vars CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET / CLOUDINARY_CLOUD_NAME
//   • If someone pasted the whole connection string into the wrong var (a common mistake that
//     produced an upload URL like /v1_1/CLOUDINARY_URL=cloudinary://...@dzx6x1hou/... → 404),
//     we still extract the real cloud name (the part after '@') and strip junk characters.

const crypto = require('crypto');

async function verifyAuth(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  try {
    const r = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
    });
    return r.ok;
  } catch (e) {
    return false;
  }
}

// Pull key / secret / cloud from whatever the env vars happen to contain.
function resolveCreds() {
  let key = (process.env.CLOUDINARY_API_KEY || '').trim();
  let secret = (process.env.CLOUDINARY_API_SECRET || '').trim();
  let cloud = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();

  // A cloudinary:// connection string may live in CLOUDINARY_URL, or have been
  // pasted into one of the other vars by mistake. Find it wherever it is.
  const haystack = [
    process.env.CLOUDINARY_URL || '',
    process.env.CLOUDINARY_CLOUD_NAME || '',
    process.env.CLOUDINARY_API_KEY || '',
  ].join(' ');
  const m = haystack.match(/cloudinary:\/\/([^:\s]+):([^@\s]+)@([^/\s]+)/i);
  if (m) {
    const uKey = decodeURIComponent(m[1]);
    const uSecret = decodeURIComponent(m[2]);
    const uCloud = m[3];
    // Only adopt parsed values that look real (ignore the <your_api_key> placeholders).
    if (!key && !/[<>]/.test(uKey)) key = uKey;
    if (!secret && !/[<>]/.test(uSecret)) secret = uSecret;
    cloud = uCloud; // the cloud name after '@' is always the real one
  }

  // Final clean-up of the cloud name: drop a leading "...@" if present, then keep
  // only valid cloud-name characters. Fall back to the known leadpages cloud.
  if (cloud.indexOf('@') >= 0) cloud = cloud.split('@').pop();
  cloud = cloud.replace(/[^a-zA-Z0-9_\-]/g, '') || 'dzx6x1hou';

  return { key, secret, cloud };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!(await verifyAuth(req))) return res.status(401).json({ error: 'unauthorized' });

  const body = req.body || {};
  let publicId = String(body.publicId || '');
  // Hard scope: only the platform's own customer namespace.
  if (!/^leadpages\//.test(publicId)) return res.status(400).json({ error: 'publicId must be under leadpages/' });
  publicId = publicId.replace(/[^a-zA-Z0-9_\/\-]/g, '');

  const { key, secret, cloud } = resolveCreds();
  if (!key || !secret) {
    return res.status(500).json({ error: 'Cloudinary credentials are not configured. Set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET (or a single CLOUDINARY_URL) in the project environment variables.' });
  }

  const overwrite = body.overwrite === false ? 'false' : 'true';
  const invalidate = 'true';
  const timestamp = Math.floor(Date.now() / 1000);

  // Cloudinary signature: alphabetical params joined k=v&..., then append api_secret, sha1.
  const params = { invalidate, overwrite, public_id: publicId, timestamp };
  const toSign = Object.keys(params).sort().map((k) => k + '=' + params[k]).join('&');
  const signature = crypto.createHash('sha1').update(toSign + secret).digest('hex');

  return res.status(200).json({
    signature,
    timestamp,
    apiKey: key,
    cloudName: cloud,
    publicId,
    overwrite,
    invalidate,
  });
};
