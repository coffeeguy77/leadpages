/**
 * SEO Saver — keep search rankings when a site moves to LeadPages.
 *
 * Rules live in sites.config.seoSaver:
 *   {
 *     on: true,                       // default true when the object exists
 *     notFound: 'smart',              // smart | home | page   (what to do with unknown old URLs)
 *     redirects: [
 *       { from: '/services/excavation', to: '/excavation', code: 301, on: true, source: 'migration', note: '' },
 *       { from: '/images/igallery/resized/1-100/img_0374-51-*', to: '/assets/sites/x/gallery/01.jpg' },  // * = prefix
 *       { from: '/old-section/*', to: '/new-section/*' },        // keeps the rest of the path
 *       { from: '/index.php?Itemid=105', to: '/about' },          // query must contain these params
 *       { from: '/retired-page', code: 410 }                      // gone on purpose
 *     ]
 *   }
 *
 * Pure functions only — api/render.js does the I/O. Matching is case-insensitive,
 * ignores trailing slashes, a leading /index.php segment (Joomla), and repeated
 * slashes; it also tries the path without a .html/.htm/.php/.asp(x) extension.
 *
 * Shared by the server (lib/seo-saver.js → api/render.js) and the editor
 * (window.LPSeoSaver in manage.html, for "Test a URL" and suggestions).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LPSeoSaver = api;
})(this, function () {
'use strict';

const PAGE_EXT = /\.(html?|php\d?|aspx?|cfm|jsp|shtml)$/i;
const ANY_EXT = /\.[a-z0-9]{1,5}$/i;
const KEEP_PARAMS = /^(utm_[a-z_]+|gclid|gbraid|wbraid|fbclid|msclkid|dclid|_ga|mc_cid|mc_eid)$/i;
const STOP = new Set(['and', 'the', 'of', 'in', 'for', 'a', 'an', 'to', 'our', 'us', 'your', 'canberra', 'index', 'php', 'html', 'htm', 'page', 'pages',
  // words old CMSs (Joomla, WordPress, Wix, Squarespace …) put in URLs that say nothing about the content
  'component', 'content', 'article', 'item', 'category', 'view', 'tag', 'node', 'post', 'site', 'en', 'gb', 'au', 'www', 'default', 'home', 'main', 'menu', 'id']);

function safeDecode(s) {
  try { return decodeURIComponent(s); } catch (e) { return s; }
}

/** '/Services//Excavation/' → '/services/excavation'; '/index.php/about' → '/about'. Query is not included. */
function normalizePath(raw) {
  let p = String(raw == null ? '' : raw);
  const q = p.indexOf('?'); if (q >= 0) p = p.slice(0, q);
  const h = p.indexOf('#'); if (h >= 0) p = p.slice(0, h);
  p = safeDecode(p).replace(/\\/g, '/').replace(/\/{2,}/g, '/').trim().toLowerCase();
  if (!p.startsWith('/')) p = '/' + p;
  p = p.replace(/^\/index\.php(?=\/|$)/, '') || '/';
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p || '/';
}

/** Lower-cased query map from '?a=1&B=2' or an object (req.query). */
function queryMap(q, omit) {
  const out = {};
  omit = omit || {};
  if (!q) return out;
  if (typeof q === 'string') {
    q.replace(/^\?/, '').split('&').forEach(function (kv) {
      if (!kv) return;
      const i = kv.indexOf('=');
      const k = safeDecode(i < 0 ? kv : kv.slice(0, i)).toLowerCase();
      const v = i < 0 ? '' : safeDecode(kv.slice(i + 1).replace(/\+/g, ' '));
      if (k && !omit[k]) out[k] = String(v).toLowerCase();
    });
    return out;
  }
  Object.keys(q).forEach(function (k) {
    const lk = String(k).toLowerCase();
    if (omit[lk]) return;
    const v = Array.isArray(q[k]) ? q[k][0] : q[k];
    out[lk] = String(v == null ? '' : v).toLowerCase();
  });
  return out;
}

