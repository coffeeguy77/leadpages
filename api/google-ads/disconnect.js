const { createClient } = require('@supabase/supabase-js');

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
    res.end(JSON.stringify(obj));
  };
  if (req.method !== 'POST') return json(405, { error: 'method' });
  if (!authUser(req)) return json(401, { error: 'auth' });

  try {
    const body = await readBody(req);
    const siteId = String(body.siteId || '').trim();
    if (!siteId) return json(400, { error: 'missing_siteId' });
    const { error } = await admin.from('google_ads_connections').delete().eq('site_id', siteId);
    if (error) return json(500, { error: error.message });
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: (e && e.message) || 'disconnect_failed' });
  }
};
