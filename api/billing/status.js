// api/billing/status.js — billing summary for the /manage dashboard.
//   GET            -> the caller's own account (sites, fees, combined total, status)
//   GET ?ownerId=  -> a specific client's account (admins only)

const { sb, getUser, isAdminEmail, json } = require('./_stripe');

module.exports = async (req, res) => {
  const user = await getUser(req);
  if (!user) return json(res, 401, { error: 'unauthorized' });

  let ownerId = user.id;
  try {
    const u = new URL(req.url, 'http://x');
    const q = u.searchParams.get('ownerId');
    if (q && isAdminEmail(user.email)) ownerId = q;
  } catch (e) {}

  try {
    const { data: bc } = await sb.from('billing_customers').select('status,stripe_customer_id,stripe_subscription_id').eq('owner_user_id', ownerId).maybeSingle();
    const { data: sites } = await sb.from('sites')
      .select('id,business_name,slug,plan_key,monthly_amount,billing_status,setup_paid,suspended_at,delete_flagged_at')
      .eq('owner_user_id', ownerId);

    const billed = (sites || []).filter((s) => s.plan_key);
    const total = billed.reduce((n, s) => n + (s.monthly_amount || 0), 0);
    // Account-level status: worst case across the client's sites.
    const order = { suspended: 4, flagged_deletion: 5, past_due: 3, active: 2, none: 1 };
    let acct = (bc && bc.status) || 'none';
    billed.forEach((s) => { if ((order[s.billing_status] || 0) > (order[acct] || 0)) acct = s.billing_status; });
    const locked = acct === 'suspended' || acct === 'flagged_deletion';

    return json(res, 200, {
      accountStatus: acct,
      locked,
      hasBillingAccount: !!(bc && bc.stripe_customer_id),
      currency: 'aud',
      total,
      sites: (sites || []).map((s) => ({
        id: s.id, business_name: s.business_name, slug: s.slug,
        plan_key: s.plan_key, monthly_amount: s.monthly_amount || 0,
        billing_status: s.billing_status || 'none', setup_paid: !!s.setup_paid,
        suspended_at: s.suspended_at, delete_flagged_at: s.delete_flagged_at,
      })),
    });
  } catch (e) {
    return json(res, 500, { error: String(e.message || e) });
  }
};
