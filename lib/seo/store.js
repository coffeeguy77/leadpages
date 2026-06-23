// lib/seo/store.js
// Supabase access via REST (no npm install). Server-side only (service role key).

const SB_URL  = process.env.SUPABASE_URL;
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLE   = process.env.SEO_SITES_TABLE       || process.env.IG_SITES_TABLE || 'sites';
const SLUG    = process.env.SEO_SITE_SLUG_COLUMN   || 'slug';
const CONFIG  = process.env.SEO_SITE_CONFIG_COLUMN || 'config';

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
