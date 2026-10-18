/**
 * SEO Saver — match an old page to the best page on the new site, by URL *and* content.
 *
 *   const idx = buildIndex(cfg);                 // published pages (+ homepage) of the new site
 *   const m = matchCandidate(candidate, idx);    // { to, confidence 0–100, reason, alternatives[] }
 *
 * candidate: { path, is_page, title, h1, description, body, old_final }
 *   — what discovery read from the old page (live old site or the Wayback Machine).
 *
 * Signals, strongest first:
 *   - the old URL's page name is a page on the new site            (/services/excavation → /excavation)
 *   - the old site itself already redirected it to such a page
 *   - the old page's title/heading matches a new page's title/heading (IDF-weighted, so words every
 *     page shares — the business name, the city — count for little)
 *   - the old page's text is about the same thing (TF-IDF cosine over title, heading, meta and body)
 *   - words in the old URL
 * Confidence also drops when the runner-up is nearly as good (an ambiguous match is not a sure one).
 * Pure functions, no I/O. See docs/features/SEO-Saver.md.
 */
'use strict';
const core = require('./seo-saver');

const STOP = new Set(('a an and are as at be but by for from has have he her his i if in into is it its me my no not of on or our ours she so than that the their them then there these they this to too us was we were what when where which who will with you your yours ' +
  'can do does did get got just also more most other some such only own same very www com au http https html htm php asp aspx index page pages home click read view here').split(' '));

