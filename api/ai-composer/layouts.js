'use strict';

/**
 * GET  /api/ai-composer/layouts            super admin: custom layouts made by AI Composer
 * POST /api/ai-composer/layouts { id, status }   approve (everyone may use it, and the
 *      planner offers it for new designs), keep on its site only ('site'), or hide.
 * Hiding never changes sites already using it — each site keeps its own copy.
 */

const { sendJson, readBody } = require('../../lib/layout-composer/http');
const { requireSuperAdmin } = require('../../lib/ai-composer/access');
const { listBlocks, setBlockStatus } = require('../../lib/ai-composer/block-store');

module.exports = async function aiComposerLayouts(req, res) {
  const access = await requireSuperAdmin(req);
  if (!access.ok) return sendJson(res, access.code, { ok: false, error: access.error });
  try {
    if (req.method === 'GET') return sendJson(res, 200, { ok: true, layouts: await listBlocks() });
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'GET or POST' });
    const body = await readBody(req);
    const id = String(body.id || '');
    if (!/^[0-9a-f-]{36}$/.test(id)) return sendJson(res, 400, { ok: false, error: 'Unknown layout' });
    return sendJson(res, 200, { ok: true, layout: await setBlockStatus(id, String(body.status || '')) });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: e.message });
  }
};