function parseRule(r, i) {
  if (!r || typeof r !== 'object' || r.on === false) return null;
  let from = String(r.from || '').trim();
  if (!from) return null;
  // Accept full old URLs pasted in ("https://www.old.com.au/services/x").
  from = from.replace(/^[a-z]+:\/\/[^/]+/i, '') || '/';
  const qi = from.indexOf('?');
  const rawPath = qi >= 0 ? from.slice(0, qi) : from;
  const query = qi >= 0 ? queryMap(from.slice(qi + 1)) : null;
  const wild = /\*$/.test(rawPath);
  const path = wild ? normalizePath(rawPath.replace(/\*+$/, '')).replace(/\/$/, '') + (/\/\*$/.test(rawPath) ? '/' : '') : normalizePath(rawPath);
  let code = parseInt(r.code, 10);
  if ([301, 302, 307, 308, 410].indexOf(code) < 0) code = 301;
  const to = String(r.to == null ? '' : r.to).trim();
  if (code !== 410 && !to) return null;
  return { i: i, path: path === '' ? '/' : path, wild: wild, query: query && Object.keys(query).length ? query : null, to: to, code: code, rule: r };
}

const cache = typeof WeakMap === 'function' ? new WeakMap() : null;

/** Compiled rule set for a config (memoised per config object). */
function compile(cfg) {
  const S = cfg && cfg.seoSaver;
  if (!S || typeof S !== 'object' || S.on === false) return null;
  if (cache && cache.has(S)) return cache.get(S);
  const exact = new Map(), withQuery = [], wild = [];
  (Array.isArray(S.redirects) ? S.redirects : []).forEach(function (r, i) {
    const c = parseRule(r, i); if (!c) return;
    if (c.wild) wild.push(c);
    else if (c.query) withQuery.push(c);
    else if (!exact.has(c.path)) exact.set(c.path, c);
  });
  wild.sort(function (a, b) { return b.path.length - a.path.length; }); // most specific first
  const notFound = ['smart', 'home', 'page'].indexOf(S.notFound) >= 0 ? S.notFound : 'smart';
  const out = { exact: exact, withQuery: withQuery, wild: wild, notFound: notFound, count: exact.size + withQuery.length + wild.length };
  if (cache) cache.set(S, out);
  return out;
}

function variants(path) {
  const v = [path];
  if (PAGE_EXT.test(path)) v.push(path.replace(PAGE_EXT, '') || '/');
  return v;
}

