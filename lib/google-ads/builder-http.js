'use strict';

/**
 * Shared auth + site access for Ads Campaign Builder APIs.
 */

const http = require('../brain/http');
const { createClient } = require('@supabase/supabase-js');
const { flagSnapshot, canUseCapability, campaignBuilderEnabled } = require('./flags');

function admin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function requireSite(req, res, opts) {
  const o = opts || {};
  const user = await http.requireUser(req);
  if (!user) {
    http.json(res, 401, { error: 'unauthorized' });
    return null;
  }
  const body = o.body || {};
  const q = req.query || {};
  const siteId = String(body.siteId || body.site_id || q.siteId || q.site_id || '').trim();
  if (!siteId) {
    http.json(res, 400, { error: 'site_id_required' });
    return null;
  }
  const access = await http.assertSiteAccess(user, siteId);
  if (!access.ok) {
    http.json(res, access.code, { error: access.error });
    return null;
  }
  if (o.capability && !canUseCapability(access, o.capability)) {
    http.json(res, 403, {
      error: 'capability_denied',
      capability: o.capability,
      flags: flagSnapshot()
    });
    return null;
  }
  if (o.requireBuilder && !campaignBuilderEnabled()) {
    http.json(res, 403, { error: 'builder_disabled', flags: flagSnapshot() });
    return null;
  }
  const db = admin();
  if (!db) {
    http.json(res, 503, { error: 'database_unavailable' });
    return null;
  }
  return { user, access, siteId, db, site: access.site };
}

async function loadAdsConn(db, siteId) {
  const { data } = await db.from('google_ads_connections').select('*').eq('site_id', siteId).maybeSingle();
  return data || null;
}

module.exports = {
  http,
  admin,
  requireSite,
  loadAdsConn,
  flagSnapshot
};
