// api/site/sitemap.js — preview and regenerate per-tenant sitemap.xml
//
// GET  ?siteId=<uuid>  -> counts, landing page list, generatedAt
// POST { siteId, action:'regenerate' } -> bump sitemapGeneratedAt, return fresh counts

const { createClient } = require('@supabase/supabase-js');
const {
  buildSiteSitemapEntries,
  buildSitemapXml,
  sitemapCounts,
  siteSitemapOrigin,
} = require('../../lib/seo/sitemap.js');

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
    .select('id,slug,custom_domain,config,status,owner_user_id,servicing_partner_id,referring_partner_id')
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

function sitemapPayload(site) {
  const customDomain = normDomain(site.custom_domain);
  const origin = siteSitemapOrigin({ slug: site.slug, customDomain, custom_domain: site.custom_domain });
  const entries = buildSiteSitemapEntries({
    slug: site.slug,
    config: site.config || {},
    origin,
    customDomain,
  });
  const counts = sitemapCounts(entries);
  const landingPages = entries
    .filter((e) => e.kind === 'landing')
    .map((e) => ({ slug: e.slug, title: e.title, loc: e.loc }));
  const fullUrl = customDomain
    ? 'https://' + customDomain + '/sitemap.xml'
    : site.slug
      ? 'https://leadpages.com.au/' + site.slug + '/sitemap.xml'
      : '';
  return {
    counts,
    landingPages,
    entries,
    generatedAt: (site.config && site.config.sitemapGeneratedAt) || null,
    sitemapPath: 'sitemap.xml',
    fullUrl,
    xml: buildSitemapXml(entries),
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
    const getSiteId = String(url.searchParams.get('siteId') || '').trim();

    if (req.method === 'GET') {
      if (!getSiteId) return json(400, { ok: false, error: 'siteId required' });
      const access = await assertSiteAccess(user, getSiteId);
      if (!access.ok) return json(access.code, { ok: false, error: access.error });
      const payload = sitemapPayload(access.site);
      return json(200, {
        ok: true,
        counts: payload.counts,
        landingPages: payload.landingPages,
        generatedAt: payload.generatedAt,
        sitemapPath: payload.sitemapPath,
        fullUrl: payload.fullUrl,
      });
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const siteId = String(body.siteId || '').trim();
      const action = String(body.action || '').trim();
      if (!siteId) return json(400, { ok: false, error: 'siteId required' });
      if (action !== 'regenerate') return json(400, { ok: false, error: 'unknown_action' });

      const access = await assertSiteAccess(user, siteId);
      if (!access.ok) return json(access.code, { ok: false, error: access.error });

      const cfg = Object.assign({}, access.site.config || {}, {
        sitemapGeneratedAt: new Date().toISOString(),
      });
      const { error } = await admin.from('sites')
        .update({ config: cfg, updated_at: new Date().toISOString() })
        .eq('id', siteId);
      if (error) return json(500, { ok: false, error: error.message || 'save_failed' });

      const site = Object.assign({}, access.site, { config: cfg });
      const payload = sitemapPayload(site);
      return json(200, {
        ok: true,
        regenerated: true,
        generatedAt: cfg.sitemapGeneratedAt,
        counts: payload.counts,
        landingPages: payload.landingPages,
        sitemapPath: payload.sitemapPath,
        fullUrl: payload.fullUrl,
      });
    }

    return json(405, { ok: false, error: 'method' });
  } catch (e) {
    console.error('site sitemap error:', e && e.message);
    return json(500, { ok: false, error: e.message || 'server' });
  }
};
