// GET /api/billing/accounting — platform accounting dashboard payload (super-admin).
const { sb, requireSuper, json, monthKey, lastNMonths } = require('./_admin-auth');

function sum(arr, key) {
  return (arr || []).reduce(function(a, r) { return a + (Number(r[key]) || 0); }, 0);
}

function bucketByMonth(rows, dateKey, amountKey) {
  const map = {};
  (rows || []).forEach(function(r) {
    const k = monthKey(r[dateKey]);
    if (!k) return;
    if (!map[k]) map[k] = { month: k, total: 0, count: 0 };
    map[k].total += Number(r[amountKey]) || 0;
    map[k].count += 1;
  });
  return map;
}

module.exports = async function(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'GET only' });
  const user = await requireSuper(req, res);
  if (!user) return;

  try {
    const months = lastNMonths(6);

    const [
      sitesRes,
      commissionsRes,
      partnersRes,
      profilesRes,
      customersRes,
      adjustmentsRes,
      packagesRes,
      maintRes,
      jobsRes,
      plansRes
    ] = await Promise.all([
      sb.from('sites')
        .select('id,slug,business_name,owner_email,owner_user_id,plan_key,monthly_amount,billing_status,suspended_at,sale_price,is_mockup,is_partner_home,referring_partner_id,servicing_partner_id,commission_partner_id,created_at')
        .order('created_at', { ascending: false })
        .limit(2000),
      sb.from('partner_commissions')
        .select('id,partner_id,site_id,type,rate,gross_amount,commission_amount,status,period_start,period_end,stripe_invoice_id,expected_payment_date,paid_date,created_at,notes')
        .order('created_at', { ascending: false })
        .limit(5000),
      sb.from('partners')
        .select('id,display_name,email,phone,status')
        .order('display_name', { ascending: true })
        .limit(500),
      sb.from('partner_profiles')
        .select('partner_id,bank_account_name,bank_bsb,bank_account_number,bank_name,bank_details_locked,gst_registered,support_email,support_phone')
        .limit(500),
      sb.from('billing_customers')
        .select('owner_user_id,owner_email,stripe_customer_id,stripe_subscription_id,status,updated_at')
        .limit(2000),
      sb.from('billing_invoice_adjustments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200),
      sb.from('maintenance_packages')
        .select('*')
        .order('sort', { ascending: true })
        .limit(100),
      sb.from('site_maintenance')
        .select('id,site_id,package_id,partner_id,status,price_cents,billing_interval,starts_at,ends_at')
        .limit(2000),
      sb.from('maintenance_jobs')
        .select('id,site_id,partner_id,package_id,title,job_type,amount_cents,partner_share_cents,platform_share_cents,status,created_at,completed_at')
        .order('created_at', { ascending: false })
        .limit(500),
      sb.from('billing_plans')
        .select('key,name,monthly_amount,setup_amount,active,is_free,sort')
        .order('sort', { ascending: true })
    ]);

    // Soft-fail optional tables that may not be migrated yet.
    const sites = sitesRes.data || [];
    const commissions = commissionsRes.data || [];
    const partners = partnersRes.data || [];
    const profiles = profilesRes.data || [];
    const customers = customersRes.data || [];
    const adjustments = adjustmentsRes.error ? [] : (adjustmentsRes.data || []);
    const packages = packagesRes.error ? [] : (packagesRes.data || []);
    const maintenance = maintRes.error ? [] : (maintRes.data || []);
    const jobs = jobsRes.error ? [] : (jobsRes.data || []);
    const plans = plansRes.data || [];

    const liveSites = sites.filter(function(s) {
      return !s.is_mockup && !s.is_partner_home;
    });

    const byStatus = {};
    liveSites.forEach(function(s) {
      const st = s.billing_status || 'none';
      byStatus[st] = (byStatus[st] || 0) + 1;
    });

    const activeHosting = liveSites.filter(function(s) {
      return s.billing_status === 'active' && (s.monthly_amount || 0) > 0;
    });
    const pastDue = liveSites.filter(function(s) { return s.billing_status === 'past_due'; });
    const suspended = liveSites.filter(function(s) {
      return s.billing_status === 'suspended' || s.billing_status === 'flagged_deletion';
    });

    const mrrCents = sum(activeHosting, 'monthly_amount');
    const pendingComm = commissions.filter(function(c) { return c.status === 'pending' || c.status === 'approved'; });
    const paidComm = commissions.filter(function(c) { return c.status === 'paid'; });
    const heldComm = commissions.filter(function(c) { return c.status === 'held'; });

    const dueToPartnersCents = sum(pendingComm, 'commission_amount');
    const paidToPartnersCents = sum(paidComm, 'commission_amount');
    const salesGrossCents = sum(commissions, 'gross_amount');

    // Income / commission charts by month
    const salesBuckets = bucketByMonth(commissions, 'created_at', 'gross_amount');
    const partnerExpenseBuckets = bucketByMonth(
      commissions.filter(function(c) { return c.status === 'paid' || c.status === 'approved' || c.status === 'pending'; }),
      'created_at',
      'commission_amount'
    );
    const incomeChart = months.map(function(m) {
      return {
        month: m,
        sales: (salesBuckets[m] && salesBuckets[m].total) || 0,
        partnerExpense: (partnerExpenseBuckets[m] && partnerExpenseBuckets[m].total) || 0,
        count: (salesBuckets[m] && salesBuckets[m].count) || 0
      };
    });

    // Highest earning partners
    const byPartner = {};
    commissions.forEach(function(c) {
      if (!c.partner_id) return;
      if (!byPartner[c.partner_id]) {
        byPartner[c.partner_id] = {
          partner_id: c.partner_id,
          gross: 0,
          commission: 0,
          pending: 0,
          paid: 0,
          count: 0
        };
      }
      const row = byPartner[c.partner_id];
      row.gross += Number(c.gross_amount) || 0;
      row.commission += Number(c.commission_amount) || 0;
      row.count += 1;
      if (c.status === 'pending' || c.status === 'approved') row.pending += Number(c.commission_amount) || 0;
      if (c.status === 'paid') row.paid += Number(c.commission_amount) || 0;
    });

    const partnerMap = {};
    partners.forEach(function(p) { partnerMap[p.id] = p; });
    const profileMap = {};
    profiles.forEach(function(p) { profileMap[p.partner_id] = p; });

    const partnerLeaderboard = Object.keys(byPartner).map(function(id) {
      const stats = byPartner[id];
      const p = partnerMap[id] || {};
      const bank = profileMap[id] || {};
      return {
        partner_id: id,
        display_name: p.display_name || 'Partner',
        email: p.email || null,
        status: p.status || null,
        gross_cents: stats.gross,
        commission_cents: stats.commission,
        pending_cents: stats.pending,
        paid_cents: stats.paid,
        count: stats.count,
        bank: {
          account_name: bank.bank_account_name || null,
          bsb: bank.bank_bsb || null,
          account_number: bank.bank_account_number || null,
          bank_name: bank.bank_name || null,
          locked: !!bank.bank_details_locked,
          gst_registered: !!bank.gst_registered
        }
      };
    }).sort(function(a, b) { return b.commission_cents - a.commission_cents; });

    const payoutQueue = pendingComm.slice(0, 100).map(function(c) {
      const p = partnerMap[c.partner_id] || {};
      const bank = profileMap[c.partner_id] || {};
      return {
        id: c.id,
        type: c.type,
        status: c.status,
        gross_cents: c.gross_amount,
        commission_cents: c.commission_amount,
        expected_payment_date: c.expected_payment_date,
        stripe_invoice_id: c.stripe_invoice_id,
        site_id: c.site_id,
        partner: {
          id: c.partner_id,
          display_name: p.display_name || 'Partner',
          email: p.email || null
        },
        bank: {
          account_name: bank.bank_account_name || null,
          bsb: bank.bank_bsb || null,
          account_number: bank.bank_account_number || null,
          bank_name: bank.bank_name || null,
          locked: !!bank.bank_details_locked
        }
      };
    });

    const failedPayments = pastDue.map(function(s) {
      return {
        id: s.id,
        slug: s.slug,
        business_name: s.business_name,
        owner_email: s.owner_email,
        plan_key: s.plan_key,
        monthly_amount: s.monthly_amount,
        billing_status: s.billing_status,
        servicing_partner_id: s.servicing_partner_id
      };
    });

    const suspendedCustomers = suspended.map(function(s) {
      return {
        id: s.id,
        slug: s.slug,
        business_name: s.business_name,
        owner_email: s.owner_email,
        plan_key: s.plan_key,
        monthly_amount: s.monthly_amount,
        billing_status: s.billing_status,
        suspended_at: s.suspended_at
      };
    });

    const maintActive = maintenance.filter(function(m) { return m.status === 'active'; });
    const maintMrr = sum(maintActive, 'price_cents');

    return json(res, 200, {
      ok: true,
      generated_at: new Date().toISOString(),
      summary: {
        mrr_cents: mrrCents,
        active_hosting_sites: activeHosting.length,
        live_sites: liveSites.length,
        past_due_count: pastDue.length,
        suspended_count: suspended.length,
        sales_gross_cents: salesGrossCents,
        commissions_due_cents: dueToPartnersCents,
        commissions_paid_cents: paidToPartnersCents,
        commissions_held_cents: sum(heldComm, 'commission_amount'),
        partners_count: partners.length,
        billing_customers: customers.length,
        maintenance_mrr_cents: maintMrr,
        maintenance_active: maintActive.length,
        status_breakdown: byStatus
      },
      charts: {
        income_by_month: incomeChart
      },
      partner_leaderboard: partnerLeaderboard.slice(0, 25),
      highest_earning_partner: partnerLeaderboard[0] || null,
      payout_queue: payoutQueue,
      failed_payments: failedPayments,
      suspended_customers: suspendedCustomers,
      clients: liveSites.slice(0, 400).map(function(s) {
        return {
          id: s.id,
          slug: s.slug,
          business_name: s.business_name,
          owner_email: s.owner_email,
          plan_key: s.plan_key,
          monthly_amount: s.monthly_amount,
          billing_status: s.billing_status,
          referring_partner_id: s.referring_partner_id,
          servicing_partner_id: s.servicing_partner_id,
          created_at: s.created_at
        };
      }),
      partners: partners.map(function(p) {
        const bank = profileMap[p.id] || {};
        const stats = byPartner[p.id] || { commission: 0, pending: 0, paid: 0, gross: 0, count: 0 };
        return {
          id: p.id,
          display_name: p.display_name,
          email: p.email,
          phone: p.phone,
          status: p.status,
          commission_cents: stats.commission,
          pending_cents: stats.pending,
          paid_cents: stats.paid,
          bank: {
            account_name: bank.bank_account_name || null,
            bsb: bank.bank_bsb || null,
            account_number: bank.bank_account_number || null,
            bank_name: bank.bank_name || null,
            locked: !!bank.bank_details_locked,
            gst_registered: !!bank.gst_registered
          }
        };
      }),
      billing_customers: customers,
      invoice_adjustments: adjustments,
      maintenance_packages: packages,
      site_maintenance: maintenance,
      maintenance_jobs: jobs,
      plans: plans,
      warnings: {
        adjustments_table: !!adjustmentsRes.error,
        maintenance_tables: !!(packagesRes.error || maintRes.error || jobsRes.error),
        message: (adjustmentsRes.error || packagesRes.error)
          ? 'Run db/billing_accounting.sql in Supabase to enable invoice edits and maintenance packages.'
          : null
      }
    });
  } catch (e) {
    console.error('billing/accounting error:', e);
    return json(res, 500, { ok: false, error: String(e.message || e) });
  }
};
