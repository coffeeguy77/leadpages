'use strict';

/**
 * GET /api/search-intelligence/recommendations?siteId=
 * Returns recipe-backed NBA previews until si_recommendations is populated.
 */

const http = require('../../lib/brain/http');
const {
  listRecommendationPreviews,
  getRecipe
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
          status: 'preview'
        }
      });
    }

    return http.json(res, 200, {
      ok: true,
      siteId: siteId,
      scaffold: true,
      recommendations: listRecommendationPreviews(),
      role: access.role
    });
  } catch (e) {
    return http.json(res, 500, {
      error: 'server_error',
      message: String(e && e.message || e)
    });
  }
};
