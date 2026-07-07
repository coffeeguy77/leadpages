// api/site/google-verification.js
// Google Search Console verification helpers — especially Vercel DNS TXT/CNAME.
//
// GET  ?siteId=<uuid>  -> domain, method, record hints, Vercel DNS status
// POST { siteId, action:'push-vercel-txt'|'push-vercel-cname', ... } -> add DNS record

const { createClient } = require('@supabase/supabase-js');
const vercel = require('../vercel/_client');

const SUPABASE_URL = process.env.SUPABASE_URL;
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'string') {
        try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); }
      }
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

async function requireUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  try {
    const userClient = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: 'Bearer ' + token } },
    });
    const { data, error } = await userClient.auth.getUser(token);
    if (error || !data || !data.user) return null;
    return data.user;
  } catch { return null; }
}

async function isSuperAdmin(userId) {
  const { data } = await admin.from('profiles').select('is_super_admin').eq('id', userId).maybeSingle();
  return !!(data && data.is_super_admin);
}

async function partnerIdForUser(userId) {
  const { data } = await admin.from('partners').select('id,status').eq('user_id', userId).maybeSingle();
  if (!data || data.status !== 'active') return null;
  return data.id;
}

async function assertSiteAccess(user, siteId) {
  const { data: site, error } = await admin.from('sites')
    .select('id,slug,custom_domain,config,owner_user_id,servicing_partner_id,referring_partner_id')
    .eq('id', siteId)
    .maybeSingle();
  if (error || !site) return { ok: false, code: 404, error: 'site_not_found' };
  if (await isSuperAdmin(user.id)) return { ok: true, site };
  if (site.owner_user_id && site.owner_user_id === user.id) return { ok: true, site };
  const partnerId = await partnerIdForUser(user.id);
  if (partnerId && (site.servicing_partner_id === partnerId || site.referring_partner_id === partnerId)) {
    return { ok: true, site };
  }
  if (!site.owner_user_id) return { ok: true, site };
  return { ok: false, code: 403, error: 'not_your_site' };
}

