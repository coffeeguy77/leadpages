/**
 * Online Quote System — customer portal tokens and quote retrieval.
 */

const crypto = require('crypto');
const { getAdmin } = require('./supabase');
const { newSessionToken } = require('./session');
const { RESPONSE_LEVEL, SESSION_STATUS } = require('./constants');
const { calculateQuote } = require('./calculator');
const {
  nextQuoteVersionNumber,
  insertQuoteVersion,
  updateSession
} = require('./session');
const { getActiveConfig, getQuoteSystemForSite, verificationLevelForSession } = require('./auth');
const { serializeQuoteResult } = require('./serializers');

function portalBaseUrl(req) {
  const host = (req && (req.headers['x-forwarded-host'] || req.headers.host)) || 'leadpages.com.au';
  const proto = (req && req.headers['x-forwarded-proto']) || 'https';
  return String(proto).split(',')[0].trim() + '://' + String(host).split(',')[0].trim();
}

function portalUrl(req, portalToken) {
  return portalBaseUrl(req) + '/quote-portal?t=' + encodeURIComponent(portalToken);
}

function pdfUrl(req, portalToken) {
  return portalBaseUrl(req) + '/api/quote-system/portal-pdf?t=' + encodeURIComponent(portalToken);
}

async function getSessionByPortalToken(portalToken) {
  const admin = getAdmin();
  const token = String(portalToken || '').trim();
  if (!token || token.length < 16) return null;
  const { data } = await admin.from('quote_sessions')
    .select('*')
    .eq('portal_token', token)
    .maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { expired: true, session: data };
  }
  return { expired: false, session: data };
}

async function ensurePortalToken(session) {
  if (session.portal_token) return session.portal_token;
  const token = newSessionToken();
  const updated = await updateSession(session.id, { portal_token: token });
  return updated.portal_token;
}

async function getLatestQuoteVersion(sessionId) {
  const admin = getAdmin();
  const { data } = await admin.from('quote_versions')
    .select('*')
    .eq('session_id', sessionId)
    .order('version_number', { ascending: false })
    .limit(1);
  return data && data[0] ? data[0] : null;
}

async function storeQuoteVersion(session, quoteSystem, configVersion, level) {
  const calc = calculateQuote(configVersion.config, session.progress || {});
  const versionNumber = await nextQuoteVersionNumber(session.id);
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
  return { calc, version };
}

async function finalizeVerifiedPortal(session, req) {
  if (!session.sms_verified_at) {
    return { ok: false, error: 'sms_not_verified' };
  }

  const quoteSystem = await getQuoteSystemForSite(session.site_id);
  if (!quoteSystem || !quoteSystem.enabled) {
    return { ok: false, error: 'quote_not_enabled' };
  }

  const configVersion = await getActiveConfig(quoteSystem);
  if (!configVersion) return { ok: false, error: 'no_config' };

  const level = RESPONSE_LEVEL.FULLY_VERIFIED_QUOTE;
  const { calc, version } = await storeQuoteVersion(session, quoteSystem, configVersion, level);

  const portalToken = await ensurePortalToken(session);
  const updated = await updateSession(session.id, {
    status: SESSION_STATUS.SUBMITTED
  });

  return {
    ok: true,
    session: Object.assign({}, updated, { portal_token: portalToken }),
    version,
    quote: serializeQuoteResult(Object.assign({}, calc, { versionNumber: version.version_number }), level),
    portalUrl: portalUrl(req, portalToken),
    pdfUrl: pdfUrl(req, portalToken)
  };
}

function canAccessPortal(session) {
  if (!session) return false;
  if (session.status === SESSION_STATUS.ACCEPTED) return true;
  return !!session.sms_verified_at;
}

async function trackPortalView(session) {
  const now = new Date().toISOString();
  const patch = {
    portal_last_viewed_at: now,
    portal_view_count: Math.max(0, Number(session.portal_view_count) || 0) + 1
  };
  if (!session.portal_viewed_at) patch.portal_viewed_at = now;
  return updateSession(session.id, patch);
}

async function loadPortalContext(portalToken) {
  const result = await getSessionByPortalToken(portalToken);
  if (!result) return { ok: false, code: 404, error: 'portal_not_found' };
  if (result.expired) return { ok: false, code: 410, error: 'portal_expired' };

  const session = result.session;
  if (!canAccessPortal(session)) {
    return { ok: false, code: 403, error: 'not_fully_verified' };
  }

  const admin = getAdmin();
  const { data: site } = await admin.from('sites')
    .select('id,slug,business_name,owner_user_id,config')
    .eq('id', session.site_id)
    .maybeSingle();
  if (!site) return { ok: false, code: 404, error: 'site_not_found' };

  const version = await getLatestQuoteVersion(session.id);
  if (!version) return { ok: false, code: 404, error: 'no_quote_version' };

  const quoteSystem = await getQuoteSystemForSite(session.site_id);
  const configVersion = quoteSystem ? await getActiveConfig(quoteSystem) : null;
  const businessName = (configVersion && configVersion.config && configVersion.config.business && configVersion.config.business.name)
    || site.business_name
    || 'Your quote';

  const calc = {
    breakdown: version.breakdown || [],
    subtotalCents: version.subtotal_cents,
    gstCents: version.gst_cents,
    totalCents: version.total_cents,
    inputs: version.inputs || {},
    versionNumber: version.version_number
  };

  return {
    ok: true,
    session,
    site,
    version,
    businessName,
    quote: serializeQuoteResult(calc, RESPONSE_LEVEL.FULLY_VERIFIED_QUOTE),
    verificationLevel: verificationLevelForSession(session),
    accepted: session.status === SESSION_STATUS.ACCEPTED,
    acceptedAt: session.accepted_at || null
  };
}

function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(String(ip)).digest('hex').slice(0, 32);
}

module.exports = {
  portalBaseUrl,
  portalUrl,
  pdfUrl,
  getSessionByPortalToken,
  ensurePortalToken,
  getLatestQuoteVersion,
  finalizeVerifiedPortal,
  canAccessPortal,
  trackPortalView,
  loadPortalContext,
  hashIp
};
