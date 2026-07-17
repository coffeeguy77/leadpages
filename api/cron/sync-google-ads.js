// Cron: sync Google Ads metrics into ads_metrics_daily
const { createClient } = require('@supabase/supabase-js');
const { syncAllConnected, daysAgo } = require('../../lib/google-ads/sync');
const cfg = require('../../lib/google-ads/config');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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
  if (!cfg.configured()) {
    return json(200, { ok: true, skipped: 'not_configured' });
  }

  try {
    // Default: last 2 days every 2h. Between 05:00–05:59 UTC refresh 7 days.
    const hour = new Date().getUTCHours();
    const qDays = parseInt((req.query && req.query.days) || '', 10);
    const days = Math.max(1, Math.min(30, qDays || (hour === 5 ? 7 : 2)));
    const results = await syncAllConnected(admin, {
      fromDay: daysAgo(days),
      toDay: daysAgo(0)
    });
    return json(200, { ok: true, days, results });
  } catch (e) {
    console.error('sync-google-ads cron:', e && e.message);
    return json(500, { error: (e && e.message) || 'cron_failed' });
  }
};
