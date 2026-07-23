'use strict';

/**
 * GET|POST /api/search-intelligence/schema-patch
 * Preview or apply modelled JSON-LD (seoJsonLd) with human approval.
 */

const http = require('../../lib/brain/http');
const { createClient } = require('@supabase/supabase-js');
const {
  buildSchemaPatch,
  applySchemaPatchToConfig
} = require('../../lib/search-intelligence/schema-patch');
const { recordAnnotation } = require('../../lib/search-intelligence/annotations');
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
      .select('id,slug,business_name,config,status,custom_domain')
      .eq('id', siteId)
      .maybeSingle();
    if (error || !site) return http.json(res, 404, { error: 'site_not_found' });

    const patch = buildSchemaPatch(site, {
      canonicalUrl: site.custom_domain
        ? 'https://' + String(site.custom_domain).replace(/^https?:\/\//, '')
        : null
    });
    patch.role = access.role;

    const wantApply =
      req.method === 'POST' &&
      (body.apply === true || body.apply === '1' || String(q.apply || '') === '1');

    if (!wantApply) {
      return http.json(res, 200, patch);
    }

    // Explicit human apply only
    const nextCfg = applySchemaPatchToConfig(site.config || {}, patch, {
      blockIds: body.blockIds || null
    });
    const { error: upErr } = await db
      .from('sites')
      .update({ config: nextCfg, updated_at: new Date().toISOString() })
      .eq('id', siteId);
    if (upErr) throw new Error(upErr.message);

    await recordAnnotation(db, siteId, {
      annotationType: 'schema_apply',
      title: 'Applied schema.org JSON-LD patch',
      detail: {
        blockIds: body.blockIds || patch.blocks.map(function (b) { return b.id; }),
        types: (nextCfg.seoJsonLd || []).map(function (b) { return b['@type']; }),
        actorUserId: user.id
      }
    });
    await meterUsage(db, siteId, 'schema_patch_apply', 1, { provider: 'internal' });

    patch.applied = true;
    patch.configKeys = ['seoJsonLd'];
    patch.safeguards = Object.assign({}, patch.safeguards, {
      note: 'Applied to sites.config.seoJsonLd — renderer emits ld+json on next publish.'
    });
    return http.json(res, 200, patch);
  } catch (e) {
    return http.json(res, 500, {
      error: 'server_error',
      message: String((e && e.message) || e)
    });
  }
};
