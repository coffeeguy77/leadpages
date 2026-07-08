/**
 * Demo live sites registry — links real published sites to marketplace app pages.
 */
const registry = require('../marketplace/demo-sites.json');

function listDemoSites() {
  return registry.sites || {};
}

function getDemoSite(slug) {
  const sites = listDemoSites();
  return sites[slug] || null;
}

function getDemoSiteForApp(sectionKey) {
  if (!sectionKey) return null;
  const sites = listDemoSites();
  return Object.keys(sites).map(function(slug) {
    const site = sites[slug];
    if (!site || !Array.isArray(site.apps)) return null;
    if (site.apps.indexOf(sectionKey) >= 0) {
      return Object.assign({ slug: slug }, site);
    }
    return null;
  }).filter(Boolean)[0] || null;
}

function appsForSite(siteSlug) {
  const site = getDemoSite(siteSlug);
  return (site && site.apps) ? site.apps.slice() : [];
}

module.exports = {
  listDemoSites,
  getDemoSite,
  getDemoSiteForApp,
  appsForSite
};
