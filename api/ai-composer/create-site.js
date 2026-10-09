'use strict';

/**
 * POST /api/ai-composer/create-site
 * Body: { plan, fills, businessName?, slug? }
 *
 * Builds a fresh sites.config from the approved plan and filled values (no trade
 * pack, no trade defaults) and creates a live site row. Returns the editor link.
 * Super admin only.
 */

const { sendJson, readBody, admin } = require('../../lib/layout-composer/http');
const { requireSuperAdmin } = require('../../lib/ai-composer/access');
const { sanitizeClientPlan } = require('../../lib/ai-composer/plan');
const { buildSiteConfig } = require('../../lib/ai-composer/build-config');

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'site';
}

async function uniqueSlug(base) {
  let slug = base;
  for (let i = 2; i < 42; i++) {
    const r = await admin.from('sites').select('id').eq('slug', slug).maybeSingle();
    if (r.error) throw new Error('Could not check site address: ' + r.error.message);
    if (!r.data) return slug;
    slug = base + '-' + i;
  }
  return base + '-' + Date.now().toString(36);
}

module.exports = async function aiComposerCreateSite(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' });

  const access = await requireSuperAdmin(req);
  if (!access.ok) return sendJson(res, access.code, { ok: false, error: access.error });

  const body = await readBody(req);
  let plan;
  try {
    plan = sanitizeClientPlan(body.plan);
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: e.message });
  }
  if (!plan.sections.length) {
    return sendJson(res, 400, { ok: false, error: 'The plan has no sections to build.' });
  }

  const businessName = String(body.businessName || plan.businessName || '').trim().slice(0, 120);
  if (!businessName) {
    return sendJson(res, 400, { ok: false, error: 'Add a business name before building the site.' });
  }

  try {
    const config = buildSiteConfig(plan, Array.isArray(body.fills) ? body.fills : [], { businessName: businessName });
    if (body.options && body.options.draftFaq && config.sections.faq && config.sections.faq.on === true) {
      config._aiComposer.gaps.push({
        what: 'FAQ answers',
        suggestion: 'Drafted by AI from the design — check every answer before relying on it.'
      });
      config._aiComposer.faqDrafted = true;
    }
    const slug = await uniqueSlug(slugify(body.slug || businessName));
    const ins = await admin
      .from('sites')
      .insert({
        slug: slug,
        business_name: businessName,
        template: 'trade',
        vertical: 'trade',
        config: config,
        status: 'live'
      })
      .select('id,slug,business_name,status')
      .single();
    if (ins.error) {
      return sendJson(res, 500, { ok: false, error: 'Could not create the site: ' + (ins.error.message || 'insert failed') });
    }
    return sendJson(res, 200, {
      ok: true,
      site: ins.data,
      manageUrl: '/manage?site=' + encodeURIComponent(ins.data.slug),
      sections: config.sectionOrder,
      gaps: config._aiComposer.gaps
    });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: String((e && e.message) || e) });
  }
};
