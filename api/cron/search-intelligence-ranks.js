'use strict';

/**
 * Cron: run due Search Intelligence rank checks for tracked keywords.
 * Auth: Bearer CRON_SECRET
 *
 * daily cadence: every run; weekly: due after ~6 days; event: skipped
 */

const { createClient } = require('@supabase/supabase-js');
const { runRankJobs } = require('../../lib/search-intelligence/rank-jobs');

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
    const qDays = parseInt((req.query && req.query.max) || '', 10);
    const max = Math.max(1, Math.min(100, qDays || 60));
    const result = await runRankJobs(admin, {
      max: max,
      provider: process.env.SI_PROVIDER || 'mock'
    });
    return json(200, result);
  } catch (e) {
    if (e && (e.code === 'schema_pending' || String(e.message) === 'schema_pending')) {
      return json(200, { ok: true, skipped: 'schema_pending' });
    }
    console.error('si rank cron:', e && e.message);
    return json(500, { error: (e && e.message) || 'cron_failed' });
  }
};
