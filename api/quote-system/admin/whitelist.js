/**
 * GET/POST/DELETE /api/quote-system/admin/whitelist
 * Manage per-site verified email accounts (whitelist + phone + name aliases).
 */

const { readBody, json, clean } = require('../../../lib/quote-system/http');
const {
  requireUser,
  assertSiteAccess
} = require('../../../lib/quote-system/auth');
const {
  normalizeEmail,
  listWhitelistedEmails,
  whitelistEmail,
  removeWhitelistedEmail
} = require('../../../lib/quote-system/email-whitelist');
const { normaliseAuPhone } = require('../../../lib/quote-system/phone');

module.exports = async function handler(req, res) {
  const user = await requireUser(req);
  if (!user) return json(res, 401, { ok: false, error: 'auth' });

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'https://x');
      const siteId = clean(url.searchParams.get('site_id'), 80);
      if (!siteId) return json(res, 400, { ok: false, error: 'site_id_required' });
      const access = await assertSiteAccess(user, siteId);
      if (!access.ok) return json(res, access.code, { ok: false, error: access.error });
      const rows = await listWhitelistedEmails(siteId, 100);
      return json(res, 200, { ok: true, emails: rows });
    }

    const body = await readBody(req);
    const siteId = clean(body.site_id || body.siteId, 80);
    if (!siteId) return json(res, 400, { ok: false, error: 'site_id_required' });
    const access = await assertSiteAccess(user, siteId);
    if (!access.ok) return json(res, access.code, { ok: false, error: access.error });

    if (req.method === 'POST') {
      const email = normalizeEmail(clean(body.email, 160));
      if (!email || email.indexOf('@') < 3) {
        return json(res, 400, { ok: false, error: 'valid_email_required' });
      }
      await whitelistEmail(siteId, email, {
        name: clean(body.name || body.primary_name, 120),
        phone: body.phone ? normaliseAuPhone(body.phone) : ''
      });
      const rows = await listWhitelistedEmails(siteId, 100);
      return json(res, 200, { ok: true, emails: rows });
    }

    if (req.method === 'DELETE') {
      const email = normalizeEmail(clean(body.email, 160));
      if (!email) return json(res, 400, { ok: false, error: 'email_required' });
      await removeWhitelistedEmail(siteId, email);
      const rows = await listWhitelistedEmails(siteId, 100);
      return json(res, 200, { ok: true, emails: rows });
    }

    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  } catch (e) {
    console.error('quote-system/admin/whitelist:', e && e.message);
    return json(res, 500, { ok: false, error: e && e.message ? e.message : 'server_error' });
  }
};
