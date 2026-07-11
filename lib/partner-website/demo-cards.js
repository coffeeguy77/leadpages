/**
 * Demo card normalisation for Partner Website showcase.
 */

const { demoPreviewUrl } = require('../partner-templates/shared');

function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /^https?:\/\//i.test(url.trim());
}

function normaliseDemoCard(demo, base, index) {
  if (!demo || !demo.slug) return null;
  const cfg = demo.config || {};
  const sc = cfg.showcase || {};
  const trade = String(cfg.trade || 'Local business').trim();
  const name = String(demo.business_name || demo.slug).trim();
  const img = demoPreviewUrl(demo, index);
  if (!isValidImageUrl(img) && !sc.color) return null;
  const url = 'https://' + base + '/' + encodeURIComponent(demo.slug) + '?preview=1';
  const features = [];
  if (cfg.scope && Array.isArray(cfg.scope.items)) {
    cfg.scope.items.slice(0, 4).forEach(function(it) {
      if (it && it.text) features.push(String(it.text).trim());
    });
  }
  return {
    slug: demo.slug,
    name: name,
    industry: trade,
    thumbnail: img,
    thumbnailFit: sc.fit || 'cover',
    thumbnailColor: sc.color || null,
    url: url,
    description: (cfg.scope && cfg.scope.description) ? String(cfg.scope.description).trim().slice(0, 200) : '',
    features: features,
    featured: !!demo.featured,
    sortOrder: Number(demo.sort_order) || index,
    ctaExplore: 'Explore demo',
    ctaBuild: 'Build something like this'
  };
}

function normaliseDemos(demos, base) {
  const list = (demos || [])
    .map(function(d, i) { return normaliseDemoCard(d, base, i); })
    .filter(Boolean);
  list.sort(function(a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });
  return list;
}

module.exports = { normaliseDemos, normaliseDemoCard, isValidImageUrl };
