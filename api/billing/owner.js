// api/billing/owner.js — bridges a site's "Client login email" to a real account id.
//
// Billing, contra, and accrual all key off sites.owner_user_id, but the admin only ever
// types an owner_email in Settings. This endpoint resolves that email to a Supabase auth
// user (creating a confirmed login if one doesn't exist yet — which is exactly what the
// "lets this customer log in" field promises) and stamps owner_user_id onto every one of
// that client's sites, so the whole billing layer can see the client.
//
//   GET  ?siteId=  (admin) -> { owner_email, owner_user_id, linked }   (no changes made)
//   POST { siteId } (admin) -> find-or-create the login, stamp the sites, return linked info

const { sb, getUser, isAdminEmail, json } = require('./_stripe');

const BASE = process.env.SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AHEAD = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'content-type': 'application/json' };

async function findUserByEmail(email) {
  email = String(email || '').toLowerCase();
  for (let page = 1; page <= 12; page++) {
    let r;
    try { r = await fetch(BASE + '/auth/v1/admin/users?page=' + page + '&per_page=200', { headers: AHEAD }); }
    catch (e) { return null; }
    if (!r.ok) return null;
    const j = await r.json().catch(() => ({}));
    const users = j.users || (Array.isArray(j) ? j : []);
    const hit = users.find((u) => String(u.email || '').toLowerCase() === email);
    if (hit) return hit.id;
    if (!users.length || users.length < 200) break;
  }
  return null;
}

async function createUser(email) {
  let r;
  try {
    r = await fetch(BASE + '/auth/v1/admin/users', {
      method: 'POST', headers: AHEAD,
      body: JSON.stringify({ email: String(email).toLowerCase(), email_confirm: true }),
    });
  } catch (e) { return null; }
  const j = await r.json().catch(() => ({}));
  if (r.ok && j && j.id) return j.id;
  return null; // likely already exists
}

async function findOrCreate(email) {
  let id = await findUserByEmail(email);
  if (id) return { id, created: false };
  id = await createUser(email);
  if (id) return { id, created: true };
  id = await findUserByEmail(email); // race / already-existed fallback
  return id ? { id, created: false } : null;
}

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
    if (site.owner_user_id) return json(res, 200, { owner_user_id: site.owner_user_id, owner_email: site.owner_email, linked: true, created: false });
    const email = String(site.owner_email || '').trim().toLowerCase();
    if (!email) return json(res, 400, { error: 'Add a Client login email in this site\u2019s Settings first, then link the client.' });

    const fc = await findOrCreate(email);
    if (!fc) return json(res, 500, { error: 'Could not find or create a login for ' + email + ' \u2014 check the email and that the service role key is set.' });

    // Stamp every one of this client's not-yet-linked sites so their bill combines.
    const { error } = await sb.from('sites').update({ owner_user_id: fc.id }).eq('owner_email', email).is('owner_user_id', null);
    if (error) return json(res, 500, { error: error.message });

    return json(res, 200, { owner_user_id: fc.id, owner_email: email, linked: true, created: fc.created });
  }

  return json(res, 405, { error: 'GET or POST only' });
};
