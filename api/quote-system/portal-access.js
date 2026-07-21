/**
 * POST /api/quote-system/portal-access
 *   { slug, email }
 * Emails a private jobs-portal magic link when the address has (or can recover)
 * a customer portal for that site. Always returns a generic success message.
 */

const { readBody, json, clean } = require('../../lib/quote-system/http');
const {
  resolveSiteBySlug,
  getQuoteSystemForSite,
  getActiveConfig
} = require('../../lib/quote-system/auth');
const {
  resolvePortalForAccess,
  jobsPortalUrl
} = require('../../lib/quote-system/customer-portal');
const { normalizeEmail } = require('../../lib/quote-system/email-whitelist');
const { sendPortalAccessEmail } = require('../../lib/quote-system/portal-email');
const { assertQuoteAppEntitled } = require('../../lib/quote-system/billing');

const GENERIC_OK =
  'If we have quotes for that email, we just sent a private access link. Check your inbox (and spam).';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  try {
    const body = await readBody(req);
    const slug = clean(body.slug, 80).toLowerCase();
    const email = normalizeEmail(clean(body.email, 160));

    if (!slug) return json(res, 400, { ok: false, error: 'slug_required' });
    if (!email || email.indexOf('@') < 3) {
      return json(res, 400, { ok: false, error: 'valid_email_required' });
    }

    const site = await resolveSiteBySlug(slug);
    if (!site) {
      // Do not leak whether the site exists.
      return json(res, 200, { ok: true, message: GENERIC_OK });
    }

    const entitled = await assertQuoteAppEntitled(site.id);
    if (!entitled.ok) {
      return json(res, 200, { ok: true, message: GENERIC_OK });
    }

    const quoteSystem = await getQuoteSystemForSite(site.id);
    if (!quoteSystem || !quoteSystem.enabled) {
      return json(res, 200, { ok: true, message: GENERIC_OK });
    }

    const resolved = await resolvePortalForAccess(site.id, email);
    if (!resolved.ok || !resolved.portal || !resolved.portal.access_token) {
      return json(res, 200, { ok: true, message: GENERIC_OK });
    }

    let businessName = site.business_name || site.slug || 'your provider';
    try {
      const configVersion = await getActiveConfig(quoteSystem);
      const cfgName = configVersion &&
        configVersion.config &&
        configVersion.config.business &&
        configVersion.config.business.name;
      if (cfgName) businessName = cfgName;
    } catch (_) { /* ignore */ }

    const portalUrl = jobsPortalUrl(req, resolved.portal.access_token);
    const mail = await sendPortalAccessEmail({
      to: email,
      businessName: businessName,
      portalUrl: portalUrl
    });

    if (!mail.sent && mail.reason === 'no_key') {
      return json(res, 503, {
        ok: false,
        error: 'email_not_configured',
        message: 'Portal access email is not configured yet. Please contact the business directly.'
      });
    }

    return json(res, 200, {
      ok: true,
      message: GENERIC_OK,
      sent: !!mail.sent
    });
  } catch (e) {
    console.error('quote-system/portal-access:', e && e.message);
    return json(res, 200, { ok: true, message: GENERIC_OK });
  }
};
