'use strict';

/**
 * Smart site config backups — shared service for /api/site-backups and other writers.
 * Resilient to partial schemas (legacy tables missing size_bytes / source / hash).
 */

const crypto = require('crypto');
const { sanitizeSiteConfig } = require('../quote-system/sanitize');

const SOURCES = new Set([
  'manual',
  'pre_publish',
  'pre_restore',
  'pre_import',
  'theme_apply',
  'website_studio',
  'auto'
]);

const KEEP_MAX = 40;
const LIST_COLS_FULL = 'id,label,created_at,size_bytes,source,actor_user_id,config_hash,config';
const LIST_COLS_MID = 'id,label,created_at,size_bytes,config';
const LIST_COLS_BASIC = 'id,label,created_at,config';
const GET_COLS_FULL = 'id,site_id,label,config,created_at,size_bytes,source,actor_user_id,config_hash,restored_from_id';
const GET_COLS_BASIC = 'id,site_id,label,config,created_at';

function normalizeSource(source) {
  const s = String(source || 'manual').trim().toLowerCase();
  return SOURCES.has(s) ? s : 'manual';
}

function jsonSize(cfg) {
  try {
    return Buffer.byteLength(JSON.stringify(cfg || {}), 'utf8');
  } catch (_e) {
    return 0;
  }
}

/** Stored size_bytes can be 0 on legacy rows — derive from config when present. */
function effectiveSizeBytes(row) {
  if (!row) return 0;
  const stored = row.size_bytes != null ? Number(row.size_bytes) : 0;
  if (stored > 0) return stored;
  if (row.config && typeof row.config === 'object') return jsonSize(row.config);
  return 0;
}

function needsSizeBackfill(row) {
  if (!row || !row.id) return false;
  const stored = row.size_bytes != null ? Number(row.size_bytes) : 0;
  return stored <= 0 && !!row.config && effectiveSizeBytes(row) > 0;
}

function hashConfig(cfg) {
  try {
    return crypto.createHash('sha256').update(JSON.stringify(cfg || {})).digest('hex').slice(0, 40);
  } catch (_e) {
    return null;
  }
}

function tableMissing(err) {
  const m = String((err && err.message) || err || '');
  return /site_backups|does not exist|schema cache|Could not find the table/i.test(m);
}

function columnMissing(err) {
  const m = String((err && err.message) || err || '');
  return /column|Could not find the .* column|schema cache/i.test(m);
}

function setupRequiredError() {
  return {
    ok: false,
    code: 503,
    error: 'setup_required',
    message: 'Backups table is not ready. Run db/site_backups.sql in Supabase, then retry.'
  };
}

function defaultLabel(source, custom) {
  const customLabel = String(custom || '').trim().slice(0, 120);
  if (customLabel) return customLabel;
  const when = new Date().toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
  const map = {
    manual: 'Manual backup',
    pre_publish: 'Before publish',
    pre_restore: 'Before restore',
    pre_import: 'Before import',
    theme_apply: 'Before theme apply',
    website_studio: 'Website Studio snapshot',
    auto: 'Auto backup'
  };
  return (map[normalizeSource(source)] || 'Backup') + ' · ' + when;
}

function publicBackup(row) {
  if (!row) return null;
  const size = effectiveSizeBytes(row);
  return {
    id: row.id,
    label: row.label,
    created_at: row.created_at,
    size_bytes: size > 0 ? size : (row.size_bytes != null ? row.size_bytes : null),
    source: row.source || 'manual',
    actor_user_id: row.actor_user_id || null,
    config_hash: row.config_hash || null,
    restored_from_id: row.restored_from_id || null,
    site_id: row.site_id || undefined
  };
}

async function backfillBackupSizes(admin, rows) {
  const pending = (rows || []).filter(needsSizeBackfill);
  if (!pending.length) return;
  await Promise.all(pending.map(async function (row) {
    const size = effectiveSizeBytes(row);
    if (size <= 0) return;
    try {
      await admin.from('site_backups').update({ size_bytes: size }).eq('id', row.id);
    } catch (e) {
      console.warn('site-backups size backfill skipped:', row.id, e && e.message);
    }
  }));
}

async function assertSiteAccess(admin, user, siteId) {
  if (!siteId) return { ok: false, code: 400, error: 'no_site', message: 'Missing site id.' };
  const { data: site, error } = await admin
    .from('sites')
    .select('id,owner_user_id,servicing_partner_id,referring_partner_id,config')
    .eq('id', siteId)
    .maybeSingle();
  if (error || !site) {
    return { ok: false, code: 404, error: 'site_not_found', message: 'Site not found.' };
  }

  const { data: profile } = await admin.from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle();
  if (profile && profile.is_super_admin) return { ok: true, site };

  if (site.owner_user_id && site.owner_user_id === user.id) return { ok: true, site };

  const { data: partner } = await admin
    .from('partners')
    .select('id,status')
    .eq('user_id', user.id)
    .maybeSingle();
  if (
    partner &&
    partner.status === 'active' &&
    (site.servicing_partner_id === partner.id || site.referring_partner_id === partner.id)
  ) {
    return { ok: true, site };
  }

  // Unowned demo/scaffold sites remain editable by authenticated builders.
  if (!site.owner_user_id) return { ok: true, site };

  return { ok: false, code: 403, error: 'not_your_site', message: 'You do not have access to this site.' };
}

