/**
 * Domain Finder — unit tests (no live AI / Dreamscape).
 * Run: node --test tests/domain-finder.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  toRoot,
  displayName,
  expandCandidates,
  isValidRoot,
  parseDomain,
} = require('../lib/domain-finder/normalize');
const { mockGenerate, mockRank } = require('../lib/domain-finder/mock-generate');
const {
  buildFamilies,
  mergeScores,
  ensureFeaturedBadges,
  deterministicBoost,
} = require('../lib/domain-finder/rank');
const { FINDER_TLDS, getConfig, DEFAULTS } = require('../lib/domain-finder/config');
const { GENERATE_SCHEMA, RANK_SCHEMA } = require('../lib/domain-finder/schemas');
const { runSearch } = require('../lib/domain-finder/orchestrate');

describe('toRoot', () => {
  it('lowercases and strips spaces', () => {
    assert.equal(toRoot('Ready Home'), 'readyhome');
  });
  it('handles ampersand', () => {
    assert.equal(toRoot('Cat & Dog'), 'catanddog');
  });
  it('strips www, protocols and TLD', () => {
    assert.equal(toRoot('https://www.Example.com.au'), 'example');
  });
  it('rejects empty after strip', () => {
    assert.equal(toRoot('!!!'), '');
  });
});

describe('displayName', () => {
  it('trims and collapses spaces', () => {
    assert.equal(displayName('  Ready   Home  '), 'Ready Home');
  });
});

describe('expandCandidates', () => {
  it('only uses supplied AU TLDs', () => {
    const out = expandCandidates(
      [{ name: 'Home Ready', root: 'homeready', category: 'descriptive', reason: 'test' }],
      FINDER_TLDS
    );
    assert.equal(out.length, 3);
    for (const d of out) {
      assert.ok(FINDER_TLDS.includes(d.tld), d.tld);
    }
  });
  it('dedupes full domains', () => {
    const out = expandCandidates(
      [
        { name: 'A', root: 'same', category: 'short', reason: '' },
        { name: 'B', root: 'same', category: 'short', reason: '' },
      ],
      FINDER_TLDS
    );
    assert.equal(out.length, 3);
  });
  it('skips invalid roots', () => {
    assert.equal(isValidRoot('ab'), false);
    const out = expandCandidates([{ name: 'ab', root: 'ab' }], FINDER_TLDS);
    assert.equal(out.length, 0);
  });
});

describe('parseDomain', () => {
  it('parses full AU domain', () => {
    const p = parseDomain('HomeReady.com.au');
    assert.equal(p.root, 'homeready');
    assert.equal(p.tld, 'com.au');
    assert.equal(p.hadTld, true);
  });
});

describe('mockGenerate', () => {
  it('returns structured candidates', () => {
    const list = mockGenerate(
      { business_description: 'dog grooming Canberra', location: 'Canberra' },
      10,
      []
    );
    assert.ok(list.candidates.length >= 5);
    assert.ok(list.candidates[0].root);
    assert.ok(list.candidates[0].name);
  });
  it('respects exclusions', () => {
    const first = mockGenerate({ business_description: 'test service business' }, 20, []);
    const roots = first.candidates.map((c) => c.root);
    const second = mockGenerate(
      { business_description: 'test service business' },
      20,
      roots.slice(0, 5)
    );
    for (const r of roots.slice(0, 5)) {
      assert.ok(!second.candidates.some((c) => c.root === r), `should exclude ${r}`);
    }
  });
});

describe('mockRank', () => {
  it('scores available domains', () => {
    const ranked = mockRank(['pawcare', 'groomly'], 'dog grooming');
    assert.equal(ranked.ranked.length, 2);
    assert.ok(ranked.ranked[0].overall_score >= 50);
  });
});

describe('schemas', () => {
  it('exports generate and rank schemas', () => {
    assert.equal(GENERATE_SCHEMA.required[0], 'candidates');
    assert.equal(RANK_SCHEMA.required[0], 'ranked');
  });
});

describe('buildFamilies / mergeScores', () => {
  it('groups same root and boosts multi-TLD', () => {
    const fams = buildFamilies([
      { root: 'x', displayName: 'X', domain: 'x.com.au', tld: 'com.au', category: 'short', reason: '' },
      { root: 'x', displayName: 'X', domain: 'x.au', tld: 'au', category: 'short', reason: '' },
      { root: 'y', displayName: 'Y', domain: 'y.com.au', tld: 'com.au', category: 'short', reason: '' },
    ]);
    assert.equal(fams.length, 2);
    const x = fams.find((f) => f.root === 'x');
    assert.equal(x.domains.length, 2);
    assert.equal(x.availableTlds.length, 2);

    const merged = mergeScores(fams, [
      {
        root: 'x',
        overall_score: 80,
        brandability: 80,
        relevance: 80,
        memorability: 80,
        spelling: 80,
        pronunciation: 80,
        professionalism: 80,
        growth_potential: 80,
        reason: 'good',
        badge: 'Best Overall',
      },
      {
        root: 'y',
        overall_score: 80,
        brandability: 80,
        relevance: 80,
        memorability: 80,
        spelling: 80,
        pronunciation: 80,
        professionalism: 80,
        growth_potential: 80,
        reason: 'ok',
        badge: '',
      },
    ]);
    assert.ok(merged[0].scores.overall >= merged[1].scores.overall);
    const withBadges = ensureFeaturedBadges(merged);
    assert.ok(withBadges.some((c) => c.badge === 'Best Overall'));
  });

  it('deterministicBoost favours .com.au', () => {
    const a = deterministicBoost({ root: 'short', tld: 'com.au' }, { availableTlds: ['com.au', 'au'] });
    const b = deterministicBoost({ root: 'short', tld: 'net.au' }, { availableTlds: ['net.au'] });
    assert.ok(a > b);
  });
});

describe('config', () => {
  it('AU TLDs only and sensible limits', () => {
    assert.deepEqual(FINDER_TLDS, ['com.au', 'au', 'net.au']);
    const cfg = getConfig();
    assert.ok(cfg.targetAvailable >= 8);
    assert.ok(cfg.maxGenerationRounds >= 2);
    assert.ok(cfg.deadlineMs <= 60000);
    assert.deepEqual(cfg.tlds, FINDER_TLDS);
    assert.equal(DEFAULTS.minRootLen, 3);
  });
});

describe('runSearch orchestration (mocked availability)', () => {
  it('rejects short briefs', async () => {
    const r = await runSearch({ body: { business_description: 'too short' }, brain: null });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'brief_required');
  });

  it('returns only available domains via injected check path', async () => {
    async function fakeCheck(domains) {
      const byDomain = {};
      (domains || []).forEach(function (d, i) {
        byDomain[d] = {
          available: i % 3 === 0,
          price: 70,
          currency: 'AUD',
          premium: false,
        };
      });
      return { ok: true, byDomain: byDomain, checked: domains.length, cached: 0 };
    }
    const r = await runSearch({
      body: {
        business_description:
          'A Canberra mobile dog grooming business that is friendly, premium and convenient.',
        business_type: 'Local Business',
        location: 'Canberra, ACT',
        mode: 'standard',
      },
      brain: null,
      checkDomains: fakeCheck,
      config: {
        targetAvailable: 6,
        maxGenerationRounds: 2,
        candidatesPerRound: 12,
        maxDomainsChecked: 60,
      },
    });
    assert.equal(r.ok, true);
    assert.ok(Array.isArray(r.results));
    assert.ok(r.progress.length >= 2);
    for (const fam of r.results) {
      assert.ok(fam.domains.every((d) => d.available === true));
      for (const d of fam.domains) {
        assert.ok(FINDER_TLDS.includes(d.tld), d.tld);
      }
    }
  });
});
