'use strict';

/**
 * POST /api/search-intelligence/local-pages
 * Evidence-gated suburb page brief (never silent publish).
 */

const http = require('../../lib/brain/http');
const { createClient } = require('@supabase/supabase-js');
const {
  evaluateSuburbPageGate,
  buildGatedSuburbBrief,
  recordSuburbBrief,
  detectLocalPageIssues
} = require('../../lib/search-intelligence/local-page-gates');
const { meterUsage } = require('../../lib/search-intelligence/usage');

function admin() {
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

    const db = admin();
    if (!db) return http.json(res, 503, { error: 'database_unavailable' });

    const { data: site, error } = await db
      .from('sites')
      .select('id,slug,business_name,config,status')
      .eq('id', siteId)
      .maybeSingle();
    if (error || !site) return http.json(res, 404, { error: 'site_not_found' });

    if (req.method === 'GET') {
      const issues = detectLocalPageIssues(site);
      return http.json(res, 200, {
        ok: true,
        siteId: siteId,
        role: access.role,
        findings: issues.findings,
        hint: 'POST { area, primaryKeyword, clusterId? } for an evidence-gated suburb brief.'
      });
    }

    const area = String(body.area || body.suburb || body.location || '').trim();
    const primaryKeyword = String(body.primaryKeyword || body.keyword || '').trim();
    const gateOnly = !!body.gateOnly;

    if (gateOnly) {
      const gate = evaluateSuburbPageGate(site, {
        area: area,
        primaryKeyword: primaryKeyword
      });
      return http.json(res, 200, { ok: true, siteId: siteId, gate: gate });
    }

    const brief = buildGatedSuburbBrief(site, {
      area: area,
      primaryKeyword: primaryKeyword,
      clusterId: body.clusterId || null,
      secondaryKeywords: body.secondaryKeywords,
      pageUrl: body.pageUrl || null
    });

    if (!brief.ok && brief.error === 'gate_failed') {
      return http.json(res, 422, {
        error: 'gate_failed',
        gate: brief.gate,
        message: 'Evidence gates blocked this suburb page. Fix reasons before drafting.'
      });
    }

    brief.role = access.role;

    if (body.annotate !== false) {
      const ann = await recordSuburbBrief(db, siteId, brief);
      brief.annotation = ann;
      await meterUsage(db, siteId, body.handoff ? 'brain_landing_handoff' : 'suburb_page_brief', 1, {
        provider: 'internal',
        area: area,
        primaryKeyword: primaryKeyword,
        handoff: !!body.handoff
      });
    }

    return http.json(res, 200, brief);
  } catch (e) {
    return http.json(res, 500, {
      error: 'server_error',
      message: String((e && e.message) || e)
    });
  }
};