async function getBackupRow(admin, backupId, withConfig) {
  const cols = withConfig ? GET_COLS_FULL : LIST_COLS_FULL + ',site_id';
  let { data, error } = await admin.from('site_backups').select(cols).eq('id', backupId).maybeSingle();
  if (error && columnMissing(error)) {
    ({ data, error } = await admin
      .from('site_backups')
      .select(withConfig ? GET_COLS_BASIC : LIST_COLS_BASIC + ',site_id')
      .eq('id', backupId)
      .maybeSingle());
  }
  if (error) {
    if (tableMissing(error)) return setupRequiredError();
    throw error;
  }
  if (!data) return { ok: false, code: 404, error: 'backup_not_found', message: 'Backup not found.' };
  if (needsSizeBackfill(data)) {
    backfillBackupSizes(admin, [data]).catch(function () { /* non-blocking */ });
  }
  return { ok: true, backup: data };
}

async function assertBackupAccess(admin, user, backupId) {
  const got = await getBackupRow(admin, backupId, true);
  if (!got.ok) return got;
  const access = await assertSiteAccess(admin, user, got.backup.site_id);
  if (!access.ok) return access;
  return { ok: true, backup: got.backup, site: access.site };
}

async function listBackups(admin, siteId, limit) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const attempts = [LIST_COLS_FULL, LIST_COLS_MID, LIST_COLS_BASIC];
  let lastError = null;
  for (let i = 0; i < attempts.length; i++) {
    const { data, error, count } = await admin
      .from('site_backups')
      .select(attempts[i], { count: 'exact' })
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(lim);
    if (!error) {
      const rows = data || [];
      backfillBackupSizes(admin, rows).catch(function () { /* non-blocking */ });
      return {
        ok: true,
        backups: rows.map(publicBackup),
        count: count != null ? count : rows.length
      };
    }
    lastError = error;
    if (tableMissing(error)) return setupRequiredError();
    if (!columnMissing(error)) break;
  }
  throw lastError || new Error('list_failed');
}

async function insertBackupRow(admin, row) {
  const smart = {
    site_id: row.site_id,
    label: row.label,
    config: row.config,
    size_bytes: row.size_bytes,
    source: row.source,
    actor_user_id: row.actor_user_id || null,
    config_hash: row.config_hash || null,
    restored_from_id: row.restored_from_id || null
  };
  const mid = {
    site_id: row.site_id,
    label: row.label,
    config: row.config,
    size_bytes: row.size_bytes
  };
  const basic = {
    site_id: row.site_id,
    label: row.label,
    config: row.config
  };

  const selectSmart = 'id,label,created_at,size_bytes,source,actor_user_id,config_hash,restored_from_id';
  const selectMid = 'id,label,created_at,size_bytes';
  const selectBasic = 'id,label,created_at';

  const attempts = [
    [smart, selectSmart],
    [mid, selectMid],
    [basic, selectBasic]
  ];

  let lastError = null;
  for (let i = 0; i < attempts.length; i++) {
    const payload = attempts[i][0];
    const sel = attempts[i][1];
    const { data, error } = await admin.from('site_backups').insert(payload).select(sel).maybeSingle();
    if (!error) return { ok: true, backup: publicBackup(data) };
    lastError = error;
    if (tableMissing(error)) return setupRequiredError();
    if (!columnMissing(error)) break;
  }
  return {
    ok: false,
    code: 500,
    error: 'save_failed',
    message: (lastError && lastError.message) || 'Could not save backup.'
  };
}

async function pruneRetention(admin, siteId) {
  try {
    const { data, error } = await admin
      .from('site_backups')
      .select('id,source,created_at')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false });
    if (error || !data || data.length <= KEEP_MAX) return;

    const keep = new Set();
    const manuals = [];
    const autos = [];
    data.forEach(function (row) {
      if ((row.source || 'manual') === 'manual') manuals.push(row);
      else autos.push(row);
    });
    manuals.slice(0, 20).forEach(function (r) { keep.add(r.id); });
    autos.slice(0, KEEP_MAX - keep.size).forEach(function (r) { keep.add(r.id); });
    // Fill remaining slots with newest overall
    data.forEach(function (r) {
      if (keep.size < KEEP_MAX) keep.add(r.id);
    });

    const drop = data.filter(function (r) { return !keep.has(r.id); }).map(function (r) { return r.id; });
    if (drop.length) {
      await admin.from('site_backups').delete().in('id', drop);
    }
  } catch (e) {
    console.warn('site-backups prune skipped:', e && e.message);
  }
}

