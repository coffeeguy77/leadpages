// api/cloudinary/delete.js — Vercel serverless function (CommonJS)
// Deletes a single asset ({ publicId }) or an entire prefix ({ prefix }) via the Cloudinary
// Admin API. Used for overwrite cleanup, section/item removal, and full site teardown.
// Requires a valid Supabase session; all targets are hard-scoped to leadpages/.

async function verifyAuth(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  try {
    const r = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
    });
    return r.ok;
  } catch (e) {
    return false;
  }
}

// Resolve key / secret / cloud from CLOUDINARY_URL or the separate vars, tolerant of a
// connection string pasted into the wrong variable (mirrors api/cloudinary/sign.js).
function resolveCreds() {
  const url = (process.env.CLOUDINARY_URL || '').trim();
  const m = url.match(/cloudinary:\/\/([^:\s]+):([^@\s]+)@([^/\s]+)/i);
  if (m && !/[<>]/.test(m[1]) && !/[<>]/.test(m[2])) {
    return { key: decodeURIComponent(m[1]), secret: decodeURIComponent(m[2]), cloud: m[3].replace(/[^a-zA-Z0-9_\-]/g, '') || 'dzx6x1hou' };
  }
  let key = (process.env.CLOUDINARY_API_KEY || '').trim();
  let secret = (process.env.CLOUDINARY_API_SECRET || '').trim();
  let cloud = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  if (/cloudinary:\/\//.test(cloud)) {
    const mm = cloud.match(/cloudinary:\/\/([^:\s]+):([^@\s]+)@([^/\s]+)/i);
    if (mm) { if (!key && !/[<>]/.test(mm[1])) key = decodeURIComponent(mm[1]); if (!secret && !/[<>]/.test(mm[2])) secret = decodeURIComponent(mm[2]); cloud = mm[3]; }
  }
  if (cloud.indexOf('@') >= 0) cloud = cloud.split('@').pop();
  cloud = cloud.replace(/[^a-zA-Z0-9_\-]/g, '') || 'dzx6x1hou';
  return { key, secret, cloud };
}

function cloud() { return resolveCreds().cloud; }
function basic() {
  const c = resolveCreds();
  return 'Basic ' + Buffer.from(c.key + ':' + c.secret).toString('base64');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!(await verifyAuth(req))) return res.status(401).json({ error: 'unauthorized' });
  { const _c = resolveCreds(); if (!_c.key || !_c.secret) return res.status(500).json({ error: 'Cloudinary credentials are not configured.' }); }

  const body = req.body || {};
  const base = 'https://api.cloudinary.com/v1_1/' + cloud() + '/resources/image/upload';

  try {
    if (body.prefix) {
      const prefix = String(body.prefix);
      if (!/^leadpages\//.test(prefix)) return res.status(400).json({ error: 'prefix must be under leadpages/' });

      // Cloudinary deletes by prefix in batches (~100/call) and sets partial:true when
      // more remain. Each repeat clears the next batch, so loop until partial is false.
      // MAX_CALLS caps the work so we never blow the function timeout on a runaway prefix
      // (the common case — a normal site — finishes in a single call).
      const MAX_CALLS = 30;
      let deletedCount = 0, calls = 0, partial = true, ok = true, last = {};
      while (partial && calls < MAX_CALLS) {
        calls++;
        const r = await fetch(base + '?prefix=' + encodeURIComponent(prefix) + '&invalidate=true', {
          method: 'DELETE', headers: { Authorization: basic() },
        });
        ok = r.ok;
        last = await r.json().catch(() => ({}));
        if (!r.ok) break;
        const batch = last.deleted ? Object.keys(last.deleted).length : 0;
        deletedCount += batch;
        partial = last.partial === true;
        if (partial && batch === 0) break; // no progress guard — avoid an infinite loop
      }

      // Best-effort: remove the now-empty folder tree.
      try {
        await fetch('https://api.cloudinary.com/v1_1/' + cloud() + '/folders/' + prefix.replace(/\/+$/, ''), {
          method: 'DELETE', headers: { Authorization: basic() },
        });
      } catch (e) { /* non-fatal */ }

      // partial:true here means we hit MAX_CALLS — caller can re-issue to finish the rest.
      return res.status(ok ? 200 : 502).json({ ok, prefix, deletedCount, calls, partial, result: last });
    }

    if (body.publicId) {
      const pid = String(body.publicId);
      if (!/^leadpages\//.test(pid)) return res.status(400).json({ error: 'publicId must be under leadpages/' });
      const r = await fetch(base + '?public_ids[]=' + encodeURIComponent(pid) + '&invalidate=true', {
        method: 'DELETE', headers: { Authorization: basic() },
      });
      const j = await r.json().catch(() => ({}));
      return res.status(r.ok ? 200 : 502).json({ ok: r.ok, result: j });
    }

    return res.status(400).json({ error: 'provide publicId or prefix' });
  } catch (e) {
    return res.status(500).json({ error: String(e.message) });
  }
};
