'use strict';

/**
 * Phase 7+ — Landing page AI draft via Brain.
 * POST /api/brain/landing-draft
 *   { siteId, brief?, template?, primaryKeyword?, location?, negativeKeywords?, extraInfo?, mode? }
 *
 * Returns a full SEO draft: title, slug, meta, h1, bodyMarkdown (+ FAQ/CTA composed).
 * Flag: BRAIN_LANDING_DRAFT=1 (default off). Approve UI stays in manage.html.
 */

const { createClient } = require('@supabase/supabase-js');
const {
  getPlatformBrain,
  isLandingDraftEnabled,
  getLandingDraftProvider,
  ensureBrainSettings
} = require('../../lib/brain/platform');
const {
  LANDING_DRAFT_SCHEMA,
  normalizeLandingDraft
} = require('../../lib/brain/landing-compose');
const {
  buildLandingBriefInput,
  filterServicesSummary,
  findNegativeHits
} = require('../../lib/brain/landing-brief');

const SUPABASE_URL = process.env.SUPABASE_URL;
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'string') {
        try { return resolve(JSON.parse(req.body)); } catch (_e) { return resolve({}); }
      }
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (_e) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

async function requireUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  try {
    const userClient = createClient(
      SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
      { global: { headers: { Authorization: 'Bearer ' + token } } }
    );
    const { data, error } = await userClient.auth.getUser(token);
    if (error || !data || !data.user) return null;
    return data.user;
  } catch (_e) {
    return null;
  }
}

async function isSuperAdmin(userId) {
  const { data } = await admin.from('profiles').select('is_super_admin').eq('id', userId).maybeSingle();
  return !!(data && data.is_super_admin);
}

async function partnerIdForUser(userId) {
  const { data } = await admin.from('partners').select('id,status').eq('user_id', userId).maybeSingle();
  if (!data || data.status !== 'active') return null;
  return data.id;
}

async function assertSiteAccess(user, siteId) {
  const { data: site, error } = await admin.from('sites')
    .select('id,slug,business_name,custom_domain,config,owner_user_id,servicing_partner_id,referring_partner_id,template')
    .eq('id', siteId)
    .maybeSingle();
  if (error || !site) return { ok: false, code: 404, error: 'site_not_found' };
  if (await isSuperAdmin(user.id)) return { ok: true, site, role: 'super' };
  if (site.owner_user_id && site.owner_user_id === user.id) {
    return { ok: true, site, role: 'client' };
  }
  const partnerId = await partnerIdForUser(user.id);
  if (partnerId && (site.servicing_partner_id === partnerId || site.referring_partner_id === partnerId)) {
    return { ok: true, site, role: 'partner', partnerId };
  }
  if (!site.owner_user_id) return { ok: true, site, role: 'client' };
  return { ok: false, code: 403, error: 'not_your_site' };
}

function servicesFromSite(site) {
  const cfg = (site && site.config) || {};
  const list = Array.isArray(cfg.services) ? cfg.services : [];
  return list.map((s) => s && (s.title || s.name)).filter(Boolean).join(', ');
}

async function runDraft(brain, args) {
  return brain.generateStructured({
    taskId: 'content.landing_draft',
    promptId: 'content.landing_draft',
    siteId: args.site.id,
    site: args.site,
    actor: args.actor,
    contextSlices: ['site.identity', 'site.brand', 'site.areas'],
    temperature: 0.7,
    providerOverride: args.providerOverride,
    input: args.input,
    responseSchema: LANDING_DRAFT_SCHEMA
  });
}