function normDomain(raw) {
  return String(raw || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
}

function cfgOf(site) {
  return (site && site.config) || {};
}

async function vercelDnsStatus(domain) {
  if (!domain || !vercel.isConfigured()) {
    return { available: false, reason: vercel.isConfigured() ? 'no_domain' : 'no_token' };
  }
  try {
    const info = await vercel.getDomainInfo(domain);
    const records = await vercel.listDnsRecords(domain);
    return {
      available: true,
      domainKnown: !!info,
      records,
      intendedNameservers: (info && info.intendedNameservers) || [],
      nameservers: (info && info.nameservers) || [],
    };
  } catch (e) {
    return { available: false, reason: e.code === 'no_token' ? 'no_token' : 'api_error', message: e.message };
  }
}

function buildHints(site, domain) {
  const cfg = cfgOf(site);
  const token = vercel.tokenFromValue(cfg.googleSiteVerification || '');
  const method = cfg.googleVerificationMethod || 'meta';
  const txtValue = vercel.normalizeTxtValue(token);
  const cnameHost = (cfg.googleVerificationCnameHost || '').trim();
  const cnameTarget = (cfg.googleVerificationCnameTarget || '').trim();
  return {
    method,
    token,
    metaTag: token ? '<meta name="google-site-verification" content="' + token + '" />' : '',
    txt: { type: 'TXT', name: '@', value: txtValue },
    cname: { type: 'CNAME', name: cnameHost, value: cnameTarget },
    domain,
    hasCustomDomain: !!domain,
  };
}

module.exports = async (req, res) => {
  const json = (code, obj) => {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(obj));
  };

  const user = await requireUser(req);
  if (!user) return json(401, { ok: false, error: 'auth' });

  try {
    const url = new URL(req.url, 'https://x');
    const siteId = String((req.method === 'GET' ? url.searchParams.get('siteId') : '') || '').trim();

    if (req.method === 'GET') {
      if (!siteId) return json(400, { ok: false, error: 'siteId required' });
      const access = await assertSiteAccess(user, siteId);
      if (!access.ok) return json(access.code, { ok: false, error: access.error });

      const domain = normDomain(access.site.custom_domain);
      const hints = buildHints(access.site, domain);
      const vdns = domain ? await vercelDnsStatus(domain) : { available: false, reason: 'no_domain' };

      let txtExists = false;
      let cnameExists = false;
      if (vdns.available && hints.txt.value) {
        txtExists = !!vercel.findMatchingRecord(vdns.records, 'TXT', '', hints.txt.value);
      }
      if (vdns.available && hints.cname.name && hints.cname.value) {
        cnameExists = !!vercel.findMatchingRecord(vdns.records, 'CNAME', hints.cname.name, hints.cname.value);
      }

      return json(200, {
        ok: true,
        hints,
        vercel: {
          configured: vercel.isConfigured(),
          canManageDns: !!(vdns.available && vdns.domainKnown),
          txtExists,
          cnameExists,
          intendedNameservers: vdns.intendedNameservers || [],
          nameservers: vdns.nameservers || [],
          reason: vdns.reason || null,
        },
      });
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const postSiteId = String(body.siteId || '').trim();
      const action = String(body.action || '').trim();
      if (!postSiteId) return json(400, { ok: false, error: 'siteId required' });

      const access = await assertSiteAccess(user, postSiteId);
      if (!access.ok) return json(access.code, { ok: false, error: access.error });

      const domain = normDomain(access.site.custom_domain);
      if (!domain) return json(400, { ok: false, error: 'no_custom_domain' });
      if (!vercel.isConfigured()) return json(503, { ok: false, error: 'vercel_not_configured' });

      const cfg = cfgOf(access.site);
      const token = vercel.tokenFromValue(body.value || cfg.googleSiteVerification || '');

      if (action === 'push-vercel-txt') {
        const txtValue = vercel.normalizeTxtValue(token);
        if (!txtValue) return json(400, { ok: false, error: 'verification_value_required' });

        const records = await vercel.listDnsRecords(domain);
        const existing = vercel.findMatchingRecord(records, 'TXT', '', txtValue);
        if (existing) {
          return json(200, { ok: true, alreadyExists: true, recordId: existing.id });
        }

        const created = await vercel.createDnsRecord(domain, {
          name: '',
          type: 'TXT',
          value: txtValue,
          ttl: 60,
          comment: 'Google Search Console verification (LeadPages)',
        });
        return json(200, { ok: true, recordId: created.uid || created.id || null });
      }

      if (action === 'push-vercel-cname') {
        const cnameHost = String(body.cnameHost || cfg.googleVerificationCnameHost || '').trim();
        const cnameTarget = String(body.cnameTarget || cfg.googleVerificationCnameTarget || '').trim();
        if (!cnameHost || !cnameTarget) return json(400, { ok: false, error: 'cname_host_and_target_required' });

        const records = await vercel.listDnsRecords(domain);
        const existing = vercel.findMatchingRecord(records, 'CNAME', cnameHost, cnameTarget);
        if (existing) {
          return json(200, { ok: true, alreadyExists: true, recordId: existing.id });
        }

        const created = await vercel.createDnsRecord(domain, {
          name: cnameHost,
          type: 'CNAME',
          value: cnameTarget,
          ttl: 60,
          comment: 'Google Search Console verification (LeadPages)',
        });
        return json(200, { ok: true, recordId: created.uid || created.id || null });
      }

      return json(400, { ok: false, error: 'unknown_action' });
    }

    return json(405, { ok: false, error: 'method' });
  } catch (e) {
    console.error('google-verification error:', e && e.message);
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
    return json(status, { ok: false, error: e.message || 'server' });
  }
};
