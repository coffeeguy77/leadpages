// api/cloudinary/diag.js — pinpoints Cloudinary upload problems with zero guessing.
// Visit (signed in) /api/cloudinary/diag — it resolves the credentials, pings the
// Cloudinary Admin API, and performs a real signed upload of a 1x1 pixel, returning
// Cloudinary's exact response so the cause is unambiguous. The API secret is never
// returned (only its length). Requires a valid Supabase session.

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
  const url = (process.env.CLOUDINARY_URL || '').trim();
  const m = url.match(/cloudinary:\/\/([^:\s]+):([^@\s]+)@([^/\s]+)/i);
  if (m && !/[<>]/.test(m[1]) && !/[<>]/.test(m[2])) {
    return { key: decodeURIComponent(m[1]), secret: decodeURIComponent(m[2]), cloud: m[3].replace(/[^a-zA-Z0-9_\-]/g, '') || 'dzx6x1hou', source: 'CLOUDINARY_URL' };
  }
  let key = (process.env.CLOUDINARY_API_KEY || '').trim();
  let secret = (process.env.CLOUDINARY_API_SECRET || '').trim();
  let cloud = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  if (cloud.indexOf('@') >= 0) cloud = cloud.split('@').pop();
  cloud = cloud.replace(/[^a-zA-Z0-9_\-]/g, '') || 'dzx6x1hou';
  return { key, secret, cloud, source: 'separate vars' };
}

module.exports = async (req, res) => {
  if (!(await verifyAuth(req))) return res.status(401).json({ error: 'unauthorized — sign in to /manage first, then open this URL in the same browser' });

  const { key, secret, cloud, source } = resolveCreds();
  const out = {
    cloud, source,
    apiKey: key || '(empty)',
    apiKeyLength: key.length,
    secretPresent: !!secret,
    secretLength: secret.length,
  };

  // 1) Admin API ping (validates key/secret against the cloud)
  try {
    const auth = 'Basic ' + Buffer.from(key + ':' + secret).toString('base64');
    const r = await fetch('https://api.cloudinary.com/v1_1/' + cloud + '/resources/image?max_results=1', { headers: { Authorization: auth } });
    out.adminPingStatus = r.status;
    const jb = await r.json().catch(() => ({}));
    out.adminPingMessage = (jb && jb.error && jb.error.message) || (r.ok ? 'ok' : 'failed');
  } catch (e) { out.adminPingStatus = 'network-error'; out.adminPingMessage = String(e.message); }

  // 2) Real signed upload of a 1x1 png (same signing as sign.js)
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = 'leadpages/_diag/test_' + timestamp;
    const toSign = 'public_id=' + publicId + '&timestamp=' + timestamp;
    const signature = crypto.createHash('sha1').update(toSign + secret).digest('hex');
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const fd = new URLSearchParams();
    fd.append('file', png); fd.append('api_key', key); fd.append('timestamp', String(timestamp)); fd.append('public_id', publicId); fd.append('signature', signature);
    const ur = await fetch('https://api.cloudinary.com/v1_1/' + cloud + '/image/upload', { method: 'POST', body: fd });
    out.uploadTestStatus = ur.status;
    const uj = await ur.json().catch(() => ({}));
    out.uploadTestMessage = (uj && uj.error && uj.error.message) || (ur.ok ? 'ok' : 'failed');
    out.uploadTestOk = !!(ur.ok && uj.secure_url);
    if (out.uploadTestOk) {
      try { const da = 'Basic ' + Buffer.from(key + ':' + secret).toString('base64'); await fetch('https://api.cloudinary.com/v1_1/' + cloud + '/resources/image/upload?public_ids[]=' + encodeURIComponent(publicId), { method: 'DELETE', headers: { Authorization: da } }); } catch (e) {}
    }
  } catch (e) { out.uploadTestStatus = 'network-error'; out.uploadTestMessage = String(e.message); }

  out.verdict = out.uploadTestOk
    ? 'WORKING — credentials and signed upload both succeed. Redeploy manage.html + sign.js and your uploads will work.'
    : (out.adminPingStatus === 401 || out.uploadTestStatus === 401 || out.uploadTestStatus === 403
        ? 'CREDENTIALS — the API key/secret do not match this cloud (' + cloud + '). Re-copy them from Cloudinary → Settings → API Keys for THIS cloud. Message: ' + out.uploadTestMessage
        : (out.adminPingStatus === 404
            ? 'CLOUD NAME — "' + cloud + '" is not a valid cloud for these credentials.'
            : 'See uploadTestMessage: ' + out.uploadTestMessage));

  res.status(200).setHeader('content-type', 'application/json');
  return res.end(JSON.stringify(out, null, 2));
};
