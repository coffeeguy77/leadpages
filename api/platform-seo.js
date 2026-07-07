// api/platform-seo.js — Search & indexing for leadpages.com.au (super admin)
//
// GET  — platform SEO config, sitemap stats, Vercel DNS hints
// POST { action:'save'|'regenerate-sitemap'|'push-vercel-txt'|'push-vercel-cname', ... }

const { createClient } = require('@supabase/supabase-js');
const vercel = require('./vercel/_client');

const PLATFORM_KEY = 'platform_seo';
const PLATFORM_DOMAIN = 'leadpages.com.au';
const PLATFORM_ORIGIN = 'https://www.leadpages.com.au';
const SITEMAP_PATH = 'marketing-sitemap.xml';

const DEFAULT_SITEMAP_URLS = [
  'https://www.leadpages.com.au/',
  'https://www.leadpages.com.au/start-your-business',
  'https://www.leadpages.com.au/showcase',
  'https://www.leadpages.com.au/marketplace',
  'https://www.leadpages.com.au/marketplace/instagram-gallery',
  'https://www.leadpages.com.au/marketplace/instagram-project-feed',
  'https://www.leadpages.com.au/marketplace/project-feed',
  'https://www.leadpages.com.au/marketplace/quote-lead-capture',
  'https://www.leadpages.com.au/marketplace/email-campaigns',
  'https://www.leadpages.com.au/marketplace/reviews-trust',
  'https://www.leadpages.com.au/marketplace/promotions',
  'https://www.leadpages.com.au/find-a-partner',
  'https://www.leadpages.com.au/partners',
  'https://www.leadpages.com.au/domains',
  'https://www.leadpages.com.au/resources',
  'https://www.leadpages.com.au/resources/winning-your-first-website-client',
  'https://www.leadpages.com.au/resources/what-to-charge-for-websites-australia',
  'https://www.leadpages.com.au/resources/website-business-school-hours',
];

function sbClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

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

async function requireSuperAdmin(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const ur = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
    });
    const user = await ur.json();
    if (!user || !user.id) return null;
    const sb = sbClient();
    if (!sb) return null;
    const { data: prof } = await sb.from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle();
    if (!prof || !prof.is_super_admin) return null;
    return user;
  } catch {
    return null;
  }
}

