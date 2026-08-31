'use strict';

/**
 * Domain Finder orchestration:
 * Generate → expand TLDs → check availability → regenerate → rank → return.
 *
 * Hard wall-clock budget so Vercel returns JSON instead of HTTP 504.
 */

const { getConfig, PRIMARY_TLD } = require('./config');
const { toRoot, expandCandidates, displayName, fullDomain } = require('./normalize');
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

function msLeft(deadlineAt) {
  return deadlineAt - Date.now();
}

function withTimeout(promise, ms, fallbackFactory) {
  if (!ms || ms < 1) return promise;
  let timer = null;
  const timeout = new Promise(function (resolve) {
    timer = setTimeout(function () {
      resolve(typeof fallbackFactory === 'function' ? fallbackFactory() : null);
    }, ms);
  });
  return Promise.race([promise, timeout]).then(function (v) {
    if (timer) clearTimeout(timer);
    return v;
  }, function (err) {
    if (timer) clearTimeout(timer);
    if (typeof fallbackFactory === 'function') return fallbackFactory();
    throw err;
  });
}

async function callGenerate(brain, brief, excluded, count, providerOverride, timeoutMs) {
  if (!brain) {
    return mockGenerate(brief, count, excluded);
  }
  const run = (async function () {
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
          excluded_candidates: (excluded || []).slice(0, 120).join(', ') || 'none',
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
  })();
  const out = await withTimeout(run, timeoutMs, function () {
    return mockGenerate(brief, count, excluded);
  });
  return out || mockGenerate(brief, count, excluded);
}

async function callRank(brain, brief, families, providerOverride, timeoutMs) {
  const compact = families.map(function (f) {
    return {
      root: f.root,
      displayName: f.displayName,
      category: f.category,
      tlds: f.availableTlds,
      reason: f.reason
    };
  });
  const fallback = function () {
    return mockRank(compact.map(function (c) { return c.root; }), brief.business_description);
  };
  if (!brain) return fallback();
  const run = (async function () {
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
          // Cap payload size for speed
          available_domains: JSON.stringify(compact.slice(0, 40))
        },
        responseSchema: RANK_SCHEMA
      });
      const data = (result && result.output) || (result && result.data) || null;
      if (!data || !Array.isArray(data.ranked) || !data.ranked.length) return fallback();
      return data;
    } catch (_e) {
      return fallback();
    }
  })();
  return (await withTimeout(run, timeoutMs, fallback)) || fallback();
}

function uniqueAvailable(rows) {
  const uniq = {};
  rows.forEach(function (r) { uniq[r.domain] = r; });
  return Object.keys(uniq).map(function (k) { return uniq[k]; });
}

function countUniqueRoots(rows) {
  const s = new Set();
  rows.forEach(function (r) { if (r.root) s.add(r.root); });
  return s.size;
}

/**
 * @param {object} opts
 * @param {object} opts.body — request body
 * @param {object} [opts.brain] — Brain instance
 * @param {object} [opts.actor]
 * @param {object} [opts.config]
 * @param {string} [opts.providerOverride]
 * @param {function} [opts.checkDomains]
 */
