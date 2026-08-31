'use strict';

/**
 * Domain Finder orchestration:
 * Generate → expand TLDs → check availability → regenerate → rank → return.
 */

const { getConfig } = require('./config');
const { toRoot, expandCandidates, displayName } = require('./normalize');
const { checkDomains } = require('./availability');
const { buildFamilies, mergeScores, ensureFeaturedBadges } = require('./rank');
const { GENERATE_SCHEMA, RANK_SCHEMA } = require('./schemas');
const { mockGenerate, mockRank } = require('./mock-generate');

function progress(steps, id, label, state, detail) {
  steps.push({
    id: id,
    label: label,
    state: state || 'done',
    detail: detail || null,
    at: new Date().toISOString()
  });
}

function parseList(v) {
  if (Array.isArray(v)) return v.map(function (x) { return String(x || '').trim(); }).filter(Boolean);
  return String(v || '')
    .split(/[,|\n]/)
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
}

function normalizeBrief(body) {
  return {
    business_description: String(body.business_description || body.brief || '').trim(),
    business_type: String(body.business_type || 'Local Business').trim() || 'Local Business',
    location: String(body.location || '').trim(),
    preferred_words: parseList(body.preferred_words),
    excluded_words: parseList(body.excluded_words),
    existing_ideas: parseList(body.existing_ideas),
    mode: String(body.mode || 'standard').trim().toLowerCase(),
    tlds: Array.isArray(body.tlds) && body.tlds.length ? body.tlds : null,
    site_id: body.site_id || null,
    refine: body.refine || null
  };
}

async function callGenerate(brain, brief, excluded, count, providerOverride) {
  if (!brain) {
    return mockGenerate(brief, count, excluded);
  }
  try {
    const result = await brain.generateStructured({
      taskId: 'domain_finder.generate',
      promptId: 'domain_finder.generate',
      siteId: brief.site_id || null,
      actor: brief.actor || null,
      providerOverride: providerOverride || 'openai',
      temperature: brief.mode === 'surprise' || brief.mode === 'wider' ? 0.95 : 0.75,
      input: {
        business_description: brief.business_description,
        business_type: brief.business_type,
        location: brief.location || 'Australia',
        preferred_words: (brief.preferred_words || []).join(', ') || 'none',
        excluded_words: (brief.excluded_words || []).join(', ') || 'none',
        existing_ideas: (brief.existing_ideas || []).join(', ') || 'none',
        mode: brief.mode || 'standard',
        excluded_candidates: (excluded || []).slice(0, 200).join(', ') || 'none',
        candidate_count: String(count),
        refine_direction: (brief.refine && brief.refine.direction) || 'none',
        refine_notes: (brief.refine && brief.refine.notes) || ''
      },
      responseSchema: GENERATE_SCHEMA
    });
    const data = (result && result.output) || (result && result.data) || null;
    if (!data || !Array.isArray(data.candidates) || !data.candidates.length) {
      return mockGenerate(brief, count, excluded);
    }
    return data;
  } catch (_e) {
    return mockGenerate(brief, count, excluded);
  }
}

async function callRank(brain, brief, families, providerOverride) {
  const compact = families.map(function (f) {
    return {
      root: f.root,
      displayName: f.displayName,
      category: f.category,
      tlds: f.availableTlds,
      reason: f.reason
    };
  });
  if (!brain) return mockRank(compact.map(function (c) { return c.root; }), brief.business_description);
  try {
    const result = await brain.generateStructured({
      taskId: 'domain_finder.rank',
      promptId: 'domain_finder.rank',
      siteId: brief.site_id || null,
      actor: brief.actor || null,
      providerOverride: providerOverride || 'openai',
      temperature: 0.3,
      input: {
        business_description: brief.business_description,
        business_type: brief.business_type,
        location: brief.location || 'Australia',
        available_domains: JSON.stringify(compact)
      },
      responseSchema: RANK_SCHEMA
    });
    const data = (result && result.output) || (result && result.data) || null;
    if (!data || !Array.isArray(data.ranked) || !data.ranked.length) {
      return mockRank(compact.map(function (c) { return c.root; }), brief.business_description);
    }
    return data;
  } catch (_e) {
    return mockRank(compact.map(function (c) { return c.root; }), brief.business_description);
  }
}

/**
 * @param {object} opts
 * @param {object} opts.body — request body
 * @param {object} [opts.brain] — Brain instance
 * @param {object} [opts.actor]
 * @param {object} [opts.config]
 * @param {string} [opts.providerOverride]
 */
