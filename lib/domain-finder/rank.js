'use strict';

/**
 * Deterministic ranking signals + merge with AI scores.
 */

const { toRoot } = require('./normalize');

function clamp(n, lo, hi) {
  n = Number(n);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function deterministicBoost(candidate, family) {
  let boost = 0;
  const root = candidate.root || '';
  const len = root.length;
  if (len >= 5 && len <= 12) boost += 6;
  else if (len >= 4 && len <= 16) boost += 3;
  else if (len > 20) boost -= 8;
  else if (len > 16) boost -= 4;

  if (root.indexOf('-') >= 0) boost -= 10;
  if (/\d/.test(root)) boost -= 6;

  const tlds = (family && family.availableTlds) || [];
  if (tlds.indexOf('com.au') >= 0) boost += 8;
  if (tlds.indexOf('au') >= 0) boost += 5;
  if (tlds.indexOf('net.au') >= 0) boost += 2;
  if (tlds.indexOf('com.au') >= 0 && tlds.indexOf('au') >= 0) boost += 6;
  if (tlds.length >= 3) boost += 4;

  if (candidate.premium) boost -= 5;
  if (candidate.price != null && Number(candidate.price) > 200) boost -= 4;

  return boost;
}

/**
 * Group available domains by root into families.
 */
function buildFamilies(availableRows) {
  const byRoot = {};
  (availableRows || []).forEach(function (row) {
    const root = row.root || toRoot(row.domain);
    if (!byRoot[root]) {
      byRoot[root] = {
        root: root,
        displayName: row.displayName || root,
        category: row.category || 'brandable',
        reason: row.reason || '',
        domains: [],
        availableTlds: []
      };
    }
    byRoot[root].domains.push(row);
    if (byRoot[root].availableTlds.indexOf(row.tld) < 0) {
      byRoot[root].availableTlds.push(row.tld);
    }
    if (!byRoot[root].displayName || byRoot[root].displayName === root) {
      byRoot[root].displayName = row.displayName || byRoot[root].displayName;
    }
  });
  return Object.keys(byRoot).map(function (k) { return byRoot[k]; });
}

/**
 * Merge AI rank scores with deterministic boosts.
 * @param {object[]} families
 * @param {object[]} aiRanked — from RANK_SCHEMA
 */
function mergeScores(families, aiRanked) {
  const byRoot = {};
  (aiRanked || []).forEach(function (r) {
    const root = toRoot(r.root || r.name || '');
    if (root) byRoot[root] = r;
  });

  const usedBadges = new Set();
  return families.map(function (fam) {
    const ai = byRoot[fam.root] || {};
    const primary = fam.domains.slice().sort(function (a, b) {
      const order = { 'com.au': 0, au: 1, 'net.au': 2 };
      return (order[a.tld] != null ? order[a.tld] : 9) - (order[b.tld] != null ? order[b.tld] : 9);
    })[0];

    const base = clamp(ai.overall_score != null ? ai.overall_score : 72, 0, 100);
    const boost = deterministicBoost(Object.assign({}, primary, { root: fam.root }), fam);
    const overall = clamp(Math.round(base + boost * 0.45), 0, 100);

    let badge = String(ai.badge || '').trim();
    if (badge && usedBadges.has(badge)) badge = '';
    if (badge) usedBadges.add(badge);

    return {
      root: fam.root,
      displayName: fam.displayName,
      category: fam.category,
      domains: fam.domains.map(function (d) {
        return {
          domain: d.domain,
          tld: d.tld,
          available: true,
          price: d.price,
          currency: d.currency || 'AUD',
          premium: !!d.premium,
          renew: d.renew != null ? d.renew : null
        };
      }),
      availableTlds: fam.availableTlds.slice(),
      allMajorAvailable: fam.availableTlds.indexOf('com.au') >= 0 && fam.availableTlds.indexOf('au') >= 0,
      primaryDomain: primary && primary.domain,
      price: primary && primary.price,
      premium: !!(primary && primary.premium),
      scores: {
        overall: overall,
        brandability: clamp(ai.brandability != null ? ai.brandability : overall, 0, 100),
        relevance: clamp(ai.relevance != null ? ai.relevance : overall, 0, 100),
        memorability: clamp(ai.memorability != null ? ai.memorability : overall, 0, 100),
        spelling: clamp(ai.spelling != null ? ai.spelling : overall, 0, 100),
        pronunciation: clamp(ai.pronunciation != null ? ai.pronunciation : overall, 0, 100),
        professionalism: clamp(ai.professionalism != null ? ai.professionalism : overall, 0, 100),
        growth_potential: clamp(ai.growth_potential != null ? ai.growth_potential : overall, 0, 100)
      },
      reason: ai.reason || fam.reason || 'Strong fit for the brief with confirmed availability.',
      badge: badge || null
    };
  }).sort(function (a, b) {
    return (b.scores.overall - a.scores.overall) || String(a.root).localeCompare(String(b.root));
  });
}

/** Assign featured badges if AI didn't. */
function ensureFeaturedBadges(ranked) {
  if (!ranked || !ranked.length) return ranked;
  const assign = function (idx, badge) {
    if (idx < 0 || idx >= ranked.length) return;
    if (!ranked[idx].badge) ranked[idx].badge = badge;
  };
  assign(0, 'Best Overall');
  let shortIdx = -1;
  let brandIdx = -1;
  let descIdx = -1;
  ranked.forEach(function (r, i) {
    if (i === 0) return;
    if (shortIdx < 0 && r.root.length <= 8) shortIdx = i;
    if (brandIdx < 0 && /brandable|invented|creative/i.test(r.category || '')) brandIdx = i;
    if (descIdx < 0 && /descriptive|outcome|action/i.test(r.category || '')) descIdx = i;
  });
  assign(brandIdx, 'Most Brandable');
  assign(descIdx, 'Most Descriptive');
  assign(shortIdx, 'Short & Memorable');
  const auIdx = ranked.findIndex(function (r, i) {
    return i > 0 && !r.badge && r.allMajorAvailable;
  });
  assign(auIdx, 'Best Australian Name');
  return ranked;
}

module.exports = {
  deterministicBoost,
  buildFamilies,
  mergeScores,
  ensureFeaturedBadges,
  clamp
};
