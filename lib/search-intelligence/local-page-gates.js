'use strict';

/**
 * Evidence gates for safe multi-suburb / local page generation.
 * Never silent-publish; blocks doorway spam and duplicate intents.
 */

const { publishedPages } = require('./audit/config-audit');
const { areasFromSite } = require('./local-opportunity');
const { buildPageBrief, recordBriefAnnotation } = require('./page-optimiser');
const { getRecipe } = require('./recipes/registry');
const { buildSchemaPatch } = require('./schema-patch');

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

function pageTextBlob(p) {
  const parts = [
    p && p.title,
    p && p.slug,
    p && p.seoTitle,
    p && p.seoDescription,
    p && p.h1,
    p && p.suburb,
    p && p.location,
    p && p.body,
    p && p.content
  ];
  return parts
    .filter(Boolean)
    .map(function (x) {
      return String(x);
    })
    .join(' ')
    .toLowerCase();
}

function pagesMentioningArea(cfg, area) {
  const needle = String(area || '').toLowerCase().trim();
  if (!needle) return [];
  return publishedPages(cfg || {}).filter(function (p) {
    return pageTextBlob(p).indexOf(needle) >= 0 || slugify(p.slug || '').indexOf(slugify(needle)) >= 0;
  });
}

function faqCount(cfg) {
  const faq =
    (cfg && cfg.sections && cfg.sections.faq && Array.isArray(cfg.sections.faq.items) && cfg.sections.faq.items) ||
    (cfg && Array.isArray(cfg.faqs) && cfg.faqs) ||
    [];
  return faq.filter(function (f) {
    return f && (f.q || f.question) && (f.a || f.answer || f.body);
  }).length;
}

/**
 * Gate a proposed suburb × service page.
 * @returns {{ allowed: boolean, reasons: string[], warnings: string[], evidence: object }}
 */
function evaluateSuburbPageGate(site, input) {
  const cfg = (site && site.config) || {};
  const area = String((input && (input.area || input.suburb || input.location)) || '').trim();
  const primaryKeyword = String((input && (input.primaryKeyword || input.keyword)) || '').trim();
  const reasons = [];
  const warnings = [];
  const areas = areasFromSite(site).map(function (a) {
    return a.toLowerCase();
  });

  if (!area) reasons.push('suburb_required');
  else if (areas.length && areas.indexOf(area.toLowerCase()) < 0) {
    reasons.push('suburb_not_in_service_areas');
  }

  if (!primaryKeyword) reasons.push('keyword_required');

  const phone = cfg.phone || cfg.phoneText || '';
  if (!phone || String(phone).replace(/\D+/g, '').length < 8) {
    warnings.push('phone_incomplete');
  }

  const faqs = faqCount(cfg);
  if (faqs < 1) warnings.push('no_site_faq_proof');

  const existing = pagesMentioningArea(cfg, area);
  const sameIntent = existing.filter(function (p) {
    const blob = pageTextBlob(p);
    const kw = primaryKeyword.toLowerCase();
    const head = kw.split(/\s+/)[0];
    return kw && (blob.indexOf(kw) >= 0 || (head && blob.indexOf(head) >= 0));
  });
  if (sameIntent.length >= 1) {
    reasons.push('duplicate_local_intent');
  } else if (existing.length >= 2) {
    warnings.push('multiple_area_pages');
  }

  const evidence = {
    area: area || null,
    primaryKeyword: primaryKeyword || null,
    serviceAreas: areasFromSite(site),
    existingAreaPages: existing.map(function (p) {
      return { slug: p.slug || null, title: p.title || p.seoTitle || null };
    }),
    faqCount: faqs,
    hasPhone: !!(phone && String(phone).replace(/\D+/g, '').length >= 8)
  };

  return {
    allowed: reasons.length === 0,
    reasons: reasons,
    warnings: warnings,
    evidence: evidence,
    safeguards: {
      publishAllowed: false,
      autoFixAllowed: false,
      requiresHumanApproval: true,
      note: 'Gates block doorway spam. Brief / Brain draft only — human approve before publish.'
    }
  };
}

