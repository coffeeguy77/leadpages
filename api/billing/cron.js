// api/billing/cron.js — daily maintenance, triggered by Vercel Cron.
//
// POLICY (intentional): this job MUST NEVER delete sites, Cloudinary assets, or
// site config. Unpaid accounts stay suspended / locked until a human deletes the
// site from Manage (or the customer closes the account). Images are removed only
// on that explicit delete path (deleteSiteNow → cwDeletePrefix).
//
// Secured with CRON_SECRET (Vercel Cron sends "Authorization: Bearer <CRON_SECRET>"
// when that env var is set).

const { sb, json } = require('./_stripe');
const { accrueOwner } = require('./_accrual');

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    let key = auth;
    try { if (!key) key = new URL(req.url, 'http://x').searchParams.get('key') || ''; } catch (e) {}
    if (key !== secret) return json(res, 401, { error: 'unauthorized' });
  }

  try {
    // Monthly contra accrual — climbs each accruing client's balance once per month.
    // No site/image lifecycle work here.
    const accrual = [];
    try {
      const { data: accts } = await sb.from('contra_accounts').select('owner_user_id').eq('enabled', true).eq('accrue_monthly', true);
      for (const a of (accts || [])) {
        const r = await accrueOwner(sb, a.owner_user_id);
        if (r && (r.accrued || r.skipped === 'over-limit')) accrual.push(r);
      }
    } catch (e) { accrual.push({ error: String(e.message || e) }); }

    return json(res, 200, {
      ok: true,
      accrued: accrual,
      autoDelete: false,
      note: 'Cron never deletes sites or Cloudinary images. Review locked/past_due accounts in Accounting and delete manually when ready.'
    });
  } catch (e) {
    return json(res, 500, { error: String(e.message || e) });
  }
};
