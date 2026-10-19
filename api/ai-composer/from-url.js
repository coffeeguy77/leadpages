'use strict';

/**
 * POST /api/ai-composer/from-url   Body: { url }
 * "Copy an existing website": takes a full-page screenshot of a public website at
 * 1440px (safely — public addresses only, see lib/ai-composer/snapshot.js), uploads
 * it as the design, and returns the page's visible text with positions (so the copy
 * is word for word), its other pages and its meta description. The page then runs the
 * normal analyse → fill → build steps on that screenshot.
 *
 * Full mode only (super admins and trusted partners). Counts towards a partner's
 * monthly limit like a design upload.
 */

const { sendJson, readBody } = require('../../lib/layout-composer/http');
const { requireComposerAccess, checkMonthlyLimit } = require('../../lib/ai-composer/access');
const snapshot = require('../../lib/ai-composer/snapshot');

module.exports = async function aiComposerFromUrl(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' });
  const access = await requireComposerAccess(req, { full: true });
  if (!access.ok) return sendJson(res, access.code, { ok: false, error: access.error });
  const quota = await checkMonthlyLimit(access);
  if (!quota.ok) return sendJson(res, quota.code, { ok: false, error: quota.error });

  const body = await readBody(req);
  let url;
  try {
    url = await snapshot.checkExternalUrl(body.url);
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: e.message });
  }
  try {
    const shot = await snapshot.capture(url.href, { external: true, extract: true, waitMs: 1200 });
    if (shot.height < 300) return sendJson(res, 422, { ok: false, error: 'That page came back almost empty — check the address, or upload a screenshot instead.' });
    const up = await snapshot.uploadSnapshot(shot.buffer, url.hostname);
    const page = shot.page || { blocks: [], links: [], description: '' };
    return sendJson(res, 200, {
      ok: true,
      design: { imageUrl: up.url, width: up.width || shot.width, height: up.height || shot.height },
      source: {
        url: shot.finalUrl || url.href,
        title: String(shot.title || '').slice(0, 200),
        description: page.description,
        blocks: page.blocks.filter(function (b) { return b.y >= 0; }).slice(0, 600),
        links: page.links
      }
    });
  } catch (e) {
    return sendJson(res, 502, { ok: false, error: 'Could not load that website: ' + String((e && e.message) || e).slice(0, 200) });
  }
};
