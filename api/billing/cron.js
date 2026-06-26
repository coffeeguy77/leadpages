// api/billing/cron.js — daily maintenance, triggered by Vercel Cron.
// Any site suspended for more than 90 days is FLAGGED for deletion (not deleted) so
// you can review and remove it yourself. Secured with CRON_SECRET (Vercel Cron sends
// "Authorization: Bearer <CRON_SECRET>" when that env var is set).

const { sb, json } = require('./_stripe');
const { accrueOwner } = require('./_accrual');

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
    // 1) Monthly contra accrual — climbs each accruing client's balance once per month.
    const accrual = [];
    try {
      const { data: accts } = await sb.from('contra_accounts').select('owner_user_id').eq('enabled', true).eq('accrue_monthly', true);
      for (const a of (accts || [])) {
        const r = await accrueOwner(sb, a.owner_user_id);
        if (r && (r.accrued || r.skipped === 'over-limit')) accrual.push(r);
      }
    } catch (e) { accrual.push({ error: String(e.message || e) }); }

    // 2) Flag long-suspended sites for review/deletion.
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
    return json(res, 200, { ok: true, accrued: accrual, checked: (due || []).length, flagged, skipped });
  } catch (e) {
    return json(res, 500, { error: String(e.message || e) });
  }
};
