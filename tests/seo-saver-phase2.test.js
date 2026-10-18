'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const core = require('../lib/seo-saver');
const M = require('../lib/seo-saver-match');
const D = require('../lib/seo-saver-discover');
const SRV = require('../lib/seo-saver-server');

const ROOT = path.join(__dirname, '..');
const DRC = require('../scripts/sites/downrightconcreting-config.json');
const OLD = require('./fixtures/seo-saver-drc-old-pages.json');
const PUBLIC = async () => [{ address: '93.184.216.34', family: 4 }];

/* ---------- a tiny in-memory stand-in for the Supabase client (only what SEO Saver uses) ---------- */
function fakeAdmin(tables) {
  tables = tables || {};
  function T(name) { return (tables[name] = tables[name] || []); }
  function builder(name) {
    const st = { name, filters: [], op: 'select', head: false, count: false, limit: null, range: null, order: null, payload: null, single: false, wantRows: true };
    const b = {
      select(cols, opt) { if (st.op === 'select') st.op = 'select'; st.wantRows = true; if (opt && opt.count) st.count = true; if (opt && opt.head) st.head = true; return b; },
      eq(k, v) { st.filters.push((r) => r[k] === v); return b; },
      neq(k, v) { st.filters.push((r) => r[k] !== v); return b; },
      in(k, vs) { st.filters.push((r) => vs.indexOf(r[k]) >= 0); return b; },
      is(k, v) { st.filters.push((r) => (r[k] == null) === (v === null)); return b; },
      not(k, op, v) { st.filters.push((r) => { const parts = k.split('->'); let x = r[parts[0]]; if (parts[1]) x = x && x[parts[1]]; return x != null; }); return b; },
      gte(k, v) { st.filters.push((r) => r[k] >= v); return b; },
      order(k, o) { st.order = [k, o && o.ascending === false ? -1 : 1]; return b; },
      limit(n) { st.limit = n; return b; },
      range(a, z) { st.range = [a, z]; return b; },
      maybeSingle() { st.single = true; return b; },
      update(p) { st.op = 'update'; st.payload = p; st.wantRows = false; return b; },
      delete() { st.op = 'delete'; return b; },
      insert(p) { st.op = 'insert'; st.payload = p; return b; },
      upsert(p, opt) { st.op = 'upsert'; st.payload = p; st.conflict = (opt && opt.onConflict || '').split(','); return b; },
      then(res, rej) { return Promise.resolve(run()).then(res, rej); }
    };
    function run() {
      const rows = T(name);
      const match = (r) => st.filters.every((f) => f(r));
      if (st.op === 'insert') { (Array.isArray(st.payload) ? st.payload : [st.payload]).forEach((r) => rows.push(Object.assign({ id: rows.length + 1, ran_at: new Date(Date.now() + rows.length).toISOString() }, r))); return { data: null, error: null }; }
      if (st.op === 'upsert') {
        (Array.isArray(st.payload) ? st.payload : [st.payload]).forEach((r) => {
          const i = rows.findIndex((x) => st.conflict.every((k) => x[k] === r[k]));
          if (i >= 0) rows[i] = Object.assign({}, rows[i], r); else rows.push(Object.assign({}, r));
        });
        return { data: null, error: null };
      }
      if (st.op === 'update') {
        const hit = rows.filter(match); hit.forEach((r) => Object.assign(r, JSON.parse(JSON.stringify(st.payload))));
        return { data: st.wantRows ? hit.map((r) => ({ id: r.id })) : null, error: null };
      }
      if (st.op === 'delete') { for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i])) rows.splice(i, 1); return { data: null, error: null }; }
      let out = rows.filter(match);
      if (st.order) out = out.slice().sort((a, c) => (a[st.order[0]] < c[st.order[0]] ? -1 : a[st.order[0]] > c[st.order[0]] ? 1 : 0) * st.order[1]);
      if (st.range) out = out.slice(st.range[0], st.range[1] + 1);
      if (st.limit != null) out = out.slice(0, st.limit);
      if (st.head) return { data: null, count: out.length, error: null };
      out = JSON.parse(JSON.stringify(out));
      if (st.single) return { data: out[0] || null, error: null };
      return { data: out, count: st.count ? out.length : undefined, error: null };
    }
    // update(...).eq(...).select('id') — select after update keeps the update
    const sel = b.select;
    b.select = function (cols, opt) { if (st.op === 'update') { st.wantRows = true; return b; } return sel(cols, opt); };
    return b;
  }
  return { from: builder, tables };
}

