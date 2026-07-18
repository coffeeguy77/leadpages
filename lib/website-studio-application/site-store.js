'use strict';

/**
 * Site create / snapshot helpers for Website Studio application.
 * Uses in-memory store when Theme Studio memory mode is on or Supabase unavailable.
 */

const { randomUUID } = require('crypto');
const { memoryEnabled } = require('../theme-studio/store');

/** @type {Map<string, object>} */
const memSites = new Map();
/** @type {Map<string, object>} */
const memSnapshots = new Map();
/** @type {Map<string, object>} */
const memReplacementDrafts = new Map();

function nowIso() {
  return new Date().toISOString();
}

function slugify(input) {
  return String(input || 'website')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'website';
}

async function slugAvailable(slug) {
  if (memSites.has(slug)) return false;
  if (memoryEnabled()) {
    for (const site of memSites.values()) {
      if (site.slug === slug) return false;
    }
    return true;
  }
  try {
    const { admin } = require('../brain/http');
    const { data } = await admin.from('sites').select('id').eq('slug', slug).maybeSingle();
    return !data;
  } catch {
    return ! [...memSites.values()].some((s) => s.slug === slug);
  }
}

async function ensureUniqueSlug(base) {
  let slug = slugify(base);
  if (await slugAvailable(slug)) return slug;
  for (let i = 0; i < 8; i++) {
    const candidate = (slug + '-' + String(Date.now()).slice(-4) + (i || '')).slice(0, 60);
    if (await slugAvailable(candidate)) return candidate;
  }
  return (slug + '-' + randomUUID().slice(0, 8)).slice(0, 60);
}

/**
 * Create a non-live draft site. Never sets status=live.
 */
async function createDraftSite(row) {
  const id = row.id || randomUUID();
  const slug = row.slug || (await ensureUniqueSlug(row.business_name || row.name || 'website'));
  const site = {
    id,
    slug,
    business_name: row.business_name || row.name || 'Website Studio Draft',
    template: row.template || 'trade',
    status: 'draft',
    is_demo: row.is_demo === true,
    is_mockup: row.is_mockup !== false,
    owner_user_id: row.owner_user_id || null,
    owner_email: row.owner_email || null,
    servicing_partner_id: row.servicing_partner_id || null,
    referring_partner_id: row.referring_partner_id || null,
    config: row.config || {},
    created_at: nowIso(),
    updated_at: nowIso(),
    published: false
  };

  if (memoryEnabled()) {
    memSites.set(id, site);
    return { ok: true, site, store: 'memory' };
  }

  try {
    const { admin } = require('../brain/http');
    const { data, error } = await admin
      .from('sites')
      .insert({
        slug: site.slug,
        business_name: site.business_name,
        template: site.template,
        status: 'draft',
        is_demo: site.is_demo,
        is_mockup: site.is_mockup,
        owner_user_id: site.owner_user_id,
        owner_email: site.owner_email,
        servicing_partner_id: site.servicing_partner_id,
        referring_partner_id: site.referring_partner_id,
        config: site.config
      })
      .select('id,slug,status,is_demo,is_mockup,business_name,owner_user_id,servicing_partner_id')
      .single();
    if (error) {
      memSites.set(id, site);
      return { ok: true, site, store: 'memory', notice: error.message };
    }
    return { ok: true, site: data, store: 'supabase' };
  } catch (err) {
    memSites.set(id, site);
    return {
      ok: true,
      site,
      store: 'memory',
      notice: err && err.message ? err.message : 'site_insert_fallback_memory'
    };
  }
}

async function getSite(siteId) {
  if (memSites.has(siteId)) return { ok: true, site: memSites.get(siteId) };
  if (memoryEnabled()) return { ok: false, error: 'site_not_found' };
  try {
    const { admin } = require('../brain/http');
    const { data, error } = await admin.from('sites').select('*').eq('id', siteId).maybeSingle();
    if (error || !data) return { ok: false, error: (error && error.message) || 'site_not_found' };
    return { ok: true, site: data };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : 'site_get_failed' };
  }
}

/** Register a site in memory (tests). */
function putMemorySite(site) {
  const row = { ...site, id: site.id || randomUUID(), updated_at: nowIso() };
  memSites.set(row.id, row);
  return row;
}

async function snapshotSite(site) {
  const id = randomUUID();
  const snap = {
    id,
    site_id: site.id,
    slug: site.slug,
    status: site.status,
    config: JSON.parse(JSON.stringify(site.config || {})),
    operational: {
      owner_user_id: site.owner_user_id || null,
      owner_email: site.owner_email || null,
      servicing_partner_id: site.servicing_partner_id || null,
      referring_partner_id: site.referring_partner_id || null,
      custom_domain: site.custom_domain || null,
      billing_status: site.billing_status || null
    },
    created_at: nowIso(),
    immutable: true,
    store: 'memory'
  };
  memSnapshots.set(id, snap);

  // Prefer existing site_backups table when available (no second backup system)
  if (!memoryEnabled()) {
    try {
      const { admin } = require('../brain/http');
      const label = 'Website Studio replacement snapshot ' + new Date().toISOString();
      const { data, error } = await admin
        .from('site_backups')
        .insert({
          site_id: site.id,
          label,
          config: snap.config
        })
        .select('id, site_id, label, created_at')
        .single();
      if (!error && data) {
        snap.site_backup_id = data.id;
        snap.store = 'site_backups';
      }
    } catch {
      /* keep memory snapshot */
    }
  }

  return { ok: true, snapshot: snap };
}

function createReplacementDraftRecord(row) {
  const id = row.id || randomUUID();
  const rec = {
    id,
    source_site_id: row.source_site_id,
    snapshot_id: row.snapshot_id,
    config: row.config,
    status: 'open',
    live_site_unchanged: true,
    created_at: nowIso(),
    updated_at: nowIso(),
    meta: row.meta || {}
  };
  memReplacementDrafts.set(id, rec);
  return { ok: true, replacementDraft: rec };
}

function getReplacementDraft(id) {
  const rec = memReplacementDrafts.get(id);
  return rec ? { ok: true, replacementDraft: rec } : { ok: false, error: 'replacement_not_found' };
}

function discardReplacementDraft(id) {
  const got = getReplacementDraft(id);
  if (!got.ok) return got;
  const next = { ...got.replacementDraft, status: 'discarded', updated_at: nowIso() };
  memReplacementDrafts.set(id, next);
  return { ok: true, replacementDraft: next };
}

function resetSiteMemory() {
  memSites.clear();
  memSnapshots.clear();
  memReplacementDrafts.clear();
}

module.exports = {
  slugify,
  ensureUniqueSlug,
  slugAvailable,
  createDraftSite,
  getSite,
  putMemorySite,
  snapshotSite,
  createReplacementDraftRecord,
  getReplacementDraft,
  discardReplacementDraft,
  resetSiteMemory
};
