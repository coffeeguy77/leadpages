// api/billing/admin.js — per-site billing actions for admins.
//   POST { action, siteId, ... }
//     protect   { on }            -> never auto-flag/delete this site (account protection)
//     extend    { days } | { until } -> push the auto-delete date out
//     unsuspend                   -> manual override back to active (use sparingly)
//     system    { on }            -> mark as a "system" site (suspended-page variant)

const { sb, getUser, isAdminEmail, json } = require('./_stripe');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const user = await getUser(req);
  if (!user) return json(res, 401, { error: 'unauthorized' });
  if (!isAdminEmail(user.email)) return json(res, 403, { error: 'admins only' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const action = body.action, siteId = body.siteId;
  if (!action || !siteId) return json(res, 400, { error: 'action and siteId required' });

  try {
    let patch = null;
    if (action === 'protect') {
      patch = { delete_protected: !!body.on };
      if (body.on) patch.delete_flagged_at = null; // protecting clears a pending flag
    } else if (action === 'extend') {
      let until = null;
      if (body.until) until = new Date(body.until).toISOString();
      else { const d = parseInt(body.days, 10) || 90; until = new Date(Date.now() + d * 864e5).toISOString(); }
      patch = { delete_extend_until: until, delete_flagged_at: null };
    } else if (action === 'unsuspend') {
      patch = { billing_status: 'active', suspended_at: null, delete_flagged_at: null };
    } else if (action === 'system') {
      patch = { is_system: !!body.on };
    } else {
      return json(res, 400, { error: 'unknown action' });
    }

    const { error } = await sb.from('sites').update(patch).eq('id', siteId);
    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, { ok: true, patch });
  } catch (e) {
    return json(res, 500, { error: String(e.message || e) });
  }
};
