// api/partner/quote-view.js — PUBLIC. Records when a client opens /quote?t=...
// Partner previews use ?pv=1 and should not call this endpoint.

const { createClient } = require('@supabase/supabase-js');
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'string') {
        try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); }
      }
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  const b = await readBody(req);
  const token = String((b && b.token) || (req.query && req.query.t) || '').trim();
  if (!token) return res.status(400).json({ ok: false, error: 'Missing quote token.' });

  const q = (await admin.from('partner_quotes').select('id,status,client_viewed_at,client_view_count').eq('token', token).maybeSingle()).data;
  if (!q) return res.status(404).json({ ok: false, error: 'Quote not found.' });
  if (q.status === 'paid') return res.status(200).json({ ok: true, tracked: false });

  const now = new Date().toISOString();
  const patch = {
    client_last_viewed_at: now,
    client_view_count: Math.max(0, Number(q.client_view_count) || 0) + 1,
    updated_at: now,
  };
  if (!q.client_viewed_at) patch.client_viewed_at = now;

  const upd = await admin.from('partner_quotes').update(patch).eq('id', q.id);
  if (upd.error) {
    // Graceful if migration not applied yet
    return res.status(200).json({ ok: true, tracked: false, skipped: true });
  }

  return res.status(200).json({
    ok: true,
    tracked: true,
    client_viewed_at: patch.client_viewed_at || q.client_viewed_at,
    client_last_viewed_at: now,
    client_view_count: patch.client_view_count,
  });
};
