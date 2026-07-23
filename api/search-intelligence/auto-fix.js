'use strict';

/**
 * POST /api/search-intelligence/auto-fix
 * Human-confirmed allow-listed technical fixes only.
 */

const http = require('../../lib/brain/http');
const { createClient } = require('@supabase/supabase-js');
const { listSafeFixes, getSafeFix, runSafeFix } = require('../../lib/search-intelligence/auto-fix');

function admin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      return http.json(res, 200, {
        ok: true,
        fixes: listSafeFixes(),
        safeguards: {
          confirmRequired: true,
          publishAllowed: false,
          note: 'Only allow-listed technical fixes. Never silent AI publish.'
        }
      });
    }
    if (req.method !== 'POST') return http.json(res, 405, { error: 'method_not_allowed' });

    const user = await http.requireUser(req);
    if (!user) return http.json(res, 401, { error: 'unauthorized' });

    const body = await http.readBody(req);
    const siteId = String(body.siteId || body.site_id || '').trim();
    const fixId = String(body.fixId || body.fix_id || '').trim();
    if (!siteId) return http.json(res, 400, { error: 'site_id_required' });
    if (!fixId) return http.json(res, 400, { error: 'fix_id_required', fixes: listSafeFixes() });
    if (!getSafeFix(fixId)) {
      return http.json(res, 400, { error: 'fix_not_allowlisted', fixes: listSafeFixes() });
    }

    const access = await http.assertSiteAccess(user, siteId);
    if (!access.ok) return http.json(res, access.code, { error: access.error });

    const db = admin();
    if (!db) return http.json(res, 503, { error: 'database_unavailable' });

    const { data: site, error } = await db
      .from('sites')
      .select('id,slug,business_name,config,status,custom_domain')
      .eq('id', siteId)
      .maybeSingle();
    if (error || !site) return http.json(res, 404, { error: 'site_not_found' });

    const result = await runSafeFix(db, site, fixId, {
      confirm: body.confirm === true,
      actorUserId: user.id,
      actorRole: access.role,
      recipeId: body.recipeId || null
    });

    if (!result.ok) {
      const code = result.error === 'confirm_required' ? 422 : 400;
      return http.json(res, code, result);
    }

    return http.json(res, 200, Object.assign({ role: access.role }, result));
  } catch (e) {
    return http.json(res, 500, {
      error: 'server_error',
      message: String((e && e.message) || e)
    });
  }
};
