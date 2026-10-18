// api/seo-saver/discover.js — SEO Saver phase 2: find the old site's addresses and match them.
//
// POST { siteId, action, ... }   (Bearer JWT; owner / active servicing partner / super-admin)
//   list                         → candidates (with what the live site does now), last runs, settings
//   sitemaps | wayback           → free sources: add what they list
//   google | backlinks           → paid DataForSEO sources (one request each, at most once a day per site)
//   search_console | visits      → addresses Google (synced Search Console data) or real visitors asked for
//   read   { limit }             → read the next unread old pages (old site, or Wayback copy) — call until remaining = 0
//   match                        → (re)compute the best new page + confidence for every candidate
//   status { paths[], status }   → open | applied | dismissed
//   check  { cursor }            → launch check on the live domain, 40 addresses per call
//   check_done { summary }       → store the launch-check result
// Every step finishes well inside the function limit; the editor loops over read / check.
// See docs/features/SEO-Saver.md.

const srv = require('../../lib/seo-saver-server');
const disc = require('../../lib/seo-saver-discover');
const core = require('../../lib/seo-saver');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAID = { google: 'seo_saver_google', backlinks: 'seo_saver_backlinks' };
const DAY = 24 * 3600 * 1000;

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  return res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch (e) { return resolve({}); } }
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 200000) raw = raw.slice(0, 200000); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}
function tableMissing(e) { return /seo_saver_candidates|seo_saver_runs|does not exist|schema cache/i.test(String((e && e.message) || e || '')); }

function oldDomainOf(site, body) {
  const fromBody = disc.cleanDomain(body.domain || '');
  if (fromBody && disc.validDomain(fromBody)) return fromBody;
  const ss = (site.config && site.config.seoSaver) || {};
  const d = disc.cleanDomain(ss.oldDomain || site.custom_domain || '');
  return d && disc.validDomain(d) ? d : '';
}

async function listAll(admin, site) {
  const cfg = site.config || {};
  const { data, error } = await admin.from('seo_saver_candidates')
    .select('path,url,sources,is_page,old_status,old_final,fetched_at,fetch_from,fetch_error,title,h1,description,body,backlinks,referring_domains,clicks,impressions,visits,suggested_to,confidence,reason,alternatives,status,applied_by,first_seen,updated_at')
    .eq('site_id', site.id).limit(srv.MAX_CANDIDATES);
  if (error) throw error;
  return (data || []).map(function (c) {
    const cov = srv.coverage(cfg, c.path);
    c.now = cov.state; c.now_to = cov.to;
    c.snippet = c.body ? String(c.body).slice(0, 220) : '';
    delete c.body;
    return c;
  });
}

