'use strict';

/**
 * Partner showcase library (Nov 2026).
 *
 * The platform owner ticks LeadPages sites in /manage ("Partner showcase"); those rows live in
 * public.partner_showcase_library. Each partner then decides what their page shows:
 *
 *   mode 'all'      every library site, newest first (up to MAX)
 *   mode 'random'   `count` library sites, a fresh mix on every page view
 *   mode 'selected' the sites they ticked; with autoAdd on, sites added to the library after
 *                   their last save (not in `seen`) are shown too
 *   mode 'off'      nothing from the library
 *
 * Settings: websiteProfile.showcaseLibrary = { mode, count, autoAdd, selected, seen, title, sub }.
 * Only live sites without a preview password are ever shown.
 */

const MAX = 9;
const MODES = ['all', 'random', 'selected', 'off'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULTS = {
  mode: 'random',
  count: 3,
  autoAdd: true,
  selected: [],
  seen: [],
  title: '',
  sub: ''
};

const DEFAULT_COPY = {
  kicker: 'Built on LeadPages',
  title: 'Real websites, live right now',
  sub: 'A few of the LeadPages sites working for Australian businesses today. Tap any one to explore it.',
  more: 'See more sites',
  less: 'Show fewer',
  view: 'View live site'
};

function cleanIds(list, max) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = {};
  list.forEach(function(v) {
    const s = String(v || '').trim();
    if (!UUID.test(s) || seen[s]) return;
    seen[s] = true;
    out.push(s.toLowerCase());
  });
  return out.slice(0, max || 200);
}

function cleanLibraryConfig(input) {
  const src = input && typeof input === 'object' ? input : {};
  const mode = MODES.indexOf(src.mode) >= 0 ? src.mode : DEFAULTS.mode;
  let count = parseInt(src.count, 10);
  if (!Number.isFinite(count)) count = DEFAULTS.count;
  count = Math.max(1, Math.min(MAX, count));
  return {
    mode: mode,
    count: count,
    autoAdd: src.autoAdd === undefined ? DEFAULTS.autoAdd : !!src.autoAdd,
    selected: cleanIds(src.selected, 60),
    seen: cleanIds(src.seen, 400),
    title: String(src.title || '').replace(/\s+/g, ' ').trim().slice(0, 120),
    sub: String(src.sub || '').replace(/\s+/g, ' ').trim().slice(0, 300)
  };
}