/** Words for matching: lower case, simple singular, no stop words or numbers. */
function words(s) {
  return String(s || '').toLowerCase()
    .replace(/&[a-z]+;|&#\d+;/g, ' ')
    .split(/[^a-z0-9]+/)
    .map(function (t) {
      if (t.length > 4 && /ies$/.test(t)) return t.slice(0, -3) + 'y';
      if (t.length > 3 && /[^s]s$/.test(t)) return t.slice(0, -1);
      return t;
    })
    .filter(function (t) { return t.length > 1 && !STOP.has(t) && !/^\d+$/.test(t); });
}

const SKIP_KEYS = /^(id|slug|status|kind|image|images|img|src|href|url|link|icon|photo|photos|video|layout|style|styles|color|colour|colors|theme|bg|background|type|variant|class|css|font|fontset|anchor|target|mode|align|size|width|height|ratio|order|sectionorder|appearance|preset|_.*)$/i;

/** All human-readable text inside a page object (titles, copy, list items …), up to ~20k chars. */
function collectText(obj, out, depth) {
  out = out || [];
  depth = depth || 0;
  if (depth > 8 || out.join(' ').length > 20000) return out;
  if (typeof obj === 'string') {
    const s = obj.trim();
    if (s && !/^(https?:|\/|#|data:|mailto:|tel:)/i.test(s) && !/^#?[0-9a-f]{3,8}$/i.test(s) && !/^\{|^\[/.test(s)) out.push(s.replace(/<[^>]+>/g, ' '));
    return out;
  }
  if (Array.isArray(obj)) { obj.forEach(function (v) { collectText(v, out, depth + 1); }); return out; }
  if (obj && typeof obj === 'object') {
    Object.keys(obj).forEach(function (k) { if (!SKIP_KEYS.test(k)) collectText(obj[k], out, depth + 1); });
  }
  return out;
}

function bag(fields) {
  // fields: [[text, weight]] → Map term → weight
  const m = new Map();
  fields.forEach(function (f) {
    words(f[0]).forEach(function (t) { m.set(t, (m.get(t) || 0) + f[1]); });
  });
  return m;
}

function vectorize(tf, idf) {
  const v = new Map(); let n = 0;
  tf.forEach(function (w, t) {
    const x = (1 + Math.log(w)) * (idf.get(t) || idf.__max || 1);
    v.set(t, x); n += x * x;
  });
  v.__norm = Math.sqrt(n) || 1;
  return v;
}

function cosine(a, b) {
  let dot = 0;
  const small = a.size < b.size ? a : b, big = small === a ? b : a;
  small.forEach(function (x, t) { const y = big.get(t); if (y) dot += x * y; });
  return dot / (a.__norm * b.__norm);
}

/** Search index of the new site's published pages (+ the homepage). */
function buildIndex(cfg) {
  cfg = cfg || {};
  const pages = (Array.isArray(cfg.pages) ? cfg.pages : []).filter(function (p) { return p && p.slug && p.status === 'published'; });
  const docs = pages.map(function (p) {
    const slugWords = String(p.slug).replace(/[-_]+/g, ' ');
    return {
      to: '/' + String(p.slug).toLowerCase(),
      slug: String(p.slug).toLowerCase(),
      title: String(p.title || p.slug),
      head: String(p.title || '') + ' ' + String(p.h1 || '') + ' ' + String(p.seoTitle || '') + ' ' + slugWords,
      tf: bag([[p.title, 3], [p.seoTitle, 2], [p.h1, 2], [slugWords, 2], [p.meta || p.seoDescription, 1.5], [collectText(p).join(' '), 1]]),
      urlWords: core.tokens(p.slug + ' ' + (p.title || ''))
    };
  });
  const homeText = [cfg.seoTitle, cfg.seoDescription, cfg.businessName || cfg.name].filter(Boolean).join(' ');
  docs.push({
    to: '/', slug: '', title: 'Homepage', home: true,
    head: String(cfg.seoTitle || cfg.businessName || cfg.name || 'home'),
    tf: bag([[cfg.seoTitle, 3], [cfg.businessName || cfg.name, 2], [cfg.seoDescription, 1.5], [collectText(cfg.services || []).join(' '), 0.5]]),
    urlWords: []
  });
  const df = new Map();
  docs.forEach(function (d) { d.tf.forEach(function (w, t) { df.set(t, (df.get(t) || 0) + 1); }); });
  const N = docs.length, idf = new Map(); let mx = 1;
  df.forEach(function (n, t) { const v = Math.log((N + 1) / (n + 1)) + 1; idf.set(t, v); if (v > mx) mx = v; });
  idf.__max = mx;
  docs.forEach(function (d) {
    d.vec = vectorize(d.tf, idf);
    d.headSet = new Set(words(d.head));
  });
  const live = new Set(docs.map(function (d) { return d.to; }));
  return { docs: docs, idf: idf, live: live, pages: pages.map(function (p) { return { slug: p.slug, title: p.title || '' }; }) };
}

/** URL words vs a page (same formula as the live fallback, as a number). */
function urlScore(want, d) {
  if (!want.length || !d.urlWords.length) return 0;
  const have = new Set(d.urlWords);
  let inter = 0; want.forEach(function (t) { if (have.has(t)) inter++; });
  if (!inter) return 0;
  const union = new Set(want.concat(d.urlWords)).size;
  return (inter / want.length) * 0.7 + (inter / union) * 0.3;
}

/** IDF-weighted share of the old title/heading words found in a new page's title/heading. */
function headScore(oldHead, d, idf) {
  if (!oldHead.length) return 0;
  let have = 0, all = 0;
  const seen = new Set();
  oldHead.forEach(function (t) {
    if (seen.has(t)) return; seen.add(t);
    const w = idf.get(t) || idf.__max;
    all += w; if (d.headSet.has(t)) have += w;
  });
  return all ? have / all : 0;
}

function lastName(path) {
  const segs = core.normalizePath(path).split('/').filter(Boolean);
  return segs.length ? segs[segs.length - 1].replace(/\.(html?|php\d?|aspx?|cfm|jsp|shtml)$/i, '') : '';
}

/** TF-IDF vector of an old page (title, heading, description, text, URL words). */
function oldVector(c, idx) {
  const segs = core.normalizePath(String(c.path || '/').split('?')[0]).split('/').filter(Boolean);
  return vectorize(bag([[c.title, 3], [c.h1, 2], [c.description, 1.5], [String(c.body || '').slice(0, 6000), 1], [segs.join(' ').replace(/[-_]+/g, ' '), 1]]), idx.idf);
}

function pct(x) { return Math.max(0, Math.min(100, Math.round(x))); }

/**
 * Best new page for one old address.
 * Returns { to, confidence, reason, alternatives:[{to,score}] } — or { to:null, … } for files.
 */
function matchCandidate(c, idx) {
  const path = String((c && c.path) || '/');
  const isPage = c && c.is_page === false ? false : core.isPageLike(path.split('?')[0]);
  if (!isPage) return { to: null, confidence: 0, reason: 'Image or file — no page match. It shows “not found” unless you add a redirect to a file.', alternatives: [] };
  const npath = core.normalizePath(path.split('?')[0]);
  const hasQuery = path.indexOf('?') >= 0;
  if (npath === '/' && !hasQuery) return { to: '/', confidence: 99, reason: 'The old homepage', alternatives: [] };

  const docs = idx.docs;
  const segs = npath.split('/').filter(Boolean);
  const hasContent = !!(c.title || c.h1 || c.body);
  const oldHead = words(String(c.title || '') + ' ' + String(c.h1 || ''));
  const oldVec = hasContent ? oldVector(c, idx) : null;
  // deepest parent folder that is also a page here ("/gallery/polished-concrete" → /gallery)
  let parent = null;
  for (let s = segs.length - 2; s >= 0 && !parent; s--) parent = docs.filter(function (d) { return !d.home && d.slug === segs[s]; })[0] || null;
  // content similarity of the old page to each new page (0–1); migrated copy scores 0.8+
  const cos = new Map();
  if (hasContent) docs.forEach(function (d) { cos.set(d, cosine(oldVec, d.vec)); });
  function topByContent() {
    let best = null, b = -1, second = -1;
    docs.forEach(function (d) { if (d.home) return; const x = cos.get(d); if (x > b) { second = b; b = x; best = d; } else if (x > second) second = x; });
    return { d: best, cos: b, second: Math.max(0, second) };
  }
  // 1) the page name in the old URL is a page on the new site
  const name = lastName(npath);
  let exact = docs.filter(function (d) { return !d.home && d.slug === name; })[0];
  if (exact && !parent) return { to: exact.to, confidence: 97, reason: 'Same page name: ' + exact.to, alternatives: [] };
  if (exact && (!hasContent || (topByContent().d === exact && cos.get(exact) >= 0.33))) {
    const same = hasContent && cos.get(exact) >= 0.6;
    return {
      to: exact.to, confidence: same ? 97 : hasContent ? 85 : 80,
      reason: 'Same page name: ' + exact.to + (same ? '' : hasContent ? ' (its content only partly matches — worth a look)' : ' (it sat under ' + parent.to + ' on the old site and there’s no old content to confirm it)'),
      alternatives: same ? [] : [{ to: exact.to, score: 85 }, { to: parent.to, score: 50 }]
    };
  }
  if (exact) {
    return {
      to: exact.to, confidence: 60,
      reason: 'Same page name as ' + exact.to + ', but on the old site it sat under ' + parent.to + ' and its content doesn’t read like ' + exact.to + ' — check which fits',
      alternatives: [{ to: exact.to, score: 60 }, { to: parent.to, score: 55 }]
    };
  }
  // 2) the old site already redirected it to a page that exists here
  if (c.old_final) {
    const f = lastName(c.old_final);
    exact = docs.filter(function (d) { return !d.home && d.slug === f; })[0];
    if (exact) return { to: exact.to, confidence: 94, reason: 'The old site already sent it to ' + c.old_final + ', which is ' + exact.to + ' here', alternatives: [] };
    if (core.normalizePath(c.old_final) === '/') return { to: '/', confidence: 90, reason: 'The old site already sent it to its homepage', alternatives: [] };
  }

  // 3) the old page's text is on one new page (content copied across in the migration)
  if (hasContent) {
    const t = topByContent();
    if (t.d && t.cos >= 0.75 && t.cos - t.second >= 0.3) {
      return { to: t.d.to, confidence: 95, reason: 'The old page’s text is on ' + t.d.to + ' (“' + t.d.title + '”)', alternatives: [] };
    }
  }
  // 4) content + title + URL words
  const wantLast = core.tokens(segs[segs.length - 1] || '');
  const wantAll = core.tokens(segs.join(' '));

  const scored = docs.map(function (d) {
    const u = Math.max(urlScore(wantLast, d), 0.85 * urlScore(wantAll, d));
    let s, parts = { url: u };
    if (hasContent) {
      const cv = cos.get(d);
      const h = headScore(oldHead, d, idx.idf);
      parts.content = cv; parts.head = h;
      s = 0.25 * u + 0.4 * Math.min(1, cv * 1.6) + 0.35 * h;
    } else {
      s = u;
    }
    if (d.home) s *= 0.8; // the homepage is about everything; it wins only clearly
    return { d: d, s: s, parts: parts };
  }).sort(function (a, b) { return b.s - a.s; });

  const best = scored[0], second = scored[1] || { s: 0 };
  const alternatives = scored.slice(0, 3).filter(function (x) { return x.s > 0.05; }).map(function (x) { return { to: x.d.to, score: Math.round(x.s * 100) }; });
  if (!best || best.s < 0.18) {
    return {
      to: '/', confidence: hasContent ? 35 : 25,
      reason: hasContent ? 'Nothing on the new site covers this closely — homepage' : 'No page content found and the URL words match nothing — homepage',
      alternatives: alternatives
    };
  }
  // a weak content match under a folder that is a page here → that folder page
  if (parent && best.d !== parent && best.s < 0.5) {
    return {
      to: parent.to, confidence: 55,
      reason: 'It sat under ' + parent.to + ' on the old site; the closest other page (' + best.d.to + ') is only a weak match',
      alternatives: [{ to: parent.to, score: 55 }].concat(alternatives.filter(function (a) { return a.to !== parent.to; })).slice(0, 3)
    };
  }
  const margin = best.s > 0 ? (best.s - second.s) / best.s : 0;
  let conf = 100 * Math.min(1, best.s * 1.15) * (0.55 + 0.45 * margin);
  if (!hasContent) conf = Math.min(conf, 75); // URL words alone are never "sure"
  const why = [];
  if (best.parts.head != null && best.parts.head >= 0.5) why.push('old title “' + String(c.title || c.h1 || '').slice(0, 70) + '” matches “' + best.d.title + '”');
  else if (best.parts.content != null && best.parts.content >= 0.25) why.push('the old page’s text is about the same thing as “' + best.d.title + '”');
  if (best.parts.url >= 0.4) why.push('words in the old URL match');
  if (!why.length) why.push(hasContent ? 'closest content on the new site' : 'closest match by URL words');
  if (margin < 0.15 && second.d) why.push('close runner-up: ' + second.d.to);
  return { to: best.d.to, confidence: pct(conf), reason: why.join('; ').replace(/^./, function (x) { return x.toUpperCase(); }), alternatives: alternatives };
}

module.exports = { words: words, collectText: collectText, buildIndex: buildIndex, matchCandidate: matchCandidate, cosine: cosine, oldVector: oldVector };
