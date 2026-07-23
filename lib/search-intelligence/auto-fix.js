'use strict';

/**
 * Phase 5 — scoped safe auto-fixes.
 * Every fix requires explicit human confirm via API (confirm:true).
 * Never silent AI publish, never invent content, never buy links.
 */

const { buildSchemaPatch, applySchemaPatchToConfig } = require('./schema-patch');

/** Allow-listed fix ids only. */
const SAFE_FIXES = Object.freeze({
  refresh_sitemap: Object.freeze({
    id: 'refresh_sitemap',
    title: 'Regenerate sitemap',
    plainLanguage: 'Bump sitemapGeneratedAt so search engines see the latest page list.',
    recipes: ['not_indexed'],
    mutates: ['sites.config.sitemapGeneratedAt']
  }),
  apply_schema_local: Object.freeze({
    id: 'apply_schema_local',
    title: 'Apply LocalBusiness schema',
    plainLanguage: 'Write modelled LocalBusiness / FAQ JSON-LD into site config (facts only).',
    recipes: ['schema_missing_local'],
    mutates: ['sites.config.seoJsonLd']
  })
});

function listSafeFixes() {
  return Object.keys(SAFE_FIXES).map(function (k) {
    return SAFE_FIXES[k];
  });
}

function getSafeFix(id) {
  return SAFE_FIXES[id] || null;
}

/**
 * Suggest safe fixes for a finding / recipe.
 */
function suggestSafeFixes(finding) {
  const recipeId = finding && (finding.recipeId || finding.code);
  const out = [];
  listSafeFixes().forEach(function (fix) {
    if (fix.recipes.indexOf(recipeId) >= 0) out.push(fix);
  });
  // Always offer sitemap refresh as a soft technical option when crawl/index issues exist
  if (
    finding &&
    (finding.code === 'crawl_missing_canonical' || finding.code === 'crawl_empty_title') &&
    !out.some(function (f) {
      return f.id === 'refresh_sitemap';
    })
  ) {
    /* do not auto-attach — keep allow-list strict by recipe */
  }
  return out;
}

async function applyRefreshSitemap(admin, site) {
  const cfg = Object.assign({}, (site && site.config) || {});
  cfg.sitemapGeneratedAt = new Date().toISOString();
  const { data, error } = await admin
    .from('sites')
    .update({ config: cfg, updated_at: new Date().toISOString() })
    .eq('id', site.id)
    .select('id,config')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    fixId: 'refresh_sitemap',
    sitemapGeneratedAt: cfg.sitemapGeneratedAt,
    site: data
  };
}

async function applySchemaLocal(admin, site) {
  const patch = buildSchemaPatch(site, {});
  if (!patch.missing || !patch.missing.length) {
    return { ok: true, fixId: 'apply_schema_local', skipped: 'already_present', missing: [] };
  }
  const nextCfg = applySchemaPatchToConfig((site && site.config) || {}, patch);
  const { data, error } = await admin
    .from('sites')
    .update({ config: nextCfg, updated_at: new Date().toISOString() })
    .eq('id', site.id)
    .select('id,config')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    fixId: 'apply_schema_local',
    applied: patch.missing,
    site: data
  };
}

/**
 * Run one allow-listed fix. Requires opts.confirm === true.
 */
async function runSafeFix(admin, site, fixId, opts) {
  const o = opts || {};
  if (o.confirm !== true) {
    return {
      ok: false,
      error: 'confirm_required',
      message: 'Pass confirm:true after human review. Safe auto-fix never runs silently.'
    };
  }
  const fix = getSafeFix(fixId);
  if (!fix) {
    return { ok: false, error: 'fix_not_allowlisted', message: 'Only allow-listed technical fixes are permitted.' };
  }
  if (!admin || !site || !site.id) {
    return { ok: false, error: 'missing_site' };
  }

  let result;
  if (fixId === 'refresh_sitemap') result = await applyRefreshSitemap(admin, site);
  else if (fixId === 'apply_schema_local') result = await applySchemaLocal(admin, site);
  else result = { ok: false, error: 'fix_not_implemented' };

  if (result && result.ok) {
    try {
      await admin.from('si_annotations').insert({
        site_id: site.id,
        annotation_type: 'auto_fix_safe',
        title: 'Safe auto-fix — ' + fix.title,
        detail: {
          fixId: fixId,
          actorUserId: o.actorUserId || null,
          recipeId: o.recipeId || null,
          result: {
            sitemapGeneratedAt: result.sitemapGeneratedAt || null,
            applied: result.applied || null,
            skipped: result.skipped || null
          },
          safeguards: {
            confirm: true,
            publishAllowed: false,
            note: 'Allow-listed technical fix only — no AI content publish.'
          }
        }
      });
    } catch (_e) {
      /* soft */
    }
    try {
      await admin.from('si_approvals').insert({
        site_id: site.id,
        subject_type: 'auto_fix',
        subject_id: fixId,
        decision: 'approved',
        actor_user_id: o.actorUserId || null,
        actor_role: o.actorRole || null,
        notes: 'Safe auto-fix confirmed'
      });
    } catch (_e) {
      /* schema may lack table */
    }
  }
  return result;
}

module.exports = {
  SAFE_FIXES: SAFE_FIXES,
  listSafeFixes: listSafeFixes,
  getSafeFix: getSafeFix,
  suggestSafeFixes: suggestSafeFixes,
  runSafeFix: runSafeFix
};
