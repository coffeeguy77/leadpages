'use strict';

/**
 * POST /api/ai-composer/update-site   Body: { slug, plan, fills, createdAt }
 * Rebuilds the config of a site AI Composer just built, after the visual check changed
 * layouts or re-filled sections. Keeps the site row (slug, status, partner, demo
 * fields) and refuses if the site has been rebuilt or re-composed since (createdAt
 * must match), so it never overwrites work done in the editor afterwards.
 */

const { sendJson, readBody, admin } = require('../../lib/layout-composer/http');
const { requireComposerAccess, canComposeSite } = require('../../lib/ai-composer/access');
const { sanitizeClientPlan } = require('../../lib/ai-composer/plan');
const { buildSiteConfig } = require('../../lib/ai-composer/build-config');
const { blocksForPlan } = require('../../lib/ai-composer/block-store');

/** Minutes after creation during which the visual check may rebuild a site. */
const REBUILD_WINDOW_MIN = 120;

module.exports = async function aiComposerUpdateSite(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' });
  const access = await requireComposerAccess(req);
  if (!access.ok) return sendJson(res, access.code, { ok: false, error: access.error });
  const body = await readBody(req);
  const slug = String(body.slug || '').trim().toLowerCase();
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) return sendJson(res, 400, { ok: false, error: 'slug is required' });

  const r = await admin.from('sites').select('id,slug,business_name,config,referring_partner_id,servicing_partner_id,created_at,updated_at').eq('slug', slug).maybeSingle();
  if (r.error) return sendJson(res, 500, { ok: false, error: r.error.message });
  const site = r.data;
  if (!canComposeSite(access, site)) return sendJson(res, 403, { ok: false, error: 'You can only update sites you built with AI Composer.' });
  const prev = site.config._aiComposer || {};
  if (!body.createdAt || String(body.createdAt) !== String(prev.createdAt)) {
    return sendJson(res, 409, { ok: false, error: 'This site has changed since it was built, so the visual check will not overwrite it.' });
  }
  if (Date.now() - Date.parse(prev.createdAt) > REBUILD_WINDOW_MIN * 60000) {
    return sendJson(res, 409, { ok: false, error: 'The visual check can only rebuild a site in the first ' + REBUILD_WINDOW_MIN + ' minutes after it was built.' });
  }

  let plan;
  try { plan = sanitizeClientPlan(body.plan); } catch (e) { return sendJson(res, 400, { ok: false, error: e.message }); }
  try {
    const blocks = await blocksForPlan(access, plan);
    const config = buildSiteConfig(plan, Array.isArray(body.fills) ? body.fills : [], { businessName: site.business_name, now: prev.createdAt, blocks: blocks });
    // Keep what the first build recorded (demo info, FAQ flag) and note the check.
    if (site.config._mockup) config._mockup = site.config._mockup;
    config._aiComposer.createdBy = prev.createdBy;
    if (prev.faqDrafted) config._aiComposer.faqDrafted = true;
    config._aiComposer.visualCheck = Object.assign({}, body.visualCheck && typeof body.visualCheck === 'object' ? {
      rounds: Math.min(5, Number(body.visualCheck.rounds) || 1),
      changes: Array.isArray(body.visualCheck.changes) ? body.visualCheck.changes.slice(0, 30) : []
    } : {}, { at: new Date().toISOString() });
    const up = await admin.from('sites').update({ config: config }).eq('id', site.id).select('id,slug,status').single();
    if (up.error) return sendJson(res, 500, { ok: false, error: 'Could not update the site: ' + up.error.message });
    return sendJson(res, 200, { ok: true, site: up.data, sections: config.sectionOrder, gaps: config._aiComposer.gaps });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: String((e && e.message) || e) });
  }
};
