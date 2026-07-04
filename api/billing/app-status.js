// api/billing/app-status.js
// GET /api/billing/app-status?siteId=<id>
// Returns all app subscriptions for a site with their state and app details.
// Accessible by the site owner or an admin.

const { sb, getUser, isAdminEmail, json } = require('./_stripe');

module.exports = async (req, res) => {
  const user = await getUser(req);
  if (!user) return json(res, 401, { error: 'unauthorized' });

  let siteId = null;
  try { siteId = new URL(req.url, 'http://x').searchParams.get('siteId'); } catch (e) {}
  if (!siteId) return json(res, 400, { error: 'siteId required' });

  try {
    const { data: site } = await sb.from('sites')
      .select('id,owner_user_id').eq('id', siteId).maybeSingle();
    if (!site) return json(res, 404, { error: 'site not found' });
    const admin = isAdminEmail(user.email);
    if (!admin && site.owner_user_id !== user.id) return json(res, 403, { error: 'not your site' });

    const { data: subs } = await sb.from('site_app_subscriptions')
      .select('*,app_registry(id,slug,name,tagline,tier,price_monthly_aud,price_annual_aud,api_dependency)')
      .eq('site_id', siteId)
      .order('created_at', { ascending: true });

    const now = new Date();
    const annotated = (subs || []).map((s) => {
      let state = s.status;
      // cancelled but still within access window -> treat as active until expiry
      if (state === 'cancelled' && s.access_until && new Date(s.access_until) > now) {
        state = 'cancelling'; // active access, ending soon
      }
      return Object.assign({}, s, { computed_state: state });
    });

    return json(res, 200, { subs: annotated });
  } catch (e) {
    return json(res, 500, { error: String(e.message || e) });
  }
};