/**
 * Config-only local page detectors (recipes 14–17).
 */
function detectLocalPageIssues(site) {
  const cfg = (site && site.config) || {};
  const findings = [];
  const areas = areasFromSite(site);
  const pages = publishedPages(cfg);

  // Thin suburb pages: mention an area but weak SEO / body signals
  pages.forEach(function (p, idx) {
    const blob = pageTextBlob(p);
    const hitArea = areas.find(function (a) {
      return blob.indexOf(String(a).toLowerCase()) >= 0;
    });
    if (!hitArea) return;
    const title = String(p.seoTitle || p.title || '').trim();
    const desc = String(p.seoDescription || '').trim();
    const bodyLen = String(p.body || p.content || '').trim().length;
    const thin =
      title.length < 20 ||
      desc.length < 40 ||
      (bodyLen > 0 && bodyLen < 180) ||
      (!p.body && !p.content && !desc);
    if (thin) {
      const recipe = getRecipe('service_area_page_thin');
      findings.push({
        id: 'local:thin:' + (p.slug || idx),
        code: 'service_area_page_thin',
        recipeId: 'service_area_page_thin',
        title: (recipe && recipe.title) || 'Thin suburb page',
        plainLanguage:
          '“' +
          (p.title || p.slug || 'Local page') +
          '” mentions ' +
          hitArea +
          ' but looks thin — add unique area detail, FAQ and a clear CTA.',
        severity: (recipe && recipe.severityDefault) || 'medium',
        status: 'open',
        actions: (recipe && recipe.actions) || ['page_optimiser', 'create_task'],
        autoFixAllowed: false,
        evidence: {
          source: 'local_page_audit',
          slug: p.slug || null,
          area: hitArea,
          titleLen: title.length,
          descLen: desc.length,
          bodyLen: bodyLen
        },
        labelClass: 'modelled',
        editorSection: 'seoTokens'
      });
    }
  });

  // Duplicate local intent: two published pages share same area + service head term
  const pairs = {};
  pages.forEach(function (p, idx) {
    const blob = pageTextBlob(p);
    areas.forEach(function (area) {
      if (blob.indexOf(String(area).toLowerCase()) < 0) return;
      const key = slugify(area);
      if (!pairs[key]) pairs[key] = [];
      pairs[key].push({ idx: idx, slug: p.slug, title: p.title || p.seoTitle });
    });
  });
  Object.keys(pairs).forEach(function (key) {
    if (pairs[key].length < 2) return;
    const recipe = getRecipe('duplicate_local_intent');
    findings.push({
      id: 'local:dup:' + key,
      code: 'duplicate_local_intent',
      recipeId: 'duplicate_local_intent',
      title: (recipe && recipe.title) || 'Duplicate local landing intents',
      plainLanguage:
        'Multiple published pages mention “' +
        key.replace(/-/g, ' ') +
        '”. Consolidate or differentiate so search isn’t confused.',
      severity: (recipe && recipe.severityDefault) || 'medium',
      status: 'open',
      actions: (recipe && recipe.actions) || ['create_task', 'open_editor_seo'],
      autoFixAllowed: false,
      evidence: { source: 'local_page_audit', areaKey: key, pages: pairs[key] },
      labelClass: 'modelled',
      editorSection: 'seoTokens'
    });
  });

  // Schema missing local business
  const schema = buildSchemaPatch(site, {});
  if (schema.missing && schema.missing.indexOf('local_business') >= 0) {
    const recipe = getRecipe('schema_missing_local');
    findings.push({
      id: 'local:schema_missing',
      code: 'schema_missing_local',
      recipeId: 'schema_missing_local',
      title: (recipe && recipe.title) || 'Local business schema missing',
      plainLanguage: (recipe && recipe.plainLanguage) || 'Add LocalBusiness JSON-LD.',
      severity: (recipe && recipe.severityDefault) || 'medium',
      status: 'open',
      actions: (recipe && recipe.actions) || ['schema_patch', 'create_task'],
      autoFixAllowed: false,
      evidence: { source: 'schema_patch', missing: schema.missing },
      labelClass: 'modelled',
      editorSection: 'seoTokens'
    });
  }

  // Internal links: suburb landings not linked from home nav / featured
  const navBlob = JSON.stringify(
    (cfg.sections && (cfg.sections.nav || cfg.sections.header || cfg.sections.menu)) || cfg.nav || {}
  ).toLowerCase();
  const homeBlob = String(cfg.seoTitle || '') + ' ' + String(cfg.seoDescription || '') + ' ' + navBlob;
  pages.forEach(function (p, idx) {
    const areaHit = areas.find(function (a) {
      return pageTextBlob(p).indexOf(String(a).toLowerCase()) >= 0;
    });
    if (!areaHit) return;
    const slug = String(p.slug || '').toLowerCase();
    const linked =
      (slug && homeBlob.indexOf(slug) >= 0) ||
      homeBlob.indexOf(String(areaHit).toLowerCase()) >= 0 ||
      (p.title && homeBlob.indexOf(String(p.title).toLowerCase()) >= 0);
    if (!linked) {
      const recipe = getRecipe('internal_link_local_gap');
      findings.push({
        id: 'local:ilink:' + (slug || idx),
        code: 'internal_link_local_gap',
        recipeId: 'internal_link_local_gap',
        title: (recipe && recipe.title) || 'Weak links to local money pages',
        plainLanguage:
          'Local page “' +
          (p.title || p.slug || areaHit) +
          '” is not clearly linked from the homepage or nav.',
        severity: (recipe && recipe.severityDefault) || 'medium',
        status: 'open',
        actions: (recipe && recipe.actions) || ['create_task', 'open_editor_seo'],
        autoFixAllowed: false,
        evidence: { source: 'local_page_audit', slug: p.slug || null, area: areaHit },
        labelClass: 'modelled',
        editorSection: 'nav'
      });
    }
  });

  return {
    ok: true,
    siteId: site && site.id,
    findings: findings,
    labelClass: 'modelled'
  };
}

