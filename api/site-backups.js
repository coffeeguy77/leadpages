// api/site-backups.js — smart site config backups for /manage.
// Browser JWT auth + service-role DB. Resilient to partial schemas.

const { createClient } = require('@supabase/supabase-js');
const {
  assertSiteAccess,
  assertBackupAccess,
  listBackups,
  createBackup,
  restoreBackup,
  applyConfig,
  deleteBackup,
  getBackupRow,
  publicBackup
} = require('../lib/site-backups/service');

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
    const userClient = createClient(
      SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
      { global: { headers: { Authorization: 'Bearer ' + token } } }
    );
    const { data, error } = await userClient.auth.getUser(token);
    if (error || !data || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  const user = await requireUser(req);
  if (!user) return send(res, 401, { error: 'auth', message: 'Sign in to manage backups.' });

  try {
    const url = new URL(req.url, 'https://x');

    if (req.method === 'GET') {
      const backupId = (url.searchParams.get('id') || '').trim();
      if (backupId) {
        const access = await assertBackupAccess(admin, user, backupId);
        if (!access.ok) return send(res, access.code, { error: access.error, message: access.message });
        return send(res, 200, { backup: access.backup });
      }

      const siteId = (url.searchParams.get('siteId') || '').trim();
      const access = await assertSiteAccess(admin, user, siteId);
      if (!access.ok) return send(res, access.code, { error: access.error, message: access.message });

      const listed = await listBackups(admin, siteId, url.searchParams.get('limit'));
      if (!listed.ok) return send(res, listed.code, { error: listed.error, message: listed.message });
      return send(res, 200, { backups: listed.backups, count: listed.count });
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const action = String(body.action || 'save').trim();

      if (action === 'restore') {
        const access = await assertBackupAccess(admin, user, body.id || body.backupId);
        if (!access.ok) return send(res, access.code, { error: access.error, message: access.message });
        const result = await restoreBackup(admin, {
          backup: access.backup,
          actorUserId: user.id
        });
        if (!result.ok) return send(res, result.code, { error: result.error, message: result.message });
        return send(res, 200, result);
      }

      if (action === 'apply') {
        const siteId = String(body.siteId || '').trim();
        const access = await assertSiteAccess(admin, user, siteId);
        if (!access.ok) return send(res, access.code, { error: access.error, message: access.message });
        const result = await applyConfig(admin, {
          siteId,
          config: body.config,
          actorUserId: user.id,
          safetySource: body.safetySource || null,
          safetyLabel: body.safetyLabel || null
        });
        if (!result.ok) return send(res, result.code, { error: result.error, message: result.message });
        return send(res, 200, result);
      }

      // Default: save / create backup
      const siteId = String(body.siteId || '').trim();
      const access = await assertSiteAccess(admin, user, siteId);
      if (!access.ok) return send(res, access.code, { error: access.error, message: access.message });

      const result = await createBackup(admin, {
        siteId,
        config: body.config,
        label: body.label,
        source: body.source || 'manual',
        actorUserId: user.id,
        force: !!body.force
      });
      if (!result.ok) return send(res, result.code || 500, { error: result.error, message: result.message });
      return send(res, 200, {
        ok: true,
        backup: result.backup,
        deduped: !!result.deduped,
        message: result.message || null
      });
    }

    if (req.method === 'DELETE') {
      const backupId = (url.searchParams.get('id') || '').trim();
      const access = await assertBackupAccess(admin, user, backupId);
      if (!access.ok) return send(res, access.code, { error: access.error, message: access.message });
      const result = await deleteBackup(admin, backupId);
      if (!result.ok) return send(res, result.code, { error: result.error, message: result.message });
      return send(res, 200, { ok: true });
    }

    return send(res, 405, { error: 'method', message: 'Method not allowed.' });
  } catch (e) {
    console.error('site-backups error:', e && e.message, e);
    return send(res, 500, {
      error: 'server',
      message: (e && e.message) || 'Backup service error. Check Vercel logs for site-backups.'
    });
  }
};

// Exported for tests / internal callers
module.exports._internals = {
  publicBackup,
  getBackupRow,
  createBackup,
  listBackups
};
