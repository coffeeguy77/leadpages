'use strict';

/**
 * GET /api/search-intelligence/recommendations?siteId=
 * Returns config-audit findings (open) plus optional recipe catalog.
 */

const http = require('../../lib/brain/http');
const { createClient } = require('@supabase/supabase-js');
const {
  listRecommendationPreviews,
  getRecipe,
  auditSiteConfig
} = require('../../lib/search-intelligence/overview');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return http.json(res, 405, { error: 'method_not_allowed' });
    }
    const user = await http.requireUser(req);
    if (!user) return http.json(res, 401, { error: 'unauthorized' });

    const body = req.method === 'POST' ? await http.readBody(req) : {};
    const siteId = String(
      (body && body.siteId) || (req.query && (req.query.siteId || req.query.site_id)) || ''
    ).trim();
    if (!siteId) return http.json(res, 400, { error: 'site_id_required' });

    const access = await http.assertSiteAccess(user, siteId);
    if (!access.ok) return http.json(res, access.code, { error: access.error });

    const recipeId = String(
      (body && body.recipeId) || (req.query && req.query.recipeId) || ''
    ).trim();
    if (recipeId) {
      const recipe = getRecipe(recipeId);
      if (!recipe) return http.json(res, 404, { error: 'recipe_not_found' });
      return http.json(res, 200, {
        ok: true,
        siteId: siteId,
        scaffold: true,
        recommendation: {
          recipeId: recipe.id,
          title: recipe.title,
          plainLanguage: recipe.plainLanguage,
          severity: recipe.severityDefault,
          actions: recipe.actions,
          status: 'catalog'
        }
      });
    }

    let cfg = (body && body.config) || {};
    try {
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const { data } = await sb.from('sites').select('config').eq('id', siteId).maybeSingle();
        if (data && data.config) cfg = data.config;
      }
    } catch (_e) { /* ignore */ }

    const audit = auditSiteConfig(cfg, { siteId: siteId });
    const includeCatalog =
      String((body && body.includeCatalog) || (req.query && req.query.includeCatalog) || '') === '1';

    return http.json(res, 200, {
      ok: true,
      siteId: siteId,
      scaffold: true,
      recommendations: audit.findings.concat(includeCatalog ? listRecommendationPreviews() : []),
      audit: { issueCount: audit.issueCount, auditedAt: audit.auditedAt },
      role: access.role
    });
  } catch (e) {
    return http.json(res, 500, {
      error: 'server_error',
      message: String(e && e.message || e)
    });
  }
};
