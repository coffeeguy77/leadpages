'use strict';

/**
 * Detect tracked keywords with no matching published page (keyword_no_page).
 */

const { publishedPages } = require('./audit/config-audit');
const { getRecipe } = require('./recipes/registry');

function pageBlob(p) {
  return [p.title, p.slug, p.seoTitle, p.seoDescription, p.h1, p.suburb, p.location, p.body]
    .filter(Boolean)
    .map(function (x) {
      return String(x).toLowerCase();
    })
    .join(' ');
}

function keywordCovered(keyword, pages, homeBlob) {
  const kw = String(keyword || '')
    .toLowerCase()
    .trim();
  if (!kw) return true;
  const tokens = kw.split(/\s+/).filter(function (t) {
    return t.length >= 3;
  });
  if (!tokens.length) return true;
  const hay = homeBlob + ' ' + pages.map(pageBlob).join(' ');
  // Require majority of tokens present somewhere on the site
  let hits = 0;
  tokens.forEach(function (t) {
    if (hay.indexOf(t) >= 0) hits += 1;
  });
  return hits >= Math.ceil(tokens.length * 0.6);
}

/**
 * @param {object} site
 * @param {Array<{ keyword: string, keywordId?: string, trackedId?: string }>} tracked
 */
function detectKeywordNoPage(site, tracked) {
  const cfg = (site && site.config) || {};
  const pages = publishedPages(cfg);
  const homeBlob = String(cfg.seoTitle || '') + ' ' + String(cfg.seoDescription || '') + ' ' + String(cfg.region || '');
  const recipe = getRecipe('keyword_no_page');
  const findings = [];

  (tracked || []).slice(0, 40).forEach(function (t, idx) {
    const keyword = t.keyword || t.normalised;
    if (!keyword) return;
    if (keywordCovered(keyword, pages, homeBlob)) return;
    findings.push({
      id: 'kw:no_page:' + (t.trackedId || t.keywordId || idx),
      code: 'keyword_no_page',
      recipeId: 'keyword_no_page',
      title: (recipe && recipe.title) || 'Valuable keyword with no page',
      plainLanguage:
        '“' +
        keyword +
        '” is tracked, but no published page clearly covers it. Draft a landing page with Page Optimiser or Compose with Brain.',
      severity: (recipe && recipe.severityDefault) || 'high',
      status: 'open',
      actions: (recipe && recipe.actions) || ['page_optimiser', 'create_landing_draft', 'create_task'],
      autoFixAllowed: false,
      evidence: {
        source: 'keyword_coverage',
        keyword: keyword,
        trackedId: t.trackedId || null,
        keywordId: t.keywordId || null,
        publishedPageCount: pages.length
      },
      labelClass: 'modelled',
      editorSection: 'seoTokens'
    });
  });

  return {
    ok: true,
    siteId: site && site.id,
    findings: findings.slice(0, 12),
    labelClass: 'modelled'
  };
}

/**
 * Modelled Search Visibility 0–100 from GSC + ranks when available.
 */
function computeSearchVisibilityScore(opts) {
  const o = opts || {};
  const gsc = o.gscTotals;
  const ranks = o.ranks;
  let score = null;
  let state = 'pending_score';

  if (gsc && gsc.available && gsc.impressions > 0) {
    const ctr = gsc.clicks / Math.max(1, gsc.impressions);
    const clickPart = Math.min(40, Math.log10(Math.max(1, gsc.clicks) + 1) * 18);
    const ctrPart = Math.min(25, ctr * 500);
    let rankPart = 15;
    if (ranks && Array.isArray(ranks.items)) {
      const withPos = ranks.items.filter(function (r) {
        return r.position != null;
      });
      const top10 = withPos.filter(function (r) {
        return r.position <= 10;
      }).length;
      rankPart = withPos.length ? Math.min(35, (top10 / withPos.length) * 35) : 10;
    }
    score = Math.round(Math.max(5, Math.min(95, clickPart + ctrPart + rankPart)));
    state = 'ok';
  } else if (ranks && Array.isArray(ranks.items) && ranks.items.some(function (r) {
    return r.position != null;
  })) {
    const withPos = ranks.items.filter(function (r) {
      return r.position != null;
    });
    const top10 = withPos.filter(function (r) {
      return r.position <= 10;
    }).length;
    score = Math.round(Math.min(80, 20 + (top10 / Math.max(1, withPos.length)) * 60));
    state = 'ok';
  }

  return {
    score: score,
    state: state,
    labelClass: score != null ? 'modelled' : 'modelled',
    hint:
      score != null
        ? 'Modelled from organic clicks, CTR and top-10 rank share.'
        : 'Connect GSC and sync (or run ranks) to score visibility.'
  };
}

module.exports = {
  keywordCovered: keywordCovered,
  detectKeywordNoPage: detectKeywordNoPage,
  computeSearchVisibilityScore: computeSearchVisibilityScore
};
