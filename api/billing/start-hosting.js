// GET  /api/billing/start-hosting?q=  — search sites for hosting manager
// GET  /api/billing/start-hosting?siteId= — site billing snapshot + plans
// POST /api/billing/start-hosting — start hosting billing for an EXISTING site
//   Body: { siteId, planKey, returnUrl?, linkOwner? }
// Super-admin only. Reuses checkout.js (Stripe payment link / add-to-sub).
const { sb, getUser, isAdminEmail, json } = require('./_stripe');
const { isSuperAdmin } = require('./_admin-auth');
const { findOrCreateUser, normalizeEmail, stampSiteOwner } = require('../auth/_client-login');
const checkout = require('./checkout');

async function assertAdmin(req, res) {
  const user = await getUser(req);
  if (!user) {
    json(res, 401, { ok: false, error: 'unauthorized' });
    return null;
  }
  if (!(await isSuperAdmin(user)) && !isAdminEmail(user.email)) {
    json(res, 403, { ok: false, error: 'admins only' });
    return null;
  }
  return user;
}

async function ensureOwnerLinked(site) {
  if (site.owner_user_id) return { site: site, linked: true, created: false };
  const email = normalizeEmail(site.owner_email);
  if (!email) return { site: site, linked: false, created: false, error: 'no_owner_email' };
  if (isAdminEmail(email)) {
    return { site: site, linked: false, created: false, error: 'owner_email_is_admin' };
  }
  const fc = await findOrCreateUser(email);
  if (!fc || !fc.user) return { site: site, linked: false, created: false, error: 'could_not_create_login' };
  const stamped = await stampSiteOwner(site.id, email, fc.user.id);
  if (!stamped.ok) return { site: site, linked: false, created: false, error: stamped.error || 'stamp_failed' };
  await sb.from('sites').update({ owner_user_id: fc.user.id }).eq('owner_email', email);
  site.owner_user_id = fc.user.id;
  return { site: site, linked: true, created: !!fc.created };
}

function siteRow(s) {
  return {
    id: s.id,
    slug: s.slug,
    business_name: s.business_name,
    owner_email: s.owner_email || null,
    owner_user_id: s.owner_user_id || null,
    plan_key: s.plan_key || null,
    monthly_amount: s.monthly_amount || 0,
    billing_status: s.billing_status || 'none',
    stripe_item_id: s.stripe_item_id || null,
    needs_billing:
      !s.plan_key ||
      !s.billing_status ||
      s.billing_status === 'none' ||
      s.billing_status === 'suspended' ||
      s.billing_status === 'flagged_deletion'
  };
}

module.exports = async function (req, res) {
  const user = await assertAdmin(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    let q = null;
    let siteId = null;
    try {
      const u = new URL(req.url, 'http://x');
      q = (u.searchParams.get('q') || '').trim();
      siteId = u.searchParams.get('siteId');
    } catch (_e) {}

    if (siteId) {
      const { data: site } = await sb
        .from('sites')
        .select('id,slug,business_name,owner_user_id,owner_email,plan_key,billing_status,monthly_amount,stripe_item_id')
        .eq('id', siteId)
        .maybeSingle();
      if (!site) return json(res, 404, { ok: false, error: 'site not found' });
      const { data: plans } = await sb
        .from('billing_plans')
        .select('key,name,monthly_amount,setup_amount,currency,active,is_free')
        .eq('active', true)
        .order('sort', { ascending: true });
      return json(res, 200, { ok: true, site: siteRow(site), plans: plans || [] });
    }

    if (!q) {
      // Default unpaid / needs-billing list for the Hosting Manager
      const { data: sites } = await sb
        .from('sites')
        .select('id,slug,business_name,owner_user_id,owner_email,plan_key,billing_status,monthly_amount,stripe_item_id,is_mockup,is_partner_home')
        .eq('is_mockup', false)
        .eq('is_partner_home', false)
        .order('updated_at', { ascending: false })
        .limit(300);
      const rows = (sites || [])
        .map(siteRow)
        .filter(function (s) {
          return s.needs_billing;
        })
        .slice(0, 80);
      const { data: plans } = await sb
        .from('billing_plans')
        .select('key,name,monthly_amount,setup_amount,currency,active,is_free')
        .eq('active', true)
        .order('sort', { ascending: true });
      return json(res, 200, { ok: true, sites: rows, plans: plans || [] });
    }

    const safe = String(q).replace(/[%*,()]/g, '').trim().slice(0, 80);
    if (!safe) return json(res, 200, { ok: true, sites: [], q: q });
    const like = '%' + safe + '%';
    const { data: bySlug } = await sb
      .from('sites')
      .select('id,slug,business_name,owner_user_id,owner_email,plan_key,billing_status,monthly_amount,stripe_item_id')
      .or('slug.ilike.' + like + ',business_name.ilike.' + like + ',owner_email.ilike.' + like + ',custom_domain.ilike.' + like)
      .limit(40);
    return json(res, 200, {
      ok: true,
      sites: (bySlug || []).map(siteRow),
      q: q
    });
  }

  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'GET or POST only' });

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_e) {
      body = {};
    }
  }
  body = body || {};
  const siteId = body.siteId;
  const planKey = body.planKey;
  if (!siteId || !planKey) return json(res, 400, { ok: false, error: 'siteId and planKey are required' });

  var siteRes = await sb
    .from('sites')
    .select('id,slug,business_name,owner_user_id,owner_email,plan_key,billing_status,monthly_amount,stripe_item_id')
    .eq('id', siteId)
    .maybeSingle();
  if (!siteRes.data) return json(res, 404, { ok: false, error: 'site not found' });
  var site = siteRes.data;

  if (body.linkOwner !== false) {
    var linked = await ensureOwnerLinked(site);
    site = linked.site;
    if (!site.owner_user_id && !site.owner_email) {
      return json(res, 400, {
        ok: false,
        error: 'Site has no owner email — set Client login email first, then start hosting.'
      });
    }
    if (linked.error === 'owner_email_is_admin') {
      return json(res, 400, {
        ok: false,
        error: 'Client login email cannot be a super-admin address. Use the customer’s email.'
      });
    }
  }

  // Forward into existing checkout handler (admin-initiated payment link / add item).
  // Stamp acting user as admin via SUPER path: checkout accepts isAdminEmail OR isSuperAdmin
  // after the small auth widen in checkout.js.
  req.body = {
    siteId: site.id,
    planKey: planKey,
    returnUrl: body.returnUrl || undefined
  };
  return checkout(req, res);
};
