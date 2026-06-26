// api/billing/plans.js — read and manage hosting plans (the plan builder backend).
//   GET                      -> list plans (all for admins; active-only for others)
//   POST { action:'save', plan } -> create/update a plan (admin only)
//   POST { action:'delete', key } -> remove a plan (admin only)

const { sb, getUser, isAdminEmail, json } = require('./_stripe');

function cleanTiers(t) {
  if (!Array.isArray(t)) return null;
  const rows = t.map((r) => ({ min: Math.max(1, parseInt(r.min, 10) || 1), amount: Math.max(0, parseInt(r.amount, 10) || 0) }))
    .filter((r) => r.min >= 1)
    .sort((a, b) => a.min - b.min);
  return rows.length ? rows : null;
}

module.exports = async (req, res) => {
  const user = await getUser(req);
  if (!user) return json(res, 401, { error: 'unauthorized' });
  const admin = isAdminEmail(user.email);

  if (req.method === 'GET') {
    let q = sb.from('billing_plans').select('*').order('sort', { ascending: true });
    if (!admin) q = q.eq('active', true);
    const { data, error } = await q;
    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, { plans: data || [], admin });
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  if (!admin) return json(res, 403, { error: 'admins only' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  try {
    if (body.action === 'delete') {
      const key = String(body.key || '');
      if (!key) return json(res, 400, { error: 'key required' });
      if (key === 'free') return json(res, 400, { error: 'the Free plan cannot be deleted' });
      const { error } = await sb.from('billing_plans').delete().eq('key', key);
      if (error) return json(res, 500, { error: error.message });
      return json(res, 200, { ok: true });
    }

    // save (upsert)
    const p = body.plan || {};
    const key = String(p.key || '').toLowerCase().replace(/[^a-z0-9_\-]/g, '');
    if (!key) return json(res, 400, { error: 'a plan key is required (letters/numbers)' });
    const isFree = !!p.is_free;
    const row = {
      key,
      name: String(p.name || key),
      description: p.description != null ? String(p.description) : null,
      features: p.features != null ? String(p.features) : null,
      is_free: isFree,
      monthly_amount: isFree ? 0 : Math.max(0, parseInt(p.monthly_amount, 10) || 0),
      setup_amount: isFree ? 0 : Math.max(0, parseInt(p.setup_amount, 10) || 0),
      currency: (p.currency || 'aud').toLowerCase(),
      stripe_price_id: isFree ? null : (p.stripe_price_id || null),
      stripe_setup_price_id: isFree ? null : (p.stripe_setup_price_id || null),
      volume_tiers: isFree ? null : cleanTiers(p.volume_tiers),
      sort: parseInt(p.sort, 10) || 0,
      active: p.active !== false,
    };
    const { error } = await sb.from('billing_plans').upsert(row, { onConflict: 'key' });
    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, { ok: true, plan: row });
  } catch (e) {
    return json(res, 500, { error: String(e.message || e) });
  }
};
