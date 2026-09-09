'use strict';

const { sendJson, readBody, requireUser } = require('../../lib/layout-composer/http');
const { recommendLandingPages } = require('../../lib/layout-composer/generate');

/**
 * POST /api/layout-composer/landings
 * Returns checkbox-style landing recommendations. Does not create pages —
 * selected IDs should be passed into the existing landing builder / Brain draft.
 */
module.exports = async function layoutComposerLandings(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('allow', 'POST, OPTIONS');
    return sendJson(res, 204, {});
  }
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' });

  // Auth optional for flagged preview / local testing — deterministic stubs do not mutate DB.
  const user = await requireUser(req);

  const body = await readBody(req);
  const brief = body.brief || body;
  const landings = recommendLandingPages(brief);
  return sendJson(res, 200, {
    ok: true,
    landings: landings,
    integration: {
      builder: 'manage.html Landing tab',
      brainDraft: 'POST /api/brain/landing-draft',
      note: 'Layout Composer only recommends. Create/edit landings in the existing builder.',
    },
  });
};
