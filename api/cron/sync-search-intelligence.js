'use strict';

/**
 * Cron: sync Search Console query×page stats for connected sites.
 * Auth: Bearer CRON_SECRET (same as Ads cron).
 */

const { createClient } = require('@supabase/supabase-js');
const { syncAllConnected, daysAgo } = require('../../lib/search-intelligence/sync');
const oauthCfg = require('../../lib/search-intelligence/google-oauth/config');

module.exports = async (req, res) => {
  const json = (code, obj) => {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(obj));
  };

  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== 'Bearer ' + secret) {
    return json(401, { error: 'unauthorized' });
  }
  if (!oauthCfg.configured('search_console') || !oauthCfg.encryptionConfigured()) {
    return json(200, { ok: true, skipped: 'not_configured' });
  }

  try {
    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const hour = new Date().getUTCHours();
    const qDays = parseInt((req.query && req.query.days) || '', 10);
    const days = Math.max(1, Math.min(90, qDays || (hour === 6 ? 28 : 7)));
    const results = await syncAllConnected(admin, {
      startDate: daysAgo(days),
      endDate: daysAgo(0),
      days: days
    });
    return json(200, { ok: true, days: days, results: results });
  } catch (e) {
    console.error('sync-search-intelligence cron:', e && e.message);
    return json(500, { error: (e && e.message) || 'cron_failed' });
  }
};
