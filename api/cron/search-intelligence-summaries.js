'use strict';

/**
 * Cron: build weekly Search Intelligence client summaries for connected sites.
 * Auth: Bearer CRON_SECRET
 */

const { createClient } = require('@supabase/supabase-js');
const {
  buildClientSummary,
  saveReportSnapshot
} = require('../../lib/search-intelligence/client-summary');

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

  try {
    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    // Sites with at least one connected SI provider
    const { data: conns, error } = await admin
      .from('si_connections')
      .select('site_id')
      .eq('connection_status', 'connected')
      .eq('enabled', true);
    if (error) {
      if (/relation|does not exist/i.test(String(error.message || ''))) {
        return json(200, { ok: true, skipped: 'schema_pending' });
      }
      throw new Error(error.message);
    }

    const siteIds = Array.from(
      new Set((conns || []).map(function (c) { return c.site_id; }).filter(Boolean))
    ).slice(0, 100);

    const results = [];
    for (const siteId of siteIds) {
      const { data: site } = await admin
        .from('sites')
        .select('id,slug,business_name,config,status')
        .eq('id', siteId)
        .maybeSingle();
      if (!site) {
        results.push({ siteId: siteId, ok: false, error: 'site_missing' });
        continue;
      }
      try {
        const summary = await buildClientSummary(admin, site, { days: 28, reportKind: 'weekly' });
        const saved = await saveReportSnapshot(admin, summary);
        results.push({ siteId: siteId, ok: true, snapshotId: saved.id });
      } catch (e) {
        results.push({
          siteId: siteId,
          ok: false,
          error: String((e && e.message) || e)
        });
      }
    }

    return json(200, { ok: true, count: results.length, results: results });
  } catch (e) {
    console.error('si summaries cron:', e && e.message);
    return json(500, { error: (e && e.message) || 'cron_failed' });
  }
};
