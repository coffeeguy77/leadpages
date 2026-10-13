// api/cloudinary/library.js — per-site image library for /manage.
//
// GET  ?siteId=<uuid>                 → every image uploaded for that site (newest first),
//                                        each marked inUse when the saved site config uses it.
// POST { siteId, action:'delete', publicId } → deletes one image from Cloudinary, only when it
//                                        belongs to that site's folder and the saved config
//                                        doesn't use it (409 in_use otherwise).
//
// Auth: Supabase JWT; the caller must be able to edit the site (owner, its active partner,
// or super-admin — same rule as site backups). Images live under leadpages/<siteId>/ (and,
// for older uploads, leadpages/<slug>/). Nothing is stored in the database.

const { createClient } = require('@supabase/supabase-js');
const { assertSiteAccess } = require('../../lib/site-backups/service');

const SUPABASE_URL = process.env.SUPABASE_URL;
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); } }
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

// Same credential resolution as api/cloudinary/delete.js.
function resolveCreds() {
  const url = (process.env.CLOUDINARY_URL || '').trim();
  const m = url.match(/cloudinary:\/\/([^:\s]+):([^@\s]+)@([^/\s]+)/i);
  if (m && !/[<>]/.test(m[1]) && !/[<>]/.test(m[2])) {
    return { key: decodeURIComponent(m[1]), secret: decodeURIComponent(m[2]), cloud: m[3].replace(/[^a-zA-Z0-9_\-]/g, '') || 'dzx6x1hou' };
  }
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
function basic(c) { return 'Basic ' + Buffer.from(c.key + ':' + c.secret).toString('base64'); }

const seg = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\-]/g, '');

/** Folders a site's uploads can live in (editor uses the site id; very old uploads the slug). */
function sitePrefixes(site) {
  const out = [];
  const id = seg(site.id); if (id) out.push('leadpages/' + id + '/');
  const slug = seg(site.slug); if (slug && slug !== id) out.push('leadpages/' + slug + '/');
  return out;
}

/** True when any text value in the config (except "*_pid" bookkeeping keys) contains the id. */
function inUse(config, publicId) {
  if (!publicId) return false;
  let found = false;
  (function walk(v, k) {
    if (found || v == null) return;
    if (typeof v === 'string') { if (!/_pid$/.test(k || '') && v.indexOf(publicId) >= 0) found = true; return; }
    if (Array.isArray(v)) { for (let i = 0; i < v.length && !found; i++) walk(v[i], ''); return; }
    if (typeof v === 'object') { for (const kk of Object.keys(v)) { if (found) break; walk(v[kk], kk); } }
  })(config, '');
  return found;
}

async function listPrefix(creds, prefix) {
  const base = 'https://api.cloudinary.com/v1_1/' + creds.cloud + '/resources/image/upload';
  const all = [];
  let cursor = '';
  for (let i = 0; i < 10; i++) { // up to 5,000 images
    const q = '?prefix=' + encodeURIComponent(prefix) + '&max_results=500' + (cursor ? '&next_cursor=' + encodeURIComponent(cursor) : '');
    const r = await fetch(base + q, { headers: { Authorization: basic(creds) } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && j.error.message) || ('cloudinary_' + r.status));
    (j.resources || []).forEach((x) => all.push(x));
    if (!j.next_cursor) break;
    cursor = j.next_cursor;
  }
  return all;
}

module.exports = async (req, res) => {
  const user = await requireUser(req);
  if (!user) return send(res, 401, { ok: false, error: 'auth' });

  const body = req.method === 'POST' ? await readBody(req) : {};
  const siteId = String((req.query && req.query.siteId) || body.siteId || '').trim();
  const access = await assertSiteAccess(admin, user, siteId);
  if (!access.ok) return send(res, access.code || 403, { ok: false, error: access.error, message: access.message });
  const site = access.site;

  // assertSiteAccess doesn't select the slug; fetch it for the legacy folder.
  try {
    const r = await admin.from('sites').select('slug').eq('id', site.id).maybeSingle();
    if (r && r.data) site.slug = r.data.slug;
  } catch (_e) { /* id folder is enough */ }

  const creds = resolveCreds();
  if (!creds.key || !creds.secret) return send(res, 500, { ok: false, error: 'cloudinary_not_configured' });
  const prefixes = sitePrefixes(site);
  const cfg = site.config || {};

  try {
    if (req.method === 'GET') {
      const seen = {};
      let images = [];
      for (const p of prefixes) {
        const list = await listPrefix(creds, p);
        list.forEach((x) => {
          if (seen[x.public_id]) return; seen[x.public_id] = 1;
          images.push({
            publicId: x.public_id,
            url: x.secure_url,
            width: x.width || null,
            height: x.height || null,
            bytes: x.bytes || null,
            format: x.format || '',
            createdAt: x.created_at || null,
            inUse: inUse(cfg, x.public_id)
          });
        });
      }
      images.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      return send(res, 200, { ok: true, images, folders: prefixes });
    }

    if (req.method === 'POST' && body.action === 'delete') {
      const pid = String(body.publicId || '');
      if (!pid || !prefixes.some((p) => pid.indexOf(p) === 0) || /\.\./.test(pid)) {
        return send(res, 400, { ok: false, error: 'not_this_site' });
      }
      if (inUse(cfg, pid)) return send(res, 409, { ok: false, error: 'in_use', message: 'This image is used on the site. Remove it from the page first.' });
      const base = 'https://api.cloudinary.com/v1_1/' + creds.cloud + '/resources/image/upload';
      const r = await fetch(base + '?public_ids[]=' + encodeURIComponent(pid) + '&invalidate=true', {
        method: 'DELETE', headers: { Authorization: basic(creds) }
      });
      const j = await r.json().catch(() => ({}));
      const st = j && j.deleted && j.deleted[pid];
      return send(res, r.ok ? 200 : 502, { ok: r.ok && st !== 'not_found', status: st || null });
    }

    return send(res, 405, { ok: false, error: 'method' });
  } catch (e) {
    return send(res, 502, { ok: false, error: 'cloudinary', message: String(e && e.message || e) });
  }
};

module.exports._sitePrefixes = sitePrefixes;
module.exports._inUse = inUse;
