// api/billing/status.js — billing summary for the /manage dashboard.
//   GET            -> the caller's own account (sites, fees, combined total, status)
//   GET ?ownerId=  -> a specific client's account (admins only)
//   GET ?siteId=   -> the owner of that site's account (admins only; clients always get their own)
//
// Editor lock rules (editing login is separate from billing, but unpaid hosting blocks backend):
//   - Building / no plan_key sites stay editable even if a sibling hosting site is suspended
//   - A site with an active hosting plan that is suspended|flagged_deletion locks that site
//   - Without siteId, locked means the account has at least one suspended hosted site
//     (clients are forwarded to payment when they open a locked site)

const { sb, getUser, isAdminEmail, json } = require('./_stripe');

const LOCK_STATUSES = { suspended: true, flagged_deletion: true };

function siteIsHostingLocked(s) {
  if (!s || !s.plan_key) return false;
  return !!LOCK_STATUSES[s.billing_status];
}

module.exports = async (req, res) => {
  const user = await getUser(req);
  if (!user) return json(res, 401, { error: 'unauthorized' });

  let ownerId = user.id;
  let focusSiteId = null;
  if (isAdminEmail(user.email)) {
    try {
      const u = new URL(req.url, 'http://x');
      const q = u.searchParams.get('ownerId');
      const sid = u.searchParams.get('siteId');
      if (q) ownerId = q;
      else if (sid) {
        focusSiteId = sid;
        const { data: st } = await sb.from('sites').select('owner_user_id').eq('id', sid).maybeSingle();
        if (st && st.owner_user_id) ownerId = st.owner_user_id;
      }
    } catch (e) {}
  } else {
    try {
      focusSiteId = new URL(req.url, 'http://x').searchParams.get('siteId');
    } catch (e) {}
  }

  try {
    const { data: bc } = await sb.from('billing_customers').select('status,stripe_customer_id,stripe_subscription_id').eq('owner_user_id', ownerId).maybeSingle();
    const { data: sites } = await sb.from('sites')
      .select('id,business_name,slug,plan_key,monthly_amount,billing_status,setup_paid,suspended_at,delete_flagged_at,status')
      .eq('owner_user_id', ownerId);

    const billed = (sites || []).filter((s) => s.plan_key);
    const total = billed.reduce((n, s) => n + (s.monthly_amount || 0), 0);
    // Account-level status: worst case across the client's sites.
    const order = { suspended: 4, flagged_deletion: 5, past_due: 3, active: 2, none: 1 };
    let acct = (bc && bc.status) || 'none';
    billed.forEach((s) => { if ((order[s.billing_status] || 0) > (order[acct] || 0)) acct = s.billing_status; });

    let locked = false;
    let lockReason = null;
    if (focusSiteId) {
      const focus = (sites || []).find((s) => String(s.id) === String(focusSiteId));
      if (focus && siteIsHostingLocked(focus)) {
        locked = true;
        lockReason = 'site_suspended';
      } else if (!focus) {
        // Site may not yet be stamped with owner_user_id (building) — allow access.
        locked = false;
      }
    } else {
      // No focus site: lock only when every owned site with a plan is suspended,
      // or when there is at least one suspended hosted site and no building sites.
      const hostedLocked = billed.filter(siteIsHostingLocked);
      const building = (sites || []).filter((s) => !s.plan_key);
      if (hostedLocked.length && !building.length) {
        locked = true;
        lockReason = 'account_suspended';
      } else if (acct === 'suspended' || acct === 'flagged_deletion') {
        // Account flag with no building sites left to work on.
        if (!building.length && billed.length) {
          locked = true;
          lockReason = 'account_suspended';
        }
      }
    }

    return json(res, 200, {
      accountStatus: acct,
      locked,
      lockReason,
      hasBillingAccount: !!(bc && bc.stripe_customer_id),
      currency: 'aud',
      total,
      sites: (sites || []).map((s) => ({
        id: s.id, business_name: s.business_name, slug: s.slug,
        plan_key: s.plan_key, monthly_amount: s.monthly_amount || 0,
        billing_status: s.billing_status || 'none', setup_paid: !!s.setup_paid,
        suspended_at: s.suspended_at, delete_flagged_at: s.delete_flagged_at,
        hosting_locked: siteIsHostingLocked(s),
      })),
    });
  } catch (e) {
    return json(res, 500, { error: String(e.message || e) });
  }
};
