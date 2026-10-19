'use strict';

/**
 * POST /api/ai-composer/snapshot   Body: { slug }
 * Full-page screenshot of a site AI Composer built (its ?preview=1 page, so drafts and
 * partner demos work), plus where each app section sits. Used by the visual check.
 * The caller must be allowed to compose that site (lib/ai-composer/access.js).
 */

const { sendJson, readBody, admin } = require('../../lib/layout-composer/http');
const { requireComposerAccess, canComposeSite } = require('../../lib/ai-composer/access');
const snapshot = require('../../lib/ai-composer/snapshot');

module.exports = async function aiComposerSnapshot(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' });
  const access = await requireComposerAccess(req);
  if (!access.ok) return sendJson(res, access.code, { ok: false, error: access.error });
  const body = await readBody(req);
  const slug = String(body.slug || '').trim().toLowerCase();
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) return sendJson(res, 400, { ok: false, error: 'slug is required' });

  const r = await admin.from('sites').select('id,slug,config,referring_partner_id,servicing_partner_id').eq('slug', slug).maybeSingle();
  if (r.error) return sendJson(res, 500, { ok: false, error: r.error.message });
  if (!canComposeSite(access, r.data)) return sendJson(res, 403, { ok: false, error: 'You can only check sites you built with AI Composer.' });

  try {
    const shot = await snapshot.capture('https://www.leadpages.com.au/' + encodeURIComponent(slug) + '?preview=1', { sections: true });
    const up = await snapshot.uploadSnapshot(shot.buffer, slug);
    return sendJson(res, 200, {
      ok: true,
      imageUrl: up.url,
      width: up.width || shot.width,
      height: up.height || shot.height,
      sections: shot.sections
    });
  } catch (e) {
    return sendJson(res, 502, { ok: false, error: 'Could not take a screenshot of the site: ' + String((e && e.message) || e) });
  }
};
