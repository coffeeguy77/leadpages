// api/cloudinary/sign.js — Vercel serverless function (CommonJS, matches existing /api style)
// Signs a Cloudinary upload so the admin browser can upload directly, scoped to leadpages/<site>/...
// The API secret never leaves the server. Requires a valid Supabase session (admin/broker).

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

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!(await verifyAuth(req))) return res.status(401).json({ error: 'unauthorized' });

  const body = req.body || {};
  let publicId = String(body.publicId || '');
  // Hard scope: only the platform's own customer namespace.
  if (!/^leadpages\//.test(publicId)) return res.status(400).json({ error: 'publicId must be under leadpages/' });
  publicId = publicId.replace(/[^a-zA-Z0-9_\/\-]/g, '');

  // Dynamic-folder accounts file an asset by its asset_folder, NOT by the path inside
  // its public_id. Without this, every upload lands in Home (root) instead of leadpages/.
  // Default the folder from the public_id (everything before the last segment).
  let assetFolder = String(body.assetFolder || publicId.replace(/\/[^/]*$/, ''));
  if (!/^leadpages\//.test(assetFolder)) return res.status(400).json({ error: 'assetFolder must be under leadpages/' });
  assetFolder = assetFolder.replace(/[^a-zA-Z0-9_\/\-]/g, '');

  // overwrite:false — public_ids are already unique, so an upload can never clobber an
  // existing asset. This closes the only code-level way an upload could destroy a file.
  const overwrite = 'false';
  const timestamp = Math.floor(Date.now() / 1000);

  // Sign EXACTLY the params the browser will send (alphabetical k=v&..., + api_secret, sha1).
  const params = { asset_folder: assetFolder, overwrite, public_id: publicId, timestamp };
  const toSign = Object.keys(params).sort().map((k) => k + '=' + params[k]).join('&');
  const signature = crypto.createHash('sha1').update(toSign + process.env.CLOUDINARY_API_SECRET).digest('hex');

  return res.status(200).json({
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'dzx6x1hou',
    publicId,
    assetFolder,
    overwrite,
  });
};
