// api/site/page-content.js — on-site ("front-end") editing of one landing page's text.
//
// GET  ?site=<slug>&page=<page slug>          -> { siteId, page:{id,slug,title,body,blocks,rich}, hash, level, isSuper }
// POST { site, pageId, action:'publish', body, baseHash }  -> backs up, saves ONLY that page's body, purges the CDN
// POST { site, pageId, action:'undo', backupId }           -> puts back the page body from that backup
//
// Only the page's `body` is ever written — never the rest of sites.config — so this can't
// overwrite other settings. A publish is refused (409) when the page changed since it was
// opened (someone edited it in /manage), so nobody's work is silently lost.
// Auth: super admin, or the site's owner (sites.owner_user_id). Not partners (same rule as email DNS).

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const vercel = require('../vercel/_client');

const SUPABASE_URL = process.env.SUPABASE_URL;
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const MAX_BODY = 400 * 1024;

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); } }
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > MAX_BODY + 4096) req.destroy(); });
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
      global: { headers: { Authorization: 'Bearer ' + token } },
    });
    const { data, error } = await userClient.auth.getUser(token);
    if (error || !data || !data.user) return null;
    return data.user;
  } catch { return null; }
}

async function isSuperAdmin(user) {
  const list = String(process.env.SUPER_ADMIN_EMAILS || '').toLowerCase().split(/[,\s]+/).filter(Boolean);
  if (user.email && list.includes(String(user.email).toLowerCase())) return true;
  const { data } = await admin.from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle();
  return !!(data && data.is_super_admin);
}

const hashOf = (s) => crypto.createHash('sha256').update(String(s == null ? '' : s), 'utf8').digest('hex').slice(0, 32);
const cleanSlug = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '').slice(0, 120);

async function loadSite(slug) {
  const { data, error } = await admin.from('sites')
    .select('id,slug,owner_user_id,config,updated_at')
    .eq('slug', slug).maybeSingle();
  if (error) throw new Error('lookup');
  return data || null;
}

async function access(user, site) {
  const sup = await isSuperAdmin(user);
  if (sup || (site.owner_user_id && site.owner_user_id === user.id)) return { ok: true, isSuper: sup };
  return { ok: false };
}

function findPage(cfg, by) {
  const pages = (cfg && Array.isArray(cfg.pages)) ? cfg.pages : [];
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]; if (!p) continue;
    if ((by.id && p.id === by.id) || (by.slug && p.slug === by.slug)) return { page: p, index: i };
  }
  return null;
}

async function purge(site) {
  try {
    if (!vercel.projectConfigured || !vercel.projectConfigured()) return false;
    await vercel.invalidateByTags([vercel.cacheTagForSlug(site.slug), vercel.cacheTagForSiteId(site.id)].filter(Boolean), 'production');
    return true;
  } catch (e) { console.error('page-content purge:', e && e.message); return false; }
}

/** Write one page's body, only if the site row hasn't moved underneath us (retries once). */
async function writeBody(site, pageId, newBody, expectHash, user, label) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const cur = attempt === 0 ? site : await loadSite(site.slug);
    const hit = findPage(cur.config, { id: pageId });
    if (!hit) return { code: 404, error: 'page_not_found' };
    if (expectHash && hashOf(hit.page.body || '') !== expectHash) return { code: 409, error: 'changed_elsewhere' };
    // Backup of the whole config first, so Undo (and /manage's Backups) can put it back.
    const bk = await admin.from('site_backups').insert({
      site_id: cur.id, label, config: cur.config, source: 'pre_publish', actor_user_id: user.id,
    }).select('id').single();
    let backupId = bk.data && bk.data.id;
    if (bk.error) {
      const bk2 = await admin.from('site_backups').insert({ site_id: cur.id, label, config: cur.config, source: 'pre_publish' }).select('id').single();
      if (bk2.error) return { code: 500, error: 'backup_failed' };
      backupId = bk2.data.id;
    }
    const cfg = JSON.parse(JSON.stringify(cur.config));
    cfg.pages[hit.index].body = newBody;
    const now = new Date().toISOString();
    const up = await admin.from('sites').update({ config: cfg, updated_at: now })
      .eq('id', cur.id).eq('updated_at', cur.updated_at).select('id');
    if (up.error) return { code: 500, error: 'save_failed' };
    if (up.data && up.data.length) return { ok: true, backupId, hash: hashOf(newBody) };
    // Someone saved something else on the site at the same moment: re-read and try once more.
  }
  return { code: 409, error: 'busy_try_again' };
}

