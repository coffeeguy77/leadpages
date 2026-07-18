'use strict';

/**
 * Theme Studio draft/version persistence.
 * Uses Supabase when available; falls back to in-memory for tests.
 * Admin client is lazy-loaded so unit tests can use memory without Supabase.
 */

const { randomUUID } = require('crypto');

/** Allowed theme_studio_versions.kind values (matches db/theme_studio.sql). */
const VERSION_KINDS = new Set([
  'generate',
  'refine',
  'select',
  'apply',
  'template',
  'direct_edit',
  'manual_edit',
  'restore',
  'approve',
  'images'
]);

/**
 * Original check constraint before db/theme_studio_versions_kind_expand.sql.
 * Used only as a write-path fallback when production has not applied the expand yet.
 */
const LEGACY_VERSION_KINDS = new Set(['generate', 'refine', 'select', 'apply', 'template']);

const KIND_LEGACY_FALLBACK = Object.freeze({
  images: 'refine',
  approve: 'apply',
  restore: 'refine',
  manual_edit: 'refine',
  direct_edit: 'refine'
});

const KIND_EXPAND_SQL = 'db/theme_studio_versions_kind_expand.sql';

/** @type {Map<string, object>} */
const memDrafts = new Map();
/** @type {Map<string, object>} */
const memVersions = new Map();
/** @type {Map<string, object>} */
const memTemplates = new Map();

let forceMemory = false;
let adminClient = null;

function useMemoryStore(on) {
  forceMemory = !!on;
}

function memoryEnabled() {
  return forceMemory || process.env.THEME_STUDIO_MEMORY_STORE === '1';
}

function getAdmin() {
  if (adminClient) return adminClient;
  // Lazy require — avoids loading @supabase in pure memory tests
  const { admin } = require('../brain/http');
  adminClient = admin;
  return adminClient;
}

/** Test-only: inject a fake Supabase admin client (or null to clear). */
function setAdminClientForTests(client) {
  adminClient = client || null;
}

function nowIso() {
  return new Date().toISOString();
}

async function createDraft(row) {
  const id = row.id || randomUUID();
  const draft = {
    id,
    owner_user_id: row.owner_user_id,
    partner_id: row.partner_id || null,
    mode: row.mode || 'new',
    source_site_id: row.source_site_id || null,
    target_site_id: row.target_site_id || null,
    status: 'open',
    brief: row.brief || {},
    foundation_id: row.foundation_id || null,
    selected_concept_id: null,
    selected_version_id: null,
    applied_config: null,
    meta: row.meta || {},
    created_at: nowIso(),
    updated_at: nowIso()
  };

  if (memoryEnabled()) {
    memDrafts.set(id, draft);
    return { ok: true, draft, store: 'memory' };
  }

  const { data, error } = await getAdmin().from('theme_studio_drafts').insert(draft).select('*').single();
  if (error) {
    if (isMissingTable(error)) {
      memDrafts.set(id, draft);
      return { ok: true, draft, store: 'memory', notice: 'theme_studio tables missing — using memory store' };
    }
    return { ok: false, error: error.message || 'draft_create_failed' };
  }
  return { ok: true, draft: data, store: 'supabase' };
}

async function getDraft(id) {
  if (memoryEnabled() || memDrafts.has(id)) {
    const draft = memDrafts.get(id);
    return draft ? { ok: true, draft } : { ok: false, error: 'draft_not_found' };
  }
  const { data, error } = await getAdmin().from('theme_studio_drafts').select('*').eq('id', id).maybeSingle();
  if (error) {
    if (isMissingTable(error) && memDrafts.has(id)) {
      return { ok: true, draft: memDrafts.get(id) };
    }
    return { ok: false, error: error.message || 'draft_get_failed' };
  }
  if (!data) return { ok: false, error: 'draft_not_found' };
  return { ok: true, draft: data };
}

