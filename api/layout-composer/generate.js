'use strict';

const { sendJson, readBody, requireUser } = require('../../lib/layout-composer/http');
const { compileBlueprintToConfig } = require('../../lib/layout-composer/compile');
const {
  fillConfigFromBrief,
  recommendLandingPages,
  buildResearchBrief,
} = require('../../lib/layout-composer/generate');

/**
 * POST /api/layout-composer/generate
 * Fills content into a confirmed blueprint structure only (no layout mutation).
 * Body: { blueprint, brief, config?, fillEmptyOnly?, includeResearch?, includeLandings? }
 */
module.exports = async function layoutComposerGenerate(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('allow', 'POST, OPTIONS');
    return sendJson(res, 204, {});
  }
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' });

  const user = await requireUser(req);
  if (!user) return sendJson(res, 401, { ok: false, error: 'Sign in required' });

  const body = await readBody(req);
  const blueprint = body.blueprint;
  if (!blueprint || typeof blueprint !== 'object') {
    return sendJson(res, 400, { ok: false, error: 'Confirmed blueprint is required' });
  }
  if (body.confirmed !== true) {
    return sendJson(res, 400, {
      ok: false,
      needsConfirmation: true,
      error: 'Confirm the layout before generating content. AI will not change structure.',
    });
  }

  const brief = body.brief || {};
  if (!String(brief.businessName || '').trim()) {
    return sendJson(res, 400, { ok: false, error: 'brief.businessName is required' });
  }

  try {
    const compiled = compileBlueprintToConfig(blueprint, {
      baseConfig: body.config || null,
      identity: {
        name: brief.businessName,
        trade: brief.trade,
        location: brief.location,
        phone: brief.phone,
        email: brief.email,
      },
      confirmedAt: new Date().toISOString(),
    });

    const filled = fillConfigFromBrief(compiled.config, blueprint, brief, {
      fillEmptyOnly: body.fillEmptyOnly === true,
    });

    const out = {
      ok: true,
      config: filled.config,
      filledKeys: filled.filledKeys,
      skippedKeys: filled.skippedKeys,
      sectionOrder: compiled.sectionOrder,
      structureLocked: true,
      notice: 'Content filled inside the confirmed layout only — structure was not changed.',
    };

    if (body.includeResearch) {
      out.research = buildResearchBrief(brief);
    }
    if (body.includeLandings) {
      out.landings = recommendLandingPages(brief);
    }
    return sendJson(res, 200, out);
  } catch (e) {
    const code = e.code === 'STRUCTURE_CHANGED' ? 409 : 500;
    return sendJson(res, code, { ok: false, error: String(e.message || e), code: e.code || null });
  }
};
