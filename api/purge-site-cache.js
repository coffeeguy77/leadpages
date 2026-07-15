// api/purge-site-cache.js — invalidate CDN HTML for one tenant after Publish.
// Auth: Bearer JWT; must own/service the site (or be super-admin).
// Soft-fails if Vercel purge env is missing so publish still succeeds.

const { createClient } = require('@supabase/supabase-js');
const vercel = require('./vercel/_client');

const SUPABASE_URL = process.env.SUPABASE_URL;
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'string') {
        try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); }
      }
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
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
  } catch { return null; }
}

async function isSuperAdmin(userId) {
  const { data } = await admin.from('profiles').select('is_super_admin').eq('id', userId).maybeSingle();
  return !!(data && data.is_super_admin);
}

async function partnerIdForUser(userId) {
  const { data } = await admin.from('partners').select('id,status').eq('user_id', userId).maybeSingle();
  if (!data || data.status !== 'active') return null;
  return data.id;
}

async function assertSiteAccess(user, site) {
  if (!user || !site) return false;
  if (await isSuperAdmin(user.id)) return true;
  if (site.owner_user_id && site.owner_user_id === user.id) return true;
  const pid = await partnerIdForUser(user.id);
  if (pid && (site.servicing_partner_id === pid || site.referring_partner_id === pid)) return true;
  return false;
}

module.exports = async (req, res) => {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'method' }));
  }

  const user = await requireUser(req);
  if (!user) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: 'auth' }));
  }

  const body = await readBody(req);
  const siteId = body.siteId ? String(body.siteId).trim() : '';
  const slugIn = body.slug ? String(body.slug).trim().toLowerCase() : '';

  let site = null;
  try {
    if (siteId) {
      const r = await admin.from('sites')
        .select('id,slug,custom_domain,owner_user_id,servicing_partner_id,referring_partner_id')
        .eq('id', siteId).maybeSingle();
      site = r.data || null;
    } else if (slugIn) {
      const r = await admin.from('sites')
        .select('id,slug,custom_domain,owner_user_id,servicing_partner_id,referring_partner_id')
        .eq('slug', slugIn).maybeSingle();
      site = r.data || null;
    }
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: 'lookup' }));
  }

  if (!site) {
    res.statusCode = 404;
    return res.end(JSON.stringify({ ok: false, error: 'not_found' }));
  }
  if (!(await assertSiteAccess(user, site))) {
    res.statusCode = 403;
    return res.end(JSON.stringify({ ok: false, error: 'forbidden' }));
  }

  const tags = [
    vercel.cacheTagForSlug(site.slug),
    vercel.cacheTagForSiteId(site.id)
  ].filter(Boolean);

  if (!vercel.projectConfigured()) {
    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true,
      purged: false,
      skipped: 'vercel_purge_not_configured',
      tags
    }));
  }

  try {
    await vercel.invalidateByTags(tags, 'production');
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, purged: true, tags }));
  } catch (e) {
    console.error('purge-site-cache:', e && e.message, e && e.data);
    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true,
      purged: false,
      error: (e && e.code) || 'purge_failed',
      message: (e && e.message) || '',
      tags
    }));
  }
};
