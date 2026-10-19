'use strict';

/**
 * POST /api/ai-composer/create-site
 * Body: { plan, fills, businessName?, slug?, options?: { draft?, draftFaq?, salePrice? } }
 *
 * Builds a fresh sites.config from the approved plan and filled values (no trade
 * pack, no trade defaults) and creates the site row. Returns the editor link.
 *
 *  - Super admins: a live site, or a draft (options.draft).
 *  - Partners: always a partner demo site, exactly like Partner → Add mockup:
 *    status 'draft', is_mockup, sale price, plan, referring/servicing partner. It is
 *    shared on its ?preview=1 link with the "Get this website" bar and only goes live
 *    when the client buys it (api/partner/buy-site → billing webhook).
 */

const { sendJson, readBody, admin } = require('../../lib/layout-composer/http');
const { requireComposerAccess } = require('../../lib/ai-composer/access');
const { sanitizeClientPlan } = require('../../lib/ai-composer/plan');
const { buildSiteConfig } = require('../../lib/ai-composer/build-config');
const { DEFAULT_DEMO_SALE_PRICE_CENTS } = require('../../lib/partner-demo-pricing');

function slugify(s, max) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max || 48) || 'site';
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

  const access = await requireComposerAccess(req);
  if (!access.ok) return sendJson(res, access.code, { ok: false, error: access.error });

  const body = await readBody(req);
  const options = body.options && typeof body.options === 'object' ? body.options : {};
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
    if (options.draftFaq && config.sections.faq && config.sections.faq.on === true) {
      config._aiComposer.gaps.push({
        what: 'FAQ answers',
        suggestion: 'Drafted by AI from the design — check every answer before relying on it.'
      });
      config._aiComposer.faqDrafted = true;
    }
    config._aiComposer.createdBy = access.role;

    let row;
    if (access.role === 'partner') {
      const partner = access.partner;
      const prof = (await admin.from('partner_profiles').select('default_plan_key').eq('partner_id', partner.id).maybeSingle()).data || {};
      const salePrice = Math.round(Number(options.salePrice) || 0) || DEFAULT_DEMO_SALE_PRICE_CENTS;
      config._mockup = {
        createdBy: partner.id,
        createdAt: new Date().toISOString(),
        source: 'ai-composer',
        packSlug: null,
        packVariant: 1,
        targetLocation: null
      };
      const slug = await uniqueSlug(slugify(body.slug || businessName, 36).replace(/-demo$/, '') + '-demo');
      row = {
        slug: slug,
        business_name: businessName,
        template: 'trade',
        vertical: 'trade',
        status: 'draft',
        is_mockup: true,
        sale_price: salePrice,
        plan_key: prof.default_plan_key || null,
        config: config,
        referring_partner_id: partner.id,
        servicing_partner_id: partner.id,
        servicing_status: 'partner_serviced'
      };
    } else {
      row = {
        slug: await uniqueSlug(slugify(body.slug || businessName)),
        business_name: businessName,
        template: 'trade',
        vertical: 'trade',
        config: config,
        // Drafts are only visible on their ?preview=1 link until published.
        status: options.draft ? 'draft' : 'live'
      };
    }

    const ins = await admin
      .from('sites')
      .insert(row)
      .select('id,slug,business_name,status,is_mockup,sale_price')
      .single();
    if (ins.error) {
      return sendJson(res, 500, { ok: false, error: 'Could not create the site: ' + (ins.error.message || 'insert failed') });
    }
    return sendJson(res, 200, {
      ok: true,
      site: ins.data,
      demo: access.role === 'partner',
      previewUrl: '/' + encodeURIComponent(ins.data.slug) + '?preview=1',
      createdAt: config._aiComposer.createdAt,
      manageUrl: '/manage?site=' + encodeURIComponent(ins.data.slug),
      sections: config.sectionOrder,
      gaps: config._aiComposer.gaps
    });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: String((e && e.message) || e) });
  }
};
