'use strict';

const { sendJson, readBody, requireUser, admin } = require('../../lib/layout-composer/http');
const { compileBlueprintToConfig } = require('../../lib/layout-composer/compile');
const { fillConfigFromUnderstanding } = require('../../lib/layout-composer/rich-fill');

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
  let i = 1;
  for (;;) {
    const r = await admin.from('sites').select('id').eq('slug', slug).maybeSingle();
    if (!r.data) return slug;
    i += 1;
    slug = base + '-' + i;
    if (i > 40) return base + '-' + Date.now().toString(36);
  }
}

async function actorContext(user) {
  if (!user || !user.id) return { ok: false, error: 'Sign in to create a site.' };
  const { data: profile } = await admin
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (profile && profile.is_super_admin) {
    return { ok: true, role: 'super', userId: user.id };
  }
  const { data: partner } = await admin
    .from('partners')
    .select('id,status')
    .eq('user_id', user.id)
    .maybeSingle();
  if (partner && partner.status === 'active') {
    return { ok: true, role: 'partner', userId: user.id, partnerId: partner.id };
  }
  return { ok: false, error: 'Only partners or platform admins can create sites from Layout Composer.' };
}

/**
 * POST /api/layout-composer/create-site
 * Creates a sites row from a confirmed, filled Layout Composer config.
 * Body: { blueprint, brief, understanding?, config?, confirmed: true, slug? }
 */
module.exports = async function layoutComposerCreateSite(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('allow', 'POST, OPTIONS');
    return sendJson(res, 204, {});
  }
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' });

  const user = await requireUser(req);
  const actor = await actorContext(user);
  if (!actor.ok) return sendJson(res, 401, { ok: false, error: actor.error });

  const body = await readBody(req);
  if (body.confirmed !== true) {
    return sendJson(res, 400, {
      ok: false,
      needsConfirmation: true,
      error: 'Confirm the layout before creating a site.'
    });
  }
  const blueprint = body.blueprint;
  if (!blueprint || typeof blueprint !== 'object') {
    return sendJson(res, 400, { ok: false, error: 'blueprint is required' });
  }
  const brief = body.brief || {};
  const businessName = String(brief.businessName || '').trim();
  if (!businessName) {
    return sendJson(res, 400, { ok: false, error: 'brief.businessName is required' });
  }

  try {
    let config = body.config;
    if (!config || typeof config !== 'object') {
      const compiled = compileBlueprintToConfig(blueprint, {
        baseConfig: null,
        identity: {
          name: businessName,
          trade: brief.trade,
          location: brief.location,
          phone: brief.phone,
          email: brief.email
        },
        confirmedAt: new Date().toISOString()
      });
      const filled = fillConfigFromUnderstanding(
        compiled.config,
        blueprint,
        brief,
        body.understanding || null
      );
      config = filled.config;
    }

    config.name = businessName;
    config.businessName = businessName;
    if (brief.trade) config.trade = brief.trade;
    if (brief.location) config.region = brief.location;

    const baseSlug = slugify(body.slug || businessName);
    const slug = await uniqueSlug(baseSlug);

    const row = {
      slug: slug,
      business_name: businessName,
      template: 'trade',
      vertical: 'trade',
      config: config,
      status: 'live'
    };
    if (actor.role === 'partner' && actor.partnerId) {
      row.referring_partner_id = actor.partnerId;
      row.servicing_partner_id = actor.partnerId;
      row.is_mockup = body.asMockup !== false;
    }

    const ins = await admin.from('sites').insert(row).select('id,slug,business_name,status').single();
    if (ins.error) {
      return sendJson(res, 500, { ok: false, error: ins.error.message || 'create_failed' });
    }

    return sendJson(res, 200, {
      ok: true,
      site: ins.data,
      manageUrl: '/manage?site=' + encodeURIComponent(ins.data.slug),
      notice: 'Site created from your confirmed layout. Structure was not changed by AI.'
    });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: String((e && e.message) || e) });
  }
};
