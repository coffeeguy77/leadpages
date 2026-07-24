'use strict';

const { createClient } = require('@supabase/supabase-js');
const http = require('../../../lib/brain/http');

function admin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return http.json(res, 405, { error: 'method_not_allowed' });
    const user = await http.requireUser(req);
    if (!user) return http.json(res, 401, { error: 'unauthorized' });
    const body = await http.readBody(req);
    const siteId = String(body.siteId || '').trim();
    if (!siteId) return http.json(res, 400, { error: 'site_id_required' });
    const access = await http.assertSiteAccess(user, siteId);
    if (!access.ok) return http.json(res, access.code, { error: access.error });
    const db = admin();
    await db.from('gtm_connections').delete().eq('site_id', siteId);
    try {
      await db.from('gtm_containers').delete().eq('site_id', siteId);
    } catch (_e) {}
    return http.json(res, 200, {
      ok: true,
      message: 'Disconnected. Customer GTM resources in Google were not deleted.'
    });
  } catch (e) {
    return http.json(res, 500, { error: 'server_error', message: e && e.message ? e.message : String(e) });
  }
};
