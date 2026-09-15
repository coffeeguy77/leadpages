'use strict';

const { sendJson, readBody, requireUser } = require('../../lib/layout-composer/http');
const { compileBlueprintToConfig } = require('../../lib/layout-composer/compile');
const {
  fillConfigFromBrief,
  recommendLandingPages,
  buildResearchBrief,
} = require('../../lib/layout-composer/generate');
const { fillConfigFromUnderstanding, mergeBrief } = require('../../lib/layout-composer/rich-fill');
const { suggestApps } = require('../../lib/layout-composer/interview');
const { openaiKey, generateResearchBrief } = require('../../lib/layout-composer/ai-brief');

/**
 * POST /api/layout-composer/generate
 * Fills content into a confirmed blueprint structure only (no layout mutation).
 * Body: { blueprint, brief, understanding?, config?, fillEmptyOnly?, includeResearch?, includeLandings? }
 */
module.exports = async function layoutComposerGenerate(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('allow', 'POST, OPTIONS');
    return sendJson(res, 204, {});
  }
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' });

  // Auth optional for flagged preview / local testing — deterministic stubs do not mutate DB.
  await requireUser(req);

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
    const understanding = body.understanding || null;
    const effectiveBrief = mergeBrief(brief, understanding);

    const compiled = compileBlueprintToConfig(blueprint, {
      baseConfig: body.config || null,
      identity: {
        name: effectiveBrief.businessName,
        trade: effectiveBrief.trade,
        location: effectiveBrief.location,
        phone: brief.phone,
        email: brief.email,
      },
      confirmedAt: new Date().toISOString(),
    });

    const useRich =
      understanding &&
      ((understanding.services && understanding.services.length) ||
        understanding.differentiator ||
        (understanding.serviceAreas && understanding.serviceAreas.length));

    const filled = useRich
      ? fillConfigFromUnderstanding(compiled.config, blueprint, brief, understanding, {
          fillEmptyOnly: body.fillEmptyOnly === true,
        })
      : fillConfigFromBrief(compiled.config, blueprint, effectiveBrief, {
          fillEmptyOnly: body.fillEmptyOnly === true,
        });

    const home = (blueprint.pages && blueprint.pages[0]) || {};
    const enabledKeys = (home.sections || [])
      .filter(function (s) { return s && s.key && s.enabled !== false; })
      .map(function (s) { return s.key; });

    const out = {
      ok: true,
      config: filled.config,
      filledKeys: filled.filledKeys,
      skippedKeys: filled.skippedKeys,
      sectionOrder: compiled.sectionOrder,
      structureLocked: true,
      understanding: effectiveBrief,
      appSuggestions: suggestApps(effectiveBrief, enabledKeys),
      fillMode: useRich ? 'interview_rich' : 'brief_placeholder',
      notice: useRich
        ? 'SEO content filled into every app in your confirmed layout from the briefing — structure unchanged.'
        : 'Content filled inside the confirmed layout only — structure was not changed. Complete the briefing for richer SEO copy.',
    };

    if (body.includeResearch) {
      let research = null;
      if (openaiKey()) {
        try {
          research = await generateResearchBrief(effectiveBrief, understanding || effectiveBrief);
        } catch (_e) {
          research = null;
        }
      }
      out.research = research || buildResearchBrief(effectiveBrief);
    }
    if (body.includeLandings) {
      out.landings = recommendLandingPages(effectiveBrief);
    }
    return sendJson(res, 200, out);
  } catch (e) {
    const code = e.code === 'STRUCTURE_CHANGED' ? 409 : 500;
    return sendJson(res, code, { ok: false, error: String(e.message || e), code: e.code || null });
  }
};
