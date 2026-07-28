/**
 * Platform vs custom-domain host classification for api/render.js.
 *
 * Live Preview in manage.html loads `/{slug}?preview=…` on the same host as the
 * editor (`app.leadpages.com.au`). That host must never be treated as a tenant
 * custom domain — and must never be parsed as a partner showcase subdomain
 * (`app` + `.leadpages.com.au`), or every preview 404s.
 *
 * Env `PRIMARY_HOSTS` may omit entries in production. Built-in hosts are always
 * merged in so incomplete env cannot break the editor preview path.
 */

const BUILTIN_PRIMARY_HOSTS = [
  'app.leadpages.com.au',
  'leadpages.com.au',
  'www.leadpages.com.au',
  'leadpages.webculture.au',
  'www.leadpages.webculture.au'
];

/** Subdomain labels that must never become partner showcase slugs. */
const RESERVED_SHOWCASE_LABELS = new Set([
  'www', 'app', 'api', 'manage', 'partner', 'partners', 'partners-admin',
  'tradies', 'domains', 'home', 'admin', 'mail', 'ftp', 'dashboard', 'login',
  'assets', 'static', 'cdn', 'status', 'blog', 'help', 'support', 'leadpages'
]);

function parseHostList(raw) {
  return String(raw || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * @param {string} [envValue] process.env.PRIMARY_HOSTS
 * @returns {string[]}
 */
function resolvePrimaryHosts(envValue) {
  return Array.from(new Set([
    ...BUILTIN_PRIMARY_HOSTS,
    ...parseHostList(envValue)
  ]));
}

/**
 * Normalize request Host (strip port).
 * @param {string} host
 */
function normalizeHost(host) {
  return String(host || '').split(':')[0].trim().toLowerCase();
}

/**
 * True when this host should use slug / marketing routing, not custom_domain lookup.
 * @param {string} host
 * @param {string[]} [primaryHosts]
 */
function isPrimaryHost(host, primaryHosts) {
  const h = normalizeHost(host);
  if (!h) return false;
  const list = Array.isArray(primaryHosts) && primaryHosts.length
    ? primaryHosts
    : resolvePrimaryHosts(process.env.PRIMARY_HOSTS);
  if (list.includes(h)) return true;
  // Defense in depth: editor app host is never a tenant custom domain.
  if (h === 'app.leadpages.com.au') return true;
  return false;
}

/**
 * Partner showcase on `<label>.leadpages.com.au` (and SHOWCASE_BASES).
 * Skips primary/marketing hosts and reserved labels (especially `app`).
 *
 * @param {string} host
 * @param {{ primaryHosts?: string[], showcaseBases?: string[] }} [opts]
 * @returns {{ slug: string, base: string } | null}
 */
function showcaseSlugFromHost(host, opts) {
  const h = normalizeHost(host);
  if (!h) return null;
  const primaryHosts = (opts && opts.primaryHosts)
    || resolvePrimaryHosts(process.env.PRIMARY_HOSTS);
  if (isPrimaryHost(h, primaryHosts)) return null;

  const bases = (opts && Array.isArray(opts.showcaseBases) && opts.showcaseBases.length)
    ? opts.showcaseBases.map(s => String(s).trim().toLowerCase()).filter(Boolean)
    : parseHostList(process.env.SHOWCASE_BASES || 'leadpages.com.au,leadpages.webculture.au');

  for (let i = 0; i < bases.length; i++) {
    const base = bases[i];
    if (!h.endsWith('.' + base)) continue;
    const label = h.slice(0, h.length - ('.' + base).length);
    if (!label || label.indexOf('.') >= 0) continue;
    if (RESERVED_SHOWCASE_LABELS.has(label)) continue;
    return { slug: label, base };
  }
  return null;
}

module.exports = {
  BUILTIN_PRIMARY_HOSTS,
  RESERVED_SHOWCASE_LABELS,
  parseHostList,
  resolvePrimaryHosts,
  normalizeHost,
  isPrimaryHost,
  showcaseSlugFromHost
};
