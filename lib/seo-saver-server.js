/**
 * SEO Saver — server helpers shared by api/seo-saver/discover.js and api/cron/seo-saver.js.
 *
 *   coverage(cfg, path)                 what the live site does with an old address right now
 *   saveCandidates(admin, siteId, rows) upsert discovered addresses (sources merged, content kept)
 *   matchCandidates(admin, site, opts)  (re)compute the suggested new page + confidence
 *   addRules(admin, site, rules)        append redirects to sites.config.seoSaver safely + purge CDN
 *   ruleProblems(cfg)                   broken targets, chains, self-redirects, duplicates
 *   liveCheck(domain, paths)            real requests: one hop to a page that answers 200?
 *   logRun / lastRuns                   seo_saver_runs
 */
'use strict';
const core = require('./seo-saver');
const match = require('./seo-saver-match');
const discover = require('./seo-saver-discover');

const MAX_CANDIDATES = 3000;
const CONTENT_FIELDS = ['url', 'is_page', 'archive_ts', 'old_status', 'old_final', 'fetched_at', 'fetch_from', 'fetch_error', 'title', 'h1', 'description', 'body'];
const NUM_FIELDS = ['backlinks', 'referring_domains', 'clicks', 'impressions', 'visits'];

function publishedPages(cfg) {
  return (Array.isArray(cfg && cfg.pages) ? cfg.pages : []).filter(function (p) { return p && p.slug && p.status === 'published'; });
}
function liveSet(cfg) {
  const s = new Set(['/']);
  publishedPages(cfg).forEach(function (p) { s.add('/' + String(p.slug).toLowerCase()); });
  return s;
}

/** What the live site does with this old address now: { state, to }. state: live | redirect | gone | fallback | not_found | off */
function coverage(cfg, path) {
  const live = liveSet(cfg);
  const p = String(path || '/');
  const bare = p.split('?')[0];
  const q = p.indexOf('?') >= 0 ? p.slice(p.indexOf('?') + 1) : '';
  if (!q && live.has(bare)) return { state: 'live', to: bare };
  if (!cfg || !cfg.seoSaver || cfg.seoSaver.on === false) return { state: 'off', to: null };
  const d = core.resolve({
    cfg: cfg, reqPath: bare, query: q, base: '',
    pages: publishedPages(cfg).map(function (x) { return { slug: x.slug, title: x.title || '' }; }),
    isLivePath: function (x) { return live.has(x); }
  });
  if (!d) return { state: 'off', to: null };
  if (d.action === 'gone') return { state: 'gone', to: null };
  if (d.action === 'notFound') return { state: 'not_found', to: null };
  return { state: d.kind === 'fallback' ? 'fallback' : 'redirect', to: d.target };
}

async function existingRows(admin, siteId, paths) {
  const out = new Map();
  for (let i = 0; i < paths.length; i += 150) {
    const chunk = paths.slice(i, i + 150);
    const { data, error } = await admin.from('seo_saver_candidates').select('*').eq('site_id', siteId).in('path', chunk);
    if (error) throw new Error(error.message);
    (data || []).forEach(function (r) { out.set(r.path, r); });
  }
  return out;
}

async function countCandidates(admin, siteId) {
  const { count, error } = await admin.from('seo_saver_candidates').select('path', { count: 'exact', head: true }).eq('site_id', siteId);
  if (error) throw new Error(error.message);
  return count || 0;
}

/**
 * Upsert discovered rows. Sources are unioned; content already read is kept unless the new row
 * brings content and the old one has none; numbers keep the larger value. New rows stop at
 * MAX_CANDIDATES per site. Returns { added, updated, skipped }.
 */
