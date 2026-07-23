'use strict';

/**
 * First-party HTML crawl of Leadpages-published URLs only (SSRF-safe).
 * Compares live <title>/meta/canonical to sites.config expectations.
 */

const { getRecipe } = require('../recipes/registry');

function trim(s) {
  return String(s == null ? '' : s).trim();
}

function extractTag(html, re) {
  const m = String(html || '').match(re);
  return m ? trim(m[1]).replace(/\s+/g, ' ') : '';
}

function parseHead(html) {
  const head = String(html || '').slice(0, 120000);
  return {
    title: extractTag(head, /<title[^>]*>([\s\S]*?)<\/title>/i),
    description: extractTag(
      head,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i
    ) || extractTag(
      head,
      /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i
    ),
    canonical: extractTag(
      head,
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i
    ) || extractTag(
      head,
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i
    ),
    robots: extractTag(
      head,
      /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i
    ),
    h1: extractTag(head, /<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, '')
  };
}

/**
 * Build allowlisted origin for a site row.
 * @param {{ custom_domain?: string, slug?: string, status?: string }} site
 * @param {{ appOrigin?: string }} [opts]
 */
function siteOrigin(site, opts) {
  const o = opts || {};
  const domain = trim(site && site.custom_domain).toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (domain && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) && domain.indexOf('localhost') < 0) {
    return 'https://' + domain;
  }
  const slug = trim(site && site.slug);
  const app = trim(o.appOrigin || process.env.APP_URL || 'https://app.leadpages.com.au').replace(/\/+$/, '');
  // Tenant public pages are typically on marketing host — use slug path on known host only.
  const publicHost = trim(process.env.SI_PUBLIC_SITE_ORIGIN || 'https://leadpages.com.au').replace(/\/+$/, '');
  if (slug) return publicHost + '/' + encodeURIComponent(slug);
  return null;
}

function pushFinding(out, f) {
  const recipe = f.recipeId ? getRecipe(f.recipeId) : null;
  out.push({
    id: f.id,
    code: f.code,
    recipeId: f.recipeId || null,
    title: f.title || (recipe && recipe.title) || f.code,
    plainLanguage: f.plainLanguage || (recipe && recipe.plainLanguage) || '',
    severity: f.severity || 'medium',
    status: 'open',
    actions: f.actions || ['open_editor_seo', 'create_task'],
    autoFixAllowed: false,
    evidence: Object.assign({ source: 'html_crawl' }, f.evidence || {}),
    labelClass: 'measured',
    editorSection: f.editorSection || 'seoTokens'
  });
}

async function fetchText(url, timeoutMs) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = setTimeout(function () {
    try { if (ctrl) ctrl.abort(); } catch (_e) {}
  }, timeoutMs || 8000);
  try {
    const r = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl && ctrl.signal,
      headers: {
        'User-Agent': 'LeadpagesSearchIntelligenceBot/1.0 (+https://leadpages.com.au)',
        Accept: 'text/html'
      }
    });
    const text = await r.text();
    return { ok: r.ok, status: r.status, finalUrl: String(r.url || url), html: text.slice(0, 250000) };
  } finally {
    clearTimeout(t);
  }
}

/**
 * @param {{ id?: string, slug?: string, custom_domain?: string, status?: string }} site
 * @param {object} cfg
 * @param {{ appOrigin?: string, timeoutMs?: number }} [opts]
 */
