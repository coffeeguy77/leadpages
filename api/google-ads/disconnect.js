// POST /api/google-ads/disconnect — revoke Google token, wipe credentials, stop sync.
const { createClient } = require('@supabase/supabase-js');
const { revokeGoogleToken } = require('../../lib/google-ads/oauth');
const { decryptSecret } = require('../../lib/google-ads/token-crypto');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); } }
      return resolve(req.body);
    }
    let raw = ''; req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function authUser(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

module.exports = async (req, res) => {
  const json = (code, obj) => {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify(obj));
  };
  if (req.method !== 'POST') return json(405, { error: 'method' });
  if (!authUser(req)) return json(401, { error: 'auth' });

  try {
    const body = await readBody(req);
    const siteId = String(body.siteId || '').trim();
    if (!siteId) return json(400, { error: 'missing_siteId' });

    const { data: conn } = await admin
      .from('google_ads_connections')
      .select('refresh_token,access_token')
      .eq('site_id', siteId)
      .maybeSingle();

    let revoked = false;
    if (conn && conn.refresh_token) {
      try {
        const plain = decryptSecret(conn.refresh_token);
        const result = await revokeGoogleToken(plain);
        revoked = !!(result && result.ok);
      } catch (e) {
        // Still wipe local credentials even if revoke fails.
        console.error('google-ads revoke failed:', e && e.message);
      }
    }

    // Hard-delete credentials so nothing reusable remains. Cron only syncs enabled rows with tokens.
    const { error } = await admin.from('google_ads_connections').delete().eq('site_id', siteId);
    if (error) return json(500, { error: 'disconnect_failed' });

    return json(200, { ok: true, revoked });
  } catch (e) {
    console.error('google-ads disconnect:', e && e.message);
    return json(500, { error: 'disconnect_failed' });
  }
};
