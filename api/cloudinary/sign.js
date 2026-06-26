// api/cloudinary/sign.js — signs a direct Cloudinary upload, scoped to leadpages/<site>/...
// The API secret never leaves the server. Requires a valid Supabase session.
//
// Notes on the 403 we hit before: every upload uses a UNIQUE public_id, so overwrite/
// invalidate are unnecessary — and signing `invalidate` can trigger a 403 on accounts
// without invalidation privileges. So we sign the minimal set { public_id, timestamp }.
// Credentials are resolved coherently: a complete CLOUDINARY_URL wins as a single unit
// (never mixing key from one source and secret from another).

const crypto = require('crypto');

async function verifyAuth(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  try {
    const r = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
    });
    return r.ok;
  } catch (e) { return false; }
}

function resolveCreds() {
  // Prefer a complete CLOUDINARY_URL as one coherent unit.
  const url = (process.env.CLOUDINARY_URL || '').trim();
  const m = url.match(/cloudinary:\/\/([^:\s]+):([^@\s]+)@([^/\s]+)/i);
  if (m && !/[<>]/.test(m[1]) && !/[<>]/.test(m[2])) {
    return { key: decodeURIComponent(m[1]), secret: decodeURIComponent(m[2]), cloud: m[3].replace(/[^a-zA-Z0-9_\-]/g, '') || 'dzx6x1hou' };
  }
  // Otherwise the separate vars (tolerating a connection string in the cloud-name var).
  let key = (process.env.CLOUDINARY_API_KEY || '').trim();
  let secret = (process.env.CLOUDINARY_API_SECRET || '').trim();
  let cloud = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  if (/cloudinary:\/\//.test(cloud)) {
    const mm = cloud.match(/cloudinary:\/\/([^:\s]+):([^@\s]+)@([^/\s]+)/i);
    if (mm) { if (!key && !/[<>]/.test(mm[1])) key = decodeURIComponent(mm[1]); if (!secret && !/[<>]/.test(mm[2])) secret = decodeURIComponent(mm[2]); cloud = mm[3]; }
  }
  if (cloud.indexOf('@') >= 0) cloud = cloud.split('@').pop();
  cloud = cloud.replace(/[^a-zA-Z0-9_\-]/g, '') || 'dzx6x1hou';
  return { key, secret, cloud };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!(await verifyAuth(req))) return res.status(401).json({ error: 'unauthorized' });

  const body = req.body || {};
  let publicId = String(body.publicId || '');
  if (!/^leadpages\//.test(publicId)) return res.status(400).json({ error: 'publicId must be under leadpages/' });
  publicId = publicId.replace(/[^a-zA-Z0-9_\/\-]/g, '');

  const { key, secret, cloud } = resolveCreds();
  if (!key || !secret) return res.status(500).json({ error: 'Cloudinary credentials are not configured. Set CLOUDINARY_URL (or CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET).' });

  const timestamp = Math.floor(Date.now() / 1000);
  const params = { public_id: publicId, timestamp };
  const toSign = Object.keys(params).sort().map((k) => k + '=' + params[k]).join('&');
  const signature = crypto.createHash('sha1').update(toSign + secret).digest('hex');

  return res.status(200).json({ signature, timestamp, apiKey: key, cloudName: cloud, publicId });
};
