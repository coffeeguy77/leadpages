'use strict';

/**
 * Attach search volume / CPC to campaign plan keywords.
 * Sources (never invent):
 *  1) Google Ads synced keyword_view (measured CPC from cost÷clicks)
 *  2) DataForSEO Google Ads search_volume for the plan's exact keywords
 *  3) Fallback: DataForSEO keyword_ideas (related terms) with soft match
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
 */
function applyKeywordMetrics(plan, data) {
  const d = data || {};
  const measured = d.measured || {};
  const index = ideaIndex(d.ideas || []);
  const liveMarket = !!d.liveMarket;
  const provider = d.provider || null;
  const configured = d.configured != null ? !!d.configured : liveMarket;
  const marketError = d.marketError || null;
  const marketMode = d.marketMode || null;
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
    if (idea && idea.lowBid != null) kw.lowBid = Number(idea.lowBid);
    if (idea && idea.highBid != null) kw.highBid = Number(idea.highBid);
  });

  const parts = [];
  if (matchedMeasured) {
    parts.push(matchedMeasured + ' keyword(s) with measured Ads CPC (cost÷clicks)');
  }
  if (matchedMarket && liveMarket) {
    parts.push(
      'Vol/CPC from Google Ads via DataForSEO' +
        (marketMode === 'search_volume' ? ' search volume' : ' keyword ideas') +
        ' (' +
        matchedMarket +
        ' matched; estimated USD)'
    );
  }
  if (!parts.length) {
    if (!configured) {
      parts.push(
        'Vol/CPC unavailable — set DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD on Vercel, redeploy, then click Fetch Vol/CPC. Never invented.'
      );
    } else if (marketError) {
      parts.push('DataForSEO error: ' + String(marketError).slice(0, 160) + ' — fix credentials/quota, then Fetch Vol/CPC.');
    } else {
      parts.push(
        'DataForSEO connected but Google returned no volume/CPC for these keywords yet. Try Fetch Vol/CPC again or broaden geo to Australia.'
      );
    }
  }

  const note = parts.join(' · ');
  if (plan.metricsNote != null || plan.adGroups) plan.metricsNote = note;
  if (plan.draftPlan) plan.draftPlan.metricsNote = note;
  plan.keywordMetrics = {
    provider: liveMarket ? provider : null,
    liveMarket: liveMarket,
    configured: configured,
    marketMode: marketMode,
    marketError: marketError,
    matchedMarket: matchedMarket,
    matchedMeasured: matchedMeasured,
    note: note,
    envHint: configured
      ? null
      : 'Vercel → Project → Settings → Environment Variables → DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD (or DATAFORSEO_EMAIL + DATAFORSEO_API_PASSWORD), then Redeploy.'
  };
  if (plan.draftPlan) plan.draftPlan.keywordMetrics = plan.keywordMetrics;
  return plan;
}

/**
 * Enrich a campaign plan in place with volume/CPC.
 */
async function enrichPlanWithKeywordMetrics(admin, siteId, plan, opts) {
  const o = opts || {};
  if (!plan) return plan;

  const measured = await loadMeasuredKeywordCpc(admin, siteId, 28);
  const configured = dataforseo.configured();
  const liveMarketWanted = !o.skipMarket;
  let ideas = [];
  let provider = null;
  let marketError = null;
  let marketMode = null;
  let liveMarket = false;

  if (liveMarketWanted && configured) {
    const texts = collectKeywordTexts(plan);
    const location =
      String(o.location || plan.geoFocus || (plan.draftPlan && plan.draftPlan.geoFocus) || 'Australia').trim() ||
      'Australia';

    if (texts.length) {
      // Primary: exact Google Ads search volume for every plan keyword
      const sv = await dataforseo.searchVolume({
        keywords: texts,
        location: location,
        geo: location
      });
      if (sv && sv.ok && Array.isArray(sv.ideas) && sv.ideas.length) {
        ideas = sv.ideas;
        provider = 'dataforseo';
        marketMode = 'search_volume';
        liveMarket = true;
        if (admin && siteId) {
          await meterUsage(admin, siteId, 'ads_plan_search_volume', Math.max(1, texts.length), {
            provider: provider,
            location: location,
            count: texts.length
          });
        }
      } else {
        marketError = (sv && (sv.message || sv.error)) || 'search_volume_empty';
        // Fallback: related keyword ideas from first seed (soft-match)
        const seed =
          String(o.seed || '').trim() ||
          texts[0] ||
          '';
        if (seed) {
          const gw = createGateway({ provider: 'dataforseo' });
          const result = await gw.keywordIdeas({
            keyword: seed,
            location: location,
            geo: location,
            limit: 50
          });
          if (result && result.ok && result.ideas && result.ideas.length) {
            ideas = result.ideas;
            provider = result.provider || 'dataforseo';
            marketMode = 'keyword_ideas';
            liveMarket = true;
            marketError = marketError + ' (fell back to keyword ideas)';
            if (admin && siteId) {
              await meterUsage(admin, siteId, 'ads_plan_keyword_metrics', Math.max(1, ideas.length), {
                provider: provider,
                seed: seed,
                location: location
              });
            }
          } else if (result && !result.ok) {
            marketError = (result.message || result.error || marketError || 'provider_error').toString();
          }
        }
      }
    }
  } else if (liveMarketWanted && !configured) {
    marketError = 'not_configured';
  }

  return applyKeywordMetrics(plan, {
    measured: measured,
    ideas: ideas,
    provider: provider,
    liveMarket: liveMarket,
    configured: configured,
    marketError: marketError,
    marketMode: marketMode
  });
}

module.exports = {
  normKw,
  collectKeywordTexts,
  loadMeasuredKeywordCpc,
  applyKeywordMetrics,
  enrichPlanWithKeywordMetrics
};