async function runSearch(opts) {
  const cfg = getConfig(opts.config);
  const brief = normalizeBrief(opts.body || {});
  brief.actor = opts.actor || null;
  const steps = [];
  const started = Date.now();
  const deadlineAt = started + (cfg.deadlineMs || 48000);
  const tlds = (brief.tlds || cfg.tlds).filter(function (t) {
    return cfg.tlds.indexOf(t) >= 0;
  });
  if (!tlds.length) tlds.push.apply(tlds, cfg.tlds);
  const primaryTld = tlds.indexOf(cfg.primaryTld || PRIMARY_TLD) >= 0
    ? (cfg.primaryTld || PRIMARY_TLD)
    : tlds[0];
  const siblingTlds = tlds.filter(function (t) { return t !== primaryTld; });

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
  let availableRows = [];
  let checkedTotal = 0;
  let generatedTotal = 0;
  let round = 0;
  let timedOut = false;
  const checker = typeof opts.checkDomains === 'function' ? opts.checkDomains : checkDomains;

  while (
    countUniqueRoots(availableRows) < cfg.targetAvailable &&
    round < cfg.maxGenerationRounds &&
    checkedTotal < cfg.maxDomainsChecked
  ) {
    if (msLeft(deadlineAt) < 8000) {
      timedOut = true;
      progress(steps, 'deadline', 'Wrapping up with the best options so far', 'done');
      break;
    }

    // Skip extra rounds if we already have a usable shortlist and time is tight
    if (
      round >= 1 &&
      countUniqueRoots(availableRows) >= cfg.minResultsToSkipExtraRound &&
      msLeft(deadlineAt) < 18000
    ) {
      progress(steps, 'enough', 'Found enough strong options — ranking now', 'done');
      break;
    }

    round += 1;
    const need = Math.min(
      cfg.candidatesPerRound,
      Math.max(8, Math.ceil((cfg.targetAvailable - countUniqueRoots(availableRows)) * 1.2))
    );
    const genBudget = Math.min(cfg.aiGenerateTimeoutMs, Math.max(4000, msLeft(deadlineAt) - 12000));
    const gen = await callGenerate(
      opts.brain,
      brief,
      Array.from(excludedRoots),
      need,
      opts.providerOverride,
      genBudget
    );
    const candidates = (gen.candidates || []).filter(function (c) {
      const root = toRoot(c.root || c.name);
      if (!root || excludedRoots.has(root)) return false;
      return true;
    });
    candidates.forEach(function (c) { excludedRoots.add(toRoot(c.root || c.name)); });
    generatedTotal += candidates.length;
    progress(steps, 'gen-' + round, 'Generated ' + candidates.length + ' ideas', 'done', { round: round });

    if (!candidates.length) {
      progress(steps, 'empty-' + round, 'No valid domain roots this round', 'done');
      continue;
    }

    // Phase A: check primary TLD only (much fewer registrar calls)
    const primaryExpanded = expandCandidates(candidates, [primaryTld], cfg)
      .slice(0, cfg.maxDomainsChecked - checkedTotal);
    if (!primaryExpanded.length) continue;

    progress(steps, 'check-' + round, 'Checking .' + primaryTld + ' availability', 'active', {
      count: primaryExpanded.length
    });
    if (msLeft(deadlineAt) < 5000) {
      timedOut = true;
      break;
    }
    const check = await checker(primaryExpanded.map(function (e) { return e.domain; }), cfg);
    checkedTotal += check.checked || primaryExpanded.length;

    const winners = [];
    primaryExpanded.forEach(function (e) {
      const hit = check.byDomain[e.domain];
      if (!hit || hit.available !== true) return;
      const row = {
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
      };
      availableRows.push(row);
      winners.push(e);
    });
    availableRows = uniqueAvailable(availableRows);

    // Phase B: for available roots, check sibling AU TLDs (family view)
    if (winners.length && siblingTlds.length && msLeft(deadlineAt) > 7000) {
      const siblingDomains = [];
      const siblingMeta = [];
      winners.forEach(function (w) {
        siblingTlds.forEach(function (tld) {
          const domain = fullDomain(w.root, tld);
          siblingDomains.push(domain);
          siblingMeta.push({
            displayName: w.displayName,
            root: w.root,
            tld: tld,
            domain: domain,
            category: w.category,
            reason: w.reason
          });
        });
      });
      const room = cfg.maxDomainsChecked - checkedTotal;
      const sibSlice = siblingDomains.slice(0, room);
      const metaSlice = siblingMeta.slice(0, room);
      if (sibSlice.length) {
        progress(steps, 'family-' + round, 'Checking matching .au / .net.au', 'active', {
          count: sibSlice.length
        });
        const sibCheck = await checker(sibSlice, cfg);
        checkedTotal += sibCheck.checked || sibSlice.length;
        metaSlice.forEach(function (e) {
          const hit = sibCheck.byDomain[e.domain];
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
        });
        availableRows = uniqueAvailable(availableRows);
      }
    }

    progress(steps, 'found-' + round, 'Found ' + countUniqueRoots(availableRows) + ' available names', 'done', {
      round: round,
      domains: availableRows.length
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
        zero: true,
        timedOut: timedOut,
        elapsedMs: Date.now() - started
      }
    };
  }

  progress(steps, 'rank', 'Ranking the strongest options', 'active');
  const families = buildFamilies(availableRows);
  let aiRank;
  if (msLeft(deadlineAt) < 6000) {
    aiRank = mockRank(families.map(function (f) { return f.root; }), brief.business_description);
    progress(steps, 'rank-fast', 'Ranked with availability-first scoring', 'done');
  } else {
    const rankBudget = Math.min(cfg.aiRankTimeoutMs, Math.max(3000, msLeft(deadlineAt) - 3000));
    aiRank = await callRank(opts.brain, brief, families, opts.providerOverride, rankBudget);
  }
  let ranked = mergeScores(families, (aiRank && aiRank.ranked) || []);
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
      timedOut: timedOut,
      elapsedMs: Date.now() - started,
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
  callRank,
  withTimeout
};
