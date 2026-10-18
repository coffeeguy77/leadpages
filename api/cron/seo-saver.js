// api/cron/seo-saver.js — daily SEO Saver monitor (phase 3). For every live site with SEO Saver:
// picks up old addresses visitors / Google asked for, matches them to the new pages, auto-adds
// the sure ones (seoSaver.autoMin, default 90%; off with seoSaver.autoAdd = false), checks the
// redirects (broken targets, chains, a rotating live spot-check) and stores a summary the editor
// shows. Never removes or changes an existing redirect. Free: no paid API calls.
// Secured with CRON_SECRET (same as the other crons). ?site=<uuid> runs one site.

const srv = require('../../lib/seo-saver-server');

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
  const started = Date.now();
  const deadline = started + 50000;
  const admin = srv.adminClient();
  const out = { ok: true, sites: 0, autoAdded: 0, skipped: 0, errors: [] };
  let only = '';
  try { only = new URL(req.url, 'http://x').searchParams.get('site') || ''; } catch (e) { /* ignore */ }
  let q = admin.from('sites').select('id, slug, status, custom_domain, config, updated_at').eq('status', 'live').not('config->seoSaver', 'is', null);
  if (/^[0-9a-f-]{36}$/i.test(only)) q = q.eq('id', only);
  const { data: sites, error } = await q.limit(500);
  if (error) return json(res, 500, { ok: false, error: error.message });
  // oldest monitor run first, so a slow day still reaches every site in turn
  const { data: runs } = await admin.from('seo_saver_runs').select('site_id, ran_at').eq('kind', 'monitor').order('ran_at', { ascending: false }).limit(2000);
  const last = {};
  (runs || []).forEach(function (r) { if (!last[r.site_id]) last[r.site_id] = r.ran_at; });
  const list = (sites || []).filter(function (s) { return s.config && s.config.seoSaver && s.config.seoSaver.on !== false; })
    .sort(function (a, b) { return String(last[a.id] || '') < String(last[b.id] || '') ? -1 : 1; });
  for (const site of list) {
    if (Date.now() > deadline) { out.skipped++; continue; }
    try {
      const s = await srv.runMonitor(admin, site, null, { deadline: deadline });
      out.sites++; out.autoAdded += s.autoAdded.length;
    } catch (e) {
      out.errors.push(site.slug + ': ' + ((e && e.message) || e));
    }
  }
  out.ms = Date.now() - started;
  return json(res, 200, out);
};
