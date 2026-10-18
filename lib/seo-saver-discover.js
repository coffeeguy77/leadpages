/**
 * SEO Saver — find a site's old addresses (phase 2).
 *
 * Every source returns candidate rows { path, url, sources:[…], is_page, …extra } for the
 * seo_saver_candidates table. Paths are normalised exactly like the live redirect engine
 * (lib/seo-saver.js), so a candidate's path is a valid rule "from".
 *
 *   fromSitemaps(domain)            free  — robots.txt Sitemap: lines + the usual sitemap files
 *   fromWayback(domain)             free  — every archived address (Wayback Machine CDX API)
 *   readPage(domain, cand, opts)    free  — reads one old page (live old site, or the archived copy)
 *                                           → title, heading, description, text, links found on it
 *   fromGoogle(domain)              paid  — DataForSEO Google results for site:domain (one request)
 *   fromBacklinks(domain)           paid  — DataForSEO pages with the most backlinks (one request)
 *   isOnLeadPages(domain)           free  — the domain already points at LeadPages (old site gone)
 *
 * All outbound requests go through safeFetch(): http(s) only, default ports, no IP-literal or
 * private-network hosts (DNS is checked), only the old domain's own hosts (or web.archive.org),
 * size and time capped. deps.fetch / deps.lookup can be swapped in tests.
 */
'use strict';
const dns = require('dns');
const core = require('./seo-saver');

const UA = 'LeadPagesSEOSaver/1.0 (+https://www.leadpages.com.au)';
const ARCHIVE_HOST = 'web.archive.org';
const MAX_BODY_TEXT = 4000;
const TRACKING = /^(utm_[a-z_]+|gclid|gbraid|wbraid|fbclid|msclkid|dclid|_ga|mc_cid|mc_eid|replytocom|amp|share|print|format|lang|s)$/i;
const ID_PARAMS = /^(id|p|page_id|pageid|itemid|option|cat|catid|pid|article|view|task|page|section|tag)$/i;
const JUNK_PATH = /^\/(wp-admin|wp-json|wp-includes|wp-content\/(plugins|themes|cache|uploads\/wpo)|xmlrpc\.php|wp-login\.php|cgi-bin|cdn-cgi|feed|comments\/feed|trackback|administrator|cache|tmp|media\/(jui|system)|templates\/[^/]+\/(css|js|fonts?)|plugins|modules|components\/com_[a-z]+\/(assets|css|js))(\/|$)|\/(feed|trackback|embed|amp)\/?$/i;
const ASSET_EXT = /\.(css|js|mjs|map|woff2?|ttf|otf|eot|json|xml|txt|ico|svg|webmanifest)$/i;
const FILE_EXT = /\.(jpe?g|png|gif|webp|avif|bmp|tiff?|pdf|docx?|xlsx?|pptx?|zip|mp4|mov|mp3)$/i;

/* ------------------------------------------------------------------ helpers */

function cleanDomain(d) {
  return String(d || '').trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/[/?#].*$/, '').replace(/:\d+$/, '').replace(/^www\./, '').replace(/\.$/, '');
}
function validDomain(d) {
  return /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(d) && !/^\d+\.\d+\.\d+\.\d+$/.test(d);
}
function hostsFor(domain) { const d = cleanDomain(domain); return new Set([d, 'www.' + d]); }

function isPrivateIp(ip) {
  ip = String(ip || '').toLowerCase();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  return ip === '::' || ip === '::1' || /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip) || ip.startsWith('ff');
}

