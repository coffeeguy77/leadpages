'use strict';

const { createClient } = require('@supabase/supabase-js');
const http = require('../../../lib/brain/http');
const gtm = require('../../../lib/gtm/oauth');
const { gtmIntegrationEnabled } = require('../../../lib/google-ads/flags');
const { safeReturnPath } = require('../../../lib/app-url');

function admin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return http.json(res, 405, { error: 'method_not_allowed' });
    }
    if (!gtmIntegrationEnabled()) {
      return http.json(res, 403, { error: 'gtm_disabled', message: 'Set GTM_INTEGRATION=1 to enable Tag Manager connect.' });
    }
    if (!gtm.configured()) {
      return http.json(res, 503, { error: 'gtm_not_configured', message: 'Set GTM_CLIENT_ID and GTM_CLIENT_SECRET.' });
    }
    const user = await http.requireUser(req);
    if (!user) return http.json(res, 401, { error: 'unauthorized' });
    const body = req.method === 'POST' ? await http.readBody(req) : {};
    const q = req.query || {};
    const siteId = String(body.siteId || q.siteId || '').trim();
    if (!siteId) return http.json(res, 400, { error: 'site_id_required' });
    const access = await http.assertSiteAccess(user, siteId);
    if (!access.ok) return http.json(res, access.code, { error: access.error });

    const mode = String(body.mode || q.mode || 'read');
    if ((mode === 'edit' || mode === 'managed' || mode === 'publish') && body.acknowledgeEdit !== true && q.acknowledgeEdit !== '1') {
      return http.json(res, 400, {
        error: 'acknowledge_edit_required',
        message:
          'GTM edit/publish scopes can change containers. Pass acknowledgeEdit:true. Publishing still requires a separate confirmation and GTM_MANAGED_PUBLISH=1.'
      });
    }

    const nonce = require('crypto').randomBytes(16).toString('hex');
    const db = admin();
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await db.from('gtm_oauth_states').upsert({
      nonce,
      site_id: siteId,
      leadpages_user_id: user.id,
      expires_at: expires
    });

    const returnPath = safeReturnPath(body.returnPath || q.returnPath || '/settings/integrations/tag-manager');
    const state = gtm.makeState({
      n: nonce,
      s: siteId,
      u: user.id,
      r: returnPath,
      m: mode
    });
    const url = gtm.authorizeUrl({ state, mode });
    if (q.format === 'json' || body.format === 'json') {
      return http.json(res, 200, { ok: true, authorizeUrl: url, redirectUri: gtm.oauthRedirectUri() });
    }
    res.statusCode = 302;
    res.setHeader('Location', url);
    res.end();
  } catch (e) {
    return http.json(res, 500, { error: 'server_error', message: e && e.message ? e.message : String(e) });
  }
};
