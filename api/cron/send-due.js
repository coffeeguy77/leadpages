// api/cron/send-due.js — runs on a schedule (see vercel.json) and sends any
// campaign whose scheduled time has arrived. Reuses the exact same delivery
// routine as the "send now" path in api/send-campaign.js.
//
// Security: if CRON_SECRET is set, the request must carry
//   Authorization: Bearer <CRON_SECRET>
// Vercel Cron sends this header automatically when CRON_SECRET is configured.

const { createClient } = require('@supabase/supabase-js');
const { deliverCampaign } = require('../send-campaign.js');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  const json = (code, obj) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); };

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const h = req.headers.authorization || '';
    if (h !== 'Bearer ' + secret) return json(401, { ok: false, error: 'unauthorized' });
  }

  try {
    const nowIso = new Date().toISOString();
    // Grab campaigns that are due. Small batch per run to stay well within limits.
    const due = await admin.from('email_campaigns')
      .select('*')
      .eq('status', 'scheduled')
      .lte('send_at', nowIso)
      .order('send_at', { ascending: true })
      .limit(10);

    if (due.error) return json(500, { ok: false, error: 'query_failed', detail: due.error.message });
    const rows = due.data || [];
    const results = [];

    for (const c of rows) {
      // Claim it first so a second overlapping run can't double-send.
      const claim = await admin.from('email_campaigns')
        .update({ status: 'sending' })
        .eq('id', c.id).eq('status', 'scheduled')
        .select('id').maybeSingle();
      if (!claim.data) continue; // someone else claimed it

      try {
        const r = await deliverCampaign(c);
        results.push({ id: c.id, ...r });
      } catch (e) {
        await admin.from('email_campaigns').update({ status: 'failed' }).eq('id', c.id);
        results.push({ id: c.id, error: (e && e.message) || 'deliver_failed' });
      }
    }

    return json(200, { ok: true, processed: results.length, results });
  } catch (e) {
    console.error('send-due error:', e && e.message);
    return json(500, { ok: false, error: 'server' });
  }
};
