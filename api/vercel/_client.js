// api/vercel/_client.js — Vercel REST helpers (not a route).
// Used when client domains use Vercel nameservers for DNS (not Dreamscape advanced DNS).

const VERCEL_API = (process.env.VERCEL_API_BASE_URL || 'https://api.vercel.com').replace(/\/+$/, '');

function authToken() {
  // Prefer VERCEL_TOKEN; accept VERCEL_ACCESS_TOKEN (dashboard / historical name).
  return String(process.env.VERCEL_TOKEN || process.env.VERCEL_ACCESS_TOKEN || '').trim();
}

function teamQuery(pathHasQuery) {
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!teamId) return '';
  return (pathHasQuery ? '&' : '?') + 'teamId=' + encodeURIComponent(teamId);
}

async function vercelFetch(path, opts) {
  const token = authToken();
  if (!token) {
    const err = new Error('VERCEL_TOKEN (or VERCEL_ACCESS_TOKEN) is not configured');
    err.code = 'no_token';
    throw err;
  }
  opts = opts || {};
  const url = VERCEL_API + path + teamQuery(path.includes('?'));
  const r = await fetch(url, {
    method: opts.method || 'GET',
    headers: Object.assign(
      { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      opts.headers || {}
    ),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await r.text().catch(() => '');
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
  if (!r.ok) {
    const err = new Error((data && (data.error && data.error.message)) || data.message || ('Vercel API ' + r.status));
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function listDnsRecords(domain) {
  const j = await vercelFetch('/v5/domains/' + encodeURIComponent(domain) + '/records?limit=100');
  return (j && j.records) || [];
}

async function createDnsRecord(domain, record) {
  return vercelFetch('/v2/domains/' + encodeURIComponent(domain) + '/records', {
    method: 'POST',
    body: record,
  });
}

async function getDomainInfo(domain) {
  try {
    return await vercelFetch('/v9/domains/' + encodeURIComponent(domain));
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

function normalizeTxtValue(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (/^google-site-verification=/i.test(v)) return v;
  return 'google-site-verification=' + v;
}

function tokenFromValue(raw) {
  const v = String(raw || '').trim();
  const m = v.match(/google-site-verification=(.+)/i);
  return m ? m[1].trim() : v;
}

function findMatchingRecord(records, type, name, value) {
  const wantName = name == null ? '' : String(name);
  const wantVal = value == null ? '' : String(value);
  return (records || []).find(function (r) {
    return String(r.type || '').toUpperCase() === type
      && String(r.name == null ? '' : r.name) === wantName
      && String(r.value || '') === wantVal;
  }) || null;
}

function projectId() {
  return process.env.VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_ID_OR_NAME || '';
}

function cacheTagForSlug(slug) {
  const s = String(slug || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return s ? ('lp-site-' + s) : '';
}

function cacheTagForSiteId(id) {
  const s = String(id || '').toLowerCase().replace(/[^a-f0-9-]+/g, '').slice(0, 64);
  return s ? ('lp-siteid-' + s) : '';
}

/**
 * Mark CDN cache entries with these tags as stale (background revalidate on next hit).
 * Requires VERCEL_TOKEN (or VERCEL_ACCESS_TOKEN) + VERCEL_PROJECT_ID.
 */
async function invalidateByTags(tags, target) {
  const list = (Array.isArray(tags) ? tags : [tags])
    .map(function (t) { return String(t || '').trim(); })
    .filter(Boolean)
    .slice(0, 16);
  if (!list.length) return { skipped: 'no_tags' };
  const proj = projectId();
  if (!proj) {
    const err = new Error('VERCEL_PROJECT_ID is not configured');
    err.code = 'no_project';
    throw err;
  }
  const q = '?projectIdOrName=' + encodeURIComponent(proj);
  return vercelFetch('/v1/edge-cache/invalidate-by-tags' + q, {
    method: 'POST',
    body: target ? { tags: list, target: target } : { tags: list },
  });
}

/**
 * Add a hostname to the LeadPages Vercel project.
 * POST /v10/projects/{idOrName}/domains
 * @param {string} name
 * @param {{ redirect?: string, redirectStatusCode?: number }} [opts]
 */
async function addProjectDomain(name, opts) {
  const proj = projectId();
  if (!proj) {
    const err = new Error('VERCEL_PROJECT_ID is not configured');
    err.code = 'no_project';
    throw err;
  }
  const body = { name: String(name || '').trim().toLowerCase() };
  if (!body.name) {
    const err = new Error('domain name required');
    err.code = 'bad_name';
    throw err;
  }
  if (opts && opts.redirect) {
    body.redirect = String(opts.redirect).trim().toLowerCase();
    body.redirectStatusCode = opts.redirectStatusCode || 308;
  }
  return vercelFetch('/v10/projects/' + encodeURIComponent(proj) + '/domains', {
    method: 'POST',
    body: body,
  });
}

/**
 * GET /v9/projects/{idOrName}/domains/{domain}
 */
async function getProjectDomain(name) {
  const proj = projectId();
  if (!proj) {
    const err = new Error('VERCEL_PROJECT_ID is not configured');
    err.code = 'no_project';
    throw err;
  }
  const host = String(name || '').trim().toLowerCase();
  try {
    return await vercelFetch(
      '/v9/projects/' + encodeURIComponent(proj) + '/domains/' + encodeURIComponent(host)
    );
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

/**
 * List domains attached to the LeadPages Vercel project (paginated).
 * Uses redirects=false so redirect aliases do not inflate capacity noise as badly.
 */
async function listProjectDomains(opts) {
  const proj = projectId();
  if (!proj) {
    const err = new Error('VERCEL_PROJECT_ID is not configured');
    err.code = 'no_project';
    throw err;
  }
  const maxPages = Math.min(50, Math.max(1, (opts && opts.maxPages) || 20));
  const limit = Math.min(100, Math.max(1, (opts && opts.limit) || 100));
  const includeRedirects = !!(opts && opts.includeRedirects);
  const out = [];
  let until = null;
  for (let page = 0; page < maxPages; page++) {
    let path =
      '/v9/projects/' +
      encodeURIComponent(proj) +
      '/domains?limit=' +
      limit +
      '&redirects=' +
      (includeRedirects ? 'true' : 'false');
    if (until != null) path += '&until=' + encodeURIComponent(String(until));
    const j = await vercelFetch(path);
    const batch = (j && j.domains) || [];
    for (let i = 0; i < batch.length; i++) out.push(batch[i]);
    const next = j && j.pagination && j.pagination.next;
    if (next == null || !batch.length) break;
    until = next;
  }
  return out;
}

async function countProjectDomains(opts) {
  const domains = await listProjectDomains(opts);
  return { count: domains.length, domains: domains };
}

module.exports = {
  isConfigured: () => !!authToken(),
  projectConfigured: () => !!(authToken() && projectId()),
  authToken,
  listDnsRecords,
  createDnsRecord,
  getDomainInfo,
  normalizeTxtValue,
  tokenFromValue,
  findMatchingRecord,
  cacheTagForSlug,
  cacheTagForSiteId,
  invalidateByTags,
  addProjectDomain,
  getProjectDomain,
  listProjectDomains,
  countProjectDomains,
};