async function updateDraft(id, patch) {
  const got = await getDraft(id);
  if (!got.ok) return got;
  const next = { ...got.draft, ...patch, updated_at: nowIso() };

  if (memoryEnabled() || memDrafts.has(id)) {
    memDrafts.set(id, next);
    return { ok: true, draft: next };
  }

  const { data, error } = await getAdmin()
    .from('theme_studio_drafts')
    .update({ ...patch, updated_at: next.updated_at })
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    if (isMissingTable(error)) {
      memDrafts.set(id, next);
      return { ok: true, draft: next };
    }
    return { ok: false, error: error.message || 'draft_update_failed' };
  }
  return { ok: true, draft: data };
}

async function listDraftsForOwner(ownerUserId, limit) {
  const lim = limit || 20;
  if (memoryEnabled()) {
    const rows = [...memDrafts.values()]
      .filter((d) => d.owner_user_id === ownerUserId)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, lim);
    return { ok: true, drafts: rows };
  }
  const { data, error } = await getAdmin()
    .from('theme_studio_drafts')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .order('created_at', { ascending: false })
    .limit(lim);
  if (error) {
    if (isMissingTable(error)) {
      return {
        ok: true,
        drafts: [...memDrafts.values()]
          .filter((d) => d.owner_user_id === ownerUserId)
          .slice(0, lim)
      };
    }
    return { ok: false, error: error.message || 'draft_list_failed' };
  }
  return { ok: true, drafts: data || [] };
}

async function nextVersionNumber(draftId) {
  const versions = await listVersions(draftId);
  if (!versions.ok) return 1;
  const max = versions.versions.reduce((m, v) => Math.max(m, Number(v.version_number) || 0), 0);
  return max + 1;
}

function kindConstraintMigrationHint() {
  return `Run ${KIND_EXPAND_SQL} in the Supabase SQL editor, then retry.`;
}

function isKindCheckViolation(error) {
  const msg = String((error && error.message) || error || '');
  const code = error && error.code;
  return (
    code === '23514' ||
    /theme_studio_versions_kind_check|violates check constraint.*kind/i.test(msg)
  );
}

function normalizeVersionKind(kind) {
  const value = String(kind || 'generate').trim() || 'generate';
  if (!VERSION_KINDS.has(value)) {
    return { ok: false, error: `invalid_version_kind:${value}` };
  }
  return { ok: true, kind: value };
}

function withIntendedKindWarning(warnings, intendedKind, storedKind) {
  const list = Array.isArray(warnings) ? warnings.slice() : [];
  list.push({
    code: 'kind_constraint_legacy_fallback',
    message:
      `Stored kind "${storedKind}" because the DB rejected "${intendedKind}". ` +
      kindConstraintMigrationHint(),
    intendedKind,
    storedKind
  });
  return list;
}

async function insertVersionRow(version) {
  return getAdmin().from('theme_studio_versions').insert(version).select('*').single();
}

async function createVersion(row) {
  const id = row.id || randomUUID();
  const version_number = row.version_number || (await nextVersionNumber(row.draft_id));
  const kindGate = normalizeVersionKind(row.kind);
  if (!kindGate.ok) return kindGate;

  const version = {
    id,
    draft_id: row.draft_id,
    concept_id: row.concept_id,
    version_number,
    kind: kindGate.kind,
    concept_json: row.concept_json,
    draft_config_json: row.draft_config_json || null,
    adapter_warnings: row.adapter_warnings || [],
    quality_report: row.quality_report || null,
    created_by: row.created_by || null,
    created_at: nowIso()
  };

  if (memoryEnabled() || memDrafts.has(row.draft_id)) {
    memVersions.set(id, version);
    return { ok: true, version };
  }

  const { data, error } = await insertVersionRow(version);
  if (error) {
    if (isMissingTable(error)) {
      memVersions.set(id, version);
      return { ok: true, version, notice: 'memory_fallback' };
    }

    const legacyKind = KIND_LEGACY_FALLBACK[version.kind];
    if (isKindCheckViolation(error) && legacyKind && LEGACY_VERSION_KINDS.has(legacyKind)) {
      const fallback = {
        ...version,
        kind: legacyKind,
        adapter_warnings: withIntendedKindWarning(
          version.adapter_warnings,
          version.kind,
          legacyKind
        )
      };
      const retry = await insertVersionRow(fallback);
      if (!retry.error) {
        return {
          ok: true,
          version: retry.data,
          notice: 'kind_constraint_legacy_fallback',
          intendedKind: version.kind,
          migration: KIND_EXPAND_SQL
        };
      }
      return {
        ok: false,
        error: `${error.message || 'version_create_failed'}. ${kindConstraintMigrationHint()}`,
        code: 'kind_constraint',
        migration: KIND_EXPAND_SQL
      };
    }

    if (isKindCheckViolation(error)) {
      return {
        ok: false,
        error: `${error.message || 'version_create_failed'}. ${kindConstraintMigrationHint()}`,
        code: 'kind_constraint',
        migration: KIND_EXPAND_SQL
      };
    }

    return { ok: false, error: error.message || 'version_create_failed' };
  }
  return { ok: true, version: data };
}

