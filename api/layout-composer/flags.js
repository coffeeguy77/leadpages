'use strict';

const { layoutComposerFlagPayload } = require('../../lib/layout-composer/flags');

/**
 * GET /api/layout-composer/flags
 * Public read of LAYOUT_COMPOSER feature flag for entry UI gating.
 */
module.exports = async function layoutComposerFlags(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'OPTIONS') {
    return res.status(405).json({ ok: false, error: 'GET only' });
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('allow', 'GET, OPTIONS');
    return res.status(204).end();
  }
  return res.status(200).json(layoutComposerFlagPayload());
};
