'use strict';

const { sendJson } = require('../../lib/layout-composer/http');
const { listCatalogueSections } = require('../../lib/layout-composer/section-catalogue');
const { layoutComposerFlagPayload } = require('../../lib/layout-composer/flags');

/** GET /api/layout-composer/catalogue — section catalogue + flag (no auth required). */
module.exports = async function layoutComposerCatalogue(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('allow', 'GET, OPTIONS');
    return sendJson(res, 204, {});
  }
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'GET only' });
  return sendJson(res, 200, {
    ok: true,
    flag: layoutComposerFlagPayload(),
    sections: listCatalogueSections(),
  });
};