module.exports = async (req, res) => {
  const json = (code, obj) => {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify(obj));
  };
  const user = await requireUser(req);
  if (!user) return json(401, { ok: false, error: 'auth' });

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'https://x');
      const slug = cleanSlug(url.searchParams.get('site')), pslug = cleanSlug(url.searchParams.get('page'));
      if (!slug) return json(400, { ok: false, error: 'site_required' });
      const site = await loadSite(slug); if (!site) return json(404, { ok: false, error: 'site_not_found' });
      const a = await access(user, site); if (!a.ok) return json(403, { ok: false, error: 'not_your_site' });
      const hit = pslug ? findPage(site.config, { slug: pslug }) : null;
      if (!hit) return json(404, { ok: false, error: 'page_not_found', siteId: site.id });
      const p = hit.page;
      return json(200, {
        ok: true, siteId: site.id, isSuper: a.isSuper,
        level: a.isSuper ? 'advanced' : ((site.config && site.config.pageEditor === 'simple') ? 'simple' : 'advanced'),
        page: { id: p.id, slug: p.slug, title: p.title || p.slug, body: p.body || '', blocks: p.blocks === true, rich: p.rich === true },
        hash: hashOf(p.body || ''),
      });
    }

    if (req.method !== 'POST') return json(405, { ok: false, error: 'method' });
    const b = await readBody(req);
    const slug = cleanSlug(b.site), pageId = String(b.pageId || '').slice(0, 120), action = String(b.action || '');
    if (!slug || !pageId) return json(400, { ok: false, error: 'site_and_page_required' });
    const site = await loadSite(slug); if (!site) return json(404, { ok: false, error: 'site_not_found' });
    const a = await access(user, site); if (!a.ok) return json(403, { ok: false, error: 'not_your_site' });
    const hit = findPage(site.config, { id: pageId });
    if (!hit) return json(404, { ok: false, error: 'page_not_found' });
    const title = hit.page.title || hit.page.slug;

    if (action === 'publish') {
      if (typeof b.body !== 'string') return json(400, { ok: false, error: 'body_required' });
      if (b.body.length > MAX_BODY) return json(413, { ok: false, error: 'too_large' });
      if (!b.baseHash) return json(400, { ok: false, error: 'base_required' });
      const body = b.body.replace(/\r/g, '');
      if (body === (hit.page.body || '')) return json(200, { ok: true, unchanged: true, hash: hashOf(body) });
      const w = await writeBody(site, pageId, body, String(b.baseHash), user, 'Before on-site edit: ' + title);
      if (!w.ok) return json(w.code, { ok: false, error: w.error });
      const purged = await purge(site);
      return json(200, { ok: true, hash: w.hash, backupId: w.backupId, purged });
    }

    if (action === 'undo') {
      const id = String(b.backupId || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json(400, { ok: false, error: 'backup_required' });
      const { data: bk } = await admin.from('site_backups').select('id,site_id,config').eq('id', id).maybeSingle();
      if (!bk || bk.site_id !== site.id) return json(404, { ok: false, error: 'backup_not_found' });
      const old = findPage(bk.config, { id: pageId });
      if (!old) return json(404, { ok: false, error: 'page_not_in_backup' });
      const w = await writeBody(site, pageId, old.page.body || '', b.baseHash ? String(b.baseHash) : '', user, 'Before undo of on-site edit: ' + title);
      if (!w.ok) return json(w.code, { ok: false, error: w.error });
      const purged = await purge(site);
      return json(200, { ok: true, hash: w.hash, body: old.page.body || '', backupId: w.backupId, purged });
    }

    return json(400, { ok: false, error: 'unknown_action' });
  } catch (e) {
    console.error('page-content error:', e && e.message);
    return json(500, { ok: false, error: 'server' });
  }
};

module.exports._test = { hashOf, findPage, cleanSlug };
