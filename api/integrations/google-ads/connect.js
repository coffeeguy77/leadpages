// GET|POST /api/integrations/google-ads/connect?siteId=&slug=
// Starts Google Ads OAuth. Requires authenticated session.
// Redirect URI is taken only from env (GOOGLE_ADS_REDIRECT_URI / APP_URL) — never from Host.
//
// Preferred client flow (avoids putting JWT in the query string / Referer):
//   fetch(connectUrl, { headers: { Authorization: 'Bearer …', Accept: 'application/json' } })
//   → { url } → location.href = url (Google authorize)
//
// Fallback: GET ?access_token=… for simple top-level navigations.

const { createClient } = require('@supabase/supabase-js');
const cfg = require('../../../lib/google-ads/config');
const { makeState, authorizeUrl } = require('../../../lib/google-ads/oauth');
const { safeReturnPath } = require('../../../lib/app-url');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function bearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

function wantsJson(req) {
  if (req.method === 'POST') return true;
  const q = req.query || {};
  if (String(q.format || '') === 'json') return true;
  const accept = String(req.headers.accept || '');
  return accept.indexOf('application/json') >= 0;
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.method === 'GET' || req.method === 'HEAD') return resolve({});
    if (req.body) {
      if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); } }
      return resolve(req.body);
    }
    let raw = ''; req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

module.exports = async (req, res) => {
  const sendJson = (code, obj) => {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify(obj));
  };
  const sendText = (code, msg) => {
    res.statusCode = code;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(msg);
  };

  try {
    if (!cfg.configured()) {
      return wantsJson(req)
        ? sendJson(503, { error: 'not_configured' })
        : sendText(503, 'Google Ads is not configured on this platform yet.');
    }

    const body = await readBody(req);
    const q = req.query || {};
    const siteId = String(body.siteId || q.siteId || q.site_id || '').trim();
    let slug = String(body.slug || q.slug || '').trim();
    if (!siteId && !slug) {
      return wantsJson(req) ? sendJson(400, { error: 'missing_siteId' }) : sendText(400, 'Missing siteId or slug.');
    }

    const token = bearer(req) || String(q.access_token || '').trim() || null;
    if (!token) {
      return wantsJson(req)
        ? sendJson(401, { error: 'auth_required' })
        : sendText(401, 'Sign in required to connect Google Ads.');
    }

    const anon = process.env.SUPABASE_ANON_KEY || '';
    const userClient = createClient(process.env.SUPABASE_URL, anon || process.env.SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: 'Bearer ' + token } }
    });
    // Prefer Auth REST so we do not depend on anon key being present in every env.
    let userId = null;
    try {
      const ur = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
        headers: { apikey: anon || process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + token }
      });
      if (ur.ok) {
        const u = await ur.json();
        userId = u && u.id ? u.id : null;
      }
    } catch (e) { /* fall through */ }
    if (!userId) {
      const { data: userData } = await userClient.auth.getUser();
      userId = userData && userData.user && userData.user.id;
    }
    if (!userId) {
      return wantsJson(req)
        ? sendJson(401, { error: 'invalid_session' })
        : sendText(401, 'Invalid or expired session. Sign in again, then reconnect Google Ads.');
    }

    if (siteId && !slug) {
      const { data } = await admin.from('sites').select('slug').eq('id', siteId).maybeSingle();
      slug = (data && data.slug) || '';
    }

    const returnPath = safeReturnPath(body.returnPath || q.returnPath || q.return || '/settings/integrations/google-ads');
    const state = makeState({
      siteId: siteId || null,
      slug: slug || null,
      userId,
      returnPath
    });

    console.log('[gads-connect] redirect_uri=' + cfg.oauthRedirectUri() + ' siteId=' + (siteId || '') + ' userId=' + userId);

    const url = authorizeUrl(state);
    if (wantsJson(req)) {
      return sendJson(200, {
        ok: true,
        url,
        redirectUri: cfg.oauthRedirectUri(),
        returnPath
      });
    }

    res.setHeader('cache-control', 'no-store');
    res.writeHead(302, { Location: url });
    res.end();
  } catch (e) {
    return wantsJson(req)
      ? sendJson(500, { error: String(e && e.message || e) })
      : sendText(500, 'Could not start Google Ads connection: ' + String(e && e.message || e));
  }
};
