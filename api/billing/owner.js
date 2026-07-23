// api/billing/owner.js — bridges a site's "Client login email" to a real account id.
//
// Billing, contra, and accrual all key off sites.owner_user_id, but the admin only ever
// types an owner_email in Settings. This endpoint resolves that email to a Supabase auth
// user (creating a confirmed login if one doesn't exist yet — which is exactly what the
// "lets this customer log in" field promises) and stamps owner_user_id onto every one of
// that client's sites, so the whole billing layer can see the client.
//
// Editing password / OTP provisioning for the client lives in /api/auth/client-access
// (separate from billing). This route still ensures the auth user exists so sign-in codes
// work after "Link client".
//
//   GET  ?siteId=  (admin) -> { owner_email, owner_user_id, linked }
//   POST { siteId } (admin) -> find-or-create the login, stamp the sites, return linked info

const { sb, getUser, isAdminEmail, json } = require('./_stripe');
const { findOrCreateUser, normalizeEmail, stampSiteOwner } = require('../auth/_client-login');

module.exports = async (req, res) => {
  const user = await getUser(req);
  if (!user) return json(res, 401, { error: 'unauthorized' });
  if (!isAdminEmail(user.email)) return json(res, 403, { error: 'admins only' });

  let siteId = null;
  try { siteId = new URL(req.url, 'http://x').searchParams.get('siteId'); } catch (e) {}
  if (!siteId && req.method === 'POST') {
    let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    siteId = (body || {}).siteId;
  }
  if (!siteId) return json(res, 400, { error: 'siteId required' });

  const { data: site } = await sb.from('sites').select('id,owner_user_id,owner_email,business_name,slug').eq('id', siteId).maybeSingle();
  if (!site) return json(res, 404, { error: 'site not found' });

  if (req.method === 'GET') {
    return json(res, 200, { siteId: site.id, owner_email: site.owner_email || null, owner_user_id: site.owner_user_id || null, linked: !!site.owner_user_id });
  }

  if (req.method === 'POST') {
    const email = normalizeEmail(site.owner_email);
    if (!email) return json(res, 400, { error: 'Add a Client login email in this site\u2019s Settings first, then link the client.' });
    if (isAdminEmail(email)) {
      return json(res, 400, { error: 'Client login email cannot be a super-admin address. Use the customer\u2019s email.' });
    }

    // Re-link when email changed or not yet linked (do not early-return on stale owner_user_id).
    const fc = await findOrCreateUser(email);
    if (!fc || !fc.user) return json(res, 500, { error: 'Could not find or create a login for ' + email + ' \u2014 check the email and that the service role key is set.' });

    if (String(fc.user.id) === String(user.id)) {
      return json(res, 400, { error: 'Client login email matches your admin account. Use a different customer email.' });
    }

    const stamped = await stampSiteOwner(siteId, email, fc.user.id);
    if (!stamped.ok) return json(res, 500, { error: stamped.error || 'Could not link client' });

    // Also stamp every site already on this email (including previously linked under another id).
    await sb.from('sites').update({ owner_user_id: fc.user.id }).eq('owner_email', email);

    return json(res, 200, {
      owner_user_id: fc.user.id,
      owner_email: email,
      linked: true,
      created: !!fc.created
    });
  }

  return json(res, 405, { error: 'GET or POST only' });
};
