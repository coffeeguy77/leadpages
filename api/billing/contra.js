// api/billing/contra.js — contra accounts + two-direction ledger.
//
//   GET                  -> the caller's own contra account + ledger
//   GET ?siteId= / ?ownerId=   -> a client's account (admins only; clients always get their own)
//        returns { owner, account, entries[], totals:{credit,debit}, balance, currency }
//        balance = credits - debits (cents). negative = client owes you; positive = client in credit.
//
//   POST (admins only) { action, siteId|ownerId, ... }
//        action 'entry'        -> { direction:'credit'|'debit', amount_cents, kind, description, ref }
//        action 'account'      -> { enabled, mode:'mutual'|'prepaid', description, arrangement }
//        action 'delete-entry' -> { id }
//
// Both client and admin can READ; only admins can WRITE. Off-Stripe manual ledger.

const { sb, getUser, isAdminEmail, json } = require('./_stripe');

async function resolveOwner(user, admin, siteId, ownerId) {
  if (admin) {
    if (ownerId) return ownerId;
    if (siteId) {
      const { data: st } = await sb.from('sites').select('owner_user_id').eq('id', siteId).maybeSingle();
      return st && st.owner_user_id ? st.owner_user_id : null;
    }
  }
  return user.id; // non-admins always scoped to themselves
}

async function loadAccount(ownerId) {
  const { data: account } = await sb.from('contra_accounts')
    .select('owner_user_id,enabled,mode,description,arrangement,currency,updated_at')
    .eq('owner_user_id', ownerId).maybeSingle();
  const { data: entries } = await sb.from('contra_ledger')
    .select('id,direction,amount_cents,kind,description,ref,created_at,created_by')
    .eq('owner_user_id', ownerId).order('created_at', { ascending: false });
  let credit = 0, debit = 0;
  (entries || []).forEach((e) => { if (e.direction === 'credit') credit += (e.amount_cents || 0); else debit += (e.amount_cents || 0); });
  return {
    owner: ownerId,
    account: account || null,
    entries: entries || [],
    totals: { credit, debit },
    balance: credit - debit,
    currency: (account && account.currency) || 'aud',
  };
}

module.exports = async (req, res) => {
  const user = await getUser(req);
  if (!user) return json(res, 401, { error: 'unauthorized' });
  const admin = isAdminEmail(user.email);

  if (req.method === 'GET') {
    let siteId = null, ownerId = null;
    try { const u = new URL(req.url, 'http://x'); siteId = u.searchParams.get('siteId'); ownerId = u.searchParams.get('ownerId'); } catch (e) {}
    const owner = await resolveOwner(user, admin, siteId, ownerId);
    if (!owner) return json(res, 404, { error: 'no owner for that site' });
    try { return json(res, 200, await loadAccount(owner)); }
    catch (e) { return json(res, 500, { error: String(e.message || e) }); }
  }

  if (req.method === 'POST') {
    if (!admin) return json(res, 403, { error: 'only the team can edit contra accounts' });
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};
    const action = body.action;

    try {
      if (action === 'delete-entry') {
        const id = body.id;
        if (!id) return json(res, 400, { error: 'id required' });
        await sb.from('contra_ledger').delete().eq('id', id);
        return json(res, 200, { ok: true });
      }

      const owner = await resolveOwner(user, admin, body.siteId, body.ownerId);
      if (!owner) return json(res, 404, { error: 'no owner for that site — the client needs a login before a contra account can exist' });

      if (action === 'entry') {
        const direction = body.direction === 'debit' ? 'debit' : 'credit';
        const amount = Math.round(Number(body.amount_cents || 0));
        if (!(amount > 0)) return json(res, 400, { error: 'amount must be greater than zero' });
        // ensure an account row exists
        await sb.from('contra_accounts').upsert(
          { owner_user_id: owner, updated_at: new Date().toISOString() },
          { onConflict: 'owner_user_id', ignoreDuplicates: true }
        );
        const { error } = await sb.from('contra_ledger').insert({
          owner_user_id: owner, direction, amount_cents: amount,
          kind: (body.kind || '').slice(0, 60) || null,
          description: (body.description || '').slice(0, 400) || null,
          ref: (body.ref || '').slice(0, 120) || null,
          created_by: user.email || null,
        });
        if (error) return json(res, 500, { error: error.message });
        return json(res, 200, await loadAccount(owner));
      }

      if (action === 'account') {
        const row = {
          owner_user_id: owner,
          enabled: body.enabled !== false,
          mode: body.mode === 'prepaid' ? 'prepaid' : 'mutual',
          description: (body.description || '').slice(0, 400) || null,
          arrangement: (body.arrangement || '').slice(0, 4000) || null,
          updated_at: new Date().toISOString(),
        };
        const { error } = await sb.from('contra_accounts').upsert(row, { onConflict: 'owner_user_id' });
        if (error) return json(res, 500, { error: error.message });
        return json(res, 200, await loadAccount(owner));
      }

      return json(res, 400, { error: 'unknown action' });
    } catch (e) {
      return json(res, 500, { error: String(e.message || e) });
    }
  }

  return json(res, 405, { error: 'GET or POST only' });
};
