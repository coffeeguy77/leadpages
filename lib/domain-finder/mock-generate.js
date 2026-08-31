'use strict';

/**
 * Offline / mock name generation for Domain Finder tests and mock Brain.
 */

const { toRoot } = require('./normalize');

const SEEDS = [
  { suffix: 'Ready', category: 'outcome-based' },
  { suffix: 'Place', category: 'warm' },
  { suffix: 'Assist', category: 'descriptive' },
  { suffix: 'Care', category: 'warm' },
  { suffix: 'Nest', category: 'compound' },
  { suffix: 'Path', category: 'brandable' },
  { suffix: 'Works', category: 'descriptive' },
  { suffix: 'Hub', category: 'short' },
  { suffix: 'Local', category: 'local' },
  { suffix: 'Pro', category: 'premium' },
  { suffix: 'Go', category: 'action-based' },
  { suffix: 'Next', category: 'brandable' },
  { suffix: 'Bright', category: 'premium' },
  { suffix: 'Kind', category: 'warm' },
  { suffix: 'Clear', category: 'premium' },
  { suffix: 'Home', category: 'descriptive' },
  { suffix: 'Move', category: 'action-based' },
  { suffix: 'Craft', category: 'brandable' },
  { suffix: 'Forge', category: 'invented' },
  { suffix: 'Bloom', category: 'warm' },
  { suffix: 'Anchor', category: 'premium' },
  { suffix: 'Spark', category: 'creative' },
  { suffix: 'Grove', category: 'local' },
  { suffix: 'Lift', category: 'outcome-based' }
];

function tokensFromBrief(brief) {
  const stop = { the: 1, and: 1, for: 1, with: 1, that: 1, this: 1, from: 1, into: 1, your: 1, our: 1, are: 1, was: 1, were: 1, have: 1, has: 1, will: 1, would: 1, should: 1, their: 1, them: 1, they: 1, about: 1, business: 1, helping: 1, people: 1, service: 1, services: 1 };
  return String(brief || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(function (w) { return w.length >= 4 && !stop[w]; })
    .slice(0, 8);
}

function mockGenerate(input, count, excluded) {
  const exclude = new Set((excluded || []).map(function (x) { return toRoot(x); }));
  const preferred = Array.isArray(input.preferred_words) ? input.preferred_words : String(input.preferred_words || '').split(/[,|]/).map(function (s) { return s.trim(); }).filter(Boolean);
  const tokens = preferred.concat(tokensFromBrief(input.business_description)).concat(['canopy', 'harbour', 'summit', 'ember', 'willow']);
  const out = [];
  const seen = new Set();

  function push(name, category, reason) {
    const root = toRoot(name);
    if (!root || exclude.has(root) || seen.has(root)) return;
    if (root.length < 4 || root.length > 18) return;
    seen.add(root);
    out.push({
      name: name,
      root: root,
      category: category,
      reason: reason || ('A ' + category + ' name suited to the brief.')
    });
  }

  preferred.forEach(function (p) {
    push(p, 'brandable', 'Built from a preferred word.');
  });

  for (let i = 0; i < SEEDS.length && out.length < count; i++) {
    const seed = SEEDS[i];
    const tok = tokens[i % tokens.length] || 'local';
    const title = tok.charAt(0).toUpperCase() + tok.slice(1);
    push(title + seed.suffix, seed.category, 'Combines a brief keyword with a ' + seed.category + ' naming style.');
    if (out.length < count) {
      push(seed.suffix + title, 'compound', 'Compound brand combining ' + seed.suffix + ' with a brief keyword.');
    }
  }

  // Invented-ish short brands
  const invent = ['Nexora', 'Valora', 'Kindredly', 'Homelynx', 'Moveora', 'Prepwell', 'Nestora', 'Carelynx'];
  invent.forEach(function (n) {
    if (out.length >= count) return;
    push(n, 'invented', 'Tasteful invented brand that stays pronounceable.');
  });

  return { candidates: out.slice(0, count) };
}

function mockRank(availableRoots, brief) {
  void brief;
  return {
    ranked: (availableRoots || []).map(function (r, i) {
      const root = typeof r === 'string' ? r : (r.root || '');
      const base = Math.max(55, 92 - i * 2);
      return {
        root: root,
        overall_score: base,
        brandability: base - 1,
        relevance: base,
        memorability: base - 2,
        spelling: Math.min(100, base + 4),
        pronunciation: Math.min(100, base + 2),
        professionalism: base,
        growth_potential: base - 3,
        reason: 'Clear, memorable and appropriate for the business brief.',
        badge: i === 0 ? 'Best Overall' : ''
      };
    })
  };
}

module.exports = { mockGenerate, mockRank, tokensFromBrief };
