/**
 * POST /api/quote-system/session
 *   { slug, progress?, contact? }  → create session
 * GET  /api/quote-system/session?token=...
 *   → session state (masked contact)
 */

const { readBody, json, clean } = require('../../lib/quote-system/http');
const {
  resolveSiteBySlug,
  getQuoteSystemForSite,
  getSessionByToken,
  verificationLevelForSession
} = require('../../lib/quote-system/auth');
const { createSession, updateSession } = require('../../lib/quote-system/session');
const { serializeSession } = require('../../lib/quote-system/serializers');
const { assertQuoteAppEntitled } = require('../../lib/quote-system/billing');
const { normalizeEmail, isEmailWhitelisted } = require('../../lib/quote-system/email-whitelist');
const { normaliseAuPhone } = require('../../lib/quote-system/phone');

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'https://x');
      const token = (url.searchParams.get('token') || '').trim();
      if (!token) return json(res, 400, { ok: false, error: 'token_required' });

      const result = await getSessionByToken(token);
      if (!result) return json(res, 404, { ok: false, error: 'session_not_found' });
      if (result.expired) return json(res, 410, { ok: false, error: 'session_expired' });

      const level = verificationLevelForSession(result.session);
      return json(res, 200, {
        ok: true,
        session: serializeSession(result.session, level)
      });
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const slug = clean(body.slug, 80).toLowerCase();
      if (!slug) return json(res, 400, { ok: false, error: 'slug_required' });

      const site = await resolveSiteBySlug(slug);
      if (!site) return json(res, 404, { ok: false, error: 'site_not_found' });

      const quoteSystem = await getQuoteSystemForSite(site.id);
      if (!quoteSystem || !quoteSystem.enabled) {
        return json(res, 403, { ok: false, error: 'quote_not_enabled' });
      }

      const entitled = await assertQuoteAppEntitled(site.id);
      if (!entitled.ok) {
        return json(res, 403, { ok: false, error: entitled.error });
      }

      const token = clean(body.token, 128);
      const contact = body.contact || {};
      const contactName = contact.name ? clean(contact.name, 120) : '';
      const contactEmail = contact.email
        ? normalizeEmail(clean(contact.email, 160))
        : '';
      const contactPhone = contact.phone
        ? clean(normaliseAuPhone(contact.phone), 60)
        : '';

      if (token) {
        const existing = await getSessionByToken(token);
        if (!existing || existing.expired) {
          return json(res, existing && existing.expired ? 410 : 404, {
            ok: false,
            error: existing && existing.expired ? 'session_expired' : 'session_not_found'
          });
        }
        const patch = {};
        if (body.progress && typeof body.progress === 'object') {
          patch.progress = Object.assign({}, existing.session.progress || {}, body.progress);
        }
        if (contactName) patch.contact_name = contactName;
        if (contactEmail) {
          patch.contact_email = contactEmail;
          if (!existing.session.email_verified_at && await isEmailWhitelisted(existing.session.site_id, contactEmail)) {
            patch.email_verified_at = new Date().toISOString();
          }
        }
        if (contactPhone) patch.contact_phone = contactPhone;

        const updated = await updateSession(existing.session.id, patch);
        const level = verificationLevelForSession(updated);
        return json(res, 200, {
          ok: true,
          token: updated.session_token,
          session: serializeSession(updated, level)
        });
      }

      let session = await createSession(
        site.id,
        quoteSystem.id,
        body.progress && typeof body.progress === 'object' ? body.progress : {}
      );

      // First create used to drop contact — calculate then skipped email OTP entirely.
      const createPatch = {};
      if (contactName) createPatch.contact_name = contactName;
      if (contactEmail) {
        createPatch.contact_email = contactEmail;
        if (await isEmailWhitelisted(site.id, contactEmail)) {
          createPatch.email_verified_at = new Date().toISOString();
        }
      }
      if (contactPhone) createPatch.contact_phone = contactPhone;
      if (Object.keys(createPatch).length) {
        session = await updateSession(session.id, createPatch);
      }

      return json(res, 201, {
        ok: true,
        token: session.session_token,
        session: serializeSession(session, verificationLevelForSession(session))
      });
    }

    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  } catch (e) {
    console.error('quote-system/session:', e && e.message);
    return json(res, 500, { ok: false, error: 'server_error' });
  }
};
