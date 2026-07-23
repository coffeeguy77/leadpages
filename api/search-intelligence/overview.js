'use strict';

/**
 * GET /api/search-intelligence/overview?siteId=
 * Phase 1 scaffold — auth + site access; preview Command Centre payload.
 */

const http = require('../../lib/brain/http');
const { buildOverview } = require('../../lib/search-intelligence/overview');

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

    const demoKeyword =
      (body && body.demoKeyword) ||
      (req.query && req.query.demoKeyword) ||
      '';
    const overview = await buildOverview({
      siteId: siteId,
      includeDemoRecipes: true,
      demoKeyword: demoKeyword || null,
      location: (body && body.location) || (req.query && req.query.location) || null
    });
    overview.role = access.role;
    return http.json(res, 200, overview);
  } catch (e) {
    return http.json(res, 500, {
      error: 'server_error',
      message: String(e && e.message || e)
    });
  }
};
