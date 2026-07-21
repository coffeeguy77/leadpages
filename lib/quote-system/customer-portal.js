/**
 * Online Quote System — email-scoped customer jobs portal.
 */

const crypto = require('crypto');
const { getAdmin } = require('./supabase');
const { normalizeEmail } = require('./email-whitelist');
const { portalBaseUrl, pdfUrl, portalUrl, getLatestQuoteVersion, loadPortalContext } = require('./portal');
const { updateSession, nextQuoteVersionNumber, insertQuoteVersion } = require('./session');
const { calculateQuote } = require('./calculator');
const { getActiveConfig, getQuoteSystemForSite, verificationLevelForSession } = require('./auth');
const { serializeQuoteResult } = require('./serializers');
const { RESPONSE_LEVEL, SESSION_STATUS } = require('./constants');

function newAccessToken() {
  return crypto.randomBytes(32).toString('hex');
}

function jobsPortalUrl(req, accessToken) {
  return portalBaseUrl(req) + '/quote-portal?c=' + encodeURIComponent(accessToken);
}

function jobPortalUrl(req, accessToken, sessionId) {
  return jobsPortalUrl(req, accessToken) + '&job=' + encodeURIComponent(sessionId);
}

async function ensureCustomerPortal(siteId, email, phone) {
  const normalized = normalizeEmail(email);
  if (!siteId || !normalized || normalized.indexOf('@') < 3) {
    return { ok: false, error: 'valid_email_required' };
  }
  const admin = getAdmin();
  const { data: existing } = await admin.from('quote_customer_portals')
    .select('*')
    .eq('site_id', siteId)
    .eq('email', normalized)
    .maybeSingle();

  if (existing && existing.access_token) {
    const patch = { last_accessed_at: new Date().toISOString() };
    if (phone && phone !== existing.phone) patch.phone = phone;
    const { data: updated } = await admin.from('quote_customer_portals')
      .update(patch)
      .eq('id', existing.id)
      .select('*')
      .maybeSingle();
    return { ok: true, portal: updated || existing };
  }

  const row = {
    site_id: siteId,
    email: normalized,
    access_token: newAccessToken(),
    phone: phone || null,
    last_accessed_at: new Date().toISOString()
  };
  const { data, error } = await admin.from('quote_customer_portals')
    .upsert(row, { onConflict: 'site_id,email' })
    .select('*')
    .single();
  if (error) {
    // Table may not be migrated yet — soft-fail so SMS verify still works.
    console.warn('quote_customer_portals ensure:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, portal: data };
}

async function getCustomerPortalByToken(accessToken) {
  const token = String(accessToken || '').trim();
  if (!token || token.length < 16) return null;
  const admin = getAdmin();
  const { data, error } = await admin.from('quote_customer_portals')
    .select('*')
    .eq('access_token', token)
    .maybeSingle();
  if (error) {
    console.warn('quote_customer_portals lookup:', error.message);
    return null;
  }
  return data || null;
}

async function touchCustomerPortal(portal) {
  if (!portal || !portal.id) return portal;
  const admin = getAdmin();
  await admin.from('quote_customer_portals')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', portal.id);
  return portal;
}

function formatMoney(cents) {
  return '$' + (Math.round(cents) / 100).toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function jobTitle(progress, version) {
  const p = progress || {};
  const inputs = (version && version.inputs) || {};
  const custom = p.customAnswers || inputs.customAnswers || {};
  const eventName = custom.eventName || custom.event_name || custom['Event name'] || '';
  if (eventName) return String(eventName);
  if (p.eventDate || inputs.eventDate) {
    return 'Event ' + String(p.eventDate || inputs.eventDate);
  }
  return 'Quote';
}

async function listCustomerJobs(siteId, email) {
  const normalized = normalizeEmail(email);
  const admin = getAdmin();
  const { data: sessions, error } = await admin.from('quote_sessions')
    .select('id,status,progress,contact_name,contact_email,contact_phone,email_verified_at,sms_verified_at,portal_token,accepted_at,created_at,updated_at,expires_at')
    .eq('site_id', siteId)
    .eq('contact_email', normalized)
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);

  const jobs = [];
  for (const session of (sessions || [])) {
    if (!session.email_verified_at && !session.sms_verified_at) continue;
    const version = await getLatestQuoteVersion(session.id);
    const totalCents = version ? version.total_cents : null;
    jobs.push({
      id: session.id,
      status: session.status,
      accepted: session.status === SESSION_STATUS.ACCEPTED,
      acceptedAt: session.accepted_at || null,
      smsVerified: !!session.sms_verified_at,
      emailVerified: !!session.email_verified_at,
      hasPortal: !!session.portal_token,
      portalPath: session.portal_token ? ('/quote-portal?t=' + encodeURIComponent(session.portal_token)) : null,
      title: jobTitle(session.progress, version),
      eventDate: (session.progress && session.progress.eventDate) ||
        (version && version.inputs && version.inputs.eventDate) || null,
      totalCents: totalCents,
      totalFormatted: totalCents != null ? formatMoney(totalCents) : null,
      updatedAt: session.updated_at,
      createdAt: session.created_at
    });
  }
  return jobs;
}

async function loadCustomerJobsContext(accessToken, req) {
  const portal = await getCustomerPortalByToken(accessToken);
  if (!portal) return { ok: false, code: 404, error: 'portal_not_found' };

  await touchCustomerPortal(portal);

  const admin = getAdmin();
  const { data: site } = await admin.from('sites')
    .select('id,slug,business_name,config')
    .eq('id', portal.site_id)
    .maybeSingle();
  if (!site) return { ok: false, code: 404, error: 'site_not_found' };

  const quoteSystem = await getQuoteSystemForSite(portal.site_id);
  const configVersion = quoteSystem ? await getActiveConfig(quoteSystem) : null;
  const businessName = (configVersion && configVersion.config && configVersion.config.business && configVersion.config.business.name)
    || site.business_name
    || 'Your quotes';

  const jobs = await listCustomerJobs(portal.site_id, portal.email);

  return {
    ok: true,
    mode: 'jobs',
    businessName,
    contact: { email: portal.email, phone: portal.phone || null },
    jobsPortalUrl: jobsPortalUrl(req, portal.access_token),
    jobs: jobs,
    accessToken: portal.access_token,
    siteId: portal.site_id
  };
}

async function loadCustomerJobDetail(accessToken, sessionId, req) {
  const portal = await getCustomerPortalByToken(accessToken);
  if (!portal) return { ok: false, code: 404, error: 'portal_not_found' };

  const admin = getAdmin();
  const { data: session } = await admin.from('quote_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('site_id', portal.site_id)
    .eq('contact_email', portal.email)
    .maybeSingle();
  if (!session) return { ok: false, code: 404, error: 'job_not_found' };
  if (!session.sms_verified_at && session.status !== SESSION_STATUS.ACCEPTED) {
    return { ok: false, code: 403, error: 'sms_required' };
  }

  // Prefer session portal_token path for PDF/accept compatibility.
  if (session.portal_token) {
    const ctx = await loadPortalContext(session.portal_token);
    if (!ctx.ok) return ctx;
    return Object.assign({}, ctx, {
      mode: 'job',
      jobsPortalUrl: jobsPortalUrl(req, portal.access_token),
      accessToken: portal.access_token,
      sessionId: session.id,
      progress: session.progress || {},
      canEdit: session.status !== SESSION_STATUS.ACCEPTED
    });
  }

  return { ok: false, code: 403, error: 'portal_not_ready' };
}

/**
 * Allow customers to tweak editable progress fields and recalculate.
 */
async function updateCustomerJob(accessToken, sessionId, progressPatch) {
  const portal = await getCustomerPortalByToken(accessToken);
  if (!portal) return { ok: false, code: 404, error: 'portal_not_found' };

  const admin = getAdmin();
  const { data: session } = await admin.from('quote_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('site_id', portal.site_id)
    .eq('contact_email', portal.email)
    .maybeSingle();
  if (!session) return { ok: false, code: 404, error: 'job_not_found' };
  if (session.status === SESSION_STATUS.ACCEPTED) {
    return { ok: false, code: 409, error: 'already_accepted' };
  }
  if (!session.sms_verified_at) {
    return { ok: false, code: 403, error: 'sms_required' };
  }

  const quoteSystem = await getQuoteSystemForSite(session.site_id);
  if (!quoteSystem) return { ok: false, code: 403, error: 'quote_not_enabled' };
  const configVersion = await getActiveConfig(quoteSystem);
  if (!configVersion) return { ok: false, code: 503, error: 'no_config' };

  const nextProgress = Object.assign({}, session.progress || {}, sanitizeProgressPatch(progressPatch));
  const updated = await updateSession(session.id, { progress: nextProgress });
  const calc = calculateQuote(configVersion.config, nextProgress);
  const versionNumber = await nextQuoteVersionNumber(session.id);
  const level = RESPONSE_LEVEL.FULLY_VERIFIED_QUOTE;
  const version = await insertQuoteVersion({
    session_id: session.id,
    site_id: session.site_id,
    config_version_id: configVersion.id,
    version_number: versionNumber,
    inputs: calc.inputs,
    breakdown: calc.breakdown,
    subtotal_cents: calc.subtotalCents,
    gst_cents: calc.gstCents,
    total_cents: calc.totalCents,
    verification_level: level
  });

  return {
    ok: true,
    session: updated,
    quote: serializeQuoteResult(
      Object.assign({}, calc, { versionNumber: version.version_number }),
      level
    ),
    verificationLevel: verificationLevelForSession(updated)
  };
}

function sanitizeProgressPatch(patch) {
  const src = patch && typeof patch === 'object' ? patch : {};
  const out = {};
  if (src.hours != null) out.hours = Math.max(0, Math.min(48, parseInt(src.hours, 10) || 0));
  if (src.guestCount != null) out.guestCount = Math.max(0, parseInt(src.guestCount, 10) || 0);
  if (src.unitCount != null) out.unitCount = Math.max(0, parseInt(src.unitCount, 10) || 0);
  if (src.eventDate != null) out.eventDate = String(src.eventDate).slice(0, 32);
  if (Array.isArray(src.addonIds)) {
    out.addonIds = src.addonIds.map(function(id) { return String(id).slice(0, 80); }).slice(0, 40);
  }
  if (Array.isArray(src.beverageLines)) {
    out.beverageLines = src.beverageLines.slice(0, 40).map(function(line) {
      return {
        beverageId: String(line.beverageId || line.id || '').slice(0, 80),
        quantity: Math.max(0, parseInt(line.quantity, 10) || 0)
      };
    }).filter(function(l) { return l.beverageId; });
  }
  if (src.customAnswers && typeof src.customAnswers === 'object') {
    out.customAnswers = src.customAnswers;
  }
  return out;
}

module.exports = {
  ensureCustomerPortal,
  getCustomerPortalByToken,
  jobsPortalUrl,
  jobPortalUrl,
  listCustomerJobs,
  loadCustomerJobsContext,
  loadCustomerJobDetail,
  updateCustomerJob,
  pdfUrl,
  portalUrl
};
