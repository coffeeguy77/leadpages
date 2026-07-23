'use strict';

/**
 * GET|POST /api/search-intelligence/keywords
 * Keyword ideas via provider gateway (mock until DataForSEO env is set).
 */

const http = require('../../lib/brain/http');
const { createClient } = require('@supabase/supabase-js');
const { createGateway } = require('../../lib/search-intelligence/providers/gateway');
const { computeOpportunityValue } = require('../../lib/search-intelligence/scoring/opportunity-value');
const { meterUsage } = require('../../lib/search-intelligence/usage');

function adminDb() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return http.json(res, 405, { error: 'method_not_allowed' });
    }
    const user = await http.requireUser(req);
    if (!user) return http.json(res, 401, { error: 'unauthorized' });

    const body = req.method === 'POST' ? await http.readBody(req) : {};
    const q = req.query || {};
    const siteId = String(body.siteId || q.siteId || q.site_id || '').trim();
    if (!siteId) return http.json(res, 400, { error: 'site_id_required' });

    const access = await http.assertSiteAccess(user, siteId);
    if (!access.ok) return http.json(res, access.code, { error: access.error });

    const keyword = String(body.keyword || q.keyword || '').trim();
    if (!keyword) return http.json(res, 400, { error: 'keyword_required' });

    const location = String(body.location || q.location || 'Australia').trim();
    const provider = String(body.provider || q.provider || process.env.SI_KEYWORD_PROVIDER || 'mock').trim();

    const gw = createGateway({ provider: provider });
    const ideas = await gw.keywordIdeas({ keyword: keyword, location: location });
    if (!ideas || !ideas.ok) {
      return http.json(res, 200, {
        ok: false,
        siteId: siteId,
        provider: provider,
        error: (ideas && ideas.error) || 'keyword_ideas_failed',
        message: (ideas && ideas.message) || null,
        ideas: []
      });
    }

    const scored = (ideas.ideas || []).slice(0, 25).map(function (idea) {
      const ov = computeOpportunityValue({
        volume: idea.volume,
        cpc: idea.cpc,
        competition: idea.competition,
        difficulty: idea.difficulty,
        avgJobValue: body.avgJobValue || 1500,
        offersService: true,
        hasRecipe: true
      });
      return Object.assign({}, idea, {
        opportunity: ov.score,
        opportunityFactors: ov.factors,
        opportunityLabelClass: ov.labelClass
      });
    });

    const db = adminDb();
    if (db) {
      await meterUsage(db, siteId, 'keyword_ideas', Math.max(1, scored.length), {
        provider: ideas.provider || provider,
        seed: keyword
      });
    }

    return http.json(res, 200, {
      ok: true,
      siteId: siteId,
      provider: ideas.provider || provider,
      keyword: keyword,
      location: location,
      ideas: scored,
      labelClass: scored[0] && scored[0].labelClass ? scored[0].labelClass : 'estimated'
    });
  } catch (e) {
    return http.json(res, 500, {
      error: 'server_error',
      message: String((e && e.message) || e)
    });
  }
};
