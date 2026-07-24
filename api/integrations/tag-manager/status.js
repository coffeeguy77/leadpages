'use strict';

const { createClient } = require('@supabase/supabase-js');
const http = require('../../../lib/brain/http');
const gtm = require('../../../lib/gtm/oauth');
const { gtmIntegrationEnabled, gtmManagedPublishEnabled, flagSnapshot } = require('../../../lib/google-ads/flags');

function admin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function liveToken(db, conn) {
  const refresh = gtm.decryptSecret(conn.refresh_token);
  let access = conn.access_token ? gtm.decryptSecret(conn.access_token) : '';
  const exp = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (access && exp > Date.now() + 60000) return access;
  const tok = await gtm.refreshAccessToken(refresh);
  access = tok.access_token;
  await db
    .from('gtm_connections')
    .update({
      access_token: gtm.encryptSecret(access),
      token_expires_at: new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('site_id', conn.site_id);
  return access;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return http.json(res, 405, { error: 'method_not_allowed' });
    }
    const user = await http.requireUser(req);
    if (!user) return http.json(res, 401, { error: 'unauthorized' });
    const body = req.method === 'POST' ? await http.readBody(req) : {};
    const q = req.query || {};
    const siteId = String(body.siteId || q.siteId || '').trim();
    if (!siteId) return http.json(res, 400, { error: 'site_id_required' });
    const access = await http.assertSiteAccess(user, siteId);
    if (!access.ok) return http.json(res, access.code, { error: access.error });

    const db = admin();
    const { data: conn } = await db.from('gtm_connections').select('*').eq('site_id', siteId).maybeSingle();

    if (req.method === 'GET') {
      return http.json(res, 200, {
        ok: true,
        enabled: gtmIntegrationEnabled(),
        configured: gtm.configured(),
        flags: flagSnapshot(),
        redirectUri: gtm.oauthRedirectUri(),
        connected: !!(conn && conn.connection_status === 'connected'),
        email: conn && conn.google_account_email,
        setupMode: conn && conn.setup_mode,
        accountId: conn && conn.account_id,
        containerId: conn && conn.container_id,
        containerPublicId: conn && conn.container_public_id,
        publishAllowed: gtmManagedPublishEnabled(),
        modes: [
          { id: 'native', label: 'LeadPages Native — Recommended' },
          { id: 'data_layer', label: 'GTM Data Layer' },
          { id: 'managed', label: 'LeadPages Managed GTM (preview only until publish flag)' }
        ]
      });
    }

    const action = String(body.action || 'status').trim();
    if (!conn) return http.json(res, 400, { error: 'not_connected' });

    if (action === 'list_accounts') {
      const token = await liveToken(db, conn);
      const accounts = await gtm.listAccounts(token);
      return http.json(res, 200, {
        ok: true,
        accounts: accounts.map((a) => ({
          id: String(a.accountId || a.account_id || ''),
          name: a.name || ''
        }))
      });
    }

    if (action === 'list_containers') {
      const accountId = String(body.accountId || conn.account_id || '').trim();
      if (!accountId) return http.json(res, 400, { error: 'account_id_required' });
      const token = await liveToken(db, conn);
      const containers = await gtm.listContainers(token, accountId);
      return http.json(res, 200, {
        ok: true,
        containers: containers.map((c) => ({
          id: String(c.containerId || c.container_id || ''),
          publicId: c.publicId || c.public_id || '',
          name: c.name || ''
        }))
      });
    }

    if (action === 'select_container') {
      const accountId = String(body.accountId || '').trim();
      const containerId = String(body.containerId || '').trim();
      const publicId = String(body.publicId || '').trim();
      if (!accountId || !containerId) return http.json(res, 400, { error: 'container_required' });
      await db
        .from('gtm_connections')
        .update({
          account_id: accountId,
          container_id: containerId,
          container_public_id: publicId || null,
          setup_mode: body.setupMode || conn.setup_mode || 'data_layer',
          updated_at: new Date().toISOString()
        })
        .eq('site_id', siteId);
      try {
        await db.from('gtm_containers').upsert(
          {
            site_id: siteId,
            account_id: accountId,
            container_id: containerId,
            public_id: publicId || null,
            name: body.name || null,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'site_id,account_id,container_id' }
        );
      } catch (_e) {}
      return http.json(res, 200, { ok: true, action });
    }

    if (action === 'inspect') {
      if (!conn.account_id || !conn.container_id) return http.json(res, 400, { error: 'select_container_first' });
      const token = await liveToken(db, conn);
      const health = await gtm.inspectContainer(token, conn.account_id, conn.container_id);
      return http.json(res, 200, { ok: true, action, health });
    }

    if (action === 'set_mode') {
      const mode = String(body.setupMode || '').trim();
      if (['native', 'data_layer', 'managed'].indexOf(mode) < 0) {
        return http.json(res, 400, { error: 'invalid_mode' });
      }
      await db
        .from('gtm_connections')
        .update({ setup_mode: mode, updated_at: new Date().toISOString() })
        .eq('site_id', siteId);
      return http.json(res, 200, { ok: true, setupMode: mode });
    }

    if (action === 'publish_managed') {
      return http.json(res, 403, {
        error: 'publish_disabled',
        message:
          'Managed GTM publishing is disabled until GTM_MANAGED_PUBLISH=1 and preview/version testing passes. Publishing requires a separate explicit confirmation.',
        flags: flagSnapshot()
      });
    }

    return http.json(res, 400, { error: 'unknown_action' });
  } catch (e) {
    return http.json(res, 500, { error: 'server_error', message: e && e.message ? e.message : String(e) });
  }
};
