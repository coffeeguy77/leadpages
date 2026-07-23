/**
 * api/auth/client-access.js — project client editing login (NOT billing).
 *
 * Super-admins manage a site's Client login email / password here so:
 *   - Account password changes never touch the super-admin session user
 *   - Sign-in codes work because an auth user exists for owner_email
 *   - Clients can edit while building; hosting suspension is handled separately
 *
 *   GET  ?siteId=           → { owner_email, owner_user_id, linked, loginReady }
 *   POST { siteId, action } → ensure | setEmail | setPassword
 */
'use strict';

const {
  getSb,
  json,
  getUser,
  isAdminEmail,
  isSuperAdmin,
  normalizeEmail,
  findOrCreateUser,
  setUserPassword,
  stampSiteOwner,
  readBody
} = require('./_client-login');

async function loadSite(siteId) {
  const { data } = await getSb()
    .from('sites')
    .select('id,owner_email,owner_user_id,business_name,slug,plan_key,billing_status,status')
    .eq('id', siteId)
    .maybeSingle();
  return data || null;
}

function payload(site, extra) {
  return Object.assign(
    {
      siteId: site.id,
      owner_email: site.owner_email || null,
      owner_user_id: site.owner_user_id || null,
      linked: !!site.owner_user_id,
      loginReady: !!(site.owner_email && site.owner_user_id),
      business_name: site.business_name || null
    },
    extra || {}
  );
}

module.exports = async function clientAccess(req, res) {
  const user = await getUser(req);
  if (!user) return json(res, 401, { error: 'unauthorized' });
  if (!(await isSuperAdmin(user))) return json(res, 403, { error: 'admins only' });

  let siteId = null;
  try {
    siteId = new URL(req.url, 'http://x').searchParams.get('siteId');
  } catch (_e) {}

  if (req.method === 'GET') {
    if (!siteId) return json(res, 400, { error: 'siteId required' });
    const site = await loadSite(siteId);
    if (!site) return json(res, 404, { error: 'site not found' });
    return json(res, 200, payload(site));
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'GET or POST only' });

  const body = await readBody(req);
  siteId = siteId || (body && body.siteId);
  if (!siteId) return json(res, 400, { error: 'siteId required' });

  const site = await loadSite(siteId);
  if (!site) return json(res, 404, { error: 'site not found' });

  const action = String((body && body.action) || 'ensure').toLowerCase();

  if (action === 'ensure' || action === 'setemail') {
    const email = normalizeEmail(
      action === 'setemail' ? body.email : body.email || site.owner_email
    );
    if (!email) {
      return json(res, 400, {
        error: 'Add a Client login email in Settings first (editing login, not the public website email).'
      });
    }
    if (isAdminEmail(email)) {
      return json(res, 400, {
        error: 'That email is a super-admin login. Use the customer\u2019s email for Client login.'
      });
    }

    const fc = await findOrCreateUser(email);
    if (!fc || !fc.user) {
      return json(res, 500, {
        error: 'Could not create a sign-in for ' + email + '. Check the email and service role key.'
      });
    }

    // Never stamp a site onto the currently signed-in super-admin user by accident
    // when emails collide — already blocked by isAdminEmail above.
    const stamped = await stampSiteOwner(siteId, email, fc.user.id);
    if (!stamped.ok) return json(res, 500, { error: stamped.error || 'Could not save client login' });

    const updated = await loadSite(siteId);
    return json(
      res,
      200,
      payload(updated || site, {
        ok: true,
        created: !!fc.created,
        action: action
      })
    );
  }

  if (action === 'setpassword') {
    const password = String((body && body.password) || '');
    if (password.length < 8) return json(res, 400, { error: 'Password must be at least 8 characters.' });

    let email = normalizeEmail(body.email || site.owner_email);
    if (!email) {
      return json(res, 400, {
        error: 'Set the Client login email on this project first, then set their password.'
      });
    }
    if (isAdminEmail(email)) {
      return json(res, 400, {
        error: 'Refusing to change a super-admin password from project Client access.'
      });
    }

    // Critical: update by auth user id for the CLIENT email — never session updateUser.
    const fc = await findOrCreateUser(email, password);
    if (!fc || !fc.user) {
      return json(res, 500, { error: 'Could not find or create the client login for ' + email });
    }

    if (!fc.created) {
      const pw = await setUserPassword(fc.user.id, password);
      if (!pw.ok) return json(res, 500, { error: pw.error || 'Could not set client password' });
    }

    // Guard before linking: never allow this endpoint to target the caller's own auth user.
    if (String(fc.user.id) === String(user.id)) {
      return json(res, 400, {
        error: 'Client login email matches your admin account. Use a different customer email.'
      });
    }

    const stamped = await stampSiteOwner(siteId, email, fc.user.id);
    if (!stamped.ok) return json(res, 500, { error: stamped.error || 'Could not link client login' });

    const updated = await loadSite(siteId);
    return json(
      res,
      200,
      payload(updated || site, {
        ok: true,
        passwordSet: true,
        created: !!fc.created
      })
    );
  }

  return json(res, 400, { error: 'Unknown action. Use ensure, setEmail, or setPassword.' });
};
