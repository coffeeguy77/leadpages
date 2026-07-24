'use strict';

/**
 * Attach search volume / CPC to campaign plan keywords.
 * Sources (never invent):
 *  1) Google Ads synced keyword_view (measured CPC from cost÷clicks)
 *  2) DataForSEO keyword ideas via SI gateway (estimated volume/CPC)
 * Mock/demo provider data is NOT attached to Ads plans.
 */

const { createGateway } = require('../search-intelligence/providers/gateway');
const dataforseo = require('../search-intelligence/providers/dataforseo');
const { meterUsage } = require('../search-intelligence/usage');

function normKw(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function walkPlanKeywords(plan, visit) {
  if (!plan) return;
  const roots = [plan];
  if (plan.draftPlan) roots.push(plan.draftPlan);
  roots.forEach(function (root) {
    (root.adGroups || []).forEach(function (ag) {
      (ag.keywords || []).forEach(function (kw) {
        visit(kw, ag, root);
      });
    });
  });
}

function collectKeywordTexts(plan) {
  const out = [];
  const seen = {};
  walkPlanKeywords(plan, function (kw) {
    const t = normKw(kw && kw.keyword);
    if (!t || seen[t]) return;
    seen[t] = true;
    out.push(t);
  });
  return out;
}

/**
 * Aggregate measured CPC from ads_keyword_daily (cost_micros ÷ clicks).
 * @returns {Promise<Record<string,{cpc:number|null,clicks:number,impressions:number,source:string}>>}
 */
async function loadMeasuredKeywordCpc(admin, siteId, days) {
  const map = {};
  if (!admin || !siteId) return map;
  const d = Math.max(1, Math.min(90, days || 28));
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - d);
  const sinceDay = since.toISOString().slice(0, 10);
  try {
    const { data, error } = await admin
      .from('ads_keyword_daily')
      .select('keyword_text,impressions,clicks,cost_micros,day')
      .eq('site_id', siteId)
      .gte('day', sinceDay)
      .limit(5000);
    if (error || !data) return map;
    data.forEach(function (r) {
      const k = normKw(r.keyword_text);
      if (!k) return;
      if (!map[k]) map[k] = { clicks: 0, impressions: 0, costMicros: 0 };
      map[k].clicks += Number(r.clicks || 0);
      map[k].impressions += Number(r.impressions || 0);
      map[k].costMicros += Number(r.cost_micros || 0);
    });
    Object.keys(map).forEach(function (k) {
      const row = map[k];
      row.cpc =
        row.clicks > 0 && row.costMicros > 0
          ? Math.round((row.costMicros / row.clicks / 1e6) * 100) / 100
          : null;
      row.source = 'ads_keyword_daily';
      row.labelClass = 'measured';
    });
  } catch (_e) {
    /* table may not exist */
  }
  return map;
}

function ideaIndex(ideas) {
  const map = {};
  (ideas || []).forEach(function (idea) {
    const k = normKw(idea.keyword);
    if (!k) return;
    map[k] = idea;
  });
  return map;
}

function findIdea(index, keyword) {
  const k = normKw(keyword);
  if (index[k]) return index[k];
  // soft contains match (prefer longer overlaps)
  let best = null;
  let bestScore = 0;
  Object.keys(index).forEach(function (ik) {
    if (ik === k) return;
    if (ik.indexOf(k) >= 0 || k.indexOf(ik) >= 0) {
      const score = Math.min(ik.length, k.length);
      if (score > bestScore) {
        bestScore = score;
        best = index[ik];
      }
    }
  });
  return bestScore >= 8 ? best : null;
}

/**
 * Pure merge — used by tests.
 * @param {object} plan
 * @param {{ measured?: object, ideas?: object[], provider?: string|null, liveMarket?: boolean }} data
 */
