// GET /api/integrations/google-ads/encryption-diag
// Temporary safe diagnostic for GOOGLE_ADS_OAUTH_ENCRYPTION_KEY visibility/format.
// Never returns any portion of the key. Requires a signed-in session.

const { encryptionKeyDiagnostics } = require('../../../lib/google-ads/encryption-key');

async function verifyAuth(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon) return false;
  try {
    const r = await fetch(url + '/auth/v1/user', {
      headers: { apikey: anon, Authorization: 'Bearer ' + token }
    });
    return r.ok;
  } catch (e) {
    return false;
  }
}

module.exports = async (req, res) => {
  const json = (code, obj) => {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify(obj));
  };

  if (req.method !== 'GET') return json(405, { error: 'method' });
  if (!(await verifyAuth(req))) return json(401, { error: 'auth_required' });

  // Exact safe shape only — no key material, no mode string that could leak format guesses beyond lengths.
  const d = encryptionKeyDiagnostics();
  return json(200, {
    configured: d.configured,
    rawLength: d.rawLength,
    decodedByteLength: d.decodedByteLength,
    runtime: d.runtime,
    vercelEnvironment: d.vercelEnvironment
  });
};