async function runsOf(admin, siteId) {
  const { data } = await admin.from('seo_saver_runs').select('kind,ran_at,summary').eq('site_id', siteId).order('ran_at', { ascending: false }).limit(80);
  const last = {};
  (data || []).forEach(function (r) { if (!last[r.kind]) last[r.kind] = r; });
  return last;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method' });
  const user = await srv.requireUser(req);
  if (!user) return send(res, 401, { ok: false, error: 'auth', message: 'Please sign in again.' });
  const body = await readBody(req);
  const siteId = String(body.siteId || '').trim();
  if (!UUID.test(siteId)) return send(res, 400, { ok: false, error: 'siteId' });
  const admin = srv.adminClient();
  const site = await srv.siteForUser(admin, user, siteId);
  if (!site) return send(res, 403, { ok: false, error: 'forbidden', message: 'You can’t change this site’s SEO settings.' });
  const action = String(body.action || 'list');
  const oldDomain = oldDomainOf(site, body);

  try {
    if (action === 'list') {
      const [cands, runs] = await Promise.all([listAll(admin, site), runsOf(admin, site.id)]);
      return send(res, 200, {
        ok: true, tableReady: true, oldDomain: oldDomain, customDomain: site.custom_domain || '',
        dataforseo: require('../../lib/search-intelligence/providers/dataforseo').configured(),
        candidates: cands, runs: runs, problems: srv.ruleProblems(site.config || {})
      });
    }

    if (['sitemaps', 'wayback', 'google', 'backlinks'].indexOf(action) >= 0 && !oldDomain) {
      return send(res, 400, { ok: false, error: 'domain', message: 'Enter the previous website address first (e.g. oldbusiness.com.au).' });
    }

    if (PAID[action]) {
      const prev = await srv.lastRun(admin, site.id, 'discover:' + action);
      if (prev && Date.now() - Date.parse(prev.ran_at) < DAY) {
        return send(res, 429, { ok: false, error: 'once_a_day', message: 'Already run in the last 24 hours (' + ((prev.summary && prev.summary.found) || 0) + ' found). Paid searches run at most once a day per site.' });
      }
    }

    if (['sitemaps', 'wayback', 'google', 'backlinks', 'search_console', 'visits'].indexOf(action) >= 0) {
      let r;
      if (action === 'sitemaps') r = await disc.fromSitemaps(oldDomain);
      else if (action === 'wayback') r = await disc.fromWayback(oldDomain);
      else if (action === 'google') r = await disc.fromGoogle(oldDomain);
      else if (action === 'backlinks') r = await disc.fromBacklinks(oldDomain);
      else if (action === 'search_console') r = await srv.fromSearchConsole(admin, site, oldDomain || site.custom_domain || '');
      else r = await srv.fromVisits(admin, site);
      if (PAID[action] && r && r.error !== 'not_configured') {
        // a request was made (even if it found nothing): it costs, so meter it
        try { await require('../../lib/search-intelligence/usage').meterUsage(admin, site.id, PAID[action], 1, { provider: 'dataforseo', domain: oldDomain }); } catch (e) { /* ignore */ }
      }
      if (!r || !r.ok) {
        if (PAID[action] && r && r.error !== 'not_configured') await srv.logRun(admin, site.id, 'discover:' + action, { found: 0, error: r && r.message });
        return send(res, 200, { ok: false, error: (r && r.error) || action, message: (r && r.message) || 'That source didn’t answer.' });
      }
      const saved = await srv.saveCandidates(admin, site.id, r.candidates || []);
      await srv.logRun(admin, site.id, 'discover:' + action, { found: (r.candidates || []).length, added: saved.added, skipped: saved.skipped, domain: oldDomain });
      return send(res, 200, { ok: true, found: (r.candidates || []).length, added: saved.added, updated: saved.updated, skipped: saved.skipped, message: r.message || '' });
    }

    if (action === 'read') {
      if (!oldDomain) return send(res, 400, { ok: false, error: 'domain', message: 'Enter the previous website address first.' });
      const limit = Math.max(1, Math.min(16, Number(body.limit) || 10));
      const { data: todo, error } = await admin.from('seo_saver_candidates').select('path,url,is_page,archive_ts,sources')
        .eq('site_id', site.id).is('fetched_at', null).eq('is_page', true).neq('status', 'dismissed').limit(limit);
      if (error) throw error;
      const archiveOnly = body.archiveOnly === true || (body.archiveOnly !== false && await disc.isOnLeadPages(oldDomain));
      const started = Date.now();
      const links = []; const updates = [];
      const queue = (todo || []).slice();
      await Promise.all([0, 1, 2, 3].map(async function () {
        while (queue.length && Date.now() - started < 40000) {
          const c = queue.shift();
          const r = await disc.readPage(oldDomain, c, { archiveOnly: archiveOnly });
          updates.push(Object.assign({ path: c.path, sources: c.sources }, r.fields));
          r.links.forEach(function (l) { links.push(l); });
        }
      }));
      // content read now replaces nothing a person typed: these rows had no content yet
      await srv.saveCandidates(admin, site.id, updates, { overwriteContent: true });
      // links found on old pages: add them (stops at the per-site cap)
      const crawlAdded = links.length ? (await srv.saveCandidates(admin, site.id, links)).added : 0;
      const { count } = await admin.from('seo_saver_candidates').select('path', { count: 'exact', head: true })
        .eq('site_id', site.id).is('fetched_at', null).eq('is_page', true).neq('status', 'dismissed');
      return send(res, 200, { ok: true, read: updates.length, readOk: updates.filter(function (u) { return !u.fetch_error; }).length, found: crawlAdded, remaining: count || 0, archiveOnly: archiveOnly });
    }

    if (action === 'match') {
      const n = await srv.matchCandidates(admin, site);
      await srv.logRun(admin, site.id, 'discover:match', { matched: n });
      return send(res, 200, { ok: true, matched: n });
    }

    if (action === 'status') {
      const paths = (Array.isArray(body.paths) ? body.paths : []).map(String).filter(Boolean).slice(0, 1000);
      const status = ['open', 'applied', 'dismissed'].indexOf(body.status) >= 0 ? body.status : null;
      if (!paths.length || !status) return send(res, 400, { ok: false, error: 'status' });
      for (let i = 0; i < paths.length; i += 150) {
        const { error } = await admin.from('seo_saver_candidates').update({ status: status, applied_by: status === 'applied' ? 'editor' : null, updated_at: new Date().toISOString() })
          .eq('site_id', site.id).in('path', paths.slice(i, i + 150));
        if (error) throw error;
      }
      return send(res, 200, { ok: true, updated: paths.length });
    }

    if (action === 'check') {
      const domain = disc.cleanDomain(site.custom_domain || '');
      if (!domain) return send(res, 200, { ok: false, error: 'no_domain', message: 'This site has no domain of its own yet — the live check runs once the domain points at LeadPages. The check below the list shows what will happen.' });
      if (!(await disc.isOnLeadPages(domain))) return send(res, 200, { ok: false, error: 'not_switched', message: domain + ' still points at the old website, so there is nothing live to check yet. Run this right after switching the domain.' });
      const cfg = site.config || {};
      const rules = ((cfg.seoSaver && cfg.seoSaver.redirects) || []).filter(function (r) { return r && r.on !== false && r.from && !/\*$/.test(String(r.from)); });
      const { data: cands } = await admin.from('seo_saver_candidates').select('path,url').eq('site_id', site.id).neq('status', 'dismissed').limit(srv.MAX_CANDIDATES);
      const set = new Set();
      rules.forEach(function (r) { set.add(core.ruleKey(r.from)); });
      (cands || []).forEach(function (c) { set.add(c.path); });
      const all = Array.from(set).sort();
      // test the host the old links used (www or not) — a www→bare hop first would be a second hop
      const hosts = {}; (cands || []).forEach(function (c) { try { const h = new URL(c.url).hostname; hosts[h] = (hosts[h] || 0) + 1; } catch (e) { /* ignore */ } });
      const host = Object.keys(hosts).sort(function (a, b) { return hosts[b] - hosts[a]; })[0] || ('www.' + domain);
      const cursor = Math.max(0, Number(body.cursor) || 0);
      const batch = all.slice(cursor, cursor + 40);
      const results = await srv.liveCheck(domain, batch, null, { host: disc.hostsFor(domain).has(host) ? host : 'www.' + domain });
      return send(res, 200, { ok: true, total: all.length, next: cursor + batch.length < all.length ? cursor + batch.length : null, host: host, results: results });
    }

    if (action === 'check_done') {
      const s = body.summary && typeof body.summary === 'object' ? body.summary : {};
      await srv.logRun(admin, site.id, 'launch_check', {
        total: Number(s.total) || 0, ok: Number(s.ok) || 0,
        problems: (Array.isArray(s.problems) ? s.problems : []).slice(0, 200).map(function (p) { return { path: String(p.path || '').slice(0, 500), problem: String(p.problem || '').slice(0, 300) }; })
      });
      return send(res, 200, { ok: true });
    }

    return send(res, 400, { ok: false, error: 'action' });
  } catch (e) {
    if (tableMissing(e)) return send(res, 200, { ok: false, tableReady: false, error: 'table', message: 'The SEO Saver discovery database update isn’t installed yet (db/seo_saver_phase2.sql).' });
    console.error('seo-saver discover:', action, e && e.message);
    return send(res, 500, { ok: false, error: 'server', message: 'Something went wrong: ' + String((e && e.message) || e) });
  }
};
