// api/seo-saver/hits.js — old-URL hits for one site (SEO Saver tab in the editor).
//   GET  ?siteId=<uuid>                     → { ok, rows:[{path,kind,target,hits,google_hits,first_seen,last_seen,last_referrer,dismissed}], tableReady }
//   POST { siteId, path, dismissed:true }    → hide (or un-hide) one row from the "not found" list
// Auth: Bearer JWT; caller must own/service the site or be super-admin (same rule as purge-site-cache).

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
let _admin = null;
function admin() {
  if (!_admin) _admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  return res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch (e) { return resolve({}); } }
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 8192) raw = raw.slice(0, 8192); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

async function requireUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  try {
    const userClient = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: 'Bearer ' + token } }
    });
    const { data, error } = await userClient.auth.getUser(token);
    if (error || !data || !data.user) return null;
    return data.user;
  } catch (e) { return null; }
}

async function canEditSite(user, siteId) {
  const { data: site } = await admin().from('sites')
    .select('id, owner_user_id, servicing_partner_id, referring_partner_id').eq('id', siteId).maybeSingle();
  if (!site) return false;
  const { data: prof } = await admin().from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle();
  if (prof && prof.is_super_admin) return true;
  if (site.owner_user_id && site.owner_user_id === user.id) return true;
  const { data: partner } = await admin().from('partners').select('id,status').eq('user_id', user.id).maybeSingle();
  if (partner && partner.status === 'active' && (site.servicing_partner_id === partner.id || site.referring_partner_id === partner.id)) return true;
  return false;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') return send(res, 405, { ok: false, error: 'method' });
  const user = await requireUser(req);
  if (!user) return send(res, 401, { ok: false, error: 'auth', message: 'Please sign in again.' });

  const body = req.method === 'POST' ? await readBody(req) : {};
  const siteId = String((req.query && req.query.siteId) || body.siteId || '').trim();
  if (!UUID.test(siteId)) return send(res, 400, { ok: false, error: 'siteId' });
  if (!(await canEditSite(user, siteId))) return send(res, 403, { ok: false, error: 'forbidden', message: 'You can’t view this site’s SEO data.' });

  if (req.method === 'POST') {
    const path = String(body.path || '').slice(0, 500);
    if (!path) return send(res, 400, { ok: false, error: 'path' });
    const { error } = await admin().from('site_url_hits').update({ dismissed: body.dismissed !== false }).eq('site_id', siteId).eq('path', path);
    if (error) return send(res, 500, { ok: false, error: 'update', message: error.message });
    return send(res, 200, { ok: true });
  }

  const { data, error } = await admin().from('site_url_hits')
    .select('path, kind, target, hits, google_hits, first_seen, last_seen, last_referrer, dismissed')
    .eq('site_id', siteId).order('last_seen', { ascending: false }).limit(1000);
  if (error) {
    // Migration not run yet: the tab still works (redirects need no table), just without hit counts.
    if (/site_url_hits|does not exist|schema cache/i.test(error.message || '')) return send(res, 200, { ok: true, rows: [], tableReady: false });
    return send(res, 500, { ok: false, error: 'query', message: error.message });
  }
  return send(res, 200, { ok: true, rows: data || [], tableReady: true });
};
