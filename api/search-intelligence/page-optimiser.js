'use strict';

/**
 * GET|POST /api/search-intelligence/page-optimiser
 * Build a modelled Page Optimiser brief from a cluster (no publish).
 */

const http = require('../../lib/brain/http');
const { createClient } = require('@supabase/supabase-js');
const { listClusters } = require('../../lib/search-intelligence/clusters');
const {
  buildPageBrief,
  recordBriefAnnotation
} = require('../../lib/search-intelligence/page-optimiser');
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

    const clusterId = String(body.clusterId || q.clusterId || '').trim();
    const primaryKeyword = String(body.primaryKeyword || q.primaryKeyword || '').trim();

    let cluster = null;
    if (clusterId || primaryKeyword) {
      const listed = await listClusters(db, siteId);
      const clusters = listed.clusters || [];
      if (clusterId) {
        cluster = clusters.find(function (c) { return c.id === clusterId; }) || null;
      }
      if (!cluster && primaryKeyword) {
        const needle = primaryKeyword.toLowerCase();
        cluster = clusters.find(function (c) {
          return (
            String(c.primaryKeyword || '').toLowerCase() === needle ||
            (c.secondaryKeywords || []).some(function (k) {
              return String(k).toLowerCase() === needle;
            })
          );
        }) || null;
      }
    }

    if (!cluster) {
      // Ad-hoc brief from keyword only (no persisted cluster)
      if (!primaryKeyword) {
        return http.json(res, 400, {
          error: 'cluster_or_keyword_required',
          message: 'Pass clusterId or primaryKeyword.'
        });
      }
      cluster = {
        id: null,
        name: primaryKeyword,
        primaryKeyword: primaryKeyword,
        secondaryKeywords: Array.isArray(body.secondaryKeywords) ? body.secondaryKeywords : [],
        location: body.location || (site.config && site.config.region) || null,
        head: primaryKeyword.split(/\s+/)[0]
      };
    }

    const brief = buildPageBrief(site, cluster, {
      pageUrl: body.pageUrl || q.pageUrl || null
    });
    brief.role = access.role;

    if (req.method === 'POST' && body.annotate !== false) {
      const ann = await recordBriefAnnotation(db, siteId, brief);
      brief.annotation = ann;
      await meterUsage(db, siteId, 'page_optimiser_brief', 1, {
        provider: 'internal',
        clusterId: brief.clusterId
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
