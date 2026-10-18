// api/cron/lead-files-cleanup.js — daily: delete lead files older than the retention period
// (90 days) and uploads never attached to a lead (24 hours), then mark those leads
// "files expired". Removal goes through the Storage API so the files themselves are
// deleted, not just their rows. Secured with CRON_SECRET (same as the other crons).

const { createClient } = require('@supabase/supabase-js');
const LF = require('../../lib/lead-files');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(obj));
}

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  let key = auth;
  try {
    if (!key) key = new URL(req.url, 'http://x').searchParams.get('key') || '';
  } catch (e) { /* ignore */ }
  return key === secret;
}

module.exports = async (req, res) => {
  if (!authorized(req)) return json(res, 401, { ok: false, error: 'unauthorized' });
  const out = { ok: true, removed: 0, expired: 0, orphans: 0, leadsMarked: 0, errors: [] };
  try {
    for (let round = 0; round < 5; round++) {
      const due = await admin.rpc('lead_files_due', {
        p_keep_days: LF.LIMITS.keepDays,
        p_orphan_hours: LF.LIMITS.orphanHours,
        p_limit: 200
      });
      if (due.error) { out.ok = false; out.errors.push(due.error.message); break; }
      const rows = Array.isArray(due.data) ? due.data : [];
      if (!rows.length) break;
      const names = rows.map(function (r) { return r.name; });
      const rm = await admin.storage.from(LF.BUCKET).remove(names);
      if (rm.error) { out.ok = false; out.errors.push(rm.error.message); break; }
      out.removed += names.length;
      rows.forEach(function (r) { if (r.reason === 'expired') out.expired++; else out.orphans++; });
      const mk = await admin.rpc('lead_files_mark_expired', { p_paths: names });
      if (mk.error) out.errors.push(mk.error.message);
      else out.leadsMarked += Number(mk.data) || 0;
      if (rows.length < 200) break;
    }
  } catch (e) {
    out.ok = false;
    out.errors.push((e && e.message) || 'failed');
  }
  return json(res, out.ok ? 200 : 500, out);
};