/**
 * Build gated suburb brief (Page Optimiser shape) when evidence gates pass.
 */
function buildGatedSuburbBrief(site, input) {
  const gate = evaluateSuburbPageGate(site, input);
  if (!gate.allowed) {
    return {
      ok: false,
      error: 'gate_failed',
      gate: gate
    };
  }
  const area = String(input.area || input.suburb || input.location).trim();
  const primaryKeyword = String(input.primaryKeyword || input.keyword).trim();
  const cluster = {
    id: input.clusterId || null,
    name: primaryKeyword + ' — ' + area,
    primaryKeyword: primaryKeyword,
    secondaryKeywords: Array.isArray(input.secondaryKeywords) ? input.secondaryKeywords : [],
    location: area,
    head: primaryKeyword.split(/\s+/)[0]
  };
  const brief = buildPageBrief(site, cluster, { pageUrl: input.pageUrl || null });
  brief.gate = gate;
  brief.suburbSlug = slugify(area);
  brief.pageKind = 'suburb';
  brief.safeguards = Object.assign({}, brief.safeguards, gate.safeguards, {
    evidenceGatePassed: true
  });
  return brief;
}

async function recordSuburbBrief(admin, siteId, brief) {
  return recordBriefAnnotation(admin, siteId, brief, {
    annotationType: 'suburb_page_brief',
    title: 'Suburb page brief — ' + (brief.location || '') + ' / ' + (brief.primaryKeyword || '')
  });
}

module.exports = {
  slugify: slugify,
  pagesMentioningArea: pagesMentioningArea,
  evaluateSuburbPageGate: evaluateSuburbPageGate,
  detectLocalPageIssues: detectLocalPageIssues,
  buildGatedSuburbBrief: buildGatedSuburbBrief,
  recordSuburbBrief: recordSuburbBrief
};
