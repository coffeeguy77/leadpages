// GET /api/billing/premium-apps?siteId=
//   List Orders / Quote Builder / Bookings prices + entitlement for a site.
// POST /api/billing/premium-apps
//   Super-admin: { action:'activate'|'deactivate', siteId, app, billing_cycle?, enable_section? }
const { sb, getUser, isAdminEmail, json } = require('./_stripe');
const { isSuperAdmin } = require('./_admin-auth');
const {
  PREMIUM_APPS,
  listPremiumEntitlements,
  activatePremiumApp,
  deactivatePremiumApp
} = require('../../lib/premium-apps');

async function canAccessSite(user, siteId) {
  if (!user) return false;
  if (isAdminEmail(user.email) || (await isSuperAdmin(user))) return true;
  const { data: site } = await sb
    .from('sites')
    .select('id,owner_user_id,servicing_partner_id,referring_partner_id')
    .eq('id', siteId)
    .maybeSingle();
  if (!site) return false;
  if (site.owner_user_id === user.id) return true;
  try {
    const { data: partner } = await sb
      .from('partners')
      .select('id,status')
      .eq('user_id', user.id)
      .maybeSingle();
    if (
      partner &&
      partner.status === 'active' &&
      (site.servicing_partner_id === partner.id || site.referring_partner_id === partner.id)
    ) {
      return true;
    }
  } catch (_e) {}
  return false;
}

module.exports = async function (req, res) {
  const user = await getUser(req);
  if (!user) return json(res, 401, { ok: false, error: 'unauthorized' });

  if (req.method === 'GET') {
    let siteId = null;
    try {
      siteId = new URL(req.url, 'http://x').searchParams.get('siteId');
    } catch (_e) {}
    if (!siteId) return json(res, 400, { ok: false, error: 'siteId required' });
    if (!(await canAccessSite(user, siteId))) return json(res, 403, { ok: false, error: 'forbidden' });

    try {
      const apps = await listPremiumEntitlements(sb, siteId);
      const catalog = PREMIUM_APPS.map(function (a) {
        var live = apps.find(function (x) {
          return x.slug === a.slug;
        });
        return live || a;
      });
      return json(res, 200, {
        ok: true,
        siteId: siteId,
        apps: catalog,
        entitled_nav: catalog.filter(function (a) { return a.entitled; }).map(function (a) { return a.nav_key; })
      });
    } catch (e) {
      return json(res, 500, { ok: false, error: String((e && e.message) || e) });
    }
  }

  if (req.method === 'POST') {
    if (!(await isSuperAdmin(user))) return json(res, 403, { ok: false, error: 'admins only' });
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
    const app = body.app || body.slug || body.section_key;
    const action = String(body.action || 'activate').toLowerCase();
    if (!siteId || !app) return json(res, 400, { ok: false, error: 'siteId and app required' });

    const { data: site } = await sb.from('sites').select('id,slug,business_name').eq('id', siteId).maybeSingle();
    if (!site) return json(res, 404, { ok: false, error: 'site not found' });

    try {
      if (action === 'deactivate' || action === 'revoke') {
        const r = await deactivatePremiumApp(sb, siteId, app);
        if (!r.ok) return json(res, 400, r);
        const apps = await listPremiumEntitlements(sb, siteId);
        return json(res, 200, { ok: true, site: site, apps: apps });
      }
      const r = await activatePremiumApp(sb, siteId, app, {
        billing_cycle: body.billing_cycle || body.cycle || 'monthly',
        enable_section: body.enable_section !== false
      });
      if (!r.ok) return json(res, 400, r);
      const apps = await listPremiumEntitlements(sb, siteId);
      return json(res, 200, { ok: true, site: site, activated: r.entitlement, apps: apps });
    } catch (e) {
      return json(res, 500, { ok: false, error: String((e && e.message) || e) });
    }
  }

  return json(res, 405, { ok: false, error: 'GET or POST only' });
};
