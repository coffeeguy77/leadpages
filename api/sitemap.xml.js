// api/sitemap.xml.js
// Serve per-tenant sitemap.xml on both:
//  - custom domains:        https://clientdomain.com.au/sitemap.xml
//  - platform URL prefixes: https://leadpages.com.au/{slug}/sitemap.xml

const { createClient } = require('@supabase/supabase-js');
const { buildSiteSitemapEntries, buildSitemapXml, isPrimaryHost } = require('../lib/seo/sitemap.js');

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLE = process.env.SEO_SITES_TABLE || process.env.IG_SITES_TABLE || 'sites';
const SLUG_COL = process.env.SEO_SITE_SLUG_COLUMN || 'slug';
const CONFIG_COL = process.env.SEO_SITE_CONFIG_COLUMN || 'config';
const STATUS_COL = process.env.SEO_SITE_STATUS_COLUMN || 'status';
const DOMAIN_COL = process.env.SEO_SITE_DOMAIN_COLUMN || 'custom_domain';

function adminClient() {
  if (!SB_URL || !SB_KEY) return null;
  return createClient(SB_URL, SB_KEY);
}

function hostFromReq(req) {
  const h = String(req.headers.host || '').trim().toLowerCase();
  return h.replace(/^www\./, '');
}

function protoFromReq(req) {
  const xf = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  if (xf === 'http' || xf === 'https') return xf;
  return 'https';
}

function normDomain(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');
}

async function fetchSiteBySlug(slug) {
  const admin = adminClient();
  if (!admin) return null;
  const s = String(slug || '').trim();
  if (!s) return null;
  const { data, error } = await admin
    .from(TABLE)
    .select(`${SLUG_COL},${CONFIG_COL},${STATUS_COL},${DOMAIN_COL}`)
    .eq(SLUG_COL, s)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    slug: data[SLUG_COL],
    config: data[CONFIG_COL] || {},
    status: data[STATUS_COL],
    customDomain: data[DOMAIN_COL] || '',
  };
}

async function fetchSiteByDomain(domain) {
  const admin = adminClient();
  if (!admin) return null;
  const d = normDomain(domain);
  if (!d) return null;

  async function q(val) {
    const { data, error } = await admin
      .from(TABLE)
      .select(`${SLUG_COL},${CONFIG_COL},${STATUS_COL},${DOMAIN_COL}`)
      .eq(DOMAIN_COL, val)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return {
      slug: data[SLUG_COL],
      config: data[CONFIG_COL] || {},
      status: data[STATUS_COL],
      customDomain: data[DOMAIN_COL] || '',
    };
  }

  return (await q(d)) || (await q('www.' + d));
}

function notFound(res) {
  res.statusCode = 404;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.end('Not found');
}

module.exports = async (req, res) => {
  try {
    const proto = protoFromReq(req);
    const host = hostFromReq(req);
    const url = new URL(req.url, `${proto}://${host || 'x'}`);

    const siteSlug = String(url.searchParams.get('slug') || '').trim();
    const onPrimary = isPrimaryHost(host);

    // Custom domain sitemap: /sitemap.xml (no slug param; host is NOT primary).
    // Platform sitemap: /:slug/sitemap.xml -> rewrite passes ?slug=:slug (host IS primary).
    let site = null;
    if (siteSlug) site = await fetchSiteBySlug(siteSlug);
    else if (!onPrimary) site = await fetchSiteByDomain(host);

    if (!site || site.status !== 'live' || !site.slug) return notFound(res);

    const isCustom = !onPrimary && !siteSlug;
    const origin = isCustom ? `${proto}://${normDomain(host)}` : `${proto}://${host}`;
    const entries = buildSiteSitemapEntries({
      slug: site.slug,
      config: site.config,
      origin,
      customDomain: isCustom ? (site.customDomain || host) : null,
    });
    if (!entries.length) return notFound(res);

    const generated = (site.config && site.config.sitemapGeneratedAt) || '';
    res.statusCode = 200;
    res.setHeader('content-type', 'application/xml; charset=utf-8');
    res.setHeader('cache-control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    if (generated) res.setHeader('x-sitemap-generated', generated);
    res.end(buildSitemapXml(entries));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('error');
  }
};