module.exports = async function landingDraft(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'POST only' });
  }

  const brain = getPlatformBrain();
  if (!isLandingDraftEnabled(brain)) {
    return json(res, 503, {
      ok: false,
      error: 'landing_draft_disabled',
      message: 'Set BRAIN_LANDING_DRAFT=1 to enable server-side AI drafts.'
    });
  }

  const user = await requireUser(req);
  if (!user) return json(res, 401, { ok: false, error: 'unauthorized' });

  const body = await readBody(req);
  const siteId = String(body.siteId || '').trim();
  if (!siteId) return json(res, 400, { ok: false, error: 'siteId required' });

  const access = await assertSiteAccess(user, siteId);
  if (!access.ok) return json(res, access.code, { ok: false, error: access.error });

  // Load Control Centre choice from brain_settings (survives cold starts; no env var needed).
  await ensureBrainSettings(brain);

  const site = access.site;
  const briefPack = buildLandingBriefInput(body);
  const template = String(body.template || site.template || 'trade');
  const audienceHint = template === 'trade' || template === 'broker-app'
    ? 'Australian local-service / trade customers searching Google for hire or book-now intent'
    : 'Australian mortgage broker clients searching Google for local lending help';

  const rawServices = servicesFromSite(site);
  const filteredServices = filterServicesSummary(rawServices, briefPack.negativeList);
  const providerOverride =
    String(body.provider || body.providerOverride || '').trim() ||
    getLandingDraftProvider(brain);

  const actor = {
    userId: user.id,
    role: access.role,
    partnerId: access.partnerId
  };

  const baseInput = {
    brief: briefPack.brief,
    template,
    audienceHint,
    primaryKeywordHint: briefPack.primaryKeywordHint,
    location: briefPack.location || '',
    negativeKeywords: briefPack.negativeKeywords,
    extraInfo: briefPack.extraInfo,
    uniquenessSeed: briefPack.uniquenessSeed,
    servicesSummary: filteredServices,
    providerOverride
  };

  let result = await runDraft(brain, { site, actor, providerOverride, input: baseInput });

  if (!result.ok) {
    return json(res, 502, {
      ok: false,
      error: (result.error && result.error.code) || 'brain_failed',
      message: (result.error && result.error.message) || 'Draft generation failed',
      correlationId: result.correlationId
    });
  }

  let draft = normalizeLandingDraft(result.output, {
    businessName: site.business_name || (site.config && site.config.businessName) || '',
    location: briefPack.location || ''
  });

  // If the model still mentioned banned topics, retry once with a harder ban.
  let hits = findNegativeHits(draft, briefPack.negativeList);
  let retried = false;
  if (hits.length) {
    retried = true;
    const retryInput = Object.assign({}, baseInput, {
      uniquenessSeed: briefPack.uniquenessSeed + '-retry',
      brief:
        briefPack.brief +
        '\n\nCRITICAL RETRY: Your previous draft illegally mentioned: ' +
        hits.join(', ') +
        '. Rewrite the entire page with ZERO mentions of those topics.',
      temperature: 0.55
    });
    const retry = await runDraft(brain, {
      site,
      actor,
      providerOverride,
      input: retryInput
    });
    if (retry.ok) {
      result = retry;
      draft = normalizeLandingDraft(retry.output, {
        businessName: site.business_name || (site.config && site.config.businessName) || '',
        location: briefPack.location || ''
      });
      hits = findNegativeHits(draft, briefPack.negativeList);
    }
  }

  if (hits.length) {
    return json(res, 422, {
      ok: false,
      error: 'negative_keyword_violation',
      message:
        'Draft still mentioned banned topics (' +
        hits.join(', ') +
        '). Tighten negatives or try another provider (e.g. OpenAI) in AI Control Centre.',
      hits,
      draft,
      correlationId: result.correlationId
    });
  }

  return json(res, 200, {
    ok: true,
    draft,
    usage: result.usage,
    prompt: result.prompt,
    model: result.model,
    correlationId: result.correlationId,
    provider: (result.model && result.model.provider) || providerOverride,
    brief: {
      mode: briefPack.mode,
      primaryKeyword: briefPack.primaryKeywordHint,
      location: briefPack.location,
      negativeKeywords: briefPack.negativeList,
      retried
    },
    notice:
      'AI suggests — preview and approve in the editor before saving. Approve fills title, slug, meta, H1, body and FAQ app.'
  });
};