function shuffle(list, rand) {
  const a = list.slice();
  const r = typeof rand === 'function' ? rand : Math.random;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/**
 * Which library cards a partner page shows. `cards` are newest first.
 * opts.excludeIds: ids already on the page (the partner's own sites).
 */
function pickLibrary(cfgInput, cards, opts) {
  opts = opts || {};
  const cfg = cleanLibraryConfig(cfgInput);
  const exclude = new Set((opts.excludeIds || []).map(function(x) { return String(x).toLowerCase(); }));
  const pool = (cards || []).filter(function(c) { return c && c.id && !exclude.has(String(c.id).toLowerCase()); });
  const limit = Math.max(0, Math.min(MAX, opts.limit == null ? MAX : opts.limit));
  if (cfg.mode === 'off' || !pool.length || !limit) return [];
  if (cfg.mode === 'all') return pool.slice(0, limit);
  if (cfg.mode === 'random') return shuffle(pool, opts.random).slice(0, Math.min(cfg.count, limit));
  // selected
  const byId = {};
  pool.forEach(function(c) { byId[String(c.id).toLowerCase()] = c; });
  const out = [];
  cfg.selected.forEach(function(id) { if (byId[id]) out.push(byId[id]); });
  if (cfg.autoAdd) {
    const seen = new Set(cfg.seen);
    const chosen = new Set(cfg.selected);
    pool.forEach(function(c) {
      const id = String(c.id).toLowerCase();
      if (!seen.has(id) && !chosen.has(id)) out.push(c);
    });
  }
  return out.slice(0, limit);
}

function hostOf(row, base) {
  const dom = String(row.custom_domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (dom) return dom;
  return String(base || 'leadpages.com.au') + '/' + row.slug;
}

function httpsUrl(v) {
  const s = String(v || '').trim();
  return /^https:\/\//i.test(s) ? s : '';
}

/** A library site row -> card data used by every partner design. */
function libraryCard(row, base) {
  if (!row || !row.id || !row.slug) return null;
  base = base || 'leadpages.com.au';
  const theme = row.theme || {};
  const logo = row.logo || {};
  const sc = row.showcase || {};
  const dom = String(row.custom_domain || '').trim().toLowerCase();
  const color = [theme.hivis, theme.accent, theme.pipe].find(function(v) { return /^#[0-9a-f]{3,8}$/i.test(String(v || '')); }) || '';
  const dark = [theme.steel, theme.pipe].find(function(v) { return /^#[0-9a-f]{3,8}$/i.test(String(v || '')); }) || '';
  return {
    id: String(row.id).toLowerCase(),
    slug: row.slug,
    name: String(row.business_name || row.slug).trim(),
    industry: String(row.trade || '').trim(),
    host: hostOf(row, base),
    url: dom ? 'https://' + dom + '/' : 'https://' + base + '/' + encodeURIComponent(row.slug),
    frameUrl: 'https://' + base + '/' + encodeURIComponent(row.slug) + '?lp_embed=1',
    image: httpsUrl(sc.image),
    logo: logo.mode === 'text' ? '' : httpsUrl(logo.imageUrl),
    logoBg: /^#[0-9a-f]{3,8}$/i.test(String(logo.headerBg || '')) ? logo.headerBg : '',
    color: color,
    dark: dark,
    addedAt: row.added_at || null,
    source: 'library'
  };
}

const SITE_SELECT = 'id,slug,business_name,custom_domain,status,preview_password,'
  + 'theme:config->theme,logo:config->logo,trade:config->>trade,showcase:config->showcase';

/**
 * Library cards, newest first. Returns { cards, ready } — ready=false when the table has not
 * been created yet (the page then simply shows no library section).
 */
async function fetchLibraryCards(supabase, base, opts) {
  opts = opts || {};
  if (!supabase) return { cards: [], ready: false };
  let lib;
  try {
    lib = await supabase.from('partner_showcase_library')
      .select('site_id,added_at,sort_order')
      .order('added_at', { ascending: false })
      .limit(200);
  } catch (e) { lib = { error: e }; }
  if (lib.error) return { cards: [], ready: false };
  const rows = lib.data || [];
  if (!rows.length) return { cards: [], ready: true };
  const ids = rows.map(function(r) { return r.site_id; });
  let sites;
  try {
    sites = await supabase.from('sites').select(SITE_SELECT).in('id', ids);
  } catch (e) { sites = { error: e }; }
  if (sites.error) return { cards: [], ready: true };
  const byId = {};
  (sites.data || []).forEach(function(s) { byId[s.id] = s; });
  const cards = [];
  rows.forEach(function(r) {
    const s = byId[r.site_id];
    if (!s) return;
    const publishable = s.status === 'live' && !s.preview_password;
    if (!publishable && !opts.includeUnpublished) return;
    const card = libraryCard(Object.assign({}, s, { added_at: r.added_at }), base);
    if (card) {
      card.live = publishable;
      cards.push(card);
    }
  });
  return { cards: cards, ready: true };
}

/** The partner's own client/demo sites in the same card shape (shown before library sites). */
function ownCards(demos) {
  return (demos || []).filter(function(d) { return d && d.url; }).map(function(d) {
    const url = String(d.url);
    return {
      id: d.id ? String(d.id).toLowerCase() : '',
      slug: d.slug || '',
      name: d.name || d.slug || 'Client site',
      industry: d.industry || '',
      host: url.replace(/^https?:\/\//, '').replace(/[?#].*$/, '').replace(/\/$/, ''),
      url: url,
      frameUrl: url + (url.indexOf('?') >= 0 ? '&' : '?') + 'lp_embed=1',
      // Own sites always show the live page; their picture is only the loading backdrop.
      image: '',
      poster: d.thumbnail || '',
      logo: '',
      logoBg: '',
      color: d.thumbnailColor || '',
      dark: '',
      source: 'own'
    };
  });
}

module.exports = {
  MAX,
  MODES,
  DEFAULTS,
  DEFAULT_COPY,
  cleanLibraryConfig,
  pickLibrary,
  libraryCard,
  fetchLibraryCards,
  ownCards,
  shuffle
};