async function saveCandidates(admin, siteId, rows, opts) {
  opts = opts || {};
  const list = discover.merge(rows || []).filter(function (r) { return r && r.path && String(r.path).length <= 500; });
  if (!list.length) return { added: 0, updated: 0, skipped: 0 };
  const have = await existingRows(admin, siteId, list.map(function (r) { return r.path; }));
  let room = MAX_CANDIDATES - (await countCandidates(admin, siteId));
  const now = new Date().toISOString();
  const up = []; let added = 0, updated = 0, skipped = 0;
  list.forEach(function (r) {
    const prev = have.get(r.path);
    if (!prev) {
      if (room <= 0) { skipped++; return; }
      room--; added++;
      const row = { site_id: siteId, path: r.path, sources: r.sources || [], status: 'open', updated_at: now };
      CONTENT_FIELDS.concat(NUM_FIELDS).forEach(function (k) { if (r[k] !== undefined) row[k] = r[k]; });
      up.push(row); return;
    }
    const row = Object.assign({}, prev);
    const src = new Set(prev.sources || []); (r.sources || []).forEach(function (s) { src.add(s); });
    row.sources = Array.from(src);
    CONTENT_FIELDS.forEach(function (k) {
      if (r[k] === undefined) return;
      if (opts.overwriteContent || prev[k] == null || prev[k] === '') row[k] = r[k];
    });
    NUM_FIELDS.forEach(function (k) { if (r[k] != null) row[k] = Math.max(Number(prev[k]) || 0, Number(r[k]) || 0); });
    row.updated_at = now;
    updated++; up.push(row);
  });
  for (let i = 0; i < up.length; i += 300) {
    const { error } = await admin.from('seo_saver_candidates').upsert(up.slice(i, i + 300), { onConflict: 'site_id,path' });
    if (error) throw new Error(error.message);
  }
  return { added: added, updated: updated, skipped: skipped };
}

/** Recompute suggestions for a site's open candidates (or only `paths`). Returns the number matched. */
async function matchCandidates(admin, site, opts) {
  opts = opts || {};
  const cfg = site.config || {};
  const idx = match.buildIndex(cfg);
  let q = admin.from('seo_saver_candidates').select('site_id,path,is_page,title,h1,description,body,old_final,status').eq('site_id', site.id).neq('status', 'dismissed');
  if (opts.paths) q = q.in('path', opts.paths.slice(0, 500));
  const { data, error } = await q.limit(MAX_CANDIDATES);
  if (error) throw new Error(error.message);
  const now = new Date().toISOString();
  const up = (data || []).map(function (c) {
    const m = match.matchCandidate(c, idx);
    return { site_id: site.id, path: c.path, suggested_to: m.to, confidence: m.confidence, reason: m.reason, alternatives: m.alternatives || [], updated_at: now };
  });
  for (let i = 0; i < up.length; i += 300) {
    // update only the match columns (upsert would need every not-null column)
    const chunk = up.slice(i, i + 300);
    await Promise.all(chunk.map(function (u) {
      return admin.from('seo_saver_candidates').update({ suggested_to: u.suggested_to, confidence: u.confidence, reason: u.reason, alternatives: u.alternatives, updated_at: u.updated_at })
        .eq('site_id', u.site_id).eq('path', u.path);
    }));
  }
  return up.length;
}

/**
 * Append redirects to sites.config.seoSaver.redirects without touching anything else.
 * Optimistic: only writes if updated_at is unchanged since the read (else retries twice).
 * Skips rules whose old address already has a rule. Purges the site's CDN cache.
 * Returns { ok, added:[from…], skipped }.
 */
