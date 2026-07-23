'use strict';

/**
 * Local Opportunity Map — modelled service-area × keyword-cluster coverage.
 * Phase 3 foundation without Maps grid API spend.
 */

const { buildClustersFromKeywords, locationHintsFromSite } = require('./clusters');

function areasFromSite(site) {
  const cfg = (site && site.config) || {};
  const areas =
    (cfg.sections &&
      cfg.sections.serviceAreas &&
      Array.isArray(cfg.sections.serviceAreas.areas) &&
      cfg.sections.serviceAreas.areas) ||
    [];
  const labels = areas
    .map(function (a) {
      return typeof a === 'string' ? a : (a && (a.name || a.suburb || a.label || a.slug)) || '';
    })
    .map(function (s) {
      return String(s).trim();
    })
    .filter(Boolean);
  if (labels.length) return labels;
  if (cfg.region) return [String(cfg.region)];
  return [];
}

/**
 * @param {object} site
 * @param {Array<{ keyword: string, keywordId?: string }>} keywords
 */
function buildLocalOpportunityMap(site, keywords) {
  const areas = areasFromSite(site);
  const clusters = buildClustersFromKeywords(keywords || [], {
    locationHints: locationHintsFromSite(site)
  });
  const cells = [];
  areas.forEach(function (area) {
    clusters.forEach(function (c) {
      const areaLow = area.toLowerCase();
      const hasLocalKw = (c.members || []).some(function (m) {
        return String(m.keyword || '').toLowerCase().indexOf(areaLow) >= 0;
      }) || (c.location && String(c.location).toLowerCase() === areaLow);
      cells.push({
        area: area,
        clusterKey: c.key,
        clusterName: c.name,
        primaryKeyword: c.primaryKeyword,
        covered: !!hasLocalKw,
        opportunity: hasLocalKw ? 'strengthen' : 'create_local_page',
        labelClass: 'modelled'
      });
    });
  });

  const gaps = cells.filter(function (c) { return !c.covered; });
  const covered = cells.filter(function (c) { return c.covered; });

  return {
    ok: true,
    siteId: site && site.id,
    areaCount: areas.length,
    clusterCount: clusters.length,
    cellCount: cells.length,
    coveredCount: covered.length,
    gapCount: gaps.length,
    cells: cells.slice(0, 80),
    topGaps: gaps.slice(0, 12),
    mapsVisibilityScore:
      areas.length === 0
        ? 0.2
        : Math.max(0.15, Math.min(0.95, covered.length / Math.max(1, cells.length))),
    labelClass: 'modelled',
    safeguards: {
      note: 'Modelled coverage from tracked keywords × service areas. Maps grid SERP sampling is optional later via DataForSEO only.'
    }
  };
}

module.exports = {
  areasFromSite: areasFromSite,
  buildLocalOpportunityMap: buildLocalOpportunityMap
};
