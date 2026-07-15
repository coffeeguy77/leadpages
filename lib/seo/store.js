// lib/seo/store.js
// Supabase access via REST (no npm install). Server-side only (service role key).

const SB_URL  = process.env.SUPABASE_URL;
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLE   = process.env.SEO_SITES_TABLE       || process.env.IG_SITES_TABLE || 'sites';
const SLUG    = process.env.SEO_SITE_SLUG_COLUMN   || 'slug';
const CONFIG  = process.env.SEO_SITE_CONFIG_COLUMN || 'config';
const STATUS  = process.env.SEO_SITE_STATUS_COLUMN || 'status';
const DOMAIN  = process.env.SEO_SITE_DOMAIN_COLUMN || 'custom_domain';

function mapSiteRow(r) {
  if (!r) return null;
  return {
    slug: r[SLUG],
    config: r[CONFIG] || {},
    status: r[STATUS],
    customDomain: r[DOMAIN] || '',
  };
}

function H(extra) {
  return Object.assign({ apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }, extra || {});
}
async function sb(path, opts) {
  if (!SB_URL || !SB_KEY) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  opts = opts || {};
  const r = await fetch(SB_URL + '/rest/v1/' + path, { method: opts.method || 'GET', headers: H(opts.headers), body: opts.body });
  if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + (await r.text().catch(() => '')).slice(0, 200));
  if (r.status === 204) return null;
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

export async function getSiteConfig(slug) {
  const rows = await sb(`${TABLE}?${SLUG}=eq.${encodeURIComponent(slug)}&select=${CONFIG}`);
  return rows && rows[0] ? (rows[0][CONFIG] || {}) : null;
}

export async function listSites() {
  const rows = (await sb(`${TABLE}?select=${SLUG},${CONFIG}`)) || [];
  return rows.map((r) => ({ slug: r[SLUG], config: r[CONFIG] || {} }));
}

/**
 * Lightweight live-site slug listing for sitemap indexes.
 * Paginates with PostgREST Range headers — never loads full config JSON.
 * @returns {{ slugs: string[], total: number, offset: number, limit: number }}
 */
export async function listLiveSiteSlugs(opts) {
  opts = opts || {};
  const offset = Math.max(0, parseInt(opts.offset, 10) || 0);
  const limit = Math.min(5000, Math.max(1, parseInt(opts.limit, 10) || 1000));
  if (!SB_URL || !SB_KEY) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');

  const path =
    `${TABLE}?select=${SLUG}` +
    `&${STATUS}=eq.live` +
    `&${SLUG}=not.is.null` +
    `&order=${SLUG}.asc`;
  const r = await fetch(SB_URL + '/rest/v1/' + path, {
    method: 'GET',
    headers: H({
      Range: offset + '-' + (offset + limit - 1),
      Prefer: 'count=exact'
    })
  });
  if (!r.ok) {
    throw new Error('Supabase ' + r.status + ': ' + (await r.text().catch(() => '')).slice(0, 200));
  }

  let total = 0;
  const cr = r.headers.get('content-range') || r.headers.get('Content-Range') || '';
  // content-range: 0-999/1234  or */0
  const m = cr.match(/\/(\d+|\*)\s*$/);
  if (m && m[1] !== '*') total = parseInt(m[1], 10) || 0;

  const t = await r.text();
  const rows = t ? JSON.parse(t) : [];
  const slugs = (rows || [])
    .map(function (row) { return row && row[SLUG] ? String(row[SLUG]).trim() : ''; })
    .filter(Boolean);

  if (!total) total = offset + slugs.length;
  return { slugs: slugs, total: total, offset: offset, limit: limit };
}

export async function getSiteBySlug(slug) {
  const rows = await sb(
    `${TABLE}?${SLUG}=eq.${encodeURIComponent(slug)}&select=${SLUG},${CONFIG},${STATUS},${DOMAIN}&limit=1`
  );
  return mapSiteRow(rows && rows[0]);
}

export async function getSiteByDomain(domain) {
  let d = String(domain || '').trim().toLowerCase();
  if (!d) return null;
  d = d.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
  if (!d) return null;

  // Some rows may have been saved with/without "www". Try both.
  const select = `${SLUG},${CONFIG},${STATUS},${DOMAIN}`;
  const q = (val) => `${TABLE}?${DOMAIN}=eq.${encodeURIComponent(val)}&select=${select}&limit=1`;

  let rows = await sb(q(d));
  if (rows && rows[0]) return mapSiteRow(rows[0]);

  rows = await sb(q('www.' + d));
  return mapSiteRow(rows && rows[0]);
}

export async function getIntro(slug, suburb) {
  const rows = await sb(`suburb_intros?site=eq.${encodeURIComponent(slug)}&suburb=eq.${encodeURIComponent(suburb)}&select=intro`);
  return rows && rows[0] ? rows[0].intro : null;
}

export async function saveIntro(slug, suburb, intro) {
  await sb('suburb_intros', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ site: slug, suburb, intro, updated_at: new Date().toISOString() }),
  });
}
