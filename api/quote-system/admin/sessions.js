/**
 * GET /api/quote-system/admin/sessions?site_id=...&limit=50
 * Lists quote sessions for site owners / partners / super admins.
 */

const { json, clean } = require('../../../lib/quote-system/http');
const {
  requireUser,
  assertSiteAccess,
  isSuperAdmin,
  verificationLevelForSession
} = require('../../../lib/quote-system/auth');
const { serializeSession } = require('../../../lib/quote-system/serializers');
const { RESPONSE_LEVEL } = require('../../../lib/quote-system/constants');
const { getAdmin } = require('../../../lib/quote-system/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  const user = await requireUser(req);
  if (!user) return json(res, 401, { ok: false, error: 'auth' });

  try {
    const url = new URL(req.url, 'https://x');
    const siteId = clean(url.searchParams.get('site_id'), 80);
    if (!siteId) return json(res, 400, { ok: false, error: 'site_id_required' });

    const access = await assertSiteAccess(user, siteId);
    if (!access.ok) return json(res, access.code, { ok: false, error: access.error });

    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50));
    const admin = getAdmin();
    const { data: sessions, error } = await admin.from('quote_sessions')
      .select('id,session_token,portal_token,status,progress,contact_name,contact_email,contact_phone,email_verified_at,sms_verified_at,accepted_at,lead_id,created_at,updated_at')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return json(res, 500, { ok: false, error: error.message });

    const isSuper = await isSuperAdmin(user.id);
    const level = isSuper ? RESPONSE_LEVEL.AUTHORISED_ADMIN_QUOTE : RESPONSE_LEVEL.FULLY_VERIFIED_QUOTE;

    const sessionIds = (sessions || []).map(function(s) { return s.id; });
    let versions = [];
    if (sessionIds.length) {
      const { data: vrows } = await admin.from('quote_versions')
        .select('session_id,version_number,total_cents,verification_level,created_at')
        .in('session_id', sessionIds)
        .order('version_number', { ascending: false });
      versions = vrows || [];
    }

    const latestBySession = {};
    versions.forEach(function(v) {
      if (!latestBySession[v.session_id]) latestBySession[v.session_id] = v;
    });

    const out = (sessions || []).map(function(s) {
      return Object.assign(serializeSession(s, level), {
        latestQuote: latestBySession[s.id] || null,
        verificationLevel: verificationLevelForSession(s),
        acceptedAt: s.accepted_at || null,
        portalPath: s.portal_token ? ('/quote-portal?t=' + encodeURIComponent(s.portal_token)) : null
      });
    });

    return json(res, 200, { ok: true, sessions: out });
  } catch (e) {
    console.error('quote-system/admin/sessions:', e && e.message);
    return json(res, 500, { ok: false, error: 'server_error' });
  }
};