async function checkHost(host, deps) {
  if (!host || /^\[|^\d+\.\d+\.\d+\.\d+$/.test(host) || host === 'localhost' || /\.(local|internal|localhost|test)$/.test(host)) return 'That address isn’t a public website.';
  const lookup = (deps && deps.lookup) || dns.promises.lookup;
  let addrs;
  try { addrs = await lookup(host, { all: true }); } catch (e) { return 'The domain ' + host + ' doesn’t exist (no DNS record).'; }
  if (!Array.isArray(addrs)) addrs = [addrs];
  if (!addrs.length || addrs.some(function (a) { return isPrivateIp(a && (a.address || a)); })) return 'That address isn’t a public website.';
  return '';
}

/**
 * GET a URL safely. allow(host) decides which hosts may be contacted (redirects included).
 * Returns { ok, status, url, location, headers, text, error }. Redirects are followed only
 * when opts.follow is true (max 5 hops); otherwise the first redirect is returned as-is.
 */
async function safeFetch(url, opts, deps) {
  opts = opts || {};
  const doFetch = (deps && deps.fetch) || fetch;
  const allow = opts.allow || function () { return false; };
  let cur = url, hops = 0, firstLocation = null;
  for (;;) {
    let u;
    try { u = new URL(cur); } catch (e) { return { ok: false, status: 0, url: cur, error: 'bad_url' }; }
    if (!/^https?:$/.test(u.protocol) || (u.port && u.port !== '80' && u.port !== '443') || u.username || u.password) return { ok: false, status: 0, url: cur, error: 'blocked_url' };
    const host = u.hostname.toLowerCase();
    if (!allow(host)) return { ok: false, status: 0, url: cur, error: 'off_site', location: firstLocation };
    const bad = await checkHost(host, deps);
    if (bad) return { ok: false, status: 0, url: cur, error: 'blocked_host', message: bad };
    const ctl = new AbortController();
    const timer = setTimeout(function () { ctl.abort(); }, opts.timeout || 8000);
    let r;
    try {
      r = await doFetch(u.toString(), { method: 'GET', redirect: 'manual', signal: ctl.signal, headers: { 'user-agent': UA, accept: opts.accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5' } });
    } catch (e) {
      clearTimeout(timer);
      return { ok: false, status: 0, url: cur, error: e && e.name === 'AbortError' ? 'timeout' : 'network', message: String((e && e.message) || e) };
    }
    const status = r.status;
    const loc = r.headers.get('location');
    if (status >= 300 && status < 400 && loc) {
      clearTimeout(timer);
      try { r.body && r.body.cancel && r.body.cancel(); } catch (e) { /* ignore */ }
      const next = new URL(loc, u).toString();
      if (!firstLocation) firstLocation = next;
      if (!opts.follow || ++hops > 5) return { ok: false, status: status, url: cur, location: next, headers: r.headers, redirect: true };
      cur = next; continue;
    }
    let text = '';
    if (opts.body !== false) {
      try { text = await readCapped(r, opts.maxBytes || 1500000); } catch (e) { text = ''; }
    } else { try { r.body && r.body.cancel && r.body.cancel(); } catch (e) { /* ignore */ } }
    clearTimeout(timer);
    return { ok: status >= 200 && status < 300, status: status, url: cur, location: firstLocation, headers: r.headers, text: text, hops: hops };
  }
}

async function readCapped(r, max) {
  if (!r.body || !r.body.getReader) { const t = await r.text(); return t.slice(0, max); }
  const reader = r.body.getReader(); const chunks = []; let n = 0;
  for (;;) {
    const x = await reader.read(); if (x.done) break;
    chunks.push(x.value); n += x.value.length;
    if (n >= max) { try { reader.cancel(); } catch (e) { /* ignore */ } break; }
  }
  return Buffer.concat(chunks.map(function (c) { return Buffer.from(c); })).toString('utf8').slice(0, max);
}

/** Old URL → { path, url, is_page } (path as a rule "from"), or null when it isn't on the old site / is junk. */
function keyFor(rawUrl, domain) {
  let u;
  try { u = new URL(rawUrl, 'https://' + cleanDomain(domain) + '/'); } catch (e) { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  if (!hostsFor(domain).has(u.hostname.toLowerCase())) return null;
  if (/[{}<>]|%7b|%7d|%3c|%3e|<%|\$\{/i.test(u.pathname)) return null; // template placeholders in scripts, not real pages
  let path = core.normalizePath(u.pathname);
  if (path.length > 400 || JUNK_PATH.test(path) || ASSET_EXT.test(path)) return null;
  const params = [];
  u.searchParams.forEach(function (v, k) { if (!TRACKING.test(k)) params.push([k.toLowerCase(), String(v).toLowerCase()]); });
  const keepQuery = params.length && (path === '/' || /\.(php\d?|aspx?|cfm|jsp)$/i.test(u.pathname) || params.some(function (p) { return ID_PARAMS.test(p[0]); }));
  if (keepQuery) {
    params.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
    path += '?' + params.map(function (p) { return p[0] + '=' + p[1]; }).join('&');
  }
  if (path.length > 500) return null;
  const isPage = !FILE_EXT.test(path.split('?')[0]) && core.isPageLike(path.split('?')[0]);
  return { path: path, url: u.origin + u.pathname + u.search, is_page: isPage };
}

function decodeEntities(s) {
  return String(s || '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&rsquo;|&lsquo;/g, '\'')
    .replace(/&ndash;|&mdash;/g, '-').replace(/&#(\d+);/g, function (m, n) { try { return String.fromCodePoint(+n); } catch (e) { return ' '; } }).replace(/&[a-z]+;/g, ' ');
}
function textOf(html) { return decodeEntities(String(html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(); }
function attr(tag, name) {
  const m = new RegExp('\\b' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i').exec(tag);
  return m ? decodeEntities(m[2] != null ? m[2] : m[3] != null ? m[3] : m[4]) : '';
}

/** Title, description, first heading, canonical, robots, readable text and links of an HTML page. */
function extractPage(html, pageUrl) {
  const h = String(html || '');
  const title = textOf((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(h) || [])[1] || '').slice(0, 300);
  let description = '', canonical = '', robots = '';
  (h.match(/<meta\b[^>]*>/gi) || []).forEach(function (t) {
    const n = (attr(t, 'name') || attr(t, 'property')).toLowerCase();
    if (!description && (n === 'description' || n === 'og:description')) description = attr(t, 'content').slice(0, 500);
    if (n === 'robots') robots = attr(t, 'content').toLowerCase();
  });
  (h.match(/<link\b[^>]*>/gi) || []).forEach(function (t) { if (!canonical && /canonical/i.test(attr(t, 'rel'))) canonical = attr(t, 'href'); });
  const h1 = textOf((/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(h) || [])[1] || '').slice(0, 300);
  let main = (/<main[^>]*>([\s\S]*?)<\/main>/i.exec(h) || /<article[^>]*>([\s\S]*?)<\/article>/i.exec(h) || [])[1] || '';
  if (main.length < 400) main = (/<body[^>]*>([\s\S]*)<\/body>/i.exec(h) || [])[1] || h;
  const cleaned = main.replace(/<(script|style|noscript|svg|nav|header|footer|form|iframe|template)[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  const body = textOf(cleaned).slice(0, MAX_BODY_TEXT);
  const links = [];
  (h.match(/<a\b[^>]*>/gi) || []).forEach(function (t) {
    const href = attr(t, 'href');
    if (!href || /^(#|mailto:|tel:|javascript:|data:)/i.test(href)) return;
    try { links.push(new URL(href, pageUrl).toString()); } catch (e) { /* ignore */ }
  });
  (h.match(/<img\b[^>]*>/gi) || []).forEach(function (t) {
    const src = attr(t, 'src'); if (!src || /^data:/i.test(src)) return;
    try { links.push(new URL(src, pageUrl).toString()); } catch (e) { /* ignore */ }
  });
  return { title: title, description: description, h1: h1, canonical: canonical, noindex: /noindex/.test(robots), body: body, links: links };
}

function parseSitemap(xml) {
  const s = String(xml || '');
  const locs = []; const re = /<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi; let m;
  while ((m = re.exec(s))) locs.push(decodeEntities(m[1]));
  return { isIndex: /<sitemapindex\b/i.test(s), locs: locs };
}

function merge(list) {
  // de-duplicate by path, union sources, keep the first non-empty value of everything else
  const by = new Map();
  list.forEach(function (c) {
    if (!c || !c.path) return;
    const prev = by.get(c.path);
    if (!prev) { by.set(c.path, Object.assign({}, c, { sources: (c.sources || []).slice() })); return; }
    (c.sources || []).forEach(function (s) { if (prev.sources.indexOf(s) < 0) prev.sources.push(s); });
    Object.keys(c).forEach(function (k) { if (k !== 'sources' && (prev[k] == null || prev[k] === '') && c[k] != null && c[k] !== '') prev[k] = c[k]; });
    ['backlinks', 'referring_domains', 'clicks', 'impressions', 'visits'].forEach(function (k) { if (c[k] != null) prev[k] = Math.max(Number(prev[k]) || 0, Number(c[k]) || 0); });
  });
  return Array.from(by.values());
}

/* ------------------------------------------------------------------ sources */

/** Old sitemaps (robots.txt Sitemap: lines, /sitemap.xml, /sitemap_index.xml, /wp-sitemap.xml …). */
async function fromSitemaps(domain, deps) {
  const d = cleanDomain(domain), hosts = hostsFor(d);
  const allow = function (h) { return hosts.has(h); };
  const queue = [], seen = new Set(), out = [];
  const robots = await safeFetch('https://' + d + '/robots.txt', { allow: allow, follow: true, accept: 'text/plain,*/*', maxBytes: 200000 }, deps);
  if (robots.ok) String(robots.text || '').split(/\r?\n/).forEach(function (l) { const m = /^\s*sitemap:\s*(\S+)/i.exec(l); if (m) queue.push(m[1]); });
  ['/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml', '/sitemap1.xml', '/page-sitemap.xml', '/index.php?option=com_jmap&view=sitemap&format=xml'].forEach(function (p) { queue.push('https://' + d + p); });
  let files = 0, errors = [];
  while (queue.length && files < 25) {
    const u = queue.shift(); if (seen.has(u)) continue; seen.add(u);
    const r = await safeFetch(u, { allow: allow, follow: true, accept: 'application/xml,text/xml,*/*', maxBytes: 5000000, timeout: 10000 }, deps);
    if (!r.ok || !/<(urlset|sitemapindex)\b/i.test(r.text || '')) { if (r.error === 'blocked_host') errors.push(r.message); continue; }
    files++;
    const sm = parseSitemap(r.text);
    if (sm.isIndex) sm.locs.forEach(function (l) { if (!seen.has(l)) queue.push(l); });
    else sm.locs.forEach(function (l) { const k = keyFor(l, d); if (k) out.push(Object.assign(k, { sources: ['sitemap'] })); });
  }
  return { ok: true, files: files, candidates: merge(out), message: errors[0] || '' };
}

/** Every address the Wayback Machine archived for the domain (pages + files), newest snapshot each. */
async function fromWayback(domain, deps) {
  const d = cleanDomain(domain);
  const api = 'https://' + ARCHIVE_HOST + '/cdx/search/cdx?url=' + encodeURIComponent(d) + '&matchType=domain&output=json&fl=original,mimetype,statuscode,timestamp&collapse=urlkey&filter=statuscode:200&limit=10000';
  const r = await safeFetch(api, { allow: function (h) { return h === ARCHIVE_HOST; }, follow: true, accept: 'application/json', maxBytes: 8000000, timeout: 25000 }, deps);
  if (!r.ok) return { ok: false, error: 'wayback', message: r.status === 0 ? 'The Wayback Machine didn’t answer (' + (r.error || 'network') + '). Try again in a minute.' : 'The Wayback Machine answered ' + r.status + '. Try again later.' };
  let rows;
  try { rows = JSON.parse(r.text || '[]'); } catch (e) { return { ok: false, error: 'wayback_json', message: 'The Wayback Machine sent an unreadable answer. Try again later.' }; }
  if (!Array.isArray(rows)) rows = [];
  const out = []; let files = 0;
  rows.slice(1).forEach(function (row) {
    const original = row[0], mime = String(row[1] || ''), ts = String(row[3] || '');
    if (!/text\/html|application\/xhtml|application\/pdf|^image\//i.test(mime) && mime !== 'warc/revisit' && mime !== 'unk') return;
    const k = keyFor(original, d); if (!k) return;
    if (/^image\//i.test(mime) || /pdf/i.test(mime)) { k.is_page = false; if (++files > 600) return; }
    out.push(Object.assign(k, { sources: ['wayback'], archive_ts: ts }));
  });
  // keep the newest snapshot per path
  const newest = new Map();
  out.forEach(function (c) { const p = newest.get(c.path); if (!p || String(c.archive_ts) > String(p.archive_ts)) newest.set(c.path, c); });
  return { ok: true, total: rows.length ? rows.length - 1 : 0, candidates: Array.from(newest.values()) };
}

/** Is the domain already pointing at LeadPages? (Then the old site can only be read from the archive.) */
async function isOnLeadPages(domain, deps) {
  const d = cleanDomain(domain);
  const r = await safeFetch('https://' + d + '/api/seo-saver/hits', { allow: function (h) { return hostsFor(d).has(h); }, follow: true, accept: 'application/json', maxBytes: 4000, timeout: 6000 }, deps);
  if (r.status !== 401) return false;
  try { return JSON.parse(r.text || '{}').error === 'auth'; } catch (e) { return false; }
}

/**
 * Read one old page. opts.archiveOnly: the old site is gone (domain is on LeadPages).
 * Returns the fields to store on the candidate plus links:[candidate…] found on the page.
 */
async function readPage(domain, cand, opts, deps) {
  opts = opts || {};
  const d = cleanDomain(domain), hosts = hostsFor(d);
  const pageUrl = cand.url || ('https://' + d + cand.path);
  const fields = { fetched_at: new Date().toISOString(), fetch_error: null };
  let r = null, from = 'live';
  if (!opts.archiveOnly) {
    r = await safeFetch(pageUrl, { allow: function (h) { return hosts.has(h); }, follow: false, timeout: opts.timeout || 8000 }, deps);
    fields.old_status = r.status || null;
    if (r.redirect && r.location) {
      const k = keyFor(r.location, d);
      if (k && k.path !== cand.path) {
        fields.old_final = k.path;
        // read the page the old site sent it to, for its content
        r = await safeFetch(r.location, { allow: function (h) { return hosts.has(h); }, follow: true, timeout: opts.timeout || 8000 }, deps);
      } else if (k) {
        // http→https or www→non-www only: same page
        r = await safeFetch(r.location, { allow: function (h) { return hosts.has(h); }, follow: true, timeout: opts.timeout || 8000 }, deps);
        fields.old_status = r.status || fields.old_status;
      }
    }
  }
  const usable = r && r.ok && /<html|<body|<title/i.test(r.text || '');
  if (!usable && cand.is_page !== false && opts.archive !== false) {
    const ts = cand.archive_ts || '2';
    const ar = await safeFetch('https://' + ARCHIVE_HOST + '/web/' + ts + 'id_/' + pageUrl, { allow: function (h) { return h === ARCHIVE_HOST; }, follow: true, timeout: opts.archiveTimeout || 12000 }, deps);
    if (ar.ok && /<html|<body|<title/i.test(ar.text || '')) { r = ar; from = 'archive'; }
    else if (!r) { fields.fetch_error = ar.error || ('archive ' + ar.status); }
  }
  if (!r || !r.ok || !/<html|<body|<title/i.test(r.text || '')) {
    if (!fields.fetch_error) fields.fetch_error = r ? (r.error || ('HTTP ' + r.status)) : 'not_read';
    return { fields: fields, links: [] };
  }
  const x = extractPage(r.text, from === 'archive' ? pageUrl : r.url);
  fields.fetch_from = from;
  fields.title = x.title || null;
  fields.h1 = x.h1 || null;
  fields.description = x.description || null;
  fields.body = x.body || null;
  if (x.canonical) {
    const ck = keyFor(x.canonical, d);
    if (ck && ck.path !== cand.path && !fields.old_final) fields.old_final = ck.path;
  }
  // archived pages link to web.archive.org/web/<ts>/<original>; unwrap those
  const links = [];
  x.links.forEach(function (l) {
    const m = /^https?:\/\/web\.archive\.org\/web\/\d+[a-z_]*\/(.+)$/i.exec(l);
    const k = keyFor(m ? m[1] : l, d);
    if (k && k.path !== cand.path) links.push(Object.assign(k, { sources: ['crawl'] }));
  });
  return { fields: fields, links: merge(links) };
}

/** Google results for site:domain via DataForSEO (one paid request, up to 100 results). */
async function fromGoogle(domain, provider) {
  const dfs = provider || require('./search-intelligence/providers/dataforseo');
  if (!dfs.configured()) return { ok: false, error: 'not_configured', message: 'DataForSEO isn’t set up on this LeadPages install (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD).' };
  const d = cleanDomain(domain);
  const r = await dfs.serp({ keyword: 'site:' + d, depth: 100, mode: 'regular', device: 'desktop', locationCode: 2036, seDomain: 'google.com.au' });
  if (!r || !r.ok) {
    if (r && r.error === 'serp_empty') return { ok: true, candidates: [], message: 'Google shows no pages for site:' + d + '.' };
    return { ok: false, error: (r && r.error) || 'serp', message: (r && r.message) || 'The Google results request failed.' };
  }
  const rows = ((r.snapshot && r.snapshot.results) || []).filter(function (x) { return x && x.url; });
  const out = [];
  rows.forEach(function (x) {
    const k = keyFor(x.url, d); if (!k) return;
    out.push(Object.assign(k, { sources: ['google'], title: x.title || null, description: x.snippet || null }));
  });
  return { ok: true, candidates: merge(out), results: rows.length };
}

/** Old pages with the most backlinks via DataForSEO (one paid request, up to 300 pages). */
async function fromBacklinks(domain, provider) {
  const dfs = provider || require('./search-intelligence/providers/dataforseo');
  if (!dfs.configured()) return { ok: false, error: 'not_configured', message: 'DataForSEO isn’t set up on this LeadPages install (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD).' };
  const d = cleanDomain(domain);
  let json;
  try {
    json = await dfs._post('backlinks/domain_pages/live', { target: d, limit: 300, order_by: ['backlinks,desc'] });
  } catch (e) {
    return { ok: false, error: 'backlinks', message: 'The backlinks request failed: ' + String((e && e.message) || e) };
  }
  const task = dfs._firstTask(json);
  if (task && task.status_code && Number(task.status_code) >= 40000) return { ok: false, error: 'backlinks_task', message: task.status_message || 'The backlinks request failed.' };
  const result = task && Array.isArray(task.result) ? task.result[0] : null;
  const items = result && Array.isArray(result.items) ? result.items : [];
  const out = [];
  items.forEach(function (it) {
    const k = keyFor(it.page || it.url, d); if (!k) return;
    const sum = it.page_summary || it;
    out.push(Object.assign(k, {
      sources: ['backlinks'],
      backlinks: sum.backlinks != null ? Number(sum.backlinks) : null,
      referring_domains: sum.referring_domains != null ? Number(sum.referring_domains) : null,
      title: (it.meta && it.meta.title) || null
    }));
  });
  return { ok: true, candidates: merge(out), results: items.length };
}

module.exports = {
  cleanDomain: cleanDomain, validDomain: validDomain, hostsFor: hostsFor, isPrivateIp: isPrivateIp, checkHost: checkHost,
  safeFetch: safeFetch, keyFor: keyFor, extractPage: extractPage, parseSitemap: parseSitemap, merge: merge,
  fromSitemaps: fromSitemaps, fromWayback: fromWayback, isOnLeadPages: isOnLeadPages, readPage: readPage,
  fromGoogle: fromGoogle, fromBacklinks: fromBacklinks, ARCHIVE_HOST: ARCHIVE_HOST
};