async function runSearch(opts) {
  const cfg = getConfig(opts.config);
  const brief = normalizeBrief(opts.body || {});
  brief.actor = opts.actor || null;
  const steps = [];
  const tlds = (brief.tlds || cfg.tlds).filter(function (t) {
    return cfg.tlds.indexOf(t) >= 0;
  });
  if (!tlds.length) tlds.push.apply(tlds, cfg.tlds);

  if (!brief.business_description || brief.business_description.length < 12) {
    return {
      ok: false,
      error: 'brief_required',
      message: 'Tell us what you are building (at least a short description).'
    };
  }

  progress(steps, 'understand', 'Understanding your business', 'done');
  progress(steps, 'directions', 'Creating naming directions', 'done');

  const excludedRoots = new Set();
  (brief.excluded_words || []).forEach(function (w) { excludedRoots.add(toRoot(w)); });
  const availableRows = [];
  let checkedTotal = 0;
  let generatedTotal = 0;
  let round = 0;

  while (availableRows.length < cfg.targetAvailable && round < cfg.maxGenerationRounds && checkedTotal < cfg.maxDomainsChecked) {
    round += 1;
    const need = Math.max(cfg.candidatesPerRound, Math.ceil((cfg.targetAvailable - availableRows.length) * 1.4));
    const gen = await callGenerate(
      opts.brain,
      brief,
      Array.from(excludedRoots),
      need,
      opts.providerOverride
    );
    const candidates = (gen.candidates || []).filter(function (c) {
      const root = toRoot(c.root || c.name);
      if (!root || excludedRoots.has(root)) return false;
      return true;
    });
    candidates.forEach(function (c) { excludedRoots.add(toRoot(c.root || c.name)); });
    generatedTotal += candidates.length;
    progress(steps, 'gen-' + round, 'Generated ' + candidates.length + ' ideas', 'done', { round: round });

    const expanded = expandCandidates(candidates, tlds, cfg).slice(0, cfg.maxDomainsChecked - checkedTotal);
    if (!expanded.length) {
      progress(steps, 'empty-' + round, 'No valid domain roots this round', 'done');
      continue;
    }

    progress(steps, 'check-' + round, 'Checking domain availability', 'active', { count: expanded.length });
    const checker = typeof opts.checkDomains === 'function' ? opts.checkDomains : checkDomains;
    const check = await checker(expanded.map(function (e) { return e.domain; }), cfg);
    checkedTotal += check.checked || expanded.length;

    let foundThis = 0;
    expanded.forEach(function (e) {
      const hit = check.byDomain[e.domain];
      if (!hit || hit.available !== true) return;
      availableRows.push({
        displayName: displayName(e.displayName),
        root: e.root,
        tld: e.tld,
        domain: e.domain,
        category: e.category,
        reason: e.reason,
        price: hit.price,
        renew: hit.renew,
        premium: !!hit.premium,
        currency: hit.currency || 'AUD',
        generation_round: round
      });
      foundThis += 1;
    });

    // Unique by domain
    const uniq = {};
    availableRows.forEach(function (r) { uniq[r.domain] = r; });
    availableRows.length = 0;
    Object.keys(uniq).forEach(function (k) { availableRows.push(uniq[k]); });

    progress(steps, 'found-' + round, 'Found ' + availableRows.length + ' available domains', 'done', {
      round: round,
      added: foundThis
    });

    if (brief.mode === 'direct') break;
  }

  if (!availableRows.length) {
    progress(steps, 'zero', 'Exploring more creative directions', 'done');
    return {
      ok: true,
      progress: steps,
      results: [],
      meta: {
        generated: generatedTotal,
        checked: checkedTotal,
        available: 0,
        rounds: round,
        tlds: tlds,
        zero: true
      }
    };
  }

  progress(steps, 'rank', 'Ranking the strongest options', 'active');
  const families = buildFamilies(availableRows);
  const aiRank = await callRank(opts.brain, brief, families, opts.providerOverride);
  let ranked = mergeScores(families, aiRank.ranked || []);
  ranked = ensureFeaturedBadges(ranked);
  progress(steps, 'rank', 'Ranking the strongest options', 'done');

  return {
    ok: true,
    progress: steps,
    results: ranked,
    meta: {
      generated: generatedTotal,
      checked: checkedTotal,
      available: availableRows.length,
      families: families.length,
      rounds: round,
      tlds: tlds,
      brief: {
        business_type: brief.business_type,
        location: brief.location,
        mode: brief.mode
      }
    },
    candidatesFlat: availableRows
  };
}

module.exports = {
  normalizeBrief,
  runSearch,
  callGenerate,
  callRank
};
