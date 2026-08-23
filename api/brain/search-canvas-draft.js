'use strict';

/**
 * SearchCanvas structured AI draft via Brain (OpenAI preferred).
 * POST /api/brain/search-canvas-draft
 *   { siteId, primaryKeyword, location?, extraInfo?, services?, tabCount?, includeCta?, includeFaq?, tone? }
 *
 * Enabled when BRAIN_SEARCH_CANVAS=1 or BRAIN_LANDING_DRAFT=1.
 */

const { createClient } = require('@supabase/supabase-js');
const {
  getPlatformBrain,
  isLandingDraftEnabled,
  getLandingDraftProvider,
  ensureBrainSettings
} = require('../../lib/brain/platform');
  const {
  SEARCH_CANVAS_DRAFT_SCHEMA,
  normalizeSearchCanvasDraft,
  buildSearchCanvasSystemPrompt,
  buildSearchCanvasUserPrompt,
  mockSearchCanvasDraft,
  extractServicesFromExtraInfo,
  parseExtraInfoSections,
  parseExtraInfoOverview
} = require('../../lib/brain/search-canvas-compose');

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
        try {
          return resolve(JSON.parse(req.body));
        } catch (_e) {
          return resolve({});
        }
      }
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', (c) => {
      raw += c;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (_e) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function envFlagOn(name) {
  const v = String(process.env[name] || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'on' || v === 'yes';
}

function isSearchCanvasDraftEnabled(brain) {
  if (envFlagOn('BRAIN_SEARCH_CANVAS')) return true;
  const flags = (brain && brain.config && brain.config.flags) || {};
  if (flags.searchCanvasDraft === true) return true;
  if (flags.searchCanvasDraft === false) return false;
  return isLandingDraftEnabled(brain);
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
  const { data: site, error } = await admin
    .from('sites')
    .select(
      'id,slug,business_name,custom_domain,config,owner_user_id,servicing_partner_id,referring_partner_id,template'
    )
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
  function titlesFrom(list) {
    if (!Array.isArray(list)) return [];
    return list
      .filter(function (s) {
        return s && s.on !== false;
      })
      .map(function (s) {
        if (typeof s === 'string') return s.trim();
        return String((s && (s.title || s.name || s.label || s.heading)) || '').trim();
      })
      .filter(Boolean);
  }
  const fromRoot = titlesFrom(cfg.services);
  if (fromRoot.length) return fromRoot.slice(0, 8);
  const sec = (cfg.sections && cfg.sections.services) || {};
  const fromSec = titlesFrom(sec.items || sec.cards || sec.list || sec.services);
  if (fromSec.length) return fromSec.slice(0, 8);
  return [];
}

function pagesFromSite(site) {
  const cfg = (site && site.config) || {};
  const pages = Array.isArray(cfg.pages) ? cfg.pages : [];
  return pages
    .map((p) => (p && (p.title || p.slug) ? String(p.title || p.slug) : ''))
    .filter(Boolean)
    .slice(0, 24);
}

function preferOpenAiProvider(brain, bodyProvider) {
  const explicit = String(bodyProvider || '').trim().toLowerCase();
  if (explicit && ['openai', 'anthropic', 'gemini', 'mock'].indexOf(explicit) >= 0) {
    return explicit;
  }
  if (process.env.OPENAI_API_KEY) return 'openai';
  const landing = getLandingDraftProvider(brain);
  if (landing && landing !== 'mock') return landing;
  return String((brain.config && brain.config.defaultProvider) || 'mock').toLowerCase();
}

module.exports = async function searchCanvasDraft(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'POST only' });
  }

  const brain = getPlatformBrain();
  if (!isSearchCanvasDraftEnabled(brain)) {
    return json(res, 503, {
      ok: false,
      error: 'search_canvas_draft_disabled',
      message: 'Set BRAIN_SEARCH_CANVAS=1 or BRAIN_LANDING_DRAFT=1 to enable SearchCanvas AI drafts.'
    });
  }

  const user = await requireUser(req);
  if (!user) return json(res, 401, { ok: false, error: 'unauthorized' });

  const body = await readBody(req);
  const siteId = String(body.siteId || '').trim();
  if (!siteId) return json(res, 400, { ok: false, error: 'siteId required' });

  const primaryKeyword = String(body.primaryKeyword || body.keyword || '').trim();
  if (!primaryKeyword) {
    return json(res, 400, { ok: false, error: 'primaryKeyword required' });
  }

  const access = await assertSiteAccess(user, siteId);
  if (!access.ok) return json(res, access.code, { ok: false, error: access.error });

  await ensureBrainSettings(brain);

  const site = access.site;
  const cfg = site.config || {};
  const services =
    Array.isArray(body.services) && body.services.length
      ? body.services.map(String)
      : servicesFromSite(site);
  const mustIncludeRaw = []
    .concat(Array.isArray(body.mustIncludeServices) ? body.mustIncludeServices : [])
    .concat(
      String(body.mustInclude || '')
        .split(/\n+/)
        .map(function (s) { return s.trim(); })
        .filter(Boolean)
    )
    .concat(extractServicesFromExtraInfo(body.extraInfo || body.context || ''));
  const mustSeen = {};
  const mustIncludeServices = mustIncludeRaw
    .map(function (s) { return String(s || '').trim(); })
    .filter(function (s) {
      if (!s) return false;
      const k = s.toLowerCase();
      if (mustSeen[k]) return false;
      mustSeen[k] = 1;
      return true;
    })
    .slice(0, 12);
  // Prefer must-include at the front of the services list sent to the model.
  const servicesMerged = [];
  const svcSeen = {};
  mustIncludeServices.concat(services).forEach(function (s) {
    const k = String(s || '').toLowerCase();
    if (!k || svcSeen[k]) return;
    svcSeen[k] = 1;
    servicesMerged.push(String(s).trim());
  });
  const location =
    String(body.location || '').trim() ||
    String((cfg.sections && cfg.sections.seoTokens && cfg.sections.seoTokens.location) || cfg.region || '')
      .trim();
  const businessName = site.business_name || cfg.businessName || cfg.business || cfg.name || '';
  const businessType = String(body.businessType || cfg.trade || '').trim();
  const extraInfo = String(body.extraInfo || body.context || '').trim();
  const extraSections = parseExtraInfoSections(extraInfo);
  const extraOverview = parseExtraInfoOverview(extraInfo);
  const brief = {
    businessName: businessName,
    businessType: businessType,
    trade: businessType,
    primaryKeyword: primaryKeyword,
    location: location,
    services: servicesMerged.slice(0, 12),
    mustIncludeServices: mustIncludeServices,
    pages: pagesFromSite(site),
    extraInfo: extraInfo,
    extraSections: extraSections,
    extraOverview: extraOverview,
    tabCount: Math.max(
      3,
      Math.min(
        12,
        Math.max(
          5,
          extraSections.length || 0,
          mustIncludeServices.length || 0,
          Number(body.tabCount) || 0
        )
      )
    ),
    tone: String(body.tone || 'practical and professional').trim(),
    includeCta: body.includeCta !== false,
    includeFaq: !!body.includeFaq
  };

  const providerOverride = preferOpenAiProvider(brain, body.provider || body.providerOverride);
  const actor = {
    userId: user.id,
    role: access.role,
    partnerId: access.partnerId
  };

  if (providerOverride === 'mock') {
    const draft = mockSearchCanvasDraft(brief);
    return json(res, 200, {
      ok: true,
      draft: draft,
      provider: 'mock',
      correlationId: 'mock-search-canvas',
      notice: 'Mock SearchCanvas draft — review before applying.'
    });
  }

  const result = await brain.generateStructured({
    taskId: 'content.search_canvas_draft',
    promptId: 'content.search_canvas_draft',
    siteId: site.id,
    site: site,
    actor: actor,
    contextSlices: ['site.identity', 'site.brand', 'site.areas'],
    temperature: 0.4,
    providerOverride: providerOverride,
    messages: [
      { role: 'system', content: buildSearchCanvasSystemPrompt() },
      { role: 'user', content: buildSearchCanvasUserPrompt(brief) }
    ],
    responseSchema: SEARCH_CANVAS_DRAFT_SCHEMA
  });

  if (!result.ok) {
    // Only soft-fallback to mock when explicitly enabled — never silently ship
    // Planning/Delivery placeholders when a real provider fails.
    const allowMock =
      String(process.env.BRAIN_SEARCH_CANVAS_FALLBACK_MOCK || '').toLowerCase() === '1' ||
      String(process.env.BRAIN_SEARCH_CANVAS_FALLBACK_MOCK || '').toLowerCase() === 'true';
    if (allowMock) {
      const draft = mockSearchCanvasDraft(brief);
      return json(res, 200, {
        ok: true,
        draft: draft,
        provider: 'mock-fallback',
        correlationId: result.correlationId,
        warning: (result.error && result.error.message) || 'provider_failed_used_mock',
        notice: 'Provider unavailable — returned a structured mock draft for review.'
      });
    }
    return json(res, 502, {
      ok: false,
      error: (result.error && result.error.code) || 'brain_failed',
      message: (result.error && result.error.message) || 'SearchCanvas draft failed',
      correlationId: result.correlationId
    });
  }

  const draft = normalizeSearchCanvasDraft(result.output);
  return json(res, 200, {
    ok: true,
    draft: draft,
    usage: result.usage,
    prompt: result.prompt,
    model: result.model,
    correlationId: result.correlationId,
    provider: (result.model && result.model.provider) || providerOverride,
    notice: 'SearchCanvas AI draft ready — review tabs, icons and images before publishing.'
  });
};
