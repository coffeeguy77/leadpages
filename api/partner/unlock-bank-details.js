// POST /api/partner/unlock-bank-details
// Super admin only — unlocks partner bank details so they can be re-entered after verification.

const { createClient } = require('@supabase/supabase-js');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getSuperAdmin(token) {
  if (!token) return null;
  try {
    const ur = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
    });
    const user = await ur.json();
    if (!user || !user.id) return null;
    const { data: prof } = await admin
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .maybeSingle();
    if (!prof || !prof.is_super_admin) return null;
    return { userId: user.id };
  } catch (_e) {
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const actor = await getSuperAdmin(token);
  if (!actor) return res.status(403).json({ ok: false, error: 'Super admin only' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_e) { body = {}; }
  }
  body = body || {};

  const partnerId = String(body.partnerId || '').trim();
  if (!partnerId) return res.status(400).json({ ok: false, error: 'partnerId is required.' });

  try {
    const patch = {
      bank_details_locked: false,
      bank_details_locked_at: null,
      updated_at: new Date().toISOString(),
    };

    const upd = await admin
      .from('partner_profiles')
      .update(patch)
      .eq('partner_id', partnerId)
      .select('partner_id,bank_details_locked,bank_details_locked_at')
      .maybeSingle();

    if (upd.error && /bank_/i.test(upd.error.message || '')) {
      return res.status(503).json({
        ok: false,
        error: 'Bank details storage is not set up yet. Run db/partner_bank_details.sql in Supabase.',
      });
    }

    if (upd.error) {
      return res.status(500).json({ ok: false, error: upd.error.message });
    }

    if (!upd.data) {
      return res.status(404).json({ ok: false, error: 'Partner profile not found.' });
    }

    try {
      await admin.from('partner_audit_logs').insert({
        actor_id: actor.userId,
        action: 'bank_details_unlocked',
        partner_id: partnerId,
        detail: { unlocked_at: new Date().toISOString() },
      });
    } catch (_e) { /* audit optional */ }

    return res.status(200).json({ ok: true, profile: upd.data, unlocked: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
