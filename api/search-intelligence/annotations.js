'use strict';

/**
 * GET|POST /api/search-intelligence/annotations
 * Record or list Search Intelligence annotations (publish, handoff, schema).
 */

const http = require('../../lib/brain/http');
const { createClient } = require('@supabase/supabase-js');
const {
  recordAnnotation,
  listAnnotations
} = require('../../lib/search-intelligence/annotations');
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

    if (req.method === 'GET') {
      const listed = await listAnnotations(db, siteId, {
        type: q.type || null,
        limit: parseInt(String(q.limit || '50'), 10) || 50
      });
      listed.role = access.role;
      return http.json(res, 200, listed);
    }

    const annotationType = String(body.annotationType || body.type || '').trim();
    if (!annotationType) return http.json(res, 400, { error: 'annotation_type_required' });

    const allowed = [
      'publish',
      'landing_publish',
      'landing_unpublish',
      'draft_applied',
      'meta_test',
      'schema_apply',
      'page_optimiser_brief',
      'brain_landing_handoff',
      'manual'
    ];
    if (allowed.indexOf(annotationType) < 0) {
      return http.json(res, 400, { error: 'invalid_annotation_type', allowed: allowed });
    }

    const saved = await recordAnnotation(db, siteId, {
      annotationType: annotationType,
      title: body.title || null,
      detail: Object.assign({}, body.detail || {}, {
        actorUserId: user.id,
        role: access.role
      })
    });
    if (saved.ok) {
      await meterUsage(db, siteId, 'annotation', 1, {
        provider: 'internal',
        annotationType: annotationType
      });
    }
    return http.json(res, 200, Object.assign({ siteId: siteId, role: access.role }, saved));
  } catch (e) {
    return http.json(res, 500, {
      error: 'server_error',
      message: String((e && e.message) || e)
    });
  }
};