/** Find the rule for a request. Returns { rule, to, code } or null. */
function matchRule(compiled, reqPath, reqQuery) {
  if (!compiled) return null;
  const path = normalizePath(reqPath);
  const q = queryMap(reqQuery);
  const vs = variants(path);
  // 1) rules that name query params (most specific)
  for (let k = 0; k < compiled.withQuery.length; k++) {
    const c = compiled.withQuery[k];
    if (vs.indexOf(c.path) < 0) continue;
    if (Object.keys(c.query).every(function (key) { return q[key] === c.query[key]; })) return { rule: c, to: c.to, code: c.code };
  }
  // 2) exact path
  for (let k = 0; k < vs.length; k++) { const c = compiled.exact.get(vs[k]); if (c) return { rule: c, to: c.to, code: c.code }; }
  // 3) prefix (wildcard) rules
  for (let k = 0; k < compiled.wild.length; k++) {
    const c = compiled.wild[k];
    for (let j = 0; j < vs.length; j++) {
      if (vs[j] === c.path.replace(/\/$/, '') || vs[j].indexOf(c.path) === 0) {
        let to = c.to;
        if (/\*$/.test(to)) to = to.replace(/\*+$/, '') + vs[j].slice(c.path.length).replace(/^\//, (/\/$/.test(to.replace(/\*+$/, '')) ? '' : '/'));
        return { rule: c, to: to, code: c.code };
      }
    }
  }
  return null;
}

function tokens(s) {
  return String(s || '').toLowerCase().replace(PAGE_EXT, '').split(/[^a-z0-9]+/)
    .map(function (t) { return t.replace(/(ies)$/, 'y').replace(/([^s])s$/, '$1'); })
    .filter(function (t) { return t && t.length > 1 && !STOP.has(t) && !/^\d+$/.test(t); });
}

/**
 * Closest live page for an unknown old URL.
 * pages: [{ slug, title }] (published only). Returns '/slug' or '/' (home).
 */
function closestPage(reqPath, pages) {
  const path = normalizePath(reqPath);
  const segs = path.split('/').filter(Boolean);
  const live = (pages || []).filter(function (p) { return p && p.slug; });
  if (!segs.length || !live.length) return '/';
  function exactPage(seg) {
    seg = String(seg || '').replace(PAGE_EXT, '');
    return live.filter(function (p) { return String(p.slug).toLowerCase() === seg; })[0] || null;
  }
  function bestByTokens(text) {
    const want = tokens(text);
    if (!want.length) return null;
    let best = null, bestScore = 0;
    live.forEach(function (p) {
      const have = tokens(p.slug + ' ' + (p.title || ''));
      if (!have.length) return;
      const setH = new Set(have);
      let inter = 0; want.forEach(function (t) { if (setH.has(t)) inter++; });
      if (!inter) return;
      const union = new Set(want.concat(have)).size;
      // reward covering what the old URL asked for more than matching every page word
      const score = (inter / want.length) * 0.7 + (inter / union) * 0.3;
      if (score > bestScore) { bestScore = score; best = p; }
    });
    return best && bestScore >= 0.4 - 1e-9 ? best : null;
  }
  const last = segs[segs.length - 1];
  // 1) the last segment is a live page ("/services/excavation" → /excavation)
  let hit = exactPage(last);
  // 2) the last segment closely matches a page ("/services/concrete-driveways-canberra" → /concrete-driveways)
  if (!hit) hit = bestByTokens(last);
  // 3) a parent segment is a live page ("/gallery/old-album" → /gallery)
  for (let s = segs.length - 2; !hit && s >= 0; s--) hit = exactPage(segs[s]);
  // 4) the whole old URL matches a page
  if (!hit) hit = bestByTokens(segs.join(' '));
  return hit ? '/' + hit.slug : '/';
}

/** True for URLs that are web pages (not images, scripts, fonts …). */
function isPageLike(reqPath) {
  const path = normalizePath(reqPath);
  const last = path.split('/').pop() || '';
  return !ANY_EXT.test(last) || PAGE_EXT.test(last);
}

/** Marketing/tracking params worth carrying to the new URL. */
function carryQuery(reqQuery, omit) {
  const raw = reqQuery && typeof reqQuery === 'object' ? reqQuery : {};
  const keep = [];
  Object.keys(raw).forEach(function (k) {
    if (!KEEP_PARAMS.test(k) || (omit && omit[k.toLowerCase()])) return;
    const v = Array.isArray(raw[k]) ? raw[k][0] : raw[k];
    keep.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v == null ? '' : v)));
  });
  return keep.join('&');
}

/**
 * Absolute-path Location for a rule target.
 * base: '' on a custom domain, '/<slug>' on the LeadPages address.
 */
