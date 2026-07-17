'use strict';

/**
 * Phase 7 — Landing page AI draft via Brain.
 * POST /api/brain/landing-draft
 *   { siteId, brief?, template? }
 *
 * Flag: BRAIN_LANDING_DRAFT=1 (default off). Approve UI stays in manage.html.
 */

const { createClient } = require('@supabase/supabase-js');
const {
  getPlatformBrain,
  isLandingDraftEnabled
} = require('../../lib/brain/platform');

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

const LANDING_SCHEMA = {
  type: 'object',
  required: ['title', 'bodyMarkdown'],
  properties: {
    title: { type: 'string' },
    bodyMarkdown: { type: 'string' }
  },
  additionalProperties: false
};

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

  const site = access.site;
  const brief = String(body.brief || '').trim() ||
    'Write a conversion-focused landing page for this Australian business.';
  const template = String(body.template || site.template || 'trade');

  const result = await brain.generateStructured({
    taskId: 'content.landing_draft',
    promptId: 'content.landing_draft',
    siteId: site.id,
    site,
    actor: {
      userId: user.id,
      role: access.role,
      partnerId: access.partnerId
    },
    contextSlices: ['site.identity', 'site.brand', 'site.services'],
    input: {
      brief,
      template,
      audienceHint: template === 'trade'
        ? 'Australian trade / home-services customers'
        : 'Australian mortgage broker clients'
    },
    responseSchema: LANDING_SCHEMA
  });

  if (!result.ok) {
    return json(res, 502, {
      ok: false,
      error: (result.error && result.error.code) || 'brain_failed',
      message: (result.error && result.error.message) || 'Draft generation failed',
      correlationId: result.correlationId
    });
  }

  // Compose markdown the approve UI expects (title + body).
  const title = String(result.output.title || '').trim();
  const bodyMd = String(result.output.bodyMarkdown || '').trim();
  const markdown = title
    ? (bodyMd.startsWith('#') ? bodyMd : ('# ' + title + '\n\n' + bodyMd))
    : bodyMd;

  return json(res, 200, {
    ok: true,
    draft: {
      title,
      bodyMarkdown: bodyMd,
      markdown
    },
    usage: result.usage,
    prompt: result.prompt,
    model: result.model,
    correlationId: result.correlationId,
    notice: 'AI suggests — preview and approve in the editor before saving.'
  });
};