function tokenFrom(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  const m = v.match(/google-site-verification=([^\s"'>]+)/i);
  if (m && m[1]) return m[1].trim();
  const c = v.match(/content\s*=\s*["']([^"']+)["']/i);
  if (c && c[1]) return c[1].trim();
  return v.replace(/^['"]|['"]$/g, '').trim();
}

function defaultConfig() {
  return {
    googleSiteVerification: '',
    googleVerificationMethod: 'meta',
    googleVerificationCnameHost: '',
    googleVerificationCnameTarget: '',
    sitemapGeneratedAt: '',
    sitemapUrls: DEFAULT_SITEMAP_URLS.slice(),
  };
}

async function loadConfig() {
  const sb = sbClient();
  if (!sb) return defaultConfig();
  try {
    const { data } = await sb.from('system_pages').select('content').eq('key', PLATFORM_KEY).maybeSingle();
    const base = defaultConfig();
    if (!data || !data.content || typeof data.content !== 'object') return base;
    const c = data.content;
    return Object.assign(base, c, {
      sitemapUrls: Array.isArray(c.sitemapUrls) && c.sitemapUrls.length
        ? c.sitemapUrls.map((u) => String(u).trim()).filter(Boolean)
        : base.sitemapUrls,
    });
  } catch {
    return defaultConfig();
  }
}

async function saveConfig(cfg) {
  const sb = sbClient();
  if (!sb) throw new Error('database_not_configured');
  const { error } = await sb.from('system_pages').upsert({ key: PLATFORM_KEY, content: cfg }, { onConflict: 'key' });
  if (error) throw error;
}

function buildSitemapXml(urls, generatedAt) {
  const esc = (u) => String(u).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lastmod = generatedAt ? new Date(generatedAt).toISOString().slice(0, 10) : '';
  const rows = (urls || []).map((loc) => {
    let row = '  <url><loc>' + esc(loc) + '</loc>';
    if (lastmod) row += '<lastmod>' + esc(lastmod) + '</lastmod>';
    row += '<changefreq>weekly</changefreq></url>';
    return row;
  });
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    rows.join('\n') +
    '\n</urlset>'
  );
}

async function vercelDnsStatus() {
  const domain = PLATFORM_DOMAIN;
  if (!vercel.isConfigured()) {
    return { configured: false, canManageDns: false, reason: 'no_token' };
  }
  try {
    const info = await vercel.getDomainInfo(domain);
    const records = await vercel.listDnsRecords(domain);
    return {
      configured: true,
      canManageDns: !!info,
      domainKnown: !!info,
      records,
      intendedNameservers: (info && info.intendedNameservers) || [],
      nameservers: (info && info.nameservers) || [],
    };
  } catch (e) {
    return { configured: true, canManageDns: false, reason: e.message || 'api_error' };
  }
}

function payloadFrom(cfg) {
  const urls = cfg.sitemapUrls || DEFAULT_SITEMAP_URLS;
  return {
    ok: true,
    domain: PLATFORM_DOMAIN,
    propertyUrl: PLATFORM_ORIGIN + '/',
    sitemapPath: SITEMAP_PATH,
    sitemapFullUrl: PLATFORM_ORIGIN + '/' + SITEMAP_PATH,
    config: {
      googleSiteVerification: cfg.googleSiteVerification || '',
      googleVerificationMethod: cfg.googleVerificationMethod || 'meta',
      googleVerificationCnameHost: cfg.googleVerificationCnameHost || '',
      googleVerificationCnameTarget: cfg.googleVerificationCnameTarget || '',
      sitemapGeneratedAt: cfg.sitemapGeneratedAt || '',
    },
    sitemap: {
      urlCount: urls.length,
      urls,
      generatedAt: cfg.sitemapGeneratedAt || null,
    },
  };
}

module.exports = async (req, res) => {
  const json = (code, obj) => {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify(obj));
  };

  const user = await requireSuperAdmin(req);
  if (!user) return json(401, { ok: false, error: 'super_admin_required' });

  try {
    if (req.method === 'GET') {
      const cfg = await loadConfig();
      const out = payloadFrom(cfg);
      const vdns = await vercelDnsStatus();
      const token = tokenFrom(cfg.googleSiteVerification);
      const txtValue = vercel.normalizeTxtValue(token);
      let txtExists = false;
      let cnameExists = false;
      if (vdns.records && txtValue) {
        txtExists = !!vercel.findMatchingRecord(vdns.records, 'TXT', '', txtValue);
      }
      const ch = (cfg.googleVerificationCnameHost || '').trim();
      const ct = (cfg.googleVerificationCnameTarget || '').trim();
      if (vdns.records && ch && ct) {
        cnameExists = !!vercel.findMatchingRecord(vdns.records, 'CNAME', ch, ct);
      }
      out.vercel = Object.assign({}, vdns, { txtExists, cnameExists });
      return json(200, out);
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const action = String(body.action || 'save').trim();
      const cfg = await loadConfig();

      if (action === 'save') {
        const m = String(body.googleVerificationMethod || cfg.googleVerificationMethod || 'meta').trim();
        cfg.googleVerificationMethod = m;
        const raw = String(body.googleSiteVerification || '').trim();
        const tok = tokenFrom(raw);
        if (tok) cfg.googleSiteVerification = tok;
        else delete cfg.googleSiteVerification;
        if (m === 'cname') {
          cfg.googleVerificationCnameHost = String(body.googleVerificationCnameHost || '').trim();
          cfg.googleVerificationCnameTarget = String(body.googleVerificationCnameTarget || '').trim();
        } else {
          delete cfg.googleVerificationCnameHost;
          delete cfg.googleVerificationCnameTarget;
        }
        if (Array.isArray(body.sitemapUrls)) {
          cfg.sitemapUrls = body.sitemapUrls.map((u) => String(u).trim()).filter(Boolean);
        }
        await saveConfig(cfg);
        return json(200, Object.assign({ ok: true, saved: true }, payloadFrom(cfg)));
      }

      if (action === 'regenerate-sitemap') {
        cfg.sitemapGeneratedAt = new Date().toISOString();
        if (!Array.isArray(cfg.sitemapUrls) || !cfg.sitemapUrls.length) {
          cfg.sitemapUrls = DEFAULT_SITEMAP_URLS.slice();
        }
        await saveConfig(cfg);
        return json(200, Object.assign({ ok: true, regenerated: true }, payloadFrom(cfg)));
      }

      if (action === 'push-vercel-txt') {
        if (!vercel.isConfigured()) return json(503, { ok: false, error: 'vercel_not_configured' });
        const val = tokenFrom(body.value || cfg.googleSiteVerification || '');
        const txtValue = vercel.normalizeTxtValue(val);
        if (!txtValue) return json(400, { ok: false, error: 'verification_value_required' });
        const records = await vercel.listDnsRecords(PLATFORM_DOMAIN);
        const existing = vercel.findMatchingRecord(records, 'TXT', '', txtValue);
        if (existing) return json(200, { ok: true, alreadyExists: true });
        await vercel.createDnsRecord(PLATFORM_DOMAIN, {
          name: '',
          type: 'TXT',
          value: txtValue,
          ttl: 60,
          comment: 'Google Search Console — LeadPages marketing site',
        });
        cfg.googleVerificationMethod = 'vercel-txt';
        cfg.googleSiteVerification = val;
        await saveConfig(cfg);
        return json(200, { ok: true });
      }

      if (action === 'push-vercel-cname') {
        if (!vercel.isConfigured()) return json(503, { ok: false, error: 'vercel_not_configured' });
        const host = String(body.cnameHost || cfg.googleVerificationCnameHost || '').trim();
        const target = String(body.cnameTarget || cfg.googleVerificationCnameTarget || '').trim();
        if (!host || !target) return json(400, { ok: false, error: 'cname_host_and_target_required' });
        const records = await vercel.listDnsRecords(PLATFORM_DOMAIN);
        const existing = vercel.findMatchingRecord(records, 'CNAME', host, target);
        if (existing) return json(200, { ok: true, alreadyExists: true });
        await vercel.createDnsRecord(PLATFORM_DOMAIN, {
          name: host,
          type: 'CNAME',
          value: target,
          ttl: 60,
          comment: 'Google Search Console — LeadPages marketing site',
        });
        cfg.googleVerificationMethod = 'cname';
        cfg.googleVerificationCnameHost = host;
        cfg.googleVerificationCnameTarget = target;
        await saveConfig(cfg);
        return json(200, { ok: true });
      }

      return json(400, { ok: false, error: 'unknown_action' });
    }

    return json(405, { ok: false, error: 'method' });
  } catch (e) {
    console.error('platform-seo error:', e && e.message);
    return json(500, { ok: false, error: e.message || 'server' });
  }
};

module.exports.PLATFORM_KEY = PLATFORM_KEY;
module.exports.PLATFORM_DOMAIN = PLATFORM_DOMAIN;
module.exports.PLATFORM_ORIGIN = PLATFORM_ORIGIN;
module.exports.SITEMAP_PATH = SITEMAP_PATH;
module.exports.DEFAULT_SITEMAP_URLS = DEFAULT_SITEMAP_URLS;
module.exports.loadPlatformSeoConfig = loadConfig;
module.exports.tokenFrom = tokenFrom;
module.exports.buildMarketingSitemapXml = buildSitemapXml;
module.exports.injectGoogleMeta = function injectGoogleMeta(html, cfg) {
  const method = (cfg && cfg.googleVerificationMethod) || 'meta';
  if (method !== 'meta') return html;
  const token = tokenFrom(cfg && cfg.googleSiteVerification);
  if (!token) return html;
  const esc = token.replace(/"/g, '&quot;');
  const meta = '<meta name="google-site-verification" content="' + esc + '">';
  if (/<meta[^>]*name=["']google-site-verification["']/i.test(html)) {
    return html.replace(/<meta[^>]*name=["']google-site-verification["'][^>]*>/i, meta);
  }
  return html.replace(/<head(\s[^>]*)?>/i, (m) => m + '\n' + meta);
};