/** fetch stand-in: routes[url] = { status, body, headers } */
function fakeFetch(routes, log) {
  return async function (url) {
    if (log) log.push(url);
    const r = routes[url] || { status: 404, body: 'not found' };
    const headers = new Map(Object.entries(r.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    return { status: r.status, headers: { get: (k) => headers.get(k.toLowerCase()) || null }, body: null, text: async () => r.body || '' };
  };
}

/* ------------------------------------------------------------------ matching */

test('content matching: every confident match on the real Down Right old site is right', () => {
  const idx = M.buildIndex(DRC);
  const compiled = core.compile({ seoSaver: { redirects: DRC.seoSaver.redirects } });
  let sure = 0;
  OLD.forEach((c) => {
    const m = M.matchCandidate(c, idx);
    const rule = core.matchRule(compiled, c.path.split('?')[0], '');
    const want = rule ? String(rule.to).split('#')[0] : core.normalizePath(c.path);
    if (m.confidence >= 85) { sure++; assert.equal(m.to, want, c.path + ' (' + m.reason + ')'); }
  });
  assert.ok(sure >= 15, 'most pages are sure matches (' + sure + ')');
});

test('content beats URL words: renamed pages and the about page', () => {
  const idx = M.buildIndex(DRC);
  const about = OLD.find((c) => c.path === '/about-down-right-concrete');
  const m = M.matchCandidate(about, idx);
  assert.equal(m.to, '/about');
  assert.ok(m.confidence >= 85, m.reason);
  const drive = M.matchCandidate(OLD.find((c) => c.path === '/services/concrete-driveways-canberra'), idx);
  assert.equal(drive.to, '/concrete-driveways');
  assert.ok(drive.confidence >= 90);
});

test('gallery albums are never "sure" service-page matches (folder is a page here too)', () => {
  const idx = M.buildIndex(DRC);
  OLD.filter((c) => /^\/gallery\//.test(c.path)).forEach((c) => {
    const m = M.matchCandidate(c, idx);
    assert.ok(m.confidence < 85, c.path + ' → ' + m.to + ' ' + m.confidence);
  });
  // without old content, a same-name page under another page's folder is not sure either
  assert.ok(M.matchCandidate({ path: '/gallery/polished-concrete' }, idx).confidence < 85);
  // …but /services/x with no content still is (services is just a folder for its pages)
  assert.equal(M.matchCandidate({ path: '/services/excavation', title: 'Excavation', body: 'excavation site preparation' }, idx).to, '/excavation');
});

test('URL-only matches are capped; files get no page; the old homepage is home', () => {
  const idx = M.buildIndex(DRC);
  const u = M.matchCandidate({ path: '/our-concrete-driveway-work' }, idx);
  assert.equal(u.to, '/concrete-driveways');
  assert.ok(u.confidence <= 75);
  assert.equal(M.matchCandidate({ path: '/images/x.jpg', is_page: false }, idx).to, null);
  assert.equal(M.matchCandidate({ path: '/' }, idx).confidence, 99);
  const none = M.matchCandidate({ path: '/zzqx-unrelated' }, idx);
  assert.equal(none.to, '/');
  assert.ok(none.confidence < 50);
  const redirOnOld = M.matchCandidate({ path: '/old', old_final: '/services/excavation' }, idx);
  assert.equal(redirOnOld.to, '/excavation');
  assert.ok(redirOnOld.confidence >= 90);
});

/* ------------------------------------------------------------------ discovery helpers */

test('keyFor: rule-shaped paths, junk dropped, ids in queries kept', () => {
  const d = 'downrightconcreting.com.au';
  assert.deepEqual(D.keyFor('https://www.downrightconcreting.com.au/Services/Excavation/?utm_source=x', d).path, '/services/excavation');
  assert.equal(D.keyFor('https://www.downrightconcreting.com.au/index.php?option=com_content&Itemid=105&utm_medium=cpc', d).path, '/?itemid=105&option=com_content');
  assert.equal(D.keyFor('https://other.com/x', d), null);
  assert.equal(D.keyFor('https://www.downrightconcreting.com.au/wp-admin/x', d), null);
  assert.equal(D.keyFor('https://www.downrightconcreting.com.au/templates/t/css/a.css', d), null);
  assert.equal(D.keyFor('https://www.downrightconcreting.com.au/%7B%=file.url%%7D', d), null);
  assert.equal(D.keyFor('https://downrightconcreting.com.au/images/a.JPG', d).is_page, false);
  assert.equal(D.keyFor('/about?ref=1', d).path, '/about');
});

test('extractPage and parseSitemap', () => {
  const x = D.extractPage('<html><head><title>Old &amp; Gold</title><meta name="description" content="Desc"><link rel="canonical" href="/canon"></head><body><nav>menu</nav><h1>Big <b>Head</b></h1><p>Body text</p><script>var a=1</script><a href="/next">n</a><img src="/i.jpg"></body></html>', 'https://x.com/a');
  assert.equal(x.title, 'Old & Gold');
  assert.equal(x.description, 'Desc');
  assert.equal(x.h1, 'Big Head');
  assert.ok(!/menu|var a/.test(x.body) && /Body text/.test(x.body));
  assert.deepEqual(x.links, ['https://x.com/next', 'https://x.com/i.jpg']);
  const sm = D.parseSitemap('<sitemapindex><sitemap><loc>https://x.com/s1.xml</loc></sitemap></sitemapindex>');
  assert.ok(sm.isIndex);
  assert.deepEqual(D.parseSitemap('<urlset><url><loc><![CDATA[https://x.com/a]]></loc></url></urlset>').locs, ['https://x.com/a']);
});

test('safeFetch refuses private networks, other hosts and off-site redirects', async () => {
  assert.ok(D.isPrivateIp('10.1.2.3') && D.isPrivateIp('127.0.0.1') && D.isPrivateIp('169.254.169.254') && D.isPrivateIp('::1') && D.isPrivateIp('fd00::1'));
  assert.ok(!D.isPrivateIp('93.184.216.34'));
  const allow = (h) => h === 'old.com.au';
  let r = await D.safeFetch('https://old.com.au/x', { allow }, { lookup: async () => [{ address: '10.0.0.5' }], fetch: fakeFetch({}) });
  assert.equal(r.error, 'blocked_host');
  r = await D.safeFetch('https://evil.com/x', { allow }, { lookup: PUBLIC, fetch: fakeFetch({}) });
  assert.equal(r.error, 'off_site');
  r = await D.safeFetch('http://old.com.au:8080/x', { allow }, { lookup: PUBLIC, fetch: fakeFetch({}) });
  assert.equal(r.error, 'blocked_url');
  const f = fakeFetch({ 'https://old.com.au/x': { status: 301, headers: { location: 'http://169.254.169.254/' } } });
  r = await D.safeFetch('https://old.com.au/x', { allow, follow: true }, { lookup: PUBLIC, fetch: f });
  assert.equal(r.error, 'off_site');
});

test('readPage: live page, old-site redirect, and Wayback fallback when the old page is gone', async () => {
  const routes = {
    'https://old.com.au/a': { status: 200, body: '<html><title>A page</title><body><h1>A</h1><a href="/b">b</a></body></html>' },
    'https://old.com.au/moved': { status: 301, headers: { location: 'https://old.com.au/a' } },
    'https://old.com.au/gone': { status: 404, body: 'nope' },
    'https://web.archive.org/web/20200101000000id_/https://old.com.au/gone': { status: 200, body: '<html><title>Gone page</title><body>archived <a href="https://web.archive.org/web/20200101/https://old.com.au/c">c</a></body></html>' }
  };
  const deps = { lookup: PUBLIC, fetch: fakeFetch(routes) };
  let r = await D.readPage('old.com.au', { path: '/a' }, {}, deps);
  assert.equal(r.fields.title, 'A page');
  assert.equal(r.fields.fetch_from, 'live');
  assert.deepEqual(r.links.map((l) => l.path), ['/b']);
  r = await D.readPage('old.com.au', { path: '/moved' }, {}, deps);
  assert.equal(r.fields.old_final, '/a');
  assert.equal(r.fields.title, 'A page');
  r = await D.readPage('old.com.au', { path: '/gone', archive_ts: '20200101000000' }, {}, deps);
  assert.equal(r.fields.old_status, 404);
  assert.equal(r.fields.fetch_from, 'archive');
  assert.equal(r.fields.title, 'Gone page');
  assert.deepEqual(r.links.map((l) => l.path), ['/c'], 'archive links are unwrapped');
});

test('Wayback: newest snapshot per address, pages and files, junk dropped', async () => {
  const cdx = [['original', 'mimetype', 'statuscode', 'timestamp'],
    ['http://old.com.au/about', 'text/html', '200', '20150101000000'],
    ['https://www.old.com.au/about/', 'text/html', '200', '20190101000000'],
    ['https://old.com.au/pic.jpg', 'image/jpeg', '200', '20190101000000'],
    ['https://old.com.au/style.css', 'text/css', '200', '20190101000000'],
    ['https://old.com.au/wp-json/x', 'application/json', '200', '20190101000000'],
    ['https://cdn.old.com.au/x', 'text/html', '200', '20190101000000']];
  const url = 'https://web.archive.org/cdx/search/cdx?url=old.com.au&matchType=domain&output=json&fl=original,mimetype,statuscode,timestamp&collapse=urlkey&filter=statuscode:200&limit=10000';
  const r = await D.fromWayback('old.com.au', { lookup: PUBLIC, fetch: fakeFetch({ [url]: { status: 200, body: JSON.stringify(cdx) } }) });
  assert.ok(r.ok);
  const by = Object.fromEntries(r.candidates.map((c) => [c.path, c]));
  assert.deepEqual(Object.keys(by).sort(), ['/about', '/pic.jpg']);
  assert.equal(by['/about'].archive_ts, '20190101000000');
  assert.equal(by['/pic.jpg'].is_page, false);
});

test('paid sources say so plainly when DataForSEO is not set up', async () => {
  const off = { configured: () => false };
  assert.equal((await D.fromGoogle('old.com.au', off)).error, 'not_configured');
  assert.equal((await D.fromBacklinks('old.com.au', off)).error, 'not_configured');
  const on = { configured: () => true, serp: async () => ({ ok: true, snapshot: { results: [{ url: 'https://www.old.com.au/services/x', title: 'X' }, { url: 'https://other.com/y' }] } }) };
  const g = await D.fromGoogle('old.com.au', on);
  assert.deepEqual(g.candidates.map((c) => c.path), ['/services/x']);
  assert.deepEqual(g.candidates[0].sources, ['google']);
});

/* ------------------------------------------------------------------ rules + server */

test('rule ids are stable per old address and unique', () => {
  const a = core.withIds([{ from: '/A/' }, { from: 'https://x.com/a' }, { from: '/b', id: 'keep' }]);
  assert.equal(a[2].id, 'keep');
  assert.notEqual(a[0].id, a[1].id);
  assert.equal(core.withIds([{ from: '/a' }])[0].id, a[0].id);
  assert.equal(core.ruleKey('/Index.php?Option=x&Itemid=5'), '/?itemid=5&option=x');
});

test('ruleProblems and coverage', () => {
  const cfg = { pages: [{ slug: 'about', status: 'published' }], seoSaver: { on: true, redirects: [
    { from: '/a', to: '/b' }, { from: '/b', to: '/about' }, { from: '/c', to: '/nowhere' }, { from: '/A/', to: '/about' }, { from: '/d', code: 410 }] } };
  const p = SRV.ruleProblems(cfg);
  assert.deepEqual(p.map((x) => x.problem), ['chain', 'target', 'duplicate']);
  assert.equal(p[0].fix, '/about');
  assert.deepEqual(SRV.coverage(cfg, '/about'), { state: 'live', to: '/about' });
  assert.equal(SRV.coverage(cfg, '/b').state, 'redirect');
  assert.equal(SRV.coverage(cfg, '/d').state, 'gone');
  assert.equal(SRV.coverage(cfg, '/zzz').state, 'fallback');
  assert.equal(SRV.coverage(cfg, '/x.jpg').state, 'not_found');
});

test('saveCandidates merges sources and keeps content; addRules appends safely', async () => {
  const admin = fakeAdmin({ sites: [{ id: 's1', slug: 'demo', updated_at: 't0', config: { name: 'Keep me', seoSaver: { on: true, redirects: [{ from: '/old', to: '/about' }] } } }] });
  await SRV.saveCandidates(admin, 's1', [{ path: '/x', sources: ['wayback'], title: 'Old X' }]);
  const r = await SRV.saveCandidates(admin, 's1', [{ path: '/x', sources: ['google'], title: 'Other' }, { path: '/y', sources: ['visits'], visits: 3 }]);
  assert.deepEqual(r, { added: 1, updated: 1, skipped: 0 });
  const x = admin.tables.seo_saver_candidates.find((c) => c.path === '/x');
  assert.deepEqual(x.sources.sort(), ['google', 'wayback']);
  assert.equal(x.title, 'Old X', 'content already read is kept');
  const a = await SRV.addRules(admin, 's1', [{ from: '/OLD/', to: '/x' }, { from: '/new', to: '/about', source: 'auto' }]);
  assert.deepEqual(a.added, ['/new']);
  const site = admin.tables.sites[0];
  assert.equal(site.config.name, 'Keep me');
  assert.equal(site.config.seoSaver.redirects.length, 2);
  assert.ok(site.config.seoSaver.redirects.every((x2) => x2.id), 'every rule gets an id for the editor merge');
  assert.notEqual(site.updated_at, 't0', 'updated_at moves so an open editor merges the change');
});

test('daily monitor: auto-adds sure matches for requested addresses only, never touches others', async () => {
  const cfg = JSON.parse(JSON.stringify(DRC));
  cfg.seoSaver = { on: true, notFound: 'smart', oldDomain: 'downrightconcreting.com.au', redirects: [] };
  const admin = fakeAdmin({
    sites: [{ id: 's1', slug: 'drc', status: 'live', custom_domain: null, updated_at: 't0', config: cfg }],
    site_url_hits: [
      { site_id: 's1', path: '/services/concrete-driveways-canberra', kind: 'fallback', hits: 4, google_hits: 2, dismissed: false },
      { site_id: 's1', path: '/gallery/polished-concrete', kind: 'fallback', hits: 2, google_hits: 0, dismissed: false }
    ],
    si_query_page_stats: [],
    seo_saver_candidates: [
      // found by discovery but nobody asked for it: suggested, not auto-added
      { site_id: 's1', path: '/services/polished-concrete-canberra', sources: ['wayback'], is_page: true, status: 'open', fetched_at: 'x', title: 'Polished Concrete - Down Right Concreting Canberra', body: OLD.find((c) => c.path === '/services/polished-concrete-canberra').body }
    ]
  });
  const pageFor = (p) => OLD.find((c) => c.path === p);
  const routes = {};
  ['/services/concrete-driveways-canberra', '/gallery/polished-concrete'].forEach((p) => {
    const c = pageFor(p);
    routes['https://downrightconcreting.com.au' + p] = { status: 200, body: '<html><title>' + c.title + '</title><body><h1>' + (c.h1 || '') + '</h1><p>' + c.body + '</p></body></html>' };
  });
  const deps = { lookup: PUBLIC, fetch: fakeFetch(routes) };
  const s = await SRV.runMonitor(admin, admin.tables.sites[0], deps, {});
  assert.equal(s.newAddresses, 2);
  assert.equal(s.read, 2);
  assert.deepEqual(s.autoAdded.map((x) => x.from), ['/services/concrete-driveways-canberra']);
  const rules = admin.tables.sites[0].config.seoSaver.redirects;
  assert.equal(rules.length, 1);
  assert.equal(rules[0].to, '/concrete-driveways');
  assert.equal(rules[0].source, 'auto');
  assert.equal(admin.tables.seo_saver_candidates.find((c) => c.path === '/services/concrete-driveways-canberra').status, 'applied');
  assert.equal(s.toReview, 2, 'gallery album + unrequested discovery are left for review');
  assert.equal(admin.tables.seo_saver_runs.length, 1);

  // switched off: nothing is added
  admin.tables.sites[0].config.seoSaver.autoAdd = false;
  admin.tables.seo_saver_candidates.forEach((c) => { if (c.status === 'applied') c.status = 'open'; });
  admin.tables.sites[0].config.seoSaver.redirects = [];
  const s2 = await SRV.runMonitor(admin, admin.tables.sites[0], deps, {});
  assert.equal(s2.autoAdded.length, 0);
  assert.equal(admin.tables.sites[0].config.seoSaver.redirects.length, 0);
});

test('live launch check: one hop to a 200 is fine; two hops and 404s are reported', async () => {
  const routes = {
    'https://www.x.com.au/a': { status: 301, headers: { location: 'https://www.x.com.au/about' } },
    'https://www.x.com.au/about': { status: 200 },
    'https://www.x.com.au/b': { status: 301, headers: { location: 'https://www.x.com.au/c' } },
    'https://www.x.com.au/c': { status: 301, headers: { location: 'https://www.x.com.au/about' } },
    'https://www.x.com.au/t': { status: 302, headers: { location: 'https://www.x.com.au/about' } }
  };
  const rows = await SRV.liveCheck('x.com.au', ['/a', '/b', '/missing', '/t'], { lookup: PUBLIC, fetch: fakeFetch(routes) });
  const by = Object.fromEntries(rows.map((r) => [r.path, r]));
  assert.ok(by['/a'].ok && !by['/a'].problem);
  assert.match(by['/b'].problem, /Two hops/);
  assert.match(by['/missing'].problem, /404/);
  assert.match(by['/t'].problem, /Temporary/);
});

/* ------------------------------------------------------------------ wiring */

test('wiring: cron, function limits, migration, editor panel', () => {
  const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  assert.ok(v.crons.some((c) => c.path === '/api/cron/seo-saver'));
  assert.equal(v.functions['api/seo-saver/discover.js'].maxDuration, 60);
  assert.equal(v.functions['api/cron/seo-saver.js'].maxDuration, 60);
  const sql = fs.readFileSync(path.join(ROOT, 'db/seo_saver_phase2.sql'), 'utf8');
  assert.match(sql, /create table if not exists public\.seo_saver_candidates/);
  assert.match(sql, /create table if not exists public\.seo_saver_runs/);
  assert.match(sql, /revoke all on table public\.seo_saver_candidates from public, anon, authenticated/);
  const panel = fs.readFileSync(path.join(ROOT, 'assets/lp-seo-saver.js'), 'utf8');
  assert.match(panel, /\/api\/seo-saver\/discover/);
  assert.match(panel, /Click again to spend 1 request/, 'paid sources need a second click');
  assert.match(panel, /core\.withIds/);
  const html = fs.readFileSync(path.join(ROOT, 'manage.html'), 'utf8');
  assert.ok(html.indexOf('/assets/lp-seo-saver.js?v=2') > 0);
  const cron = fs.readFileSync(path.join(ROOT, 'api/cron/seo-saver.js'), 'utf8');
  assert.match(cron, /CRON_SECRET/);
});

test('discover API: auth, list with coverage, read loop, match, status, paid once a day', async () => {
  const srvMod = require('../lib/seo-saver-server');
  const discMod = require('../lib/seo-saver-discover');
  const cfg = JSON.parse(JSON.stringify(DRC));
  cfg.seoSaver = { on: true, oldDomain: 'downrightconcreting.com.au', redirects: [{ from: '/services/excavation', to: '/excavation' }] };
  const admin = fakeAdmin({ sites: [{ id: '11111111-1111-1111-1111-111111111111', slug: 'drc', status: 'live', custom_domain: null, updated_at: 't0', config: cfg }], seo_saver_runs: [] });
  const saved = { requireUser: srvMod.requireUser, siteForUser: srvMod.siteForUser, adminClient: srvMod.adminClient, readPage: discMod.readPage, isOnLeadPages: discMod.isOnLeadPages, fromSitemaps: discMod.fromSitemaps, fromGoogle: discMod.fromGoogle };
  srvMod.requireUser = async (req) => (req.headers.authorization === 'Bearer ok' ? { id: 'u1' } : null);
  srvMod.siteForUser = async (a, u, id) => admin.tables.sites.find((s) => s.id === id) || null;
  srvMod.adminClient = () => admin;
  discMod.isOnLeadPages = async () => false;
  discMod.fromSitemaps = async () => ({ ok: true, candidates: OLD.map((c) => ({ path: c.path, url: 'https://www.downrightconcreting.com.au' + c.path, sources: ['sitemap'], is_page: true })) });
  discMod.readPage = async (d, c) => { const o = OLD.find((x) => x.path === c.path); return { fields: { fetched_at: 'now', fetch_from: 'live', title: o.title, h1: o.h1, body: o.body }, links: [] }; };
  let googleCalls = 0;
  discMod.fromGoogle = async () => { googleCalls++; return { ok: true, candidates: [] }; };
  delete require.cache[require.resolve('../api/seo-saver/discover.js')];
  const handler = require('../api/seo-saver/discover.js');
  async function call(body, auth) {
    const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(s) { this.body = JSON.parse(s); } };
    await handler({ method: 'POST', headers: { authorization: auth || 'Bearer ok' }, body: Object.assign({ siteId: '11111111-1111-1111-1111-111111111111' }, body) }, res);
    return res;
  }
  try {
    assert.equal((await call({ action: 'list' }, 'Bearer bad')).statusCode, 401);
    let r = await call({ action: 'sitemaps' });
    assert.equal(r.body.added, OLD.length);
    let guard = 0;
    do { r = await call({ action: 'read', limit: 10 }); } while (r.body.remaining && ++guard < 10);
    assert.equal(r.body.remaining, 0);
    assert.ok((await call({ action: 'match' })).body.matched >= OLD.length);
    r = await call({ action: 'list' });
    const by = Object.fromEntries(r.body.candidates.map((c) => [c.path, c]));
    assert.equal(by['/services/excavation'].now, 'redirect', 'coverage uses the saved rules');
    assert.equal(by['/services/concrete-driveways-canberra'].now, 'fallback');
    assert.equal(by['/services/concrete-driveways-canberra'].suggested_to, '/concrete-driveways');
    assert.ok(!('body' in by['/about-down-right-concrete']) && by['/about-down-right-concrete'].snippet, 'list sends a snippet, not the whole text');
    assert.equal((await call({ action: 'status', paths: ['/faqs'], status: 'dismissed' })).body.ok, true);
    assert.equal(admin.tables.seo_saver_candidates.find((c) => c.path === '/faqs').status, 'dismissed');
    assert.equal((await call({ action: 'google' })).body.ok, true);
    const again = await call({ action: 'google' });
    assert.equal(again.statusCode, 429);
    assert.equal(googleCalls, 1, 'paid source runs at most once a day');
    const chk = await call({ action: 'check' });
    assert.equal(chk.body.error, 'no_domain');
  } finally {
    Object.assign(srvMod, { requireUser: saved.requireUser, siteForUser: saved.siteForUser, adminClient: saved.adminClient });
    Object.assign(discMod, { readPage: saved.readPage, isOnLeadPages: saved.isOnLeadPages, fromSitemaps: saved.fromSitemaps, fromGoogle: saved.fromGoogle });
  }
});
