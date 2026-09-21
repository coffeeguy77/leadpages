'use strict';

/**
 * Per-app section copy via Brain.
 * POST /api/brain/app-content
 *   { siteId, appKey, primaryKeyword?, location?, negativeKeywords?, extraInfo?, targets?, template? }
 *
 * Returns a draft for one editor app. The editor applies it only after the user approves.
 * Does not write page title, meta, FAQ, or hero sliders.
 * Flag: BRAIN_APP_CONTENT (default on; set 0 to disable).
 */

const { createClient } = require('@supabase/supabase-js');
const {
  getPlatformBrain,
  isAppContentEnabled,
  getLandingDraftProvider,
  ensureBrainSettings
} = require('../../lib/brain/platform');
const {
  SCHEMA,
  spec,
  writingBrief,
  normalizeDraft
} = require('../../assets/js/app-content-ai');
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
    taskId: 'content.app_section',
    promptId: 'content.app_section',
    siteId: args.site.id,
    site: args.site,
    actor: args.actor,
    contextSlices: ['site.identity', 'site.brand', 'site.areas'],
    temperature: 0.65,
    providerOverride: args.providerOverride,
    input: args.input,
    responseSchema: SCHEMA
  });
}

module.exports = async function appContent(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'POST only' });
  }

  const brain = getPlatformBrain();
  if (!isAppContentEnabled(brain)) {
    return json(res, 503, {
      ok: false,
      error: 'app_content_disabled',
      message: 'App content AI is off. Unset BRAIN_APP_CONTENT or set it to 1.'
    });
  }

  const user = await requireUser(req);
  if (!user) return json(res, 401, { ok: false, error: 'unauthorized' });

  const body = await readBody(req);
  const siteId = String(body.siteId || '').trim();
  const appKey = String(body.appKey || '').trim();
  if (!siteId) return json(res, 400, { ok: false, error: 'siteId required' });
  if (!spec(appKey)) {
    return json(res, 400, { ok: false, error: 'unknown_app', message: 'This app does not take generated section copy.' });
  }

  const access = await assertSiteAccess(user, siteId);
  if (!access.ok) return json(res, access.code, { ok: false, error: access.error });

  await ensureBrainSettings(brain);

  const site = access.site;
  const briefPack = buildLandingBriefInput(body);
  const template = String(body.template || site.template || 'trade');
  const audienceHint = template === 'broker' || template === 'brokerapp'
    ? 'Australian clients looking for a clear local explanation, not a hard sell'
    : 'Australian customers comparing a local business before they call or book';
  const targets = String(body.targets || '').trim();
  const appSpec = spec(appKey);
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
    targets: targets || 'none — choose a sensible set from the keyword and extra notes',
    writingBrief: writingBrief(appKey),
    appKey,
    appLabel: appSpec.label,
    depth: appSpec.depth,
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

  let draft = normalizeDraft(result.output);
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
        '. Rewrite the section with ZERO mentions of those topics.'
    });
    const retry = await runDraft(brain, { site, actor, providerOverride, input: retryInput });
    if (retry.ok) {
      result = retry;
      draft = normalizeDraft(retry.output);
      hits = findNegativeHits(draft, briefPack.negativeList);
    }
  }

  if (hits.length) {
    return json(res, 422, {
      ok: false,
      error: 'negative_keyword_violation',
      message: 'Draft still mentioned banned topics (' + hits.join(', ') + '). Tighten exclusions or try another provider in AI Control Centre.',
      hits,
      draft,
      correlationId: result.correlationId
    });
  }

  return json(res, 200, {
    ok: true,
    appKey,
    draft,
    usage: result.usage,
    prompt: result.prompt,
    model: result.model,
    correlationId: result.correlationId,
    provider: (result.model && result.model.provider) || providerOverride,
    brief: {
      primaryKeyword: briefPack.primaryKeywordHint,
      location: briefPack.location,
      negativeKeywords: briefPack.negativeList,
      targets,
      retried
    },
    notice: 'Draft only — nothing is written until you use it in the editor.'
  });
};
