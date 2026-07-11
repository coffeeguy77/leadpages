/**
 * Online Quote System — auth, site access, and classification guards.
 */

const { getAdmin } = require('./supabase');
const { CONFIG_CLASSIFICATION } = require('./constants');

async function requireUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  try {
    const userClient = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
      { global: { headers: { Authorization: 'Bearer ' + token } } }
    );
    const { data, error } = await userClient.auth.getUser(token);
    if (error || !data || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

async function isSuperAdmin(userId) {
  const admin = getAdmin();
  const { data } = await admin.from('profiles').select('is_super_admin').eq('id', userId).maybeSingle();
  return !!(data && data.is_super_admin);
}

async function partnerIdForUser(userId) {
  const admin = getAdmin();
  const { data } = await admin.from('partners').select('id,status').eq('user_id', userId).maybeSingle();
  if (!data || data.status !== 'active') return null;
  return data.id;
}

async function assertSiteAccess(user, siteId) {
  if (!siteId) return { ok: false, code: 400, error: 'no_site' };
  const admin = getAdmin();
  const { data: site, error } = await admin.from('sites')
    .select('id,slug,owner_user_id,servicing_partner_id,referring_partner_id,business_name')
    .eq('id', siteId)
    .maybeSingle();
  if (error || !site) return { ok: false, code: 404, error: 'site_not_found' };

  if (user) {
    if (await isSuperAdmin(user.id)) return { ok: true, site, isSuper: true };
    if (site.owner_user_id && site.owner_user_id === user.id) return { ok: true, site, isSuper: false };
    const partnerId = await partnerIdForUser(user.id);
    if (partnerId && (site.servicing_partner_id === partnerId || site.referring_partner_id === partnerId)) {
      return { ok: true, site, isSuper: false };
    }
    if (!site.owner_user_id) return { ok: true, site, isSuper: false };
    return { ok: false, code: 403, error: 'not_your_site' };
  }
  return { ok: false, code: 401, error: 'auth' };
}

async function resolveSiteBySlug(slug) {
  const admin = getAdmin();
  const clean = String(slug || '').trim().toLowerCase();
  if (!clean) return null;
  const { data } = await admin.from('sites')
    .select('id,slug,business_name,owner_user_id,template')
    .eq('slug', clean)
    .maybeSingle();
  return data || null;
}

async function getQuoteSystemForSite(siteId) {
  const admin = getAdmin();
  const { data } = await admin.from('quote_systems')
    .select('id,site_id,enabled,configuration_classification,active_config_version_id,created_at,updated_at')
    .eq('site_id', siteId)
    .maybeSingle();
  return data || null;
}

async function getActiveConfig(quoteSystem) {
  if (!quoteSystem || !quoteSystem.active_config_version_id) return null;
  const admin = getAdmin();
  const { data } = await admin.from('quote_system_config_versions')
    .select('id,quote_system_id,version_number,label,config,created_at')
    .eq('id', quoteSystem.active_config_version_id)
    .maybeSingle();
  return data || null;
}

function canReadFullConfig(quoteSystem, { isSuper, isAdminRequest, isOwner }) {
  if (!quoteSystem) return false;
  if (quoteSystem.configuration_classification === CONFIG_CLASSIFICATION.BLANK) {
    return isAdminRequest && (isSuper || !!isOwner);
  }
  if (quoteSystem.configuration_classification === CONFIG_CLASSIFICATION.PRIVATE_SUPERUSER) {
    return isAdminRequest && isSuper;
  }
  if (quoteSystem.configuration_classification === CONFIG_CLASSIFICATION.PUBLIC) {
    return !!isAdminRequest;
  }
  return false;
}

function canWriteConfig(quoteSystem, { isSuper, isOwner }) {
  if (!quoteSystem) return isSuper || !!isOwner;
  const cls = quoteSystem.configuration_classification;
  if (cls === CONFIG_CLASSIFICATION.PRIVATE_SUPERUSER) return isSuper;
  if (cls === CONFIG_CLASSIFICATION.BLANK) return isSuper || !!isOwner;
  if (cls === CONFIG_CLASSIFICATION.PUBLIC) return isSuper || !!isOwner;
  return isSuper;
}

async function getSessionByToken(sessionToken) {
  const admin = getAdmin();
  const token = String(sessionToken || '').trim();
  if (!token || token.length < 16) return null;
  const { data } = await admin.from('quote_sessions')
    .select('*')
    .eq('session_token', token)
    .maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return { expired: true, session: data };
  return { expired: false, session: data };
}

function verificationLevelForSession(session) {
  if (!session) return 'public_progress';
  if (session.sms_verified_at) return 'fully_verified_quote';
  if (session.email_verified_at) return 'email_verified_total';
  return 'public_progress';
}

module.exports = {
  requireUser,
  isSuperAdmin,
  partnerIdForUser,
  assertSiteAccess,
  resolveSiteBySlug,
  getQuoteSystemForSite,
  getActiveConfig,
  canReadFullConfig,
  canWriteConfig,
  getSessionByToken,
  verificationLevelForSession
};
