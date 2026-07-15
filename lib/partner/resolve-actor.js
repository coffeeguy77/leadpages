/**
 * Resolve the partner actor for /api/partner/* endpoints.
 * Supports the partner's own session, or a super-admin acting as a partner
 * via ?partner_id= / ?as= / body.partner_id.
 */
const { createClient } = require('@supabase/supabase-js');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const r = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token }
    });
    if (!r.ok) return null;
    const u = await r.json();
    if (!u || !u.id) return null;
    return { id: u.id, email: String(u.email || '').toLowerCase() };
  } catch (_e) {
    return null;
  }
}

async function isSuper(userId) {
  try {
    const r = await admin.from('profiles').select('is_super_admin').eq('id', userId).maybeSingle();
    return !!(r.data && r.data.is_super_admin);
  } catch (_e) {
    return false;
  }
}

function queryVal(req, key) {
  try {
    if (req.query && req.query[key] != null) return String(req.query[key]);
  } catch (_e) { /* ignore */ }
  return '';
}

/**
 * @param {object} req
 * @param {object} [opts]
 * @param {object} [opts.body] parsed body (for partner_id / as)
 * @param {boolean} [opts.requireActive=true] reject non-active partners (skipped for asAdmin)
 * @returns {Promise<{user, partner, asAdmin}|{error:{status,body}}>}
 */
async function resolvePartnerActor(req, opts) {
  opts = opts || {};
  const user = await getUser(req);
  if (!user) return { error: { status: 401, body: { ok: false, error: 'unauthorized' } } };

  const body = opts.body || {};
  const asPartnerId = String(
    queryVal(req, 'partner_id') || queryVal(req, 'as') || body.partner_id || body.as || ''
  ).trim();
  const superAdmin = await isSuper(user.id);

  if (asPartnerId) {
    if (!superAdmin) return { error: { status: 403, body: { ok: false, error: 'forbidden' } } };
    const p = (await admin.from('partners')
      .select('id,display_name,email,phone,status,user_id')
      .eq('id', asPartnerId)
      .maybeSingle()).data;
    if (!p) return { error: { status: 404, body: { ok: false, error: 'Partner not found.' } } };
    return { user, partner: p, asAdmin: true, superAdmin: true };
  }

  const partner = (await admin.from('partners')
    .select('id,display_name,email,phone,status,user_id')
    .eq('user_id', user.id)
    .maybeSingle()).data;

  if (!partner) {
    if (superAdmin) {
      return { error: { status: 403, body: { ok: false, error: 'not a partner', can_pick: true } } };
    }
    return { error: { status: 403, body: { ok: false, error: 'not a partner' } } };
  }

  const requireActive = opts.requireActive !== false;
  if (requireActive && partner.status !== 'active') {
    return { error: { status: 403, body: { ok: false, error: 'partner account is ' + partner.status } } };
  }

  return { user, partner, asAdmin: false, superAdmin };
}

module.exports = {
  admin,
  getUser,
  isSuper,
  resolvePartnerActor
};