async function addRules(admin, siteId, rules, opts) {
  opts = opts || {};
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: site, error } = await admin.from('sites').select('id,slug,config,updated_at').eq('id', siteId).maybeSingle();
    if (error || !site) return { ok: false, error: (error && error.message) || 'site_not_found' };
    const cfg = site.config || {};
    const ss = cfg.seoSaver && typeof cfg.seoSaver === 'object' ? cfg.seoSaver : { on: true, notFound: 'smart', redirects: [] };
    const list = Array.isArray(ss.redirects) ? ss.redirects.slice() : [];
    const keys = new Set(list.map(function (r) { return r && core.ruleKey(r.from); }));
    const added = [];
    rules.forEach(function (r) {
      const k = core.ruleKey(r.from);
      if (!r.from || keys.has(k)) return;
      keys.add(k);
      list.push(Object.assign({ on: true, code: 301 }, r));
      added.push(r.from);
    });
    if (!added.length) return { ok: true, added: [], skipped: rules.length };
    core.withIds(list);
    const next = Object.assign({}, cfg, { seoSaver: Object.assign({}, ss, { redirects: list }) });
    // updated_at has no trigger: set it so an open editor sees the change and merges it in
    let upd = admin.from('sites').update({ config: next, updated_at: new Date().toISOString() }).eq('id', siteId);
    upd = site.updated_at ? upd.eq('updated_at', site.updated_at) : upd;
    const { data: done, error: e2 } = await upd.select('id');
    if (e2) return { ok: false, error: e2.message };
    if (done && done.length) {
      await purge(site).catch(function () {});
      return { ok: true, added: added, skipped: rules.length - added.length };
    }
    // someone saved in between — read again and retry
  }
  return { ok: false, error: 'busy', message: 'The site was being saved at the same time; try again.' };
}

async function purge(site) {
  let vercel;
  try { vercel = require('../api/vercel/_client'); } catch (e) { return; }
  if (!vercel.projectConfigured()) return;
  const tags = [vercel.cacheTagForSlug(site.slug), vercel.cacheTagForSiteId(site.id)].filter(Boolean);
  await vercel.invalidateByTags(tags, 'production');
}