async function crawlSiteHome(site, cfg, opts) {
  const o = opts || {};
  const findings = [];
  const origin = siteOrigin(site, o);
  if (!origin) {
    return {
      ok: false,
      skipped: true,
      reason: 'no_public_origin',
      findings: [],
      issueCount: 0
    };
  }

  const homeUrl = origin.replace(/\/+$/, '') + '/';
  let fetched;
  try {
    fetched = await fetchText(homeUrl, o.timeoutMs || 8000);
  } catch (e) {
    pushFinding(findings, {
      id: 'crawl:fetch_failed',
      code: 'crawl_fetch_failed',
      recipeId: 'not_indexed',
      title: 'Homepage could not be crawled',
      plainLanguage: 'Could not fetch ' + homeUrl + ' (' + String(e && e.message || e) + '). Check DNS, publish status and HTTPS.',
      severity: 'high',
      evidence: { url: homeUrl }
    });
    return { ok: true, origin: origin, homeUrl: homeUrl, findings: findings, issueCount: findings.length };
  }

  if (!fetched.ok) {
    pushFinding(findings, {
      id: 'crawl:http_' + fetched.status,
      code: 'crawl_http_error',
      recipeId: 'not_indexed',
      title: 'Homepage returned HTTP ' + fetched.status,
      plainLanguage: 'Crawling ' + homeUrl + ' returned status ' + fetched.status + '. Fix hosting/publish before expecting rankings.',
      severity: fetched.status === 404 ? 'critical' : 'high',
      evidence: { url: homeUrl, status: fetched.status, finalUrl: fetched.finalUrl }
    });
    return {
      ok: true,
      origin: origin,
      homeUrl: homeUrl,
      status: fetched.status,
      findings: findings,
      issueCount: findings.length
    };
  }

  const head = parseHead(fetched.html);
  const expectTitle = trim(cfg && cfg.seoTitle);
  const expectDesc = trim(cfg && cfg.seoDescription);

  if (!head.title) {
    pushFinding(findings, {
      id: 'crawl:empty_title',
      code: 'crawl_empty_title',
      recipeId: 'high_impr_low_ctr',
      title: 'Live homepage has an empty title tag',
      plainLanguage: 'The published HTML has no document title. Check SEO title settings and republish.',
      severity: 'critical',
      evidence: { url: homeUrl }
    });
  } else if (expectTitle && head.title.toLowerCase().indexOf(expectTitle.toLowerCase().slice(0, 24)) < 0) {
    pushFinding(findings, {
      id: 'crawl:title_mismatch',
      code: 'crawl_title_mismatch',
      recipeId: 'high_impr_low_ctr',
      title: 'Live title differs from saved SEO title',
      plainLanguage:
        'Config seoTitle is “' + expectTitle + '” but live title is “' + head.title + '”. Publish or clear CDN cache.',
      severity: 'medium',
      evidence: { expected: expectTitle, actual: head.title, url: homeUrl }
    });
  }

  if (!head.description && expectDesc) {
    pushFinding(findings, {
      id: 'crawl:missing_meta',
      code: 'crawl_missing_meta',
      recipeId: 'high_impr_low_ctr',
      title: 'Live homepage missing meta description',
      plainLanguage: 'Saved seoDescription is set, but the published HTML has no meta description.',
      severity: 'medium',
      evidence: { url: homeUrl }
    });
  }

  if (!head.canonical) {
    pushFinding(findings, {
      id: 'crawl:missing_canonical',
      code: 'crawl_missing_canonical',
      recipeId: 'not_indexed',
      title: 'Live homepage missing canonical link',
      plainLanguage: 'No rel=canonical was found on the homepage HTML. Confirm the renderer injected {{canonical}}.',
      severity: 'medium',
      evidence: { url: homeUrl }
    });
  }

  if (/noindex/i.test(head.robots || '')) {
    pushFinding(findings, {
      id: 'crawl:noindex',
      code: 'crawl_noindex',
      recipeId: 'not_indexed',
      title: 'Homepage is marked noindex',
      plainLanguage: 'Robots meta includes noindex. Draft/non-live sites are expected; live sites should allow indexing.',
      severity: (site && String(site.status || '').toLowerCase() === 'live') ? 'critical' : 'low',
      evidence: { robots: head.robots, url: homeUrl, siteStatus: site && site.status }
    });
  }

  return {
    ok: true,
    origin: origin,
    homeUrl: homeUrl,
    status: fetched.status,
    finalUrl: fetched.finalUrl,
    head: head,
    findings: findings,
    issueCount: findings.length,
    crawledAt: new Date().toISOString()
  };
}

module.exports = {
  siteOrigin: siteOrigin,
  parseHead: parseHead,
  crawlSiteHome: crawlSiteHome
};
