'use strict';

/**
 * Roll up synced GSC query×page rows into page performance + recipe NBAs.
 */

const { getRecipe } = require('./recipes/registry');

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function pct(n) {
  return Math.round(Number(n || 0) * 1000) / 10;
}

/**
 * Aggregate rows by page_url.
 * @param {Array<{query:string,page_url:string,clicks:number,impressions:number,ctr?:number,position?:number}>} rows
 */
function aggregateByPage(rows) {
  const byPage = new Map();
  (rows || []).forEach(function (r) {
    const url = String(r.page_url || '').trim();
    if (!url) return;
    let p = byPage.get(url);
    if (!p) {
      p = {
        pageUrl: url,
        clicks: 0,
        impressions: 0,
        weightedPos: 0,
        queries: []
      };
      byPage.set(url, p);
    }
    const clicks = Number(r.clicks || 0);
    const impressions = Number(r.impressions || 0);
    const position = r.position != null ? Number(r.position) : null;
    p.clicks += clicks;
    p.impressions += impressions;
    if (position != null && impressions > 0) p.weightedPos += position * impressions;
    p.queries.push({
      query: r.query,
      clicks: clicks,
      impressions: impressions,
      ctr: r.ctr != null ? Number(r.ctr) : impressions ? clicks / impressions : null,
      position: position
    });
  });

  return Array.from(byPage.values())
    .map(function (p) {
      p.ctr = p.impressions ? p.clicks / p.impressions : 0;
      p.avgPosition = p.impressions ? p.weightedPos / p.impressions : null;
      delete p.weightedPos;
      p.queries.sort(function (a, b) {
        return b.impressions - a.impressions;
      });
      p.topQueries = p.queries.slice(0, 5);
      delete p.queries;
      return p;
    })
    .sort(function (a, b) {
      return b.impressions - a.impressions || b.clicks - a.clicks;
    });
}

/**
 * Detect high-impr / low-CTR pages for Next Best Actions.
 */
function buildPageFindings(pages, opts) {
  const o = opts || {};
  const minImpr = o.minImpressions != null ? o.minImpressions : 100;
  const maxCtr = o.maxCtr != null ? o.maxCtr : 0.02;
  const findings = [];
  const recipe = getRecipe('high_impr_low_ctr');

  (pages || []).forEach(function (p, idx) {
    if (p.impressions < minImpr) return;
    if (p.ctr > maxCtr) return;
    findings.push({
      id: 'gsc:low_ctr:' + idx,
      code: 'high_impr_low_ctr',
      recipeId: 'high_impr_low_ctr',
      title: recipe ? recipe.title : 'High impressions, low CTR',
      plainLanguage:
        (recipe ? recipe.plainLanguage + ' ' : '') +
        'Page ' +
        p.pageUrl +
        ' had ' +
        p.impressions +
        ' impressions and ' +
        pct(p.ctr) +
        '% CTR.',
      severity: recipe ? recipe.severityDefault : 'high',
      status: 'open',
      actions: (recipe && recipe.actions) || ['open_editor_seo', 'create_task'],
      autoFixAllowed: false,
      evidence: {
        source: 'gsc_page_performance',
        pageUrl: p.pageUrl,
        clicks: p.clicks,
        impressions: p.impressions,
        ctr: p.ctr,
        avgPosition: p.avgPosition,
        topQueries: p.topQueries
      },
      labelClass: 'measured',
      editorSection: 'seoTokens'
    });
  });

  // Light cannibalisation: same top query on 2+ pages with material impressions
  const queryPages = new Map();
  (pages || []).forEach(function (p) {
    (p.topQueries || []).slice(0, 2).forEach(function (q) {
      if (!q.query || q.impressions < 50) return;
      const key = String(q.query).toLowerCase();
      if (!queryPages.has(key)) queryPages.set(key, []);
      queryPages.get(key).push({ pageUrl: p.pageUrl, impressions: q.impressions, clicks: q.clicks });
    });
  });
  const cannibal = getRecipe('cannibalisation');
  let cIdx = 0;
  queryPages.forEach(function (list, query) {
    if (list.length < 2) return;
    findings.push({
      id: 'gsc:cannibal:' + cIdx++,
      code: 'cannibalisation',
      recipeId: 'cannibalisation',
      title: cannibal ? cannibal.title : 'Multiple pages competing',
      plainLanguage:
        'Query “' +
        query +
        '” appears on ' +
        list.length +
        ' pages in Search Console. Consolidate or differentiate titles/intent.',
      severity: (cannibal && cannibal.severityDefault) || 'medium',
      status: 'open',
      actions: (cannibal && cannibal.actions) || ['create_task', 'open_editor_seo'],
      autoFixAllowed: false,
      evidence: { source: 'gsc_page_performance', query: query, pages: list },
      labelClass: 'measured',
      editorSection: 'seoTokens'
    });
  });

  return findings;
}

/**
 * Load page performance from warehouse (or empty if schema missing).
 */
async function loadPagePerformance(admin, siteId, opts) {
  const o = opts || {};
  const days = Math.max(1, Math.min(90, o.days || 28));
  const empty = {
    available: false,
    days: days,
    pages: [],
    findings: [],
    pageCount: 0
  };
  if (!admin || !siteId) return empty;

  const endDate = o.endDate || daysAgo(0);
  const startDate = o.startDate || daysAgo(days);

  try {
    const { data, error } = await admin
      .from('si_query_page_stats')
      .select('query,page_url,clicks,impressions,ctr,position')
      .eq('site_id', siteId)
      .eq('period_start', startDate)
      .eq('period_end', endDate);
    if (error) return empty;

    const pages = aggregateByPage(data || []);
    const findings = buildPageFindings(pages, o);
    return {
      available: true,
      days: days,
      startDate: startDate,
      endDate: endDate,
      pages: pages.slice(0, o.limit || 50),
      findings: findings,
      pageCount: pages.length,
      labelClass: 'measured'
    };
  } catch (_e) {
    return empty;
  }
}

module.exports = {
  aggregateByPage: aggregateByPage,
  buildPageFindings: buildPageFindings,
  loadPagePerformance: loadPagePerformance,
  pct: pct
};