function applyKeywordMetrics(plan, data) {
  const d = data || {};
  const measured = d.measured || {};
  const index = ideaIndex(d.ideas || []);
  const liveMarket = !!d.liveMarket;
  const provider = d.provider || null;
  let matchedMarket = 0;
  let matchedMeasured = 0;

  walkPlanKeywords(plan, function (kw) {
    const key = normKw(kw.keyword);
    const m = measured[key];
    const idea = liveMarket ? findIdea(index, key) : null;

    if (idea && idea.volume != null) {
      kw.volume = Number(idea.volume);
      matchedMarket++;
    } else if (kw.volume == null) {
      kw.volume = null;
    }

    if (m && m.cpc != null) {
      kw.cpc = m.cpc;
      kw.cpcSource = 'ads_measured';
      kw.metricsLabelClass = 'measured';
      matchedMeasured++;
    } else if (idea && idea.cpc != null && liveMarket) {
      kw.cpc = Number(idea.cpc);
      kw.cpcSource = provider || 'market';
      kw.metricsLabelClass = idea.labelClass || 'estimated';
    } else if (kw.cpc == null) {
      kw.cpc = null;
      kw.cpcSource = null;
    }

    if (idea && idea.competition != null && liveMarket) {
      kw.competition = Number(idea.competition);
    }
    if (idea && idea.difficulty != null && liveMarket) {
      kw.difficulty = Number(idea.difficulty);
    }
  });

  const parts = [];
  if (matchedMeasured) {
    parts.push(matchedMeasured + ' keyword(s) with measured Ads CPC (cost÷clicks)');
  }
  if (matchedMarket && liveMarket) {
    parts.push(
      'volume/CPC from ' + (provider || 'market provider') + ' (' + matchedMarket + ' matched; estimated)'
    );
  }
  if (!parts.length) {
    parts.push(
      liveMarket
        ? 'Market provider connected but no volume/CPC matched these keywords yet'
        : 'Search volume / CPC not shown — connect DataForSEO (SI) for estimates, or sync Ads keywords for measured CPC; never invented'
    );
  }

  const note = parts.join(' · ');
  if (plan.metricsNote != null || plan.adGroups) plan.metricsNote = note;
  if (plan.draftPlan) plan.draftPlan.metricsNote = note;
  plan.keywordMetrics = {
    provider: liveMarket ? provider : null,
    liveMarket: liveMarket,
    matchedMarket: matchedMarket,
    matchedMeasured: matchedMeasured,
    note: note
  };
  return plan;
}

/**
 * Enrich a campaign plan in place with volume/CPC.
 * @param {object} admin — supabase service client
 * @param {string} siteId
 * @param {object} plan
 * @param {{ location?: string, seed?: string, skipMarket?: boolean }} [opts]
 */
async function enrichPlanWithKeywordMetrics(admin, siteId, plan, opts) {
  const o = opts || {};
  if (!plan) return plan;

  const measured = await loadMeasuredKeywordCpc(admin, siteId, 28);
  const liveMarket = !o.skipMarket && dataforseo.configured();
  let ideas = [];
  let provider = null;

  if (liveMarket) {
    const texts = collectKeywordTexts(plan);
    const seed =
      String(o.seed || '').trim() ||
      texts[0] ||
      (plan.adGroups && plan.adGroups[0] && plan.adGroups[0].name) ||
      (plan.draftPlan && plan.draftPlan.adGroups && plan.draftPlan.adGroups[0] && plan.draftPlan.adGroups[0].name) ||
      '';
    const location =
      String(o.location || plan.geoFocus || (plan.draftPlan && plan.draftPlan.geoFocus) || 'Australia').trim() ||
      'Australia';
    if (seed) {
      const gw = createGateway({ provider: 'dataforseo' });
      const result = await gw.keywordIdeas({
        keyword: seed,
        location: location,
        geo: location,
        limit: 40
      });
      if (result && result.ok) {
        ideas = result.ideas || [];
        provider = result.provider || 'dataforseo';
        if (admin && siteId) {
          await meterUsage(admin, siteId, 'ads_plan_keyword_metrics', Math.max(1, ideas.length), {
            provider: provider,
            seed: seed,
            location: location
          });
        }
      } else {
        provider = (result && result.provider) || 'dataforseo';
      }
    }
  }

  return applyKeywordMetrics(plan, {
    measured: measured,
    ideas: ideas,
    provider: provider,
    liveMarket: liveMarket
  });
}

module.exports = {
  normKw,
  collectKeywordTexts,
  loadMeasuredKeywordCpc,
  applyKeywordMetrics,
  enrichPlanWithKeywordMetrics
};