/**
 * Create a smart backup. Dedupes identical consecutive configs for auto sources.
 */
async function createBackup(admin, opts) {
  const siteId = opts.siteId;
  const source = normalizeSource(opts.source);
  const force = !!opts.force;
  let cfg = opts.config;
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    const cur = await admin.from('sites').select('config').eq('id', siteId).maybeSingle();
    cfg = (cur.data && cur.data.config) || {};
  }
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    return { ok: false, code: 400, error: 'invalid_config', message: 'Backup config is invalid.' };
  }

  const hash = hashConfig(cfg);
  if (!force && source !== 'manual' && hash) {
    try {
      let latest = null;
      let sel = await admin
        .from('site_backups')
        .select('id,config_hash,label,created_at,size_bytes,source')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sel.error && columnMissing(sel.error)) {
        sel = await admin
          .from('site_backups')
          .select('id,label,created_at,size_bytes')
          .eq('site_id', siteId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
      }
      if (!sel.error) latest = sel.data;
      if (latest && latest.config_hash && latest.config_hash === hash) {
        return {
          ok: true,
          deduped: true,
          backup: publicBackup(latest),
          message: 'Already up to date — identical to the latest backup.'
        };
      }
    } catch (_dedupeErr) {
      /* continue to insert */
    }
  }

  const row = {
    site_id: siteId,
    label: defaultLabel(source, opts.label),
    config: cfg,
    size_bytes: jsonSize(cfg),
    source,
    actor_user_id: opts.actorUserId || null,
    config_hash: hash,
    restored_from_id: opts.restoredFromId || null
  };

  const inserted = await insertBackupRow(admin, row);
  if (!inserted.ok) return inserted;
  await pruneRetention(admin, siteId);
  return { ok: true, backup: inserted.backup };
}

async function restoreBackup(admin, opts) {
  const backup = opts.backup;
  const actorUserId = opts.actorUserId || null;
  const cfg = sanitizeSiteConfig(backup.config);
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    return { ok: false, code: 400, error: 'invalid_config', message: 'Backup config is invalid.' };
  }

  // Safety snapshot of current live config before overwrite.
  let safetyBackup = null;
  try {
    const cur = await admin.from('sites').select('config').eq('id', backup.site_id).maybeSingle();
    const currentCfg = (cur.data && cur.data.config) || {};
    const safety = await createBackup(admin, {
      siteId: backup.site_id,
      config: currentCfg,
      source: 'pre_restore',
      actorUserId,
      label: 'Before restore · ' + String(backup.label || 'backup').slice(0, 60)
    });
    if (safety && safety.ok) safetyBackup = safety.backup;
  } catch (se) {
    console.warn('site-backups pre_restore skipped:', se && se.message);
  }

  const { error } = await admin
    .from('sites')
    .update({ config: cfg, updated_at: new Date().toISOString() })
    .eq('id', backup.site_id);
  if (error) throw error;

  return {
    ok: true,
    siteId: backup.site_id,
    config: cfg,
    safetyBackup,
    restoredFrom: publicBackup(backup)
  };
}

async function applyConfig(admin, opts) {
  const siteId = opts.siteId;
  const cfg = sanitizeSiteConfig(opts.config);
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    return { ok: false, code: 400, error: 'invalid_config', message: 'Config is invalid.' };
  }

  if (opts.safetySource) {
    const cur = await admin.from('sites').select('config').eq('id', siteId).maybeSingle();
    const currentCfg = (cur.data && cur.data.config) || {};
    await createBackup(admin, {
      siteId,
      config: currentCfg,
      source: opts.safetySource,
      actorUserId: opts.actorUserId || null,
      label: opts.safetyLabel
    });
  }

  const { error } = await admin
    .from('sites')
    .update({ config: cfg, updated_at: new Date().toISOString() })
    .eq('id', siteId);
  if (error) throw error;
  return { ok: true, siteId, config: cfg };
}

async function deleteBackup(admin, backupId) {
  const { error } = await admin.from('site_backups').delete().eq('id', backupId);
  if (error) {
    if (tableMissing(error)) return setupRequiredError();
    throw error;
  }
  return { ok: true };
}

module.exports = {
  SOURCES,
  KEEP_MAX,
  normalizeSource,
  jsonSize,
  effectiveSizeBytes,
  needsSizeBackfill,
  hashConfig,
  tableMissing,
  columnMissing,
  defaultLabel,
  publicBackup,
  assertSiteAccess,
  assertBackupAccess,
  listBackups,
  createBackup,
  restoreBackup,
  applyConfig,
  deleteBackup,
  getBackupRow
};
