// lib/ig/store.mjs
// Dependency-free Supabase access via the PostgREST REST API (uses fetch, no npm install needed).
// All calls use the SERVICE ROLE key and run server-side only. Never expose this key to the browser.

const SB_URL   = process.env.SUPABASE_URL;
const SB_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Adapt these to your existing tenant table without touching code (set them in Vercel env).
const SITES_TABLE = process.env.IG_SITES_TABLE         || 'sites';
const SLUG_COL    = process.env.IG_SITE_SLUG_COLUMN     || 'slug';
const CONFIG_COL  = process.env.IG_SITE_CONFIG_COLUMN   || 'config';

function headers(extra) {
  return Object.assign(
    { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' },
    extra || {}
  );
}

async function sb(path, opts) {
  if (!SB_URL || !SB_KEY) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  opts = opts || {};
  const res = await fetch(SB_URL + '/rest/v1/' + path, {
    method: opts.method || 'GET',
    headers: headers(opts.headers),
    body: opts.body,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error('Supabase ' + res.status + ': ' + t.slice(0, 300));
  }
  if (res.status === 204) return null;
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

// ---- Tenant config (jsonb) -------------------------------------------------
export async function getSiteConfig(slug) {
  const rows = await sb(`${SITES_TABLE}?${SLUG_COL}=eq.${encodeURIComponent(slug)}&select=${CONFIG_COL}`);
  if (!rows || !rows.length) return null;
  return rows[0][CONFIG_COL] || {};
}

export async function saveSiteConfig(slug, config) {
  await sb(`${SITES_TABLE}?${SLUG_COL}=eq.${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ [CONFIG_COL]: config }),
  });
}

// ---- Instagram connections (credentials) -----------------------------------
export async function listEnabledConnections() {
  return (await sb(`ig_connections?enabled=eq.true&select=*`)) || [];
}

export async function getConnection(slug) {
  const rows = await sb(`ig_connections?slug=eq.${encodeURIComponent(slug)}&select=*`);
  return (rows && rows[0]) || null;
}

export async function updateConnection(slug, patch) {
  await sb(`ig_connections?slug=eq.${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
}
