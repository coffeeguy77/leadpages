// api/site-backups.js — site config snapshots for /manage backups panel.
// Browser JWT auth + service role DB access (same pattern as /api/stats).

const { createClient } = require('@supabase/supabase-js');

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

async function assertSiteAccess(user, siteId) {
  if (!siteId) return { ok: false, code: 400, error: 'no_site' };
  const { data: site, error } = await admin.from('sites').select('id,owner_user_id').eq('id', siteId).maybeSingle();
  if (error || !site) return { ok: false, code: 404, error: 'site_not_found' };
  const adminUser = await isSuperAdmin(user.id);
  if (!adminUser && site.owner_user_id && site.owner_user_id !== user.id) {
    return { ok: false, code: 403, error: 'not_your_site' };
  }
  return { ok: true, site };
}

async function assertBackupAccess(user, backupId) {
  if (!backupId) return { ok: false, code: 400, error: 'no_backup' };
  const { data: bk, error } = await admin.from('site_backups').select('id,site_id,config,label,created_at,size_bytes').eq('id', backupId).maybeSingle();
  if (error || !bk) return { ok: false, code: 404, error: 'backup_not_found' };
  const access = await assertSiteAccess(user, bk.site_id);
  if (!access.ok) return access;
  return { ok: true, backup: bk, site: access.site };
}

function jsonSize(cfg) {
  try { return JSON.stringify(cfg || {}).length; } catch { return 0; }
}

module.exports = async (req, res) => {
  const json = (code, obj) => {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(obj));
  };

  const user = await requireUser(req);
  if (!user) return json(401, { error: 'auth' });

  try {
    const url = new URL(req.url, 'https://x');

    if (req.method === 'GET') {
      const backupId = (url.searchParams.get('id') || '').trim();
      if (backupId) {
        const access = await assertBackupAccess(user, backupId);
        if (!access.ok) return json(access.code, { error: access.error });
        return json(200, { backup: access.backup });
      }

      const siteId = (url.searchParams.get('siteId') || '').trim();
      const access = await assertSiteAccess(user, siteId);
      if (!access.ok) return json(access.code, { error: access.error });

      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 100);
      const { data, error, count } = await admin
        .from('site_backups')
        .select('id,label,created_at,size_bytes', { count: 'exact' })
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return json(200, { backups: data || [], count: count != null ? count : (data || []).length });
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const action = (body.action || 'save').trim();

      if (action === 'restore') {
        const access = await assertBackupAccess(user, body.id || body.backupId);
        if (!access.ok) return json(access.code, { error: access.error });
        const cfg = access.backup.config;
        if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
          return json(400, { error: 'invalid_config' });
        }
        const { error } = await admin.from('sites').update({
          config: cfg,
          updated_at: new Date().toISOString()
        }).eq('id', access.backup.site_id);
        if (error) throw error;
        return json(200, { ok: true, siteId: access.backup.site_id, config: cfg });
      }

      if (action === 'apply') {
        const siteId = (body.siteId || '').trim();
        const access = await assertSiteAccess(user, siteId);
        if (!access.ok) return json(access.code, { error: access.error });
        const cfg = body.config;
        if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
          return json(400, { error: 'invalid_config' });
        }
        const { error } = await admin.from('sites').update({
          config: cfg,
          updated_at: new Date().toISOString()
        }).eq('id', siteId);
        if (error) throw error;
        return json(200, { ok: true, siteId, config: cfg });
      }

      const siteId = (body.siteId || '').trim();
      const access = await assertSiteAccess(user, siteId);
      if (!access.ok) return json(access.code, { error: access.error });

      let cfg = body.config;
      if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
        const cur = await admin.from('sites').select('config').eq('id', siteId).maybeSingle();
        cfg = (cur.data && cur.data.config) || {};
      }
      const label = String(body.label || 'Backup').trim().slice(0, 120) || 'Backup';
      const sizeBytes = jsonSize(cfg);
      const { data, error } = await admin.from('site_backups').insert({
        site_id: siteId,
        label,
        config: cfg,
        size_bytes: sizeBytes
      }).select('id,label,created_at,size_bytes').maybeSingle();
      if (error) throw error;
      return json(200, { ok: true, backup: data });
    }

    if (req.method === 'DELETE') {
      const backupId = (url.searchParams.get('id') || '').trim();
      const access = await assertBackupAccess(user, backupId);
      if (!access.ok) return json(access.code, { error: access.error });
      const { error } = await admin.from('site_backups').delete().eq('id', backupId);
      if (error) throw error;
      return json(200, { ok: true });
    }

    return json(405, { error: 'method' });
  } catch (e) {
    console.error('site-backups error:', e && e.message);
    return json(500, { error: 'server', message: (e && e.message) || 'error' });
  }
};