function locationFor(to, base, extraQuery) {
  let t = String(to || '/').trim();
  let loc;
  if (/^https?:\/\//i.test(t)) loc = t;
  else {
    if (!t.startsWith('/') && !t.startsWith('#')) t = '/' + t;
    if (t.startsWith('#')) t = '/' + t;
    if (/^\/(assets|api)\//i.test(t)) loc = t;                 // platform files: never prefixed
    else {
      const pathPart = t.split(/[?#]/)[0];
      const rest = t.slice(pathPart.length);
      const p = pathPart === '/' ? (base || '/') : (base || '') + pathPart;
      loc = (p || '/') + rest;
    }
  }
  if (extraQuery) {
    const hashAt = loc.indexOf('#');
    const head = hashAt >= 0 ? loc.slice(0, hashAt) : loc, tail = hashAt >= 0 ? loc.slice(hashAt) : '';
    loc = head + (head.indexOf('?') >= 0 ? '&' : '?') + extraQuery + tail;
  }
  return loc;
}

const GOOGLE_UA = /Googlebot|Google-InspectionTool|GoogleOther|AdsBot-Google|Mediapartners-Google|Storebot-Google/i;
function isGoogle(ua) { return GOOGLE_UA.test(String(ua || '')); }

/**
 * Decide what to do with a request that did not match a live page.
 *   ctx: { cfg, reqPath, query, base, pages:[{slug,title}], isLivePath(path)->bool }
 * Returns one of:
 *   { action:'redirect', location, code, kind:'redirect'|'fallback', target, path }
 *   { action:'gone', code:410, kind:'gone', path }
 *   { action:'notFound', kind:'not_found', path }   (seoSaver.notFound === 'page' or a non-page file)
 *   null when SEO Saver is off for the site.
 */
function resolve(ctx) {
  const compiled = compile(ctx.cfg);
  if (!compiled) return null;
  const path = normalizePath(ctx.reqPath);
  const omit = ctx.omitQuery || {};
  const q = queryMap(ctx.query, omit);
  // Tracking params (utm_*, gclid …) are not part of the logged URL — one row per page, not per campaign.
  const qKeys = Object.keys(q).filter(function (k) { return !KEEP_PARAMS.test(k); }).sort();
  const qsKey = qKeys.length ? '?' + qKeys.map(function (k) { return k + '=' + q[k]; }).join('&') : '';
  const logPath = (path + qsKey).slice(0, 500);
  const carry = carryQuery(ctx.query, omit);

  const m = matchRule(compiled, path, q);
  if (m) {
    if (m.code === 410) return { action: 'gone', code: 410, kind: 'gone', path: logPath };
    return { action: 'redirect', code: m.code, kind: 'redirect', target: m.to, location: locationFor(m.to, ctx.base, carry), path: logPath };
  }
  // Same page, different spelling (case, trailing slash, .html, /index.php/…): send to the clean URL.
  if (path !== '/' && typeof ctx.isLivePath === 'function') {
    const vs = variants(path);
    for (let k = 0; k < vs.length; k++) {
      if (ctx.isLivePath(vs[k])) return { action: 'redirect', code: 301, kind: 'redirect', target: vs[k], location: locationFor(vs[k], ctx.base, carry), path: logPath };
    }
  }
  if (path === '/' ) {
    // "/index.php" and friends normalise to the homepage — that is a redirect to /, not a 404.
    if (String(ctx.reqPath || '').replace(/\?.*$/, '') !== '/' && String(ctx.reqPath || '') !== '') {
      return { action: 'redirect', code: 301, kind: 'redirect', target: '/', location: locationFor('/', ctx.base, carry), path: logPath };
    }
    return null;
  }
  if (compiled.notFound === 'page' || !isPageLike(path)) return { action: 'notFound', kind: 'not_found', path: logPath };
  const target = compiled.notFound === 'home' ? '/' : closestPage(path, ctx.pages);
  return { action: 'redirect', code: 301, kind: 'fallback', target: target, location: locationFor(target, ctx.base, carry), path: logPath };
}

/** Comparable key of a rule's old address: '/services/x', '/?itemid=105', '/blog*'. */
function ruleKey(from) {
  let f = String(from || '').trim().toLowerCase().replace(/^[a-z]+:\/\/[^/]+/, '');
  const wild = /\*$/.test(f); if (wild) f = f.replace(/\*+$/, '');
  const qi = f.indexOf('?');
  let q = '';
  if (qi >= 0) {
    q = f.slice(qi + 1).split('&').filter(Boolean).sort().join('&');
    f = f.slice(0, qi);
  }
  return normalizePath(f) + (q ? '?' + q : '') + (wild ? '*' : '');
}

/**
 * Give every rule a stable id (from its old address) so the editor's three-way merge can combine
 * rules added in two places (editor + daily monitor) item by item. Existing ids are kept.
 */
function withIds(redirects) {
  const list = Array.isArray(redirects) ? redirects : [];
  const used = new Set();
  list.forEach(function (r) { if (r && r.id) used.add(String(r.id)); });
  list.forEach(function (r) {
    if (!r || typeof r !== 'object' || r.id) return;
    const key = ruleKey(r.from);
    let h = 0x811c9dc5;
    for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    let id = 'ss-' + h.toString(36), n = 2;
    while (used.has(id)) id = 'ss-' + h.toString(36) + '-' + n++;
    r.id = id; used.add(id);
  });
  return list;
}

return {
  ruleKey: ruleKey, withIds: withIds,
  normalizePath: normalizePath, queryMap: queryMap, compile: compile, matchRule: matchRule, closestPage: closestPage,
  isPageLike: isPageLike, locationFor: locationFor, carryQuery: carryQuery, resolve: resolve, isGoogle: isGoogle, tokens: tokens
};
});
