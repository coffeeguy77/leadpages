'use strict';

/**
 * POST /api/integrations/tag-manager/publish
 * Managed GTM publish — gated OFF by default (GTM_MANAGED_PUBLISH).
 */

const http = require('../../../lib/brain/http');
const { gtmIntegrationEnabled, gtmManagedPublishEnabled, flagSnapshot } = require('../../../lib/google-ads/flags');
const { writeAudit } = require('../../../lib/google-ads/audit');
const { createClient } = require('@supabase/supabase-js');

function admin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return http.json(res, 405, { error: 'method_not_allowed' });
    }
    if (!gtmIntegrationEnabled()) {
      return http.json(res, 403, { error: 'gtm_disabled', flags: flagSnapshot() });
    }
    const user = await http.requireUser(req);
    if (!user) return http.json(res, 401, { error: 'unauthorized' });
    const body = await http.readBody(req);
    const siteId = String(body.siteId || '').trim();
    if (!siteId) return http.json(res, 400, { error: 'site_id_required' });
    const access = await http.assertSiteAccess(user, siteId);
    if (!access.ok) return http.json(res, access.code, { error: access.error });

    const db = admin();
    if (!gtmManagedPublishEnabled()) {
      await writeAudit(db, {
        siteId,
        actorUserId: user.id,
        action: 'gtm_publish_blocked',
        result: { reason: 'GTM_MANAGED_PUBLISH off' }
      });
      return http.json(res, 403, {
        error: 'publish_disabled',
        message:
          'Managed GTM publishing is disabled. Set GTM_MANAGED_PUBLISH=1 after preview testing. Inspection remains available.',
        flags: flagSnapshot()
      });
    }

    if (body.confirmPublish !== true) {
      return http.json(res, 400, {
        error: 'confirm_required',
        message: 'Pass confirmPublish:true after reviewing the workspace version.',
        requiresConfirmation: true
      });
    }

    return http.json(res, 501, {
      error: 'publish_not_implemented',
      message: 'Managed GTM publish is reserved for a later rollout after Coffee Events pilot tracking is proven.',
      flags: flagSnapshot()
    });
  } catch (e) {
    return http.json(res, 500, { error: 'server_error', message: e && e.message ? e.message : String(e) });
  }
};