async function getVersion(id) {
  if (memVersions.has(id) || memoryEnabled()) {
    const version = memVersions.get(id);
    return version ? { ok: true, version } : { ok: false, error: 'version_not_found' };
  }
  const { data, error } = await getAdmin().from('theme_studio_versions').select('*').eq('id', id).maybeSingle();
  if (error) {
    if (isMissingTable(error) && memVersions.has(id)) {
      return { ok: true, version: memVersions.get(id) };
    }
    return { ok: false, error: error.message || 'version_get_failed' };
  }
  if (!data) return { ok: false, error: 'version_not_found' };
  return { ok: true, version: data };
}

async function listVersions(draftId) {
  if (memoryEnabled() || [...memVersions.values()].some((v) => v.draft_id === draftId)) {
    const versions = [...memVersions.values()]
      .filter((v) => v.draft_id === draftId)
      .sort((a, b) => a.version_number - b.version_number);
    return { ok: true, versions };
  }
  const { data, error } = await getAdmin()
    .from('theme_studio_versions')
    .select('*')
    .eq('draft_id', draftId)
    .order('version_number', { ascending: true });
  if (error) {
    if (isMissingTable(error)) {
      return {
        ok: true,
        versions: [...memVersions.values()].filter((v) => v.draft_id === draftId)
      };
    }
    return { ok: false, error: error.message || 'version_list_failed' };
  }
  return { ok: true, versions: data || [] };
}

async function saveTemplate(row) {
  const id = row.id || randomUUID();
  const template = {
    id,
    owner_user_id: row.owner_user_id,
    partner_id: row.partner_id || null,
    name: row.name,
    foundation_id: row.foundation_id || null,
    concept_json: row.concept_json,
    draft_config_json: row.draft_config_json || null,
    visibility: row.visibility || 'private',
    status: row.status || 'active',
    created_at: nowIso(),
    updated_at: nowIso()
  };
  if (memoryEnabled()) {
    memTemplates.set(id, template);
    return { ok: true, template };
  }
  const { data, error } = await getAdmin().from('theme_studio_templates').insert(template).select('*').single();
  if (error) {
    if (isMissingTable(error)) {
      memTemplates.set(id, template);
      return { ok: true, template, store: 'memory' };
    }
    return { ok: false, error: error.message || 'template_save_failed' };
  }
  return { ok: true, template: data };
}

function isMissingTable(error) {
  const msg = String((error && error.message) || error || '');
  const code = error && error.code;
  return (
    code === '42P01' ||
    /does not exist|Could not find the table|schema cache/i.test(msg)
  );
}

function resetMemoryStore() {
  memDrafts.clear();
  memVersions.clear();
  memTemplates.clear();
  adminClient = null;
}

module.exports = {
  VERSION_KINDS,
  LEGACY_VERSION_KINDS,
  KIND_LEGACY_FALLBACK,
  KIND_EXPAND_SQL,
  useMemoryStore,
  resetMemoryStore,
  setAdminClientForTests,
  memoryEnabled,
  createDraft,
  getDraft,
  updateDraft,
  listDraftsForOwner,
  createVersion,
  getVersion,
  listVersions,
  saveTemplate,
  isKindCheckViolation,
  normalizeVersionKind,
  kindConstraintMigrationHint
};