/** Problems in the rule list: { index, from, problem }[] (same checks as the editor). */
function ruleProblems(cfg) {
  const rules = (cfg && cfg.seoSaver && Array.isArray(cfg.seoSaver.redirects)) ? cfg.seoSaver.redirects : [];
  const live = liveSet(cfg), seen = {}, out = [];
  const shopLive = function (p) { return live.has(p); };
  rules.forEach(function (r, i) {
    if (!r || r.on === false) return;
    const k = core.ruleKey(r.from);
    if (seen[k] != null) { out.push({ index: i, from: r.from, problem: 'duplicate', message: 'Same old address as another redirect — only the first is used' }); return; }
    seen[k] = i;
    if (Number(r.code) === 410) return;
    const to = String(r.to || '').split(/[?#]/)[0];
    if (!to) { out.push({ index: i, from: r.from, problem: 'empty', message: 'No new page set' }); return; }
    if (/^https?:/i.test(to) || /^\/(assets|api)\//i.test(to) || /\*$/.test(r.to || '')) return;
    const nTo = core.normalizePath(to);
    if (nTo === core.normalizePath(String(r.from || '').replace(/^[a-z]+:\/\/[^/]+/i, '')) && !/\*$/.test(r.from)) { out.push({ index: i, from: r.from, problem: 'self', message: 'Points to itself' }); return; }
    if (!shopLive(nTo)) {
      const others = rules.filter(function (x, j) { return j !== i; });
      const hop = core.matchRule(core.compile({ seoSaver: { redirects: others } }), nTo, '');
      out.push(hop
        ? { index: i, from: r.from, problem: 'chain', message: to + ' redirects again to ' + hop.to + ' — point straight there', fix: hop.to }
        : { index: i, from: r.from, problem: 'target', message: 'New page ' + to + ' isn’t a published page' });
    }
  });
  return out;
}

/**
 * Real requests to the live domain: each old path should answer 301/308 once, and the new
 * address should answer 200. Returns [{ path, ok, status, location, finalStatus, problem }].
 */
async function liveCheck(domain, paths, deps, opts) {
  opts = opts || {};
  const d = discover.cleanDomain(domain), hosts = discover.hostsFor(d);
  const allow = function (h) { return hosts.has(h); };
  const out = [];
  const queue = paths.slice();
  async function one(p) {
    const url = 'https://' + (opts.host || ('www.' + d)) + p;
    const r = await discover.safeFetch(url, { allow: allow, follow: false, body: false, timeout: 8000 }, deps);
    const row = { path: p, status: r.status, location: r.location || null, finalStatus: null, ok: false, problem: '' };
    if (!r.status) { row.problem = 'No answer (' + (r.error || 'network') + ')'; return row; }
    if (r.status === 410) { row.ok = true; row.problem = ''; row.gone = true; return row; }
    if (r.status >= 200 && r.status < 300) { row.ok = true; row.live = true; return row; }
    if (!r.redirect) { row.problem = r.status === 404 ? 'Not found (404)' : 'Answered ' + r.status; return row; }
    if (r.status !== 301 && r.status !== 308) row.problem = 'Temporary redirect (' + r.status + ') — Google may keep the old address';
    let next;
    try { next = new URL(r.location); } catch (e) { row.problem = 'Bad redirect address'; return row; }
    if (!hosts.has(next.hostname.toLowerCase())) { row.ok = !row.problem; row.external = true; return row; }
    const r2 = await discover.safeFetch(next.toString(), { allow: allow, follow: false, body: false, timeout: 8000 }, deps);
    row.finalStatus = r2.status;
    if (r2.redirect) { row.problem = 'Two hops: ' + p + ' → ' + next.pathname + ' → ' + (r2.location ? new URL(r2.location).pathname : '?'); return row; }
    if (r2.status !== 200) { row.problem = 'New address answers ' + (r2.status || 'nothing'); return row; }
    row.ok = !row.problem;
    return row;
  }
  const workers = [];
  for (let w = 0; w < (opts.concurrency || 5); w++) {
    workers.push((async function () { while (queue.length) { const p = queue.shift(); out.push(await one(p)); } })());
  }
  await Promise.all(workers);
  return out;
}

async function logRun(admin, siteId, kind, summary) {
  try {
    await admin.from('seo_saver_runs').insert({ site_id: siteId, kind: kind, summary: summary || {} });
    // keep the last 60 runs of each kind
    const { data } = await admin.from('seo_saver_runs').select('id').eq('site_id', siteId).eq('kind', kind).order('ran_at', { ascending: false }).range(60, 200);
    if (data && data.length) await admin.from('seo_saver_runs').delete().in('id', data.map(function (r) { return r.id; }));
  } catch (e) { /* best effort */ }
}

async function lastRun(admin, siteId, kind) {
  const { data } = await admin.from('seo_saver_runs').select('kind,ran_at,summary').eq('site_id', siteId).eq('kind', kind).order('ran_at', { ascending: false }).limit(1);
  return (data && data[0]) || null;
}

/** Pages Google showed in search for this site (synced Search Console data) that aren't live pages. */
async function fromSearchConsole(admin, site, oldDomain) {
  // pages Google showed in search (synced Search Console data) — free
  const since = new Date(Date.now() - 480 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const { data, error } = await admin.from('si_query_page_stats').select('page_url,clicks,impressions').eq('site_id', site.id).gte('period_end', since).limit(20000);
  if (error) return { ok: false, message: 'Search Console data isn’t available for this site yet.' };
  const by = new Map();
  (data || []).forEach(function (r) {
    const k = discover.keyFor(r.page_url, oldDomain) || (site.custom_domain && discover.keyFor(r.page_url, site.custom_domain));
    if (!k) return;
    const p = by.get(k.path) || Object.assign(k, { sources: ['search_console'], clicks: 0, impressions: 0 });
    p.clicks += Number(r.clicks) || 0; p.impressions += Number(r.impressions) || 0;
    by.set(k.path, p);
  });
  const cfg = site.config || {};
  const rows = Array.from(by.values()).filter(function (c) { return coverage(cfg, c.path).state !== 'live'; });
  return { ok: true, candidates: rows, message: (data || []).length ? '' : 'No Search Console data synced for this site yet (connect it under Connections).' };
}

/** Old addresses real visitors / Googlebot asked for that no redirect covers (site_url_hits). */
async function fromVisits(admin, site) {
  const { data, error } = await admin.from('site_url_hits').select('path,kind,hits,google_hits').eq('site_id', site.id).in('kind', ['not_found', 'fallback']).eq('dismissed', false).limit(2000);
  if (error) return { ok: false, message: 'Visit tracking isn’t installed yet.' };
  return {
    ok: true,
    candidates: (data || []).map(function (r) {
      return { path: r.path, sources: ['visits'], visits: Number(r.hits) || 0, is_page: core.isPageLike(r.path.split('?')[0]) };
    })
  };
}


/**
 * Daily monitor for one site (api/cron/seo-saver.js). Never removes or changes existing redirects.
 *   1. new old addresses from real visits + Search Console → candidates
 *   2. read the old content of new ones (Wayback copy once the domain points here; ≤ 8 a day)
 *   3. match every open candidate
 *   4. auto-add redirects for requested addresses matched with confidence ≥ seoSaver.autoMin (default 90),
 *      unless seoSaver.autoAdd === false
 *   5. health: rule problems + a rotating live spot-check of up to 20 old addresses on the domain
 * Returns the run summary (also stored in seo_saver_runs, kind 'monitor').
 */
async function runMonitor(admin, site, deps, opts) {
  opts = opts || {};
  const cfg = site.config || {};
  const ss = cfg.seoSaver || {};
  const summary = { newAddresses: 0, read: 0, matched: 0, autoAdded: [], toReview: 0, problems: [], liveChecked: 0, liveProblems: [], errors: [] };
  const oldDomain = discover.cleanDomain(ss.oldDomain || site.custom_domain || '');
  const domain = discover.cleanDomain(site.custom_domain || '');
  let switched = null;
  async function onLp() { if (switched == null) switched = domain ? await discover.isOnLeadPages(domain, deps).catch(function () { return false; }) : false; return switched; }

  // 1) sources that need no paid calls
  const found = [];
  const v = await fromVisits(admin, site).catch(function (e) { return { ok: false, message: e.message }; });
  if (v.ok) found.push.apply(found, v.candidates);
  const g = await fromSearchConsole(admin, site, oldDomain || domain).catch(function (e) { return { ok: false, message: e.message }; });
  if (g.ok) found.push.apply(found, g.candidates);
  if (found.length) {
    const s1 = await saveCandidates(admin, site.id, found);
    summary.newAddresses = s1.added;
  }

  // 2) old content for requested pages we haven't read (Wayback when the old site is gone)
  if (oldDomain && discover.validDomain(oldDomain)) {
    const { data: unread } = await admin.from('seo_saver_candidates').select('path,url,is_page,archive_ts,sources')
      .eq('site_id', site.id).is('fetched_at', null).eq('is_page', true).eq('status', 'open').limit(opts.readLimit || 8);
    const archiveOnly = (oldDomain === domain) ? await onLp() : await discover.isOnLeadPages(oldDomain, deps).catch(function () { return true; });
    const ups = [];
    for (const c of (unread || [])) {
      if (opts.deadline && Date.now() > opts.deadline) break;
      const r = await discover.readPage(oldDomain, c, { archiveOnly: archiveOnly, timeout: 6000, archiveTimeout: 9000 }, deps);
      ups.push(Object.assign({ path: c.path, sources: c.sources }, r.fields));
    }
    if (ups.length) { await saveCandidates(admin, site.id, ups, { overwriteContent: true }); summary.read = ups.length; }
  }

  // 3) match
  summary.matched = await matchCandidates(admin, site);

  // 4) auto-add
  const { data: open } = await admin.from('seo_saver_candidates').select('path,is_page,sources,suggested_to,confidence,reason,status')
    .eq('site_id', site.id).eq('status', 'open').limit(MAX_CANDIDATES);
  const min = Math.max(70, Math.min(100, Number(ss.autoMin) || 90));
  const need = (open || []).filter(function (c) { const st = coverage(cfg, c.path).state; return st === 'fallback' || st === 'not_found'; });
  const picks = ss.autoAdd === false ? [] : need.filter(function (c) {
    const demanded = (c.sources || []).some(function (s) { return s === 'visits' || s === 'search_console'; });
    return demanded && c.is_page !== false && c.suggested_to && Number(c.confidence) >= min;
  });
  if (picks.length && ss.on !== false) {
    const res = await addRules(admin, site.id, picks.map(function (c) {
      return { from: c.path, to: c.suggested_to, code: 301, source: 'auto', note: 'Added by the daily check (' + c.confidence + '% sure): ' + String(c.reason || '').slice(0, 160) };
    }));
    if (res.ok && res.added.length) {
      const added = new Set(res.added);
      summary.autoAdded = picks.filter(function (c) { return added.has(c.path); }).map(function (c) { return { from: c.path, to: c.suggested_to, confidence: c.confidence }; });
      await admin.from('seo_saver_candidates').update({ status: 'applied', applied_by: 'auto', updated_at: new Date().toISOString() }).eq('site_id', site.id).in('path', res.added);
    } else if (!res.ok) summary.errors.push(res.message || res.error);
  }
  summary.toReview = need.length - summary.autoAdded.length;

  // 5) health
  const { data: fresh } = await admin.from('sites').select('config').eq('id', site.id).maybeSingle();
  const cfgNow = (fresh && fresh.config) || cfg;
  summary.problems = ruleProblems(cfgNow).slice(0, 50);
  if (domain && await onLp()) {
    const rules = ((cfgNow.seoSaver && cfgNow.seoSaver.redirects) || []).filter(function (r) { return r && r.on !== false && r.from && !/\*$/.test(String(r.from)); });
    const keys = Array.from(new Set(rules.map(function (r) { return core.ruleKey(r.from); }))).sort();
    if (keys.length) {
      const n = Math.min(opts.spot || 20, keys.length);
      const day = Math.floor(Date.now() / 86400000);
      const start = (day * n) % keys.length;
      const sample = [];
      for (let i = 0; i < n; i++) sample.push(keys[(start + i) % keys.length]);
      const rows = await liveCheck(domain, sample, deps, { host: opts.host });
      summary.liveChecked = rows.length;
      summary.liveProblems = rows.filter(function (r) { return !r.ok || r.problem; }).map(function (r) { return { path: r.path, problem: r.problem || ('Answered ' + r.status) }; });
    }
  }
  await logRun(admin, site.id, 'monitor', summary);
  return summary;
}

/* ---------------- auth (same rule as api/seo-saver/hits.js and purge-site-cache) ---------------- */
let _admin = null;
function adminClient() {
  if (!_admin) {
    const { createClient } = require('@supabase/supabase-js');
    _admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return _admin;
}
async function requireUser(req) {
  const h = (req.headers && req.headers.authorization) || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  try {
    const { createClient } = require('@supabase/supabase-js');
    const userClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, { global: { headers: { Authorization: 'Bearer ' + token } } });
    const { data, error } = await userClient.auth.getUser(token);
    if (error || !data || !data.user) return null;
    return data.user;
  } catch (e) { return null; }
}
/** The site row when the user owns it, services/referred it as an active partner, or is super-admin. */
async function siteForUser(admin, user, siteId) {
  const { data: site } = await admin.from('sites').select('id, slug, status, custom_domain, config, updated_at, owner_user_id, servicing_partner_id, referring_partner_id').eq('id', siteId).maybeSingle();
  if (!site) return null;
  const { data: prof } = await admin.from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle();
  if (prof && prof.is_super_admin) return site;
  if (site.owner_user_id && site.owner_user_id === user.id) return site;
  const { data: partner } = await admin.from('partners').select('id,status').eq('user_id', user.id).maybeSingle();
  if (partner && partner.status === 'active' && (site.servicing_partner_id === partner.id || site.referring_partner_id === partner.id)) return site;
  return null;
}

module.exports = {
  runMonitor: runMonitor, fromSearchConsole: fromSearchConsole, fromVisits: fromVisits,
  adminClient: adminClient, requireUser: requireUser, siteForUser: siteForUser,
  MAX_CANDIDATES: MAX_CANDIDATES, publishedPages: publishedPages, liveSet: liveSet, coverage: coverage,
  saveCandidates: saveCandidates, matchCandidates: matchCandidates, addRules: addRules, purge: purge,
  ruleProblems: ruleProblems, liveCheck: liveCheck, logRun: logRun, lastRun: lastRun
};
