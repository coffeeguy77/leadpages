// api/vercel/_client.js — Vercel REST helpers (not a route).
// Used when client domains use Vercel nameservers for DNS (not Dreamscape advanced DNS).

const VERCEL_API = 'https://api.vercel.com';

function teamQuery(pathHasQuery) {
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!teamId) return '';
  return (pathHasQuery ? '&' : '?') + 'teamId=' + encodeURIComponent(teamId);
}

async function vercelFetch(path, opts) {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    const err = new Error('VERCEL_TOKEN is not configured');
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

module.exports = {
  isConfigured: () => !!process.env.VERCEL_TOKEN,
  listDnsRecords,
  createDnsRecord,
  getDomainInfo,
  normalizeTxtValue,
  tokenFromValue,
  findMatchingRecord,
};
