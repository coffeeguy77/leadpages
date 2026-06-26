// api/billing/cron.js — daily maintenance, triggered by Vercel Cron.
// Any site suspended for more than 90 days is FLAGGED for deletion (not deleted) so
// you can review and remove it yourself. Secured with CRON_SECRET (Vercel Cron sends
// "Authorization: Bearer <CRON_SECRET>" when that env var is set).

const { sb, json } = require('./_stripe');

const DAYS = 90;

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    let key = auth;
    try { if (!key) key = new URL(req.url, 'http://x').searchParams.get('key') || ''; } catch (e) {}
    if (key !== secret) return json(res, 401, { error: 'unauthorized' });
  }

  const cutoff = new Date(Date.now() - DAYS * 864e5).toISOString();
  try {
    const { data: due } = await sb.from('sites')
      .select('id,business_name,suspended_at,delete_protected,delete_extend_until')
      .eq('billing_status', 'suspended')
      .lt('suspended_at', cutoff);

    let flagged = 0, skipped = 0;
    for (const s of (due || [])) {
      if (s.delete_protected) { skipped++; continue; }                                   // account protection
      if (s.delete_extend_until && new Date(s.delete_extend_until).getTime() > Date.now()) { skipped++; continue; } // extended
      const { error } = await sb.from('sites')
        .update({ billing_status: 'flagged_deletion', delete_flagged_at: new Date().toISOString() })
        .eq('id', s.id);
      if (!error) flagged++;
    }
    return json(res, 200, { ok: true, checked: (due || []).length, flagged, skipped });
  } catch (e) {
    return json(res, 500, { error: String(e.message || e) });
  }
};
