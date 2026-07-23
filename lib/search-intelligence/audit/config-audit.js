'use strict';

/**
 * First-party audit of sites.config (and related) for Search Intelligence NBA.
 * Does not crawl live HTML — inspects saved configuration the renderer uses.
 * See docs/search-intelligence/03-CONNECTORS.md (first-party advantage).
 */

const { getRecipe } = require('../recipes/registry');

function trim(s) {
  return String(s == null ? '' : s).trim();
}

function publishedPages(cfg) {
  const pages = Array.isArray(cfg.pages) ? cfg.pages : [];
  return pages.filter(function (p) {
    return p && String(p.status || '').toLowerCase() === 'published';
  });
}

function pushFinding(out, f) {
  const recipe = f.recipeId ? getRecipe(f.recipeId) : null;
  out.push({
    id: f.id,
    code: f.code,
    recipeId: f.recipeId || null,
    title: f.title || (recipe && recipe.title) || f.code,
    plainLanguage: f.plainLanguage || (recipe && recipe.plainLanguage) || '',
    severity: f.severity || (recipe && recipe.severityDefault) || 'medium',
    status: 'open',
    actions: f.actions || (recipe && recipe.actions) || ['open_editor_seo', 'create_task'],
    autoFixAllowed: false,
    evidence: Object.assign({ source: 'config_audit' }, f.evidence || {}),
    labelClass: 'measured',
    editorSection: f.editorSection || 'seoTokens'
  });
}

/**
 * @param {object} cfg sites.config
 * @param {{ siteId?: string, businessName?: string }} [meta]
 */
function auditSiteConfig(cfg, meta) {
  const c = cfg && typeof cfg === 'object' ? cfg : {};
  const findings = [];
  const m = meta || {};

  const siteTitle = trim(c.seoTitle);
  const siteDesc = trim(c.seoDescription);
  if (!siteTitle) {
    pushFinding(findings, {
      id: 'cfg:missing_site_title',
      code: 'missing_site_title',
      recipeId: 'high_impr_low_ctr',
      title: 'Homepage is missing an SEO title',
      plainLanguage:
        'Search results need a clear title. Add seoTitle in Local SEO / site settings so Google is not guessing from the business name alone.',
      severity: 'high',
      editorSection: 'seoTokens',
      evidence: { field: 'seoTitle' }
    });
  }
  if (!siteDesc) {
    pushFinding(findings, {
      id: 'cfg:missing_site_meta',
      code: 'missing_site_meta',
      recipeId: 'high_impr_low_ctr',
      title: 'Homepage is missing a meta description',
      plainLanguage:
        'A short meta description helps clicks from search. Add seoDescription for the homepage.',
      severity: 'medium',
      editorSection: 'seoTokens',
      evidence: { field: 'seoDescription' }
    });
  }

  const pages = publishedPages(c);
  const titleMap = {};
  if (siteTitle) {
    titleMap[siteTitle.toLowerCase()] = [{ kind: 'home', title: siteTitle }];
  }

  pages.forEach(function (p) {
    const title = trim(p.title || p.h1);
    const metaDesc = trim(p.meta || p.metaDescription || p.description);
    const slug = trim(p.slug || p.path || p.id);
    if (!title) {
      pushFinding(findings, {
        id: 'cfg:landing_title:' + slug,
        code: 'landing_missing_title',
        recipeId: 'high_impr_low_ctr',
        title: 'Landing page missing title',
        plainLanguage: 'Published page “' + (slug || 'untitled') + '” has no title for search snippets.',
        severity: 'high',
        actions: ['create_task'],
        evidence: { slug: slug, pageId: p.id || null }
      });
    } else {
      const key = title.toLowerCase();
      if (!titleMap[key]) titleMap[key] = [];
      titleMap[key].push({ kind: 'landing', title: title, slug: slug });
    }
    if (!metaDesc) {
      pushFinding(findings, {
        id: 'cfg:landing_meta:' + slug,
        code: 'landing_missing_meta',
        recipeId: 'high_impr_low_ctr',
        title: 'Landing page missing meta description',
        plainLanguage: 'Published page “' + (title || slug) + '” has no meta description.',
        severity: 'medium',
        actions: ['create_task'],
        evidence: { slug: slug, pageId: p.id || null }
      });
    }
  });

  Object.keys(titleMap).forEach(function (key) {
    if (titleMap[key].length < 2) return;
    pushFinding(findings, {
      id: 'cfg:dup_title:' + key.slice(0, 40),
      code: 'duplicate_titles',
      recipeId: 'cannibalisation',
      title: 'Duplicate titles across pages',
      plainLanguage:
        'Several pages share the title “' +
        titleMap[key][0].title +
        '”. Differentiate titles so Google knows which page to rank.',
      severity: 'high',
      evidence: { pages: titleMap[key] }
    });
  });

  const areas =
    (c.sections &&
      c.sections.serviceAreas &&
      Array.isArray(c.sections.serviceAreas.areas) &&
      c.sections.serviceAreas.areas) ||
    [];
  const areaOn = !!(c.sections && c.sections.serviceAreas && c.sections.serviceAreas.on === true);
  if (areaOn && areas.length === 0) {
    pushFinding(findings, {
      id: 'cfg:empty_service_areas',
      code: 'empty_service_areas',
      recipeId: 'location_service_gap',
      title: 'Service Areas is on but empty',
      plainLanguage:
        'Suburb SEO pages only publish for listed service areas. Add suburbs you actually serve, or turn the section off.',
      severity: 'high',
      editorSection: 'serviceAreas',
      evidence: { section: 'serviceAreas' }
    });
  }

  const quoteOn = !(c.sections && c.sections.quote && c.sections.quote.on === false);
  const oqOn = !!(c.sections && c.sections.onlineQuote && c.sections.onlineQuote.on === true);
  const phone = trim(c.phone || c.phoneText);
  if (!quoteOn && !oqOn && !phone) {
    pushFinding(findings, {
      id: 'cfg:no_conversion_path',
      code: 'no_conversion_path',
      recipeId: 'traffic_no_convert',
      title: 'No clear call or form path',
      plainLanguage:
        'The site has no phone number and quote forms are off. Visitors from search may leave without converting.',
      severity: 'high',
      editorSection: 'quote',
      evidence: { phone: false, quoteOn: quoteOn, onlineQuoteOn: oqOn }
    });
  }

  const pg = (c.sections && c.sections.premiumGallery) || {};
  if (pg.on === true) {
    const imgs = Array.isArray(pg.images) ? pg.images.filter(function (im) {
      return im && im.on !== false && trim(im.src);
    }) : [];
    if (!imgs.length) {
      pushFinding(findings, {
        id: 'cfg:premium_gallery_empty',
        code: 'premium_gallery_empty',
        recipeId: null,
        title: 'Premium Gallery is on without images',
        plainLanguage:
          'Premium Gallery is enabled but has no images. Add photos or turn the app off in App Marketplace.',
        severity: 'medium',
        actions: ['create_task'],
        editorSection: 'premiumGallery',
        evidence: { section: 'premiumGallery', imageCount: 0 }
      });
    }
  }

  const severityRank = { critical: 0, high: 1, medium: 2, low: 3 };
  findings.sort(function (a, b) {
    return (severityRank[a.severity] || 9) - (severityRank[b.severity] || 9);
  });

  return {
    ok: true,
    siteId: m.siteId || null,
    businessName: m.businessName || null,
    auditedAt: new Date().toISOString(),
    source: 'sites.config',
    issueCount: findings.length,
    findings: findings
  };
}

module.exports = {
  auditSiteConfig: auditSiteConfig,
  publishedPages: publishedPages
};
